import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAppNavigation } from '@/shared/hooks/useAppNavigation';
import { useSelector } from 'react-redux';
import { RootState } from '@/shared/state/store';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';

const axalBars = require('@/assets/images/axal-bars.png');
const axalLogo = require('@/assets/images/axal-logo.png');

export default function WelcomeScreen() {
  const navigation = useAppNavigation();
  const isLoggedIn = useSelector((state: RootState) => state.auth.isLoggedIn);

  useEffect(() => {
    if (isLoggedIn) {
      navigation.reset({ index: 0, routes: [{ name: 'Dashboard' as never }] });
    }
  }, [isLoggedIn]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        {/* Top section — headline + logo */}
        <View style={styles.topSection}>
          <View style={styles.headlineRow}>
            <View>
              <Text style={styles.headline}>Earn</Text>
              <Text style={styles.headline}>More</Text>
            </View>
            <Image source={axalLogo} style={styles.logo} resizeMode="contain" />
          </View>
        </View>

        {/* Illustration + tagline grouped together */}
        <View style={styles.illustrationSection}>
          <Image source={axalBars} style={styles.illustration} resizeMode="contain" />
          <Text style={styles.tagline}>
            <Text style={styles.taglineBold}>Earn real yield,</Text>
            {' '}on your terms.
          </Text>
        </View>

        {/* Buttons — matching Add Funds / Earn style */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => navigation.navigate('LoginOptions' as never)}
            activeOpacity={0.8}
          >
            <Text style={styles.loginButtonText}>Log In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.signUpButton}
            onPress={() => navigation.navigate('LoginOptions' as never)}
            activeOpacity={0.8}
          >
            <Text style={styles.signUpButtonText}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingBottom: Platform.OS === 'ios' ? 4 : 8,
    paddingTop: 8,
  },
  topSection: {},
  headlineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headline: {
    fontSize: 48,
    fontFamily: TYPOGRAPHY.fontFamily,
    fontWeight: '400',
    color: COLORS.textPrimary,
    lineHeight: 54,
    letterSpacing: -0.5,
  },
  logo: {
    width: 56,
    height: 56,
    marginTop: 2,
  },
  illustrationSection: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginTop: -115,
  },
  illustration: {
    width: '95%',
    aspectRatio: 1,
    maxHeight: 320,
  },
  tagline: {
    fontSize: 17,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: '#9E9E9E',
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 8,
  },
  taglineBold: {
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  loginButton: {
    flex: 1,
    height: 48,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loginButtonText: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  signUpButton: {
    flex: 1,
    height: 48,
    borderRadius: 9999,
    backgroundColor: COLORS.brandPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signUpButtonText: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
});
