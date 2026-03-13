import {useCallback, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {AppDispatch, RootState} from '@/shared/state/store';
import {
  setStakingPositions,
  setStakingLoading,
  setStakingError,
  StakingPosition,
} from '@/shared/state/starknet/reducer';
import {
  stakeInPool,
  getPoolPosition,
  claimRewards,
  exitPoolIntent,
  exitPool,
  discoverBTCPools,
} from '../services/starknetService';
import {useStarknetWallet} from './useStarknetWallet';

export interface BTCPool {
  poolContract: string;
  tokenSymbol: string;
  delegatedAmount: string;
  validatorName: string;
}

export function useBTCStaking() {
  const dispatch = useDispatch<AppDispatch>();
  const {ensureWallet} = useStarknetWallet();
  const stakingState = useSelector((state: RootState) => state.starknet);
  const [availablePools, setAvailablePools] = useState<BTCPool[]>([]);
  const [isLoadingPools, setIsLoadingPools] = useState(false);

  const fetchPools = useCallback(async () => {
    setIsLoadingPools(true);
    try {
      const pools = await discoverBTCPools();
      setAvailablePools(pools);
    } catch (error: any) {
      console.error('[BTC Staking] Error fetching pools:', error);
    } finally {
      setIsLoadingPools(false);
    }
  }, []);

  const stake = useCallback(
    async (poolAddress: string, amount: string, tokenSymbol: string): Promise<{txHash: string}> => {
      dispatch(setStakingLoading(true));
      try {
        const wallet = await ensureWallet();
        if (!wallet) throw new Error('Failed to connect Starknet wallet');

        const tx = await stakeInPool(wallet, poolAddress, amount, tokenSymbol);
        await refreshPositions();
        const txHash = tx?.transaction_hash || tx?.hash || '';
        return {txHash};
      } catch (error: any) {
        dispatch(setStakingError(error.message));
        throw error;
      }
    },
    [ensureWallet, dispatch],
  );

  const refreshPositions = useCallback(async () => {
    dispatch(setStakingLoading(true));
    try {
      const wallet = await ensureWallet();
      if (!wallet) {
        dispatch(setStakingPositions([]));
        return;
      }

      const positions: StakingPosition[] = [];
      for (const pool of availablePools) {
        try {
          const pos = await getPoolPosition(wallet, pool.poolContract);
          if (pos && !pos.staked.isZero()) {
            positions.push({
              poolAddress: pool.poolContract,
              validatorName: pool.validatorName,
              tokenSymbol: pool.tokenSymbol,
              stakedAmount: pos.staked.toFormatted(),
              rewardsAmount: pos.rewards.toFormatted(),
              totalAmount: pos.total.toFormatted(),
              commissionPercent: pos.commissionPercent,
              unpoolingAmount: pos.unpooling.toFormatted(),
              unpoolTime: pos.unpoolTime ? pos.unpoolTime.toISOString() : null,
              status: pos.unpoolTime
                ? new Date() >= pos.unpoolTime
                  ? 'ready_to_withdraw'
                  : 'unstaking'
                : 'active',
            });
          }
        } catch {
          // Position doesn't exist for this pool
        }
      }
      dispatch(setStakingPositions(positions));
    } catch (error: any) {
      dispatch(setStakingError(error.message));
    }
  }, [ensureWallet, dispatch, availablePools]);

  const claimStakingRewards = useCallback(
    async (poolAddress: string) => {
      const wallet = await ensureWallet();
      if (!wallet) throw new Error('Failed to connect Starknet wallet');
      await claimRewards(wallet, poolAddress);
      await refreshPositions();
    },
    [ensureWallet, refreshPositions],
  );

  const initiateUnstake = useCallback(
    async (poolAddress: string, amount: string, tokenSymbol: string) => {
      const wallet = await ensureWallet();
      if (!wallet) throw new Error('Failed to connect Starknet wallet');
      await exitPoolIntent(wallet, poolAddress, amount, tokenSymbol);
      await refreshPositions();
    },
    [ensureWallet, refreshPositions],
  );

  const completeUnstake = useCallback(
    async (poolAddress: string) => {
      const wallet = await ensureWallet();
      if (!wallet) throw new Error('Failed to connect Starknet wallet');
      await exitPool(wallet, poolAddress);
      await refreshPositions();
    },
    [ensureWallet, refreshPositions],
  );

  return {
    availablePools,
    isLoadingPools,
    positions: stakingState.stakingPositions,
    isStakingLoading: stakingState.isStakingLoading,
    stakingError: stakingState.stakingError,
    fetchPools,
    stake,
    refreshPositions,
    claimStakingRewards,
    initiateUnstake,
    completeUnstake,
  };
}
