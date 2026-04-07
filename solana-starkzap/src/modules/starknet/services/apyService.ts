/**
 * Fetches live staking APY data from DeFiLlama Yields API.
 * https://yields.llama.fi/pools
 */

const DEFILLAMA_YIELDS_API = 'https://yields.llama.fi/pools';

export interface StakingApyData {
  btcApy: number;
  strkApy: number;
  btcPools: PoolApy[];
}

interface PoolApy {
  symbol: string;
  apy: number;
  tvl: number;
  project: string;
}

let cachedData: StakingApyData | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches live BTC and STRK staking APYs on Starknet from DeFiLlama.
 * Caches results for 5 minutes to avoid excessive API calls.
 */
export async function fetchStakingApy(): Promise<StakingApyData> {
  if (cachedData && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedData;
  }

  try {
    const response = await fetch(DEFILLAMA_YIELDS_API);
    const data = await response.json();
    const pools = data?.data || [];

    // Find Starknet staking pools (endur = validator staking protocol)
    const starknetStaking = pools.filter(
      (p: any) => p.chain === 'Starknet' && p.project === 'endur'
    );

    const btcSymbols = ['WBTC', 'LBTC', 'TBTC', 'SOLVBTC'];
    const btcPools: PoolApy[] = starknetStaking
      .filter((p: any) => btcSymbols.includes(p.symbol))
      .map((p: any) => ({
        symbol: p.symbol,
        apy: p.apy || p.apyBase || 0,
        tvl: p.tvlUsd || 0,
        project: p.project,
      }));

    // BTC APY = weighted average by TVL, or highest TVL pool
    let btcApy = 0;
    if (btcPools.length > 0) {
      const totalTvl = btcPools.reduce((sum, p) => sum + p.tvl, 0);
      if (totalTvl > 0) {
        btcApy = btcPools.reduce((sum, p) => sum + p.apy * (p.tvl / totalTvl), 0);
      } else {
        btcApy = btcPools[0].apy;
      }
    }

    // STRK APY
    const strkPool = starknetStaking.find((p: any) => p.symbol === 'STRK');
    const strkApy = strkPool?.apy || strkPool?.apyBase || 0;

    const result: StakingApyData = { btcApy, strkApy, btcPools };

    console.log(`[APY] Fetched live APY: BTC=${btcApy.toFixed(2)}%, STRK=${strkApy.toFixed(2)}%, pools=${btcPools.length}`);

    cachedData = result;
    cacheTimestamp = Date.now();
    return result;
  } catch (err) {
    console.warn('[APY] Failed to fetch from DeFiLlama:', err);
    // Return cached or fallback
    return cachedData || { btcApy: 2.07, strkApy: 7.0, btcPools: [] };
  }
}
