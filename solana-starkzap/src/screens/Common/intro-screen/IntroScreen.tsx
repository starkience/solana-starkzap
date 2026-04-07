import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppNavigation } from '@/shared/hooks/useAppNavigation';
import COLORS from '@/assets/colors';
import { useSelector } from 'react-redux';
import { RootState } from '@/shared/state/store';
import { getDynamicClient } from '@/modules/wallet-providers/services/walletProviders/dynamic';

export default function IntroScreen() {
  const navigation = useAppNavigation();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const isLoggedIn = useSelector((state: RootState) => state.auth.isLoggedIn);

  useEffect(() => {
    const checkAuthStatus = async () => {
      setIsCheckingAuth(true);

      if (isLoggedIn) {
        navigation.navigate('Dashboard' as never);
        setIsCheckingAuth(false);
        return;
      }

      try {
        const client = getDynamicClient();
        const authUser = client?.auth?.authenticatedUser;

        if (authUser) {
          navigation.navigate('Dashboard' as never);
          setIsCheckingAuth(false);
        } else {
          setTimeout(() => {
            navigation.reset({
              index: 0,
              routes: [{ name: 'LoginOptions' }],
            });
            setIsCheckingAuth(false);
          }, 1000);
        }
      } catch (e) {
        setTimeout(() => {
          navigation.reset({
            index: 0,
            routes: [{ name: 'LoginOptions' }],
          });
          setIsCheckingAuth(false);
        }, 1000);
      }
    };

    checkAuthStatus();
  }, [navigation, isLoggedIn]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark-content" backgroundColor="transparent" translucent={true} />
      <View style={styles.container}>
        <LinearGradient
          colors={['#FE3501', '#F97316']}
          style={styles.appLogo}
        >
          <View style={styles.logoInnerDot} />
        </LinearGradient>
        {isCheckingAuth && (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={COLORS.brandPrimary} style={styles.loader} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  appLogo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoInnerDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FCD34D',
  },
  loaderContainer: {
    position: 'absolute',
    bottom: 100,
    alignItems: 'center',
  },
  loader: {
    marginTop: 20,
  },
});
