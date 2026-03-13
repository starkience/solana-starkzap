import { TokenInfo } from '@/modules/data-module';

const JUPITER_PRICE_URL = 'https://api.jup.ag/price/v2';
const JUPITER_TOKEN_URL = 'https://token.jup.ag/strict';
const COINGECKO_FREE_URL = 'https://api.coingecko.com/api/v3';

const SOLANA_TOKEN_MAP: Record<string, string> = {
  'So11111111111111111111111111111111111111112': 'solana',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'usd-coin',
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': 'jupiter-exchange-solana',
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 'bonk',
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'tether',
  '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': 'ethereum-wormhole',
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 'marinade-staked-sol',
  'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn': 'jito-staked-sol',
  'hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux': 'helium',
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3': 'pyth-network',
  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': 'raydium',
  'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE': 'orca',
};

export async function fetchJupiterPrices(mints: string[]): Promise<Record<string, number>> {
  try {
    const ids = mints.join(',');
    const response = await fetch(`${JUPITER_PRICE_URL}?ids=${ids}`);
    if (!response.ok) return {};
    const json = await response.json();
    const prices: Record<string, number> = {};

    if (json.data) {
      for (const [mint, data] of Object.entries(json.data)) {
        const raw = (data as any).price;
        prices[mint] = typeof raw === 'string' ? parseFloat(raw) : (raw || 0);
      }
    }
    return prices;
  } catch (err) {
    // Silently fail - price fetch is best-effort
    return {};
  }
}

export async function fetchJupiterPrice(mint: string): Promise<number> {
  const prices = await fetchJupiterPrices([mint]);
  return prices[mint] || 0;
}

export interface CoinGeckoMarketData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  total_volume: number;
  price_change_percentage_24h: number;
  sparkline_in_7d?: { price: number[] };
}

export async function fetchTopTokensCoinGecko(
  page = 1,
  perPage = 20,
): Promise<CoinGeckoMarketData[]> {
  try {
    const url = `${COINGECKO_FREE_URL}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=${page}&sparkline=true&price_change_percentage=24h`;
    const response = await fetch(url);

    if (response.status === 429) {
      console.warn('[FreeData] CoinGecko rate limited, returning empty');
      return [];
    }

    return await response.json();
  } catch (err) {
    console.error('[FreeData] CoinGecko markets error:', err);
    return [];
  }
}

export async function fetchSolanaTokensCoinGecko(
  category = 'solana-ecosystem',
  perPage = 20,
): Promise<CoinGeckoMarketData[]> {
  try {
    const url = `${COINGECKO_FREE_URL}/coins/markets?vs_currency=usd&category=${category}&order=market_cap_desc&per_page=${perPage}&page=1&sparkline=false&price_change_percentage=24h`;
    const response = await fetch(url);

    if (response.status === 429) {
      console.warn('[FreeData] CoinGecko rate limited');
      return [];
    }

    return await response.json();
  } catch (err) {
    console.error('[FreeData] CoinGecko Solana tokens error:', err);
    return [];
  }
}

export async function fetchPriceHistoryFree(
  coinId: string,
  days: string = '1',
): Promise<{ timestamps: number[]; prices: number[] }> {
  try {
    const geckoId = SOLANA_TOKEN_MAP[coinId] || coinId;
    const url = `${COINGECKO_FREE_URL}/coins/${geckoId}/market_chart?vs_currency=usd&days=${days}`;
    const response = await fetch(url);

    if (response.status === 429) {
      console.warn('[FreeData] CoinGecko rate limited for chart');
      return { timestamps: [], prices: [] };
    }

    const json = await response.json();
    const timestamps = (json.prices || []).map((p: number[]) => p[0]);
    const prices = (json.prices || []).map((p: number[]) => p[1]);

    return { timestamps, prices };
  } catch (err) {
    console.error('[FreeData] Price history error:', err);
    return { timestamps: [], prices: [] };
  }
}

export async function fetchJupiterTokenList(): Promise<TokenInfo[]> {
  try {
    const response = await fetch(JUPITER_TOKEN_URL);
    const tokens = await response.json();

    return tokens.slice(0, 100).map((t: any) => ({
      address: t.address,
      symbol: t.symbol,
      name: t.name,
      decimals: t.decimals,
      logoURI: t.logoURI || '',
    }));
  } catch (err) {
    console.error('[FreeData] Jupiter token list error:', err);
    return [];
  }
}

export function getCoinGeckoIdForMint(mint: string): string | null {
  return SOLANA_TOKEN_MAP[mint] || null;
}

export async function fetchTokenPriceFree(tokenInfo: TokenInfo | null): Promise<number> {
  if (!tokenInfo) return 0;

  try {
    const price = await fetchJupiterPrice(tokenInfo.address);
    if (price > 0) return price;
  } catch {}

  const geckoId = SOLANA_TOKEN_MAP[tokenInfo.address];
  if (geckoId) {
    try {
      const url = `${COINGECKO_FREE_URL}/simple/price?ids=${geckoId}&vs_currencies=usd`;
      const response = await fetch(url);
      const json = await response.json();
      return json[geckoId]?.usd || 0;
    } catch {}
  }

  return 0;
}
