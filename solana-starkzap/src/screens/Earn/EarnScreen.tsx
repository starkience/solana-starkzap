import React, {useState, useCallback, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {RootStackParamList} from '@/shared/navigation/RootNavigator';
import {useSelector, useDispatch} from 'react-redux';
import {RootState, AppDispatch} from '@/shared/state/store';
import {addTransaction, updateTransaction, LifecycleStep} from '@/shared/state/history/reducer';
import {Connection, PublicKey} from '@solana/web3.js';
import {HELIUS_STAKED_URL} from '@env';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';
import StakeDepositSheet, {StakePoolInfo, DepositTokenOption} from '@/components/sheets/StakeDepositSheet';
import {useWallet} from '@/modules/wallet-providers/hooks/useWallet';
import {
  buildTokenStakeTransaction,
  buildSOLStakeTransaction,
  getTokenBalance,
} from '@/modules/solana-staking/services/solanaStakingService';
import {getLBTCStakingAPY, getSTRKStakingAPY} from '@/modules/starknet/services/stakingApyService';
import {useVesuDeposit} from '@/modules/starknet/hooks/useVesuDeposit';
import {useBTCStaking} from '@/modules/starknet/hooks/useBTCStaking';
import {useSTRKStaking} from '@/modules/starknet/hooks/useSTRKStaking';
import {useStarknetWallet} from '@/modules/starknet/hooks/useStarknetWallet';
import {
  swapTokensOnStarknet,
  STARKNET_TOKENS,
  STARKNET_TOKEN_DECIMALS,
} from '@/modules/starknet/services/avnuSwapService';
import {useBridgeAndDeposit} from '@/modules/bridge/hooks/useBridgeAndDeposit';
import {
  buildDepositForBurnInstruction,
  pollAttestation,
  receiveMessageOnStarknet,
  usdcToBaseUnits,
} from '@/modules/bridge/services/cctpBridgeService';
import {TransactionService} from '@/modules/wallet-providers/services/transaction/transactionService';
import {getVesuPoolInfo, withdrawFromVesu, getStarknetTokenBalance} from '@/modules/starknet/services/vesuService';

type EarnTab = 'Yield Pools' | 'Staking';

const SUSN_ICON = require('@/assets/images/susn.png');

const TOKEN_LOGOS: Record<string, string> = {
  SOL: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
  USDC: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
  USDT: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/icon.png',
  JUP: 'https://static.jup.ag/jup/icon.png',
  RAY: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png',
  BONK: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I',
  JTO: 'https://coin-images.coingecko.com/coins/images/33228/large/jto.png',
  PYTH: 'https://coin-images.coingecko.com/coins/images/31924/large/pyth.png',
  BTC: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/bitcoin/info/logo.png',
  WBTC: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/bitcoin/info/logo.png',
  LBTC: 'https://s2.coinmarketcap.com/static/img/coins/64x64/33652.png',
  ETH: 'https://coin-images.coingecko.com/coins/images/279/large/ethereum.png',
  wstETH: 'https://coin-images.coingecko.com/coins/images/18834/large/wstETH.png',
  STRK: 'https://coin-images.coingecko.com/coins/images/26433/large/starknet.png',
};

const LOCAL_TOKEN_ICONS: Record<string, any> = {
  sUSN: SUSN_ICON,
};

interface YieldPool {
  id: string;
  name: string;
  protocol: string;
  apy: number;
  tvl: string;
  token1: string;
  token2?: string;
  risk: 'Low' | 'Medium' | 'High';
  chain?: 'solana' | 'starknet';
  /** Vesu pool contract address on Starknet */
  vesuPoolId?: string;
  /** Token address on Starknet for deposit */
  starknetTokenAddress?: string;
  /** If true, user needs AVNU swap from USDC to this token before deposit */
  requiresSwap?: boolean;
}

interface StakingOption {
  id: string;
  name: string;
  token: string;
  apy: number;
  staked: string;
  lockPeriod: string;
  minStake: string;
  tvlToken?: string;
}

const BASE_YIELD_POOLS: YieldPool[] = [
  {id: 'yield-sol', name: 'Earn SOL', protocol: 'Native Staking', apy: 7.2, tvl: '$1.8B', token1: 'SOL', risk: 'Low', chain: 'solana'},
  {id: 'yield-jup', name: 'Earn JUP', protocol: 'Jupiter Governance', apy: 8.5, tvl: '$234M', token1: 'JUP', risk: 'Low', chain: 'solana'},
  {
    id: 'vesu-usdc', name: 'Lend USDC', protocol: 'Vesu (Starknet)', apy: 0,
    tvl: '-', token1: 'USDC', risk: 'Low', chain: 'starknet',
    vesuPoolId: '0x0486294fe74daf3d964523e7a1f4e5d686f153934b2c183ececa0cab9dd2f3e6',
    starknetTokenAddress: '0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb',
  },
  {
    id: 'vesu-wsteth', name: 'Lend wstETH', protocol: 'Vesu (Starknet)', apy: 0,
    tvl: '-', token1: 'wstETH', risk: 'Low', chain: 'starknet',
    vesuPoolId: '0x0635cb8ba1c3b0b21cb2056f6b1ba75c3421ce505212aeb43ffd56b58343fa17',
    starknetTokenAddress: '0x0057912720381af14b0e5c87aa4718ed5e527eab60b3801ebf702ab09139e38b',
    requiresSwap: true,
  },
  {
    id: 'vesu-susn', name: 'Lend sUSN', protocol: 'Vesu (Starknet)', apy: 0,
    tvl: '-', token1: 'sUSN', risk: 'Medium', chain: 'starknet',
    vesuPoolId: '0x01bc5de51365ed7fbb11ebc81cef9fd66b70050ec10fd898f0c4698765bf5803',
    starknetTokenAddress: '0x02411565ef1a14decfbe83d2e987cced918cd752508a3d9c55deb67148d14d17',
    requiresSwap: true,
  },
  {id: 'yield-jto', name: 'Earn JTO', protocol: 'Jito Governance', apy: 6.8, tvl: '$89M', token1: 'JTO', risk: 'Low', chain: 'solana'},
  {id: 'yield-pyth', name: 'Earn PYTH', protocol: 'Pyth Governance', apy: 5.1, tvl: '$156M', token1: 'PYTH', risk: 'Low', chain: 'solana'},
];

const BASE_STAKING_OPTIONS: StakingOption[] = [
  {id: 'btc', name: 'Stake BTC', token: 'WBTC', apy: 0, staked: '-', lockPeriod: '7 days', minStake: 'No minimum', tvlToken: '-'},
  {id: 'strk', name: 'Stake STRK', token: 'STRK', apy: 0, staked: '-', lockPeriod: '21 days', minStake: 'No minimum', tvlToken: '-'},
  {id: '1', name: 'Stake JUP', token: 'JUP', apy: 8.5, staked: '$234M', lockPeriod: 'Flexible', minStake: '1 JUP', tvlToken: '234M JUP'},
  {id: '2', name: 'Liquid Stake SOL', token: 'SOL', apy: 7.2, staked: '$1.8B', lockPeriod: 'Flexible', minStake: '0.01 SOL', tvlToken: '8.2M SOL'},
  {id: '3', name: 'Stake JTO', token: 'JTO', apy: 6.8, staked: '$89M', lockPeriod: '30 days', minStake: '10 JTO', tvlToken: '89M JTO'},
  {id: '4', name: 'Stake PYTH', token: 'PYTH', apy: 5.1, staked: '$156M', lockPeriod: '7 days', minStake: '100 PYTH', tvlToken: '156M PYTH'},
];

interface EarnPosition {
  token: string;
  amount: number;
  usdValue: number;
  apy: number;
  protocol: string;
}

export default function EarnScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const dispatch = useDispatch<AppDispatch>();
  const [activeTab, setActiveTab] = useState<EarnTab>('Yield Pools');
  const [selectedPool, setSelectedPool] = useState<StakingOption | null>(null);
  const [selectedYieldPool, setSelectedYieldPool] = useState<YieldPool | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [userBalance, setUserBalance] = useState('0');
  const [lbtcApyData, setLbtcApyData] = useState<{apy: number; tvlUsd: number; project: string} | null>(null);
  const [apyLoading, setApyLoading] = useState(true);
  const [earnPositions, setEarnPositions] = useState<EarnPosition[]>([]);
  const [yieldPools, setYieldPools] = useState<YieldPool[]>(BASE_YIELD_POOLS);
  const [selectedBtcDepositToken, setSelectedBtcDepositToken] = useState<string>('USDC');
  const [btcLifecycleSteps, setBtcLifecycleSteps] = useState<LifecycleStep[]>([]);
  const [selectedStrkDepositToken, setSelectedStrkDepositToken] = useState<string>('USDC');
  const [strkLifecycleSteps, setStrkLifecycleSteps] = useState<LifecycleStep[]>([]);
  const [strkApyData, setStrkApyData] = useState<{apy: number; tvlUsd: number; project: string} | null>(null);

  const stakingPositions = useSelector(
    (state: RootState) => state.starknet.stakingPositions,
  );
  const historyTransactions = useSelector(
    (state: RootState) => state.history.transactions,
  );
  const walletAddress = useSelector(
    (state: RootState) => state.auth.address,
  );
  const {wallet: solanaWallet, sendTransaction} = useWallet();
  const {deposit: vesuDeposit, currentStep: vesuStep, error: vesuError, reset: resetVesu} = useVesuDeposit();
  const {stake: btcStake, fetchPools: fetchBTCPools, availablePools: btcPools} = useBTCStaking();
  const {stake: strkStake, fetchPools: fetchSTRKPools, availablePools: strkPools} = useSTRKStaking();
  const {ensureWallet, starknetAddress} = useStarknetWallet();
  const {bridgeAndDeposit, lifecycleSteps: bridgeLifecycleSteps, reset: resetBridge} = useBridgeAndDeposit();

  useEffect(() => {
    const deposits = historyTransactions.filter(
      tx => tx.status === 'confirmed' && (tx.type === 'deposit' || tx.type === 'stake'),
    );

    const positionMap: Record<string, EarnPosition> = {};
    for (const tx of deposits) {
      const token = tx.token;
      const amt = parseFloat(tx.amount) || 0;
      if (!positionMap[token]) {
        const pool = yieldPools.find(p => p.token1 === token);
        const staking = BASE_STAKING_OPTIONS.find(s => s.token === token);
        positionMap[token] = {
          token,
          amount: 0,
          usdValue: 0,
          apy: pool?.apy || staking?.apy || 0,
          protocol: tx.protocol || pool?.protocol || 'Unknown',
        };
      }
      positionMap[token].amount += amt;

      let usdVal = amt;
      if (token === 'USDC') {
        usdVal = amt;
      } else if (tx.subtitle) {
        const usdcMatch = tx.subtitle.match(/^([\d.]+)\s+USDC/);
        if (usdcMatch) {
          usdVal = parseFloat(usdcMatch[1]) || amt;
        }
      }
      positionMap[token].usdValue += usdVal;
    }
    setEarnPositions(Object.values(positionMap));
  }, [historyTransactions, yieldPools]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [btcData, strkData] = await Promise.all([
          getLBTCStakingAPY(),
          getSTRKStakingAPY(),
        ]);
        if (mounted) {
          if (btcData) setLbtcApyData(btcData);
          if (strkData) setStrkApyData(strkData);
        }
      } catch (err) {
        console.warn('[Earn] Failed to fetch live APY:', err);
      } finally {
        if (mounted) setApyLoading(false);
      }
    })();
    fetchBTCPools();
    fetchSTRKPools();
    return () => { mounted = false; };
  }, [fetchBTCPools, fetchSTRKPools]);

  useEffect(() => {
    let mounted = true;
    const vesuPools = BASE_YIELD_POOLS.filter(p => p.chain === 'starknet' && p.vesuPoolId);
    if (vesuPools.length === 0) return;

    (async () => {
      const updates: Record<string, {apy: number; tvl: string}> = {};
      await Promise.all(
        vesuPools.map(async (pool) => {
          try {
            const info = await getVesuPoolInfo(pool.vesuPoolId!, pool.starknetTokenAddress || '');
            if (info) {
              const tvl = info.totalSuppliedUsd >= 1_000_000
                ? `$${(info.totalSuppliedUsd / 1_000_000).toFixed(1)}M`
                : info.totalSuppliedUsd >= 1_000
                  ? `$${(info.totalSuppliedUsd / 1_000).toFixed(1)}K`
                  : `$${info.totalSuppliedUsd.toFixed(0)}`;
              const totalApy = info.supplyApy + (info.lstApr || 0);
              updates[pool.id] = {apy: parseFloat(totalApy.toFixed(2)), tvl};
            }
          } catch (err) {
            console.warn(`[Earn] Failed to fetch Vesu data for ${pool.token1}:`, err);
          }
        }),
      );

      if (mounted && Object.keys(updates).length > 0) {
        setYieldPools(prev =>
          prev.map(pool =>
            updates[pool.id]
              ? {...pool, apy: updates[pool.id].apy, tvl: updates[pool.id].tvl}
              : pool,
          ),
        );
      }
    })();
    return () => { mounted = false; };
  }, []);

  const stakingOptions: StakingOption[] = BASE_STAKING_OPTIONS.map(opt => {
    if (opt.id === 'btc' && lbtcApyData) {
      const tvlFormatted = lbtcApyData.tvlUsd >= 1_000_000
        ? `$${(lbtcApyData.tvlUsd / 1_000_000).toFixed(1)}M`
        : `$${(lbtcApyData.tvlUsd / 1_000).toFixed(0)}K`;
      return {
        ...opt,
        apy: parseFloat(lbtcApyData.apy.toFixed(2)),
        staked: tvlFormatted,
        tvlToken: tvlFormatted,
      };
    }
    if (opt.id === 'strk' && strkApyData) {
      const tvlFormatted = strkApyData.tvlUsd >= 1_000_000
        ? `$${(strkApyData.tvlUsd / 1_000_000).toFixed(1)}M`
        : `$${(strkApyData.tvlUsd / 1_000).toFixed(0)}K`;
      return {
        ...opt,
        apy: parseFloat(strkApyData.apy.toFixed(2)),
        staked: tvlFormatted,
        tvlToken: tvlFormatted,
      };
    }
    return opt;
  });

  const totalBTCRewards = stakingPositions.reduce((sum, pos) => {
    const val = parseFloat(pos.rewardsAmount.replace(/[^0-9.]/g, '')) || 0;
    return sum + val;
  }, 0);

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'Low':
        return COLORS.positiveGreen;
      case 'Medium':
        return COLORS.warningOrange;
      case 'High':
        return COLORS.errorRed;
      default:
        return COLORS.textSecondary;
    }
  };

  const renderTokenIcon = (symbol: string, size: number = 32) => {
    const localIcon = LOCAL_TOKEN_ICONS[symbol];
    if (localIcon) {
      return (
        <Image
          source={localIcon}
          style={{width: size, height: size, borderRadius: size / 2}}
        />
      );
    }
    const logo = TOKEN_LOGOS[symbol];
    if (logo) {
      return (
        <Image
          source={{uri: logo}}
          style={{width: size, height: size, borderRadius: size / 2}}
        />
      );
    }
    return (
      <View
        style={[
          styles.tokenIconPlaceholder,
          {width: size, height: size, borderRadius: size / 2},
        ]}>
        <Text style={styles.tokenIconLetter}>{symbol[0]}</Text>
      </View>
    );
  };

  const formatBalance = (bal: number): string => {
    if (bal === 0) return '0';
    if (bal < 0.000001) return bal.toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
    return bal.toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
  };

  const openStakeSheet = useCallback(
    async (option: StakingOption) => {
      setSelectedYieldPool(null);
      setSelectedPool(option);
      setSheetVisible(true);

      if (walletAddress) {
        try {
          const connection = new Connection(HELIUS_STAKED_URL, 'confirmed');
          const tokenToCheck = (option.id === 'btc' || option.id === 'strk') ? 'USDC' : option.token;
          const balance = await getTokenBalance(
            connection,
            walletAddress,
            tokenToCheck,
          );
          setUserBalance(formatBalance(balance));
        } catch {
          setUserBalance('0');
        }
      }
    },
    [walletAddress],
  );

  const openYieldPoolSheet = useCallback(
    async (pool: YieldPool) => {
      setSelectedPool(null);
      setSelectedYieldPool(pool);
      setSheetVisible(true);

      if (walletAddress) {
        try {
          const connection = new Connection(HELIUS_STAKED_URL, 'confirmed');
          const tokenToCheck = pool.token1 === 'wstETH' || pool.token1 === 'sUSN' ? 'USDC' : pool.token1;
          const balance = await getTokenBalance(
            connection,
            walletAddress,
            tokenToCheck,
          );
          setUserBalance(formatBalance(balance));
        } catch {
          setUserBalance('0');
        }
      }
    },
    [walletAddress],
  );

  const handleStake = useCallback(
    async (amount: string): Promise<string> => {
      if (!selectedPool || !walletAddress) {
        throw new Error('Wallet not connected');
      }

      // BTC staking on Starknet via Starkzap
      // When USDC is selected: bridge USDC from Solana → Starknet via CCTP,
      //   then AVNU swaps USDC → WBTC on Starknet, then stake WBTC
      // When WBTC is selected: stake directly (assumes WBTC already on Starknet)
      if (selectedPool.id === 'btc') {
        const depositToken = selectedBtcDepositToken;
        const useCCTPBridge = depositToken === 'USDC';
        const txId = `btc_stake_${Date.now()}`;
        let stakeAmount = amount;

        const steps: LifecycleStep[] = [];
        if (useCCTPBridge) {
          steps.push(
            {id: 'deposit_confirmed', title: 'Deposit confirmed', subtitle: 'Your USDC deposit has been received on Solana.', status: 'pending'},
            {id: 'bridging', title: 'Bridging to Starknet', subtitle: 'Your USDC is being bridged via CCTP.\nThis may take a short moment.', status: 'pending'},
            {id: 'swapping', title: 'Swapping USDC → WBTC', subtitle: 'Swapping your USDC into WBTC via AVNU.', status: 'pending'},
          );
        }
        steps.push({id: 'staking', title: 'Staking WBTC', subtitle: 'Staking WBTC via Starkzap on Starknet.', status: 'pending'});
        steps.push({id: 'stake_complete', title: 'Stake complete', subtitle: 'Your BTC stake is now active on Starknet.', status: 'pending'});

        setBtcLifecycleSteps([...steps]);

        const updateStep = (stepId: string, update: Partial<LifecycleStep>) => {
          const idx = steps.findIndex(s => s.id === stepId);
          if (idx >= 0) {
            steps[idx] = {...steps[idx], ...update};
            setBtcLifecycleSteps([...steps]);
            dispatch(updateTransaction({id: txId, updates: {lifecycleSteps: [...steps]}}));
          }
        };

        const starkWallet = await ensureWallet();
        if (!starkWallet) throw new Error('Failed to connect Starknet wallet');

        const resolvedStarknetAddress: string =
          starkWallet.address?.toString() ||
          starkWallet.getAddress?.()?.toString() ||
          '';

        dispatch(
          addTransaction({
            id: txId,
            type: 'stake',
            token: 'WBTC',
            amount,
            txHash: '',
            status: 'pending',
            timestamp: new Date().toISOString(),
            protocol: 'Starkzap BTC Staking',
            subtitle: useCCTPBridge
              ? `Bridge ${amount} USDC → Swap to WBTC → Stake via Starkzap`
              : `Deposit ${amount} WBTC → Stake on Starknet`,
            explorerUrl: undefined,
            starknetExplorerUrl: undefined,
            lifecycleSteps: [...steps],
            starknetAddress: resolvedStarknetAddress || undefined,
          }),
        );

        try {
          if (useCCTPBridge) {
            if (!solanaWallet || !walletAddress) {
              throw new Error('Solana wallet not connected for bridging');
            }
            if (!resolvedStarknetAddress) throw new Error('Could not resolve Starknet address');

            updateStep('deposit_confirmed', {status: 'active'});

            const connection = new Connection(HELIUS_STAKED_URL, 'confirmed');
            const ownerPubkey = new PublicKey(walletAddress);

            const solBalance = await connection.getBalance(ownerPubkey);
            const MIN_SOL_FOR_CCTP = 5_000_000;
            if (solBalance < MIN_SOL_FOR_CCTP) {
              throw new Error(
                `Insufficient SOL for bridging fees. You need at least ~0.005 SOL but have ${(solBalance / 1e9).toFixed(6)} SOL. Please add more SOL to your wallet.`,
              );
            }

            const amountBaseUnits = usdcToBaseUnits(amount);

            const {instruction, messageSentKeypair} =
              await buildDepositForBurnInstruction({
                ownerPubkey,
                amount: amountBaseUnits,
                starknetRecipient: resolvedStarknetAddress,
              });

            const solanaSignature = await TransactionService.signAndSendTransaction(
              {
                type: 'instructions',
                instructions: [instruction],
                feePayer: ownerPubkey,
                signers: [messageSentKeypair],
              },
              solanaWallet,
              {connection},
            );
            console.log('[BTC Stake] CCTP burn confirmed:', solanaSignature);

            updateStep('deposit_confirmed', {
              status: 'complete',
              explorerUrl: `https://solscan.io/tx/${solanaSignature}`,
              explorerLabel: 'View on Solscan',
            });
            dispatch(updateTransaction({id: txId, updates: {
              explorerUrl: `https://solscan.io/tx/${solanaSignature}`,
            }}));

            updateStep('bridging', {status: 'active'});
            const attestation = await pollAttestation(solanaSignature, true, 10 * 60 * 1000, 5000);
            const starknetMintResult = await receiveMessageOnStarknet(starkWallet, attestation);
            console.log('[BTC Stake] USDC minted on Starknet');

            const mintTxHash = typeof starknetMintResult === 'string' ? starknetMintResult : starknetMintResult?.txHash || '';
            updateStep('bridging', {
              status: 'complete',
              explorerUrl: mintTxHash ? `https://voyager.online/tx/${mintTxHash}` : undefined,
              explorerLabel: mintTxHash ? 'View on Voyager' : undefined,
            });

            updateStep('swapping', {status: 'active'});
            console.log('[BTC Stake] Starting USDC→WBTC swap...');
            const swapResult = await swapTokensOnStarknet(
              starkWallet,
              STARKNET_TOKENS.USDC,
              'USDC',
              STARKNET_TOKEN_DECIMALS.USDC,
              STARKNET_TOKENS.WBTC,
              'WBTC',
              STARKNET_TOKEN_DECIMALS.WBTC,
              amount,
            );
            console.log('[BTC Stake] USDC→WBTC swap confirmed:', swapResult.txHash);

            const wbtcBalance = await getStarknetTokenBalance(
              STARKNET_TOKENS.WBTC,
              resolvedStarknetAddress,
              STARKNET_TOKEN_DECIMALS.WBTC,
            );
            console.log('[BTC Stake] Actual WBTC balance after swap:', wbtcBalance);
            if (parseFloat(wbtcBalance) > 0) {
              stakeAmount = wbtcBalance;
            }

            updateStep('swapping', {
              status: 'complete',
              explorerUrl: `https://voyager.online/tx/${swapResult.txHash}`,
              explorerLabel: 'View on Voyager',
            });
            dispatch(updateTransaction({id: txId, updates: {
              starknetExplorerUrl: `https://voyager.online/tx/${swapResult.txHash}`,
            }}));
          }

          updateStep('staking', {status: 'active'});
          const wbtcPool = btcPools.find(p => p.tokenSymbol === 'WBTC') || btcPools[0];
          if (wbtcPool) {
            const stakeResult = await btcStake(wbtcPool.poolContract, stakeAmount, 'WBTC');
            const stakeTxHash = stakeResult?.txHash || '';
            updateStep('staking', {
              status: 'complete',
              explorerUrl: stakeTxHash ? `https://voyager.online/tx/${stakeTxHash}` : undefined,
              explorerLabel: stakeTxHash ? 'View on Voyager' : undefined,
            });
            updateStep('stake_complete', {status: 'complete'});

            dispatch(
              updateTransaction({
                id: txId,
                updates: {
                  status: 'confirmed',
                  amount: stakeAmount,
                  subtitle: useCCTPBridge
                    ? `${amount} USDC → bridged → ${stakeAmount} WBTC staked via Starkzap`
                    : `${stakeAmount} WBTC staked via Starkzap`,
                  starknetAddress: resolvedStarknetAddress || undefined,
                  ...(stakeTxHash
                    ? {starknetExplorerUrl: `https://voyager.online/tx/${stakeTxHash}`}
                    : {}),
                },
              }),
            );
            return stakeTxHash;
          } else {
            throw new Error('No WBTC staking pool found on Starknet. Please try again later.');
          }
        } catch (btcErr: any) {
          console.error('[BTC Stake] Error:', btcErr);
          dispatch(
            updateTransaction({id: txId, updates: {status: 'failed', subtitle: btcErr.message}}),
          );
          throw btcErr;
        }
      }

      // STRK staking on Starknet via Starkzap
      if (selectedPool.id === 'strk') {
        const depositToken = selectedStrkDepositToken;
        const useCCTPBridge = depositToken === 'USDC';
        const txId = `strk_stake_${Date.now()}`;
        let stakeAmount = amount;

        const steps: LifecycleStep[] = [];
        if (useCCTPBridge) {
          steps.push(
            {id: 'deposit_confirmed', title: 'Deposit confirmed', subtitle: 'Your USDC deposit has been received on Solana.', status: 'pending'},
            {id: 'bridging', title: 'Bridging to Starknet', subtitle: 'Your USDC is being bridged via CCTP.\nThis may take a short moment.', status: 'pending'},
            {id: 'swapping', title: 'Swapping USDC → STRK', subtitle: 'Swapping your USDC into STRK via AVNU.', status: 'pending'},
          );
        }
        steps.push({id: 'staking', title: 'Staking STRK', subtitle: 'Staking STRK via Starkzap on Starknet.', status: 'pending'});
        steps.push({id: 'stake_complete', title: 'Stake complete', subtitle: 'Your STRK stake is now active on Starknet.', status: 'pending'});

        setStrkLifecycleSteps([...steps]);

        const updateStep = (stepId: string, update: Partial<LifecycleStep>) => {
          const idx = steps.findIndex(s => s.id === stepId);
          if (idx >= 0) {
            steps[idx] = {...steps[idx], ...update};
            setStrkLifecycleSteps([...steps]);
            dispatch(updateTransaction({id: txId, updates: {lifecycleSteps: [...steps]}}));
          }
        };

        const starkWallet = await ensureWallet();
        if (!starkWallet) throw new Error('Failed to connect Starknet wallet');

        const resolvedStarknetAddress: string =
          starkWallet.address?.toString() ||
          starkWallet.getAddress?.()?.toString() ||
          '';

        dispatch(
          addTransaction({
            id: txId,
            type: 'stake',
            token: 'STRK',
            amount,
            txHash: '',
            status: 'pending',
            timestamp: new Date().toISOString(),
            protocol: 'Starkzap STRK Staking',
            subtitle: useCCTPBridge
              ? `Bridge ${amount} USDC → Swap to STRK → Stake via Starkzap`
              : `Deposit ${amount} STRK → Stake on Starknet`,
            explorerUrl: undefined,
            starknetExplorerUrl: undefined,
            lifecycleSteps: [...steps],
            starknetAddress: resolvedStarknetAddress || undefined,
          }),
        );

        try {
          if (useCCTPBridge) {
            if (!solanaWallet || !walletAddress) {
              throw new Error('Solana wallet not connected for bridging');
            }
            if (!resolvedStarknetAddress) throw new Error('Could not resolve Starknet address');

            updateStep('deposit_confirmed', {status: 'active'});

            const connection = new Connection(HELIUS_STAKED_URL, 'confirmed');
            const ownerPubkey = new PublicKey(walletAddress);

            const solBalance = await connection.getBalance(ownerPubkey);
            const MIN_SOL_FOR_CCTP = 5_000_000;
            if (solBalance < MIN_SOL_FOR_CCTP) {
              throw new Error(
                `Insufficient SOL for bridging fees. You need at least ~0.005 SOL but have ${(solBalance / 1e9).toFixed(6)} SOL. Please add more SOL to your wallet.`,
              );
            }

            const amountBaseUnits = usdcToBaseUnits(amount);

            const {instruction, messageSentKeypair} =
              await buildDepositForBurnInstruction({
                ownerPubkey,
                amount: amountBaseUnits,
                starknetRecipient: resolvedStarknetAddress,
              });

            const solanaSignature = await TransactionService.signAndSendTransaction(
              {
                type: 'instructions',
                instructions: [instruction],
                feePayer: ownerPubkey,
                signers: [messageSentKeypair],
              },
              solanaWallet,
              {connection},
            );
            console.log('[STRK Stake] CCTP burn confirmed:', solanaSignature);

            updateStep('deposit_confirmed', {
              status: 'complete',
              explorerUrl: `https://solscan.io/tx/${solanaSignature}`,
              explorerLabel: 'View on Solscan',
            });
            dispatch(updateTransaction({id: txId, updates: {
              explorerUrl: `https://solscan.io/tx/${solanaSignature}`,
            }}));

            updateStep('bridging', {status: 'active'});
            const attestation = await pollAttestation(solanaSignature, true, 10 * 60 * 1000, 5000);
            const starknetMintResult = await receiveMessageOnStarknet(starkWallet, attestation);
            console.log('[STRK Stake] USDC minted on Starknet');

            const mintTxHash = typeof starknetMintResult === 'string' ? starknetMintResult : starknetMintResult?.txHash || '';
            updateStep('bridging', {
              status: 'complete',
              explorerUrl: mintTxHash ? `https://voyager.online/tx/${mintTxHash}` : undefined,
              explorerLabel: mintTxHash ? 'View on Voyager' : undefined,
            });

            updateStep('swapping', {status: 'active'});
            console.log('[STRK Stake] Starting USDC→STRK swap...');
            const swapResult = await swapTokensOnStarknet(
              starkWallet,
              STARKNET_TOKENS.USDC,
              'USDC',
              STARKNET_TOKEN_DECIMALS.USDC,
              STARKNET_TOKENS.STRK,
              'STRK',
              STARKNET_TOKEN_DECIMALS.STRK,
              amount,
            );
            console.log('[STRK Stake] USDC→STRK swap confirmed:', swapResult.txHash);

            const strkBalance = await getStarknetTokenBalance(
              STARKNET_TOKENS.STRK,
              resolvedStarknetAddress,
              STARKNET_TOKEN_DECIMALS.STRK,
            );
            console.log('[STRK Stake] Actual STRK balance after swap:', strkBalance);
            if (parseFloat(strkBalance) > 0) {
              stakeAmount = strkBalance;
            }

            updateStep('swapping', {
              status: 'complete',
              explorerUrl: `https://voyager.online/tx/${swapResult.txHash}`,
              explorerLabel: 'View on Voyager',
            });
            dispatch(updateTransaction({id: txId, updates: {
              starknetExplorerUrl: `https://voyager.online/tx/${swapResult.txHash}`,
            }}));
          }

          updateStep('staking', {status: 'active'});
          const strkPool = strkPools.find(p => p.tokenSymbol === 'STRK') || strkPools[0];
          if (strkPool) {
            const stakeResult = await strkStake(strkPool.poolContract, stakeAmount);
            const stakeTxHash = stakeResult?.txHash || '';
            updateStep('staking', {
              status: 'complete',
              explorerUrl: stakeTxHash ? `https://voyager.online/tx/${stakeTxHash}` : undefined,
              explorerLabel: stakeTxHash ? 'View on Voyager' : undefined,
            });
            updateStep('stake_complete', {status: 'complete'});

            dispatch(
              updateTransaction({
                id: txId,
                updates: {
                  status: 'confirmed',
                  amount: stakeAmount,
                  subtitle: useCCTPBridge
                    ? `${amount} USDC → bridged → ${stakeAmount} STRK staked via Starkzap`
                    : `${stakeAmount} STRK staked via Starkzap`,
                  starknetAddress: resolvedStarknetAddress || undefined,
                  ...(stakeTxHash
                    ? {starknetExplorerUrl: `https://voyager.online/tx/${stakeTxHash}`}
                    : {}),
                },
              }),
            );
            return stakeTxHash;
          } else {
            throw new Error('No STRK staking pool found on Starknet. Please try again later.');
          }
        } catch (strkErr: any) {
          console.error('[STRK Stake] Error:', strkErr);
          dispatch(
            updateTransaction({id: txId, updates: {status: 'failed', subtitle: strkErr.message}}),
          );
          throw strkErr;
        }
      }

      // Standard Solana staking
      const connection = new Connection(HELIUS_STAKED_URL, 'confirmed');
      const amountNum = parseFloat(amount);

      let tx;
      if (selectedPool.token === 'SOL') {
        tx = await buildSOLStakeTransaction(connection, walletAddress, amountNum);
      } else {
        tx = await buildTokenStakeTransaction(
          connection,
          walletAddress,
          selectedPool.token as 'JUP' | 'JTO' | 'PYTH',
          amountNum,
        );
      }

      const signature = await sendTransaction(tx, connection);

      const txId = `stake_${Date.now()}`;
      dispatch(
        addTransaction({
          id: txId,
          type: 'stake',
          token: selectedPool.token,
          amount,
          txHash: signature,
          status: 'pending',
          timestamp: new Date().toISOString(),
          protocol: selectedPool.name,
          explorerUrl: `https://solscan.io/tx/${signature}`,
        }),
      );

      try {
        const latestBlockhash = await connection.getLatestBlockhash();
        await connection.confirmTransaction(
          {
            signature,
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
          },
          'confirmed',
        );
        dispatch(
          updateTransaction({id: txId, updates: {status: 'confirmed'}}),
        );
      } catch {
        dispatch(
          updateTransaction({id: txId, updates: {status: 'failed'}}),
        );
      }

      return signature;
    },
    [selectedPool, walletAddress, sendTransaction, dispatch, ensureWallet, btcPools, btcStake, selectedBtcDepositToken, strkPools, strkStake, selectedStrkDepositToken, solanaWallet],
  );

  const handleVesuDeposit = useCallback(
    async (amount: string): Promise<string> => {
      if (!selectedYieldPool || !selectedYieldPool.vesuPoolId) {
        throw new Error('No Vesu pool selected');
      }
      if (!solanaWallet) {
        throw new Error('Solana wallet not connected');
      }

      const tokenDecimals = selectedYieldPool.token1 === 'USDC' ? 6 : 18;
      const connection = new Connection(HELIUS_STAKED_URL, 'confirmed');

      const result = await bridgeAndDeposit({
        amount,
        vesuPoolId: selectedYieldPool.vesuPoolId,
        targetTokenAddress: selectedYieldPool.starknetTokenAddress || '',
        targetTokenSymbol: selectedYieldPool.token1,
        targetTokenDecimals: tokenDecimals,
        requiresSwap: selectedYieldPool.requiresSwap || false,
        wallet: solanaWallet,
        connection,
      });

      return result?.vesuDepositTxHash || 'vesu_deposit';
    },
    [selectedYieldPool, solanaWallet, bridgeAndDeposit],
  );

  const handleSolanaYieldDeposit = useCallback(
    async (amount: string): Promise<string> => {
      if (!selectedYieldPool) {
        throw new Error('No yield pool selected');
      }
      if (!walletAddress) {
        throw new Error('Wallet not connected');
      }

      const connection = new Connection(HELIUS_STAKED_URL, 'confirmed');
      const amountNum = parseFloat(amount);
      const token = selectedYieldPool.token1;

      let tx;
      if (token === 'SOL') {
        tx = await buildSOLStakeTransaction(connection, walletAddress, amountNum);
      } else if (token === 'JUP' || token === 'JTO' || token === 'PYTH') {
        tx = await buildTokenStakeTransaction(connection, walletAddress, token, amountNum);
      } else {
        throw new Error(`Yield deposits for ${token} are not yet supported on Solana`);
      }

      const signature = await sendTransaction(tx, connection);

      const txId = `yield_${Date.now()}`;
      dispatch(
        addTransaction({
          id: txId,
          type: 'deposit',
          token,
          amount,
          txHash: signature,
          status: 'pending',
          timestamp: new Date().toISOString(),
          protocol: selectedYieldPool.protocol,
          explorerUrl: `https://solscan.io/tx/${signature}`,
        }),
      );

      try {
        const latestBlockhash = await connection.getLatestBlockhash();
        await connection.confirmTransaction(
          {
            signature,
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
          },
          'confirmed',
        );
        dispatch(updateTransaction({id: txId, updates: {status: 'confirmed'}}));
      } catch {
        dispatch(updateTransaction({id: txId, updates: {status: 'failed'}}));
      }

      return signature;
    },
    [selectedYieldPool, walletAddress, sendTransaction, dispatch],
  );

  const getDepositTokenOptions = useCallback(
    (pool: YieldPool): DepositTokenOption[] | undefined => {
      if (pool.chain !== 'starknet') return undefined;
      if (pool.token1 === 'USDC') return undefined;
      return [
        {symbol: 'USDC', logoUrl: TOKEN_LOGOS.USDC},
        {
          symbol: pool.token1,
          logoUrl: TOKEN_LOGOS[pool.token1],
          localIcon: LOCAL_TOKEN_ICONS[pool.token1],
        },
      ];
    },
    [],
  );

  const handleDepositTokenChange = useCallback(
    async (symbol: string) => {
      if (!walletAddress) return;
      try {
        const connection = new Connection(HELIUS_STAKED_URL, 'confirmed');
        const balance = await getTokenBalance(connection, walletAddress, symbol);
        setUserBalance(formatBalance(balance));
      } catch {
        setUserBalance('0');
      }
    },
    [walletAddress],
  );

  const btcDepositTokenOptions: DepositTokenOption[] = [
    {symbol: 'USDC', logoUrl: TOKEN_LOGOS.USDC},
    {symbol: 'WBTC', logoUrl: TOKEN_LOGOS.WBTC},
  ];

  const handleBtcDepositTokenChange = useCallback(
    async (symbol: string) => {
      setSelectedBtcDepositToken(symbol);
      if (!walletAddress) return;
      try {
        const connection = new Connection(HELIUS_STAKED_URL, 'confirmed');
        const balance = await getTokenBalance(connection, walletAddress, symbol);
        setUserBalance(formatBalance(balance));
      } catch {
        setUserBalance('0');
      }
    },
    [walletAddress],
  );

  const strkDepositTokenOptions: DepositTokenOption[] = [
    {symbol: 'USDC', logoUrl: TOKEN_LOGOS.USDC},
    {symbol: 'STRK', logoUrl: TOKEN_LOGOS.STRK},
  ];

  const handleStrkDepositTokenChange = useCallback(
    async (symbol: string) => {
      setSelectedStrkDepositToken(symbol);
      if (!walletAddress) return;
      try {
        const connection = new Connection(HELIUS_STAKED_URL, 'confirmed');
        const balance = await getTokenBalance(connection, walletAddress, symbol);
        setUserBalance(formatBalance(balance));
      } catch {
        setUserBalance('0');
      }
    },
    [walletAddress],
  );

  const handleVesuWithdraw = useCallback(
    async (amount: string): Promise<string> => {
      if (!selectedYieldPool || !selectedYieldPool.vesuPoolId) {
        throw new Error('No Vesu pool selected');
      }

      const starkWallet = await ensureWallet();
      if (!starkWallet) {
        throw new Error('Failed to connect Starknet wallet');
      }

      const tokenDecimals = selectedYieldPool.token1 === 'USDC' ? 6 : 18;

      const txId = `withdraw_${Date.now()}`;
      dispatch(
        addTransaction({
          id: txId,
          type: 'deposit',
          token: selectedYieldPool.token1,
          amount,
          txHash: '',
          status: 'pending',
          timestamp: new Date().toISOString(),
          protocol: `Vesu Withdraw (${selectedYieldPool.token1})`,
          subtitle: `Withdrawing ${amount} ${selectedYieldPool.token1} from Vesu`,
        }),
      );

      try {
        const result = await withdrawFromVesu(
          starkWallet,
          selectedYieldPool.vesuPoolId,
          selectedYieldPool.starknetTokenAddress || '',
          selectedYieldPool.token1,
          tokenDecimals,
          amount,
        );

        dispatch(
          updateTransaction({
            id: txId,
            updates: {
              status: 'confirmed',
              txHash: result.txHash,
              starknetExplorerUrl: result.explorerUrl,
              subtitle: `Withdrew ${amount} ${selectedYieldPool.token1} from Vesu`,
            },
          }),
        );

        return result.txHash;
      } catch (err: any) {
        dispatch(
          updateTransaction({id: txId, updates: {status: 'failed', subtitle: err.message}}),
        );
        throw err;
      }
    },
    [selectedYieldPool, ensureWallet, dispatch],
  );

  const handleSolanaYieldWithdraw = useCallback(
    async (_amount: string): Promise<string> => {
      throw new Error('Solana yield withdrawals are coming soon. Unstake via your wallet or Solana staking dashboard.');
    },
    [],
  );

  const getPoolInfo = useCallback(
    (option: StakingOption): StakePoolInfo => {
      const displayToken = option.id === 'btc' ? 'WBTC' : option.token;
      const position = earnPositions.find(p => p.token === displayToken);
      const depositedAmt = position ? position.amount : 0;
      const depositedUsdVal = position ? position.usdValue : 0;

      let name = option.name;
      let subtitle: string | undefined;
      if (option.id === 'btc') {
        name = 'Stake BTC (via Starkzap)';
        subtitle = 'Deposit USDC or WBTC • Staked as WBTC on Starknet';
      } else if (option.id === 'strk') {
        name = 'Stake STRK (via Starkzap)';
        subtitle = 'Deposit USDC or STRK • Staked as STRK on Starknet';
      }

      return {
        name,
        token: displayToken,
        tokenLogoUrl: TOKEN_LOGOS[displayToken] || TOKEN_LOGOS[option.token],
        apy: option.apy,
        tvl: option.staked,
        tvlToken: option.tvlToken,
        deposited: depositedAmt > 0 ? depositedAmt.toFixed(6).replace(/\.?0+$/, '') : '0',
        depositedUsd: `$${depositedUsdVal.toFixed(2)}`,
        earnings: '+-',
        minStake: option.minStake,
        subtitle,
      };
    },
    [earnPositions],
  );

  const getYieldPoolInfo = useCallback(
    (pool: YieldPool): StakePoolInfo => {
      const position = earnPositions.find(p => p.token === pool.token1);
      const depositedAmt = position ? position.amount : 0;
      const depositedUsdVal = position ? position.usdValue : 0;
      return {
        name: pool.name,
        token: pool.token1,
        tokenLogoUrl: TOKEN_LOGOS[pool.token1],
        localTokenIcon: LOCAL_TOKEN_ICONS[pool.token1],
        apy: pool.apy,
        tvl: pool.tvl,
        deposited: depositedAmt > 0 ? depositedAmt.toFixed(6).replace(/\.?0+$/, '') : '0',
        depositedUsd: `$${depositedUsdVal.toFixed(2)}`,
        earnings: '+-',
        minStake: '-',
      };
    },
    [earnPositions],
  );

  const renderYieldPool = (pool: YieldPool) => (
    <TouchableOpacity
      key={pool.id}
      style={styles.poolCard}
      activeOpacity={0.7}
      onPress={() => openYieldPoolSheet(pool)}>
      <View style={styles.poolHeader}>
        <View style={styles.poolNameRow}>
          <View style={styles.poolTokens}>
            {renderTokenIcon(pool.token1, 32)}
            {pool.token2 && (
              <View style={styles.poolTokenOverlap}>
                {renderTokenIcon(pool.token2, 32)}
              </View>
            )}
          </View>
          <View>
            <Text style={styles.poolName}>{pool.name}</Text>
            <Text style={styles.poolProtocol}>{pool.protocol}</Text>
          </View>
        </View>
        <View style={{flexDirection: 'row', gap: 6}}>
          {pool.chain === 'starknet' && (
            <View style={[styles.riskBadge, {backgroundColor: '#6C5CE7' + '15'}]}>
              <Text style={[styles.riskText, {color: '#6C5CE7'}]}>Starknet</Text>
            </View>
          )}
          <View
            style={[
              styles.riskBadge,
              {backgroundColor: getRiskColor(pool.risk) + '15'},
            ]}>
            <Text style={[styles.riskText, {color: getRiskColor(pool.risk)}]}>
              {pool.risk}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.poolStats}>
        <View style={styles.poolStat}>
          <Text style={styles.poolStatLabel}>APY</Text>
          <Text style={[styles.poolStatValue, {color: COLORS.positiveGreen}]}>
            {pool.apy.toFixed(1)}%
          </Text>
        </View>
        <View style={styles.poolStat}>
          <Text style={styles.poolStatLabel}>TVL</Text>
          <Text style={styles.poolStatValue}>{pool.tvl}</Text>
        </View>
        <TouchableOpacity
          style={styles.depositButton}
          onPress={() => openYieldPoolSheet(pool)}>
          <Text style={styles.depositButtonText}>Deposit</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderStakingOption = (option: StakingOption) => (
    <TouchableOpacity
      key={option.id}
      style={styles.stakingCard}
      activeOpacity={0.7}
      onPress={() => openStakeSheet(option)}>
      <View style={styles.stakingHeader}>
        <View style={styles.stakingNameRow}>
          {renderTokenIcon(option.token, 40)}
          <View>
            <Text style={styles.stakingName}>{option.name}</Text>
            <Text style={styles.stakingToken}>
              {option.id === 'btc' ? 'LBTC via Starkzap'
                : option.id === 'strk' ? 'STRK via Starkzap'
                : option.token}
            </Text>
          </View>
        </View>
        <View style={styles.apyBadge}>
          {(option.id === 'btc' || option.id === 'strk') && apyLoading ? (
            <ActivityIndicator size="small" color={COLORS.positiveGreen} />
          ) : (
            <Text style={styles.apyText}>{option.apy.toFixed(2)}% APY</Text>
          )}
        </View>
      </View>

      <View style={styles.stakingDetails}>
        <View style={styles.stakingDetail}>
          <Text style={styles.stakingDetailLabel}>Total Staked</Text>
          <Text style={styles.stakingDetailValue}>{option.staked}</Text>
        </View>
        <View style={styles.stakingDetail}>
          <Text style={styles.stakingDetailLabel}>Lock Period</Text>
          <Text style={styles.stakingDetailValue}>{option.lockPeriod}</Text>
        </View>
        <View style={styles.stakingDetail}>
          <Text style={styles.stakingDetailLabel}>Min Stake</Text>
          <Text style={styles.stakingDetailValue}>{option.minStake}</Text>
        </View>
      </View>

      <View style={styles.stakeButton}>
        <Text style={styles.stakeButtonText}>Stake Now</Text>
      </View>

      {option.id === 'btc' && (
        <View style={styles.starkzapBadgeRow}>
          <View style={styles.starkzapBadge}>
            <Text style={styles.starkzapBadgeText}>Powered by Starkzap</Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );

  const totalDeposited = earnPositions.reduce((sum, p) => sum + p.usdValue, 0);
  const totalEarned = totalBTCRewards;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color="#1c1c1c" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Earn</Text>
          <View style={{width: 36}} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* My Portfolio */}
          <View style={styles.portfolioSection}>
            <Text style={styles.portfolioSubtitle}>
              Passively earn yield on your assets
            </Text>

            <View style={styles.portfolioCards}>
              <View style={styles.portfolioCard}>
                <Text style={styles.portfolioCardLabel}>Total Deposited</Text>
                <Text style={styles.portfolioCardValue}>
                  ${totalDeposited.toFixed(2)}
                </Text>
              </View>
              <View style={styles.portfolioCard}>
                <Text style={styles.portfolioCardLabel}>Total Earned</Text>
                <Text style={[styles.portfolioCardValue, {color: COLORS.positiveGreen}]}>
                  ${totalEarned.toFixed(2)}
                </Text>
              </View>
            </View>
          </View>

          {/* Currently earning on */}
          {earnPositions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Currently earning on</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.positionsScroll}>
                {earnPositions.map(pos => (
                  <TouchableOpacity
                    key={pos.token}
                    style={styles.positionCard}
                    activeOpacity={0.7}
                    onPress={() => {
                      const pool = yieldPools.find(p => p.token1 === pos.token);
                      if (pool) {
                        openYieldPoolSheet(pool);
                      } else {
                        const staking = BASE_STAKING_OPTIONS.find(s => s.token === pos.token);
                        if (staking) openStakeSheet(staking);
                      }
                    }}>
                    <View style={styles.positionApyBadge}>
                      <Ionicons name="flash" size={12} color={COLORS.positiveGreen} />
                      <Text style={styles.positionApyText}>{pos.apy.toFixed(2)}% APR</Text>
                    </View>
                    <View style={styles.positionTokenRow}>
                      {(LOCAL_TOKEN_ICONS[pos.token] || TOKEN_LOGOS[pos.token]) && (
                        <Image
                          source={LOCAL_TOKEN_ICONS[pos.token] || {uri: TOKEN_LOGOS[pos.token]}}
                          style={styles.positionTokenIcon}
                        />
                      )}
                      <Text style={styles.positionTokenName}>{pos.token}</Text>
                    </View>
                    <Text style={styles.positionValue}>
                      ${pos.usdValue.toFixed(2)}
                    </Text>
                    <Text style={styles.positionTokenAmount}>
                      {pos.amount < 0.0001
                        ? pos.amount.toExponential(2)
                        : pos.amount.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')} {pos.token}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Tab bar */}
          <View style={styles.earnTabs}>
            {(['Yield Pools', 'Staking'] as EarnTab[]).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.earnTab, activeTab === tab && styles.earnTabActive]}
                onPress={() => setActiveTab(tab)}>
                <Text
                  style={[
                    styles.earnTabText,
                    activeTab === tab && styles.earnTabTextActive,
                  ]}>
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Earning Opportunities */}
          {activeTab === 'Yield Pools' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Earning Opportunities</Text>
              {yieldPools.map(renderYieldPool)}
            </View>
          )}

          {activeTab === 'Staking' && (
            <View style={styles.section}>
              {stakingOptions.map(renderStakingOption)}
            </View>
          )}

          <View style={{height: 40}} />
        </ScrollView>
      </SafeAreaView>

      {selectedPool && (
        <StakeDepositSheet
          visible={sheetVisible}
          onClose={() => {
            setSheetVisible(false);
            setSelectedPool(null);
            setBtcLifecycleSteps([]);
            setStrkLifecycleSteps([]);
          }}
          pool={getPoolInfo(selectedPool)}
          userBalance={userBalance}
          onStake={handleStake}
          depositTokenOptions={
            selectedPool.id === 'btc' ? btcDepositTokenOptions
            : selectedPool.id === 'strk' ? strkDepositTokenOptions
            : undefined
          }
          onDepositTokenChange={
            selectedPool.id === 'btc' ? handleBtcDepositTokenChange
            : selectedPool.id === 'strk' ? handleStrkDepositTokenChange
            : undefined
          }
          lifecycleSteps={
            selectedPool.id === 'btc' ? btcLifecycleSteps
            : selectedPool.id === 'strk' ? strkLifecycleSteps
            : undefined
          }
          starknetAddress={
            (selectedPool.id === 'btc' || selectedPool.id === 'strk') ? starknetAddress : undefined
          }
        />
      )}

      {selectedYieldPool && (
        <StakeDepositSheet
          visible={sheetVisible}
          onClose={() => {
            setSheetVisible(false);
            setSelectedYieldPool(null);
            resetVesu();
            resetBridge();
          }}
          pool={getYieldPoolInfo(selectedYieldPool)}
          userBalance={userBalance}
          onStake={
            selectedYieldPool.chain === 'starknet'
              ? handleVesuDeposit
              : handleSolanaYieldDeposit
          }
          onUnstake={
            selectedYieldPool.chain === 'starknet'
              ? handleVesuWithdraw
              : handleSolanaYieldWithdraw
          }
          lifecycleSteps={
            selectedYieldPool.chain === 'starknet'
              ? bridgeLifecycleSteps
              : undefined
          }
          starknetAddress={
            selectedYieldPool.chain === 'starknet'
              ? starknetAddress
              : undefined
          }
          depositTokenOptions={
            selectedYieldPool.chain === 'starknet'
              ? getDepositTokenOptions(selectedYieldPool)
              : undefined
          }
          onDepositTokenChange={handleDepositTokenChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.secondaryBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: '#1c1c1c',
  },
  portfolioSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  portfolioSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamily,
    marginBottom: 12,
  },
  portfolioCards: {
    flexDirection: 'row',
    gap: 12,
  },
  portfolioCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  portfolioCardLabel: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  portfolioCardValue: {
    fontSize: 22,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: '#1c1c1c',
  },
  positionsScroll: {
    gap: 12,
    paddingRight: 16,
  },
  positionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    width: 150,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  positionApyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.positiveGreen + '12',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  positionApyText: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: COLORS.positiveGreen,
  },
  positionTokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  positionTokenIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  positionTokenName: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: '#1c1c1c',
  },
  positionValue: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: COLORS.brandPrimary,
  },
  positionTokenAmount: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  earnTabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: COLORS.secondaryBackground,
    borderRadius: 9999,
    padding: 3,
    marginBottom: 20,
  },
  earnTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9999,
    alignItems: 'center',
  },
  earnTabActive: {
    backgroundColor: COLORS.white,
  },
  earnTabText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
  },
  earnTabTextActive: {
    color: '#1c1c1c',
    fontFamily: TYPOGRAPHY.fontFamilyBold,
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: '#1c1c1c',
    marginBottom: 12,
  },
  poolCard: {
    marginBottom: 12,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: COLORS.white,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  poolHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  poolNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  poolTokens: {
    flexDirection: 'row',
  },
  poolTokenOverlap: {
    marginLeft: -10,
    borderWidth: 2,
    borderColor: COLORS.white,
    borderRadius: 18,
  },
  tokenIconPlaceholder: {
    backgroundColor: COLORS.secondaryBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tokenIconLetter: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: COLORS.brandPrimary,
  },
  poolName: {
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: '#1c1c1c',
  },
  poolProtocol: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamily,
    marginTop: 2,
  },
  riskBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  riskText: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
  },
  poolStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  poolStat: {},
  poolStatLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamily,
    marginBottom: 2,
  },
  poolStatValue: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: '#1c1c1c',
  },
  depositButton: {
    marginLeft: 'auto',
    backgroundColor: COLORS.brandPrimary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 9999,
  },
  depositButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
  },
  stakingCard: {
    marginBottom: 12,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: COLORS.white,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  stakingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  stakingNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stakingName: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: '#1c1c1c',
  },
  stakingToken: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamily,
    marginTop: 2,
  },
  apyBadge: {
    backgroundColor: COLORS.positiveGreen + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  apyText: {
    color: COLORS.positiveGreen,
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
  },
  stakingDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  stakingDetail: {},
  stakingDetailLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamily,
    marginBottom: 4,
  },
  stakingDetailValue: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
    color: '#1c1c1c',
  },
  stakeButton: {
    backgroundColor: COLORS.brandPrimary,
    paddingVertical: 14,
    borderRadius: 9999,
    alignItems: 'center',
  },
  stakeButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontFamilyBold,
  },
  starkzapBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  starkzapBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FFF7ED',
  },
  starkzapBadgeText: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamilyMedium,
    color: '#B45309',
  },
});
