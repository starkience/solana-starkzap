import {useCallback, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {PublicKey, Connection} from '@solana/web3.js';
import {AppDispatch, RootState} from '@/shared/state/store';
import {addTransaction, updateTransaction} from '@/shared/state/history/reducer';
import {useStarknetWallet} from '@/modules/starknet/hooks/useStarknetWallet';
import {TransactionService} from '@/modules/wallet-providers/services/transaction/transactionService';
import {
  buildDepositForBurnInstruction,
  pollAttestation,
  receiveMessageOnStarknet,
  usdcToBaseUnits,
  getSolscanLink,
  getVoyagerLink,
  getCCTPFees,
  type CCTPTransferResult,
} from '../services/cctpBridgeService';

export type CCTPStep =
  | 'idle'
  | 'burning'
  | 'waiting_attestation'
  | 'minting'
  | 'complete'
  | 'error';

export function useCCTPBridge() {
  const dispatch = useDispatch<AppDispatch>();
  const {ensureWallet} = useStarknetWallet();
  const solanaAddress = useSelector((state: RootState) => state.auth.address);

  const [currentStep, setCurrentStep] = useState<CCTPStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [transferResult, setTransferResult] = useState<CCTPTransferResult | null>(null);

  /**
   * Bridges USDC from Solana to Starknet via CCTP V2.
   *
   * @param amount    Human-readable USDC amount (e.g. "10.5")
   * @param wallet    The Solana wallet object (must support signAndSendTransaction)
   * @param connection Solana RPC connection
   */
  const bridgeUSDC = useCallback(
    async (
      amount: string,
      wallet: any,
      connection: Connection,
    ): Promise<CCTPTransferResult> => {
      setError(null);
      setTransferResult(null);

      if (!solanaAddress) throw new Error('Solana wallet not connected');

      // Ensure Starknet wallet is created/connected before starting
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

      console.log('[CCTP] Starknet wallet ready:', resolvedStarknetAddress.slice(0, 12));

      const txId = `cctp_${Date.now()}`;
      dispatch(
        addTransaction({
          id: txId,
          type: 'bridge',
          token: 'USDC',
          amount,
          txHash: '',
          status: 'pending',
          timestamp: new Date().toISOString(),
          protocol: 'CCTP V2',
          subtitle: `Bridging ${amount} USDC: Solana → Starknet`,
          explorerUrl: undefined,
          starknetExplorerUrl: undefined,
        }),
      );

      try {
        // Step 1: Build and send depositForBurn on Solana
        setCurrentStep('burning');
        dispatch(
          updateTransaction({
            id: txId,
            updates: {subtitle: 'Burning USDC on Solana...'},
          }),
        );

        const ownerPubkey = new PublicKey(solanaAddress);
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
          {
            connection,
            statusCallback: (status: string) => {
              dispatch(
                updateTransaction({
                  id: txId,
                  updates: {subtitle: status},
                }),
              );
            },
          },
        );

        console.log('[CCTP] Burn tx confirmed:', solanaSignature);
        dispatch(
          updateTransaction({
            id: txId,
            updates: {
              txHash: solanaSignature,
              explorerUrl: getSolscanLink(solanaSignature),
              subtitle: 'USDC burned, waiting for attestation...',
            },
          }),
        );

        // Step 2: Poll for attestation
        setCurrentStep('waiting_attestation');
        const attestation = await pollAttestation(
          solanaSignature,
          true,
          10 * 60 * 1000,
          5000,
          (status) => {
            dispatch(
              updateTransaction({
                id: txId,
                updates: {subtitle: status},
              }),
            );
          },
        );

        // Step 3: Mint on Starknet (wallet already connected from above)
        setCurrentStep('minting');
        dispatch(
          updateTransaction({
            id: txId,
            updates: {subtitle: 'Minting USDC on Starknet...'},
          }),
        );

        const starknetResult = await receiveMessageOnStarknet(
          starknetWallet,
          attestation,
        );

        // Complete
        const result: CCTPTransferResult = {
          solanaSignature,
          starknetTxHash: starknetResult.txHash,
          solscanUrl: getSolscanLink(solanaSignature),
          voyagerUrl: getVoyagerLink(starknetResult.txHash),
        };

        dispatch(
          updateTransaction({
            id: txId,
            updates: {
              status: 'confirmed',
              subtitle: `${amount} USDC bridged to Starknet`,
              starknetExplorerUrl: starknetResult.explorerUrl,
            },
          }),
        );

        setTransferResult(result);
        setCurrentStep('complete');
        return result;
      } catch (err: any) {
        console.error('[CCTP] Bridge error:', err);
        setError(err.message || 'CCTP bridge failed');
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
    [dispatch, solanaAddress, ensureWallet],
  );

  const reset = useCallback(() => {
    setCurrentStep('idle');
    setError(null);
    setTransferResult(null);
  }, []);

  const fetchFees = useCallback(async () => {
    return getCCTPFees();
  }, []);

  return {
    bridgeUSDC,
    currentStep,
    error,
    transferResult,
    reset,
    fetchFees,
  };
}
