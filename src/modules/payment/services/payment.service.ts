import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';
import { decryptPrivateKey } from '../../../common/utils/wallet.js';

const prisma = new PrismaClient();

const VTPASS_BASE_URL = process.env.VTPASS_BASE_URL || 'https://sandbox.vtpass.com/api';
const VTPASS_API_KEY = process.env.VTPASS_API_KEY || '';
const VTPASS_SECRET_KEY = process.env.VTPASS_SECRET_KEY || '';
const FUJI_RPC = 'https://api.avax-test.network/ext/bc/C/rpc';
const TREASURY_VAULT = '0xeD3e610f22bd8cf6e9853978e758D0480e1D7A15';
const AVAX_CHAIN_ID = 43113; // Fuji testnet

const NETWORK_MAP: Record<string, string> = {
  MTN: 'mtn',
  AIRTEL: 'airtel',
  GLO: 'glo',
  '9MOBILE': 'etisalat',
};

export const verifyTransaction = async (txHash: string): Promise<{ valid: boolean; value: string }> => {
  try {
    const response = await fetch(FUJI_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getTransactionReceipt',
        params: [txHash],
        id: 1,
      }),
    });
    const data: any = await response.json();
    const receipt = data.result;
    if (!receipt) return { valid: false, value: '0' };
    const valid = receipt.to?.toLowerCase() === TREASURY_VAULT.toLowerCase() && receipt.status === '0x1';
    const txResponse = await fetch(FUJI_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_getTransactionByHash', params: [txHash], id: 1 }),
    });
    const txData: any = await txResponse.json();
    return { valid, value: txData.result?.value || '0x0' };
  } catch (err) {
    console.error('Chain verification failed:', err);
    return { valid: false, value: '0' };
  }
};

export const purchaseAirtime = async (params: { phone: string; network: string; amount: number; requestId: string }) => {
  const serviceID = NETWORK_MAP[params.network.toUpperCase()] || params.network.toLowerCase();
  const response = await fetch(`${VTPASS_BASE_URL}/pay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': VTPASS_API_KEY, 'secret-key': VTPASS_SECRET_KEY },
    body: JSON.stringify({ request_id: params.requestId, serviceID, amount: params.amount, phone: params.phone }),
  });
  return await response.json() as any;
};

export const processAirtimePayment = async (params: {
  txHash: string; phone: string; network: string; amount: number; sliqId: string; userId: string;
}) => {
  const { valid } = await verifyTransaction(params.txHash);
  if (!valid) throw new Error('Transaction not found or did not reach TreasuryVault');

  const existing = await (prisma as any).cryptoPayment.findUnique({ where: { txHash: params.txHash } });
  if (existing) throw new Error('Transaction already processed');

  const requestId = `SQ-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
  const vtpassResult: any = await purchaseAirtime({ phone: params.phone, network: params.network, amount: params.amount, requestId });
  const vtpassSuccess = vtpassResult?.code === '000' || vtpassResult?.response_description === 'TRANSACTION SUCCESSFUL';

  await (prisma as any).cryptoPayment.create({
    data: {
      txHash: params.txHash, sliqId: params.sliqId, userId: params.userId,
      amount: params.amount, network: params.network, phone: params.phone,
      vtpassRef: requestId, vtpassStatus: vtpassSuccess ? 'SUCCESS' : 'FAILED',
      vtpassResponse: JSON.stringify(vtpassResult), status: vtpassSuccess ? 'COMPLETED' : 'FAILED',
    },
  });

  if (!vtpassSuccess) throw new Error(`VTPass failed: ${vtpassResult?.response_description || 'Unknown error'}`);
  return { success: true, requestId, message: 'Airtime purchased successfully' };
};

/**
 * Custodial flow: Backend signs & sends AVAX from the user's auto-generated wallet
 * to TreasuryVault, then processes the airtime purchase.
 */
export const custodialAirtimePurchase = async (params: {
  phone: string; network: string; amount: number; sliqId: string; userId: string;
}) => {
  // 1. Fetch user to get encrypted private key
  const user = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!user) throw new Error('User not found');
  if (!user.encrypted_private_key) throw new Error('No custodial wallet found. Please contact support.');
  if (!user.wallet_address) throw new Error('No wallet address on file');

  // 2. Decrypt private key and create wallet instance
  const privateKey = decryptPrivateKey(user.encrypted_private_key);
  const provider = new ethers.JsonRpcProvider(FUJI_RPC, AVAX_CHAIN_ID);
  const wallet = new ethers.Wallet(privateKey, provider);

  // 3. Convert NGN amount to AVAX (simplified: 1 AVAX ≈ 50,000 NGN for demo)
  // In production, fetch from MockFxOracle or a live price feed
  const AVAX_NGN_RATE = 50000;
  const avaxAmount = params.amount / AVAX_NGN_RATE;
  const weiAmount = ethers.parseEther(avaxAmount.toFixed(18));

  // 4. Check wallet balance
  const balance = await provider.getBalance(wallet.address);
  if (balance < weiAmount) {
    throw new Error(
      `Insufficient crypto balance. Need ${avaxAmount.toFixed(6)} AVAX but wallet has ${ethers.formatEther(balance)} AVAX. ` +
      `Fund your wallet (${wallet.address}) with test AVAX from https://faucet.avax.network/`
    );
  }

  // 5. Send AVAX to TreasuryVault
  const tx = await wallet.sendTransaction({
    to: TREASURY_VAULT,
    value: weiAmount,
  });
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error('On-chain transaction failed');

  const txHash = tx.hash;

  // 6. Process the airtime purchase using the confirmed txHash
  const requestId = `SQ-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
  const vtpassResult: any = await purchaseAirtime({ phone: params.phone, network: params.network, amount: params.amount, requestId });
  const vtpassSuccess = vtpassResult?.code === '000' || vtpassResult?.response_description === 'TRANSACTION SUCCESSFUL';

  await (prisma as any).cryptoPayment.create({
    data: {
      txHash, sliqId: params.sliqId, userId: params.userId,
      amount: params.amount, network: params.network, phone: params.phone,
      vtpassRef: requestId, vtpassStatus: vtpassSuccess ? 'SUCCESS' : 'FAILED',
      vtpassResponse: JSON.stringify(vtpassResult), status: vtpassSuccess ? 'COMPLETED' : 'FAILED',
    },
  });

  if (!vtpassSuccess) throw new Error(`VTPass failed: ${vtpassResult?.response_description || 'Unknown error'}`);
  return { success: true, txHash, requestId, message: 'Airtime purchased via crypto successfully' };
};
