import {SERVER_URL} from '@env';
import {
  StarkZap,
  OnboardStrategy,
  Amount,
  fromAddress,
  getPresets,
  mainnetValidators,
  VesuLendingProvider,
  AvnuSwapProvider,
} from 'starkzap';

const SERVER_BASE_URL = SERVER_URL || 'http://localhost:8080';

let sdkInstance: StarkZap | null = null;

const ALCHEMY_STARKNET_RPC = 'https://starknet-mainnet.g.alchemy.com/starknet/version/rpc/v0_10/YNAhbCl3zvL9UQro55XvE';

export function getStarkzapSDK(network: 'mainnet' | 'sepolia' = 'mainnet'): StarkZap {
  if (!sdkInstance) {
    sdkInstance = new StarkZap({
      network,
      rpcUrl: ALCHEMY_STARKNET_RPC,
      paymaster: {
        nodeUrl: 'https://starknet.paymaster.avnu.fi/rpc',
        headers: {
          'x-paymaster-api-key': 'f09825f3-897f-45cc-a914-1997e876f02e',
        },
      },
    } as any);
  }
  return sdkInstance;
}

export interface StarknetWalletContext {
  walletId: string;
  publicKey: string;
  serverUrl: string;
}

export async function connectStarknetWallet(
  walletId: string,
  publicKey: string,
) {
  const sdk = getStarkzapSDK();

  const { wallet } = await sdk.onboard({
    strategy: OnboardStrategy.Privy,
    privy: {
      resolve: async () => ({
        walletId,
        publicKey,
        serverUrl: `${SERVER_BASE_URL}/api/starknet/sign`,
      }),
    },
    accountPreset: 'argentXV050',
    deploy: 'if_needed',
    feeMode: 'sponsored',
  } as any);

  wallet.registerSwapProvider(new AvnuSwapProvider(), true);
  wallet.lending().registerProvider(new VesuLendingProvider());

  return wallet;
}

export interface ValidatorInfo {
  name: string;
  stakerAddress: string;
}

/**
 * Discovers all validators dynamically from the Starkzap SDK's built-in
 * mainnet presets, rather than hardcoding addresses.
 *
 * See: https://docs.starknet.io/build/starkzap/staking#discovering-validators-and-pools
 */
export function getMainnetValidators(): ValidatorInfo[] {
  return Object.values(mainnetValidators).map((v: any) => ({
    name: v.name,
    stakerAddress: typeof v.stakerAddress === 'string'
      ? v.stakerAddress
      : v.stakerAddress.toString(),
  }));
}

/**
 * Fetches all staking pools for a given validator staker address.
 */
export async function getStakingPools(stakerAddress: string) {
  const sdk = getStarkzapSDK();
  const pools = await sdk.getStakerPools(fromAddress(stakerAddress));
  return pools;
}

/**
 * Fetches all tokens that can be staked on Starknet.
 */
export async function getStakableTokens() {
  const sdk = getStarkzapSDK();
  const tokens = await sdk.stakingTokens();
  return tokens;
}

/**
 * Discovers BTC-related delegation pools across all mainnet validators.
 * Filters for WBTC, solvBTC, LBTC, tBTC pools.
 */
export async function discoverBTCPools() {
  const validators = getMainnetValidators();
  const btcPools: Array<{
    poolContract: string;
    tokenSymbol: string;
    delegatedAmount: string;
    validatorName: string;
  }> = [];

  for (const validator of validators) {
    try {
      const pools = await getStakingPools(validator.stakerAddress);
      for (const pool of pools) {
        if (['WBTC', 'solvBTC', 'LBTC', 'tBTC'].includes(pool.token.symbol)) {
          btcPools.push({
            poolContract: pool.poolContract.toString(),
            tokenSymbol: pool.token.symbol,
            delegatedAmount: pool.amount.toFormatted(),
            validatorName: validator.name,
          });
        }
      }
    } catch (err) {
      console.warn(
        `[Starkzap] Failed to fetch pools for ${validator.name}:`,
        err,
      );
    }
  }
  return btcPools;
}

/**
 * Discovers STRK delegation pools across all mainnet validators.
 */
export async function discoverSTRKPools() {
  const validators = getMainnetValidators();
  const strkPools: Array<{
    poolContract: string;
    tokenSymbol: string;
    delegatedAmount: string;
    validatorName: string;
  }> = [];

  for (const validator of validators) {
    try {
      const pools = await getStakingPools(validator.stakerAddress);
      for (const pool of pools) {
        if (pool.token.symbol === 'STRK') {
          strkPools.push({
            poolContract: pool.poolContract.toString(),
            tokenSymbol: pool.token.symbol,
            delegatedAmount: pool.amount.toFormatted(),
            validatorName: validator.name,
          });
        }
      }
    } catch (err) {
      console.warn(
        `[Starkzap] Failed to fetch STRK pools for ${validator.name}:`,
        err,
      );
    }
  }
  return strkPools;
}

export async function stakeInPool(
  wallet: any,
  poolAddress: string,
  amount: string,
  tokenSymbol: string,
) {
  const presets = getPresets(wallet.getChainId());
  const token = (presets as any)[tokenSymbol];
  if (!token) {
    throw new Error(`Token ${tokenSymbol} not found in presets`);
  }

  const tx = await wallet.stake(
    fromAddress(poolAddress),
    Amount.parse(amount, token),
  );
  await tx.wait();
  return tx;
}

export async function getPoolPosition(wallet: any, poolAddress: string) {
  const position = await wallet.getPoolPosition(fromAddress(poolAddress));
  return position;
}

export async function claimRewards(wallet: any, poolAddress: string) {
  const tx = await wallet.claimPoolRewards(fromAddress(poolAddress));
  await tx.wait();
  return tx;
}

export async function exitPoolIntent(
  wallet: any,
  poolAddress: string,
  amount: string,
  tokenSymbol: string,
) {
  const presets = getPresets(wallet.getChainId());
  const token = (presets as any)[tokenSymbol];
  if (!token) {
    throw new Error(`Token ${tokenSymbol} not found in presets`);
  }

  const tx = await wallet.exitPoolIntent(
    fromAddress(poolAddress),
    Amount.parse(amount, token),
  );
  await tx.wait();
  return tx;
}

export async function exitPool(wallet: any, poolAddress: string) {
  const tx = await wallet.exitPool(fromAddress(poolAddress));
  await tx.wait();
  return tx;
}
