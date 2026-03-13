import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { TokenInfo } from '@/modules/data-module';
import {
  fetchSolanaTokensCoinGecko,
  CoinGeckoMarketData,
} from '@/services/freeDataService';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';
import ProfileSidebar from '@/components/sidebar/ProfileSidebar';

const { width } = Dimensions.get('window');

type ProTab = 'Trending' | 'New Listings' | 'Top Gainers' | 'Top Volume';

export default function ProScreen() {
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] = useState<ProTab>('Trending');
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [tokens, setTokens] = useState<(TokenInfo & { volume24h?: number; priceChange24h?: number })[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadTokens = useCallback(async () => {
    setLoading(true);
    try {
      const geckoData = await fetchSolanaTokensCoinGecko('solana-ecosystem', 30);

      let mapped = geckoData.map((coin: CoinGeckoMarketData) => ({
        address: coin.id,
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        decimals: 9,
        logoURI: coin.image,
        price: coin.current_price,
        volume24h: coin.total_volume,
        priceChange24h: coin.price_change_percentage_24h,
        marketCap: coin.market_cap,
      }));

      switch (activeTab) {
        case 'Top Gainers':
          mapped.sort((a, b) => (b.priceChange24h || 0) - (a.priceChange24h || 0));
          break;
        case 'Top Volume':
          mapped.sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));
          break;
        default:
          break;
      }

      setTokens(mapped);
    } catch (err) {
      console.error('Error loading tokens:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadTokens();
  }, [loadTokens]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTokens();
    setRefreshing(false);
  }, [loadTokens]);

  const formatPrice = (price?: number) => {
    if (!price) return '$0.00';
    if (price < 0.0001) return `$${price.toFixed(8)}`;
    if (price < 0.01) return `$${price.toFixed(6)}`;
    if (price < 1) return `$${price.toFixed(4)}`;
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatVolume = (vol?: number) => {
    if (!vol) return '$0';
    if (vol >= 1e9) return `$${(vol / 1e9).toFixed(1)}B`;
    if (vol >= 1e6) return `$${(vol / 1e6).toFixed(1)}M`;
    if (vol >= 1e3) return `$${(vol / 1e3).toFixed(0)}K`;
    return `$${vol.toFixed(0)}`;
  };

  const navigateToSwap = (token: TokenInfo) => {
    navigation.navigate('SwapScreen', {
      inputToken: token,
      showBackButton: true,
    });
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.avatarButton}
            onPress={() => setSidebarVisible(true)}
          >
            <LinearGradient colors={['#EF4444', '#F97316']} style={styles.avatar}>
              <View style={styles.avatarDot} />
            </LinearGradient>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pro</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabScrollView}
          contentContainerStyle={styles.tabContent}
        >
          {(['Trending', 'New Listings', 'Top Gainers', 'Top Volume'] as ProTab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.listHeader}>
          <Text style={[styles.listHeaderText, { flex: 0.4 }]}>#</Text>
          <Text style={[styles.listHeaderText, { flex: 2 }]}>Token</Text>
          <Text style={[styles.listHeaderText, { flex: 1.2, textAlign: 'right' }]}>Price</Text>
          <Text style={[styles.listHeaderText, { flex: 1, textAlign: 'right' }]}>24h %</Text>
          <Text style={[styles.listHeaderText, { flex: 1, textAlign: 'right' }]}>Volume</Text>
        </View>

        {loading && tokens.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.brandPrimary} />
            <Text style={styles.loadingText}>Loading market data...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.tokenList}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={COLORS.brandPrimary}
              />
            }
          >
            {tokens.map((token, index) => {
              const change = token.priceChange24h || 0;
              return (
                <TouchableOpacity
                  key={token.address}
                  style={styles.tokenRow}
                  activeOpacity={0.7}
                  onPress={() => navigateToSwap(token)}
                >
                  <Text style={[styles.tokenRank, { flex: 0.4 }]}>{index + 1}</Text>
                  <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {token.logoURI ? (
                      <Image source={{ uri: token.logoURI }} style={styles.tokenIcon} />
                    ) : (
                      <View style={styles.tokenIconPlaceholder}>
                        <Text style={styles.tokenIconLetter}>{token.symbol?.[0] || '?'}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tokenSymbol} numberOfLines={1}>{token.symbol}</Text>
                      <Text style={styles.tokenName} numberOfLines={1}>{token.name}</Text>
                    </View>
                  </View>
                  <Text style={[styles.tokenPrice, { flex: 1.2 }]}>
                    {formatPrice(token.price)}
                  </Text>
                  <Text
                    style={[
                      styles.tokenChangeText,
                      { flex: 1, color: change >= 0 ? COLORS.positiveGreen : COLORS.errorRed },
                    ]}
                  >
                    {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                  </Text>
                  <Text style={[styles.tokenVolume, { flex: 1 }]}>
                    {formatVolume(token.volume24h)}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <View style={styles.defiSection}>
              <Text style={styles.defiTitle}>Quick Actions</Text>
              <View style={styles.defiGrid}>
                {[
                  { iconName: 'analytics-outline' as const, title: 'Copy Trading', desc: 'Follow top traders' },
                  { iconName: 'repeat-outline' as const, title: 'DCA', desc: 'Dollar cost average' },
                  { iconName: 'flash-outline' as const, title: 'Limit Orders', desc: 'Set price targets' },
                  { iconName: 'water-outline' as const, title: 'Liquidity', desc: 'Provide liquidity' },
                ].map((action) => (
                  <TouchableOpacity key={action.title} style={styles.defiCard}>
                    <View style={styles.defiCardInner}>
                      <Ionicons name={action.iconName} size={28} color={COLORS.brandPrimary} />
                      <Text style={styles.defiCardTitle}>{action.title}</Text>
                      <Text style={styles.defiCardDesc}>{action.desc}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>
        )}
      </SafeAreaView>

      <ProfileSidebar
        visible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16,
  },
  avatarButton: { width: 32, height: 32 },
  avatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  avatarDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ADE80',
    position: 'absolute', top: 0, right: 0, borderWidth: 1.5, borderColor: COLORS.background,
  },
  headerTitle: { fontSize: 18, fontFamily: TYPOGRAPHY.fontFamilyBold, color: '#1c1c1c' },
  tabScrollView: { maxHeight: 44, marginBottom: 12 },
  tabContent: { paddingHorizontal: 16, gap: 8 },
  tab: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 9999, backgroundColor: COLORS.secondaryBackground,
  },
  tabActive: { backgroundColor: COLORS.brandPrimaryLight, borderWidth: 1, borderColor: COLORS.brandPrimary },
  tabText: { fontSize: 13, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamilyMedium },
  tabTextActive: { color: COLORS.brandPrimary, fontFamily: TYPOGRAPHY.fontFamilyBold },
  listHeader: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.greyBorder,
  },
  listHeaderText: { fontSize: 12, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamilyMedium },
  loadingContainer: { paddingVertical: 60, alignItems: 'center', gap: 12 },
  loadingText: { color: COLORS.textSecondary, fontSize: 14, fontFamily: TYPOGRAPHY.fontFamily },
  tokenList: { flex: 1 },
  tokenRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.greyBorder,
  },
  tokenRank: { fontSize: 13, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamily },
  tokenIcon: { width: 32, height: 32, borderRadius: 16 },
  tokenIconPlaceholder: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.secondaryBackground,
    justifyContent: 'center', alignItems: 'center',
  },
  tokenIconLetter: { fontSize: 14, fontFamily: TYPOGRAPHY.fontFamilyBold, color: COLORS.brandPrimary },
  tokenSymbol: { fontSize: 14, fontFamily: TYPOGRAPHY.fontFamilyBold, color: '#1c1c1c' },
  tokenName: { fontSize: 11, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamily },
  tokenPrice: { fontSize: 13, fontFamily: TYPOGRAPHY.fontFamilyMedium, color: '#1c1c1c', textAlign: 'right' },
  tokenChangeText: { fontSize: 13, fontFamily: TYPOGRAPHY.fontFamilyMedium, textAlign: 'right' },
  tokenVolume: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'right', fontFamily: TYPOGRAPHY.fontFamily },
  defiSection: { paddingHorizontal: 16, paddingTop: 24 },
  defiTitle: { fontSize: 18, fontFamily: TYPOGRAPHY.fontFamilyBold, color: '#1c1c1c', marginBottom: 16 },
  defiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  defiCard: {
    width: (width - 44) / 2, borderRadius: 20, overflow: 'hidden',
    backgroundColor: COLORS.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  defiCardInner: { padding: 16, alignItems: 'center', gap: 8 },
  defiCardTitle: { fontSize: 14, fontFamily: TYPOGRAPHY.fontFamilyBold, color: '#1c1c1c' },
  defiCardDesc: { fontSize: 12, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamily },
});
