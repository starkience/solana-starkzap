import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';
import {useBTCStaking} from '@/modules/starknet/hooks/useBTCStaking';
import {useBridge} from '@/modules/bridge/hooks/useBridge';
import {useDispatch} from 'react-redux';
import {addTransaction, updateTransaction} from '@/shared/state/history/reducer';

const BTC_LOGO =
  'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/bitcoin/info/logo.png';

type StakeFlowParams = {
  BTCStakeFlow: {
    poolAddress: string;
    validatorName: string;
    tokenSymbol: string;
    delegatedAmount: string;
  };
};

type Step = 'amount' | 'bridging' | 'staking' | 'complete';

export default function BTCStakeFlowScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<StakeFlowParams, 'BTCStakeFlow'>>();
  const {poolAddress, validatorName, tokenSymbol, delegatedAmount} =
    route.params;

  const dispatch = useDispatch();
  const {stake} = useBTCStaking();
  const {bridgeToStarknet, getQuote} = useBridge();

  const [amount, setAmount] = useState('');
  const [currentStep, setCurrentStep] = useState<Step>('amount');
  const [currentQuote, setCurrentQuote] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGetQuote = useCallback(async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount to stake.');
      return;
    }
    try {
      const quote = await getQuote('solana_to_starknet', amount);
      setCurrentQuote(quote);
    } catch (err: any) {
      setError(err.message || 'Failed to get quote');
    }
  }, [amount, getQuote]);

  const handleStake = useCallback(async () => {
    if (!currentQuote) {
      Alert.alert('No Quote', 'Please get a quote first.');
      return;
    }

    setError(null);
    const txId = `btc_stake_${Date.now()}`;

    try {
      // Step 1: Bridge from Solana to Starknet
      setCurrentStep('bridging');
      dispatch(addTransaction({
        id: txId,
        type: 'bridge',
        token: tokenSymbol,
        amount,
        txHash: '',
        status: 'pending',
        timestamp: new Date().toISOString(),
        protocol: 'LayerZero → Starkzap',
        subtitle: `Bridge ${tokenSymbol} to Starknet, then stake`,
        explorerUrl: undefined,
        starknetExplorerUrl: undefined,
      }));

      const bridgeResult = await bridgeToStarknet(currentQuote, null);
      const solanaTxHash = bridgeResult?.txHash || '';

      if (solanaTxHash) {
        dispatch(updateTransaction({
          id: txId,
          updates: {
            txHash: solanaTxHash,
            explorerUrl: `https://solscan.io/tx/${solanaTxHash}`,
          },
        }));
      }

      // Step 2: Stake on Starknet
      setCurrentStep('staking');
      dispatch(updateTransaction({
        id: txId,
        updates: { subtitle: `Staking ${amount} ${tokenSymbol} on Starknet...` },
      }));

      const stakeResult = await stake(poolAddress, amount, tokenSymbol);
      const starknetTxHash = stakeResult?.txHash || '';

      dispatch(updateTransaction({
        id: txId,
        updates: {
          type: 'stake',
          status: 'confirmed',
          subtitle: `${amount} ${tokenSymbol} staked via Starkzap`,
          ...(starknetTxHash ? {
            starknetExplorerUrl: `https://voyager.online/tx/${starknetTxHash}`,
          } : {}),
        },
      }));

      setCurrentStep('complete');
    } catch (err: any) {
      dispatch(updateTransaction({
        id: txId,
        updates: { status: 'failed' },
      }));
      setError(err.message || 'Staking failed');
      setCurrentStep('amount');
    }
  }, [currentQuote, amount, poolAddress, tokenSymbol, stake, bridgeToStarknet, dispatch]);

  const renderStep = () => {
    switch (currentStep) {
      case 'amount':
        return renderAmountStep();
      case 'bridging':
        return renderProgressStep(
          'Bridging to Starknet',
          'Transferring LBTC from Solana to Starknet via LayerZero...',
          1,
        );
      case 'staking':
        return renderProgressStep(
          'Staking on Starknet',
          `Staking ${amount} ${tokenSymbol} in ${validatorName} pool...`,
          2,
        );
      case 'complete':
        return renderCompleteStep();
    }
  };

  const renderAmountStep = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.stepContainer}>
      <View style={styles.poolInfo}>
        <Image source={{uri: BTC_LOGO}} style={styles.poolInfoIcon} />
        <View>
          <Text style={styles.poolInfoName}>{tokenSymbol} Pool</Text>
          <Text style={styles.poolInfoValidator}>{validatorName}</Text>
        </View>
      </View>

      <Text style={styles.inputLabel}>Amount to Stake</Text>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="0.00"
          placeholderTextColor={COLORS.textLight}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={text => {
            setAmount(text);
            setCurrentQuote(null);
          }}
          autoFocus
        />
        <Text style={styles.inputSuffix}>{tokenSymbol}</Text>
      </View>

      <View style={styles.feeSummary}>
        <View style={styles.feeRow}>
          <Text style={styles.feeLabel}>Pool Delegated</Text>
          <Text style={styles.feeValue}>{delegatedAmount}</Text>
        </View>
        <View style={styles.feeRow}>
          <Text style={styles.feeLabel}>Bridge Fee (est.)</Text>
          <Text style={styles.feeValue}>
            {currentQuote ? `$${currentQuote.bridgeFeeUsd}` : '—'}
          </Text>
        </View>
        {currentQuote && (
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>You Receive (min)</Text>
            <Text style={styles.feeValue}>{currentQuote.minOutput} LBTC</Text>
          </View>
        )}
        {currentQuote && (
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Route</Text>
            <Text style={styles.feeValue}>{currentQuote.routeType}</Text>
          </View>
        )}
        <View style={styles.feeRow}>
          <Text style={styles.feeLabel}>Network</Text>
          <Text style={styles.feeValue}>Solana → Starknet</Text>
        </View>
      </View>

      {!currentQuote && amount ? (
        <TouchableOpacity
          style={styles.quoteButton}
          onPress={handleGetQuote}>
          <Text style={styles.quoteButtonText}>Get Quote</Text>
        </TouchableOpacity>
      ) : null}

      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color={COLORS.errorRed} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            !currentQuote && styles.primaryButtonDisabled,
          ]}
          disabled={!currentQuote}
          onPress={handleStake}>
          <Text style={styles.primaryButtonText}>
            Bridge & Stake {tokenSymbol}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );

  const renderProgressStep = (
    title: string,
    subtitle: string,
    step: number,
  ) => (
    <View style={styles.progressContainer}>
      <View style={styles.stepsIndicator}>
        {[1, 2].map(s => (
          <View
            key={s}
            style={[
              styles.stepDot,
              s <= step && styles.stepDotActive,
              s < step && styles.stepDotComplete,
            ]}>
            {s < step ? (
              <Ionicons name="checkmark" size={14} color={COLORS.white} />
            ) : (
              <Text
                style={[
                  styles.stepDotText,
                  s <= step && styles.stepDotTextActive,
                ]}>
                {s}
              </Text>
            )}
          </View>
        ))}
      </View>

      <ActivityIndicator
        size="large"
        color={COLORS.brandPrimary}
        style={{marginBottom: 24}}
      />
      <Text style={styles.progressTitle}>{title}</Text>
      <Text style={styles.progressSubtitle}>{subtitle}</Text>
    </View>
  );

  const renderCompleteStep = () => (
    <View style={styles.progressContainer}>
      <View style={styles.successIcon}>
        <Ionicons name="checkmark-circle" size={64} color={COLORS.positiveGreen} />
      </View>
      <Text style={styles.progressTitle}>Staking Complete!</Text>
      <Text style={styles.progressSubtitle}>
        You staked {amount} {tokenSymbol} in the {validatorName} pool.{'\n'}
        Rewards will start accruing immediately.
      </Text>

      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.goBack()}>
          <Text style={styles.primaryButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            disabled={currentStep === 'bridging' || currentStep === 'staking'}>
            <Ionicons
              name="arrow-back"
              size={20}
              color={
                currentStep === 'bridging' || currentStep === 'staking'
                  ? COLORS.textLight
                  : COLORS.textPrimary
              }
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Stake {tokenSymbol}</Text>
          <View style={{width: 36}} />
        </View>

        {renderStep()}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  safeArea: {flex: 1},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.secondaryBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: COLORS.textPrimary,
  },
  stepContainer: {flex: 1, paddingHorizontal: 16},
  poolInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    marginBottom: 24,
  },
  poolInfoIcon: {width: 44, height: 44, borderRadius: 22},
  poolInfoName: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: COLORS.textPrimary,
  },
  poolInfoValidator: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.greyBorder,
  },
  input: {
    flex: 1,
    fontSize: 28,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: COLORS.textPrimary,
    paddingVertical: 12,
  },
  inputSuffix: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: COLORS.textSecondary,
    marginLeft: 8,
  },
  feeSummary: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feeLabel: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
  },
  feeValue: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.textPrimary,
  },
  quoteButton: {
    backgroundColor: COLORS.secondaryBackground,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    marginBottom: 16,
  },
  quoteButtonText: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.textPrimary,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: COLORS.errorRed + '10',
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.errorRed,
    flex: 1,
  },
  bottomActions: {
    marginTop: 'auto',
    paddingBottom: 16,
  },
  primaryButton: {
    backgroundColor: COLORS.brandPrimary,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
  },
  progressContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  stepsIndicator: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 40,
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.greyBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotActive: {
    borderColor: COLORS.brandPrimary,
  },
  stepDotComplete: {
    backgroundColor: COLORS.positiveGreen,
    borderColor: COLORS.positiveGreen,
  },
  stepDotText: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: COLORS.textSecondary,
  },
  stepDotTextActive: {
    color: COLORS.brandPrimary,
  },
  progressTitle: {
    fontSize: 20,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  progressSubtitle: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  successIcon: {
    marginBottom: 24,
  },
});
