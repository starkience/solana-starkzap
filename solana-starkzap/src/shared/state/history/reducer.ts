import {createSlice, PayloadAction} from '@reduxjs/toolkit';

export type LifecycleStepStatus = 'pending' | 'active' | 'complete' | 'error';

export interface LifecycleStep {
  id: string;
  title: string;
  subtitle: string;
  status: LifecycleStepStatus;
  explorerUrl?: string;
  explorerLabel?: string;
}

export interface HistoryTransaction {
  id: string;
  type: 'stake' | 'unstake' | 'deposit' | 'withdraw' | 'claim' | 'bridge' | 'swap';
  token: string;
  amount: string;
  txHash: string;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: string;
  protocol?: string;
  explorerUrl?: string;
  /** Starknet Voyager link for cross-chain operations */
  starknetExplorerUrl?: string;
  /** Additional context (e.g. "Bridge → Stake on Starknet") */
  subtitle?: string;
  /** Multi-step lifecycle for cross-chain deposits */
  lifecycleSteps?: LifecycleStep[];
  /** Starknet wallet address used for this transaction */
  starknetAddress?: string;
}

interface HistoryState {
  transactions: HistoryTransaction[];
}

const initialState: HistoryState = {
  transactions: [],
};

const historySlice = createSlice({
  name: 'history',
  initialState,
  reducers: {
    addTransaction(state, action: PayloadAction<HistoryTransaction>) {
      state.transactions.unshift(action.payload);
    },
    updateTransaction(
      state,
      action: PayloadAction<{id: string; updates: Partial<HistoryTransaction>}>,
    ) {
      const tx = state.transactions.find(t => t.id === action.payload.id);
      if (tx) {
        Object.assign(tx, action.payload.updates);
      }
    },
    clearHistory(state) {
      state.transactions = [];
    },
  },
});

export const {addTransaction, updateTransaction, clearHistory} =
  historySlice.actions;
export default historySlice.reducer;
