const DEFILLAMA_POOLS_API = 'https://yields.llama.fi/pools';

type FetchOptions = {
  forceRefresh?: boolean;
};

const normalizeApy = (pool: any): number => {
  const apy = typeof pool?.apy === 'number' ? pool.apy : 0;
  if (apy > 0) return apy;
  const apyBase = typeof pool?.apyBase === 'number' ? pool.apyBase : 0;
  const apyReward = typeof pool?.apyReward === 'number' ? pool.apyReward : 0;
  const combined = apyBase + apyReward;
  return combined > 0 ? combined : 0;
};

export interface StakingPoolYield {
  symbol: string;
  project: string;
  apy: number;
  apyBase: number;
  apyReward: number | null;
  tvlUsd: number;
  poolId: string;
}

let cachedYields: StakingPoolYield[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches live BTC staking yields on Starknet from DeFiLlama.
 * Results are cached for 5 minutes.
 */
export async function fetchBTCStakingYields(
  options: FetchOptions = {},
): Promise<StakingPoolYield[]> {
  if (!options.forceRefresh && cachedYields && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedYields;
  }

  try {
    const response = await fetch(DEFILLAMA_POOLS_API);
    if (!response.ok) {
      console.warn('[StakingAPY] DeFiLlama API error:', response.status);
      return cachedYields || [];
    }

    const data = await response.json();
    const pools = data.data || [];

    const btcSymbols = ['BTC', 'LBTC', 'WBTC', 'TBTC', 'SOLVBTC'];

    const btcStarknetPools: StakingPoolYield[] = pools
      .filter((p: any) =>
        p.chain === 'Starknet' &&
        btcSymbols.some(s => (p.symbol || '').toUpperCase().includes(s))
      )
      .map((p: any) => ({
        symbol: p.symbol,
        project: p.project,
        apy: normalizeApy(p),
        apyBase: p.apyBase || 0,
        apyReward: p.apyReward,
        tvlUsd: p.tvlUsd || 0,
        poolId: p.pool,
      }));

    cachedYields = btcStarknetPools;
    cacheTimestamp = Date.now();

    console.log(`[StakingAPY] Fetched ${btcStarknetPools.length} BTC pools on Starknet`);
    return btcStarknetPools;
  } catch (error) {
    console.error('[StakingAPY] Failed to fetch yields:', error);
    return cachedYields || [];
  }
}

/**
 * Gets the best single-asset LBTC staking APY on Starknet.
 * Falls back to WBTC if LBTC pool not found.
 */
export async function getLBTCStakingAPY(
  options: FetchOptions = {},
): Promise<{
  apy: number;
  tvlUsd: number;
  project: string;
} | null> {
  const pools = await fetchBTCStakingYields(options);

  // Prefer single-asset LBTC pools (not LP pairs)
  const lbtcPool = pools.find(
    p => p.symbol === 'LBTC' && p.apy > 0
  );
  if (lbtcPool) {
    return { apy: lbtcPool.apy, tvlUsd: lbtcPool.tvlUsd, project: lbtcPool.project };
  }

  // Fallback to single-asset WBTC
  const wbtcPool = pools.find(
    p => p.symbol === 'WBTC' && p.apy > 0
  );
  if (wbtcPool) {
    return { apy: wbtcPool.apy, tvlUsd: wbtcPool.tvlUsd, project: wbtcPool.project };
  }

  return null;
}

/**
 * Gets the highest-yield BTC pool on Starknet (any type including LP).
 */
export async function getHighestBTCYield(
  options: FetchOptions = {},
): Promise<StakingPoolYield | null> {
  const pools = await fetchBTCStakingYields(options);
  if (pools.length === 0) return null;

  return pools.reduce((best, pool) =>
    pool.apy > best.apy ? pool : best
  );
}

let cachedStrkYields: StakingPoolYield[] | null = null;
let strkCacheTimestamp = 0;

/**
 * Fetches live STRK staking yields on Starknet from DeFiLlama.
 */
export async function fetchSTRKStakingYields(
  options: FetchOptions = {},
): Promise<StakingPoolYield[]> {
  if (!options.forceRefresh && cachedStrkYields && Date.now() - strkCacheTimestamp < CACHE_TTL_MS) {
    return cachedStrkYields;
  }

  try {
    const response = await fetch(DEFILLAMA_POOLS_API);
    if (!response.ok) {
      return cachedStrkYields || [];
    }

    const data = await response.json();
    const pools = data.data || [];

    const strkPools: StakingPoolYield[] = pools
      .filter((p: any) =>
        p.chain === 'Starknet' &&
        (p.symbol || '').toUpperCase().includes('STRK')
      )
      .map((p: any) => ({
        symbol: p.symbol,
        project: p.project,
        apy: normalizeApy(p),
        apyBase: p.apyBase || 0,
        apyReward: p.apyReward,
        tvlUsd: p.tvlUsd || 0,
        poolId: p.pool,
      }));

    cachedStrkYields = strkPools;
    strkCacheTimestamp = Date.now();
    console.log(`[StakingAPY] Fetched ${strkPools.length} STRK staking pools on Starknet`);
    return strkPools;
  } catch (error) {
    console.error('[StakingAPY] Failed to fetch STRK yields:', error);
    return cachedStrkYields || [];
  }
}

/**
 * Gets the best STRK native staking APY on Starknet.
 */
export async function getSTRKStakingAPY(
  options: FetchOptions = {},
): Promise<{
  apy: number;
  tvlUsd: number;
  project: string;
} | null> {
  const pools = await fetchSTRKStakingYields(options);
  const eligible = pools.filter(p => p.apy > 0);
  const singleAsset = eligible.filter(p => (p.symbol || '').toUpperCase() === 'STRK');
  const shortlist = singleAsset.length > 0 ? singleAsset : eligible;
  const best = shortlist.sort((a, b) => b.tvlUsd - a.tvlUsd)[0];

  if (best) {
    return { apy: best.apy, tvlUsd: best.tvlUsd, project: best.project };
  }
  return null;
}
