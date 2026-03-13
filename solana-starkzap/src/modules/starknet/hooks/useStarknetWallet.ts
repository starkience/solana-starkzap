import {useCallback, useEffect, useRef} from 'react';
import {useSelector, useDispatch} from 'react-redux';
import {RootState, AppDispatch} from '@/shared/state/store';
import {fetchOrCreateStarknetWallet, clearStarknetState} from '@/shared/state/starknet/reducer';
import {connectStarknetWallet} from '../services/starknetService';

export function useStarknetWallet() {
  const dispatch = useDispatch<AppDispatch>();
  const solanaAddress = useSelector((state: RootState) => state.auth.address);
  const isLoggedIn = useSelector((state: RootState) => state.auth.isLoggedIn);
  const starknetState = useSelector((state: RootState) => state.starknet);

  const walletRef = useRef<any>(null);

  const ensureWallet = useCallback(async () => {
    console.log('[StarknetWallet] ensureWallet called', {
      solanaAddress: solanaAddress?.slice(0, 8),
      isLoggedIn,
      walletId: starknetState.walletId?.slice(0, 8),
      publicKey: starknetState.publicKey?.slice(0, 8),
      hasWalletRef: !!walletRef.current,
    });

    if (!solanaAddress || !isLoggedIn) {
      console.warn('[StarknetWallet] Not logged in or no Solana address');
      return null;
    }

    if (starknetState.walletId && starknetState.publicKey) {
      if (!walletRef.current) {
        console.log('[StarknetWallet] Connecting with existing walletId...');
        try {
          walletRef.current = await connectStarknetWallet(
            starknetState.walletId,
            starknetState.publicKey,
          );
          console.log('[StarknetWallet] Connected, address:', walletRef.current?.address);
        } catch (err: any) {
          console.error('[StarknetWallet] connectStarknetWallet failed:', err.message);
          return null;
        }
      }
      return walletRef.current;
    }

    console.log('[StarknetWallet] No walletId in Redux, fetching/creating via server...');
    const result = await dispatch(fetchOrCreateStarknetWallet(solanaAddress));

    if (fetchOrCreateStarknetWallet.fulfilled.match(result)) {
      const {id, publicKey} = result.payload;
      console.log('[StarknetWallet] Server returned wallet:', id?.slice(0, 8));
      try {
        walletRef.current = await connectStarknetWallet(id, publicKey);
        console.log('[StarknetWallet] Connected new wallet, address:', walletRef.current?.address);
        return walletRef.current;
      } catch (err: any) {
        console.error('[StarknetWallet] connectStarknetWallet (new) failed:', err.message);
        return null;
      }
    }

    console.error('[StarknetWallet] fetchOrCreateStarknetWallet rejected:', result.payload || result.error);
    return null;
  }, [dispatch, solanaAddress, isLoggedIn, starknetState.walletId, starknetState.publicKey]);

  useEffect(() => {
    if (!isLoggedIn) {
      walletRef.current = null;
      dispatch(clearStarknetState());
    }
  }, [isLoggedIn, dispatch]);

  return {
    starknetAddress: starknetState.walletAddress,
    walletId: starknetState.walletId,
    isLoading: starknetState.isWalletLoading,
    error: starknetState.walletError,
    ensureWallet,
    connectedWallet: walletRef.current,
  };
}
