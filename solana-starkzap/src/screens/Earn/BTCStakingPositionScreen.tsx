import React, {useEffect, useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';
import {useBTCStaking} from '@/modules/starknet/hooks/useBTCStaking';
import {useBridge} from '@/modules/bridge/hooks/useBridge';
import {useSelector} from 'react-redux';
import {RootState} from '@/shared/state/store';

const BTC_LOGO =
  'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/bitcoin/info/logo.png';

type PositionParams = {
  BTCStakingPosition: {
    poolAddress: string;
    validatorName: string;
    tokenSymbol: string;
  };
};

export default function BTCStakingPositionScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<PositionParams, 'BTCStakingPosition'>>();
  const {poolAddress, validatorName, tokenSymbol} = route.params;

  const {
    positions,
    claimStakingRewards,
    initiateUnstake,
    completeUnstake,
    refreshPositions,
  } = useBTCStaking();
  const {bridgeToSolana, getQuote} = useBridge();
  const starknetAddress = useSelector(
    (state: RootState) => state.starknet.walletAddress,
  );

  const [isProcessing, setIsProcessing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const position = positions.find(p => p.poolAddress === poolAddress);

  useEffect(() => {
    refreshPositions();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshPositions();
    setRefreshing(false);
  };

  const handleClaimRewards = useCallback(async () => {
    setIsProcessing(true);
    try {
      await claimStakingRewards(poolAddress);
      Alert.alert('Success', 'Rewards claimed successfully!');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to claim rewards');
    } finally {
      setIsProcessing(false);
    }
  }, [poolAddress, claimStakingRewards]);

  const handleUnstake = useCallback(() => {
    Alert.alert(
      'Unstake BTC',
      'This will initiate the unstaking process. There is a cooldown period before you can withdraw. After withdrawal, funds will be bridged back to your Solana wallet.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Unstake',
          style: 'destructive',
          onPress: async () => {
            setIsProcessing(true);
            try {
              if (!position) return;
              await initiateUnstake(
                poolAddress,
                position.stakedAmount.replace(/[^0-9.]/g, ''),
                tokenSymbol,
              );
              Alert.alert(
                'Unstake Initiated',
                'Your tokens are now in the cooldown period. You can withdraw once the cooldown completes.',
              );
            } catch (err: any) {
              Alert.alert(
                'Error',
                err.message || 'Failed to initiate unstake',
              );
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ],
    );
  }, [poolAddress, position, tokenSymbol, initiateUnstake]);

  const handleWithdraw = useCallback(async () => {
    setIsProcessing(true);
    try {
      await completeUnstake(poolAddress);
      if (position) {
        const rawAmount = position.unpoolingAmount.replace(/[^0-9.]/g, '');
        const quote = await getQuote('starknet_to_solana', rawAmount);
        await bridgeToSolana(quote, null);
        Alert.alert(
          'Withdrawal Complete',
          'Your tokens have been withdrawn and are being bridged back to your Solana wallet.',
        );
      }
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to withdraw');
    } finally {
      setIsProcessing(false);
    }
  }, [poolAddress, position, completeUnstake, getQuote, bridgeToSolana, navigation]);

  if (!position) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}>
              <Ionicons
                name="arrow-back"
                size={20}
                color={COLORS.textPrimary}
              />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Position</Text>
            <View style={{width: 36}} />
          </View>
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No active position found</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}>
            <Ionicons
              name="arrow-back"
              size={20}
              color={COLORS.textPrimary}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{tokenSymbol} Position</Text>
          <View style={{width: 36}} />
        </View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }>
          {/* Position Summary */}
          <View style={styles.summaryCard}>
            <Image source={{uri: BTC_LOGO}} style={styles.summaryIcon} />
            <Text style={styles.summaryTotal}>{position.totalAmount}</Text>
            <Text style={styles.summaryLabel}>Total Position Value</Text>

            <View style={styles.statusBadge}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor:
                      position.status === 'active'
                        ? COLORS.positiveGreen
                        : position.status === 'ready_to_withdraw'
                        ? COLORS.brandPrimary
                        : COLORS.warningOrange,
                  },
                ]}
              />
              <Text style={styles.statusText}>
                {position.status === 'active'
                  ? 'Actively Earning'
                  : position.status === 'ready_to_withdraw'
                  ? 'Ready to Withdraw'
                  : 'Cooldown Period'}
              </Text>
            </View>
          </View>

          {/* Details */}
          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Validator</Text>
              <Text style={styles.detailValue}>{validatorName}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Staked Amount</Text>
              <Text style={styles.detailValue}>{position.stakedAmount}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Rewards Earned</Text>
              <Text
                style={[styles.detailValue, {color: COLORS.positiveGreen}]}>
                {position.rewardsAmount}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Commission</Text>
              <Text style={styles.detailValue}>
                {position.commissionPercent}%
              </Text>
            </View>
            {position.unpoolTime && (
              <>
                <View style={styles.divider} />
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Withdrawal Available</Text>
                  <Text style={styles.detailValue}>
                    {new Date(position.unpoolTime).toLocaleDateString()}
                  </Text>
                </View>
              </>
            )}
            {starknetAddress && (
              <>
                <View style={styles.divider} />
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Starknet Address</Text>
                  <Text style={[styles.detailValue, {fontSize: 11}]}>
                    {starknetAddress.slice(0, 10)}...
                    {starknetAddress.slice(-6)}
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Actions */}
          <View style={styles.actionsContainer}>
            {position.status === 'active' && (
              <>
                <TouchableOpacity
                  style={styles.claimButton}
                  onPress={handleClaimRewards}
                  disabled={isProcessing}>
                  {isProcessing ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <Text style={styles.claimButtonText}>Claim Rewards</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.unstakeButton}
                  onPress={handleUnstake}
                  disabled={isProcessing}>
                  <Text style={styles.unstakeButtonText}>Unstake</Text>
                </TouchableOpacity>
              </>
            )}

            {position.status === 'ready_to_withdraw' && (
              <TouchableOpacity
                style={styles.claimButton}
                onPress={handleWithdraw}
                disabled={isProcessing}>
                {isProcessing ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.claimButtonText}>
                    Withdraw & Bridge to Solana
                  </Text>
                )}
              </TouchableOpacity>
            )}

            {position.status === 'unstaking' && (
              <View style={styles.waitingBanner}>
                <Ionicons
                  name="time-outline"
                  size={20}
                  color={COLORS.warningOrange}
                />
                <Text style={styles.waitingText}>
                  Cooldown in progress. Withdrawal will be available on{' '}
                  {position.unpoolTime
                    ? new Date(position.unpoolTime).toLocaleDateString()
                    : 'completion'}
                  .
                </Text>
              </View>
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
  },
  summaryCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 24,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: 12,
  },
  summaryTotal: {
    fontSize: 32,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.secondaryBackground,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.textPrimary,
  },
  detailsCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  detailLabel: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: COLORS.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.greyBorder,
  },
  actionsContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  claimButton: {
    backgroundColor: COLORS.brandPrimary,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: 'center',
  },
  claimButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
  },
  unstakeButton: {
    backgroundColor: COLORS.white,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.errorRed + '40',
  },
  unstakeButtonText: {
    color: COLORS.errorRed,
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
  },
  waitingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 16,
    backgroundColor: COLORS.warningOrange + '10',
  },
  waitingText: {
    flex: 1,
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.warningOrange,
    lineHeight: 18,
  },
});
