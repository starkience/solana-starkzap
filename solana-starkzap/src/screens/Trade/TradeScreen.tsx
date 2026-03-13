import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useWallet } from '@/modules/wallet-providers/hooks/useWallet';
import { useSwapLogic } from '@/modules/swap/hooks/useSwapLogic';
import {
  DEFAULT_SOL_TOKEN,
  DEFAULT_USDC_TOKEN,
  TokenInfo,
} from '@/modules/data-module';
import {
  fetchJupiterPrice,
  fetchPriceHistoryFree,
  getCoinGeckoIdForMint,
} from '@/services/freeDataService';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';
import ProfileSidebar from '@/components/sidebar/ProfileSidebar';
import { useDispatch } from 'react-redux';
import { addTransaction } from '@/shared/state/history/reducer';

const { width } = Dimensions.get('window');

type OrderType = 'Market' | 'Limit' | 'Recurring' | 'Perps';

const JUP_TOKEN: TokenInfo = {
  address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  symbol: 'JUP',
  name: 'Jupiter',
  decimals: 6,
  logoURI: 'https://static.jup.ag/jup/icon.png',
};

const BONK_TOKEN: TokenInfo = {
  address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  symbol: 'BONK',
  name: 'Bonk',
  decimals: 5,
  logoURI: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I',
};

const QUICK_TOKENS: TokenInfo[] = [DEFAULT_SOL_TOKEN, DEFAULT_USDC_TOKEN, JUP_TOKEN, BONK_TOKEN];


export default function TradeScreen() {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const {
    publicKey: userPublicKey,
    connected,
    sendTransaction,
    sendBase64Transaction,
  } = useWallet();

  const [orderType, setOrderType] = useState<OrderType>('Market');
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [swapAmount, setSwapAmount] = useState('');

  const swapLogic = useSwapLogic(
    {},
    userPublicKey,
    connected,
    { sendTransaction, sendBase64Transaction },
    navigation,
  );

  const {
    inputToken,
    outputToken,
    inputValue,
    setInputValue,
    currentBalance,
    currentTokenPrice,
    estimatedOutputAmount,
    outputTokenUsdValue,
    loading: swapLoading,
    resultMsg,
    errorMsg,
    solscanTxSig,
    activeProvider,
    setActiveProvider,
    handleSwap,
    handleTokenSelected,
    setShowSelectTokenModal,
    selectingWhichSide,
    setSelectingWhichSide,
  } = swapLogic;

  useEffect(() => {
    if (solscanTxSig && resultMsg) {
      dispatch(addTransaction({
        id: solscanTxSig,
        type: 'swap',
        token: `${inputToken?.symbol || '?'} → ${outputToken?.symbol || '?'}`,
        amount: `${inputValue} ${inputToken?.symbol || ''}`,
        txHash: solscanTxSig,
        status: 'confirmed',
        timestamp: new Date().toISOString(),
        protocol: activeProvider,
        explorerUrl: `https://solscan.io/tx/${solscanTxSig}`,
      }));
    }
  }, [solscanTxSig, resultMsg]);

  const [graphData, setGraphData] = useState<number[]>([]);
  const [loadingOHLC, setLoadingOHLC] = useState(false);
  const [livePrice, setLivePrice] = useState(0);
  const [priceChangePercent, setPriceChangePercent] = useState(0);

  useEffect(() => {
    if (!inputToken?.address) return;

    const loadChart = async () => {
      setLoadingOHLC(true);
      try {
        const price = await fetchJupiterPrice(inputToken.address);
        setLivePrice(price);

        const geckoId = getCoinGeckoIdForMint(inputToken.address);
        if (geckoId) {
          const history = await fetchPriceHistoryFree(geckoId, '1');
          if (history.prices.length > 0) {
            setGraphData(history.prices);
            const first = history.prices[0];
            const last = history.prices[history.prices.length - 1];
            setPriceChangePercent(first > 0 ? ((last - first) / first) * 100 : 0);
          }
        }
      } catch (err) {
        console.error('Chart load error:', err);
      } finally {
        setLoadingOHLC(false);
      }
    };

    loadChart();
  }, [inputToken?.address]);


  const onExecuteSwap = useCallback(() => {
    if (!connected) {
      Alert.alert('Not Connected', 'Please connect your wallet first.');
      return;
    }
    if (!inputValue || parseFloat(inputValue) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid swap amount.');
      return;
    }
    handleSwap();
  }, [connected, inputValue, handleSwap]);

  const openSolscan = (sig: string) => {
    Linking.openURL(`https://solscan.io/tx/${sig}`);
  };

  const renderMiniChart = () => {
    if (!graphData || graphData.length === 0) {
      return (
        <View style={styles.chartPlaceholder}>
          {loadingOHLC ? (
            <ActivityIndicator color={COLORS.brandPrimary} />
          ) : (
            <Text style={styles.chartPlaceholderText}>No chart data</Text>
          )}
        </View>
      );
    }

    const chartW = width - 40;
    const chartH = 160;
    const min = Math.min(...graphData);
    const max = Math.max(...graphData);
    const range = max - min || 1;

    const points = graphData.map((val, i) => {
      const x = (i / (graphData.length - 1)) * chartW;
      const y = chartH - ((val - min) / range) * (chartH - 20) - 10;
      return { x, y };
    });

    const isPositive = graphData[graphData.length - 1] >= graphData[0];
    const lineColor = isPositive ? COLORS.positiveGreen : COLORS.errorRed;

    return (
      <View style={[styles.chartContainer, { height: chartH }]}>
        {points.map((point, i) => {
          if (i === 0) return null;
          const prev = points[i - 1];
          const dx = point.x - prev.x;
          const dy = point.y - prev.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);

          return (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: prev.x,
                top: prev.y,
                width: length,
                height: 2,
                backgroundColor: lineColor,
                transform: [{ rotate: `${angle}deg` }],
                transformOrigin: 'left center',
              }}
            />
          );
        })}
        <Text style={[styles.chartLabel, { top: 0, right: 0 }]}>
          ${max.toFixed(2)}
        </Text>
        <Text style={[styles.chartLabel, { bottom: 0, right: 0 }]}>
          ${min.toFixed(2)}
        </Text>
      </View>
    );
  };

  const currentPrice = livePrice || currentTokenPrice || 0;
  const priceChange = priceChangePercent || 0;

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
          <Text style={styles.headerTitle}>Trade</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.orderTypeTabs}>
            {(['Market', 'Limit', 'Recurring', 'Perps'] as OrderType[]).map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.orderTypeTab, orderType === type && styles.orderTypeTabActive]}
                onPress={() => setOrderType(type)}
              >
                <Text style={[styles.orderTypeText, orderType === type && styles.orderTypeTextActive]}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tokenScrollView}>
            <View style={styles.assetTabs}>
              {QUICK_TOKENS.map((token) => (
                <TouchableOpacity
                  key={token.address}
                  style={[
                    styles.assetTab,
                    inputToken?.address === token.address && styles.assetTabActive,
                  ]}
                  onPress={() => {
                    setSelectingWhichSide('input');
                    handleTokenSelected(token);
                  }}
                >
                  {token.logoURI ? (
                    <Image source={{ uri: token.logoURI }} style={styles.assetIcon} />
                  ) : null}
                  <Text
                    style={[
                      styles.assetTabText,
                      inputToken?.address === token.address && styles.assetTabTextActive,
                    ]}
                  >
                    {token.symbol}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={styles.priceSection}>
            <View style={styles.priceLeft}>
              <Text style={styles.priceMain}>
                {currentPrice > 0
                  ? `$${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : '--'}
              </Text>
              <View style={styles.priceChangeRow}>
                <Text
                  style={[
                    styles.priceChange,
                    { color: priceChange >= 0 ? COLORS.positiveGreen : COLORS.errorRed },
                  ]}
                >
                  {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                </Text>
              </View>
            </View>
            <View style={styles.priceRight}>
              <Text style={styles.priceStatLabel}>
                Balance: {currentBalance !== null ? currentBalance.toFixed(4) : '--'} {inputToken?.symbol || ''}
              </Text>
            </View>
          </View>

          {renderMiniChart()}

          <View style={styles.swapCard}>
            <View style={styles.swapRow}>
              <TouchableOpacity
                style={styles.tokenSelector}
                onPress={() => {
                  setSelectingWhichSide('input');
                  setShowSelectTokenModal(true);
                }}
              >
                {inputToken?.logoURI ? (
                  <Image source={{ uri: inputToken.logoURI }} style={styles.swapTokenIcon} />
                ) : null}
                <Text style={styles.swapTokenText}>{inputToken?.symbol || 'Select'}</Text>
                <Ionicons name="chevron-down" size={14} color={COLORS.textSecondary} />
              </TouchableOpacity>
              <TextInput
                style={styles.amountInput}
                value={inputValue}
                onChangeText={setInputValue}
                placeholder="0.00"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.swapDivider}>
              <View style={styles.swapArrowCircle}>
                <Ionicons name="swap-vertical" size={18} color={COLORS.brandPrimary} />
              </View>
            </View>

            <View style={styles.swapRow}>
              <TouchableOpacity
                style={styles.tokenSelector}
                onPress={() => {
                  setSelectingWhichSide('output');
                  setShowSelectTokenModal(true);
                }}
              >
                {outputToken?.logoURI ? (
                  <Image source={{ uri: outputToken.logoURI }} style={styles.swapTokenIcon} />
                ) : null}
                <Text style={styles.swapTokenText}>{outputToken?.symbol || 'Select'}</Text>
                <Ionicons name="chevron-down" size={14} color={COLORS.textSecondary} />
              </TouchableOpacity>
              <View style={styles.outputValueContainer}>
                <Text style={styles.outputValue}>
                  {estimatedOutputAmount || '0.00'}
                </Text>
                <Text style={styles.outputUsd}>{outputTokenUsdValue}</Text>
              </View>
            </View>

            <View style={styles.providerRow}>
              <Text style={styles.providerLabel}>via</Text>
              <TouchableOpacity
                style={styles.providerBtn}
                onPress={() =>
                  setActiveProvider(activeProvider === 'JupiterUltra' ? 'Raydium' : 'JupiterUltra')
                }
              >
                <Text style={styles.providerText}>{activeProvider}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {errorMsg ? (
            <View style={styles.statusBox}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}
          {resultMsg ? (
            <View style={[styles.statusBox, styles.successBox]}>
              <Text style={styles.successText}>{resultMsg}</Text>
              {solscanTxSig ? (
                <TouchableOpacity onPress={() => openSolscan(solscanTxSig)}>
                  <Text style={styles.txLink}>
                    View on Solscan: {solscanTxSig.slice(0, 12)}...
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.swapButton, swapLoading && styles.swapButtonDisabled]}
            onPress={onExecuteSwap}
            disabled={swapLoading}
            activeOpacity={0.8}
          >
            {swapLoading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.swapButtonText}>
                {connected ? `Swap via ${activeProvider}` : 'Connect Wallet'}
              </Text>
            )}
          </TouchableOpacity>

          <View style={{ height: 120 }} />
        </ScrollView>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  avatarButton: { width: 32, height: 32 },
  avatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  avatarDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ADE80',
    position: 'absolute', top: 0, right: 0, borderWidth: 1.5, borderColor: COLORS.background,
  },
  headerTitle: { fontSize: 18, fontFamily: TYPOGRAPHY.fontFamilyBold, color: '#1c1c1c' },
  scrollView: { flex: 1 },
  orderTypeTabs: {
    flexDirection: 'row', marginHorizontal: 16, backgroundColor: COLORS.secondaryBackground,
    borderRadius: 9999, padding: 3, marginBottom: 16,
  },
  orderTypeTab: { flex: 1, paddingVertical: 10, borderRadius: 9999, alignItems: 'center' },
  orderTypeTabActive: { backgroundColor: COLORS.white },
  orderTypeText: { fontSize: 14, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamilyMedium },
  orderTypeTextActive: { color: '#1c1c1c', fontFamily: TYPOGRAPHY.fontFamilyBold },
  tokenScrollView: { marginBottom: 16 },
  assetTabs: { flexDirection: 'row', paddingHorizontal: 16, gap: 8 },
  assetTab: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 9999, backgroundColor: COLORS.secondaryBackground, gap: 8,
    borderWidth: 1, borderColor: 'transparent',
  },
  assetTabActive: { borderColor: COLORS.brandPrimary, backgroundColor: COLORS.brandPrimaryLight },
  assetIcon: { width: 24, height: 24, borderRadius: 12 },
  assetTabText: { fontSize: 14, color: '#1c1c1c', fontFamily: TYPOGRAPHY.fontFamilyMedium },
  assetTabTextActive: { color: COLORS.brandPrimary },
  priceSection: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    paddingHorizontal: 16, marginBottom: 12,
  },
  priceLeft: {},
  priceMain: { fontSize: 28, fontFamily: TYPOGRAPHY.fontFamilyBold, color: '#1c1c1c', marginBottom: 4 },
  priceChangeRow: { flexDirection: 'row', gap: 8 },
  priceChange: { fontSize: 14, fontFamily: TYPOGRAPHY.fontFamilyMedium },
  priceRight: { alignItems: 'flex-end' },
  priceStatLabel: { fontSize: 12, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamily },
  chartContainer: { marginHorizontal: 16, marginBottom: 16, position: 'relative' },
  chartPlaceholder: {
    marginHorizontal: 16, height: 120, marginBottom: 16,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.secondaryBackground, borderRadius: 16,
  },
  chartPlaceholderText: { color: COLORS.textSecondary, fontSize: 13, fontFamily: TYPOGRAPHY.fontFamily },
  chartLabel: { position: 'absolute', fontSize: 10, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamily },
  swapCard: {
    marginHorizontal: 16, backgroundColor: COLORS.white,
    borderRadius: 20, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  swapRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8,
  },
  tokenSelector: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.secondaryBackground, paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 9999,
  },
  swapTokenIcon: { width: 24, height: 24, borderRadius: 12 },
  swapTokenText: { fontSize: 15, fontFamily: TYPOGRAPHY.fontFamilyBold, color: '#1c1c1c' },
  amountInput: {
    flex: 1, textAlign: 'right', fontSize: 24, fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: '#1c1c1c', marginLeft: 16,
  },
  swapDivider: { alignItems: 'center', paddingVertical: 4 },
  swapArrowCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.secondaryBackground, justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: COLORS.white,
  },
  outputValueContainer: { flex: 1, alignItems: 'flex-end', marginLeft: 16 },
  outputValue: { fontSize: 24, fontFamily: TYPOGRAPHY.fontFamilyBold, color: '#1c1c1c' },
  outputUsd: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2, fontFamily: TYPOGRAPHY.fontFamily },
  providerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    paddingTop: 8, gap: 8,
  },
  providerLabel: { fontSize: 12, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamily },
  providerBtn: {
    backgroundColor: COLORS.secondaryBackground, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 9999,
  },
  providerText: { fontSize: 12, color: COLORS.brandPrimary, fontFamily: TYPOGRAPHY.fontFamilyMedium },
  statusBox: {
    marginHorizontal: 16, padding: 12, borderRadius: 16, marginBottom: 12,
    backgroundColor: COLORS.errorRed + '10', borderWidth: 1, borderColor: COLORS.errorRed + '30',
  },
  successBox: {
    backgroundColor: COLORS.positiveGreen + '10',
    borderColor: COLORS.positiveGreen + '30',
  },
  errorText: { color: COLORS.errorRed, fontSize: 13, fontFamily: TYPOGRAPHY.fontFamily },
  successText: { color: COLORS.positiveGreen, fontSize: 13, fontFamily: TYPOGRAPHY.fontFamilyMedium },
  txLink: { color: COLORS.brandPrimary, fontSize: 12, marginTop: 6, textDecorationLine: 'underline', fontFamily: TYPOGRAPHY.fontFamily },
  swapButton: {
    marginHorizontal: 16, backgroundColor: COLORS.brandPrimary,
    paddingVertical: 16, borderRadius: 9999, alignItems: 'center', marginBottom: 16,
  },
  swapButtonDisabled: { opacity: 0.6 },
  swapButtonText: { color: COLORS.white, fontSize: 16, fontFamily: TYPOGRAPHY.fontFamilyBold },
});
