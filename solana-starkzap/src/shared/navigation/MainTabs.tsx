import React, { useMemo, createContext, useContext } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform, View, StyleSheet, Text, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';

import PortfolioScreen from '@/screens/Portfolio/PortfolioScreen';
import TradeScreen from '@/screens/Trade/TradeScreen';
import ProScreen from '@/screens/Pro/ProScreen';

interface ScrollUIContextType {
  hideTabBar: () => void;
  showTabBar: () => void;
}

const ScrollUIContext = createContext<ScrollUIContextType | null>(null);

export const useScrollUI = () => {
  const context = useContext(ScrollUIContext);
  if (!context) {
    return { hideTabBar: () => {}, showTabBar: () => {} };
  }
  return context;
};

const Tab = createBottomTabNavigator();

interface TabIconProps {
  focused: boolean;
  iconName: keyof typeof Ionicons.glyphMap;
  iconNameFocused: keyof typeof Ionicons.glyphMap;
  label: string;
}

const TabIcon = ({ focused, iconName, iconNameFocused, label }: TabIconProps) => (
  <View style={tabIconStyles.container}>
    <Ionicons
      name={focused ? iconNameFocused : iconName}
      size={22}
      color={focused ? COLORS.brandPrimary : COLORS.textSecondary}
    />
    <Text style={[tabIconStyles.label, focused && tabIconStyles.labelActive]}>
      {label}
    </Text>
  </View>
);

const tabIconStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minWidth: 70,
  },
  label: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    textAlign: 'center',
  },
  labelActive: {
    color: COLORS.brandPrimary,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
  },
});

export default function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Portfolio"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: COLORS.brandPrimary,
        tabBarStyle: {
          paddingTop: Platform.OS === 'android' ? 5 : 10,
          paddingBottom: Platform.OS === 'android' ? 5 : 0,
          backgroundColor: COLORS.background,
          borderTopWidth: 1,
          borderTopColor: COLORS.greyBorder,
          position: 'absolute',
          elevation: 0,
          height: Platform.OS === 'android' ? 60 : 80,
          bottom: 0,
          left: 0,
          right: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.04,
          shadowRadius: 8,
        },
      }}
    >
      <Tab.Screen
        name="Portfolio"
        component={PortfolioScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} iconName="wallet-outline" iconNameFocused="wallet" label="Portfolio" />
          ),
        }}
      />
      <Tab.Screen
        name="Trade"
        component={TradeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} iconName="swap-vertical-outline" iconNameFocused="swap-vertical" label="Trade" />
          ),
        }}
      />
      <Tab.Screen
        name="Pro"
        component={ProScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} iconName="bar-chart-outline" iconNameFocused="bar-chart" label="Pro" />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
