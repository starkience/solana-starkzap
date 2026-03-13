import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useSelector } from 'react-redux';
import { RootState } from '../state/store';
import MainTabs from './MainTabs';
import CoinDetailPage from '@/screens/sample-ui/Threads/coin-detail-page/CoinDetailPage';
import { PumpfunScreen, PumpSwapScreen } from '@/modules/pump-fun';
import { TokenMillScreen } from '@/modules/token-mill';
import { NftScreen } from '@/modules/nft';
import { MeteoraScreen } from '@/modules/meteora';
import LaunchlabsScreen from '@/modules/raydium/screens/LaunchlabsScreen';
import OtherProfileScreen from '@/screens/sample-ui/Threads/other-profile-screen/OtherProfileScreen';
import PostThreadScreen from '@/screens/sample-ui/Threads/post-thread-screen/PostthreadScreen';
import FollowersFollowingListScreen from '@/core/profile/components/followers-following-listScreen/FollowersFollowingListScreen';
import ProfileScreen from '@/screens/sample-ui/Threads/profile-screen/ProfileScreen';

import { MercuroScreen } from '@/modules/mercuryo';
import SwapScreen from '@/modules/swap/screens/SwapScreen';
import OnrampScreen from '@/modules/moonpay/screens/OnrampScreen';
import { TokenInfo } from '@/modules/data-module';

import WalletScreen from '@/modules/moonpay/screens/WalletScreen';
import { IntroScreen, LoginScreen } from '@/screens/Common';
import DeleteAccountConfirmationScreen from '@/screens/Common/DeleteAccountConfirmationScreen';
import WebViewScreen from '@/screens/Common/WebViewScreen';
import EarnScreen from '@/screens/Earn/EarnScreen';
import BTCStakingScreen from '@/screens/Earn/BTCStakingScreen';
import BTCStakeFlowScreen from '@/screens/Earn/BTCStakeFlowScreen';
import BTCStakingPositionScreen from '@/screens/Earn/BTCStakingPositionScreen';

export type RootStackParamList = {
  IntroScreen: undefined;
  LoginOptions: undefined;
  MainTabs: undefined;
  CoinDetailPage: undefined;
  Blink: undefined;
  Pumpfun: undefined;
  TokenMill: undefined;
  NftScreen: undefined;
  PumpSwap: undefined;
  MercuroScreen: undefined;
  LaunchlabsScreen: undefined;
  MeteoraScreen: undefined;
  OtherProfile: { userId: string };
  PostThread: { postId: string };
  FollowersFollowingList: undefined;
  ProfileScreen: undefined;
  WalletScreen: {
    walletAddress?: string;
    walletBalance?: string;
  };
  OnrampScreen: undefined;
  WebViewScreen: { uri: string; title: string };
  DeleteAccountConfirmationScreen: undefined;
  EarnScreen: undefined;
  BTCStaking: undefined;
  BTCStakeFlow: {
    poolAddress: string;
    validatorName: string;
    tokenSymbol: string;
    delegatedAmount: string;
  };
  BTCStakingPosition: {
    poolAddress: string;
    validatorName: string;
    tokenSymbol: string;
  };
  SwapScreen: {
    inputToken?: Partial<TokenInfo>;
    outputToken?: {
      address: string;
      symbol: string;
      mint?: string;
      logoURI?: string;
      name?: string;
    };
    inputAmount?: string;
    shouldInitialize?: boolean;
    showBackButton?: boolean;
  };
};

const Stack = createStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const isLoggedIn = useSelector((state: RootState) => state.auth.isLoggedIn);

  // Determine which screens to show based on login state
  const renderScreens = () => {
    if (isLoggedIn) {
      return (
        <>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="CoinDetailPage" component={CoinDetailPage} />
          <Stack.Screen name="Pumpfun" component={PumpfunScreen} />
          <Stack.Screen name="TokenMill" component={TokenMillScreen} />
          <Stack.Screen name="NftScreen" component={NftScreen} />
          <Stack.Screen name="PumpSwap" component={PumpSwapScreen} />
          <Stack.Screen name="MercuroScreen" component={MercuroScreen} />
          <Stack.Screen name="LaunchlabsScreen" component={LaunchlabsScreen} />
          <Stack.Screen name="MeteoraScreen" component={MeteoraScreen} />

          {/* NEW SCREEN for viewing other user's profile */}
          <Stack.Screen name="OtherProfile" component={OtherProfileScreen} />
          <Stack.Screen name="PostThread" component={PostThreadScreen} />
          <Stack.Screen
            name="FollowersFollowingList"
            component={FollowersFollowingListScreen}
            options={{ title: '' }}
          />
          <Stack.Screen name="ProfileScreen" component={ProfileScreen} />
          <Stack.Screen name="WalletScreen" component={WalletScreen} />
          <Stack.Screen name="OnrampScreen" component={OnrampScreen} />
          <Stack.Screen name="WebViewScreen" component={WebViewScreen} />
          <Stack.Screen name="DeleteAccountConfirmationScreen" component={DeleteAccountConfirmationScreen} />
          <Stack.Screen name="EarnScreen" component={EarnScreen} />
          <Stack.Screen name="BTCStaking" component={BTCStakingScreen} />
          <Stack.Screen name="BTCStakeFlow" component={BTCStakeFlowScreen} />
          <Stack.Screen name="BTCStakingPosition" component={BTCStakingPositionScreen} />
          <Stack.Screen name="SwapScreen" component={SwapScreen} />
        </>
      );
    } else {
      return (
        <>
          <Stack.Screen name="IntroScreen" component={IntroScreen} />
          <Stack.Screen name="LoginOptions" component={LoginScreen} />
          {/* Still include MainTabs for navigation from IntroScreen if user is found to be logged in */}
          <Stack.Screen name="MainTabs" component={MainTabs} />
        </>
      );
    }
  };

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      // When logged in, start at MainTabs; otherwise start at IntroScreen
      initialRouteName={isLoggedIn ? "MainTabs" : "IntroScreen"}
    >
      {renderScreens()}
    </Stack.Navigator>
  );
}
