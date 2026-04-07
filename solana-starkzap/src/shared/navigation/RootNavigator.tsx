import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useSelector } from 'react-redux';
import { RootState } from '../state/store';

// Axal screens
import WelcomeScreen from '@/screens/Axal/WelcomeScreen';
import DashboardScreen from '@/screens/Axal/DashboardScreen';
import AddFundsScreen from '@/screens/Axal/AddFundsScreen';
import SelectNetworkScreen from '@/screens/Axal/SelectNetworkScreen';
import TransferScreen from '@/screens/Axal/TransferScreen';
import SavingsDetailScreen from '@/screens/Axal/SavingsDetailScreen';
import InvestScreen from '@/screens/Axal/InvestScreen';
import WithdrawScreen from '@/screens/Axal/WithdrawScreen';
import HistoryScreen from '@/screens/Axal/HistoryScreen';

// Shared screens
import { LoginScreen } from '@/screens/Common';
import WebViewScreen from '@/screens/Common/WebViewScreen';
import DeleteAccountConfirmationScreen from '@/screens/Common/DeleteAccountConfirmationScreen';

export type RootStackParamList = {
  Welcome: undefined;
  LoginOptions: undefined;
  Dashboard: undefined;
  AddFunds: undefined;
  SelectNetwork: undefined;
  Transfer: { network: string };
  SavingsDetail: undefined;
  Invest: undefined;
  Withdraw: undefined;
  History: undefined;
  WebViewScreen: { uri: string; title: string };
  DeleteAccountConfirmationScreen: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const isLoggedIn = useSelector((state: RootState) => state.auth.isLoggedIn);

  const renderScreens = () => {
    if (isLoggedIn) {
      return (
        <>
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="AddFunds" component={AddFundsScreen} />
          <Stack.Screen name="SelectNetwork" component={SelectNetworkScreen} />
          <Stack.Screen name="Transfer" component={TransferScreen} />
          <Stack.Screen name="SavingsDetail" component={SavingsDetailScreen} />
          <Stack.Screen name="Invest" component={InvestScreen} />
          <Stack.Screen name="Withdraw" component={WithdrawScreen} />
          <Stack.Screen name="History" component={HistoryScreen} />
          <Stack.Screen name="WebViewScreen" component={WebViewScreen} />
          <Stack.Screen name="DeleteAccountConfirmationScreen" component={DeleteAccountConfirmationScreen} />
        </>
      );
    } else {
      return (
        <>
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="LoginOptions" component={LoginScreen} />
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
        </>
      );
    }
  };

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={isLoggedIn ? 'Dashboard' : 'Welcome'}
    >
      {renderScreens()}
    </Stack.Navigator>
  );
}
