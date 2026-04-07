import React, { useEffect, useState } from 'react';
import { View, Text, Dimensions, Alert, Platform, ActivityIndicator, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import oldStyles from '@/screens/Common/login-screen/LoginScreen.styles';
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
import TYPOGRAPHY from '@/assets/typography';
import { Ionicons } from '@expo/vector-icons';
import { useEnvError } from '@/shared/context/EnvErrorContext';
import { useDevMode } from '@/shared/context/DevModeContext';
import { generateAndStoreAvatar } from '@/shared/services/diceBearAvatarService';
import { useAuth } from '@/modules/wallet-providers/hooks/useAuth';

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

  const auth = useAuth();
  const [email, setEmail] = useState('');

  const handleEmailLogin = async () => {
    if (!email.trim() || !auth.loginWithEmail) return;
    setIsAuthenticating(true);
    try {
      await (auth.loginWithEmail as any)(email.trim());
    } catch (err: any) {
      console.error('[LoginScreen] Email login error:', err);
      setIsAuthenticating(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!auth.loginWithGoogle) return;
    setIsAuthenticating(true);
    try {
      await auth.loginWithGoogle();
    } catch (err: any) {
      console.error('[LoginScreen] Google login error:', err);
      setIsAuthenticating(false);
    }
  };

  const handleAppleLogin = async () => {
    if (!auth.loginWithApple) return;
    setIsAuthenticating(true);
    try {
      await auth.loginWithApple();
    } catch (err: any) {
      console.error('[LoginScreen] Apple login error:', err);
      setIsAuthenticating(false);
    }
  };

  return (
    <SafeAreaView style={axalStyles.safeArea}>
      <StatusBar style="dark" />

      {/* Close button */}
      <TouchableOpacity style={axalStyles.closeButton} onPress={() => navigation.goBack()}>
        <Ionicons name="close" size={24} color={COLORS.textPrimary} />
      </TouchableOpacity>

      <View style={axalStyles.container}>
        {/* Title */}
        <Text style={axalStyles.title}>Log in</Text>

        {/* Email input */}
        <Text style={axalStyles.inputLabel}>Email Address</Text>
        <TextInput
          style={axalStyles.emailInput}
          placeholder="user@email.com"
          placeholderTextColor="#BDBDBD"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        {/* Log In button */}
        <TouchableOpacity style={axalStyles.loginButton} onPress={handleEmailLogin} activeOpacity={0.85}>
          <Text style={axalStyles.loginButtonText}>Log In</Text>
        </TouchableOpacity>

        {/* OR divider */}
        <View style={axalStyles.orRow}>
          <View style={axalStyles.orLine} />
          <Text style={axalStyles.orText}>OR</Text>
          <View style={axalStyles.orLine} />
        </View>

        {/* Continue with Google */}
        <TouchableOpacity style={axalStyles.socialButton} onPress={handleGoogleLogin} activeOpacity={0.8}>
          <Text style={axalStyles.googleIcon}>G</Text>
          <Text style={axalStyles.socialButtonText}>Continue with Google</Text>
        </TouchableOpacity>

        {/* Continue with Apple */}
        <TouchableOpacity style={axalStyles.socialButton} onPress={handleAppleLogin} activeOpacity={0.8}>
          <Ionicons name="logo-apple" size={20} color={COLORS.textPrimary} />
          <Text style={axalStyles.socialButtonText}>Continue with Apple</Text>
        </TouchableOpacity>

        {/* New to Axal? */}
        <View style={axalStyles.signUpRow}>
          <Text style={axalStyles.signUpText}>New to Axal? </Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={axalStyles.signUpLink}>Sign up</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Footer */}
      <View style={axalStyles.footer}>
        <Text style={axalStyles.footerText}>Terms of use | Privacy Policy | Help Center</Text>
      </View>

      {/* Loading overlay */}
      {isAuthenticating && (
        <View style={axalStyles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.brandPrimary} />
          <Text style={axalStyles.loadingText}>Connecting...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const axalStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  closeButton: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
    alignSelf: 'flex-start',
  },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 16,
  },
  title: {
    fontSize: 42,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 32,
  },
  inputLabel: {
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  emailInput: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textPrimary,
    marginBottom: 20,
  },
  loginButton: {
    height: 54,
    borderRadius: 9999,
    backgroundColor: COLORS.brandPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  loginButtonText: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  orText: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
    paddingHorizontal: 16,
  },
  socialButton: {
    height: 54,
    borderRadius: 14,
    backgroundColor: '#F0F0F0',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  googleIcon: {
    fontSize: 18,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    fontWeight: '700',
    color: '#4285F4',
  },
  socialButtonText: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  signUpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  signUpText: {
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textPrimary,
  },
  signUpLink: {
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    fontWeight: '500',
    color: COLORS.textPrimary,
    textDecorationLine: 'underline',
  },
  footer: {
    paddingBottom: Platform.OS === 'ios' ? 4 : 12,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  loadingText: {
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.textSecondary,
    marginTop: 12,
  },
});
