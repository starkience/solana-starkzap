import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { RootState } from '../../shared/state/store';
import * as Clipboard from 'expo-clipboard';
import BottomSheet from './BottomSheet';
import COLORS from '../../assets/colors';
import TYPOGRAPHY from '../../assets/typography';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

let QRCode: any = null;
try {
  QRCode = require('react-native-qrcode-svg').default;
} catch (e) {
  // QRCode not available
}

interface ReceiveSheetProps {
  visible: boolean;
  onClose: () => void;
}

const ReceiveSheet: React.FC<ReceiveSheetProps> = ({ visible, onClose }) => {
  const walletAddress = useSelector((state: RootState) => state.auth.address);
  const displayAddress = walletAddress || '';

  const truncated = displayAddress
    ? `${displayAddress.slice(0, 8)}...${displayAddress.slice(-8)}`
    : 'No wallet connected';

  const handleCopy = async () => {
    if (displayAddress) {
      await Clipboard.setStringAsync(displayAddress);
      Alert.alert('Copied', 'Wallet address copied to clipboard');
    }
  };

  const handleShare = async () => {
    if (displayAddress) {
      await Share.share({
        message: displayAddress,
        title: 'My Solana Address',
      });
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Receive" height={SCREEN_HEIGHT * 0.75}>
      <View style={styles.content}>
        <Text style={styles.depositLabel}>Solana Deposit address:</Text>

        <View style={styles.qrContainer}>
          {QRCode && displayAddress ? (
            <QRCode
              value={displayAddress}
              size={200}
              color="#1c1c1c"
              backgroundColor={COLORS.white}
            />
          ) : (
            <View style={styles.qrPlaceholder}>
              <Ionicons name="qr-code" size={140} color={COLORS.brandPrimary} />
            </View>
          )}
        </View>

        <Text style={styles.addressText}>{displayAddress || truncated}</Text>

        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.actionButton} onPress={handleShare} activeOpacity={0.7}>
            <Ionicons name="share-outline" size={18} color={COLORS.brandPrimary} />
            <Text style={styles.actionButtonText}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleCopy} activeOpacity={0.7}>
            <Ionicons name="copy-outline" size={18} color={COLORS.brandPrimary} />
            <Text style={styles.actionButtonText}>Copy</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.claimButton} activeOpacity={0.8}>
          <Text style={styles.claimButtonText}>Claim Code</Text>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 24,
  },
  depositLabel: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  qrContainer: {
    padding: 20,
    backgroundColor: '#0A1628',
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  qrPlaceholder: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressText: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
    marginBottom: 28,
    letterSpacing: 0.2,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
    width: '100%',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  actionButtonText: {
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.white,
  },
  claimButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 9999,
    backgroundColor: COLORS.brandPrimary,
    alignItems: 'center',
  },
  claimButtonText: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: '#0B1A2B',
  },
});

export default ReceiveSheet;
