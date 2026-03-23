import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet from './BottomSheet';
import COLORS from '../../assets/colors';
import TYPOGRAPHY from '../../assets/typography';

interface AddFundsSheetProps {
  visible: boolean;
  onClose: () => void;
}

interface FundOption {
  title: string;
  subtitle: string;
  logoUri?: string;
  iconBg: string;
  iconName?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
}

const fundOptions: FundOption[] = [
  {
    title: 'Instant Buy USDC',
    subtitle: 'Buy USDC via credit card, Apple Pay, and more.',
    iconBg: '#1c1c1c',
    iconName: 'card',
    iconColor: '#FFFFFF',
  },
  {
    title: 'Phantom Connect',
    subtitle: 'Connect & transfer.',
    logoUri: 'https://avatars.githubusercontent.com/u/78782331',
    iconBg: '#AB9FF2',
  },
  {
    title: 'Receive Funds',
    subtitle: 'Deposit via the SOL network.',
    logoUri: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
    iconBg: '#000000',
  },
];

const AddFundsSheet: React.FC<AddFundsSheetProps> = ({ visible, onClose }) => {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Add Funds">
      <View style={styles.optionsList}>
        {fundOptions.map((option, index) => (
          <TouchableOpacity
            key={index}
            style={styles.optionRow}
            activeOpacity={0.7}
          >
            <View style={[styles.optionIcon, { backgroundColor: option.iconBg }]}>
              {option.logoUri ? (
                <Image source={{ uri: option.logoUri }} style={styles.logoImage} />
              ) : option.iconName ? (
                <Ionicons name={option.iconName} size={24} color={option.iconColor || '#FFFFFF'} />
              ) : null}
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>{option.title}</Text>
              <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        ))}
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  optionsList: {
    paddingTop: 8,
    gap: 4,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    gap: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  logoImage: {
    width: 48,
    height: 48,
    borderRadius: 14,
    resizeMode: 'cover',
  },
  optionText: {
    flex: 1,
    gap: 3,
  },
  optionTitle: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: COLORS.textPrimary,
  },
  optionSubtitle: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
});

export default AddFundsSheet;
