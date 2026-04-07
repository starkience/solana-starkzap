import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAppNavigation } from '@/shared/hooks/useAppNavigation';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';
import HamburgerMenu from '@/screens/Axal/HamburgerMenu';
import { useStarknetWallet } from '@/modules/starknet/hooks/useStarknetWallet';
import { useBaseWallet } from '@/modules/wallet-providers/hooks/useBaseWallet';
import { useSelector as useReduxSelector } from 'react-redux';
import { RootState } from '@/shared/state/store';
import { StakingPosition } from '@/shared/state/starknet/reducer';
import { TOKEN_LOGOS } from '@/assets/tokenLogos';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { getEVMUSDCBalance } from '@/modules/bridge/services/evmBalanceService';

type TimePeriod = '7D' | '30D' | '90D';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function DashboardScreen() {
  const navigation = useAppNavigation();
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('30D');

  // Ensure wallets are created/connected on dashboard load
  const { ensureWallet, starknetAddress, isLoading: isWalletLoading } = useStarknetWallet();
  const { ensureWallet: ensureBaseWallet, address: baseAddress } = useBaseWallet();
  useEffect(() => {
    ensureWallet();
    ensureBaseWallet();
  }, [ensureWallet, ensureBaseWallet]);

  // Real BTC staking positions from Redux
  const stakingPositions = useReduxSelector((state: RootState) => state.starknet.stakingPositions);

  // Fetch Arbitrum USDC balance (idle cash)
  const [idleCash, setIdleCash] = useState(0.0);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const fetchArbitrumBalance = useCallback(async () => {
    if (!baseAddress) return;
    setBalanceLoading(true);
    try {
      const balance = await getEVMUSDCBalance(baseAddress, 'arbitrum');
      setIdleCash(parseFloat(balance) || 0);
    } catch (err) {
      console.error('[Dashboard] Failed to fetch Arbitrum balance:', err);
    } finally {
      setBalanceLoading(false);
    }
  }, [baseAddress]);

  useEffect(() => {
    fetchArbitrumBalance();
    // Refresh balance every 30 seconds
    const interval = setInterval(fetchArbitrumBalance, 30000);
    return () => clearInterval(interval);
  }, [fetchArbitrumBalance]);

  // Compute real totals from staking positions
  const stakedTotal = stakingPositions.reduce(
    (sum, pos) => sum + parseFloat(pos.totalAmount || pos.stakedAmount || '0'),
    0
  );
  const savingsBalance = stakedTotal;
  const totalBalance = stakedTotal + idleCash;
  const hasDeposits = totalBalance > 0 || stakingPositions.length > 0;
  const isEarning = savingsBalance > 0;

  // Simple chart data (mock performance curve)
  const chartWidth = SCREEN_WIDTH - 40;
  const chartHeight = 120;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.accountLabel}>Axal Account</Text>
            <Text style={styles.balanceText}>
              ${totalBalance.toFixed(2)}{' '}
              <Text style={styles.balanceCurrency}>USD</Text>
            </Text>
            <Text style={styles.subBalance}>
              ▲ US$ 0,0000
              {hasDeposits && totalBalance > 0 && (
                <Text style={styles.bridgingText}>
                  {'  '}US$ {totalBalance.toFixed(2)} Earning
                </Text>
              )}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.menuButton}>
            <Ionicons name="menu" size={26} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Empty state / Chart area */}
          {!hasDeposits ? (
            <View style={styles.emptyState}>
              {/* Coins illustration using icons */}
              <View style={styles.illustrationContainer}>
                <View style={styles.coinStack}>
                  <View style={[styles.coinBase, { backgroundColor: '#C8E6C9' }]} />
                  <View style={[styles.coinMid, { backgroundColor: '#A5D6A7' }]} />
                  <View style={[styles.coinTop, { backgroundColor: '#81C784' }]} />
                </View>
                <Ionicons name="cash-outline" size={64} color="#81C784" style={styles.coinIcon} />
              </View>
              <Text style={styles.emptyTitle}>You have no deposits yet!</Text>
              <Text style={styles.emptySubtitle}>
                Click deposit below to put your money to work.
              </Text>
            </View>
          ) : (
            <View style={styles.chartArea}>
              {/* Performance chart */}
              <Svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
                <Defs>
                  <LinearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor={COLORS.brandPrimary} stopOpacity="0.15" />
                    <Stop offset="100%" stopColor={COLORS.brandPrimary} stopOpacity="0" />
                  </LinearGradient>
                </Defs>
                {/* Area fill */}
                <Path
                  d={`M0 ${chartHeight} L0 ${chartHeight * 0.9} Q${chartWidth * 0.15} ${chartHeight * 0.85} ${chartWidth * 0.3} ${chartHeight * 0.75} Q${chartWidth * 0.5} ${chartHeight * 0.6} ${chartWidth * 0.7} ${chartHeight * 0.4} Q${chartWidth * 0.85} ${chartHeight * 0.25} ${chartWidth} ${chartHeight * 0.1} L${chartWidth} ${chartHeight} Z`}
                  fill="url(#chartGrad)"
                />
                {/* Line */}
                <Path
                  d={`M0 ${chartHeight * 0.9} Q${chartWidth * 0.15} ${chartHeight * 0.85} ${chartWidth * 0.3} ${chartHeight * 0.75} Q${chartWidth * 0.5} ${chartHeight * 0.6} ${chartWidth * 0.7} ${chartHeight * 0.4} Q${chartWidth * 0.85} ${chartHeight * 0.25} ${chartWidth} ${chartHeight * 0.1}`}
                  stroke={COLORS.brandPrimary}
                  strokeWidth={2.5}
                  fill="none"
                />
              </Svg>

              {/* Period selector */}
              <View style={styles.periodRow}>
                {(['7D', '30D', '90D'] as TimePeriod[]).map((period) => (
                  <TouchableOpacity
                    key={period}
                    onPress={() => setSelectedPeriod(period)}
                    style={[
                      styles.periodButton,
                      selectedPeriod === period && styles.periodButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.periodText,
                        selectedPeriod === period && styles.periodTextActive,
                      ]}
                    >
                      {period}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Earn more / Start Earning card */}
          {!hasDeposits ? (
            <TouchableOpacity
              style={styles.earnCard}
              onPress={() => navigation.navigate('AddFunds' as never)}
              activeOpacity={0.85}
            >
              <View style={styles.earnCardIconWrap}>
                <Ionicons name="person-outline" size={22} color={COLORS.textPrimary} />
              </View>
              <View style={styles.earnCardContent}>
                <Text style={styles.earnCardTitle}>Earn more!</Text>
                <Text style={styles.earnCardSub}>
                  Add US$ 500 to earn US$ 18,2 in one year.
                </Text>
              </View>
              <View style={styles.earnCardArrow}>
                <Ionicons name="arrow-forward" size={16} color={COLORS.textPrimary} />
              </View>
            </TouchableOpacity>
          ) : idleCash > 0 ? (
            <TouchableOpacity
              style={styles.startEarningCard}
              onPress={() => navigation.navigate('Invest' as never)}
              activeOpacity={0.85}
            >
              <View style={styles.earnCardIconWrap}>
                <Ionicons name="cash-outline" size={22} color={COLORS.textPrimary} />
              </View>
              <View style={styles.earnCardContent}>
                <Text style={styles.earnCardTitle}>Start Earning!</Text>
                <Text style={styles.earnCardSub}>
                  You have idle cash that's not invested in a position yet.
                </Text>
              </View>
              <View style={styles.earnCardArrow}>
                <Ionicons name="arrow-forward" size={16} color={COLORS.textPrimary} />
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.earnCard}
              onPress={() => navigation.navigate('AddFunds' as never)}
              activeOpacity={0.85}
            >
              <View style={styles.earnCardIconWrap}>
                <Ionicons name="person-outline" size={22} color={COLORS.textPrimary} />
              </View>
              <View style={styles.earnCardContent}>
                <Text style={styles.earnCardTitle}>Earn more!</Text>
                <Text style={styles.earnCardSub}>
                  Add US$ 500 to earn US$ 18,2 in one year.
                </Text>
              </View>
              <View style={styles.earnCardArrow}>
                <Ionicons name="arrow-forward" size={16} color={COLORS.textPrimary} />
              </View>
            </TouchableOpacity>
          )}

          {/* Savings Account row */}
          <TouchableOpacity
            style={styles.accountRow}
            onPress={() => navigation.navigate('SavingsDetail' as never)}
            activeOpacity={0.7}
          >
            <View>
              <Text style={styles.rowTitle}>Savings Account</Text>
              {isEarning ? (
                <Text style={styles.rowSubEarning}>Earning 3.64%</Text>
              ) : (
                <Text style={styles.rowSub}>High Yield Account</Text>
              )}
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.rowAmount}>US$ {savingsBalance.toFixed(2)}</Text>
              <Ionicons name="chevron-forward" size={16} color="#BDBDBD" />
            </View>
          </TouchableOpacity>

          {/* Idle Cash row */}
          <TouchableOpacity style={styles.accountRow} activeOpacity={0.7}>
            <View>
              <Text style={styles.rowTitle}>Idle Cash</Text>
              <View style={styles.rowSubRow}>
                <Text style={styles.rowSub}>Cash Account Balance</Text>
                {hasDeposits && idleCash <= 0 && null}
                {hasDeposits && idleCash > 0 && (
                  <View style={styles.notEarningBadge}>
                    <View style={styles.notEarningDot} />
                    <Text style={styles.notEarningText}>Not Earning</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.rowAmount}>US$ {idleCash.toFixed(2)}</Text>
              <Ionicons name="chevron-forward" size={16} color="#BDBDBD" />
            </View>
          </TouchableOpacity>

          {/* Your Holdings section */}
          {stakingPositions.length > 0 && (
            <>
              <View style={styles.holdingsHeader}>
                <Text style={styles.holdingsTitle}>Your Holdings</Text>
                <TouchableOpacity style={styles.sortButton}>
                  <Ionicons name="swap-vertical" size={14} color={COLORS.textPrimary} />
                  <Text style={styles.sortText}>Sort</Text>
                </TouchableOpacity>
              </View>
              {stakingPositions.map((pos: StakingPosition, i: number) => (
                <View key={i} style={styles.holdingRow}>
                  <View style={styles.holdingIcon}>
                    <Image
                      source={{ uri: (TOKEN_LOGOS as any)[pos.tokenSymbol] || TOKEN_LOGOS.BTC }}
                      style={styles.holdingLogo}
                    />
                  </View>
                  <View style={styles.holdingInfo}>
                    <Text style={styles.holdingName}>
                      {pos.tokenSymbol} — {pos.validatorName}
                    </Text>
                    <Text style={styles.holdingSub}>{pos.validatorName}</Text>
                  </View>
                  <View style={styles.holdingRight}>
                    <Text style={styles.holdingAmount}>
                      US$ {parseFloat(pos.totalAmount || pos.stakedAmount || '0').toFixed(2)}
                    </Text>
                    <Text style={styles.holdingRewards}>
                      US$ {parseFloat(pos.rewardsAmount || '0').toFixed(4)}
                    </Text>
                  </View>
                </View>
              ))}
            </>
          )}

          <View style={{ height: 20 }} />
        </ScrollView>

        {/* Bottom buttons */}
        <View style={styles.bottomArea}>
          {hasDeposits ? (
            <View style={styles.bottomButtonRow}>
              <TouchableOpacity
                style={styles.addFundsButton}
                onPress={() => navigation.navigate('AddFunds' as never)}
                activeOpacity={0.8}
              >
                <Text style={styles.addFundsButtonText}>Add Funds</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.earnButton}
                onPress={() => navigation.navigate('Invest' as never)}
                activeOpacity={0.85}
              >
                <Text style={styles.earnButtonText}>Earn</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.getStartedButton}
              onPress={() => navigation.navigate('AddFunds' as never)}
              activeOpacity={0.85}
            >
              <Text style={styles.getStartedText}>Get Started</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <HamburgerMenu visible={menuVisible} onClose={() => setMenuVisible(false)} />
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
  },
  /* Header */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
  },
  accountLabel: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: '#9E9E9E',
  },
  balanceText: {
    fontSize: 34,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  balanceCurrency: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: '#9E9E9E',
  },
  subBalance: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.positiveGreen,
    marginTop: 2,
  },
  bridgingText: {
    color: COLORS.textSecondary,
  },
  menuButton: {
    padding: 4,
    marginTop: 4,
  },
  /* Scroll */
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  /* Empty state */
  emptyState: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  illustrationContainer: {
    width: 160,
    height: 130,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  coinStack: {
    position: 'absolute',
    bottom: 10,
    width: 120,
    height: 60,
    alignItems: 'center',
  },
  coinBase: {
    position: 'absolute',
    bottom: 0,
    width: 120,
    height: 24,
    borderRadius: 60,
  },
  coinMid: {
    position: 'absolute',
    bottom: 8,
    width: 100,
    height: 20,
    borderRadius: 50,
  },
  coinTop: {
    position: 'absolute',
    bottom: 16,
    width: 80,
    height: 18,
    borderRadius: 40,
  },
  coinIcon: {
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: '#9E9E9E',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 20,
  },
  /* Chart */
  chartArea: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  periodRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 8,
  },
  periodButton: {
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: 16,
  },
  periodButtonActive: {
    backgroundColor: COLORS.textPrimary,
  },
  periodText: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: '#9E9E9E',
  },
  periodTextActive: {
    color: '#FFFFFF',
  },
  /* Earn card */
  earnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  startEarningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  earnCardIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
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
  earnCardSub: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: '#757575',
    marginTop: 2,
    lineHeight: 18,
  },
  earnCardArrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  /* Account rows */
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  rowTitle: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.textPrimary,
  },
  rowSub: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: '#9E9E9E',
    marginTop: 2,
  },
  rowSubEarning: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.positiveGreen,
    marginTop: 2,
  },
  rowSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  notEarningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  notEarningDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.negativeRed,
  },
  notEarningText: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.negativeRed,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rowAmount: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textPrimary,
  },
  /* Holdings */
  holdingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 12,
  },
  holdingsTitle: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.greyBorder,
  },
  sortText: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.textPrimary,
  },
  holdingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  holdingIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  holdingLogo: {
    width: 32,
    height: 32,
    borderRadius: 10,
  },
  holdingInfo: {
    flex: 1,
  },
  holdingName: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.textPrimary,
  },
  holdingSub: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: '#9E9E9E',
    marginTop: 1,
  },
  holdingRight: {
    alignItems: 'flex-end',
  },
  holdingAmount: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.textPrimary,
  },
  holdingRewards: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.positiveGreen,
    marginTop: 1,
  },
  /* Bottom */
  bottomArea: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
  },
  getStartedButton: {
    height: 54,
    borderRadius: 9999,
    backgroundColor: COLORS.brandPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  getStartedText: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  bottomButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  addFundsButton: {
    flex: 1,
    height: 54,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: COLORS.textPrimary,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addFundsButtonText: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  earnButton: {
    flex: 1,
    height: 54,
    borderRadius: 9999,
    backgroundColor: COLORS.brandPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  earnButtonText: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
});
