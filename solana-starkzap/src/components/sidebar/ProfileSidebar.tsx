import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  Platform,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { RootState } from '@/shared/state/store';
import { useNavigation } from '@react-navigation/native';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';
import AddFundsSheet from '@/components/sheets/AddFundsSheet';
import HistorySheet from '@/components/sheets/HistorySheet';
import ManageAccountSheet from '@/components/sheets/ManageAccountSheet';
import { useAuth } from '@/modules/wallet-providers/hooks/useAuth';

const { width } = Dimensions.get('window');
const SIDEBAR_WIDTH = width * 0.82;

interface ProfileSidebarProps {
  visible: boolean;
  onClose: () => void;
}

interface MenuItem {
  iconName: keyof typeof Ionicons.glyphMap;
  label: string;
  badge?: string;
  onPress?: () => void;
}

export default function ProfileSidebar({ visible, onClose }: ProfileSidebarProps) {
  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const [rendered, setRendered] = useState(false);
  const navigation = useNavigation<any>();
  const { logout } = useAuth();

  const [addFundsVisible, setAddFundsVisible] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [manageVisible, setManageVisible] = useState(false);

  const walletAddress = useSelector((state: RootState) => state.auth.address);
  const username = useSelector((state: RootState) => state.auth.username);

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            onClose();
            try {
              await logout();
            } catch (e) {
              navigation.reset({ index: 0, routes: [{ name: 'LoginOptions' }] });
            }
          },
        },
      ],
    );
  };

  const truncateAddress = (addr: string | null) => {
    if (!addr) return 'Not connected';
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  useEffect(() => {
    if (visible) {
      setRendered(true);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 20,
          tension: 65,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (rendered) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -SIDEBAR_WIDTH,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          setRendered(false);
        }
      });
    }
  }, [visible]);

  const accountMenuItems: MenuItem[] = [
    { iconName: 'briefcase-outline', label: 'Manage', onPress: () => { onClose(); setTimeout(() => setManageVisible(true), 300); } },
    { iconName: 'card-outline', label: 'Add Funds', onPress: () => { onClose(); setTimeout(() => setAddFundsVisible(true), 300); } },
    { iconName: 'radio-outline', label: 'Radar', onPress: () => { onClose(); } },
    { iconName: 'time-outline', label: 'History', onPress: () => { onClose(); setTimeout(() => setHistoryVisible(true), 300); } },
  ];

  const whatsNewItems: MenuItem[] = [
    {
      iconName: 'cash-outline',
      label: 'Earn',
      onPress: () => {
        onClose();
        navigation.navigate('EarnScreen');
      },
    },
    { iconName: 'sparkles-outline', label: 'Prediction', badge: 'Beta', onPress: () => { onClose(); } },
    { iconName: 'image-outline', label: 'NFTs', badge: 'Beta', onPress: () => { onClose(); } },
  ];

  if (!rendered && !addFundsVisible && !historyVisible && !manageVisible) return null;

  return (
    <>
      {rendered && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <TouchableWithoutFeedback onPress={onClose}>
            <Animated.View
              style={[
                styles.overlay,
                { opacity: overlayAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }) },
              ]}
            />
          </TouchableWithoutFeedback>

          <Animated.View
            style={[
              styles.sidebar,
              { transform: [{ translateX: slideAnim }] },
            ]}
          >
            <View style={styles.accountHeader}>
              <View style={styles.accountRow}>
                <LinearGradient
                  colors={['#EF4444', '#F97316']}
                  style={styles.avatar}
                >
                  <View style={styles.avatarInnerDot} />
                </LinearGradient>
                <View style={styles.accountInfo}>
                  <Text style={styles.accountName}>{username || 'Account 1'}</Text>
                  <View style={styles.addressRow}>
                    <Text style={styles.accountAddress}>
                      {truncateAddress(walletAddress)}
                    </Text>
                    <TouchableOpacity style={styles.copyBtn}>
                      <Ionicons name="settings-outline" size={14} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>
                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                  <Ionicons name="log-out-outline" size={14} color={COLORS.white} style={{ marginRight: 4 }} />
                  <Text style={styles.logoutButtonText}>Log Out</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.menuSection}>
              <Text style={styles.sectionLabel}>Account</Text>
              {accountMenuItems.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.menuItem}
                  onPress={item.onPress}
                  activeOpacity={0.7}
                >
                  <View style={styles.menuIconContainer}>
                    <Ionicons name={item.iconName} size={20} color={COLORS.textPrimary} />
                  </View>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  {item.badge && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.badge}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.menuSection}>
              <Text style={styles.sectionLabel}>What's New</Text>
              {whatsNewItems.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.menuItem}
                  onPress={item.onPress}
                  activeOpacity={0.7}
                >
                  <View style={styles.menuIconContainer}>
                    <Ionicons name={item.iconName} size={20} color={COLORS.textPrimary} />
                  </View>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  {item.badge && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.badge}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.bottomActions}>
              <TouchableOpacity style={styles.bottomButton}>
                <Ionicons name="chatbubble-ellipses-outline" size={16} color={COLORS.brandPrimary} />
                <Text style={styles.bottomButtonText}>Get help</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.bottomButton}>
                <Ionicons name="settings-outline" size={16} color={COLORS.brandPrimary} />
                <Text style={styles.bottomButtonText}>Settings</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      )}

      <AddFundsSheet visible={addFundsVisible} onClose={() => setAddFundsVisible(false)} />
      <HistorySheet visible={historyVisible} onClose={() => setHistoryVisible(false)} />
      <ManageAccountSheet visible={manageVisible} onClose={() => setManageVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    justifyContent: 'flex-start',
  },
  accountHeader: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.greyBorder,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInnerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FCD34D',
  },
  accountInfo: {
    flex: 1,
    marginLeft: 12,
  },
  accountName: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: COLORS.textPrimary,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  accountAddress: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
  },
  copyBtn: {
    padding: 2,
  },
  logoutButton: {
    backgroundColor: COLORS.brandPrimary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoutButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
  },
  menuSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    marginBottom: 16,
    textTransform: 'capitalize',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  menuIconContainer: {
    width: 30,
    alignItems: 'center',
  },
  menuLabel: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    flex: 1,
  },
  badge: {
    backgroundColor: COLORS.brandPrimary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.greyBorder,
    gap: 16,
  },
  bottomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 9999,
    backgroundColor: COLORS.secondaryBackground,
  },
  bottomButtonText: {
    fontSize: 14,
    color: COLORS.brandPrimary,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
  },
});
