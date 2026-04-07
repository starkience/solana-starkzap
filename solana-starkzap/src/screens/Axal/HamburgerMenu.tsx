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
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { RootState } from '@/shared/state/store';
import { useNavigation } from '@react-navigation/native';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';
import { useAuth } from '@/modules/wallet-providers/hooks/useAuth';

const { width, height } = Dimensions.get('window');

interface HamburgerMenuProps {
  visible: boolean;
  onClose: () => void;
}

export default function HamburgerMenu({ visible, onClose }: HamburgerMenuProps) {
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(height)).current;
  const [rendered, setRendered] = useState(false);
  const navigation = useNavigation<any>();
  const { logout } = useAuth();

  const walletAddress = useSelector((state: RootState) => state.starknet?.walletAddress);

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          onClose();
          try {
            await logout();
          } catch (e) {
            navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
          }
        },
      },
    ]);
  };

  const handleViewOnExplorer = () => {
    if (walletAddress) {
      Linking.openURL(`https://voyager.online/contract/${walletAddress}`);
    }
    onClose();
  };

  useEffect(() => {
    if (visible) {
      setRendered(true);
      Animated.parallel([
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 20,
          tension: 65,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (rendered) {
      Animated.parallel([
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: height,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setRendered(false);
      });
    }
  }, [visible]);

  if (!rendered) return null;

  const menuItems = [
    { label: 'History', onPress: () => { onClose(); navigation.navigate('History'); } },
    { label: 'Refer a friend', onPress: () => onClose() },
    { label: 'Account', onPress: () => onClose() },
    { label: 'View on Explorer', onPress: handleViewOnExplorer },
    { label: 'Docs', onPress: () => { Linking.openURL('https://docs.axal.com'); onClose(); } },
  ];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View
          style={[
            styles.overlay,
            {
              opacity: overlayAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.4],
              }),
            },
          ]}
        />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[
          styles.menu,
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Close button */}
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>

        {/* Menu items */}
        <View style={styles.menuItems}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <Text style={styles.menuItemText}>{item.label}</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  menu: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 40,
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItems: {
    alignItems: 'flex-end',
    gap: 8,
  },
  menuItem: {
    paddingVertical: 12,
  },
  menuItemText: {
    fontSize: 20,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.textPrimary,
    textAlign: 'right',
  },
  logoutText: {
    fontSize: 20,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.negativeRed,
    textAlign: 'right',
    marginTop: 8,
  },
});
