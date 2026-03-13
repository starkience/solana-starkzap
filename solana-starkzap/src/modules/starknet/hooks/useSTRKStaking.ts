import {useCallback, useState} from 'react';
import {
  stakeInPool,
  discoverSTRKPools,
} from '../services/starknetService';
import {useStarknetWallet} from './useStarknetWallet';

export interface STRKPool {
  poolContract: string;
  tokenSymbol: string;
  delegatedAmount: string;
  validatorName: string;
}

export function useSTRKStaking() {
  const {ensureWallet} = useStarknetWallet();
  const [availablePools, setAvailablePools] = useState<STRKPool[]>([]);
  const [isLoadingPools, setIsLoadingPools] = useState(false);

  const fetchPools = useCallback(async () => {
    setIsLoadingPools(true);
    try {
      const pools = await discoverSTRKPools();
      setAvailablePools(pools);
    } catch (error: any) {
      console.error('[STRK Staking] Error fetching pools:', error);
    } finally {
      setIsLoadingPools(false);
    }
  }, []);

  const stake = useCallback(
    async (poolAddress: string, amount: string): Promise<{txHash: string}> => {
      const wallet = await ensureWallet();
      if (!wallet) throw new Error('Failed to connect Starknet wallet');

      const tx = await stakeInPool(wallet, poolAddress, amount, 'STRK');
      const txHash = tx?.transaction_hash || tx?.hash || '';
      return {txHash};
    },
    [ensureWallet],
  );

  return {
    availablePools,
    isLoadingPools,
    fetchPools,
    stake,
  };
}
