/**
 * Service to fetch ERC-20 token balances on EVM chains via Alchemy JSON-RPC.
 *
 * Uses eth_call with the balanceOf(address) selector to read USDC balance
 * without needing a full ethers/viem dependency.
 */

import { ALCHEMY_ARBITRUM_API_KEY } from '@env';

/** USDC contract addresses per chain */
const USDC_CONTRACTS: Record<string, string> = {
  arbitrum: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  polygon: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
};

/** USDC uses 6 decimals on all chains */
const USDC_DECIMALS = 6;

/** Alchemy RPC endpoints per chain */
const ALCHEMY_RPCS: Record<string, string> = {
  arbitrum: `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_ARBITRUM_API_KEY || ''}`,
};

/** ERC-20 balanceOf(address) function selector */
const BALANCE_OF_SELECTOR = '0x70a08231';

/**
 * Fetches the USDC balance for a given wallet address on an EVM chain.
 * Returns a human-readable string (e.g., "5.00").
 */
export async function getEVMUSDCBalance(
  walletAddress: string,
  network: string = 'arbitrum',
): Promise<string> {
  const rpcUrl = ALCHEMY_RPCS[network.toLowerCase()];
  if (!rpcUrl) {
    console.warn(`[EVMBalance] No RPC configured for ${network}`);
    return '0.00';
  }

  const contractAddress = USDC_CONTRACTS[network.toLowerCase()];
  if (!contractAddress) {
    console.warn(`[EVMBalance] No USDC contract for ${network}`);
    return '0.00';
  }

  // Encode balanceOf(address) call data
  // Pad address to 32 bytes (remove 0x prefix, left-pad to 64 chars)
  const paddedAddress = walletAddress.toLowerCase().replace('0x', '').padStart(64, '0');
  const callData = `${BALANCE_OF_SELECTOR}${paddedAddress}`;

  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [
          { to: contractAddress, data: callData },
          'latest',
        ],
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error(`[EVMBalance] RPC error:`, data.error);
      return '0.00';
    }

    // Parse hex result to decimal
    const rawBalance = BigInt(data.result || '0x0');
    const divisor = BigInt(10 ** USDC_DECIMALS);
    const whole = rawBalance / divisor;
    const fraction = rawBalance % divisor;
    const fractionStr = fraction.toString().padStart(USDC_DECIMALS, '0').slice(0, 2);

    return `${whole}.${fractionStr}`;
  } catch (err: any) {
    console.error(`[EVMBalance] Failed to fetch ${network} USDC balance:`, err.message);
    return '0.00';
  }
}
