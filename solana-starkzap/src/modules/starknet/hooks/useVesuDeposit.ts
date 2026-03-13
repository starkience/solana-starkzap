import {useCallback, useState} from 'react';
import {useDispatch} from 'react-redux';
import {addTransaction, updateTransaction} from '@/shared/state/history/reducer';
import {useStarknetWallet} from './useStarknetWallet';
import {depositToVesu} from '../services/vesuService';
import {
  swapTokensOnStarknet,
  STARKNET_TOKENS,
  STARKNET_TOKEN_DECIMALS,
} from '../services/avnuSwapService';

export type VesuDepositStep =
  | 'idle'
  | 'swapping'
  | 'depositing'
  | 'complete'
  | 'error';

interface VesuDepositParams {
  amount: string;
  vesuPoolId: string;
  targetTokenAddress: string;
  targetTokenSymbol: string;
  targetTokenDecimals: number;
  requiresSwap: boolean;
}

export function useVesuDeposit() {
  const dispatch = useDispatch();
  const {ensureWallet} = useStarknetWallet();

  const [currentStep, setCurrentStep] = useState<VesuDepositStep>('idle');
  const [error, setError] = useState<string | null>(null);

  const deposit = useCallback(
    async (params: VesuDepositParams) => {
      const {
        amount,
        vesuPoolId,
        targetTokenAddress,
        targetTokenSymbol,
        targetTokenDecimals,
        requiresSwap,
      } = params;

      setError(null);
      const txId = `vesu_${Date.now()}`;

      dispatch(
        addTransaction({
          id: txId,
          type: 'deposit',
          token: targetTokenSymbol,
          amount,
          txHash: '',
          status: 'pending',
          timestamp: new Date().toISOString(),
          protocol: `Vesu (${targetTokenSymbol})`,
          subtitle: requiresSwap
            ? `Swap USDC → ${targetTokenSymbol} → Deposit in Vesu`
            : `Deposit ${targetTokenSymbol} in Vesu`,
          explorerUrl: undefined,
          starknetExplorerUrl: undefined,
        }),
      );

      try {
        const wallet = await ensureWallet();
        if (!wallet) {
          throw new Error('Failed to connect Starknet wallet');
        }

        if (requiresSwap) {
          // Swap USDC → target token via AVNU on Starknet
          setCurrentStep('swapping');
          dispatch(
            updateTransaction({
              id: txId,
              updates: {subtitle: `Swapping USDC → ${targetTokenSymbol} via AVNU...`},
            }),
          );

          const swapResult = await swapTokensOnStarknet(
            wallet,
            STARKNET_TOKENS.USDC,
            'USDC',
            STARKNET_TOKEN_DECIMALS.USDC,
            targetTokenAddress,
            targetTokenSymbol,
            targetTokenDecimals,
            amount,
          );

          console.log('[VesuDeposit] Swap confirmed:', swapResult.txHash);
        }

        // Deposit into Vesu pool
        setCurrentStep('depositing');
        dispatch(
          updateTransaction({
            id: txId,
            updates: {subtitle: `Depositing ${targetTokenSymbol} into Vesu pool...`},
          }),
        );

        const vesuResult = await depositToVesu(
          wallet,
          vesuPoolId,
          targetTokenAddress,
          targetTokenSymbol,
          targetTokenDecimals,
          amount,
        );

        dispatch(
          updateTransaction({
            id: txId,
            updates: {
              status: 'confirmed',
              subtitle: requiresSwap
                ? `${amount} USDC → ${targetTokenSymbol} deposited in Vesu`
                : `${amount} ${targetTokenSymbol} deposited in Vesu`,
              starknetExplorerUrl: vesuResult.explorerUrl,
            },
          }),
        );

        setCurrentStep('complete');
        return vesuResult;
      } catch (err: any) {
        console.error('[VesuDeposit] Error:', err);
        setError(err.message || 'Deposit failed');
        dispatch(
          updateTransaction({
            id: txId,
            updates: {status: 'failed'},
          }),
        );
        setCurrentStep('error');
        throw err;
      }
    },
    [dispatch, ensureWallet],
  );

  const reset = useCallback(() => {
    setCurrentStep('idle');
    setError(null);
  }, []);

  return {
    deposit,
    currentStep,
    error,
    reset,
  };
}
