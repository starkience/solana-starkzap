import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Animated,
  Easing,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {Ionicons} from '@expo/vector-icons';
import COLORS from '../assets/colors';
import TYPOGRAPHY from '../assets/typography';
import type {LifecycleStep, LifecycleStepStatus} from '../shared/state/history/reducer';

interface TransactionLifecycleProps {
  steps: LifecycleStep[];
  compact?: boolean;
  starknetAddress?: string | null;
}

const STEP_COLORS: Record<LifecycleStepStatus, string> = {
  pending: COLORS.greyDark,
  active: COLORS.brandPrimary,
  complete: COLORS.positiveGreen,
  error: COLORS.errorRed,
};

function StepIndicator({status}: {status: LifecycleStepStatus}) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (status === 'active') {
      const loop = Animated.loop(
        Animated.timing(spin, {
          toValue: 1,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      loop.start();
      return () => loop.stop();
    }
    spin.setValue(0);
  }, [status, spin]);

  const rotation = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const color = STEP_COLORS[status];
  const size = 28;

  if (status === 'complete') {
    return (
      <View style={[indicatorStyles.circle, {width: size, height: size, backgroundColor: color}]}>
        <Ionicons name="checkmark" size={16} color={COLORS.white} />
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={[indicatorStyles.circle, {width: size, height: size, backgroundColor: color}]}>
        <Ionicons name="close" size={16} color={COLORS.white} />
      </View>
    );
  }

  if (status === 'active') {
    return (
      <View style={[indicatorStyles.circle, {width: size, height: size, borderWidth: 2.5, borderColor: color, backgroundColor: 'transparent'}]}>
        <Animated.View style={{transform: [{rotate: rotation}]}}>
          <Ionicons name="reload" size={14} color={color} />
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={[indicatorStyles.circle, {width: size, height: size, borderWidth: 2, borderColor: COLORS.greyBorder, backgroundColor: 'transparent'}]}>
      <View style={indicatorStyles.innerDot} />
    </View>
  );
}

const indicatorStyles = StyleSheet.create({
  circle: {
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.greyBorder,
  },
});

const TransactionLifecycle: React.FC<TransactionLifecycleProps> = ({steps, compact = false, starknetAddress}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyAddress = async () => {
    if (!starknetAddress) return;
    await Clipboard.setStringAsync(starknetAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const truncatedAddress = starknetAddress
    ? `${starknetAddress.slice(0, 10)}...${starknetAddress.slice(-8)}`
    : '';

  return (
    <View style={styles.container}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const color = STEP_COLORS[step.status];

        return (
          <View key={step.id} style={styles.stepRow}>
            <View style={styles.indicatorCol}>
              <StepIndicator status={step.status} />
              {(!isLast || starknetAddress) && (
                <View
                  style={[
                    styles.connector,
                    {
                      backgroundColor:
                        step.status === 'complete'
                          ? COLORS.positiveGreen + '40'
                          : COLORS.greyBorder,
                    },
                  ]}
                />
              )}
            </View>

            <View style={[styles.content, (!isLast || starknetAddress) && styles.contentWithConnector]}>
              <Text
                style={[
                  styles.title,
                  compact && styles.titleCompact,
                  {color: step.status === 'pending' ? COLORS.textSecondary : COLORS.textPrimary},
                ]}>
                {step.title}
              </Text>
              <Text
                style={[
                  styles.subtitle,
                  compact && styles.subtitleCompact,
                  step.status === 'error' && {color: COLORS.errorRed},
                ]}>
                {step.subtitle}
              </Text>
              {step.explorerUrl && (step.status === 'complete' || step.status === 'active') && (
                <TouchableOpacity
                  style={styles.linkRow}
                  onPress={() => Linking.openURL(step.explorerUrl!)}
                  activeOpacity={0.7}>
                  <Ionicons name="open-outline" size={12} color={color} />
                  <Text style={[styles.linkText, {color}]}>
                    {step.explorerLabel || 'View transaction'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}

      {starknetAddress && (
        <TouchableOpacity style={styles.addressRow} onPress={handleCopyAddress} activeOpacity={0.7}>
          <View style={styles.addressIcon}>
            <Ionicons name="wallet-outline" size={16} color="#6C5CE7" />
          </View>
          <View style={styles.addressContent}>
            <Text style={[styles.addressLabel, compact && {fontSize: 12}]}>My Starknet address</Text>
            <Text style={[styles.addressValue, compact && {fontSize: 11}]}>{truncatedAddress}</Text>
          </View>
          <Ionicons
            name={copied ? 'checkmark-circle' : 'copy-outline'}
            size={18}
            color={copied ? COLORS.positiveGreen : COLORS.textSecondary}
          />
          {copied && <Text style={styles.copiedLabel}>Copied</Text>}
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  indicatorCol: {
    width: 28,
    alignItems: 'center',
    marginRight: 14,
  },
  connector: {
    width: 2,
    flex: 1,
    minHeight: 28,
    borderRadius: 1,
  },
  content: {
    flex: 1,
    paddingTop: 2,
  },
  contentWithConnector: {
    paddingBottom: 20,
  },
  title: {
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: COLORS.textPrimary,
    marginBottom: 3,
  },
  titleCompact: {
    fontSize: 13,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  subtitleCompact: {
    fontSize: 12,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  linkText: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    textDecorationLine: 'underline',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6C5CE7' + '0A',
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
    gap: 10,
  },
  addressIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6C5CE7' + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressContent: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  addressValue: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: '#6C5CE7',
  },
  copiedLabel: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.positiveGreen,
  },
});

export default TransactionLifecycle;
