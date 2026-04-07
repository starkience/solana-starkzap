import {configureStore} from '@reduxjs/toolkit';
import authReducer from './auth/reducer';
import transactionReducer from './transaction/reducer';
import notificationReducer from './notification/reducer';
import starknetReducer from './starknet/reducer';
import historyReducer from './history/reducer';

// Redux persist imports
import { persistStore, persistReducer } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { combineReducers } from 'redux';

// Configure Redux Persist
const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['auth', 'history', 'starknet'],
};

// Combine active reducers
const rootReducer = combineReducers({
  auth: authReducer,
  transaction: transactionReducer,
  notification: notificationReducer,
  starknet: starknetReducer,
  history: historyReducer,
});

// Create persisted reducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        warnAfter: 200,
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
      immutableCheck: {
        warnAfter: 200,
      },
    }),
});

// Create persistor
export const persistor = persistStore(store);

export type RootState = ReturnType<typeof rootReducer> & {
  _persist?: { version: number; rehydrated: boolean };
};
export type AppDispatch = typeof store.dispatch;
