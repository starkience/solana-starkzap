import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppNavigation } from '@/shared/hooks/useAppNavigation';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';

interface NetworkOption {
  name: string;
  badges: string[];
  color: string;
  icon: string;
  logoUrl: string;
}

const NETWORKS: NetworkOption[] = [
  {
    name: 'Starknet',
    badges: ['Low Fees'],
    color: '#1B1B5E',
    icon: 'S',
    logoUrl: 'https://assets.coingecko.com/coins/images/26433/small/starknet.png',
  },
  {
    name: 'Base',
    badges: ['Recommended', 'Low Fees'],
    color: '#0052FF',
    icon: 'B',
    logoUrl: 'https://assets.coingecko.com/asset_platforms/images/131/small/base.jpeg',
  },
  {
    name: 'Ethereum',
    badges: ['Popular'],
    color: '#627EEA',
    icon: 'E',
    logoUrl: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  },
  {
    name: 'Arbitrum',
    badges: ['Low Fees'],
    color: '#28A0F0',
    icon: 'A',
    logoUrl: 'https://assets.coingecko.com/coins/images/16547/small/arb.jpg',
  },
  {
    name: 'Polygon',
    badges: ['Low Fees'],
    color: '#8247E5',
    icon: 'P',
    logoUrl: 'https://assets.coingecko.com/coins/images/4713/small/polygon.png',
  },
  {
    name: 'Monad',
    badges: ['Low Fees'],
    color: '#7B61FF',
    icon: 'M',
    logoUrl: 'https://assets.coingecko.com/coins/images/52139/small/monad.jpg',
  },
];

export default function SelectNetworkScreen() {
  const navigation = useAppNavigation();

  const handleSelectNetwork = (network: NetworkOption) => {
    (navigation as any).navigate('Transfer', { network: network.name });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Network</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <Ionicons name="close" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>Select Network</Text>

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {NETWORKS.map((network, index) => (
            <TouchableOpacity
              key={index}
              style={styles.networkCard}
              onPress={() => handleSelectNetwork(network)}
              activeOpacity={0.7}
            >
              <View style={styles.networkIcon}>
                <Image
                  source={{ uri: network.logoUrl }}
                  style={styles.networkLogo}
                />
              </View>
              <View style={styles.networkInfo}>
                <Text style={styles.networkName}>{network.name}</Text>
                <View style={styles.badgeRow}>
                  {network.badges.map((badge, bi) => (
                    <View key={bi} style={styles.badge}>
                      <Text style={styles.badgeText}>{badge}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          ))}
        </ScrollView>
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
  sectionLabel: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    gap: 10,
  },
  networkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.greyBorder,
  },
  networkIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: COLORS.greyBorder,
    overflow: 'hidden',
  },
  networkLogo: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  networkInfo: {
    flex: 1,
  },
  networkName: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: COLORS.textPrimary,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  badge: {
    backgroundColor: 'rgba(0, 255, 59, 0.10)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: '#00CC30',
  },
});
