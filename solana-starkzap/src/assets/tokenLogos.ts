/**
 * Token and chain logos from CoinGecko's public CDN.
 * No API key required — these are static image URLs.
 */

export const TOKEN_LOGOS = {
  BTC: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
  WBTC: 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png',
  LBTC: 'https://assets.coingecko.com/coins/images/40745/small/lbtc.png',
  tBTC: 'https://assets.coingecko.com/coins/images/11224/small/0x18084fba666a33d37592fa2633fd49a74dd93a88.png',
  solvBTC: 'https://assets.coingecko.com/coins/images/36800/small/solvBTC.png',
  USDC: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
  ETH: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  STRK: 'https://assets.coingecko.com/coins/images/26433/small/starknet.png',
} as const;

export const CHAIN_LOGOS = {
  Starknet: 'https://assets.coingecko.com/coins/images/26433/small/starknet.png',
  Base: 'https://assets.coingecko.com/asset_platforms/images/131/small/base.jpeg',
  Ethereum: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  Arbitrum: 'https://assets.coingecko.com/coins/images/16547/small/arb.jpg',
  Polygon: 'https://assets.coingecko.com/coins/images/4713/small/polygon.png',
  Monad: 'https://assets.coingecko.com/coins/images/52139/small/monad.jpg',
} as const;
