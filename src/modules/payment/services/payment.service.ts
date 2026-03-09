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

// ──────────────────────────────────────────────────────────
// VTPass Service ID maps
// ──────────────────────────────────────────────────────────

const AIRTIME_NETWORK_MAP: Record<string, string> = {
  MTN: 'mtn',
  AIRTEL: 'airtel',
  GLO: 'glo',
  '9MOBILE': 'etisalat',
};

const DATA_NETWORK_MAP: Record<string, string> = {
  MTN: 'mtn-data',
  AIRTEL: 'airtel-data',
  GLO: 'glo-data',
  '9MOBILE': 'etisalat-data',
};

// Map from our biller IDs to VTPass serviceIDs
const ELECTRICITY_BILLER_MAP: Record<string, string> = {
  abuja: 'abuja-electric',
  benin: 'benin-electric',
  enugu: 'enugu-electric',
  ibadan: 'ibadan-electric',
  kaduna: 'kaduna-electric',
  eko: 'eko-electric',
  ikeja: 'ikeja-electric',
  portharcourt: 'portharcourt-electric',
  jos: 'jos-electric',
  kano: 'kano-electric',
  aba: 'aba-electric',
  yola: 'yola-electric',
};

const CABLETV_BILLER_MAP: Record<string, string> = {
  dstv: 'dstv',
  gotv: 'gotv',
  startimes: 'startimes',
  showmax: 'showmax',
};

// ──────────────────────────────────────────────────────────
// On-chain verification
// ──────────────────────────────────────────────────────────

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

    const valid =
      receipt.to?.toLowerCase() === TREASURY_VAULT.toLowerCase() && receipt.status === '0x1';

    const txResponse = await fetch(FUJI_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getTransactionByHash',
        params: [txHash],
        id: 1,
      }),
    });
    const txData: any = await txResponse.json();
    return { valid, value: txData.result?.value || '0x0' };
  } catch (err) {
    console.error('Chain verification failed:', err);
    return { valid: false, value: '0' };
  }
};

// ──────────────────────────────────────────────────────────
// Helper: call VTPass /pay endpoint
// ──────────────────────────────────────────────────────────

interface VTPassPayload {
  request_id: string;
  serviceID: string;
  amount: number;
  phone: string;
  billersCode?: string;   // meter number / smart card number / decoder number
  variation_code?: string; // required for data, cable TV fixed plans
  quantity?: number;
  subscription_type?: string; // 'change' | 'renew' for cable TV
}

const callVTPass = async (payload: VTPassPayload): Promise<any> => {
  console.log('[VTPass] Request payload:', JSON.stringify(payload));
  const response = await fetch(`${VTPASS_BASE_URL}/pay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': VTPASS_API_KEY,
      'secret-key': VTPASS_SECRET_KEY,
    },
    body: JSON.stringify(payload),
  });
  const result = await response.json() as any;
  console.log('[VTPass] Response:', JSON.stringify(result));
  return result;
};

const isVTPassSuccess = (result: any) =>
  result?.code === '000' || result?.response_description === 'TRANSACTION SUCCESSFUL';

// ──────────────────────────────────────────────────────────
// Duplicate-transaction guard
// ──────────────────────────────────────────────────────────

const guardDuplicate = async (txHash: string) => {
  const existing = await (prisma as any).cryptoPayment.findUnique({ where: { txHash } });
  if (existing) throw new Error('Transaction already processed');
};

// ──────────────────────────────────────────────────────────
// Save record to DB
// ──────────────────────────────────────────────────────────

const savePaymentRecord = async (params: {
  txHash: string;
  sliqId: string;
  userId: string;
  amount: number;
  network: string;
  phone: string;
  vtpassRef: string;
  vtpassResult: any;
}) => {
  const vtpassSuccess = isVTPassSuccess(params.vtpassResult);
  await (prisma as any).cryptoPayment.create({
    data: {
      txHash: params.txHash,
      sliqId: params.sliqId,
      userId: params.userId,
      amount: params.amount,
      network: params.network,
      phone: params.phone,
      vtpassRef: params.vtpassRef,
      vtpassStatus: vtpassSuccess ? 'SUCCESS' : 'FAILED',
      vtpassResponse: JSON.stringify(params.vtpassResult),
      status: vtpassSuccess ? 'COMPLETED' : 'FAILED',
    },
  });
  return vtpassSuccess;
};

// ──────────────────────────────────────────────────────────
// 1. AIRTIME PURCHASE
// ──────────────────────────────────────────────────────────

export const processAirtimePayment = async (params: {
  txHash: string;
  phone: string;
  network: string;
  amount: number;
  sliqId: string;
  userId: string;
}) => {
  const { valid } = await verifyTransaction(params.txHash);
  if (!valid) throw new Error('Transaction not found or did not reach TreasuryVault');

  await guardDuplicate(params.txHash);

  const serviceID = AIRTIME_NETWORK_MAP[params.network.toUpperCase()] || params.network.toLowerCase();
  const requestId = `SQ-${Date.now()}-${Math.floor(Math.random() * 9999)}`;

  const vtpassResult = await callVTPass({
    request_id: requestId,
    serviceID,
    amount: params.amount,
    phone: params.phone,
  });

  const success = await savePaymentRecord({
    txHash: params.txHash,
    sliqId: params.sliqId,
    userId: params.userId,
    amount: params.amount,
    network: params.network,
    phone: params.phone,
    vtpassRef: requestId,
    vtpassResult,
  });

  if (!success) {
    throw new Error(`VTPass airtime purchase failed: ${vtpassResult?.response_description || 'Unknown error'}`);
  }

  return { success: true, requestId, message: 'Airtime purchased successfully' };
};

// ──────────────────────────────────────────────────────────
// 2. DATA PURCHASE
// ──────────────────────────────────────────────────────────

export const processDataPayment = async (params: {
  txHash: string;
  phone: string;
  network: string;         // e.g. 'MTN'
  variationCode: string;   // e.g. 'mtn-10mb-100'
  amount: number;
  sliqId: string;
  userId: string;
}) => {
  const { valid } = await verifyTransaction(params.txHash);
  if (!valid) throw new Error('Transaction not found or did not reach TreasuryVault');

  await guardDuplicate(params.txHash);

  const serviceID = DATA_NETWORK_MAP[params.network.toUpperCase()] || `${params.network.toLowerCase()}-data`;
  const requestId = `SQ-${Date.now()}-${Math.floor(Math.random() * 9999)}`;

  const vtpassResult = await callVTPass({
    request_id: requestId,
    serviceID,
    amount: params.amount,
    phone: params.phone,
    variation_code: params.variationCode,
  });

  const success = await savePaymentRecord({
    txHash: params.txHash,
    sliqId: params.sliqId,
    userId: params.userId,
    amount: params.amount,
    network: `${params.network}-data`,
    phone: params.phone,
    vtpassRef: requestId,
    vtpassResult,
  });

  if (!success) {
    throw new Error(`VTPass data purchase failed: ${vtpassResult?.response_description || 'Unknown error'}`);
  }

  return { success: true, requestId, message: 'Data purchased successfully' };
};

// ──────────────────────────────────────────────────────────
// 3. ELECTRICITY BILL PAYMENT
// ──────────────────────────────────────────────────────────

export const processElectricityPayment = async (params: {
  txHash: string;
  meterNumber: string;
  billerId: string;         // our internal ID e.g. 'abuja'
  meterType: 'prepaid' | 'postpaid';
  amount: number;
  phone: string;
  sliqId: string;
  userId: string;
}) => {
  const { valid } = await verifyTransaction(params.txHash);
  if (!valid) throw new Error('Transaction not found or did not reach TreasuryVault');

  await guardDuplicate(params.txHash);

  const serviceID = ELECTRICITY_BILLER_MAP[params.billerId.toLowerCase()] || `${params.billerId.toLowerCase()}-electric`;
  const requestId = `SQ-${Date.now()}-${Math.floor(Math.random() * 9999)}`;

  const vtpassResult = await callVTPass({
    request_id: requestId,
    serviceID,
    amount: params.amount,
    phone: params.phone,
    billersCode: params.meterNumber,
    variation_code: params.meterType, // 'prepaid' or 'postpaid'
  });

  const success = await savePaymentRecord({
    txHash: params.txHash,
    sliqId: params.sliqId,
    userId: params.userId,
    amount: params.amount,
    network: serviceID,
    phone: params.meterNumber,
    vtpassRef: requestId,
    vtpassResult,
  });

  if (!success) {
    throw new Error(`VTPass electricity payment failed: ${vtpassResult?.response_description || 'Unknown error'}`);
  }

  return { success: true, requestId, token: vtpassResult?.content?.transactions?.token, message: 'Electricity token purchased successfully' };
};

// ──────────────────────────────────────────────────────────
// 4. CABLE TV PAYMENT
// ──────────────────────────────────────────────────────────

export const processCableTvPayment = async (params: {
  txHash: string;
  smartCardNumber: string;
  billerId: string;          // 'dstv' | 'gotv' | 'startimes' | 'showmax'
  variationCode: string;     // e.g. 'dstv-padi'
  amount: number;
  phone: string;
  subscriptionType?: 'change' | 'renew';
  sliqId: string;
  userId: string;
}) => {
  const { valid } = await verifyTransaction(params.txHash);
  if (!valid) throw new Error('Transaction not found or did not reach TreasuryVault');

  await guardDuplicate(params.txHash);

  const serviceID = CABLETV_BILLER_MAP[params.billerId.toLowerCase()] || params.billerId.toLowerCase();
  const requestId = `SQ-${Date.now()}-${Math.floor(Math.random() * 9999)}`;

  const vtpassResult = await callVTPass({
    request_id: requestId,
    serviceID,
    amount: params.amount,
    phone: params.phone,
    billersCode: params.smartCardNumber,
    variation_code: params.variationCode,
    subscription_type: params.subscriptionType || 'renew',
    quantity: 1,
  });

  const success = await savePaymentRecord({
    txHash: params.txHash,
    sliqId: params.sliqId,
    userId: params.userId,
    amount: params.amount,
    network: serviceID,
    phone: params.smartCardNumber,
    vtpassRef: requestId,
    vtpassResult,
  });

  if (!success) {
    throw new Error(`VTPass cable TV payment failed: ${vtpassResult?.response_description || 'Unknown error'}`);
  }

  return { success: true, requestId, message: 'Cable TV subscription processed successfully' };
};

// ──────────────────────────────────────────────────────────
// 5. Custodial airtime (backend signs & sends)
// ──────────────────────────────────────────────────────────

export const custodialAirtimePurchase = async (params: {
  phone: string;
  network: string;
  amount: number;
  sliqId: string;
  userId: string;
}) => {
  const user = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!user) throw new Error('User not found');
  if (!user.encrypted_private_key) throw new Error('No custodial wallet found. Please contact support.');
  if (!user.wallet_address) throw new Error('No wallet address on file');

  const privateKey = decryptPrivateKey(user.encrypted_private_key);
  const provider = new ethers.JsonRpcProvider(FUJI_RPC, AVAX_CHAIN_ID);
  const wallet = new ethers.Wallet(privateKey, provider);

  const AVAX_NGN_RATE = 50000;
  const avaxAmount = params.amount / AVAX_NGN_RATE;
  const weiAmount = ethers.parseEther(avaxAmount.toFixed(18));

  const balance = await provider.getBalance(wallet.address);
  if (balance < weiAmount) {
    throw new Error(
      `Insufficient crypto balance. Need ${avaxAmount.toFixed(6)} AVAX but wallet has ${ethers.formatEther(balance)} AVAX. ` +
        `Fund your wallet (${wallet.address}) with test AVAX from https://faucet.avax.network/`
    );
  }

  const tx = await wallet.sendTransaction({ to: TREASURY_VAULT, value: weiAmount });
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error('On-chain transaction failed');

  const txHash = tx.hash;
  const serviceID = AIRTIME_NETWORK_MAP[params.network.toUpperCase()] || params.network.toLowerCase();
  const requestId = `SQ-${Date.now()}-${Math.floor(Math.random() * 9999)}`;

  const vtpassResult = await callVTPass({
    request_id: requestId,
    serviceID,
    amount: params.amount,
    phone: params.phone,
  });

  const success = await savePaymentRecord({
    txHash,
    sliqId: params.sliqId,
    userId: params.userId,
    amount: params.amount,
    network: params.network,
    phone: params.phone,
    vtpassRef: requestId,
    vtpassResult,
  });

  if (!success) {
    throw new Error(`VTPass failed: ${vtpassResult?.response_description || 'Unknown error'}`);
  }

  return { success: true, txHash, requestId, message: 'Airtime purchased via crypto successfully' };
};

// ──────────────────────────────────────────────────────────
// Fiat (non-crypto) purchases — call VTPass directly
// after deducting from the user's account balance.
// These are called by the fiat-payment controller.
// ──────────────────────────────────────────────────────────

export const fiatAirtimePurchase = async (params: {
  phone: string; network: string; amount: number; sliqId: string; userId: string;
}) => {
  const serviceID = AIRTIME_NETWORK_MAP[params.network.toUpperCase()] || params.network.toLowerCase();
  const requestId = `SQ-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
  const vtpassResult = await callVTPass({ request_id: requestId, serviceID, amount: params.amount, phone: params.phone });
  const vtpassSuccess = isVTPassSuccess(vtpassResult);
  return { success: vtpassSuccess, requestId, vtpassResult };
};

export const fiatDataPurchase = async (params: {
  phone: string; network: string; variationCode: string; amount: number; sliqId: string; userId: string;
}) => {
  const serviceID = DATA_NETWORK_MAP[params.network.toUpperCase()] || `${params.network.toLowerCase()}-data`;
  const requestId = `SQ-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
  const vtpassResult = await callVTPass({ request_id: requestId, serviceID, amount: params.amount, phone: params.phone, variation_code: params.variationCode });
  const vtpassSuccess = isVTPassSuccess(vtpassResult);
  return { success: vtpassSuccess, requestId, vtpassResult };
};

export const fiatElectricityPurchase = async (params: {
  meterNumber: string; billerId: string; meterType: 'prepaid' | 'postpaid'; amount: number; phone: string;
}) => {
  const serviceID = ELECTRICITY_BILLER_MAP[params.billerId.toLowerCase()] || `${params.billerId.toLowerCase()}-electric`;
  const requestId = `SQ-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
  const vtpassResult = await callVTPass({ request_id: requestId, serviceID, amount: params.amount, phone: params.phone, billersCode: params.meterNumber, variation_code: params.meterType });
  const vtpassSuccess = isVTPassSuccess(vtpassResult);
  return { success: vtpassSuccess, requestId, token: vtpassResult?.content?.transactions?.token, vtpassResult };
};

export const fiatCableTvPurchase = async (params: {
  smartCardNumber: string; billerId: string; variationCode: string; amount: number; phone: string;
}) => {
  const serviceID = CABLETV_BILLER_MAP[params.billerId.toLowerCase()] || params.billerId.toLowerCase();
  const requestId = `SQ-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
  const vtpassResult = await callVTPass({ request_id: requestId, serviceID, amount: params.amount, phone: params.phone, billersCode: params.smartCardNumber, variation_code: params.variationCode, subscription_type: 'renew', quantity: 1 });
  const vtpassSuccess = isVTPassSuccess(vtpassResult);
  return { success: vtpassSuccess, requestId, vtpassResult };
};
