import { useEffect, useState, useCallback } from 'react';
import { useEmbeddedEthereumWallet } from '@privy-io/expo';

/** EVM chain IDs for supported networks */
export const EVM_CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  arbitrum: 42161,
  base: 8453,
  polygon: 137,
};

/**
 * Hook to manage the Privy embedded Ethereum wallet.
 * The same address works across all EVM chains — Privy generates one
 * embedded wallet whose address is identical on Base, Arbitrum, Ethereum, etc.
 *
 * For chain-specific transactions, call `switchChain(chainId)` or
 * `getProviderForChain(network)` before signing.
 */
export function useBaseWallet() {
  const { wallets, create } = useEmbeddedEthereumWallet();
  const [isReady, setIsReady] = useState(false);

  const wallet = wallets?.[0] || null;
  const address = wallet?.address || null;

  useEffect(() => {
    if (wallet) {
      setIsReady(true);
    }
  }, [wallet]);

  /**
   * Ensure the embedded Ethereum wallet exists.
   * Creates one if the user doesn't have one yet.
   */
  const ensureWallet = useCallback(async () => {
    if (wallet) return wallet;
    try {
      await create();
      return wallets?.[0] || null;
    } catch (err: any) {
      console.error('[BaseWallet] Failed to create embedded ETH wallet:', err.message);
      return null;
    }
  }, [wallet, wallets, create]);

  /**
   * Get the EVM provider for signing transactions.
   * This can be used to sign LayerZero bridge transactions.
   */
  const getProvider = useCallback(async () => {
    const w = wallet || await ensureWallet();
    if (!w) throw new Error('No embedded Ethereum wallet available');
    return w.getProvider();
  }, [wallet, ensureWallet]);

  /**
   * Switch the provider to a specific EVM chain.
   * Must be called before signing transactions on non-default chains.
   */
  const switchChain = useCallback(async (chainId: number) => {
    const provider = await getProvider();
    const hexChainId = `0x${chainId.toString(16)}`;
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hexChainId }],
      });
      console.log(`[BaseWallet] Switched to chain ${chainId} (${hexChainId})`);
    } catch (err: any) {
      console.error(`[BaseWallet] Failed to switch to chain ${chainId}:`, err.message);
      throw err;
    }
    return provider;
  }, [getProvider]);

  /**
   * Get a provider that is already switched to the correct chain for a given network.
   * Use this for Arbitrum, Polygon, Ethereum, or Base transactions.
   */
  const getProviderForChain = useCallback(async (network: string) => {
    const chainId = EVM_CHAIN_IDS[network.toLowerCase()];
    if (!chainId) {
      console.warn(`[BaseWallet] Unknown network "${network}", using default provider`);
      return getProvider();
    }
    return switchChain(chainId);
  }, [getProvider, switchChain]);

  return {
    address,
    wallet,
    isReady,
    ensureWallet,
    getProvider,
    switchChain,
    getProviderForChain,
  };
}
