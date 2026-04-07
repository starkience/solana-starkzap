/**
 * EVM CCTP V2 Bridge Service — native USDC transfer from Arbitrum to Starknet
 * via Circle's Cross-Chain Transfer Protocol V2.
 *
 * Flow (Arbitrum → Starknet):
 *   1. approve USDC spending by TokenMessengerV2 on Arbitrum
 *   2. depositForBurn on TokenMessengerV2 (burns USDC, emits message)
 *   3. Poll Circle Iris API for attestation
 *   4. receive_message on Starknet MessageTransmitterV2 (mints USDC)
 *
 * References:
 *   - https://developers.circle.com/cctp/references/contract-addresses
 *   - Domain IDs: Arbitrum=3, Starknet=25
 */

// ─── Constants ──────────────────────────────────────────────────────────────

/** CCTP V2 contract addresses on Arbitrum */
const ARB_TOKEN_MESSENGER_V2 = '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d';

/** USDC on Arbitrum */
const ARB_USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';

/** CCTP domain IDs */
const ARBITRUM_DOMAIN = 3;
const STARKNET_DOMAIN = 25;

/** Starknet MessageTransmitterV2 (for receive_message) */
const STARKNET_MESSAGE_TRANSMITTER_V2 =
  '0x02EBB5777B6dD8B26ea11D68Fdf1D2c85cD2099335328Be845a28c77A8AEf183';

const IRIS_API = 'https://iris-api.circle.com';

// ─── ERC-20 approve ABI encoding ────────────────────────────────────────────

/** approve(address spender, uint256 amount) selector */
const APPROVE_SELECTOR = '0x095ea7b3';

function encodeApprove(spender: string, amount: bigint): string {
  const paddedSpender = spender.toLowerCase().replace('0x', '').padStart(64, '0');
  const paddedAmount = amount.toString(16).padStart(64, '0');
  return `${APPROVE_SELECTOR}${paddedSpender}${paddedAmount}`;
}

// ─── depositForBurn ABI encoding ────────────────────────────────────────────

/**
 * CCTP V2 depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient,
 *   address burnToken, bytes32 destinationCaller, uint256 maxFee, uint32 minFinalityThreshold)
 *
 * Selector: keccak256("depositForBurn(uint256,uint32,bytes32,address,bytes32,uint256,uint32)") = 0x8e0250ee
 */
const DEPOSIT_FOR_BURN_SELECTOR = '0x8e0250ee';

function starknetAddressToBytes32(starknetAddress: string): string {
  return starknetAddress.toLowerCase().replace('0x', '').padStart(64, '0');
}

function encodeDepositForBurn(
  amount: bigint,
  destinationDomain: number,
  mintRecipient: string,
  burnToken: string,
  maxFee: bigint = 0n,
  minFinalityThreshold: number = 2000,
): string {
  const parts = [
    amount.toString(16).padStart(64, '0'),
    destinationDomain.toString(16).padStart(64, '0'),
    starknetAddressToBytes32(mintRecipient),
    burnToken.toLowerCase().replace('0x', '').padStart(64, '0'),
    '0'.repeat(64), // destinationCaller = 0 (anyone can relay)
    maxFee.toString(16).padStart(64, '0'),
    minFinalityThreshold.toString(16).padStart(64, '0'),
  ];
  return `${DEPOSIT_FOR_BURN_SELECTOR}${parts.join('')}`;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EVMCCTPBurnResult {
  txHash: string;
  explorerUrl: string;
}

export interface CCTPAttestationResult {
  message: string;
  attestation: string;
  status: string;
}

export interface EVMCCTPTransferResult {
  burnTxHash: string;
  starknetTxHash: string;
  arbiscanUrl: string;
  voyagerUrl: string;
}

// ─── Step 1: Approve + depositForBurn on Arbitrum ───────────────────────────

/**
 * Burns USDC on Arbitrum via CCTP V2 depositForBurn.
 * First approves USDC spending, then calls depositForBurn.
 *
 * @param evmProvider  Privy EVM provider (already switched to Arbitrum chain 42161)
 * @param amount       USDC amount in base units (1 USDC = 1_000_000)
 * @param starknetRecipient  Starknet address to receive minted USDC
 */
export async function burnUSDCOnArbitrum(
  evmProvider: any,
  amount: bigint,
  starknetRecipient: string,
  onStatus?: (msg: string) => void,
): Promise<EVMCCTPBurnResult> {
  // Step 1a: Approve USDC spending (use large allowance to avoid re-approving)
  onStatus?.('Approving USDC...');
  const approveAmount = amount > 0n ? amount * 10n : 1000000000n; // 10x or 1000 USDC
  console.log(`[CCTP-EVM] Approving ${approveAmount} USDC for TokenMessengerV2`);

  const approveTxHash = await evmProvider.request({
    method: 'eth_sendTransaction',
    params: [{
      to: ARB_USDC,
      data: encodeApprove(ARB_TOKEN_MESSENGER_V2, approveAmount),
      value: '0x0',
    }],
  });
  console.log(`[CCTP-EVM] Approve tx: ${approveTxHash}`);

  // Wait for approve to be mined
  await waitForReceipt(evmProvider, approveTxHash);
  console.log(`[CCTP-EVM] Approve confirmed`);

  // Step 1b: depositForBurn
  onStatus?.('Burning USDC on Arbitrum...');
  console.log(`[CCTP-EVM] depositForBurn: ${amount} USDC → Starknet ${starknetRecipient}`);

  const depositData = encodeDepositForBurn(
    amount,
    STARKNET_DOMAIN,
    starknetRecipient,
    ARB_USDC,
    0n,    // maxFee: 0 for standard
    2000,  // minFinalityThreshold: 2000 = free, ~15 min
  );

  const txHash = await evmProvider.request({
    method: 'eth_sendTransaction',
    params: [{
      to: ARB_TOKEN_MESSENGER_V2,
      data: depositData,
      value: '0x0',
    }],
  });

  console.log(`[CCTP-EVM] Burn tx: ${txHash}`);

  return {
    txHash,
    explorerUrl: `https://arbiscan.io/tx/${txHash}`,
  };
}

// ─── Step 2: Poll Iris API for attestation ──────────────────────────────────

/**
 * Polls Circle's Iris API until attestation is available for the burn tx.
 */
export async function pollEVMAttestation(
  burnTxHash: string,
  maxWaitMs: number = 20 * 60 * 1000,
  pollIntervalMs: number = 10000,
  onStatus?: (msg: string) => void,
): Promise<CCTPAttestationResult> {
  const url = `${IRIS_API}/v2/messages/${ARBITRUM_DOMAIN}?transactionHash=${burnTxHash}`;
  const deadline = Date.now() + maxWaitMs;
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt++;
    try {
      onStatus?.(`Waiting for attestation (attempt ${attempt})...`);
      const response = await fetch(url, { method: 'GET' });

      if (!response.ok) {
        if (response.status !== 404) {
          console.warn(`[CCTP-EVM] Iris API ${response.status}`);
        }
        await sleep(pollIntervalMs);
        continue;
      }

      const data = await response.json();
      const msg = data?.messages?.[0];

      if (msg?.status === 'complete') {
        onStatus?.('Attestation received!');
        console.log('[CCTP-EVM] Attestation received');
        return {
          message: msg.message,
          attestation: msg.attestation,
          status: msg.status,
        };
      }

      console.log(`[CCTP-EVM] Attestation status: ${msg?.status || 'waiting'}...`);
    } catch (err) {
      console.warn('[CCTP-EVM] Iris API error:', err);
    }

    await sleep(pollIntervalMs);
  }

  throw new Error(`CCTP attestation not received within ${Math.round(maxWaitMs / 60000)} minutes`);
}

// ─── Step 3: receive_message on Starknet ────────────────────────────────────

/**
 * Calls receive_message on Starknet MessageTransmitterV2 to mint USDC.
 * Uses AVNU paymaster for gasless execution.
 */
export async function receiveOnStarknet(
  starknetWallet: any,
  attestation: CCTPAttestationResult,
  onStatus?: (msg: string) => void,
): Promise<{ txHash: string; explorerUrl: string }> {
  onStatus?.('Minting USDC on Starknet...');

  const messageBytes = hexToBytes(attestation.message);
  const attestationBytes = hexToBytes(attestation.attestation);

  const messageCalldata = encodeByteArrayForCalldata(messageBytes);
  const attestationCalldata = encodeByteArrayForCalldata(attestationBytes);

  console.log('[CCTP-EVM] Calling receive_message on Starknet');

  const call = {
    contractAddress: STARKNET_MESSAGE_TRANSMITTER_V2,
    entrypoint: 'receive_message',
    calldata: [
      ...messageCalldata,
      ...attestationCalldata,
    ],
  };

  const tx = await starknetWallet.execute([call]);
  await tx.wait();

  const txHash = tx.transaction_hash || tx.hash || '';
  console.log('[CCTP-EVM] Starknet receive_message confirmed:', txHash);

  return {
    txHash,
    explorerUrl: `https://voyager.online/tx/${txHash}`,
  };
}

// ─── Full flow ──────────────────────────────────────────────────────────────

/**
 * Full CCTP bridge: Arbitrum USDC → Starknet USDC.
 *
 * @param evmProvider       Privy EVM provider (switched to Arbitrum)
 * @param starknetWallet    Connected Starkzap wallet
 * @param usdcAmount        Human-readable amount (e.g. "5.00")
 * @param starknetRecipient Starknet address
 * @param onStatus          Progress callback
 */
export async function bridgeArbitrumToStarknet(
  evmProvider: any,
  starknetWallet: any,
  usdcAmount: string,
  starknetRecipient: string,
  onStatus?: (msg: string) => void,
): Promise<EVMCCTPTransferResult> {
  const amount = usdcToBaseUnits(usdcAmount);

  // Step 1: Burn on Arbitrum
  onStatus?.('Bridging USDC from Arbitrum...');
  const burn = await burnUSDCOnArbitrum(evmProvider, amount, starknetRecipient, onStatus);

  // Step 2: Wait for attestation
  onStatus?.('Waiting for bridge confirmation...');
  const attestation = await pollEVMAttestation(burn.txHash, 20 * 60 * 1000, 10000, onStatus);

  // Step 3: Mint on Starknet
  onStatus?.('Completing bridge on Starknet...');
  const mint = await receiveOnStarknet(starknetWallet, attestation, onStatus);

  return {
    burnTxHash: burn.txHash,
    starknetTxHash: mint.txHash,
    arbiscanUrl: burn.explorerUrl,
    voyagerUrl: mint.explorerUrl,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Polls eth_getTransactionReceipt until the tx is mined */
async function waitForReceipt(provider: any, txHash: string, timeoutMs = 60000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const receipt = await provider.request({
        method: 'eth_getTransactionReceipt',
        params: [txHash],
      });
      if (receipt && receipt.blockNumber) return;
    } catch {}
    await sleep(2000);
  }
  // Don't throw — proceed anyway, the tx may still be pending
  console.warn(`[CCTP-EVM] Timed out waiting for receipt of ${txHash}`);
}

function usdcToBaseUnits(amount: string): bigint {
  const parts = amount.split('.');
  const integer = parts[0] || '0';
  const fractional = (parts[1] || '').padEnd(6, '0').slice(0, 6);
  return BigInt(integer + fractional);
}

function hexToBytes(hex: string): number[] {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 2) {
    bytes.push(parseInt(clean.substring(i, i + 2), 16));
  }
  return bytes;
}

const BYTE_ARRAY_CHUNK_SIZE = 31;

function encodeByteArrayForCalldata(bytes: number[]): string[] {
  const numFullChunks = Math.floor(bytes.length / BYTE_ARRAY_CHUNK_SIZE);
  const remainingLen = bytes.length % BYTE_ARRAY_CHUNK_SIZE;
  const result: string[] = [];
  result.push(numFullChunks.toString());

  for (let i = 0; i < numFullChunks; i++) {
    const offset = i * BYTE_ARRAY_CHUNK_SIZE;
    let value = BigInt(0);
    for (let j = 0; j < BYTE_ARRAY_CHUNK_SIZE; j++) {
      value = (value << BigInt(8)) | BigInt(bytes[offset + j]);
    }
    result.push('0x' + value.toString(16));
  }

  if (remainingLen > 0) {
    const offset = numFullChunks * BYTE_ARRAY_CHUNK_SIZE;
    let value = BigInt(0);
    for (let j = 0; j < remainingLen; j++) {
      value = (value << BigInt(8)) | BigInt(bytes[offset + j]);
    }
    result.push('0x' + value.toString(16));
  } else {
    result.push('0x0');
  }

  result.push(remainingLen.toString());
  return result;
}
