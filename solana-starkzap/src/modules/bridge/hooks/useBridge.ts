import {useCallback, useRef, useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {LAYERZERO_API_KEY} from '@env';
import {AppDispatch, RootState} from '@/shared/state/store';
import {
  addBridgeOperation,
  updateBridgeOperation,
  setBridging,
  setBridgeError,
  BridgeOperation,
} from '@/shared/state/starknet/reducer';
import {
  getBridgeQuote,
  bridgeSolanaToStarknet,
  bridgeStarknetToSolana,
  bridgeEVMToStarknet,
  checkBridgeStatus,
  isEVMSource,
  buildEVMBridgeSteps,
  getSupportedChainsForToken,
  BridgeDirection,
  BridgeQuote,
} from '../services/bridgeService';

const LZ_API_KEY = LAYERZERO_API_KEY || '';

export function useBridge() {
  const dispatch = useDispatch<AppDispatch>();
  const starknetAddress = useSelector(
    (state: RootState) => state.starknet.walletAddress,
  );
  const solanaAddress = useSelector(
    (state: RootState) => state.auth.address,
  );
  const bridgeOps = useSelector(
    (state: RootState) => state.starknet.bridgeOperations,
  );
  const isBridging = useSelector(
    (state: RootState) => state.starknet.isBridging,
  );
  const bridgeError = useSelector(
    (state: RootState) => state.starknet.bridgeError,
  );

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getQuote = useCallback(
    async (direction: BridgeDirection, amount: string, tokenSymbol: string = 'USDC'): Promise<BridgeQuote> => {
      const srcWallet = direction === 'solana_to_starknet' ? solanaAddress : starknetAddress;
      const dstWallet = direction === 'solana_to_starknet' ? starknetAddress : solanaAddress;

      if (!srcWallet || !dstWallet) {
        throw new Error('Both Solana and Starknet wallets must be initialized');
      }

      return getBridgeQuote(direction, amount, srcWallet, dstWallet, LZ_API_KEY, tokenSymbol);
    },
    [solanaAddress, starknetAddress],
  );

  const bridgeToStarknet = useCallback(
    async (quote: BridgeQuote, solanaWalletProvider: any) => {
      if (!starknetAddress) {
        throw new Error('Starknet wallet not initialized');
      }

      dispatch(setBridging(true));
      dispatch(setBridgeError(null));

      const op: BridgeOperation = {
        id: quote.quoteId,
        direction: 'solana_to_starknet',
        tokenSymbol: quote.sourceToken,
        amount: quote.amount,
        status: 'bridging',
        createdAt: new Date().toISOString(),
      };
      dispatch(addBridgeOperation(op));

      try {
        const result = await bridgeSolanaToStarknet(
          quote.quoteId,
          solanaWalletProvider,
          LZ_API_KEY,
        );
        dispatch(
          updateBridgeOperation({
            id: quote.quoteId,
            updates: {txHash: result.txHash, status: 'pending'},
          }),
        );
        startPolling(quote.quoteId, result.txHash);
        return result;
      } catch (error: any) {
        dispatch(
          updateBridgeOperation({id: quote.quoteId, updates: {status: 'failed'}}),
        );
        dispatch(setBridgeError(error.message));
        dispatch(setBridging(false));
        throw error;
      }
    },
    [starknetAddress, dispatch],
  );

  const bridgeToSolana = useCallback(
    async (quote: BridgeQuote, starknetWallet: any) => {
      if (!solanaAddress) {
        throw new Error('Solana wallet not connected');
      }

      dispatch(setBridging(true));
      dispatch(setBridgeError(null));

      const op: BridgeOperation = {
        id: quote.quoteId,
        direction: 'starknet_to_solana',
        tokenSymbol: quote.sourceToken,
        amount: quote.amount,
        status: 'bridging',
        createdAt: new Date().toISOString(),
      };
      dispatch(addBridgeOperation(op));

      try {
        const result = await bridgeStarknetToSolana(
          quote.quoteId,
          starknetWallet,
          LZ_API_KEY,
        );
        dispatch(
          updateBridgeOperation({
            id: quote.quoteId,
            updates: {txHash: result.txHash, status: 'pending'},
          }),
        );
        startPolling(quote.quoteId, result.txHash);
        return result;
      } catch (error: any) {
        dispatch(
          updateBridgeOperation({id: quote.quoteId, updates: {status: 'failed'}}),
        );
        dispatch(setBridgeError(error.message));
        dispatch(setBridging(false));
        throw error;
      }
    },
    [solanaAddress, dispatch],
  );

  const startPolling = useCallback(
    (quoteId: string, txHash: string) => {
      const interval = setInterval(async () => {
        try {
          const result = await checkBridgeStatus(quoteId, txHash, LZ_API_KEY);
          if (result.status === 'completed' || result.status === 'failed') {
            dispatch(
              updateBridgeOperation({id: quoteId, updates: {status: result.status}}),
            );
            dispatch(setBridging(false));
            clearInterval(interval);
          }
        } catch {
          // Keep polling on error
        }
      }, 4000);
      pollIntervalRef.current = interval;
    },
    [dispatch],
  );

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  /**
   * Bridge USDC from an EVM chain (e.g. Base) to Starknet using LayerZero.
   * Signs the EVM transaction with the provided Privy EVM provider.
   */
  const bridgeFromEVM = useCallback(
    async (quote: BridgeQuote, evmProvider: any, direction: BridgeDirection = 'base_to_starknet') => {
      if (!starknetAddress) {
        throw new Error('Starknet wallet not initialized');
      }

      dispatch(setBridging(true));
      dispatch(setBridgeError(null));

      const op: BridgeOperation = {
        id: quote.quoteId,
        direction,
        tokenSymbol: quote.sourceToken,
        amount: quote.amount,
        status: 'bridging',
        createdAt: new Date().toISOString(),
      };
      dispatch(addBridgeOperation(op));

      try {
        const result = await bridgeEVMToStarknet(
          quote.quoteId,
          evmProvider,
          LZ_API_KEY,
        );
        dispatch(
          updateBridgeOperation({
            id: quote.quoteId,
            updates: { txHash: result.txHash, status: 'pending' },
          }),
        );
        startPolling(quote.quoteId, result.txHash);
        return result;
      } catch (error: any) {
        dispatch(
          updateBridgeOperation({ id: quote.quoteId, updates: { status: 'failed' } }),
        );
        dispatch(setBridgeError(error.message));
        dispatch(setBridging(false));
        throw error;
      }
    },
    [starknetAddress, dispatch],
  );

  /**
   * Get a bridge quote for EVM→Starknet transfers.
   * srcWalletAddress is the EVM wallet address.
   */
  const getEVMQuote = useCallback(
    async (
      direction: BridgeDirection,
      amount: string,
      evmWalletAddress: string,
      tokenSymbol: string = 'USDC',
    ): Promise<BridgeQuote> => {
      if (!starknetAddress) {
        throw new Error('Starknet wallet not initialized');
      }

      return getBridgeQuote(
        direction,
        amount,
        evmWalletAddress,
        starknetAddress,
        LZ_API_KEY,
        tokenSymbol,
      );
    },
    [starknetAddress],
  );

  /**
   * Get the EVM transaction steps for a quote.
   * Returns transaction data that needs to be signed by an external EVM wallet.
   */
  const getEVMBridgeSteps = useCallback(
    async (quoteId: string) => {
      return buildEVMBridgeSteps(quoteId, LZ_API_KEY);
    },
    [],
  );

  /**
   * Check which chains support a given token via LayerZero.
   */
  const checkSupportedChains = useCallback(
    async (tokenSymbol: string = 'USDC') => {
      return getSupportedChainsForToken(tokenSymbol);
    },
    [],
  );

  return {
    getQuote,
    getEVMQuote,
    getEVMBridgeSteps,
    bridgeFromEVM,
    checkSupportedChains,
    bridgeToStarknet,
    bridgeToSolana,
    bridgeOperations: bridgeOps,
    isBridging,
    bridgeError,
  };
}
