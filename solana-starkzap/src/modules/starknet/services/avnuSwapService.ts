import {Amount, fromAddress, getPresets, ChainId, type WalletInterface} from 'starkzap';
import type {Token} from 'starkzap';

/**
 * Returns Starkzap mainnet token presets (STRK, ETH, USDC, USDT, WBTC, etc.)
 * These are the canonical addresses recognized by Starkzap staking & AVNU swap.
 */
export function getStarkzapTokenPresets(): Record<string, Token> {
  return getPresets(ChainId.MAINNET) as Record<string, Token>;
}

/**
 * Gets a single token from Starkzap presets by symbol.
 * Throws if not found.
 */
export function getPresetToken(symbol: string): Token {
  const presets = getStarkzapTokenPresets();
  const token = (presets as any)[symbol];
  if (!token) {
    throw new Error(`Token ${symbol} not found in Starkzap presets`);
  }
  return token;
}

/**
 * Executes a token swap on Starknet using Starkzap's wallet.swap()
 * with the registered AvnuSwapProvider.
 */
export async function swapTokensOnStarknet(
  wallet: WalletInterface,
  sellTokenAddress: string,
  sellTokenSymbol: string,
  sellTokenDecimals: number,
  buyTokenAddress: string,
  buyTokenSymbol: string,
  buyTokenDecimals: number,
  sellAmount: string,
): Promise<{txHash: string; explorerUrl: string}> {
  const tokenIn: Token = {
    name: sellTokenSymbol,
    address: fromAddress(sellTokenAddress),
    decimals: sellTokenDecimals,
    symbol: sellTokenSymbol,
  };

  const tokenOut: Token = {
    name: buyTokenSymbol,
    address: fromAddress(buyTokenAddress),
    decimals: buyTokenDecimals,
    symbol: buyTokenSymbol,
  };

  const amountIn = Amount.parse(sellAmount, tokenIn);

  console.log('[AvnuSwap] Swapping via wallet.swap():', {
    sell: `${sellAmount} ${sellTokenSymbol}`,
    buy: buyTokenSymbol,
  });

  const tx = await wallet.swap({
    tokenIn,
    tokenOut,
    amountIn,
    provider: 'avnu',
  });

  await tx.wait();

  console.log('[AvnuSwap] Swap confirmed:', tx.hash);

  return {
    txHash: tx.hash,
    explorerUrl: tx.explorerUrl || `https://voyager.online/tx/${tx.hash}`,
  };
}

/**
 * Swaps tokens using Starkzap preset tokens by symbol.
 * Uses the canonical addresses from Starkzap presets.
 */
export async function swapPresetTokens(
  wallet: WalletInterface,
  sellSymbol: string,
  buySymbol: string,
  sellAmount: string,
): Promise<{txHash: string; explorerUrl: string}> {
  const sellToken = getPresetToken(sellSymbol);
  const buyToken = getPresetToken(buySymbol);

  return swapTokensOnStarknet(
    wallet,
    sellToken.address.toString(),
    sellToken.symbol,
    sellToken.decimals,
    buyToken.address.toString(),
    buyToken.symbol,
    buyToken.decimals,
    sellAmount,
  );
}

/** Well-known Starknet mainnet token addresses */
export const STARKNET_TOKENS = {
  USDC: '0x033068F6539f8e6e6b131e6B2B814e6c34A5224bC66947c47DaB9dFeE93b35fb',
  WBTC: '0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac',
  wstETH: '0x042b8f0484674ca266ac5d08e4410cdc57b0d7ad189b0ee4afc4dca1d0759f3',
  sUSN: '0x02411565ef1a14decfbe83d2e987cced918cd752508a3d9c55deb67148d14d17',
  STRK: '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d',
  ETH: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
} as const;

/** Token decimals for well-known tokens */
export const STARKNET_TOKEN_DECIMALS: Record<string, number> = {
  USDC: 6,
  WBTC: 8,
  wstETH: 18,
  sUSN: 18,
  STRK: 18,
  ETH: 18,
};
