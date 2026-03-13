import {SERVER_URL} from '@env';
import {createSlice, createAsyncThunk, PayloadAction} from '@reduxjs/toolkit';

const SERVER_BASE_URL = SERVER_URL || 'http://localhost:8080';

export interface StakingPosition {
  poolAddress: string;
  validatorName: string;
  tokenSymbol: string;
  stakedAmount: string;
  rewardsAmount: string;
  totalAmount: string;
  commissionPercent: number;
  unpoolingAmount: string;
  unpoolTime: string | null;
  status: 'active' | 'unstaking' | 'ready_to_withdraw';
}

export interface BridgeOperation {
  id: string;
  direction: 'solana_to_starknet' | 'starknet_to_solana';
  tokenSymbol: string;
  amount: string;
  status: 'pending' | 'bridging' | 'completed' | 'failed';
  txHash?: string;
  createdAt: string;
}

export interface StarknetState {
  walletAddress: string | null;
  walletId: string | null;
  publicKey: string | null;
  isWalletLoading: boolean;
  walletError: string | null;
  stakingPositions: StakingPosition[];
  isStakingLoading: boolean;
  stakingError: string | null;
  bridgeOperations: BridgeOperation[];
  isBridging: boolean;
  bridgeError: string | null;
}

const initialState: StarknetState = {
  walletAddress: null,
  walletId: null,
  publicKey: null,
  isWalletLoading: false,
  walletError: null,
  stakingPositions: [],
  isStakingLoading: false,
  stakingError: null,
  bridgeOperations: [],
  isBridging: false,
  bridgeError: null,
};

export const fetchOrCreateStarknetWallet = createAsyncThunk(
  'starknet/fetchOrCreateWallet',
  async (userId: string, thunkAPI) => {
    try {
      const response = await fetch(`${SERVER_BASE_URL}/api/starknet/wallet`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({userId}),
      });
      const data = await response.json();
      if (!data.success) {
        return thunkAPI.rejectWithValue(
          data.error || 'Failed to create Starknet wallet',
        );
      }
      return data.wallet as {id: string; address: string; publicKey: string};
    } catch (error: any) {
      return thunkAPI.rejectWithValue(
        error.message || 'Error creating Starknet wallet',
      );
    }
  },
);

const starknetSlice = createSlice({
  name: 'starknet',
  initialState,
  reducers: {
    setStakingPositions(state, action: PayloadAction<StakingPosition[]>) {
      state.stakingPositions = action.payload;
      state.isStakingLoading = false;
      state.stakingError = null;
    },
    setStakingLoading(state, action: PayloadAction<boolean>) {
      state.isStakingLoading = action.payload;
    },
    setStakingError(state, action: PayloadAction<string>) {
      state.stakingError = action.payload;
      state.isStakingLoading = false;
    },
    addBridgeOperation(state, action: PayloadAction<BridgeOperation>) {
      state.bridgeOperations.unshift(action.payload);
    },
    updateBridgeOperation(
      state,
      action: PayloadAction<{id: string; updates: Partial<BridgeOperation>}>,
    ) {
      const op = state.bridgeOperations.find(o => o.id === action.payload.id);
      if (op) {
        Object.assign(op, action.payload.updates);
      }
    },
    setBridging(state, action: PayloadAction<boolean>) {
      state.isBridging = action.payload;
    },
    setBridgeError(state, action: PayloadAction<string | null>) {
      state.bridgeError = action.payload;
    },
    clearStarknetState(state) {
      Object.assign(state, initialState);
    },
  },
  extraReducers: builder => {
    builder.addCase(fetchOrCreateStarknetWallet.pending, state => {
      state.isWalletLoading = true;
      state.walletError = null;
    });
    builder.addCase(fetchOrCreateStarknetWallet.fulfilled, (state, action) => {
      state.walletId = action.payload.id;
      state.walletAddress = action.payload.address;
      state.publicKey = action.payload.publicKey;
      state.isWalletLoading = false;
      state.walletError = null;
    });
    builder.addCase(fetchOrCreateStarknetWallet.rejected, (state, action) => {
      state.isWalletLoading = false;
      state.walletError = (action.payload as string) || 'Unknown error';
    });
  },
});

export const {
  setStakingPositions,
  setStakingLoading,
  setStakingError,
  addBridgeOperation,
  updateBridgeOperation,
  setBridging,
  setBridgeError,
  clearStarknetState,
} = starknetSlice.actions;

export default starknetSlice.reducer;
