import { ethers } from 'ethers';

/**
 * SliqID On-Chain Registry Utility
 * 
 * Registers SliqIDs on the MockSliqIDRegistry smart contract.
 * This is a non-blocking, best-effort operation — if the contract
 * is not deployed or the call fails, signup still succeeds.
 */

// Minimal ABI for the registerSliqID function
const REGISTRY_ABI = [
  'function registerSliqID(string sliqId, address wallet) external',
  'function resolveAddress(string sliqId) external view returns (address)',
  'function isSliqIDRegistered(string sliqId) external view returns (bool)',
];

// Avalanche Fuji testnet RPC
const FUJI_RPC_URL = process.env.FUJI_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc';

// Deployed MockSliqIDRegistry on Avalanche Fuji
const REGISTRY_ADDRESS = process.env.SLIQ_ID_REGISTRY_ADDRESS || '0xA1b7Aad793601d9C6bcE03a2a2CD0B80eEE229b7';

// Private key for the signing wallet (backend hot wallet)
const SIGNER_PRIVATE_KEY = process.env.REGISTRY_SIGNER_PRIVATE_KEY || '';

/**
 * Register a SliqID on the blockchain.
 * 
 * @param sliqId - The SliqID to register (e.g. "ayomide.sliq")
 * @param walletAddress - The EVM wallet address to associate
 * @returns The transaction hash if successful, null otherwise
 */
export async function registerSliqIdOnChain(
  sliqId: string,
  walletAddress: string
): Promise<string | null> {
  // Skip if registry is not configured
  if (!REGISTRY_ADDRESS || !SIGNER_PRIVATE_KEY) {
    console.log(`[SliqID Registry] Skipping on-chain registration for "${sliqId}" — registry not configured`);
    return null;
  }

  try {
    const provider = new ethers.JsonRpcProvider(FUJI_RPC_URL);
    const signer = new ethers.Wallet(SIGNER_PRIVATE_KEY, provider);
    const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, signer);

    console.log(`[SliqID Registry] Registering "${sliqId}" → ${walletAddress} on-chain...`);
    
    const tx = await registry.registerSliqID(sliqId, walletAddress);
    const receipt = await tx.wait();

    console.log(`[SliqID Registry] ✓ Registered "${sliqId}" in tx ${receipt.hash}`);
    return receipt.hash;
  } catch (error: any) {
    // Non-fatal: log and move on — signup should not fail because of on-chain issues
    console.error(`[SliqID Registry] Failed to register "${sliqId}" on-chain:`, error.message || error);
    return null;
  }
}

/**
 * Check if a SliqID is already registered on-chain.
 * Read-only call, no gas needed.
 */
export async function isSliqIdRegisteredOnChain(sliqId: string): Promise<boolean> {
  if (!REGISTRY_ADDRESS) return false;

  try {
    const provider = new ethers.JsonRpcProvider(FUJI_RPC_URL);
    const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider);
    return await registry.isSliqIDRegistered(sliqId);
  } catch {
    return false;
  }
}
