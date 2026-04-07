import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppNavigation } from '@/shared/hooks/useAppNavigation';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';

type Tab = 'Cash' | 'Crypto';

export default function AddFundsScreen() {
  const navigation = useAppNavigation();
  const [activeTab, setActiveTab] = useState<Tab>('Crypto');

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Payment Method</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <Ionicons name="close" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {(['Cash', 'Crypto'] as Tab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
        <View style={styles.content}>
          {activeTab === 'Cash' ? (
            <TouchableOpacity style={styles.optionCard}>
              <View style={styles.optionIcon}>
                <Image
                  source={{ uri: 'https://cdn.worldvectorlogo.com/logos/coinbase-1.svg' }}
                  style={styles.coinbaseLogo}
                  defaultSource={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Coinbase_logo.svg/200px-Coinbase_logo.svg.png' }}
                />
              </View>
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>Coinbase</Text>
                <View style={styles.badgeRow}>
                  <View style={styles.badgeGreen}>
                    <Text style={styles.badgeGreenText}>No Fees</Text>
                  </View>
                </View>
              </View>
              <View style={styles.optionRight}>
                <Text style={styles.optionLimit}>No Limits</Text>
                <Text style={styles.optionLimitSub}>Unlimited Deposit</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={styles.optionCard}
                onPress={() => navigation.navigate('SelectNetwork' as never)}
              >
                <View style={styles.optionIcon}>
                  <View style={[styles.iconCircle, { backgroundColor: COLORS.surfaceBackground }]}>
                    <Ionicons name="download-outline" size={20} color={COLORS.textPrimary} />
                  </View>
                </View>
                <View style={styles.optionInfo}>
                  <Text style={styles.optionTitle}>Crypto Transfer</Text>
                  <View style={styles.badgeRow}>
                    <View style={styles.badgeGreen}>
                      <Text style={styles.badgeGreenText}>No KYC</Text>
                    </View>
                    <View style={styles.badgeGreen}>
                      <Text style={styles.badgeGreenText}>Instant</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.optionRight}>
                  <Text style={styles.optionLimit}>No Limits</Text>
                  <Text style={styles.optionLimitSub}>Unlimited Deposit</Text>
                </View>
              </TouchableOpacity>

              <View style={[styles.optionCard, { opacity: 0.5 }]}>
                <View style={styles.optionIcon}>
                  <View style={[styles.iconCircle, { backgroundColor: COLORS.surfaceBackground }]}>
                    <Ionicons name="link-outline" size={20} color={COLORS.textSecondary} />
                  </View>
                </View>
                <View style={styles.optionInfo}>
                  <Text style={[styles.optionTitle, { color: COLORS.textSecondary }]}>
                    WalletConnect
                  </Text>
                  <View style={styles.badgeRow}>
                    <View style={[styles.badgeGreen, { backgroundColor: '#F5F0E0' }]}>
                      <Text style={[styles.badgeGreenText, { color: '#9E8E60' }]}>
                        Coming Soon
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.optionRight}>
                  <Text style={[styles.optionLimit, { color: COLORS.textSecondary }]}>
                    No Limits
                  </Text>
                  <Text style={styles.optionLimitSub}>Unlimited Deposit</Text>
                </View>
              </View>
            </>
          )}
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
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 20,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tabActive: {
    backgroundColor: COLORS.surfaceBackground,
    borderWidth: 1,
    borderColor: COLORS.greyBorder,
  },
  tabText: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.textPrimary,
  },
  content: {
    paddingHorizontal: 20,
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 16,
    borderWidth: 0.5,
    borderColor: '#D1D5DB',
  },
  optionIcon: {
    marginRight: 12,
  },
  coinbaseLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    color: COLORS.white,
    fontSize: 18,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    fontWeight: '700',
  },
  optionInfo: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.textPrimary,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  badgeGreen: {
    backgroundColor: 'rgba(0, 255, 59, 0.10)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeGreenText: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: '#00CC30',
  },
  optionRight: {
    alignItems: 'flex-end',
  },
  optionLimit: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  optionLimitSub: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});
