import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const VTPASS_BASE_URL = process.env.VTPASS_BASE_URL || 'https://sandbox.vtpass.com/api';
const VTPASS_API_KEY = process.env.VTPASS_API_KEY || '';
const VTPASS_SECRET_KEY = process.env.VTPASS_SECRET_KEY || '';
const FUJI_RPC = 'https://api.avax-test.network/ext/bc/C/rpc';
const TREASURY_VAULT = '0xeD3e610f22bd8cf6e9853978e758D0480e1D7A15';

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
    const data = await response.json();
    const receipt = data.result;
    if (!receipt) return { valid: false, value: '0' };
    const valid = receipt.to?.toLowerCase() === TREASURY_VAULT.toLowerCase() && receipt.status === '0x1';
    const txResponse = await fetch(FUJI_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_getTransactionByHash', params: [txHash], id: 1 }),
    });
    const txData = await txResponse.json();
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
  return await response.json();
};

export const processAirtimePayment = async (params: {
  txHash: string; phone: string; network: string; amount: number; sliqId: string; userId: string;
}) => {
  const { valid } = await verifyTransaction(params.txHash);
  if (!valid) throw new Error('Transaction not found or did not reach TreasuryVault');

  const existing = await (prisma as any).cryptoPayment.findUnique({ where: { txHash: params.txHash } });
  if (existing) throw new Error('Transaction already processed');

  const requestId = `SQ-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
  const vtpassResult = await purchaseAirtime({ phone: params.phone, network: params.network, amount: params.amount, requestId });
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
