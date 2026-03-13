import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { RootState } from '@/shared/state/store';
import { useWallet } from '@/modules/wallet-providers/hooks/useWallet';
import { useFetchTokens } from '@/modules/data-module';
import { fetchJupiterPrices } from '@/services/freeDataService';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';
import ProfileSidebar from '@/components/sidebar/ProfileSidebar';
import ReceiveSheet from '@/components/sheets/ReceiveSheet';
import AddFundsSheet from '@/components/sheets/AddFundsSheet';

const { width } = Dimensions.get('window');

const EXPLORE_TOKENS = [
  { symbol: 'SOL', name: 'Wrapped SOL', address: 'So11111111111111111111111111111111111111112', icon: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png' },
  { symbol: 'JUP', name: 'Jupiter', address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', icon: 'https://static.jup.ag/jup/icon.png' },
  { symbol: 'jupSOL', name: 'Jupiter Staked SOL', address: 'jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v', icon: 'https://static.jup.ag/jupSOL/icon.png' },
  { symbol: 'USDC', name: 'USD Coin', address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', icon: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png' },
  { symbol: 'BONK', name: 'Bonk', address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', icon: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I' },
  { symbol: 'WIF', name: 'dogwifhat', address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', icon: 'https://bafkreibk3covs5ltyqxa272uodhculbr6kea6betiber5vc77j72kbctzli.ipfs.nftstorage.link' },
];

const SUSN_LOCAL_ICON = require('@/assets/images/susn.png');

const LOCAL_LOCKED_ICONS: Record<string, any> = {
  sUSN: SUSN_LOCAL_ICON,
};

const LOCKED_TOKEN_ICONS: Record<string, string> = {
  SOL: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
  USDC: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
  JUP: 'https://static.jup.ag/jup/icon.png',
  JTO: 'https://metadata.jito.network/token/jto/icon.png',
  PYTH: 'https://pyth.network/token.svg',
  WBTC: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh/logo.png',
  wstETH: 'https://assets.coingecko.com/coins/images/18834/small/wstETH.png',
  sUSN: 'https://assets.coingecko.com/coins/images/36614/small/susn.png',
  LBTC: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh/logo.png',
};

interface EnrichedToken {
  symbol: string;
  name: string;
  balance: number;
  usdValue: number;
  price: number;
  icon: string;
  address: string;
}

interface ExploreTokenData {
  symbol: string;
  name: string;
  address: string;
  icon: string;
  price: number;
  change24h: number;
}

export default function PortfolioScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [receiveVisible, setReceiveVisible] = useState(false);
  const [addFundsVisible, setAddFundsVisible] = useState(false);
  const [qrScannerVisible, setQrScannerVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'wallet' | 'spend'>('wallet');
  const [enrichedTokens, setEnrichedTokens] = useState<EnrichedToken[]>([]);
  const [exploreTokens, setExploreTokens] = useState<ExploreTokenData[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [loadingPrices, setLoadingPrices] = useState(false);

  const walletAddress = useSelector((state: RootState) => state.auth.address);
  const historyTransactions = useSelector(
    (state: RootState) => state.history.transactions,
  );
  const { connected } = useWallet();
  const { tokens, nativeBalance, loading: loadingTokens, refetch } = useFetchTokens(walletAddress || undefined);

  const enrichTokensWithPrices = useCallback(async () => {
    const hasTokens = tokens && tokens.length > 0;
    const hasSol = nativeBalance && nativeBalance.lamports > 0;

    if (!hasTokens && !hasSol) {
      setEnrichedTokens([]);
      setTotalBalance(0);
      return;
    }

    setLoadingPrices(true);
    try {
      const solMint = 'So11111111111111111111111111111111111111112';
      const mints = tokens
        .map((t) => t.id)
        .filter((id): id is string => !!id);

      if (hasSol && !mints.includes(solMint)) {
        mints.push(solMint);
      }

      const jupiterPrices = mints.length > 0 ? await fetchJupiterPrices(mints) : {};

      const enriched: EnrichedToken[] = [];
      let total = 0;

      if (hasSol) {
        const solBalance = nativeBalance.lamports / 1e9;
        const solPrice =
          nativeBalance.price_per_sol ||
          jupiterPrices[solMint] ||
          0;
        const solUsdValue = nativeBalance.total_price ?? solBalance * solPrice;
        total += solUsdValue;

        enriched.push({
          symbol: 'SOL',
          name: 'Solana',
          balance: solBalance,
          usdValue: solUsdValue,
          price: solPrice,
          icon: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
          address: solMint,
        });
      }

      for (const token of tokens) {
        const symbol = token.token_info?.symbol || token.symbol || '';
        const name = token.content?.metadata?.name || token.name || symbol;
        const decimals = token.token_info?.decimals || 0;
        const rawBalance = token.token_info?.balance
          ? Number(token.token_info.balance) / Math.pow(10, decimals)
          : 0;

        const price =
          token.token_info?.price_info?.price_per_token ||
          jupiterPrices[token.id || ''] ||
          0;

        const usdValue = rawBalance * price;
        total += usdValue;

        const icon =
          token.image ||
          token.content?.links?.image ||
          token.content?.files?.[0]?.uri ||
          '';

        enriched.push({
          symbol,
          name,
          balance: rawBalance,
          usdValue,
          price,
          icon,
          address: token.id || '',
        });
      }

      enriched.sort((a, b) => b.usdValue - a.usdValue);
      setEnrichedTokens(enriched);
      setTotalBalance(total);
    } catch (err) {
      console.error('Error enriching tokens:', err);
    } finally {
      setLoadingPrices(false);
    }
  }, [tokens, nativeBalance]);

  const fetchExplorePrices = useCallback(async () => {
    try {
      const addresses = EXPLORE_TOKENS.map(t => t.address);
      const prices = await fetchJupiterPrices(addresses);

      const data: ExploreTokenData[] = EXPLORE_TOKENS.map(token => ({
        ...token,
        price: prices[token.address] || 0,
        change24h: 0,
      }));
      setExploreTokens(data);
    } catch (err) {
      console.error('Error fetching explore prices:', err);
      setExploreTokens(EXPLORE_TOKENS.map(t => ({ ...t, price: 0, change24h: 0 })));
    }
  }, []);

  useEffect(() => {
    enrichTokensWithPrices();
  }, [enrichTokensWithPrices]);

  useEffect(() => {
    fetchExplorePrices();
  }, [fetchExplorePrices]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetch(), fetchExplorePrices()]);
    setRefreshing(false);
  }, [refetch, fetchExplorePrices]);

  const formatPrice = (price: number) => {
    if (price === 0) return '$0.00';
    if (price < 0.0001) return `$${price.toFixed(8)}`;
    if (price < 0.01) return `$${price.toFixed(6)}`;
    if (price < 1) return `$${price.toFixed(4)}`;
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatBalance = (bal: number) => {
    if (bal === 0) return '0';
    if (bal < 0.001) return bal.toFixed(8);
    if (bal < 1) return bal.toFixed(4);
    return bal.toLocaleString('en-US', { maximumFractionDigits: 4 });
  };

  const isLoading = loadingTokens || loadingPrices;

  interface LockedAsset {
    token: string;
    amount: number;
    usdValue: number;
    protocol: string;
  }

  const {lockedValue, lockedCount, lockedAssets} = useMemo(() => {
    const deposits = historyTransactions.filter(
      tx => tx.status === 'confirmed' && (tx.type === 'deposit' || tx.type === 'stake'),
    );
    const tokenMap: Record<string, LockedAsset> = {};
    for (const tx of deposits) {
      const amt = parseFloat(tx.amount) || 0;
      if (!tokenMap[tx.token]) {
        tokenMap[tx.token] = {
          token: tx.token,
          amount: 0,
          usdValue: 0,
          protocol: tx.protocol || 'Earning',
        };
      }
      tokenMap[tx.token].amount += amt;

      let usdVal = amt;
      if (tx.token === 'USDC') {
        usdVal = amt;
      } else if (tx.subtitle) {
        const usdcMatch = tx.subtitle.match(/^([\d.]+)\s+USDC/);
        if (usdcMatch) {
          usdVal = parseFloat(usdcMatch[1]) || amt;
        }
      }
      tokenMap[tx.token].usdValue += usdVal;
    }
    let total = 0;
    for (const a of Object.values(tokenMap)) {
      total += a.usdValue;
    }
    return {
      lockedValue: total,
      lockedCount: Object.keys(tokenMap).length,
      lockedAssets: Object.values(tokenMap),
    };
  }, [historyTransactions]);

  const [showLockedAssets, setShowLockedAssets] = useState(false);

  const liquidValue = Math.max(0, totalBalance - lockedValue);
  const liquidCount = enrichedTokens.filter(t => t.usdValue > 0).length;

  const renderTokenItem = (token: EnrichedToken, index: number) => (
    <TouchableOpacity key={`${token.address}-${index}`} style={styles.tokenRow} activeOpacity={0.7}>
      <View style={styles.tokenLeft}>
        {token.icon ? (
          <Image source={{ uri: token.icon }} style={styles.tokenIcon} />
        ) : (
          <View style={[styles.tokenIcon, styles.tokenIconPlaceholder]}>
            <Text style={styles.tokenIconLetter}>{token.symbol?.[0] || '?'}</Text>
          </View>
        )}
        <View style={styles.tokenInfo}>
          <Text style={styles.tokenName} numberOfLines={1}>{token.name}</Text>
          <Text style={styles.tokenSymbol}>
            {formatBalance(token.balance)} {token.symbol}
          </Text>
        </View>
      </View>
      <View style={styles.tokenRight}>
        <Text style={styles.tokenPrice}>{formatPrice(token.usdValue)}</Text>
        <Text style={styles.tokenPriceEach}>{formatPrice(token.price)}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderExploreToken = (token: ExploreTokenData, index: number) => (
    <TouchableOpacity key={`explore-${token.address}`} style={styles.tokenRow} activeOpacity={0.7}>
      <View style={styles.tokenLeft}>
        <Image source={{ uri: token.icon }} style={styles.tokenIcon} />
        <View style={styles.tokenInfo}>
          <Text style={styles.tokenName} numberOfLines={1}>{token.name}</Text>
          <Text style={styles.tokenSymbol}>{token.symbol}</Text>
        </View>
      </View>
      <View style={styles.tokenRight}>
        <Text style={styles.tokenPrice}>{formatPrice(token.price)}</Text>
      </View>
    </TouchableOpacity>
  );

  // Lazy-load QR scanner
  const QRScannerScreen = qrScannerVisible
    ? require('@/components/QRScannerScreen').default
    : null;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.avatarButton}
            onPress={() => setSidebarVisible(true)}
          >
            <LinearGradient
              colors={['#EF4444', '#F97316']}
              style={styles.avatar}
            >
              <View style={styles.avatarDot} />
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.headerTabs}>
            <TouchableOpacity
              style={[styles.headerTab, activeTab === 'wallet' && styles.headerTabActive]}
              onPress={() => setActiveTab('wallet')}
            >
              <Text style={[styles.headerTabText, activeTab === 'wallet' && styles.headerTabTextActive]}>
                Wallet
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerTab, activeTab === 'spend' && styles.headerTabActive]}
              onPress={() => setActiveTab('spend')}
            >
              <Text style={[styles.headerTabText, activeTab === 'spend' && styles.headerTabTextActive]}>
                Spend
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerIcon} onPress={() => setQrScannerVisible(true)}>
              <Ionicons name="qr-code-outline" size={18} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.brandPrimary}
            />
          }
        >
          <View style={styles.welcomeSection}>
            {connected && walletAddress ? (
              <>
                <Text style={styles.totalLabel}>Total Balance</Text>
                <Text style={styles.welcomeTitle}>
                  ${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
                <Text style={styles.welcomeSubtitle}>
                  {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                </Text>

                {/* Fund Wallet Card */}
                <TouchableOpacity
                  style={styles.fundWalletCard}
                  activeOpacity={0.8}
                  onPress={() => setAddFundsVisible(true)}
                >
                  <View style={styles.cardContent}>
                    <View style={styles.cardLeft}>
                      <View style={styles.cardIconCircle}>
                        <Ionicons name="card" size={20} color={COLORS.brandPrimary} />
                      </View>
                      <View>
                        <Text style={styles.cardTitle}>Fund Wallet</Text>
                        <Text style={styles.cardDescription}>
                          Buy crypto with FIAT or{'\n'}deposit from another account
                        </Text>
                      </View>
                    </View>
                    <View style={styles.paymentIcons}>
                      <View style={[styles.paymentBadge, { backgroundColor: '#1A1A2E' }]}>
                        <Text style={styles.paymentText}>G Pay</Text>
                      </View>
                      <View style={[styles.paymentBadge, { backgroundColor: '#000' }]}>
                        <Text style={styles.paymentText}> Pay</Text>
                      </View>
                      <View style={[styles.paymentBadge, { backgroundColor: '#1A1F71' }]}>
                        <Text style={styles.paymentText}>VISA</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Liquid / Locked pills */}
                <View style={styles.balancePillsRow}>
                  <TouchableOpacity
                    style={[styles.balancePill, !showLockedAssets && styles.balancePillLiquid]}
                    activeOpacity={0.7}
                    onPress={() => setShowLockedAssets(false)}>
                    <Ionicons name="wallet" size={16} color={!showLockedAssets ? COLORS.brandPrimary : COLORS.textSecondary} />
                    <Text style={styles.balancePillValue}>
                      ${liquidValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </Text>
                    {liquidCount > 0 && (
                      <View style={styles.balancePillBadge}>
                        <Text style={styles.balancePillBadgeText}>{liquidCount}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.balancePill, showLockedAssets && styles.balancePillLocked]}
                    activeOpacity={0.7}
                    onPress={() => setShowLockedAssets(true)}>
                    <Ionicons name="grid" size={16} color={showLockedAssets ? COLORS.brandPrimary : COLORS.textSecondary} />
                    <Text style={styles.balancePillValue}>
                      ${lockedValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </Text>
                    {lockedCount > 0 && (
                      <View style={styles.balancePillBadge}>
                        <Text style={styles.balancePillBadgeText}>{lockedCount}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Liquid tokens list */}
                {!showLockedAssets && enrichedTokens.length > 0 && (
                  <View style={styles.lockedAssetsSection}>
                    <Text style={styles.lockedAssetsTitle}>Your tokens</Text>
                    {enrichedTokens.map((token, idx) => (
                      <View key={`${token.address}-${idx}`} style={styles.lockedAssetRow}>
                        <View style={styles.lockedAssetLeft}>
                          {token.icon ? (
                            <Image source={{uri: token.icon}} style={styles.lockedAssetIcon} />
                          ) : (
                            <View style={[styles.lockedAssetIcon, styles.lockedAssetIconPlaceholder]}>
                              <Text style={styles.lockedAssetIconLetter}>{token.symbol?.[0] || '?'}</Text>
                            </View>
                          )}
                          <View>
                            <Text style={styles.lockedAssetToken}>{token.symbol}</Text>
                            <Text style={styles.lockedAssetProtocol}>{formatBalance(token.balance)} {token.symbol}</Text>
                          </View>
                        </View>
                        <View style={styles.lockedAssetRight}>
                          <Text style={styles.lockedAssetAmount}>{formatPrice(token.usdValue)}</Text>
                          <Text style={styles.lockedAssetUsd}>{formatPrice(token.price)} each</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Locked assets list */}
                {showLockedAssets && lockedAssets.length > 0 && (
                  <View style={styles.lockedAssetsSection}>
                    <Text style={styles.lockedAssetsTitle}>Earning yield</Text>
                    {lockedAssets.map(asset => (
                      <View key={asset.token} style={styles.lockedAssetRow}>
                        <View style={styles.lockedAssetLeft}>
                          {LOCAL_LOCKED_ICONS[asset.token] ? (
                            <Image source={LOCAL_LOCKED_ICONS[asset.token]} style={styles.lockedAssetIcon} />
                          ) : LOCKED_TOKEN_ICONS[asset.token] ? (
                            <Image source={{uri: LOCKED_TOKEN_ICONS[asset.token]}} style={styles.lockedAssetIcon} />
                          ) : (
                            <View style={[styles.lockedAssetIcon, styles.lockedAssetIconPlaceholder]}>
                              <Text style={styles.lockedAssetIconLetter}>{asset.token[0]}</Text>
                            </View>
                          )}
                          <View>
                            <Text style={styles.lockedAssetToken}>{asset.token}</Text>
                            <Text style={styles.lockedAssetProtocol}>{asset.protocol}</Text>
                          </View>
                        </View>
                        <View style={styles.lockedAssetRight}>
                          <Text style={styles.lockedAssetAmount}>${asset.usdValue.toFixed(2)}</Text>
                          <Text style={styles.lockedAssetUsd}>
                            {asset.amount < 0.0001
                              ? asset.amount.toExponential(2)
                              : asset.amount.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')} {asset.token}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* PnL row */}
                <View style={styles.pnlRow}>
                  <Ionicons name="bar-chart" size={16} color={COLORS.textSecondary} />
                  <Text style={styles.pnlLabel}>PnL</Text>
                  <Text style={styles.pnlValue}>24H +0%</Text>
                  <Text style={styles.pnlDot}>•</Text>
                  <Text style={styles.pnlValue}>7D +0%</Text>
                  <View style={{flex: 1}} />
                  <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
                </View>
              </>
            ) : (
              <>
                <Text style={styles.welcomeTitle}>Welcome to StarkZap</Text>
                <Text style={styles.welcomeSubtitle}>Connect wallet to get started.</Text>
              </>
            )}

            <View style={styles.actionButtonsRow}>
              <TouchableOpacity
                style={styles.receiveButton}
                onPress={() => setReceiveVisible(true)}
              >
                <Ionicons name="arrow-down" size={20} color={COLORS.brandPrimary} />
                <Text style={styles.receiveText}>Receive</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.receiveButton}
                onPress={() => setAddFundsVisible(true)}
              >
                <Ionicons name="add" size={20} color={COLORS.brandPrimary} />
                <Text style={styles.receiveText}>Add Funds</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Explore Tokens */}
          <View style={styles.tokenSection}>
            <Text style={styles.sectionTitle}>Explore Tokens</Text>
            {exploreTokens.length > 0 ? (
              exploreTokens.map(renderExploreToken)
            ) : (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={COLORS.brandPrimary} />
              </View>
            )}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>

      <ProfileSidebar
        visible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
      />

      <ReceiveSheet visible={receiveVisible} onClose={() => setReceiveVisible(false)} />
      <AddFundsSheet visible={addFundsVisible} onClose={() => setAddFundsVisible(false)} />

      {qrScannerVisible && QRScannerScreen && (
        <QRScannerScreen onClose={() => setQrScannerVisible(false)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  avatarButton: {
    width: 32,
    height: 32,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
    position: 'absolute',
    top: 0,
    right: 0,
    borderWidth: 1.5,
    borderColor: COLORS.background,
  },
  headerTabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.secondaryBackground,
    borderRadius: 9999,
    padding: 3,
  },
  headerTab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 9999,
  },
  headerTabActive: {
    backgroundColor: COLORS.white,
  },
  headerTabText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
  },
  headerTabTextActive: {
    color: COLORS.textPrimary,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.secondaryBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  welcomeSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  totalLabel: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  welcomeTitle: {
    fontSize: 34,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  balancePillsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
    width: '100%',
    paddingHorizontal: 16,
  },
  balancePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.secondaryBackground,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
  },
  balancePillLiquid: {
    borderWidth: 1.5,
    borderColor: COLORS.brandPrimary + '30',
  },
  balancePillLocked: {
    borderWidth: 1.5,
    borderColor: COLORS.brandPrimary + '30',
  },
  balancePillValue: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: COLORS.textPrimary,
  },
  balancePillBadge: {
    backgroundColor: COLORS.textSecondary + '20',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    marginLeft: 'auto',
  },
  balancePillBadgeText: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.textSecondary,
  },
  pnlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.secondaryBackground,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 16,
    width: width - 32,
  },
  pnlLabel: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: COLORS.textPrimary,
  },
  pnlValue: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.positiveGreen,
  },
  pnlDot: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  lockedAssetsSection: {
    width: '100%',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  lockedAssetsTitle: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  lockedAssetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  lockedAssetLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  lockedAssetIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  lockedAssetIconPlaceholder: {
    backgroundColor: COLORS.secondaryBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockedAssetIconLetter: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: COLORS.brandPrimary,
  },
  lockedAssetToken: {
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: COLORS.textPrimary,
  },
  lockedAssetProtocol: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  lockedAssetRight: {
    alignItems: 'flex-end',
  },
  lockedAssetAmount: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: COLORS.textPrimary,
  },
  lockedAssetUsd: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  receiveButton: {
    alignItems: 'center',
    backgroundColor: COLORS.secondaryBackground,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 9999,
    flexDirection: 'row',
    gap: 8,
  },
  receiveText: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.brandPrimary,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  fundWalletCard: {
    alignSelf: 'stretch',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  cardIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.brandPrimaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  paymentIcons: {
    gap: 4,
    alignItems: 'flex-end',
  },
  paymentBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 50,
    alignItems: 'center',
  },
  paymentText: {
    color: COLORS.white,
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
  },
  tokenSection: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  tokenRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.greyBorder,
  },
  tokenLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  tokenIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.secondaryBackground,
  },
  tokenIconPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  tokenIconLetter: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: COLORS.brandPrimary,
  },
  tokenInfo: {
    gap: 2,
    flex: 1,
  },
  tokenName: {
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.textPrimary,
    maxWidth: width * 0.4,
  },
  tokenSymbol: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
  },
  tokenRight: {
    alignItems: 'flex-end',
  },
  tokenPrice: {
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.textPrimary,
  },
  tokenPriceEach: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily,
    textAlign: 'center',
  },
});
