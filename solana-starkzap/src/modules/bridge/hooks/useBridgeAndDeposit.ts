/**
 * Combined hook: CCTP bridge USDC (Solana → Starknet) then deposit into Vesu.
 *
 * Steps:
 *   1. depositForBurn on Solana (user signs 1 Solana tx)
 *   2. Poll Iris API for attestation (~1-3 min)
 *   3. receive_message on Starknet (gasless via paymaster)
 *   4. Deposit USDC into Vesu pool (gasless via Starkzap)
 */

import {useCallback, useState, useRef} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {PublicKey, Connection} from '@solana/web3.js';
import {AppDispatch, RootState} from '@/shared/state/store';
import {
  addTransaction,
  updateTransaction,
  LifecycleStep,
} from '@/shared/state/history/reducer';
import {useStarknetWallet} from '@/modules/starknet/hooks/useStarknetWallet';
import {TransactionService} from '@/modules/wallet-providers/services/transaction/transactionService';
import {depositToVesu, getStarknetTokenBalance} from '@/modules/starknet/services/vesuService';
import {
  swapTokensOnStarknet,
  STARKNET_TOKENS,
  STARKNET_TOKEN_DECIMALS,
} from '@/modules/starknet/services/avnuSwapService';
import {
  buildDepositForBurnInstruction,
  pollAttestation,
  receiveMessageOnStarknet,
  usdcToBaseUnits,
  getSolscanLink,
  getVoyagerLink,
} from '../services/cctpBridgeService';

export type BridgeDepositStep =
  | 'idle'
  | 'burning'
  | 'waiting_attestation'
  | 'minting'
  | 'swapping'
  | 'depositing'
  | 'complete'
  | 'error';

export interface BridgeAndDepositParams {
  /** Human-readable USDC amount (e.g. "10.5") */
  amount: string;
  /** Vesu pool contract address on Starknet */
  vesuPoolId: string;
  /** Target token address on Starknet for Vesu deposit */
  targetTokenAddress: string;
  /** Target token symbol (e.g. "USDC", "wstETH") */
  targetTokenSymbol: string;
  /** Target token decimals */
  targetTokenDecimals: number;
  /** Whether USDC needs to be swapped to the target token before Vesu deposit */
  requiresSwap: boolean;
  /** Solana wallet for signing */
  wallet: any;
  /** Solana RPC connection */
  connection: Connection;
}

function buildInitialLifecycleSteps(requiresSwap: boolean, targetTokenSymbol: string): LifecycleStep[] {
  const steps: LifecycleStep[] = [
    {
      id: 'deposit_confirmed',
      title: 'Deposit confirmed',
      subtitle: 'Your deposit has been received on Solana.',
      status: 'pending',
    },
    {
      id: 'bridging',
      title: 'Bridging to Starknet',
      subtitle: 'Your funds are being bridged to Starknet.\nThis may take a short moment.',
      status: 'pending',
    },
  ];

  if (requiresSwap) {
    steps.push({
      id: 'swapping',
      title: 'Preparing your yield position',
      subtitle: `Swapping your funds into ${targetTokenSymbol} via AVNU.`,
      status: 'pending',
    });
  }

  steps.push({
    id: 'deposit_complete',
    title: 'Deposit complete',
    subtitle: 'Your funds are now earning yield on Starknet via Vesu.',
    status: 'pending',
  });

  return steps;
}

export function useBridgeAndDeposit() {
  const dispatch = useDispatch<AppDispatch>();
  const {ensureWallet} = useStarknetWallet();
  const solanaAddress = useSelector((state: RootState) => state.auth.address);

  const [currentStep, setCurrentStep] = useState<BridgeDepositStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lifecycleSteps, setLifecycleSteps] = useState<LifecycleStep[]>([]);

  const stepsRef = useRef<LifecycleStep[]>([]);

  const updateStep = useCallback(
    (txId: string, stepId: string, updates: Partial<LifecycleStep>) => {
      stepsRef.current = stepsRef.current.map(s =>
        s.id === stepId ? {...s, ...updates} : s,
      );
      setLifecycleSteps([...stepsRef.current]);
      dispatch(
        updateTransaction({
          id: txId,
          updates: {lifecycleSteps: [...stepsRef.current]},
        }),
      );
    },
    [dispatch],
  );

  const bridgeAndDeposit = useCallback(
    async (params: BridgeAndDepositParams) => {
      const {
        amount,
        vesuPoolId,
        targetTokenAddress,
        targetTokenSymbol,
        targetTokenDecimals,
        requiresSwap,
        wallet,
        connection,
      } = params;

      setError(null);

      if (!solanaAddress) throw new Error('Solana wallet not connected');

      const starknetWallet = await ensureWallet();
      if (!starknetWallet) {
        throw new Error('Failed to initialize Starknet wallet');
      }

      const resolvedStarknetAddress: string =
        starknetWallet.address?.toString() ||
        starknetWallet.getAddress?.()?.toString() ||
        '';

      if (!resolvedStarknetAddress) {
        throw new Error('Could not resolve Starknet wallet address');
      }

      console.log('[BridgeDeposit] Starknet wallet ready:', resolvedStarknetAddress.slice(0, 12));

      const txId = `bridge_deposit_${Date.now()}`;
      const initialSteps = buildInitialLifecycleSteps(requiresSwap, targetTokenSymbol);
      stepsRef.current = initialSteps;
      setLifecycleSteps([...initialSteps]);

      const subtitle = requiresSwap
        ? `Bridge USDC → Swap to ${targetTokenSymbol} → Deposit in Vesu`
        : `Bridge USDC → Deposit in Vesu`;

      dispatch(
        addTransaction({
          id: txId,
          type: 'deposit',
          token: targetTokenSymbol,
          amount,
          txHash: '',
          status: 'pending',
          timestamp: new Date().toISOString(),
          protocol: `Vesu (${targetTokenSymbol}) via CCTP`,
          subtitle,
          explorerUrl: undefined,
          starknetExplorerUrl: undefined,
          lifecycleSteps: initialSteps,
          starknetAddress: resolvedStarknetAddress,
        }),
      );

      try {
        // ── Step 1: Burn USDC on Solana ──
        setCurrentStep('burning');
        updateStep(txId, 'deposit_confirmed', {status: 'active', subtitle: 'Confirming your deposit on Solana...'});

        const ownerPubkey = new PublicKey(solanaAddress);

        const solBalance = await connection.getBalance(ownerPubkey);
        const MIN_SOL_FOR_CCTP = 5_000_000;
        if (solBalance < MIN_SOL_FOR_CCTP) {
          throw new Error(
            `Insufficient SOL for bridging fees. You need at least ~0.005 SOL but have ${(solBalance / 1e9).toFixed(6)} SOL. Please add more SOL to your wallet.`,
          );
        }

        const amountBaseUnits = usdcToBaseUnits(amount);

        const {instruction, messageSentKeypair} =
          await buildDepositForBurnInstruction({
            ownerPubkey,
            amount: amountBaseUnits,
            starknetRecipient: resolvedStarknetAddress,
          });

        const solanaSignature = await TransactionService.signAndSendTransaction(
          {
            type: 'instructions',
            instructions: [instruction],
            feePayer: ownerPubkey,
            signers: [messageSentKeypair],
          },
          wallet,
          {connection},
        );

        console.log('[BridgeDeposit] Burn confirmed:', solanaSignature);
        const solscanUrl = getSolscanLink(solanaSignature);

        updateStep(txId, 'deposit_confirmed', {
          status: 'complete',
          subtitle: 'Your deposit has been received on Solana.',
          explorerUrl: solscanUrl,
          explorerLabel: 'View on Solscan',
        });

        dispatch(
          updateTransaction({
            id: txId,
            updates: {
              txHash: solanaSignature,
              explorerUrl: solscanUrl,
              subtitle: 'Bridging to Starknet...',
            },
          }),
        );

        // ── Step 2: Bridge (attestation + mint) ──
        setCurrentStep('waiting_attestation');
        updateStep(txId, 'bridging', {status: 'active', subtitle: 'Waiting for Circle attestation...'});

        const attestation = await pollAttestation(
          solanaSignature,
          true,
          10 * 60 * 1000,
          5000,
          (status) => {
            updateStep(txId, 'bridging', {subtitle: status});
          },
        );

        setCurrentStep('minting');
        updateStep(txId, 'bridging', {subtitle: 'Minting USDC on Starknet...'});

        const mintResult = await receiveMessageOnStarknet(
          starknetWallet,
          attestation,
        );

        console.log('[BridgeDeposit] USDC minted on Starknet:', mintResult.txHash);
        const mintVoyagerUrl = getVoyagerLink(mintResult.txHash);

        updateStep(txId, 'bridging', {
          status: 'complete',
          subtitle: 'Your funds have arrived on Starknet.',
          explorerUrl: mintVoyagerUrl,
          explorerLabel: 'View on Voyager',
        });

        // ── Step 3 (optional): Swap USDC → target token ──
        let depositAmount = amount;
        if (requiresSwap) {
          setCurrentStep('swapping');
          updateStep(txId, 'swapping', {status: 'active', subtitle: `Swapping USDC → ${targetTokenSymbol} via AVNU...`});

          await swapTokensOnStarknet(
            starknetWallet,
            STARKNET_TOKENS.USDC,
            'USDC',
            STARKNET_TOKEN_DECIMALS.USDC,
            targetTokenAddress,
            targetTokenSymbol,
            targetTokenDecimals,
            amount,
          );

          console.log('[BridgeDeposit] Swap complete');

          const actualBalance = await getStarknetTokenBalance(
            targetTokenAddress,
            resolvedStarknetAddress,
            targetTokenDecimals,
          );
          console.log(`[BridgeDeposit] Actual ${targetTokenSymbol} balance after swap: ${actualBalance}`);

          if (parseFloat(actualBalance) > 0) {
            depositAmount = actualBalance;
          }

          updateStep(txId, 'swapping', {
            status: 'complete',
            subtitle: `Swapped to ${depositAmount} ${targetTokenSymbol} successfully.`,
          });
        }

        // ── Step 4: Deposit into Vesu ──
        setCurrentStep('depositing');
        updateStep(txId, 'deposit_complete', {status: 'active', subtitle: `Depositing ${depositAmount} ${targetTokenSymbol} into Vesu...`});

        const vesuResult = await depositToVesu(
          starknetWallet,
          vesuPoolId,
          targetTokenAddress,
          targetTokenSymbol,
          targetTokenDecimals,
          depositAmount,
        );

        console.log('[BridgeDeposit] Vesu deposit confirmed:', vesuResult.txHash);
        const vesuVoyagerUrl = getVoyagerLink(vesuResult.txHash);

        updateStep(txId, 'deposit_complete', {
          status: 'complete',
          subtitle: 'Your funds are now earning yield on Starknet via Vesu.',
          explorerUrl: vesuVoyagerUrl,
          explorerLabel: 'View on Voyager',
        });

        dispatch(
          updateTransaction({
            id: txId,
            updates: {
              status: 'confirmed',
              amount: depositAmount,
              subtitle: requiresSwap
                ? `${amount} USDC → ${depositAmount} ${targetTokenSymbol} deposited into Vesu`
                : `${amount} USDC bridged & deposited into Vesu`,
              starknetExplorerUrl: vesuVoyagerUrl,
            },
          }),
        );

        setCurrentStep('complete');
        return {
          solanaSignature,
          starknetMintTxHash: mintResult.txHash,
          vesuDepositTxHash: vesuResult.txHash,
          solscanUrl,
          voyagerUrl: vesuVoyagerUrl,
        };
      } catch (err: any) {
        console.error('[BridgeDeposit] Error:', err);
        setError(err.message || 'Bridge & deposit failed');

        const activeStep = stepsRef.current.find(s => s.status === 'active');
        if (activeStep) {
          updateStep(txId, activeStep.id, {
            status: 'error',
            subtitle: err.message || 'An error occurred',
          });
        }

        dispatch(
          updateTransaction({
            id: txId,
            updates: {status: 'failed', subtitle: err.message},
          }),
        );
        setCurrentStep('error');
        throw err;
      }
    },
    [dispatch, solanaAddress, ensureWallet, updateStep],
  );

  const reset = useCallback(() => {
    setCurrentStep('idle');
    setError(null);
    setLifecycleSteps([]);
    stepsRef.current = [];
  }, []);

  return {
    bridgeAndDeposit,
    currentStep,
    error,
    lifecycleSteps,
    reset,
  };
}
