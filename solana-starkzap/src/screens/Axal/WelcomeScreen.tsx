import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAppNavigation } from '@/shared/hooks/useAppNavigation';
import { useSelector } from 'react-redux';
import { RootState } from '@/shared/state/store';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';
import Svg, { Rect, Polygon, G } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/** Isometric 3D bar — draws a front face, top face, and right face */
function IsoBar({ x, height, width: w, color, lightColor, darkColor }: {
  x: number; height: number; width: number;
  color: string; lightColor: string; darkColor: string;
}) {
  const topOffset = 6;
  const sideOffset = 6;
  const y = 180 - height;

  // Front face
  const front = `${x},${y} ${x + w},${y} ${x + w},${180} ${x},${180}`;
  // Top face (isometric)
  const top = `${x},${y} ${x + sideOffset},${y - topOffset} ${x + w + sideOffset},${y - topOffset} ${x + w},${y}`;
  // Right face
  const right = `${x + w},${y} ${x + w + sideOffset},${y - topOffset} ${x + w + sideOffset},${180 - topOffset} ${x + w},${180}`;

  return (
    <G>
      <Polygon points={front} fill={color} />
      <Polygon points={top} fill={lightColor} />
      <Polygon points={right} fill={darkColor} />
    </G>
  );
}

export default function WelcomeScreen() {
  const navigation = useAppNavigation();
  const isLoggedIn = useSelector((state: RootState) => state.auth.isLoggedIn);

  useEffect(() => {
    if (isLoggedIn) {
      navigation.reset({ index: 0, routes: [{ name: 'Dashboard' as never }] });
    }
  }, [isLoggedIn]);

  // Bar data — heights as percentages
  const bars = [
    0.30, 0.50, 0.40, 0.70, 0.45, 0.80, 0.35, 0.60, 0.90, 0.55, 0.75, 0.42,
    0.32, 0.55, 0.48, 0.72, 0.50, 0.85, 0.38, 0.65, 0.95, 0.58, 0.78, 0.45,
  ];
  const barWidth = 10;
  const barGap = 2;
  const illustrationWidth = bars.length * (barWidth + barGap);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        {/* Top section */}
        <View style={styles.topSection}>
          {/* Logo — Axal diamond icon (two overlapping diamonds) */}
          <View style={styles.logoRow}>
            <View style={styles.logoContainer}>
              <View style={[styles.logoDiamond, styles.logoDiamondBack]} />
              <View style={[styles.logoDiamond, styles.logoDiamondFront]} />
            </View>
          </View>

          {/* Headline */}
          <Text style={styles.headline}>Earn</Text>
          <Text style={styles.headline}>More</Text>
        </View>

        {/* Isometric 3D bar chart illustration */}
        <View style={styles.illustrationContainer}>
          <Svg
            width={illustrationWidth + 10}
            height={200}
            viewBox={`0 0 ${illustrationWidth + 10} 200`}
          >
            {/* Base platform line */}
            <Rect x={0} y={180} width={illustrationWidth + 10} height={1} fill="#E0E0E0" />
            {bars.map((h, i) => {
              const barH = h * 140;
              const shade = i % 3;
              const colors = shade === 0
                ? { color: '#C8E6C9', lightColor: '#E8F5E9', darkColor: '#A5D6A7' }
                : shade === 1
                ? { color: '#81C784', lightColor: '#C8E6C9', darkColor: '#66BB6A' }
                : { color: '#4CAF50', lightColor: '#81C784', darkColor: '#388E3C' };
              return (
                <IsoBar
                  key={i}
                  x={i * (barWidth + barGap)}
                  height={barH}
                  width={barWidth}
                  {...colors}
                />
              );
            })}
          </Svg>
        </View>

        {/* Tagline */}
        <Text style={styles.tagline}>
          <Text style={styles.taglineBold}>Earn real yield,</Text>
          {' '}on your terms.
        </Text>

        {/* Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => navigation.navigate('LoginOptions' as never)}
            activeOpacity={0.8}
          >
            <Text style={styles.loginButtonText}>Log In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.signUpButton}
            onPress={() => navigation.navigate('LoginOptions' as never)}
            activeOpacity={0.8}
          >
            <Text style={styles.signUpButtonText}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
    paddingBottom: 36,
    paddingTop: 12,
  },
  topSection: {},
  logoRow: {
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  logoContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoDiamond: {
    position: 'absolute',
    width: 18,
    height: 18,
    backgroundColor: COLORS.textPrimary,
    transform: [{ rotate: '45deg' }],
    borderRadius: 2,
  },
  logoDiamondBack: {
    top: 6,
    left: 6,
    opacity: 0.3,
  },
  logoDiamondFront: {
    top: 12,
    left: 14,
    opacity: 1,
  },
  headline: {
    fontSize: 56,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    fontWeight: '800',
    color: COLORS.textPrimary,
    lineHeight: 60,
    letterSpacing: -1,
  },
  illustrationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  tagline: {
    fontSize: 17,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: '#9E9E9E',
    textAlign: 'center',
    lineHeight: 24,
  },
  taglineBold: {
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  loginButton: {
    flex: 1,
    height: 54,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: COLORS.textPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loginButtonText: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  signUpButton: {
    flex: 1,
    height: 54,
    borderRadius: 9999,
    backgroundColor: COLORS.brandPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signUpButtonText: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
});
