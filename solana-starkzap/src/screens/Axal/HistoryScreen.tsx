import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppNavigation } from '@/shared/hooks/useAppNavigation';
import { useSelector } from 'react-redux';
import { RootState } from '@/shared/state/store';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function statusIcon(status: string): { name: IconName; color: string } {
  switch (status) {
    case 'completed':
      return { name: 'checkmark-circle', color: COLORS.positiveGreen };
    case 'failed':
      return { name: 'close-circle', color: COLORS.negativeRed };
    case 'bridging':
    case 'pending':
      return { name: 'time-outline', color: COLORS.btcOrange };
    case 'active':
      return { name: 'checkmark-circle', color: COLORS.positiveGreen };
    case 'unstaking':
      return { name: 'hourglass-outline', color: COLORS.btcOrange };
    case 'ready_to_withdraw':
      return { name: 'arrow-down-circle-outline', color: COLORS.brandPrimary };
    default:
      return { name: 'ellipse-outline', color: COLORS.textSecondary };
  }
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function truncateHash(hash: string): string {
  if (!hash || hash.length < 16) return hash || '—';
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

function explorerUrl(direction: string, txHash?: string): string | null {
  if (!txHash) return null;
  if (direction.startsWith('arbitrum'))  return `https://arbiscan.io/tx/${txHash}`;
  if (direction.startsWith('base'))      return `https://basescan.org/tx/${txHash}`;
  if (direction.startsWith('ethereum'))  return `https://etherscan.io/tx/${txHash}`;
  if (direction.startsWith('polygon'))   return `https://polygonscan.com/tx/${txHash}`;
  if (direction.startsWith('solana'))    return `https://solscan.io/tx/${txHash}`;
  if (direction.startsWith('starknet'))  return `https://voyager.online/tx/${txHash}`;
  return `https://layerzeroscan.com/tx/${txHash}`;
}

/** Lifecycle steps for a bridge+earn transaction */
interface ProcessStep {
  label: string;
  description: string;
  icon: IconName;
  status: 'completed' | 'active' | 'pending' | 'failed';
}

function getBridgeSteps(op: { status: string; direction: string; tokenSymbol: string }): ProcessStep[] {
  const isBtcFlow = op.direction.includes('arbitrum') || op.direction.includes('base');
  const srcChain = op.direction.split('_to_')[0]?.replace(/^\w/, c => c.toUpperCase()) || 'EVM';

  const bridgeStatus: ProcessStep['status'] =
    op.status === 'completed' ? 'completed' :
    op.status === 'failed' ? 'failed' :
    op.status === 'bridging' ? 'active' : 'pending';

  const postBridgeStatus: ProcessStep['status'] =
    op.status === 'completed' ? 'completed' :
    op.status === 'failed' ? 'pending' : 'pending';

  const steps: ProcessStep[] = [
    {
      label: 'Deposited',
      description: `${op.tokenSymbol} on ${srcChain}`,
      icon: 'wallet-outline',
      status: 'completed',
    },
    {
      label: 'Bridging to Starknet',
      description: `${srcChain} → Starknet via LayerZero`,
      icon: 'swap-horizontal-outline',
      status: bridgeStatus,
    },
  ];

  if (isBtcFlow) {
    steps.push(
      {
        label: 'Swap for BTC',
        description: `${op.tokenSymbol} → BTC via AVNU`,
        icon: 'repeat-outline',
        status: postBridgeStatus,
      },
      {
        label: 'Stake BTC',
        description: 'Karnot validator on Starknet',
        icon: 'lock-closed-outline',
        status: postBridgeStatus,
      },
    );
  }

  steps.push({
    label: 'Earning Yield',
    description: op.status === 'completed' ? 'Actively earning' : 'Waiting...',
    icon: 'trending-up-outline',
    status: op.status === 'completed' ? 'completed' : 'pending',
  });

  return steps;
}

export default function HistoryScreen() {
  const navigation = useAppNavigation();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const bridgeOps = useSelector((state: RootState) => state.starknet.bridgeOperations);
  const stakingPositions = useSelector((state: RootState) => state.starknet.stakingPositions);

  const hasBridgeOps = bridgeOps.length > 0;
  const hasPositions = stakingPositions.length > 0;
  const isEmpty = !hasBridgeOps && !hasPositions;

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const renderStepRow = (step: ProcessStep, index: number, total: number) => {
    const isLast = index === total - 1;
    const dotBg =
      step.status === 'completed' ? COLORS.positiveGreen :
      step.status === 'active' ? COLORS.btcOrange :
      step.status === 'failed' ? COLORS.negativeRed :
      COLORS.greyBorder;
    const labelColor =
      step.status === 'completed' ? COLORS.textPrimary :
      step.status === 'active' ? COLORS.btcOrange :
      step.status === 'failed' ? COLORS.negativeRed :
      COLORS.textSecondary;

    return (
      <View key={index}>
        <View style={styles.stepRow}>
          <View style={[styles.stepDot, { backgroundColor: dotBg }]}>
            {step.status === 'completed' ? (
              <Ionicons name="checkmark" size={12} color="#FFFFFF" />
            ) : step.status === 'active' ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : step.status === 'failed' ? (
              <Ionicons name="close" size={12} color="#FFFFFF" />
            ) : (
              <Ionicons name={step.icon} size={12} color={COLORS.textSecondary} />
            )}
          </View>
          <View style={styles.stepContent}>
            <Text style={[styles.stepLabel, { color: labelColor }]}>{step.label}</Text>
            <Text style={styles.stepDesc}>{step.description}</Text>
          </View>
        </View>
        {!isLast && (
          <View style={styles.connectorWrap}>
            <View style={[
              styles.connectorLine,
              { backgroundColor: step.status === 'completed' ? COLORS.positiveGreen : COLORS.greyBorder },
            ]} />
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>History</Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {isEmpty && (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color={COLORS.textSecondary} />
              <Text style={styles.emptyTitle}>No transactions yet</Text>
              <Text style={styles.emptySub}>
                Your bridge and staking transactions will appear here.
              </Text>
            </View>
          )}

          {/* Bridge Operations */}
          {hasBridgeOps && (
            <>
              <Text style={styles.sectionTitle}>Transactions</Text>
              {[...bridgeOps].reverse().map((op) => {
                const icon = statusIcon(op.status);
                const url = explorerUrl(op.direction, op.txHash);
                const isExpanded = expandedId === op.id;
                const lifecycleSteps = getBridgeSteps(op);

                return (
                  <View key={op.id} style={styles.txCard}>
                    {/* Main row — tap to expand */}
                    <TouchableOpacity
                      style={styles.txMainRow}
                      onPress={() => toggleExpand(op.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.txIconWrap}>
                        <Ionicons name="swap-horizontal-outline" size={20} color={COLORS.textPrimary} />
                      </View>
                      <View style={styles.txContent}>
                        <Text style={styles.txTitle}>
                          Bridge {op.amount} {op.tokenSymbol}
                        </Text>
                        <Text style={styles.txSub}>{formatDate(op.createdAt)}</Text>
                      </View>
                      <View style={styles.txRight}>
                        <Ionicons name={icon.name} size={22} color={icon.color} />
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={16}
                          color={COLORS.textSecondary}
                          style={{ marginTop: 4 }}
                        />
                      </View>
                    </TouchableOpacity>

                    {/* Expanded lifecycle steps */}
                    {isExpanded && (
                      <View style={styles.expandedSection}>
                        {lifecycleSteps.map((step, i) => renderStepRow(step, i, lifecycleSteps.length))}

                        {/* TX hash links — bridge | swap | stake */}
                        {op.txHash && (() => {
                          const hashes = op.txHash!.split('|').filter(Boolean);
                          const labels = ['Bridge (Arbiscan)', 'Swap (Voyager)', 'Stake (Voyager)'];
                          return (
                            <View style={styles.txLinksSection}>
                              {hashes.map((hash, hi) => {
                                const link = hi === 0
                                  ? explorerUrl(op.direction, hash) || `https://arbiscan.io/tx/${hash}`
                                  : `https://voyager.online/tx/${hash}`;
                                return (
                                  <TouchableOpacity
                                    key={hi}
                                    style={styles.txHashRow}
                                    onPress={() => Linking.openURL(link!)}
                                  >
                                    <Ionicons name="open-outline" size={14} color={COLORS.brandPrimary} />
                                    <Text style={styles.txHashLink}>
                                      {labels[hi] || 'View'}: {truncateHash(hash)}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          );
                        })()}
                      </View>
                    )}
                  </View>
                );
              })}
            </>
          )}

          {/* Staking Positions */}
          {hasPositions && (
            <>
              <Text style={[styles.sectionTitle, hasBridgeOps && { marginTop: 28 }]}>
                Active Positions
              </Text>
              {stakingPositions.map((pos, i) => {
                const icon = statusIcon(pos.status);
                return (
                  <View key={i} style={styles.txCard}>
                    <View style={styles.txMainRow}>
                      <View style={styles.txIconWrap}>
                        <Ionicons name="lock-closed-outline" size={20} color={COLORS.textPrimary} />
                      </View>
                      <View style={styles.txContent}>
                        <Text style={styles.txTitle}>
                          {pos.stakedAmount} {pos.tokenSymbol}
                        </Text>
                        <Text style={styles.txSub}>{pos.validatorName} validator</Text>
                        <Text style={styles.txRewards}>
                          Rewards: +{pos.rewardsAmount} {pos.tokenSymbol}
                        </Text>
                      </View>
                      <View style={styles.txRight}>
                        <Ionicons name={icon.name} size={22} color={icon.color} />
                        <Text style={[styles.txStatusLabel, { color: icon.color }]}>
                          {pos.status === 'active' ? 'Earning' :
                           pos.status === 'unstaking' ? 'Unstaking' : 'Withdraw'}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.textPrimary,
    marginTop: 16,
  },
  emptySub: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  txCard: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.greyBorder,
    marginBottom: 10,
    overflow: 'hidden',
  },
  txMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  txIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  txContent: {
    flex: 1,
  },
  txTitle: {
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.textPrimary,
  },
  txSub: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  txRewards: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.positiveGreen,
    marginTop: 2,
  },
  txRight: {
    alignItems: 'center',
    marginLeft: 8,
  },
  txStatusLabel: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    marginTop: 2,
  },
  /* Expanded lifecycle section */
  expandedSection: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.greyBorder,
    paddingTop: 14,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepContent: {
    flex: 1,
  },
  stepLabel: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
  },
  stepDesc: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  connectorWrap: {
    paddingLeft: 12,
    height: 16,
    justifyContent: 'center',
  },
  connectorLine: {
    width: 2,
    height: 12,
    borderRadius: 1,
  },
  txLinksSection: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.greyBorder,
    gap: 8,
  },
  txHashRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  txHashLink: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.brandPrimary,
  },
});
