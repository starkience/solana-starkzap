import {Amount, fromAddress, type WalletInterface} from 'starkzap';
import type {Token, Address} from 'starkzap';

const VESU_API = 'https://api.vesu.xyz';
const ALCHEMY_STARKNET_RPC = 'https://starknet-mainnet.g.alchemy.com/starknet/version/rpc/v0_10/REDACTED_ALCHEMY_KEY';
const BALANCE_OF_SELECTOR = '0x2e4263afad30923c891518314c3c95dbe830a16874e8abc5777a9a20b54c76e';

export interface VesuPoolAsset {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  supplyApy: number;
  lstApr: number | null;
  totalSupplied: string;
  totalSuppliedUsd: number;
  usdPrice: number;
}

/**
 * Fetches pool details from the Vesu API and parses the relevant asset
 * metrics (APY, TVL, price).
 */
export async function getVesuPoolInfo(
  poolId: string,
  tokenAddress: string,
): Promise<VesuPoolAsset | null> {
  try {
    const response = await fetch(`${VESU_API}/pools`);
    if (!response.ok) return null;

    const data = await response.json();
    const pools = data.data || [];
    const pool = pools.find((p: any) => p.id === poolId);
    if (!pool) return null;

    const asset = pool.assets?.find(
      (a: any) => a.address.toLowerCase() === tokenAddress.toLowerCase(),
    );
    if (!asset) return null;

    const decimals = asset.decimals || 18;
    const stats = asset.stats || {};

    const supplyApyRaw = stats.supplyApy?.value || '0';
    const supplyApyDec = stats.supplyApy?.decimals || 18;
    const supplyApy = parseFloat(supplyApyRaw) / Math.pow(10, supplyApyDec);

    const lstAprRaw = stats.lstApr?.value || null;
    const lstAprDec = stats.lstApr?.decimals || 18;
    const lstApr = lstAprRaw
      ? parseFloat(lstAprRaw) / Math.pow(10, lstAprDec)
      : null;

    const totalSuppliedRaw = stats.totalSupplied?.value || '0';
    const totalSuppliedDec = stats.totalSupplied?.decimals || decimals;
    const totalSupplied =
      parseFloat(totalSuppliedRaw) / Math.pow(10, totalSuppliedDec);

    const priceRaw = asset.usdPrice?.value || '0';
    const priceDec = asset.usdPrice?.decimals || 18;
    const usdPrice = parseFloat(priceRaw) / Math.pow(10, priceDec);

    return {
      address: asset.address,
      symbol: asset.symbol,
      name: asset.name,
      decimals,
      supplyApy: supplyApy * 100,
      lstApr: lstApr !== null ? lstApr * 100 : null,
      totalSupplied: totalSupplied.toFixed(2),
      totalSuppliedUsd: totalSupplied * usdPrice,
      usdPrice,
    };
  } catch (error) {
    console.error('[VesuService] Failed to fetch pool info:', error);
    return null;
  }
}

/**
 * Queries the ERC20 balance of an address on Starknet via Alchemy RPC.
 * Returns the balance as a human-readable string (e.g., "0.000312").
 */
export async function getStarknetTokenBalance(
  tokenAddress: string,
  ownerAddress: string,
  decimals: number,
): Promise<string> {
  const normalizedToken = tokenAddress.startsWith('0x') ? tokenAddress : `0x${tokenAddress}`;
  const normalizedOwner = ownerAddress.startsWith('0x') ? ownerAddress : `0x${ownerAddress}`;

  const body = {
    jsonrpc: '2.0',
    method: 'starknet_call',
    params: {
      request: {
        contract_address: normalizedToken,
        entry_point_selector: BALANCE_OF_SELECTOR,
        calldata: [normalizedOwner],
      },
      block_id: 'latest',
    },
    id: 1,
  };

  const res = await fetch(ALCHEMY_STARKNET_RPC, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (json.error) {
    console.warn('[VesuService] balanceOf error:', json.error);
    return '0';
  }

  const low = BigInt(json.result?.[0] || '0');
  const high = BigInt(json.result?.[1] || '0');
  const rawBalance = low + (high << BigInt(128));

  const divisor = BigInt(10 ** decimals);
  const intPart = rawBalance / divisor;
  const fracPart = rawBalance % divisor;
  const fracStr = fracPart.toString().padStart(decimals, '0');
  const trimmed = fracStr.replace(/0+$/, '') || '0';

  return `${intPart}.${trimmed}`;
}

/**
 * Builds a Token descriptor for Starkzap's lending API.
 */
export function makeToken(
  address: string,
  symbol: string,
  decimals: number,
): Token {
  return {
    name: symbol,
    address: fromAddress(address),
    decimals,
    symbol,
  };
}

/**
 * Deposits into a Vesu lending pool using Starkzap's LendingClient.
 *
 * The wallet must already have VesuLendingProvider registered
 * (done in connectStarknetWallet).
 */
export async function depositToVesu(
  wallet: WalletInterface,
  poolAddress: string,
  tokenAddress: string,
  tokenSymbol: string,
  tokenDecimals: number,
  amount: string,
): Promise<{txHash: string; explorerUrl: string}> {
  const token = makeToken(tokenAddress, tokenSymbol, tokenDecimals);
  const depositAmount = Amount.parse(amount, token);
  const vesuPoolAddress: Address = fromAddress(poolAddress);

  console.log('[VesuService] Depositing via LendingClient:', {
    pool: poolAddress.slice(0, 12) + '...',
    token: tokenSymbol,
    amount,
  });

  const lendingClient = wallet.lending();
  const tx = await lendingClient.deposit({
    token,
    amount: depositAmount,
    poolAddress: vesuPoolAddress,
    provider: 'vesu',
  });

  await tx.wait();

  console.log('[VesuService] Deposit confirmed:', tx.hash);

  return {
    txHash: tx.hash,
    explorerUrl: tx.explorerUrl || `https://voyager.online/tx/${tx.hash}`,
  };
}

/**
 * Withdraws from a Vesu lending pool using Starkzap's LendingClient.
 */
export async function withdrawFromVesu(
  wallet: WalletInterface,
  poolAddress: string,
  tokenAddress: string,
  tokenSymbol: string,
  tokenDecimals: number,
  amount: string,
): Promise<{txHash: string; explorerUrl: string}> {
  const token = makeToken(tokenAddress, tokenSymbol, tokenDecimals);
  const withdrawAmount = Amount.parse(amount, token);
  const vesuPoolAddress: Address = fromAddress(poolAddress);

  console.log('[VesuService] Withdrawing via LendingClient:', {
    pool: poolAddress.slice(0, 12) + '...',
    token: tokenSymbol,
    amount,
  });

  const lendingClient = wallet.lending();
  const tx = await lendingClient.withdraw({
    token,
    amount: withdrawAmount,
    poolAddress: vesuPoolAddress,
    provider: 'vesu',
  });

  await tx.wait();

  console.log('[VesuService] Withdrawal confirmed:', tx.hash);

  return {
    txHash: tx.hash,
    explorerUrl: tx.explorerUrl || `https://voyager.online/tx/${tx.hash}`,
  };
}
