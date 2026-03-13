import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSelector } from 'react-redux';
import { RootState } from '../../shared/state/store';
import * as Clipboard from 'expo-clipboard';
import BottomSheet from './BottomSheet';
import COLORS from '../../assets/colors';
import TYPOGRAPHY from '../../assets/typography';

interface ManageAccountSheetProps {
  visible: boolean;
  onClose: () => void;
}

const ManageAccountSheet: React.FC<ManageAccountSheetProps> = ({ visible, onClose }) => {
  const walletAddress = useSelector((state: RootState) => state.auth.address);
  const username = useSelector((state: RootState) => state.auth.username);
  const displayAddress = walletAddress || '';

  const truncated = displayAddress
    ? `${displayAddress.slice(0, 6)}...${displayAddress.slice(-4)}`
    : 'No wallet connected';

  const handleCopyAddress = async () => {
    if (displayAddress) {
      await Clipboard.setStringAsync(displayAddress);
      Alert.alert('Copied', 'Address copied to clipboard');
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Manage Account">
      <View style={styles.content}>
        <View style={styles.profileSection}>
          <LinearGradient
            colors={['#EF4444', '#F97316']}
            style={styles.avatar}
          >
            <View style={styles.avatarInnerDot} />
          </LinearGradient>

          <Text style={styles.accountName}>{username || 'Account 1'}</Text>

          <TouchableOpacity style={styles.addressRow} onPress={handleCopyAddress} activeOpacity={0.7}>
            <Text style={styles.addressText}>{truncated}</Text>
            <Ionicons name="copy-outline" size={14} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.menuRow} activeOpacity={0.7}>
          <View style={styles.menuRowLeft}>
            <Ionicons name="color-palette-outline" size={20} color={COLORS.textPrimary} />
            <Text style={styles.menuRowText}>Customize Account</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <View style={styles.spacer} />

        <TouchableOpacity style={styles.removeButton} activeOpacity={0.7}>
          <Ionicons name="trash-outline" size={18} color={COLORS.negativeRed} />
          <Text style={styles.removeButtonText}>Remove Account</Text>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingTop: 8,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarInnerDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FCD34D',
  },
  accountName: {
    fontSize: 20,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: COLORS.brandPrimary,
    marginBottom: 6,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 9999,
    backgroundColor: COLORS.secondaryBackground,
  },
  addressText: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.greyBorder,
  },
  menuRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuRowText: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.textPrimary,
  },
  spacer: {
    flex: 1,
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: COLORS.negativeRed,
    marginBottom: 20,
  },
  removeButtonText: {
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.negativeRed,
  },
});

export default ManageAccountSheet;
