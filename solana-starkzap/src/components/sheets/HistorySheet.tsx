import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Linking,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useSelector} from 'react-redux';
import {RootState} from '@/shared/state/store';
import {HistoryTransaction, LifecycleStep} from '@/shared/state/history/reducer';
import BottomSheet from './BottomSheet';
import TransactionLifecycle from '../TransactionLifecycle';
import COLORS from '../../assets/colors';
import TYPOGRAPHY from '../../assets/typography';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface HistorySheetProps {
  visible: boolean;
  onClose: () => void;
}

const TX_TYPE_CONFIG: Record<
  string,
  {icon: string; color: string; label: string}
> = {
  stake: {icon: 'trending-up', color: COLORS.positiveGreen, label: 'Staked'},
  unstake: {icon: 'trending-down', color: COLORS.warningOrange, label: 'Unstaked'},
  deposit: {icon: 'arrow-down', color: COLORS.brandBlue, label: 'Deposited'},
  withdraw: {icon: 'arrow-up', color: COLORS.warningOrange, label: 'Withdrew'},
  claim: {icon: 'gift', color: COLORS.positiveGreen, label: 'Claimed'},
  bridge: {icon: 'swap-horizontal', color: COLORS.brandPurple, label: 'Bridged'},
  swap: {icon: 'repeat', color: COLORS.brandPrimary, label: 'Swapped'},
};

function buildFallbackLifecycle(item: HistoryTransaction): LifecycleStep[] {
  const isConfirmed = item.status === 'confirmed';
  const isFailed = item.status === 'failed';
  const needsSwap = item.protocol?.includes('wstETH') || item.protocol?.includes('sUSN')
    || item.subtitle?.includes('Swap');

  const steps: LifecycleStep[] = [
    {
      id: 'deposit_confirmed',
      title: 'Deposit confirmed',
      subtitle: 'Your deposit has been received on Solana.',
      status: isConfirmed || isFailed ? 'complete' : 'active',
      explorerUrl: item.explorerUrl || undefined,
      explorerLabel: item.explorerUrl ? 'View on Solscan' : undefined,
    },
    {
      id: 'bridging',
      title: 'Bridging to Starknet',
      subtitle: isConfirmed ? 'Your funds have arrived on Starknet.' : 'Bridging to Starknet via CCTP...',
      status: isConfirmed ? 'complete' : isFailed ? 'error' : 'pending',
    },
  ];

  if (needsSwap) {
    steps.push({
      id: 'swapping',
      title: 'Preparing your yield position',
      subtitle: isConfirmed ? 'Swap completed via AVNU.' : 'Swapping via AVNU...',
      status: isConfirmed ? 'complete' : 'pending',
    });
  }

  steps.push({
    id: 'deposit_complete',
    title: 'Deposit complete',
    subtitle: isConfirmed
      ? 'Your funds are now earning yield on Starknet via Vesu.'
      : 'Depositing into Vesu...',
    status: isConfirmed ? 'complete' : isFailed ? 'error' : 'pending',
    explorerUrl: item.starknetExplorerUrl || undefined,
    explorerLabel: item.starknetExplorerUrl ? 'View on Voyager' : undefined,
  });

  return steps;
}

const HistorySheet: React.FC<HistorySheetProps> = ({visible, onClose}) => {
  const transactions = useSelector(
    (state: RootState) => state.history.transactions,
  );
  const currentStarknetAddress = useSelector(
    (state: RootState) => state.starknet.walletAddress,
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(prev => (prev === id ? null : id));
  }, []);

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  const isCrossChainTx = (item: HistoryTransaction) =>
    item.starknetExplorerUrl ||
    item.starknetAddress ||
    item.lifecycleSteps?.length ||
    item.protocol?.includes('CCTP') ||
    item.protocol?.includes('Starknet') ||
    item.protocol?.includes('Vesu') ||
    item.protocol?.includes('Starkzap');

  const renderItem = ({item}: {item: HistoryTransaction}) => {
    const config = TX_TYPE_CONFIG[item.type] || TX_TYPE_CONFIG.stake;
    const hasLifecycle = item.lifecycleSteps && item.lifecycleSteps.length > 0;
    const crossChain = isCrossChainTx(item);
    const canExpand = hasLifecycle || crossChain;
    const isExpanded = expandedId === item.id;
    const resolvedAddress = item.starknetAddress || (crossChain ? currentStarknetAddress : null);
    const displaySteps = hasLifecycle
      ? item.lifecycleSteps!
      : crossChain
        ? buildFallbackLifecycle(item)
        : [];

    return (
      <View style={styles.txCard}>
        <TouchableOpacity
          style={styles.txRow}
          onPress={canExpand ? () => toggleExpand(item.id) : undefined}
          activeOpacity={canExpand ? 0.7 : 1}>
          <View
            style={[styles.txIcon, {backgroundColor: config.color + '15'}]}>
            <Ionicons
              name={config.icon as any}
              size={18}
              color={config.color}
            />
          </View>

          <View style={styles.txInfo}>
            <Text style={styles.txLabel}>
              {config.label} {item.amount} {item.token}
            </Text>
            {item.subtitle && !isExpanded && (
              <Text style={styles.txSubtitle} numberOfLines={1}>{item.subtitle}</Text>
            )}
            <Text style={styles.txMeta}>
              {item.protocol ? `${item.protocol} · ` : ''}
              {formatDate(item.timestamp)}
            </Text>

            {!isExpanded && (item.explorerUrl || item.starknetExplorerUrl) && (
              <View style={styles.explorerLinks}>
                {item.explorerUrl && (
                  <TouchableOpacity
                    style={styles.explorerLink}
                    onPress={() => Linking.openURL(item.explorerUrl!)}
                    activeOpacity={0.7}>
                    <Ionicons name="open-outline" size={12} color={COLORS.brandPrimary} />
                    <Text style={styles.explorerLinkText}>Solscan</Text>
                  </TouchableOpacity>
                )}
                {item.starknetExplorerUrl && (
                  <TouchableOpacity
                    style={styles.explorerLink}
                    onPress={() => Linking.openURL(item.starknetExplorerUrl!)}
                    activeOpacity={0.7}>
                    <Ionicons name="open-outline" size={12} color="#6C5CE7" />
                    <Text style={[styles.explorerLinkText, {color: '#6C5CE7'}]}>Voyager</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          <View style={styles.txRight}>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    item.status === 'confirmed'
                      ? COLORS.positiveGreen + '15'
                      : item.status === 'failed'
                      ? COLORS.errorRed + '15'
                      : COLORS.warningOrange + '15',
                },
              ]}>
              <Text
                style={[
                  styles.statusText,
                  {
                    color:
                      item.status === 'confirmed'
                        ? COLORS.positiveGreen
                        : item.status === 'failed'
                        ? COLORS.errorRed
                        : COLORS.warningOrange,
                  },
                ]}>
                {item.status === 'confirmed'
                  ? 'Confirmed'
                  : item.status === 'failed'
                  ? 'Failed'
                  : 'Pending'}
              </Text>
            </View>
            {canExpand && (
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={COLORS.textSecondary}
                style={{marginTop: 6}}
              />
            )}
          </View>
        </TouchableOpacity>

        {canExpand && isExpanded && (
          <View style={styles.lifecycleContainer}>
            <TransactionLifecycle
              steps={displaySteps}
              compact
              starknetAddress={resolvedAddress}
            />
          </View>
        )}
      </View>
    );
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="History">
      {transactions.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Ionicons
              name="time-outline"
              size={48}
              color={COLORS.textSecondary}
            />
          </View>
          <Text style={styles.emptyTitle}>No items found</Text>
          <Text style={styles.emptySubtitle}>
            Your transaction history will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{paddingBottom: 20}}
          extraData={expandedId}
        />
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  txCard: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  txInfo: {
    flex: 1,
  },
  txLabel: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  txSubtitle: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  txMeta: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
  },
  explorerLinks: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  explorerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  explorerLinkText: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.brandPrimary,
  },
  txRight: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
  },
  lifecycleContainer: {
    paddingLeft: 52,
    paddingBottom: 12,
    paddingRight: 8,
  },
});

export default HistorySheet;
