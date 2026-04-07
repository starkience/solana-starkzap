import { useCallback, useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '@/shared/state/store';
import {
  setStakingPositions,
  setStakingLoading,
  setStakingError,
  addBridgeOperation,
  updateBridgeOperation,
  StakingPosition,
} from '@/shared/state/starknet/reducer';
import {
  getStakingPools,
  getMainnetValidators,
  stakeInPool,
  getPoolPosition,
} from '../services/starknetService';
import { swapPresetTokens } from '../services/avnuSwapService';
import { useStarknetWallet } from './useStarknetWallet';
import { useBridge } from '@/modules/bridge/hooks/useBridge';
import { useBaseWallet } from '@/modules/wallet-providers/hooks/useBaseWallet';
import { bridgeViaRhino } from '@/modules/bridge/services/rhinoBridgeService';
import { fetchStakingApy } from '../services/apyService';
import { getStarknetTokenBalance } from '../services/vesuService';
import { STARKNET_TOKENS, STARKNET_TOKEN_DECIMALS } from '../services/avnuSwapService';

export interface KarnotBTCPool {
  poolContract: string;
  tokenSymbol: string;
  delegatedAmount: string;
}

export interface KarnotBTCState {
  pools: KarnotBTCPool[];
  bestPool: KarnotBTCPool | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to interact with Karnot validator's BTC pools.
 * Auto-selects the best BTC pool (highest delegation / liquidity).
 * Handles the full flow: USDC → swap to BTC → stake in Karnot.
 */
export function useKarnotBTC() {
  const dispatch = useDispatch<AppDispatch>();
  const { ensureWallet } = useStarknetWallet();
  const { getEVMQuote, bridgeFromEVM } = useBridge();
  const { getProvider: getBaseProvider, getProviderForChain, address: baseAddress } = useBaseWallet();
  const starknetAddress = useSelector((state: any) => state.starknet?.walletAddress);

  const [pools, setPools] = useState<KarnotBTCPool[]>([]);
  const [bestPool, setBestPool] = useState<KarnotBTCPool | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [btcApy, setBtcApy] = useState<number>(0);

  const BTC_SYMBOLS = ['WBTC', 'solvBTC', 'LBTC', 'tBTC'];

  /**
   * Fetch Karnot's BTC pools and determine the best one.
   */
  const fetchKarnotPools = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const validators = getMainnetValidators();
      const karnot = validators.find(
        (v) => v.name.toLowerCase().includes('karnot')
      );

      if (!karnot) {
        throw new Error('Karnot validator not found');
      }

      const allPools = await getStakingPools(karnot.stakerAddress);
      const btcPools: KarnotBTCPool[] = [];

      for (const pool of allPools) {
        if (BTC_SYMBOLS.includes(pool.token.symbol)) {
          btcPools.push({
            poolContract: pool.poolContract.toString(),
            tokenSymbol: pool.token.symbol,
            delegatedAmount: pool.amount.toFormatted(),
          });
        }
      }

      setPools(btcPools);

      // Select best pool: prefer by delegation amount (proxy for liquidity/activity)
      if (btcPools.length > 0) {
        const best = btcPools.reduce((a, b) => {
          const amountA = parseFloat(a.delegatedAmount) || 0;
          const amountB = parseFloat(b.delegatedAmount) || 0;
          return amountB > amountA ? b : a;
        });
        setBestPool(best);
      }

      console.log(`[KarnotBTC] Found ${btcPools.length} BTC pools on Karnot`);
      return btcPools;
    } catch (err: any) {
      const msg = err.message || 'Failed to fetch Karnot pools';
      setError(msg);
      console.error('[KarnotBTC] Error:', msg);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Fetch live BTC staking APY from DeFiLlama.
   */
  const fetchBtcApy = useCallback(async () => {
    try {
      const apyData = await fetchStakingApy();
      setBtcApy(apyData.btcApy);
    } catch {
      setBtcApy(2.07); // Fallback to last known rate
    }
  }, []);

  /**
   * Full flow: swap USDC → best BTC type → stake in Karnot.
   * User only needs to provide USDC amount.
   */
  const earnBTC = useCallback(
    async (usdcAmount: string): Promise<{
      swapTxHash: string;
      stakeTxHash: string;
      poolAddress: string;
      tokenSymbol: string;
    }> => {
      if (!bestPool) {
        throw new Error('No BTC pool available. Please refresh pools first.');
      }

      dispatch(setStakingLoading(true));
      try {
        const wallet = await ensureWallet();
        if (!wallet) throw new Error('Failed to connect Starknet wallet');

        console.log(`[KarnotBTC] Starting BTC earn flow: ${usdcAmount} USDC → ${bestPool.tokenSymbol} → Karnot stake`);

        // Step 1: Swap USDC → BTC type via AVNU
        console.log(`[KarnotBTC] Step 1: Swapping ${usdcAmount} USDC → ${bestPool.tokenSymbol}`);
        const swapResult = await swapPresetTokens(
          wallet,
          'USDC',
          bestPool.tokenSymbol,
          usdcAmount,
        );
        console.log(`[KarnotBTC] Swap complete: ${swapResult.txHash}`);

        // Step 2: Get the BTC balance we just received
        // We need to stake the amount we got from the swap
        // For simplicity, query position or use a reasonable estimate
        // The swap gives us roughly usdcAmount / BTC_price in BTC
        // We'll let Starkzap handle the exact amount by staking "max"

        // Step 3: Stake in Karnot pool
        // We need to figure out how much BTC we got from the swap
        // For now, we'll read the token balance and stake it all
        console.log(`[KarnotBTC] Step 2: Staking ${bestPool.tokenSymbol} in Karnot pool ${bestPool.poolContract}`);

        // Get BTC token balance after swap
        const presets = await import('../services/avnuSwapService').then(m => m.getPresetToken(bestPool.tokenSymbol));
        const balance = await wallet.getBalance(presets);
        const btcAmount = balance.toFormatted();

        console.log(`[KarnotBTC] BTC balance after swap: ${btcAmount} ${bestPool.tokenSymbol}`);

        if (parseFloat(btcAmount) <= 0) {
          throw new Error('Swap completed but no BTC balance found');
        }

        const stakeTx = await stakeInPool(
          wallet,
          bestPool.poolContract,
          btcAmount,
          bestPool.tokenSymbol,
        );
        const stakeTxHash = stakeTx?.transaction_hash || stakeTx?.hash || '';
        console.log(`[KarnotBTC] Stake complete: ${stakeTxHash}`);

        // Refresh positions
        await refreshPositions();

        return {
          swapTxHash: swapResult.txHash,
          stakeTxHash,
          poolAddress: bestPool.poolContract,
          tokenSymbol: bestPool.tokenSymbol,
        };
      } catch (err: any) {
        dispatch(setStakingError(err.message));
        throw err;
      }
    },
    [bestPool, ensureWallet, dispatch],
  );

  /**
   * Full flow: Bridge USDC via Layerswap (Arbitrum→Starknet) → swap to BTC → stake in Karnot.
   * Uses Layerswap for fast bridging (~24s avg, ~$0.05 fee).
   */
  const earnBTCFromEVM = useCallback(
    async (
      usdcAmount: string,
      onStatus?: (status: string) => void,
      _network: string = 'arbitrum',
    ): Promise<{
      bridgeTxHash: string;
      swapTxHash: string;
      stakeTxHash: string;
      poolAddress: string;
      tokenSymbol: string;
    }> => {
      if (!bestPool) {
        throw new Error('No BTC pool available. Please refresh pools first.');
      }
      if (!baseAddress) {
        throw new Error('EVM wallet not initialized. Please try again.');
      }
      if (!starknetAddress) {
        throw new Error('Starknet wallet not initialized. Please try again.');
      }

      const rhinoApiKey = 'PUBLIC-dfd164e7-e35a-4a8e-84c3-03744a44a29d';

      dispatch(setStakingLoading(true));
      try {
        const wallet = await ensureWallet();
        if (!wallet) throw new Error('Failed to connect Starknet wallet');

        console.log(`[KarnotBTC] Starting Arbitrum→BTC flow via Rhino.fi: ${usdcAmount} USDC`);

        // Track in Redux for History screen
        const opId = `rhino-${Date.now()}`;
        dispatch(addBridgeOperation({
          id: opId,
          direction: 'arbitrum_to_starknet',
          tokenSymbol: 'USDC',
          amount: usdcAmount,
          status: 'bridging',
          createdAt: new Date().toISOString(),
        }));

        // Step 1: Switch to Arbitrum and bridge via Rhino.fi
        onStatus?.('Bridging USDC from Arbitrum to Starknet...');
        const evmProvider = await getProviderForChain('arbitrum');

        const bridgeResult = await bridgeViaRhino(
          evmProvider,
          usdcAmount,
          baseAddress,
          starknetAddress,
          rhinoApiKey,
          onStatus,
        );
        console.log(`[KarnotBTC] Rhino.fi bridge complete: ${bridgeResult.txHash}`);

        dispatch(updateBridgeOperation({
          id: opId,
          updates: { txHash: bridgeResult.txHash, status: 'completed' },
        }));

        // Step 2: Swap USDC → BTC on Starknet (use actual received amount after bridge fees)
        onStatus?.('Swapping USDC to BTC...');
        const receivedUsdc = await getStarknetTokenBalance(
          STARKNET_TOKENS.USDC,
          starknetAddress,
          STARKNET_TOKEN_DECIMALS.USDC,
        );
        console.log(`[KarnotBTC] USDC balance on Starknet after bridge: ${receivedUsdc}`);

        if (parseFloat(receivedUsdc) <= 0) {
          throw new Error('Bridge completed but no USDC found on Starknet. It may take a moment to arrive.');
        }

        const swapResult = await swapPresetTokens(
          wallet,
          'USDC',
          bestPool.tokenSymbol,
          receivedUsdc,
        );
        console.log(`[KarnotBTC] Swap complete: ${swapResult.txHash}`);

        // Step 3: Stake BTC in Karnot
        onStatus?.('Staking BTC in Karnot...');
        const btcTokenAddress = (STARKNET_TOKENS as any)[bestPool.tokenSymbol] || STARKNET_TOKENS.WBTC;
        const btcDecimals = (STARKNET_TOKEN_DECIMALS as any)[bestPool.tokenSymbol] || 8;
        const btcAmount = await getStarknetTokenBalance(
          btcTokenAddress,
          starknetAddress,
          btcDecimals,
        );

        if (parseFloat(btcAmount) <= 0) {
          throw new Error('Swap completed but no BTC balance found');
        }

        const stakeTx = await stakeInPool(
          wallet,
          bestPool.poolContract,
          btcAmount,
          bestPool.tokenSymbol,
        );
        const stakeTxHash = stakeTx?.transaction_hash || stakeTx?.hash || '';
        console.log(`[KarnotBTC] Stake complete: ${stakeTxHash}`);

        onStatus?.('Done!');

        // Update Redux with all tx hashes for History screen
        dispatch(updateBridgeOperation({
          id: opId,
          updates: {
            status: 'completed',
            txHash: `${bridgeResult.txHash}|${swapResult.txHash}|${stakeTxHash}`,
          },
        }));

        await refreshPositions();

        return {
          bridgeTxHash: bridgeResult.txHash,
          swapTxHash: swapResult.txHash,
          stakeTxHash,
          poolAddress: bestPool.poolContract,
          tokenSymbol: bestPool.tokenSymbol,
        };
      } catch (err: any) {
        dispatch(setStakingError(err.message));
        throw err;
      }
    },
    [bestPool, baseAddress, starknetAddress, ensureWallet, getProviderForChain, dispatch],
  );

  /** Backwards-compatible alias */
  const earnBTCFromBase = useCallback(
    (usdcAmount: string, onStatus?: (status: string) => void) =>
      earnBTCFromEVM(usdcAmount, onStatus, 'arbitrum'),
    [earnBTCFromEVM],
  );

  /**
   * Refresh BTC staking positions on Karnot.
   */
  const refreshPositions = useCallback(async () => {
    dispatch(setStakingLoading(true));
    try {
      const wallet = await ensureWallet();
      if (!wallet) {
        dispatch(setStakingPositions([]));
        return;
      }

      const positions: StakingPosition[] = [];
      for (const pool of pools) {
        try {
          const pos = await getPoolPosition(wallet, pool.poolContract);
          if (pos && !pos.staked.isZero()) {
            positions.push({
              poolAddress: pool.poolContract,
              validatorName: 'Karnot',
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
    } catch (err: any) {
      dispatch(setStakingError(err.message));
    }
  }, [ensureWallet, dispatch, pools]);

  return {
    pools,
    bestPool,
    btcApy,
    isLoading,
    error,
    baseAddress,
    fetchKarnotPools,
    fetchBtcApy,
    earnBTC,
    earnBTCFromBase,
    earnBTCFromEVM,
    refreshPositions,
  };
}
