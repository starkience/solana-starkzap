import React, { useEffect, useState } from 'react';
import { View, Text, Dimensions, Alert, Platform, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import styles from '@/screens/Common/login-screen/LoginScreen.styles';
import { useSelector } from 'react-redux';
import { useAppDispatch } from '@/shared/hooks/useReduxHooks';
import { useAppNavigation } from '@/shared/hooks/useAppNavigation';
import EmbeddedWalletAuth from '@/modules/wallet-providers/components/wallet/EmbeddedWallet';
import TurnkeyWalletAuth from '@/modules/wallet-providers/components/turnkey/TurnkeyWallet';
import { loginSuccess, fetchUserProfile, updateProfilePic } from '@/shared/state/auth/reducer';
import { RootState } from '@/shared/state/store';
import { useCustomization } from '@/shared/config/CustomizationProvider';
import axios from 'axios';
import { SERVER_URL } from '@env';
import COLORS from '@/assets/colors';
import { useEnvError } from '@/shared/context/EnvErrorContext';
import { useDevMode } from '@/shared/context/DevModeContext';
import { generateAndStoreAvatar } from '@/shared/services/diceBearAvatarService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const SERVER_BASE_URL = SERVER_URL || 'http://localhost:3000';

export default function LoginScreen() {
  const navigation = useAppNavigation();
  const dispatch = useAppDispatch();
  const isLoggedIn = useSelector((state: RootState) => state.auth.isLoggedIn);
  const { auth: authConfig } = useCustomization();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const { isDevMode } = useDevMode();
  const { hasMissingEnvVars, missingEnvVars } = useEnvError();
  const [showWarning, setShowWarning] = useState(true);

  // State for app info that needs to be loaded asynchronously
  const [appInfo, setAppInfo] = useState({
    bundleId: 'Loading...',
    urlScheme: 'Loading...'
  });

  // Check if we should show the warning banner
  const shouldShowWarning = !isDevMode && hasMissingEnvVars && showWarning;

  // Load app info on component mount
  useEffect(() => {
    const loadAppInfo = async () => {
      try {
        // Platform-specific bundle ID detection
        let detectedBundleId = 'com.sendai.solanaappkit'; // Default fallback

        if (Platform.OS === 'ios') {
          detectedBundleId = Application.applicationId ||
            Constants.expoConfig?.ios?.bundleIdentifier ||
            'com.sendai.solanaappkit';
        } else {
          detectedBundleId = Application.applicationId ||
            Constants.expoConfig?.android?.package ||
            'com.sendai.solanaappkit';
        }

        // Detect URL scheme from native config
        // This is initialized at app startup in App.tsx
        // Just get a URL and extract the scheme part
        let detectedScheme = 'solanaappkit'; // Default fallback
        try {
          const url = Linking.createURL('/');
          const parts = url.split('://');
          if (parts.length > 0 && parts[0] !== 'null' && parts[0] !== 'undefined') {
            detectedScheme = parts[0];
          }
        } catch (error) {
          console.warn('Error detecting URL scheme:', error);
        }

        // Update state with detected values
        setAppInfo({
          bundleId: detectedBundleId,
          urlScheme: detectedScheme
        });

        console.log('App info loaded:', {
          bundleId: detectedBundleId,
          urlScheme: detectedScheme
        });

      } catch (error) {
        console.error('Error loading app info:', error);
        // Set defaults if detection fails
        setAppInfo({
          bundleId: 'com.sendai.solanaappkit',
          urlScheme: 'solanaappkit'
        });
      }
    };

    loadAppInfo();
  }, []);

  // Debug missing env vars
  useEffect(() => {
    console.log('[LoginScreen] Environment Status:', {
      isDevMode,
      hasMissingEnvVars,
      missingEnvVarsCount: missingEnvVars?.length || 0,
      shouldShowWarning,
      showWarning
    });

    if (hasMissingEnvVars) {
      console.log('[LoginScreen] Missing ENV variables found:', missingEnvVars?.slice(0, 5));

      // Force the warning to show after a small delay if conditions are met
      if (!isDevMode) {
        setTimeout(() => {
          setShowWarning(true);
        }, 500);
      }
    }
  }, [isDevMode, hasMissingEnvVars, missingEnvVars, shouldShowWarning, showWarning]);

  if (isLoggedIn) {
    setTimeout(() => {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Dashboard' }],
      });
    }, 0);
  }

  useEffect(() => {
    if (isLoggedIn) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Dashboard' }],
      });
    }
  }, [isLoggedIn, navigation]);

  const handleWalletConnected = async (info: { provider: string; address: string }) => {
    console.log('Wallet connected:', info);
    setIsAuthenticating(true);
    try {
      // First check if user already exists
      let isNewUser = false;
      try {
        // Try to create the user entry in the database
        const response = await axios.post(`${SERVER_BASE_URL}/api/profile/createUser`, {
          userId: info.address,
          username: info.address.slice(0, 6), // Initially set to wallet address
          handle: '@' + info.address.slice(0, 6),
        });

        console.log('User creation response:', response.data);

        // Check if this was actually a new user creation (not just returning existing user)
        if (response.data?.user && !response.data?.user?.profile_picture_url) {
          isNewUser = true;
        }
      } catch (createError: any) {
        // Log error information once, but don't show response details that might include stack traces
        console.log('User creation error (might be already existing):', createError?.response?.status || createError.message);

        // Only show detailed errors in development
        if (process.env.NODE_ENV === 'development') {
          console.log('Create user error details:', {
            status: createError?.response?.status,
            message: createError?.response?.data?.message || createError.message
          });
        }

        // Don't log the full error object to prevent duplicate verbose errors in console
        // Only log critical errors that aren't related to user already existing
        const isNonCriticalError =
          // User already exists (409)
          createError?.response?.status === 409 ||
          // Server error but likely just user exists (500 from server but with specific message)
          (createError?.response?.status === 500 &&
            (createError?.response?.data?.message?.includes('already exists') ||
              createError?.response?.data?.message?.includes('duplicate key')));

        if (!isNonCriticalError) {
          console.warn('Non-critical error creating user. Login will proceed.');
        }
      }

      // Proceed with login regardless of whether user creation succeeded
      // This way, existing users can still log in
      dispatch(
        loginSuccess({
          provider: info.provider as 'privy' | 'dynamic' | 'turnkey' | 'mwa',
          address: info.address,
        }),
      );

      // After login, fetch user profile to get existing data
      try {
        const profileResult = await dispatch(fetchUserProfile(info.address)).unwrap();

        // Generate DiceBear avatar only for new users without profile pictures
        if (!profileResult?.profilePicUrl) {
          console.log('[LoginScreen] Generating DiceBear avatar for new user...');
          try {
            const avatarUrl = await generateAndStoreAvatar(info.address);

            // Update Redux state
            dispatch(updateProfilePic(avatarUrl));

            // Save the generated avatar URL to the database
            try {
              const saveAvatarResponse = await axios.post(`${SERVER_BASE_URL}/api/profile/updateProfilePic`, {
                userId: info.address,
                profilePicUrl: avatarUrl,
              });

              if (saveAvatarResponse.data.success) {
                console.log('[LoginScreen] DiceBear avatar saved to database successfully');
              } else {
                console.warn('[LoginScreen] Failed to save avatar to database:', saveAvatarResponse.data.error);
              }
            } catch (dbError) {
              console.error('[LoginScreen] Error saving avatar to database:', dbError);
              // Don't fail the login process if database save fails
            }

          } catch (avatarError) {
            console.error('[LoginScreen] Failed to generate DiceBear avatar:', avatarError);
            // Don't fail the login process if avatar generation fails
          }
        }

      } catch (profileError) {
        console.warn('[LoginScreen] Failed to fetch profile after login (non-critical):', profileError);
        // Don't fail the login process if profile fetch fails
        // Generate avatar for new users as fallback
        if (isNewUser) {
          try {
            console.log('[LoginScreen] Generating DiceBear avatar for new user as fallback...');
            const avatarUrl = await generateAndStoreAvatar(info.address);
            dispatch(updateProfilePic(avatarUrl));

            // Save the generated avatar URL to the database
            try {
              const saveAvatarResponse = await axios.post(`${SERVER_BASE_URL}/api/profile/updateProfilePic`, {
                userId: info.address,
                profilePicUrl: avatarUrl,
              });

              if (saveAvatarResponse.data.success) {
                console.log('[LoginScreen] Fallback DiceBear avatar saved to database successfully');
              } else {
                console.warn('[LoginScreen] Failed to save fallback avatar to database:', saveAvatarResponse.data.error);
              }
            } catch (dbError) {
              console.error('[LoginScreen] Error saving fallback avatar to database:', dbError);
              // Don't fail the login process if database save fails
            }

          } catch (fallbackAvatarError) {
            console.warn('[LoginScreen] Failed to generate fallback avatar:', fallbackAvatarError);
          }
        }
      }

    } catch (error) {
      console.error('Error handling wallet connection:', error);
      Alert.alert(
        'Connection Error',
        'Successfully connected to wallet but encountered an error proceeding to the app.',
      );
      setIsAuthenticating(false);
    }
  };

  const renderAuthComponent = () => {
    switch (authConfig.provider) {
      case 'turnkey':
        return <TurnkeyWalletAuth onWalletConnected={handleWalletConnected} />;
      case 'privy':
      case 'dynamic':
      default:
        return <EmbeddedWalletAuth onWalletConnected={handleWalletConnected} />;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        style="dark-content"
        backgroundColor="transparent"
        translucent={true}
      />
      <View style={styles.container}>
        <View style={styles.logoContainer}>
          <LinearGradient
            colors={['#FE3501', '#F97316']}
            style={styles.appLogo}
          >
            <View style={styles.logoInnerDot} />
          </LinearGradient>
        </View>

        <View style={styles.headerContainer}>
          <Text style={styles.welcomeText}>Welcome back</Text>
          <Text style={styles.subtitleText}>Sign in to your account</Text>
        </View>

        {renderAuthComponent()}

        <Text style={styles.agreementText}>
          By continuing you agree to our t&c and Privacy Policy
        </Text>

        {isAuthenticating && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.brandPrimary} />
              <Text style={styles.loadingText}>Connecting to wallet...</Text>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
