import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppNavigation } from '@/shared/hooks/useAppNavigation';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';

export default function WithdrawScreen() {
  const navigation = useAppNavigation();
  const [amount, setAmount] = useState('0');

  // Mock
  const availableBalance = 0.00;

  const handleMax = () => {
    setAmount(availableBalance.toFixed(2));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Withdraw USDC</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <Ionicons name="close" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Amount input */}
          <View style={styles.amountContainer}>
            <View style={styles.amountRow}>
              <Text style={styles.dollarSign}>$</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={COLORS.textSecondary}
              />
              <Text style={styles.amountCurrency}>USDC</Text>
            </View>
            <TouchableOpacity style={styles.maxButton} onPress={handleMax}>
              <Text style={styles.maxButtonText}>Max</Text>
            </TouchableOpacity>
          </View>

          {/* Available balance */}
          <View style={styles.balanceRow}>
            <Text style={styles.balanceLabel}>Available Invested{'\n'}Balance:</Text>
            <Text style={styles.balanceValue}>${availableBalance.toFixed(2)}  USDC</Text>
          </View>
        </View>

        {/* Bottom info + button */}
        <View style={styles.bottomSection}>
          <View style={styles.infoCard}>
            <View style={styles.infoLeft}>
              <Ionicons name="exit-outline" size={20} color={COLORS.textPrimary} />
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>To:</Text>
                <Text style={styles.infoValue}>Cash Account</Text>
              </View>
            </View>
            <View style={styles.infoRight}>
              <Text style={styles.infoLabel}>Time to process:</Text>
              <View style={styles.timeRow}>
                <Ionicons name="time-outline" size={14} color={COLORS.textPrimary} />
                <Text style={styles.infoValueBold}>30 Seconds</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.continueButton}>
            <Text style={styles.continueButtonText}>Continue</Text>
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
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
    alignItems: 'center',
  },
  amountContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  dollarSign: {
    fontSize: 32,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
    marginRight: 4,
  },
  amountInput: {
    fontSize: 64,
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
    marginLeft: 8,
    marginBottom: 8,
  },
  maxButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.greyBorderdark,
    marginTop: 12,
  },
  maxButtonText: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.textPrimary,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
  },
  balanceValue: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  bottomSection: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  infoCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceBackground,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoText: {},
  infoLabel: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.textPrimary,
  },
  infoRight: {
    alignItems: 'flex-end',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  infoValueBold: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  continueButton: {
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.brandPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueButtonText: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
});
