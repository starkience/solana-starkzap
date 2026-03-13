import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {RootStackParamList} from '@/shared/navigation/RootNavigator';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';
import {useBTCStaking, BTCPool} from '@/modules/starknet/hooks/useBTCStaking';
import {useStarknetWallet} from '@/modules/starknet/hooks/useStarknetWallet';

const BTC_LOGO =
  'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/bitcoin/info/logo.png';

type NavProp = StackNavigationProp<RootStackParamList>;

export default function BTCStakingScreen() {
  const navigation = useNavigation<NavProp>();
  const {starknetAddress, ensureWallet, isLoading: isWalletLoading} =
    useStarknetWallet();
  const {
    availablePools,
    isLoadingPools,
    positions,
    isStakingLoading,
    fetchPools,
    refreshPositions,
  } = useBTCStaking();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    (async () => {
      await ensureWallet();
      await fetchPools();
    })();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPools();
    await refreshPositions();
    setRefreshing(false);
  };

  const activePositions = positions.filter(p => p.status === 'active');
  const pendingPositions = positions.filter(p => p.status !== 'active');

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>BTC Staking</Text>
          <View style={{width: 36}} />
        </View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }>
          {/* Info Banner */}
          <View style={styles.infoBanner}>
            <View style={styles.infoBannerIcon}>
              <Image
                source={{uri: BTC_LOGO}}
                style={{width: 32, height: 32, borderRadius: 16}}
              />
            </View>
            <View style={styles.infoBannerText}>
              <Text style={styles.infoBannerTitle}>
                Earn STRK by staking BTC
              </Text>
              <Text style={styles.infoBannerSubtitle}>
                Stake tokenized BTC (LBTC) on Starknet and earn rewards while
                supporting network security
              </Text>
            </View>
          </View>

          {/* Starknet Wallet Status */}
          {isWalletLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={COLORS.brandPrimary} />
              <Text style={styles.loadingText}>
                Setting up Starknet wallet...
              </Text>
            </View>
          ) : starknetAddress ? (
            <View style={styles.walletBadge}>
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={COLORS.positiveGreen}
              />
              <Text style={styles.walletBadgeText}>
                Starknet wallet ready
              </Text>
            </View>
          ) : null}

          {/* Active Positions */}
          {activePositions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Positions</Text>
              {activePositions.map(pos => (
                <TouchableOpacity
                  key={pos.poolAddress}
                  style={styles.positionCard}
                  activeOpacity={0.7}
                  onPress={() =>
                    navigation.navigate('BTCStakingPosition' as any, {
                      poolAddress: pos.poolAddress,
                      validatorName: pos.validatorName,
                      tokenSymbol: pos.tokenSymbol,
                    })
                  }>
                  <View style={styles.positionHeader}>
                    <Image
                      source={{uri: BTC_LOGO}}
                      style={styles.positionIcon}
                    />
                    <View>
                      <Text style={styles.positionName}>
                        {pos.tokenSymbol} Staking
                      </Text>
                      <Text style={styles.positionValidator}>
                        {pos.validatorName}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.positionStats}>
                    <View style={styles.positionStat}>
                      <Text style={styles.positionStatLabel}>Staked</Text>
                      <Text style={styles.positionStatValue}>
                        {pos.stakedAmount}
                      </Text>
                    </View>
                    <View style={styles.positionStat}>
                      <Text style={styles.positionStatLabel}>Rewards</Text>
                      <Text
                        style={[
                          styles.positionStatValue,
                          {color: COLORS.positiveGreen},
                        ]}>
                        {pos.rewardsAmount}
                      </Text>
                    </View>
                    <View style={styles.positionStat}>
                      <Text style={styles.positionStatLabel}>Commission</Text>
                      <Text style={styles.positionStatValue}>
                        {pos.commissionPercent}%
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Pending Unstakes */}
          {pendingPositions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Pending Unstakes</Text>
              {pendingPositions.map(pos => (
                <TouchableOpacity
                  key={pos.poolAddress}
                  style={[styles.positionCard, styles.pendingCard]}
                  activeOpacity={0.7}
                  onPress={() =>
                    navigation.navigate('BTCStakingPosition' as any, {
                      poolAddress: pos.poolAddress,
                      validatorName: pos.validatorName,
                      tokenSymbol: pos.tokenSymbol,
                    })
                  }>
                  <View style={styles.positionHeader}>
                    <Image
                      source={{uri: BTC_LOGO}}
                      style={styles.positionIcon}
                    />
                    <View>
                      <Text style={styles.positionName}>
                        {pos.tokenSymbol} — Unstaking
                      </Text>
                      <Text style={styles.positionValidator}>
                        {pos.status === 'ready_to_withdraw'
                          ? 'Ready to withdraw'
                          : `Cooldown until ${
                              pos.unpoolTime
                                ? new Date(pos.unpoolTime).toLocaleDateString()
                                : 'TBD'
                            }`}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.unpoolingAmount}>
                    {pos.unpoolingAmount}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Available Pools */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Available Pools</Text>
            {isLoadingPools || isStakingLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={COLORS.brandPrimary} />
                <Text style={styles.loadingText}>Loading pools...</Text>
              </View>
            ) : availablePools.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons
                  name="layers-outline"
                  size={48}
                  color={COLORS.textSecondary}
                />
                <Text style={styles.emptyStateText}>
                  No BTC staking pools found
                </Text>
                <Text style={styles.emptyStateSubtext}>
                  Pull down to refresh
                </Text>
              </View>
            ) : (
              availablePools.map((pool: BTCPool) => (
                <TouchableOpacity
                  key={`${pool.validatorName}-${pool.tokenSymbol}`}
                  style={styles.poolCard}
                  activeOpacity={0.7}
                  onPress={() =>
                    navigation.navigate('BTCStakeFlow' as any, {
                      poolAddress: pool.poolContract,
                      validatorName: pool.validatorName,
                      tokenSymbol: pool.tokenSymbol,
                      delegatedAmount: pool.delegatedAmount,
                    })
                  }>
                  <View style={styles.poolHeader}>
                    <View style={styles.poolNameRow}>
                      <Image
                        source={{uri: BTC_LOGO}}
                        style={styles.poolIcon}
                      />
                      <View>
                        <Text style={styles.poolName}>
                          {pool.tokenSymbol} Pool
                        </Text>
                        <Text style={styles.poolValidator}>
                          {pool.validatorName}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.tokenBadge}>
                      <Text style={styles.tokenBadgeText}>
                        {pool.tokenSymbol}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.poolStats}>
                    <View style={styles.poolStat}>
                      <Text style={styles.poolStatLabel}>Total Delegated</Text>
                      <Text style={styles.poolStatValue}>
                        {pool.delegatedAmount}
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.stakeButton}>
                      <Text style={styles.stakeButtonText}>Stake</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>

          <View style={{height: 40}} />
        </ScrollView>
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
  content: {flex: 1},
  infoBanner: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA7420',
  },
  infoBannerIcon: {marginRight: 12, marginTop: 2},
  infoBannerText: {flex: 1},
  infoBannerTitle: {
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  infoBannerSubtitle: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  walletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.positiveGreen + '10',
    alignSelf: 'flex-start',
    gap: 6,
  },
  walletBadgeText: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.positiveGreen,
  },
  section: {paddingHorizontal: 16, marginBottom: 20},
  sectionTitle: {
    fontSize: 18,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
  },
  emptyState: {alignItems: 'center', paddingVertical: 32, gap: 8},
  emptyStateText: {
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.textPrimary,
  },
  emptyStateSubtext: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
  },
  positionCard: {
    marginBottom: 12,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  pendingCard: {
    borderWidth: 1,
    borderColor: COLORS.warningOrange + '30',
    backgroundColor: '#FFFBF5',
  },
  positionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  positionIcon: {width: 40, height: 40, borderRadius: 20},
  positionName: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: COLORS.textPrimary,
  },
  positionValidator: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  positionStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  positionStat: {},
  positionStatLabel: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  positionStatValue: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: COLORS.textPrimary,
  },
  unpoolingAmount: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: COLORS.warningOrange,
    textAlign: 'right',
  },
  poolCard: {
    marginBottom: 12,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  poolHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  poolNameRow: {flexDirection: 'row', alignItems: 'center', gap: 12},
  poolIcon: {width: 40, height: 40, borderRadius: 20},
  poolName: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: COLORS.textPrimary,
  },
  poolValidator: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  tokenBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FFF7ED',
  },
  tokenBadgeText: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: '#B45309',
  },
  poolStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  poolStat: {},
  poolStatLabel: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  poolStatValue: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: COLORS.textPrimary,
  },
  stakeButton: {
    backgroundColor: COLORS.brandPrimary,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 999,
  },
  stakeButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
  },
});
