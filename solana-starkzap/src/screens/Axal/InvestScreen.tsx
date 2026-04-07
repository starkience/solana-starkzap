import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
  TextInput,
  Animated,
  PanResponder,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppNavigation } from '@/shared/hooks/useAppNavigation';
import { useSelector } from 'react-redux';
import { RootState } from '@/shared/state/store';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';
import { useKarnotBTC } from '@/modules/starknet/hooks/useKarnotBTC';
import { getEVMUSDCBalance } from '@/modules/bridge/services/evmBalanceService';

const SWIPE_THRESHOLD = 120;

type EarnMode = 'usdc' | 'btc';
type FlowState = 'idle' | 'processing' | 'success' | 'failed';

/** Transaction lifecycle steps for the BTC earn flow */
type StepStatus = 'pending' | 'active' | 'completed' | 'failed';

interface LifecycleStep {
  id: string;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  status: StepStatus;
}

const INITIAL_BTC_STEPS: LifecycleStep[] = [
  { id: 'deposit',  label: 'Deposited',           description: 'USDC on Arbitrum',              icon: 'wallet-outline',    status: 'pending' },
  { id: 'bridge',   label: 'Bridging',             description: 'Arbitrum → Starknet via LayerZero', icon: 'swap-horizontal-outline', status: 'pending' },
  { id: 'swap',     label: 'Swap for BTC',         description: 'USDC → BTC via AVNU',           icon: 'repeat-outline',    status: 'pending' },
  { id: 'stake',    label: 'Stake BTC',            description: 'Karnot validator on Starknet',   icon: 'lock-closed-outline', status: 'pending' },
  { id: 'yield',    label: 'Earning Yield',        description: '',                               icon: 'trending-up-outline', status: 'pending' },
];

const INITIAL_USDC_STEPS: LifecycleStep[] = [
  { id: 'deposit',  label: 'Deposited',           description: 'USDC on Arbitrum',              icon: 'wallet-outline',    status: 'pending' },
  { id: 'bridge',   label: 'Bridging',             description: 'Arbitrum → Starknet via LayerZero', icon: 'swap-horizontal-outline', status: 'pending' },
  { id: 'lend',     label: 'Lending USDC',         description: 'Depositing into yield vault',    icon: 'lock-closed-outline', status: 'pending' },
  { id: 'yield',    label: 'Earning Yield',        description: '',                               icon: 'trending-up-outline', status: 'pending' },
];

/** Maps onStatus messages from useKarnotBTC to step IDs */
function resolveActiveStep(statusMsg: string): string | null {
  const lower = statusMsg.toLowerCase();
  if (lower.includes('bridge quote'))        return 'bridge';
  if (lower.includes('bridging'))            return 'bridge';
  if (lower.includes('bridge confirmation')) return 'bridge';
  if (lower.includes('swapping'))            return 'swap';
  if (lower.includes('staking'))             return 'stake';
  if (lower.includes('lending'))             return 'lend';
  if (lower.includes('done'))               return 'yield';
  return null;
}

export default function InvestScreen() {
  const navigation = useAppNavigation();
  const starknetState = useSelector((state: RootState) => state.starknet);

  const {
    bestPool,
    btcApy,
    isLoading: isLoadingPools,
    baseAddress,
    fetchKarnotPools,
    fetchBtcApy,
    earnBTC,
    earnBTCFromEVM,
  } = useKarnotBTC();

  const [mode, setMode] = useState<EarnMode>('usdc');
  const [flowState, setFlowState] = useState<FlowState>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [cashBalance, setCashBalance] = useState(0.0);
  const [investAmount, setInvestAmount] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Lifecycle steps state
  const [steps, setSteps] = useState<LifecycleStep[]>([]);

  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const overlaySlide = useRef(new Animated.Value(0)).current;

  const usdcApy = 3.64;

  // The amount the user wants to invest (defaults to full balance)
  const effectiveAmount = parseFloat(investAmount) || cashBalance;
  const displayAmount = investAmount || (cashBalance > 0 ? cashBalance.toFixed(2) : '0');

  // Fetch real Arbitrum USDC balance
  useEffect(() => {
    if (baseAddress) {
      getEVMUSDCBalance(baseAddress, 'arbitrum').then((bal) => {
        const parsed = parseFloat(bal) || 0;
        setCashBalance(parsed);
      });
    }
  }, [baseAddress]);

  useEffect(() => {
    fetchKarnotPools();
  }, [fetchKarnotPools]);

  useEffect(() => {
    fetchBtcApy();
  }, [bestPool, fetchBtcApy]);

  const activeApy = mode === 'btc' ? btcApy : usdcApy;
  const monthlyEarning = effectiveAmount * activeApy / 100 / 12;
  const yearlyEarning = effectiveAmount * activeApy / 100;
  const threeYearEarning = effectiveAmount * activeApy / 100 * 3;

  const handleSetMax = () => {
    setInvestAmount(cashBalance.toFixed(2));
  };

  /** Advance lifecycle steps based on status messages */
  const handleStatusUpdate = useCallback((msg: string) => {
    setStatusMessage(msg);
    const activeStepId = resolveActiveStep(msg);
    if (!activeStepId) return;

    setSteps(prev => prev.map(step => {
      if (step.id === activeStepId) {
        return { ...step, status: 'active' };
      }
      const activeIdx = prev.findIndex(s => s.id === activeStepId);
      const thisIdx = prev.findIndex(s => s.id === step.id);
      if (thisIdx < activeIdx && step.status !== 'completed') {
        return { ...step, status: 'completed' };
      }
      return step;
    }));
  }, []);

  const markAllCompleted = useCallback(() => {
    setSteps(prev => prev.map(step => ({ ...step, status: 'completed' })));
  }, []);

  const markFailed = useCallback(() => {
    setSteps(prev => prev.map(step =>
      step.status === 'active' ? { ...step, status: 'failed' } : step
    ));
  }, []);

  // Use a ref for the swipe handler so PanResponder always calls the latest version
  const swipeHandlerRef = useRef<() => void>(() => {});

  const handleSwipeComplete = useCallback(async () => {
    const amount = parseFloat(investAmount) || cashBalance;

    if (mode === 'usdc') {
      const usdcSteps = INITIAL_USDC_STEPS.map((s, i) =>
        i === 0 ? { ...s, status: 'completed' as StepStatus } : s
      );
      setSteps(usdcSteps);
      setFlowState('processing');
      overlaySlide.setValue(0);
      setTimeout(() => {
        setSteps(prev => prev.map(s => ({ ...s, status: 'completed' as StepStatus })));
        setFlowState('success');
      }, 2000);
      return;
    }

    if (amount <= 0) {
      Alert.alert('No funds', 'Deposit USDC to your Arbitrum address first.');
      resetSwipe();
      return;
    }
    if (amount > cashBalance) {
      Alert.alert('Insufficient funds', `You only have $${cashBalance.toFixed(2)} USDC.`);
      resetSwipe();
      return;
    }
    if (!bestPool) {
      Alert.alert('Loading', 'BTC pools still loading. Please wait.');
      resetSwipe();
      return;
    }

    const btcSteps = INITIAL_BTC_STEPS.map(s => ({
      ...s,
      status: (s.id === 'deposit' ? 'completed' : 'pending') as StepStatus,
      description: s.id === 'yield' && btcApy > 0
        ? `~${btcApy.toFixed(2)}% APY on ${bestPool.tokenSymbol}`
        : s.description,
    }));
    setSteps(btcSteps);
    setFlowState('processing');
    overlaySlide.setValue(0);
    overlayOpacity.setValue(1);
    setErrorMessage('');

    try {
      if (baseAddress) {
        await earnBTCFromEVM(
          amount.toFixed(2),
          (s) => handleStatusUpdate(s),
          'arbitrum',
        );
      } else {
        handleStatusUpdate('Swapping USDC to BTC...');
        await earnBTC(amount.toFixed(2));
      }
      markAllCompleted();
      setTimeout(() => setFlowState('success'), 800);
    } catch (err: any) {
      markFailed();
      setErrorMessage(err.message || 'Transaction failed');
      setFlowState('failed');
    }
  }, [mode, investAmount, cashBalance, bestPool, btcApy, baseAddress, earnBTCFromEVM, earnBTC, handleStatusUpdate, markAllCompleted, markFailed]);

  // Keep the ref in sync so PanResponder always uses latest handler
  useEffect(() => {
    swipeHandlerRef.current = handleSwipeComplete;
  }, [handleSwipeComplete]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy < -10,
      onPanResponderMove: (_, gs) => {
        const progress = Math.min(Math.max(-gs.dy / SWIPE_THRESHOLD, 0), 1);
        overlayOpacity.setValue(progress);
      },
      onPanResponderRelease: (_, gs) => {
        if (-gs.dy > SWIPE_THRESHOLD) {
          Animated.timing(overlayOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            swipeHandlerRef.current();
          });
        } else {
          Animated.timing(overlayOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const resetSwipe = () => {
    setFlowState('idle');
    setStatusMessage('');
    setErrorMessage('');
    setSteps([]);
    overlayOpacity.setValue(0);
    overlaySlide.setValue(0);
  };

  /** Smooth slide-down dismiss for success overlay */
  const handleSuccessTap = () => {
    Animated.parallel([
      Animated.timing(overlaySlide, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start(() => {
      resetSwipe();
      navigation.navigate('Dashboard' as never);
    });
  };

  const accentColor = mode === 'btc' ? COLORS.btcOrange : COLORS.brandPrimary;
  const buttonTextColor = mode === 'btc' ? COLORS.white : COLORS.textPrimary;

  return (
    <View style={styles.rootContainer}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ width: 40 }} />
            <Text style={styles.headerTitle}>Start Earning</Text>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
              <Ionicons name="close" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Amount input + Toggle */}
            <Text style={styles.balanceLabel}>Amount to invest:</Text>
            <View style={styles.amountInputRow}>
              <Text style={styles.amountDollarSign}>$</Text>
              <TextInput
                style={styles.amountInput}
                value={investAmount}
                onChangeText={setInvestAmount}
                placeholder={cashBalance > 0 ? cashBalance.toFixed(2) : '0.00'}
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="decimal-pad"
                returnKeyType="done"
              />
              <Text style={styles.amountCurrency}>USDC</Text>
            </View>
            <View style={styles.amountHelperRow}>
              <Text style={styles.amountAvailable}>
                Available: ${cashBalance.toFixed(2)}
              </Text>
              <TouchableOpacity onPress={handleSetMax} style={styles.maxBadge}>
                <Text style={styles.maxBadgeText}>Max</Text>
              </TouchableOpacity>
            </View>

            {/* Mode toggle */}
            <View style={styles.toggleRow}>
              <View style={styles.toggle}>
                <TouchableOpacity
                  style={[styles.toggleOption, mode === 'usdc' && styles.toggleOptionActiveGreen]}
                  onPress={() => setMode('usdc')}
                >
                  <Text style={[styles.toggleText, mode === 'usdc' && styles.toggleTextActiveGreen]}>USDC</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleOption, mode === 'btc' && styles.toggleOptionActiveOrange]}
                  onPress={() => setMode('btc')}
                >
                  <Text style={[styles.toggleText, mode === 'btc' && styles.toggleTextActiveOrange]}>BTC</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Earn more card */}
            <View style={[styles.earnCard, mode === 'btc' && styles.earnCardBtc]}>
              <View style={styles.earnCardIcon}>
                <Ionicons name="person-outline" size={24} color={COLORS.textPrimary} />
              </View>
              <View style={styles.earnCardContent}>
                <Text style={styles.earnCardTitle}>Earn more!</Text>
                <Text style={styles.earnCardSubtitle}>
                  Add US$ 500 to earn US$ 18,2 in one year.
                </Text>
              </View>
              <View style={styles.earnCardArrow}>
                <Ionicons name="arrow-forward" size={16} color={COLORS.textPrimary} />
              </View>
            </View>

            {/* Yield projections */}
            {mode === 'usdc' ? (
              <View style={styles.projections}>
                <View style={styles.projectionRow}>
                  <Text style={styles.projectionLabel}>Current APY</Text>
                  <Text style={styles.projectionValueGreen}>+ {usdcApy.toFixed(2)}%</Text>
                </View>
                <View style={styles.projectionRow}>
                  <Text style={styles.projectionLabel}>Projected Monthly Earning</Text>
                  <Text style={styles.projectionValueGreen}>+ US$ {monthlyEarning.toFixed(2)}</Text>
                </View>
                <View style={styles.projectionRow}>
                  <Text style={styles.projectionLabel}>Projected 1 Year Earning</Text>
                  <Text style={styles.projectionValueGreen}>+ US$ {yearlyEarning.toFixed(2)}</Text>
                </View>
                <View style={styles.projectionRow}>
                  <Text style={styles.projectionLabel}>Projected 3 Year Earning</Text>
                  <Text style={styles.projectionValueGreen}>+ US$ {threeYearEarning.toFixed(2)}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.projections}>
                <View style={styles.projectionRow}>
                  <Text style={styles.projectionLabel}>Current APY</Text>
                  <Text style={styles.projectionValueOrange}>
                    {btcApy > 0 ? `+ ${btcApy.toFixed(2)}%` : isLoadingPools ? 'Loading...' : '—'}
                  </Text>
                </View>
                <View style={styles.projectionRow}>
                  <Text style={styles.projectionLabel}>Projected Monthly Earning</Text>
                  <Text style={styles.projectionValueOrange}>+ US$ {monthlyEarning.toFixed(2)}</Text>
                </View>
                <View style={styles.projectionRow}>
                  <Text style={styles.projectionLabel}>Projected 1 Year Earning</Text>
                  <Text style={styles.projectionValueOrange}>+ US$ {yearlyEarning.toFixed(2)}</Text>
                </View>
                <View style={styles.projectionRow}>
                  <Text style={styles.projectionLabel}>Projected 3 Year Earning</Text>
                  <Text style={styles.projectionValueOrange}>+ US$ {threeYearEarning.toFixed(2)}</Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Swipe button */}
          {flowState === 'idle' && (
            <View style={styles.bottomArea}>
              <Animated.View {...panResponder.panHandlers}>
                <View style={[styles.swipeButton, { backgroundColor: accentColor }]}>
                  <Ionicons name="chevron-up" size={16} color={buttonTextColor} />
                  <Ionicons name="chevron-up" size={16} color={buttonTextColor} style={{ marginTop: -10 }} />
                  <Text style={[styles.swipeButtonText, { color: buttonTextColor }]}>
                    {mode === 'btc' ? 'Swipe up to earn BTC' : 'Swipe up to invest'}
                  </Text>
                </View>
              </Animated.View>
            </View>
          )}
        </View>
      </SafeAreaView>

      {/* ── Processing overlay — simple status + link to History ── */}
      {(flowState === 'processing' || flowState === 'failed') && (
        <Animated.View
          style={[
            styles.fullOverlay,
            { backgroundColor: accentColor },
          ]}
        >
          <SafeAreaView style={lcStyles.safeArea}>
            <View style={lcStyles.header}>
              <Text style={lcStyles.headerTitle}>
                {flowState === 'failed' ? 'Transaction Failed' : 'Processing...'}
              </Text>
              {flowState === 'failed' && (
                <TouchableOpacity onPress={resetSwipe} style={lcStyles.closeButton}>
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>

            <View style={lcStyles.amountSection}>
              <Text style={lcStyles.amountLabel}>Investing</Text>
              <Text style={lcStyles.amountValue}>${effectiveAmount.toFixed(2)} USDC</Text>
            </View>

            {flowState === 'processing' && (
              <View style={lcStyles.processingCenter}>
                <ActivityIndicator size="large" color="#FFFFFF" />
                <Text style={lcStyles.statusText}>
                  {statusMessage || 'Initializing...'}
                </Text>
                <TouchableOpacity
                  style={lcStyles.historyLink}
                  onPress={() => {
                    navigation.navigate('History' as never);
                  }}
                >
                  <Ionicons name="receipt-outline" size={16} color="#FFFFFF" />
                  <Text style={lcStyles.historyLinkText}>View in History</Text>
                  <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.6)" />
                </TouchableOpacity>
              </View>
            )}

            {flowState === 'failed' && (
              <View style={lcStyles.errorSection}>
                <Ionicons name="alert-circle" size={48} color="rgba(255,200,200,0.9)" />
                <Text style={lcStyles.errorText}>{errorMessage}</Text>
                <TouchableOpacity style={lcStyles.retryButton} onPress={resetSwipe}>
                  <Text style={lcStyles.retryButtonText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            )}
          </SafeAreaView>
        </Animated.View>
      )}

      {/* ── Swipe overlay (pre-processing) ── */}
      {flowState === 'idle' && (
        <Animated.View
          style={[
            styles.fullOverlay,
            { backgroundColor: accentColor, opacity: overlayOpacity },
          ]}
          pointerEvents="none"
        >
          <View style={styles.overlayTop}>
            <Ionicons name="chevron-up" size={20} color={buttonTextColor} style={{ opacity: 0.5 }} />
            <Ionicons name="chevron-up" size={20} color={buttonTextColor} style={{ opacity: 0.5, marginTop: -8 }} />
            <Text style={[styles.overlaySwipeText, { color: buttonTextColor, opacity: 0.5 }]}>
              {mode === 'btc' ? 'Swipe up to earn BTC' : 'Swipe up to invest'}
            </Text>
          </View>
        </Animated.View>
      )}

      {/* ── Success overlay with slide-down dismiss ── */}
      {flowState === 'success' && (
        <TouchableWithoutFeedback onPress={handleSuccessTap}>
          <Animated.View style={[
            styles.successOverlay,
            {
              backgroundColor: accentColor,
              transform: [{
                translateY: overlaySlide.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 800],
                }),
              }],
              opacity: overlayOpacity.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1],
              }),
            },
          ]}>
            <View style={styles.successContent}>
              <View style={styles.coinIllustration}>
                <Ionicons name="checkmark-circle" size={72} color={buttonTextColor} />
              </View>
              <Text style={[styles.successTitle, { color: buttonTextColor }]}>
                DEPOSIT{'\n'}INITIATED
              </Text>
              <Text style={[styles.successSubtitle, { color: buttonTextColor }]}>
                Your ${effectiveAmount.toFixed(0) || '0'} will start earning shortly!
              </Text>
              {activeApy > 0 && (
                <Text style={[styles.successYield, { color: buttonTextColor }]}>
                  Expected yield: ~{activeApy.toFixed(2)}% APY
                </Text>
              )}
            </View>
            <Text style={[styles.tapToContinue, { color: buttonTextColor }]}>
              Tap Anywhere to Continue
            </Text>
          </Animated.View>
        </TouchableWithoutFeedback>
      )}
    </View>
  );
}

/* ── Overlay styles ── */
const lcStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  amountSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  amountLabel: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: 'rgba(255,255,255,0.6)',
  },
  amountValue: {
    fontSize: 32,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 4,
  },
  processingCenter: {
    alignItems: 'center',
    paddingTop: 40,
    gap: 16,
  },
  statusText: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginTop: 8,
  },
  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  historyLinkText: {
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: '#FFFFFF',
  },
  errorSection: {
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 28,
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: 'rgba(255,200,200,0.9)',
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginTop: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

/* ── Main screen styles ── */
const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  balanceLabel: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginTop: 8,
  },
  amountDollarSign: {
    fontSize: 32,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
    marginRight: 2,
  },
  amountInput: {
    fontSize: 42,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    fontWeight: '700',
    color: COLORS.textPrimary,
    minWidth: 60,
    textAlign: 'center',
    padding: 0,
  },
  amountCurrency: {
    fontSize: 18,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
    marginLeft: 6,
    marginBottom: 6,
  },
  amountHelperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 6,
    marginBottom: 12,
  },
  amountAvailable: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
  },
  maxBadge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.greyBorderdark,
  },
  maxBadgeText: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.textPrimary,
  },
  toggleRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceBackground,
    borderRadius: 20,
    padding: 3,
    borderWidth: 1,
    borderColor: COLORS.greyBorder,
  },
  toggleOption: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 17,
  },
  toggleOptionActiveGreen: {
    backgroundColor: COLORS.brandPrimary,
  },
  toggleOptionActiveOrange: {
    backgroundColor: COLORS.btcOrange,
  },
  toggleText: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.textSecondary,
  },
  toggleTextActiveGreen: {
    color: COLORS.textPrimary,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    fontWeight: '700',
  },
  toggleTextActiveOrange: {
    color: COLORS.white,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.greyBorder,
    marginBottom: 20,
  },
  dividerThin: {
    height: 1,
    backgroundColor: COLORS.greyBorder,
    marginVertical: 6,
  },
  earnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 16,
    padding: 16,
    marginBottom: 28,
  },
  earnCardBtc: {
    backgroundColor: '#FFF3E0',
  },
  earnCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  earnCardContent: {
    flex: 1,
  },
  earnCardTitle: {
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  earnCardSubtitle: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  earnCardArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.greyBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  projections: {
    gap: 18,
  },
  projectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  projectionLabel: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
  },
  projectionValue: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.textPrimary,
  },
  projectionValueGreen: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.positiveGreen,
  },
  projectionValueOrange: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.btcOrange,
  },
  bottomArea: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
  },
  swipeButton: {
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeButtonText: {
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    fontWeight: '700',
    marginTop: -4,
  },
  fullOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 100,
  },
  overlayTop: {
    alignItems: 'center',
  },
  overlaySwipeText: {
    fontSize: 18,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    marginTop: 4,
  },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successContent: {
    alignItems: 'center',
  },
  coinIllustration: {
    width: 120,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  successTitle: {
    fontSize: 48,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 52,
  },
  successSubtitle: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamily,
    textAlign: 'center',
    marginTop: 16,
    opacity: 0.8,
  },
  successYield: {
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
    opacity: 0.9,
  },
  tapToContinue: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 50 : 30,
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    fontWeight: '700',
    textAlign: 'center',
  },
});
