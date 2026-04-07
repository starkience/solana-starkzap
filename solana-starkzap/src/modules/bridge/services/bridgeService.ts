/**
 * Bridge service for transferring tokens between Solana and Starknet
 * via the LayerZero Value Transfer API.
 *
 * API: https://docs.layerzero.network/v2/developers/value-transfer-api/api-reference/overview
 *
 * Flow (Solana source):
 *   1. POST /tokens  — validate transfer route
 *   2. POST /quotes  — get quote with fees, route, and quoteId
 *   3. POST /build-user-steps — get fresh Solana tx (blockhash valid ~60s)
 *   4. Sign + submit the VersionedTransaction
 *   5. GET  /status/:quoteId — poll until SUCCEEDED/FAILED
 */

import {VersionedTransaction, Connection} from '@solana/web3.js';

export type BridgeDirection =
  | 'solana_to_starknet'
  | 'starknet_to_solana'
  | 'base_to_starknet'
  | 'ethereum_to_starknet'
  | 'arbitrum_to_starknet'
  | 'polygon_to_starknet'
  | 'monad_to_starknet';

export interface BridgeQuote {
  quoteId: string;
  sourceToken: string;
  destToken: string;
  amount: string;
  estimatedOutput: string;
  minOutput: string;
  bridgeFeeUsd: string;
  bridgeFeePercent: string;
  estimatedTimeSeconds: number;
  routeType: string;
}

export interface BridgeTransferResult {
  quoteId: string;
  txHash: string;
  status: 'pending' | 'completed' | 'failed';
  estimatedArrival: Date;
  explorerUrl?: string;
}

const VT_API_BASE = 'https://transfer.layerzero-api.com/v1';

const CHAIN_KEY_SOLANA = 'solana';
const CHAIN_KEY_STARKNET = 'starknet';

/** LayerZero chain keys for EVM networks */
const CHAIN_KEYS: Record<string, string> = {
  solana: 'solana',
  starknet: 'starknet',
  base: 'base',
  ethereum: 'ethereum',
  arbitrum: 'arbitrum',
  polygon: 'polygon',
  monad: 'monad',
};

/**
 * Resolves source and destination chain keys from a BridgeDirection.
 */
function resolveChainKeys(direction: BridgeDirection): { srcChain: string; dstChain: string } {
  const parts = direction.split('_to_');
  return {
    srcChain: CHAIN_KEYS[parts[0]] || parts[0],
    dstChain: CHAIN_KEYS[parts[1]] || parts[1],
  };
}

/**
 * Returns whether a direction originates from an EVM chain.
 */
export function isEVMSource(direction: BridgeDirection): boolean {
  return !direction.startsWith('solana') && !direction.startsWith('starknet');
}

interface TokenAddresses {
  solanaAddress: string;
  starknetAddress: string;
  solanaDecimals: number;
  starknetDecimals: number;
}

const tokenAddressCache: Record<string, TokenAddresses> = {};

/**
 * Converts a human-readable amount (e.g. "1.5") to base units
 * given the token's decimal count.
 * E.g. toBaseUnits("1", 6) = "1000000" (for USDC)
 */
function toBaseUnits(amount: string, decimals: number): string {
  const parts = amount.split('.');
  const integer = parts[0] || '0';
  const fractional = (parts[1] || '').padEnd(decimals, '0').slice(0, decimals);
  const raw = integer + fractional;
  const result = raw.replace(/^0+/, '') || '0';
  return result;
}

/**
 * Discovers token addresses on Solana and Starknet by querying
 * the Value Transfer API's /tokens endpoint.
 */
async function discoverTokenAddresses(tokenSymbol: string): Promise<TokenAddresses> {
  if (tokenAddressCache[tokenSymbol]) return tokenAddressCache[tokenSymbol];

  console.log(`[Bridge] Discovering ${tokenSymbol} addresses on Solana & Starknet...`);
  const response = await fetch(`${VT_API_BASE}/tokens`);
  const {tokens} = await response.json();

  const solanaToken = tokens.find(
    (t: any) => t.chainKey === CHAIN_KEY_SOLANA && t.symbol === tokenSymbol && t.isSupported,
  );
  const starknetToken = tokens.find(
    (t: any) => t.chainKey === CHAIN_KEY_STARKNET && t.symbol === tokenSymbol && t.isSupported,
  );

  if (!solanaToken || !starknetToken) {
    const availableSolana = tokens
      .filter((t: any) => t.chainKey === CHAIN_KEY_SOLANA && t.isSupported)
      .map((t: any) => t.symbol)
      .join(', ');
    const availableStarknet = tokens
      .filter((t: any) => t.chainKey === CHAIN_KEY_STARKNET && t.isSupported)
      .map((t: any) => t.symbol)
      .join(', ');
    console.warn(`[Bridge] ${tokenSymbol} not found. Solana tokens: ${availableSolana}. Starknet tokens: ${availableStarknet}`);
    throw new Error(
      `${tokenSymbol} not found on both Solana and Starknet via LayerZero Value Transfer API`,
    );
  }

  console.log(`[Bridge] Found ${tokenSymbol}: Solana=${solanaToken.address} (${solanaToken.decimals} decimals), Starknet=${starknetToken.address} (${starknetToken.decimals} decimals)`);
  tokenAddressCache[tokenSymbol] = {
    solanaAddress: solanaToken.address,
    starknetAddress: starknetToken.address,
    solanaDecimals: solanaToken.decimals ?? 18,
    starknetDecimals: starknetToken.decimals ?? 18,
  };
  return tokenAddressCache[tokenSymbol];
}

/**
 * Validates that a token transfer route between Solana and Starknet exists.
 */
export async function validateTransferRoute(
  direction: BridgeDirection,
  tokenSymbol: string = 'USDC',
): Promise<boolean> {
  const srcChain = direction === 'solana_to_starknet' ? CHAIN_KEY_SOLANA : CHAIN_KEY_STARKNET;
  const dstChain = direction === 'solana_to_starknet' ? CHAIN_KEY_STARKNET : CHAIN_KEY_SOLANA;

  const addrs = await discoverTokenAddresses(tokenSymbol);
  const srcTokenAddr = direction === 'solana_to_starknet'
    ? addrs.solanaAddress
    : addrs.starknetAddress;

  const params = new URLSearchParams({
    transferrableFromChainKey: srcChain,
    transferrableFromTokenAddress: srcTokenAddr,
  });

  const response = await fetch(`${VT_API_BASE}/tokens?${params}`);
  const {tokens} = await response.json();

  const dstTokenAddr = direction === 'solana_to_starknet'
    ? addrs.starknetAddress
    : addrs.solanaAddress;

  return tokens.some(
    (t: any) =>
      t.chainKey === dstChain &&
      t.address.toLowerCase() === dstTokenAddr.toLowerCase(),
  );
}

/**
 * Fetches a bridge quote for a token transfer via the Value Transfer API.
 */
export async function getBridgeQuote(
  direction: BridgeDirection,
  amount: string,
  srcWalletAddress: string,
  dstWalletAddress: string,
  apiKey: string,
  tokenSymbol: string = 'USDC',
): Promise<BridgeQuote> {
  const { srcChain, dstChain } = resolveChainKeys(direction);

  // Discover token addresses for src and dst chains
  const allTokens = await discoverAllTokenAddresses(tokenSymbol);
  const srcToken = allTokens.find(t => t.chainKey === srcChain);
  const dstToken = allTokens.find(t => t.chainKey === dstChain);

  if (!srcToken || !dstToken) {
    throw new Error(
      `${tokenSymbol} not found on ${srcChain} and/or ${dstChain} via LayerZero Value Transfer API`,
    );
  }

  const srcTokenAddress = srcToken.address;
  const dstTokenAddress = dstToken.address;
  const srcDecimals = srcToken.decimals;
  const amountBaseUnits = toBaseUnits(amount, srcDecimals);

  console.log(`[Bridge] Getting quote: ${tokenSymbol} ${srcChain} → ${dstChain}, amount=${amount} (${amountBaseUnits} base units, ${srcDecimals} decimals)`);

  const requestBody = {
    srcChainKey: srcChain,
    dstChainKey: dstChain,
    srcTokenAddress,
    dstTokenAddress,
    srcWalletAddress,
    dstWalletAddress,
    amount: amountBaseUnits,
    options: {
      amountType: 'EXACT_SRC_AMOUNT',
      feeTolerance: {type: 'PERCENT', amount: 2},
    },
  };

  const response = await fetch(`${VT_API_BASE}/quotes`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  const data = await response.json();
  console.log(`[Bridge] Quote response status=${response.status}, quotes=${data.quotes?.length ?? 0}`, data.error ? `error=${JSON.stringify(data.error)}` : '');

  if (data.error) {
    throw new Error(
      `Quote error: ${data.error.message}${data.error.issues?.map((i: any) => ` - ${i.message}`).join('') ?? ''}`,
    );
  }

  const quote = data.quotes?.[0];
  if (!quote) {
    console.warn('[Bridge] No quotes returned. Full response:', JSON.stringify(data).slice(0, 500));
    throw new Error(`No quotes available for ${tokenSymbol} transfer route`);
  }

  const estimatedMs = quote.duration?.estimated
    ? parseInt(quote.duration.estimated, 10)
    : 300_000;

  return {
    quoteId: quote.id,
    sourceToken: tokenSymbol,
    destToken: tokenSymbol,
    amount: quote.srcAmount,
    estimatedOutput: quote.dstAmount,
    minOutput: quote.dstAmountMin || quote.dstAmount,
    bridgeFeeUsd: quote.feeUsd || '0',
    bridgeFeePercent: quote.feePercent || '0',
    estimatedTimeSeconds: Math.ceil(estimatedMs / 1000),
    routeType: quote.routeSteps?.[0]?.type || 'UNKNOWN',
  };
}

/**
 * Builds fresh user steps for a transfer.
 * Solana transactions have ~60s blockhash validity, so call immediately before signing.
 */
async function buildUserSteps(
  quoteId: string,
  apiKey: string,
): Promise<any[]> {
  const response = await fetch(`${VT_API_BASE}/build-user-steps`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({quoteId}),
  });

  const data = await response.json();
  return data.userSteps || [];
}

/**
 * Initiates a bridge transfer from Solana to Starknet.
 */
export async function bridgeSolanaToStarknet(
  quoteId: string,
  solanaWalletProvider: {
    publicKey: string;
    signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>;
    connection: Connection;
  } | null,
  apiKey: string,
): Promise<BridgeTransferResult> {
  const userSteps = await buildUserSteps(quoteId, apiKey);

  let lastSignature = '';

  for (const step of userSteps) {
    if (step.type !== 'TRANSACTION' || step.chainType !== 'SOLANA') continue;

    const encoded = step.transaction.encoded;
    if (encoded.encoding !== 'base64') continue;

    if (!solanaWalletProvider) {
      throw new Error('Solana wallet provider required for signing');
    }

    const txBuffer = Buffer.from(encoded.data, 'base64');
    const transaction = VersionedTransaction.deserialize(new Uint8Array(txBuffer));

    const signedTx = await solanaWalletProvider.signTransaction(transaction);
    lastSignature = await solanaWalletProvider.connection.sendRawTransaction(
      signedTx.serialize(),
    );

    const latest = await solanaWalletProvider.connection.getLatestBlockhash();
    await solanaWalletProvider.connection.confirmTransaction({
      signature: lastSignature,
      blockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight,
    });
  }

  if (!lastSignature) {
    throw new Error('No Solana transaction steps found in the quote');
  }

  return {
    quoteId,
    txHash: lastSignature,
    status: 'pending',
    estimatedArrival: new Date(Date.now() + 5 * 60 * 1000),
  };
}

/**
 * Initiates a bridge transfer from Starknet to Solana.
 */
export async function bridgeStarknetToSolana(
  quoteId: string,
  starknetWallet: any,
  apiKey: string,
): Promise<BridgeTransferResult> {
  const response = await fetch(`${VT_API_BASE}/quotes`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({quoteId}),
  });

  const data = await response.json();
  const quote = data.quotes?.[0];
  const userSteps = quote?.userSteps || [];

  let txHash = '';

  for (const step of userSteps) {
    if (step.type !== 'TRANSACTION') continue;

    if (step.chainType === 'STARKNET') {
      const tx = await starknetWallet.execute(
        step.transaction.encoded.calls || [step.transaction.encoded],
      );
      await tx.wait();
      txHash = tx.transaction_hash || tx.hash || '';
    }
  }

  if (!txHash) {
    throw new Error('No Starknet transaction steps found in the quote');
  }

  return {
    quoteId,
    txHash,
    status: 'pending',
    estimatedArrival: new Date(Date.now() + 5 * 60 * 1000),
  };
}

/**
 * Polls for bridge transfer completion.
 */
export async function checkBridgeStatus(
  quoteId: string,
  txHash?: string,
  apiKey?: string,
): Promise<{
  status: 'pending' | 'completed' | 'failed';
  explorerUrl?: string;
}> {
  try {
    const query = txHash ? `?txHash=${encodeURIComponent(txHash)}` : '';
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    const response = await fetch(
      `${VT_API_BASE}/status/${encodeURIComponent(quoteId)}${query}`,
      {headers},
    );

    if (!response.ok) {
      return {status: 'pending'};
    }

    const data = await response.json();

    if (data.status === 'SUCCEEDED') {
      return {status: 'completed', explorerUrl: data.explorerUrl};
    }
    if (data.status === 'FAILED' || data.status === 'UNKNOWN') {
      return {status: 'failed', explorerUrl: data.explorerUrl};
    }

    return {status: 'pending', explorerUrl: data.explorerUrl};
  } catch {
    return {status: 'pending'};
  }
}

/**
 * Discovers token addresses across ALL supported chains from LayerZero.
 * Returns an array of { chainKey, address, decimals } for the given token.
 */
interface TokenOnChain {
  chainKey: string;
  address: string;
  decimals: number;
}

let allTokenCache: Record<string, TokenOnChain[]> = {};

async function discoverAllTokenAddresses(tokenSymbol: string): Promise<TokenOnChain[]> {
  if (allTokenCache[tokenSymbol]) return allTokenCache[tokenSymbol];

  console.log(`[Bridge] Discovering ${tokenSymbol} addresses across all chains...`);
  const response = await fetch(`${VT_API_BASE}/tokens`);
  const { tokens } = await response.json();

  const matches: TokenOnChain[] = tokens
    .filter((t: any) => t.symbol === tokenSymbol && t.isSupported)
    .map((t: any) => ({
      chainKey: t.chainKey,
      address: t.address,
      decimals: t.decimals ?? 18,
    }));

  allTokenCache[tokenSymbol] = matches;
  console.log(`[Bridge] Found ${tokenSymbol} on chains: ${matches.map((m: TokenOnChain) => m.chainKey).join(', ')}`);
  return matches;
}

/**
 * Returns all chains that support a given token via LayerZero.
 */
export async function getSupportedChainsForToken(tokenSymbol: string = 'USDC'): Promise<string[]> {
  const tokens = await discoverAllTokenAddresses(tokenSymbol);
  return tokens.map(t => t.chainKey);
}

/**
 * Builds user steps for an EVM→Starknet bridge.
 * Returns the raw transaction data that needs to be signed by an EVM wallet.
 */
export async function buildEVMBridgeSteps(
  quoteId: string,
  apiKey: string,
): Promise<{
  chainType: string;
  transaction: any;
}[]> {
  const response = await fetch(`${VT_API_BASE}/build-user-steps`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ quoteId }),
  });

  const data = await response.json();
  const steps = data.userSteps || [];

  return steps
    .filter((s: any) => s.type === 'TRANSACTION')
    .map((s: any) => ({
      chainType: s.chainType,
      transaction: s.transaction,
    }));
}

/**
 * Executes an EVM→Starknet bridge using a Privy embedded wallet provider.
 * Signs and sends the LayerZero transaction via the EVM provider.
 */
export async function bridgeEVMToStarknet(
  quoteId: string,
  evmProvider: any,
  apiKey: string,
): Promise<BridgeTransferResult> {
  const steps = await buildEVMBridgeSteps(quoteId, apiKey);

  let lastTxHash = '';

  for (const step of steps) {
    if (step.chainType !== 'EVM') continue;

    const tx = step.transaction?.encoded || step.transaction;
    if (!tx) continue;

    // The Privy EVM provider implements EIP-1193
    // Send the transaction via the provider
    const txHash = await evmProvider.request({
      method: 'eth_sendTransaction',
      params: [{
        to: tx.to,
        data: tx.data,
        value: tx.value || '0x0',
        ...(tx.gasLimit ? { gas: tx.gasLimit } : {}),
      }],
    });

    lastTxHash = txHash;
    console.log(`[Bridge] EVM tx sent: ${txHash}`);
  }

  if (!lastTxHash) {
    throw new Error('No EVM transaction steps found in the quote');
  }

  return {
    quoteId,
    txHash: lastTxHash,
    status: 'pending',
    estimatedArrival: new Date(Date.now() + 5 * 60 * 1000),
  };
}

export function getLayerZeroScanLink(txHash: string): string {
  return `https://layerzeroscan.com/tx/${txHash}`;
}
