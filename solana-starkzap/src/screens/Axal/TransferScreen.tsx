import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppNavigation } from '@/shared/hooks/useAppNavigation';
import { useSelector } from 'react-redux';
import { RootState } from '@/shared/state/store';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';
import { useBaseWallet } from '@/modules/wallet-providers/hooks/useBaseWallet';
import QRCode from 'react-native-qrcode-svg';
import { getEVMUSDCBalance } from '@/modules/bridge/services/evmBalanceService';

export default function TransferScreen({ route }: any) {
  const navigation = useAppNavigation();
  const [copied, setCopied] = useState(false);
  const network = route?.params?.network || 'Starknet';
  const starknetAddress = useSelector((state: RootState) => state.starknet?.walletAddress);
  const { address: baseWalletAddress } = useBaseWallet();

  const isStarknetDirect = network === 'Starknet';
  const isEVMChain = ['Base', 'Arbitrum', 'Ethereum', 'Polygon', 'Monad'].includes(network);

  // Show the appropriate wallet address based on network:
  // - Starknet: show Starknet address (direct deposit)
  // - EVM chains (Base, Arbitrum, etc.): show Privy embedded EVM wallet address
  //   (same address works on all EVM chains — user deposits USDC there,
  //    then the app auto-bridges to Starknet when they tap Earn)
  const depositAddress = isEVMChain
    ? (baseWalletAddress || '')
    : (starknetAddress || '');

  const truncatedAddress = depositAddress
    ? `${depositAddress.slice(0, 6)}..........${depositAddress.slice(-6)}`
    : 'Loading wallet...';

  const processingTime = isStarknetDirect ? '~30 seconds' : '~2-5 minutes';
  const minDeposit = '2.00 USDC';

  // Fetch real balance for EVM chains
  const [balance, setBalance] = useState('0.00');
  useEffect(() => {
    if (isEVMChain && baseWalletAddress) {
      getEVMUSDCBalance(baseWalletAddress, network.toLowerCase()).then(setBalance);
      const interval = setInterval(() => {
        getEVMUSDCBalance(baseWalletAddress, network.toLowerCase()).then(setBalance);
      }, 15000);
      return () => clearInterval(interval);
    }
  }, [isEVMChain, baseWalletAddress, network]);

  const handleCopyAddress = useCallback(async () => {
    if (depositAddress) {
      await Clipboard.setStringAsync(depositAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [depositAddress]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Transfer USDC</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <Ionicons name="close" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Balance */}
          <Text style={styles.balanceLabel}>Balance: ${balance}</Text>

          {/* Warning */}
          <View style={styles.warningRow}>
            {isStarknetDirect ? (
              <Text style={styles.warningText}>
                IMPORTANT: Only deposit USDC on the{' '}
                <Text style={styles.warningBold}>Starknet Network</Text>
              </Text>
            ) : (
              <Text style={styles.warningText}>
                IMPORTANT: Only deposit USDC on the{' '}
                <Text style={styles.warningBold}>{network} Network</Text>
                {'\n'}When you tap Earn, funds are automatically bridged to Starknet and invested.
              </Text>
            )}
          </View>

          {/* QR Code */}
          <View style={styles.qrContainer}>
            {depositAddress ? (
              <QRCode
                value={depositAddress}
                size={160}
                backgroundColor="#FFFFFF"
                color={COLORS.textPrimary}
              />
            ) : (
              <View style={styles.qrPlaceholder}>
                <Ionicons name="qr-code-outline" size={120} color={COLORS.textPrimary} />
              </View>
            )}
          </View>

          {/* Copy address */}
          <TouchableOpacity style={styles.copyButton} onPress={handleCopyAddress}>
            <Ionicons
              name={copied ? 'checkmark-circle' : 'copy-outline'}
              size={18}
              color={COLORS.positiveGreen}
            />
            <Text style={styles.copyText}>
              {!depositAddress ? 'Loading...' : copied ? 'Address Copied!' : 'Copy Address'}
            </Text>
          </TouchableOpacity>

          {/* Details */}
          <View style={styles.detailsSection}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>
                {isStarknetDirect ? 'Deposit Address:' : `${network} Deposit Address:`}
              </Text>
              <Text style={styles.detailValue}>{truncatedAddress}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Network:</Text>
              <Text style={styles.detailValue}>{network}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Minimum Deposit:</Text>
              <Text style={styles.detailValue}>{minDeposit}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Processing Time:</Text>
              <Text style={styles.detailValue}>{processingTime}</Text>
            </View>
            {!isStarknetDirect && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Bridge:</Text>
                <Text style={styles.detailValue}>LayerZero</Text>
              </View>
            )}
          </View>
        </View>

        {/* Done button */}
        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => navigation.navigate('Dashboard' as never)}
          >
            <Text style={styles.doneButtonText}>Done</Text>
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
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  warningRow: {
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  warningText: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  warningBold: {
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  qrContainer: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.greyBorder,
    marginBottom: 16,
  },
  qrPlaceholder: {
    width: 160,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 59, 0.10)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
    marginBottom: 32,
  },
  copyText: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.positiveGreen,
  },
  detailsSection: {
    width: '100%',
    gap: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.textPrimary,
  },
  bottomSection: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  doneButton: {
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.brandPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
});
