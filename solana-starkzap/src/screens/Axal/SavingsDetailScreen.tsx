import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppNavigation } from '@/shared/hooks/useAppNavigation';
import { useSelector } from 'react-redux';
import { RootState } from '@/shared/state/store';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';

export default function SavingsDetailScreen() {
  const navigation = useAppNavigation();

  // Pull real balance from staking positions
  const stakingPositions = useSelector((state: RootState) => state.starknet.stakingPositions);
  const savingsBalance = stakingPositions.reduce(
    (sum, pos) => sum + parseFloat(pos.totalAmount || pos.stakedAmount || '0'),
    0
  );
  const hasIdleCash = savingsBalance <= 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Savings Account</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <Ionicons name="close" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Balance */}
          <Text style={styles.balanceLabel}>Savings Account Balance:</Text>
          <Text style={styles.balanceAmount}>
            ${savingsBalance.toFixed(2)} <Text style={styles.balanceCurrency}>USDC</Text>
          </Text>

          {/* Start Earning card (shown when idle cash / not invested) */}
          {hasIdleCash && (
            <TouchableOpacity
              style={styles.startEarningCard}
              onPress={() => navigation.navigate('Invest' as never)}
              activeOpacity={0.85}
            >
              <View style={styles.cardIconGreen}>
                <Ionicons name="cash-outline" size={24} color={COLORS.textPrimary} />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Start Earning!</Text>
                <Text style={styles.cardSubtitle}>
                  You have idle cash that's not invested in a position yet.
                </Text>
              </View>
              <View style={styles.arrowCircle}>
                <Ionicons name="arrow-forward" size={16} color={COLORS.textPrimary} />
              </View>
            </TouchableOpacity>
          )}

          {/* Earn more card */}
          <TouchableOpacity
            style={styles.earnCard}
            onPress={() => navigation.navigate('AddFunds' as never)}
            activeOpacity={0.85}
          >
            <View style={styles.cardIconGreen}>
              <Ionicons name="person-outline" size={24} color={COLORS.textPrimary} />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Earn more!</Text>
              <Text style={styles.cardSubtitle}>
                Add US$ 500 to earn US$ 18,2 in one year.
              </Text>
            </View>
            <View style={styles.arrowCircle}>
              <Ionicons name="arrow-forward" size={16} color={COLORS.textPrimary} />
            </View>
          </TouchableOpacity>

          {/* Withdraw option */}
          <TouchableOpacity
            style={styles.withdrawCard}
            onPress={() => navigation.navigate('Withdraw' as never)}
            activeOpacity={0.7}
          >
            <View style={styles.cardIconOutline}>
              <Ionicons name="exit-outline" size={22} color={COLORS.textPrimary} />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Withdraw to USDC</Text>
              <View style={styles.withdrawBadges}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>No Fee</Text>
                </View>
                <Text style={styles.withdrawTime}>30 seconds</Text>
              </View>
            </View>
            <Ionicons name="arrow-forward" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
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
    fontSize: 18,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  balanceLabel: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
  },
  balanceAmount: {
    fontSize: 40,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 4,
    marginBottom: 24,
  },
  balanceCurrency: {
    fontSize: 24,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.textSecondary,
  },
  startEarningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  earnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  withdrawCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.greyBorder,
  },
  cardIconGreen: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardIconOutline: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: COLORS.greyBorder,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  cardSubtitle: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  arrowCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.greyBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  withdrawBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  badge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: '#2E7D32',
  },
  withdrawTime: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
  },
});
