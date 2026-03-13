import React, {useState, useCallback, useMemo, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  Linking,
  ScrollView,
} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import BottomSheet from './BottomSheet';
import COLORS from '../../assets/colors';
import TYPOGRAPHY from '../../assets/typography';
import TransactionLifecycle from '../TransactionLifecycle';
import type {LifecycleStep} from '../../shared/state/history/reducer';

const {height: SCREEN_HEIGHT} = Dimensions.get('window');

export interface DepositTokenOption {
  symbol: string;
  logoUrl?: string;
  localIcon?: any;
}

export interface StakePoolInfo {
  name: string;
  token: string;
  tokenLogoUrl?: string;
  localTokenIcon?: any;
  apy: number;
  tvl: string;
  tvlToken?: string;
  deposited: string;
  depositedUsd: string;
  earnings: string;
  earningsUsd?: string;
  minStake: string;
  subtitle?: string;
}

interface StakeDepositSheetProps {
  visible: boolean;
  onClose: () => void;
  pool: StakePoolInfo;
  userBalance: string;
  onStake: (amount: string) => Promise<string>;
  onUnstake?: (amount: string) => Promise<string>;
  lifecycleSteps?: LifecycleStep[];
  starknetAddress?: string | null;
  depositTokenOptions?: DepositTokenOption[];
  onDepositTokenChange?: (symbol: string) => void;
}

type Tab = 'deposit' | 'withdraw';
type TxStatus = 'idle' | 'loading' | 'success' | 'error';

const StakeDepositSheet: React.FC<StakeDepositSheetProps> = ({
  visible,
  onClose,
  pool,
  userBalance,
  onStake,
  onUnstake,
  lifecycleSteps,
  starknetAddress,
  depositTokenOptions,
  onDepositTokenChange,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('deposit');
  const [amount, setAmount] = useState('');
  const [txStatus, setTxStatus] = useState<TxStatus>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [depositedAmount, setDepositedAmount] = useState(pool.deposited);
  const [depositedUsd, setDepositedUsd] = useState(pool.depositedUsd);
  const [selectedDepositToken, setSelectedDepositToken] = useState<string>(
    depositTokenOptions?.[0]?.symbol || pool.token,
  );

  useEffect(() => {
    setDepositedAmount(pool.deposited);
    setDepositedUsd(pool.depositedUsd);
  }, [pool.deposited, pool.depositedUsd]);

  useEffect(() => {
    if (depositTokenOptions?.length) {
      setSelectedDepositToken(depositTokenOptions[0].symbol);
    }
  }, [depositTokenOptions]);

  const balanceNum = parseFloat(userBalance) || 0;
  const depositedNum = parseFloat(depositedAmount) || 0;
  const effectiveBalance = activeTab === 'withdraw' ? depositedNum : balanceNum;
  const amountNum = parseFloat(amount) || 0;
  const amountUsd = useMemo(() => {
    if (!amountNum) return '$0.00';
    return `$${amountNum.toFixed(2)}`;
  }, [amountNum]);

  const handleNumpadPress = useCallback(
    (key: string) => {
      if (txStatus === 'loading') return;
      if (txStatus === 'success' || txStatus === 'error') {
        setTxStatus('idle');
        setTxHash(null);
        setTxError(null);
        setAmount('');
      }

      if (key === 'clear') {
        setAmount('');
        return;
      }
      if (key === 'backspace') {
        setAmount(prev => prev.slice(0, -1));
        return;
      }
      if (key === ',') {
        if (amount.includes('.')) return;
        setAmount(prev => (prev === '' ? '0.' : prev + '.'));
        return;
      }
      if (key === 'max') {
        setAmount(effectiveBalance.toString());
        return;
      }
      if (key === '75') {
        setAmount((effectiveBalance * 0.75).toFixed(6).replace(/\.?0+$/, ''));
        return;
      }
      if (key === '50') {
        setAmount((effectiveBalance * 0.5).toFixed(6).replace(/\.?0+$/, ''));
        return;
      }
      setAmount(prev => prev + key);
    },
    [amount, effectiveBalance, txStatus],
  );

  const handleSubmit = useCallback(async () => {
    if (!amountNum || amountNum <= 0) return;

    setTxStatus('loading');
    setTxError(null);
    setTxHash(null);

    try {
      const handler = activeTab === 'deposit' ? onStake : onUnstake;
      if (!handler) throw new Error('Withdraw is not yet available for this pool');
      const hash = await handler(amount);
      setTxHash(hash);
      setTxStatus('success');

      if (activeTab === 'deposit') {
        const prevDeposited = parseFloat(depositedAmount) || 0;
        const newDeposited = prevDeposited + amountNum;
        setDepositedAmount(newDeposited.toFixed(6).replace(/\.?0+$/, ''));
        setDepositedUsd(`$${newDeposited.toFixed(2)}`);
      } else {
        const prevDeposited = parseFloat(depositedAmount) || 0;
        const newDeposited = Math.max(0, prevDeposited - amountNum);
        setDepositedAmount(newDeposited > 0 ? newDeposited.toFixed(6).replace(/\.?0+$/, '') : '0');
        setDepositedUsd(`$${newDeposited.toFixed(2)}`);
      }
    } catch (err: any) {
      setTxError(err.message || 'Transaction failed');
      setTxStatus('error');
    }
  }, [amount, amountNum, activeTab, onStake, onUnstake, depositedAmount]);

  const openExplorer = useCallback(() => {
    if (txHash) {
      Linking.openURL(`https://solscan.io/tx/${txHash}`);
    }
  }, [txHash]);

  const handleClose = useCallback(() => {
    setAmount('');
    setTxStatus('idle');
    setTxHash(null);
    setTxError(null);
    setActiveTab('deposit');
    onClose();
  }, [onClose]);

  const buttonLabel = useMemo(() => {
    if (txStatus === 'loading') return 'Processing...';
    if (txStatus === 'success') return 'Done';
    if (txStatus === 'error') return 'Try again';
    if (!amount || amountNum <= 0) return 'Enter amount';
    return activeTab === 'deposit' ? 'Deposit' : 'Withdraw';
  }, [txStatus, amount, amountNum, activeTab]);

  const isButtonDisabled = txStatus === 'loading' || (txStatus === 'idle' && (!amount || amountNum <= 0 || amountNum > effectiveBalance));

  const renderNumpad = () => (
    <View style={styles.numpad}>
      <View style={styles.numpadRow}>
        <TouchableOpacity
          style={styles.numpadPercentKey}
          onPress={() => handleNumpadPress('max')}>
          <Text style={styles.numpadPercentText}>MAX</Text>
        </TouchableOpacity>
        {['1', '2', '3'].map(k => (
          <TouchableOpacity
            key={k}
            style={styles.numpadKey}
            onPress={() => handleNumpadPress(k)}>
            <Text style={styles.numpadKeyText}>{k}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.numpadRow}>
        <TouchableOpacity
          style={styles.numpadPercentKey}
          onPress={() => handleNumpadPress('75')}>
          <Text style={styles.numpadPercentText}>75%</Text>
        </TouchableOpacity>
        {['4', '5', '6'].map(k => (
          <TouchableOpacity
            key={k}
            style={styles.numpadKey}
            onPress={() => handleNumpadPress(k)}>
            <Text style={styles.numpadKeyText}>{k}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.numpadRow}>
        <TouchableOpacity
          style={styles.numpadPercentKey}
          onPress={() => handleNumpadPress('50')}>
          <Text style={styles.numpadPercentText}>50%</Text>
        </TouchableOpacity>
        {['7', '8', '9'].map(k => (
          <TouchableOpacity
            key={k}
            style={styles.numpadKey}
            onPress={() => handleNumpadPress(k)}>
            <Text style={styles.numpadKeyText}>{k}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.numpadRow}>
        <TouchableOpacity
          style={styles.numpadPercentKey}
          onPress={() => handleNumpadPress('clear')}>
          <Text style={styles.numpadPercentText}>CLEAR</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.numpadKey}
          onPress={() => handleNumpadPress(',')}>
          <Text style={styles.numpadKeyText}>,</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.numpadKey}
          onPress={() => handleNumpadPress('0')}>
          <Text style={styles.numpadKeyText}>0</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.numpadKey}
          onPress={() => handleNumpadPress('backspace')}>
          <Ionicons name="backspace-outline" size={22} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      height={SCREEN_HEIGHT * 0.92}>
      <View style={styles.container}>
        {/* Title row */}
        <View style={styles.titleRow}>
          <Text style={styles.titleEarn}>Earn with</Text>
          {(pool.localTokenIcon || pool.tokenLogoUrl) && (
            <Image
              source={pool.localTokenIcon || {uri: pool.tokenLogoUrl}}
              style={styles.titleIcon}
            />
          )}
          <Text style={styles.titleToken}>{pool.token}</Text>
        </View>
        {pool.subtitle && (
          <Text style={styles.poolSubtitle}>{pool.subtitle}</Text>
        )}

        {/* Deposited / Earnings */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Deposited</Text>
            <Text style={styles.statValue}>
              {depositedAmount} {pool.token}
            </Text>
            <Text style={styles.statSub}>{depositedUsd}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Earnings</Text>
            <Text style={[styles.statValue, txStatus === 'success' ? {color: COLORS.positiveGreen} : {}]}>
              {txStatus === 'success'
                ? `+0 ${pool.token}`
                : pool.earnings}
            </Text>
            <Text style={[styles.statSub, txStatus === 'success' ? {color: COLORS.positiveGreen} : {}]}>
              {txStatus === 'success' ? '$0.00' : '-'}
            </Text>
          </View>
        </View>

        {/* APR / TVL */}
        <View style={styles.aprRow}>
          <View style={styles.aprItem}>
            <Text style={styles.aprLabel}>Total APR</Text>
            <Text style={styles.aprValue}>{pool.apy.toFixed(2)}%</Text>
          </View>
          <View style={styles.aprItem}>
            <Text style={[styles.aprLabel, {textAlign: 'right'}]}>
              Vault TVL
            </Text>
            <Text style={[styles.aprValue, {textAlign: 'right'}]}>
              {pool.tvl}
            </Text>
            {pool.tvlToken && (
              <Text style={[styles.aprSub, {textAlign: 'right'}]}>
                {pool.tvlToken}
              </Text>
            )}
          </View>
        </View>

        {/* Deposit / Withdraw tabs */}
        <View style={styles.tabRow}>
          <TouchableOpacity onPress={() => setActiveTab('deposit')}>
            <Text
              style={[
                styles.tabText,
                activeTab === 'deposit' && styles.tabTextActive,
              ]}>
              Deposit
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveTab('withdraw')}>
            <Text
              style={[
                styles.tabText,
                activeTab === 'withdraw' && styles.tabTextActive,
              ]}>
              Withdraw
            </Text>
          </TouchableOpacity>
        </View>

        {/* Deposit token selector */}
        {depositTokenOptions && depositTokenOptions.length > 1 && activeTab === 'deposit' && (
          <View style={styles.tokenSelectorRow}>
            <Text style={styles.tokenSelectorLabel}>Deposit with</Text>
            <View style={styles.tokenPills}>
              {depositTokenOptions.map(opt => {
                const isActive = selectedDepositToken === opt.symbol;
                return (
                  <TouchableOpacity
                    key={opt.symbol}
                    style={[styles.tokenPill, isActive && styles.tokenPillActive]}
                    onPress={() => {
                      setSelectedDepositToken(opt.symbol);
                      setAmount('');
                      onDepositTokenChange?.(opt.symbol);
                    }}
                    activeOpacity={0.7}>
                    {(opt.localIcon || opt.logoUrl) && (
                      <Image
                        source={opt.localIcon || {uri: opt.logoUrl}}
                        style={styles.tokenPillIcon}
                      />
                    )}
                    <Text style={[styles.tokenPillText, isActive && styles.tokenPillTextActive]}>
                      {opt.symbol}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Conversion info for cross-token deposits */}
        {selectedDepositToken !== pool.token && activeTab === 'deposit' && (
          <View style={styles.conversionBanner}>
            <Ionicons name="swap-horizontal" size={14} color="#6C5CE7" />
            <Text style={styles.conversionText}>
              Your {selectedDepositToken} will be bridged and swapped to {pool.token} via AVNU
            </Text>
          </View>
        )}

        {/* Input field */}
        <View style={styles.inputBox}>
          <View>
            <Text style={styles.inputLabel}>
              {activeTab === 'deposit' ? 'You deposit' : 'You withdraw'}
            </Text>
            <View style={styles.balanceRow}>
              <Ionicons name="wallet-outline" size={13} color="#64748B" />
              <Text style={styles.balanceText}>
                {activeTab === 'withdraw' ? `${depositedAmount} ${pool.token}` : `${userBalance} ${selectedDepositToken}`}
              </Text>
            </View>
          </View>
          <View style={styles.inputRight}>
            <Text style={styles.inputAmount}>{amount || '0'}</Text>
            <Text style={styles.inputUsd}>{amountUsd}</Text>
          </View>
        </View>

        {/* Error banner (no lifecycle) */}
        {txStatus === 'error' && txError && (!lifecycleSteps || lifecycleSteps.length === 0) && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={16} color={COLORS.errorRed} />
            <Text style={styles.errorText}>{txError}</Text>
          </View>
        )}

        {/* Success banner (no lifecycle) */}
        {txStatus === 'success' && txHash && (!lifecycleSteps || lifecycleSteps.length === 0) && (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={16} color={COLORS.positiveGreen} />
            <Text style={styles.successText}>
              {activeTab === 'withdraw' ? 'Withdrawal confirmed!' : 'Deposit confirmed!'}
            </Text>
            <TouchableOpacity onPress={openExplorer}>
              <Text style={styles.solscanLink}>View on Solscan</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Transaction lifecycle for multi-step flows */}
        {lifecycleSteps && lifecycleSteps.length > 0 && (txStatus === 'loading' || txStatus === 'success' || txStatus === 'error') && (
          <ScrollView style={styles.lifecycleScroll} showsVerticalScrollIndicator={false}>
            <TransactionLifecycle steps={lifecycleSteps} starknetAddress={starknetAddress} />
          </ScrollView>
        )}

        {/* Spacer pushes button and numpad to bottom (only when no lifecycle visible) */}
        {!(lifecycleSteps && lifecycleSteps.length > 0 && (txStatus === 'loading' || txStatus === 'success' || txStatus === 'error')) && (
          <View style={{flex: 1}} />
        )}

        {/* Action button */}
        <TouchableOpacity
          style={[
            styles.actionButton,
            isButtonDisabled && styles.actionButtonDisabled,
          ]}
          disabled={isButtonDisabled}
          onPress={txStatus === 'success' ? handleClose : handleSubmit}>
          {txStatus === 'loading' && (!lifecycleSteps || lifecycleSteps.length === 0) ? (
            <View style={styles.actionButtonContent}>
              <ActivityIndicator size="small" color={COLORS.white} />
              <Text style={styles.actionButtonText}>{buttonLabel}</Text>
            </View>
          ) : (
            <Text style={styles.actionButtonText}>{buttonLabel}</Text>
          )}
        </TouchableOpacity>

        {/* Numpad — hidden during processing and after success */}
        {txStatus !== 'loading' && txStatus !== 'success' && renderNumpad()}
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  titleEarn: {
    fontSize: 20,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: COLORS.textPrimary,
  },
  titleIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  titleToken: {
    fontSize: 20,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: COLORS.textPrimary,
  },
  poolSubtitle: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary || '#888',
    marginTop: 4,
    marginBottom: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.secondaryBackground,
    borderRadius: 12,
    padding: 14,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: COLORS.textPrimary,
  },
  statSub: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  aprRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.secondaryBackground,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  aprItem: {},
  aprLabel: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.positiveGreen,
    marginBottom: 4,
  },
  aprValue: {
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: COLORS.positiveGreen,
  },
  aprSub: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  tokenSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  tokenSelectorLabel: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.textSecondary,
  },
  tokenPills: {
    flexDirection: 'row',
    gap: 8,
  },
  tokenPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: COLORS.secondaryBackground,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  tokenPillActive: {
    borderColor: COLORS.brandPrimary,
    backgroundColor: COLORS.brandPrimary + '10',
  },
  tokenPillIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  tokenPillText: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.textSecondary,
  },
  tokenPillTextActive: {
    color: COLORS.brandPrimary,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
  },
  conversionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#6C5CE7' + '0A',
    marginBottom: 10,
  },
  conversionText: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: '#6C5CE7',
    flex: 1,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 12,
  },
  tabText: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: COLORS.textPrimary,
  },
  inputBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.secondaryBackground,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  balanceText: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
  },
  inputRight: {
    alignItems: 'flex-end',
  },
  inputAmount: {
    fontSize: 28,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: COLORS.textPrimary,
  },
  inputUsd: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: COLORS.errorRed + '10',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.errorRed,
    flex: 1,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: COLORS.positiveGreen + '10',
    marginBottom: 8,
  },
  successText: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.positiveGreen,
    flex: 1,
  },
  solscanLink: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: COLORS.brandPrimary,
    textDecorationLine: 'underline',
  },
  lifecycleScroll: {
    flex: 1,
    marginBottom: 12,
  },
  actionButton: {
    backgroundColor: COLORS.brandPrimary,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: COLORS.white,
  },
  numpad: {
    gap: 4,
  },
  numpadRow: {
    flexDirection: 'row',
    gap: 4,
  },
  numpadKey: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 10,
  },
  numpadKeyText: {
    fontSize: 24,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: COLORS.textPrimary,
  },
  numpadPercentKey: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  numpadPercentText: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: COLORS.brandPrimary,
  },
});

export default StakeDepositSheet;
