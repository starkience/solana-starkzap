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
import { BlurView } from 'expo-blur';
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
  const [rendered, setRendered] = useState(false);
  const navigation = useNavigation<any>();
  const { logout } = useAuth();

  const walletAddress = useSelector((state: RootState) => state.starknet?.walletAddress);

  // Individual animated values for each menu item (slide from right)
  const itemAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  const handleLogout = async () => {
    onClose();
    try {
      await logout();
    } catch (e) {
      navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
    }
  };

  const handleViewOnExplorer = () => {
    if (walletAddress) {
      Linking.openURL(`https://voyager.online/contract/${walletAddress}`);
    }
    onClose();
  };

  const menuItems = [
    { label: 'History', onPress: () => { onClose(); navigation.navigate('History'); } },
    { label: 'Refer a friend', onPress: () => onClose() },
    { label: 'Account', onPress: () => onClose() },
    { label: 'View on Explorer', onPress: handleViewOnExplorer },
    { label: 'Docs', onPress: () => { Linking.openURL('https://docs.axal.com'); onClose(); } },
  ];

  useEffect(() => {
    if (visible) {
      setRendered(true);
      // Reset item anims
      itemAnims.forEach(a => a.setValue(0));

      // Fade in overlay
      Animated.timing(overlayAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();

      // Stagger menu items sliding in from right — fast
      const staggerAnims = itemAnims.map((anim) =>
        Animated.spring(anim, {
          toValue: 1,
          friction: 18,
          tension: 120,
          useNativeDriver: true,
        })
      );
      Animated.stagger(30, staggerAnims).start();
    } else if (rendered) {
      // Fade out
      Animated.timing(overlayAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setRendered(false);
      });
    }
  }, [visible]);

  if (!rendered) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.overlay, { opacity: overlayAnim }]}>
          <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
        </Animated.View>
      </TouchableWithoutFeedback>

      <Animated.View
        style={[styles.menu, { opacity: overlayAnim }]}
        pointerEvents="box-none"
      >
        {/* Close button */}
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>

        {/* Menu items — staggered slide from right */}
        <View style={styles.menuItems}>
          {menuItems.map((item, index) => (
            <Animated.View
              key={index}
              style={{
                opacity: itemAnims[index],
                transform: [{
                  translateX: itemAnims[index].interpolate({
                    inputRange: [0, 1],
                    outputRange: [80, 0],
                  }),
                }],
              }}
            >
              <TouchableOpacity
                style={styles.menuItem}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <Text style={styles.menuItemText}>{item.label}</Text>
              </TouchableOpacity>
            </Animated.View>
          ))}

          {/* Logout — also animated */}
          <Animated.View
            style={{
              opacity: itemAnims[5],
              transform: [{
                translateX: itemAnims[5].interpolate({
                  inputRange: [0, 1],
                  outputRange: [80, 0],
                }),
              }],
            }}
          >
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <Text style={styles.logoutText}>Log out</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  menu: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingRight: 28,
    paddingTop: Platform.OS === 'ios' ? 100 : 80,
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
    gap: 6,
  },
  menuItem: {
    paddingVertical: 10,
  },
  menuItemText: {
    fontSize: 20,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    fontWeight: '500',
    color: COLORS.textPrimary,
    textAlign: 'right',
  },
  logoutText: {
    fontSize: 20,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    fontWeight: '500',
    color: COLORS.negativeRed,
    textAlign: 'right',
    marginTop: 8,
  },
});
