/**
 * CCTP V2 Bridge Service — native USDC transfer between Solana and Starknet
 * via Circle's Cross-Chain Transfer Protocol.
 *
 * Flow (Solana → Starknet):
 *   1. depositForBurn on Solana TokenMessengerMinterV2 (burns USDC, emits message)
 *   2. Poll Circle Iris API for attestation
 *   3. receive_message on Starknet MessageTransmitterV2 (mints USDC)
 *
 * References:
 *   - https://developers.circle.com/cctp/solana-programs
 *   - https://developers.circle.com/cctp/references/starknet-contracts
 */

import {
  PublicKey,
  TransactionInstruction,
  Keypair,
  SystemProgram,
  Connection,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from '@solana/spl-token';

// ─── Constants ───────────────────────────────────────────────────────────────

const TOKEN_MESSENGER_MINTER_PROGRAM = new PublicKey(
  'CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe',
);
const MESSAGE_TRANSMITTER_PROGRAM = new PublicKey(
  'CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC',
);
const SOLANA_USDC_MINT = new PublicKey(
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
);

const STARKNET_MESSAGE_TRANSMITTER_V2 =
  '0x02EBB5777B6dD8B26ea11D68Fdf1D2c85cD2099335328Be845a28c77A8AEf183';

const SOLANA_DOMAIN = 5;
const STARKNET_DOMAIN = 25;

const IRIS_API_MAINNET = 'https://iris-api.circle.com';
const IRIS_API_SANDBOX = 'https://iris-api-sandbox.circle.com';

// Anchor discriminator: sha256("global:deposit_for_burn")[0..8]
const DEPOSIT_FOR_BURN_DISCRIMINATOR = Buffer.from([
  0xd7, 0x3c, 0x3d, 0x2e, 0x72, 0x37, 0x80, 0xb0,
]);

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CCTPBurnResult {
  /** Solana tx signature */
  signature: string;
  /** Keypair used for the MessageSent event account (needed to reclaim rent later) */
  messageSentKeypair: Keypair;
}

export interface CCTPAttestationMessage {
  message: string;
  attestation: string;
  status: string;
  eventNonce?: string;
}

export interface CCTPTransferResult {
  solanaSignature: string;
  starknetTxHash: string;
  solscanUrl: string;
  voyagerUrl: string;
}

// ─── Step 1: Build depositForBurn instruction (Solana) ───────────────────────

/**
 * Converts a Starknet hex address (felt252) into a 32-byte Solana PublicKey
 * for use as the CCTP mintRecipient.
 */
function starknetAddressToMintRecipient(starknetAddress: string): PublicKey {
  const hex = starknetAddress.replace('0x', '').padStart(64, '0');
  const bytes = Buffer.from(hex, 'hex');
  return new PublicKey(bytes);
}

/**
 * Derives all PDAs required by the TokenMessengerMinterV2.depositForBurn instruction.
 */
function deriveCCTPPDAs(ownerPubkey: PublicKey, destinationDomain: number) {
  const [senderAuthorityPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('sender_authority')],
    TOKEN_MESSENGER_MINTER_PROGRAM,
  );

  const [denylistPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('denylist_account'), ownerPubkey.toBytes()],
    TOKEN_MESSENGER_MINTER_PROGRAM,
  );

  const [messageTransmitter] = PublicKey.findProgramAddressSync(
    [Buffer.from('message_transmitter')],
    MESSAGE_TRANSMITTER_PROGRAM,
  );

  const [tokenMessenger] = PublicKey.findProgramAddressSync(
    [Buffer.from('token_messenger')],
    TOKEN_MESSENGER_MINTER_PROGRAM,
  );

  // CCTP V2 uses the domain as a string for PDA derivation
  const [remoteTokenMessenger] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('remote_token_messenger'),
      Buffer.from(destinationDomain.toString()),
    ],
    TOKEN_MESSENGER_MINTER_PROGRAM,
  );

  const [tokenMinter] = PublicKey.findProgramAddressSync(
    [Buffer.from('token_minter')],
    TOKEN_MESSENGER_MINTER_PROGRAM,
  );

  const [localToken] = PublicKey.findProgramAddressSync(
    [Buffer.from('local_token'), SOLANA_USDC_MINT.toBytes()],
    TOKEN_MESSENGER_MINTER_PROGRAM,
  );

  const [eventAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from('__event_authority')],
    TOKEN_MESSENGER_MINTER_PROGRAM,
  );

  const [messageTransmitterEventAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from('__event_authority')],
    MESSAGE_TRANSMITTER_PROGRAM,
  );

  return {
    senderAuthorityPda,
    denylistPda,
    messageTransmitter,
    tokenMessenger,
    remoteTokenMessenger,
    tokenMinter,
    localToken,
    eventAuthority,
    messageTransmitterEventAuthority,
  };
}

/**
 * Encodes the depositForBurn instruction data.
 *
 * Layout (repr(C)):
 *   [8B discriminator][8B u64 amount][4B u32 dest_domain]
 *   [32B mintRecipient][32B destinationCaller]
 *   [8B u64 maxFee][4B u32 minFinalityThreshold]
 */
function encodeDepositForBurnData(
  amount: bigint,
  destinationDomain: number,
  mintRecipient: PublicKey,
  maxFee: bigint,
  minFinalityThreshold: number = 1000,
): Buffer {
  const amountBuf = Buffer.alloc(8);
  amountBuf.writeBigUInt64LE(amount);

  const domainBuf = Buffer.alloc(4);
  domainBuf.writeUInt32LE(destinationDomain);

  const maxFeeBuf = Buffer.alloc(8);
  maxFeeBuf.writeBigUInt64LE(maxFee);

  const finalityBuf = Buffer.alloc(4);
  finalityBuf.writeUInt32LE(minFinalityThreshold);

  return Buffer.concat([
    DEPOSIT_FOR_BURN_DISCRIMINATOR,
    amountBuf,
    domainBuf,
    mintRecipient.toBytes(),
    Buffer.alloc(32), // destinationCaller = zero → anyone can relay
    maxFeeBuf,
    finalityBuf,
  ]);
}

export interface DepositForBurnParams {
  /** User's Solana wallet public key */
  ownerPubkey: PublicKey;
  /** USDC amount in base units (1 USDC = 1_000_000) */
  amount: bigint;
  /** Starknet hex address that will receive the minted USDC */
  starknetRecipient: string;
  /** Max fee in USDC base units (default 0 for standard transfers) */
  maxFee?: bigint;
}

/**
 * Builds the depositForBurn TransactionInstruction and generates
 * the ephemeral Keypair for the MessageSent event account.
 *
 * Returns { instruction, messageSentKeypair } — the instruction should be
 * sent via TransactionService with messageSentKeypair as an additional signer.
 */
export async function buildDepositForBurnInstruction(
  params: DepositForBurnParams,
): Promise<{instruction: TransactionInstruction; messageSentKeypair: Keypair}> {
  const {
    ownerPubkey,
    amount,
    starknetRecipient,
    maxFee = 0n,
  } = params;

  const mintRecipient = starknetAddressToMintRecipient(starknetRecipient);

  const senderUsdcAccount = await getAssociatedTokenAddress(
    SOLANA_USDC_MINT,
    ownerPubkey,
  );

  const pdas = deriveCCTPPDAs(ownerPubkey, STARKNET_DOMAIN);
  const messageSentKeypair = Keypair.generate();

  const data = encodeDepositForBurnData(
    amount,
    STARKNET_DOMAIN,
    mintRecipient,
    maxFee,
  );

  const keys = [
    {pubkey: ownerPubkey, isSigner: true, isWritable: true},                   // owner
    {pubkey: ownerPubkey, isSigner: true, isWritable: true},                   // event_rent_payer
    {pubkey: pdas.senderAuthorityPda, isSigner: false, isWritable: false},     // sender_authority_pda
    {pubkey: senderUsdcAccount, isSigner: false, isWritable: true},            // burn_token_account
    {pubkey: pdas.denylistPda, isSigner: false, isWritable: false},            // denylist_account
    {pubkey: pdas.messageTransmitter, isSigner: false, isWritable: true},      // message_transmitter
    {pubkey: pdas.tokenMessenger, isSigner: false, isWritable: false},         // token_messenger
    {pubkey: pdas.remoteTokenMessenger, isSigner: false, isWritable: false},   // remote_token_messenger
    {pubkey: pdas.tokenMinter, isSigner: false, isWritable: false},            // token_minter
    {pubkey: pdas.localToken, isSigner: false, isWritable: true},              // local_token
    {pubkey: SOLANA_USDC_MINT, isSigner: false, isWritable: true},             // burn_token_mint
    {pubkey: messageSentKeypair.publicKey, isSigner: true, isWritable: true},  // message_sent_event_data
    {pubkey: MESSAGE_TRANSMITTER_PROGRAM, isSigner: false, isWritable: false}, // message_transmitter_program
    {pubkey: TOKEN_MESSENGER_MINTER_PROGRAM, isSigner: false, isWritable: false}, // token_messenger_minter_program
    {pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false},            // token_program
    {pubkey: SystemProgram.programId, isSigner: false, isWritable: false},     // system_program
    {pubkey: pdas.eventAuthority, isSigner: false, isWritable: false},         // event_authority (TMM)
    {pubkey: TOKEN_MESSENGER_MINTER_PROGRAM, isSigner: false, isWritable: false}, // program (TMM)
    {pubkey: pdas.messageTransmitterEventAuthority, isSigner: false, isWritable: false}, // event_authority (MT)
    {pubkey: MESSAGE_TRANSMITTER_PROGRAM, isSigner: false, isWritable: false}, // program (MT)
  ];

  const instruction = new TransactionInstruction({
    programId: TOKEN_MESSENGER_MINTER_PROGRAM,
    keys,
    data,
  });

  return {instruction, messageSentKeypair};
}

// ─── Step 2: Poll Iris attestation API ───────────────────────────────────────

/**
 * Polls Circle's Iris API until an attestation is available for the burn tx.
 *
 * @param solanaSignature  The Solana transaction signature from depositForBurn
 * @param useMainnet       Use mainnet Iris API (true) or sandbox (false)
 * @param maxWaitMs        Maximum wait time before giving up (default 10 min)
 * @param pollIntervalMs   Polling interval (default 5s)
 */
export async function pollAttestation(
  solanaSignature: string,
  useMainnet: boolean = true,
  maxWaitMs: number = 10 * 60 * 1000,
  pollIntervalMs: number = 5000,
  onStatus?: (status: string) => void,
): Promise<CCTPAttestationMessage> {
  const baseUrl = useMainnet ? IRIS_API_MAINNET : IRIS_API_SANDBOX;
  const url = `${baseUrl}/v2/messages/${SOLANA_DOMAIN}?transactionHash=${solanaSignature}`;

  const deadline = Date.now() + maxWaitMs;
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt++;
    try {
      onStatus?.(`Waiting for attestation (attempt ${attempt})...`);
      const response = await fetch(url, {method: 'GET'});

      if (!response.ok) {
        if (response.status !== 404) {
          const text = await response.text().catch(() => '');
          console.warn(`[CCTP] Iris API ${response.status}: ${text.slice(0, 200)}`);
        }
        await sleep(pollIntervalMs);
        continue;
      }

      const data = await response.json();
      const msg = data?.messages?.[0];

      if (msg?.status === 'complete') {
        onStatus?.('Attestation received!');
        console.log('[CCTP] Attestation received');
        return {
          message: msg.message,
          attestation: msg.attestation,
          status: msg.status,
          eventNonce: msg.eventNonce,
        };
      }

      console.log(`[CCTP] Attestation status: ${msg?.status || 'waiting'}...`);
    } catch (err) {
      console.warn('[CCTP] Iris API fetch error:', err);
    }

    await sleep(pollIntervalMs);
  }

  throw new Error(
    `CCTP attestation not received within ${Math.round(maxWaitMs / 60000)} minutes`,
  );
}

// ─── Step 3: receive_message on Starknet ─────────────────────────────────────

/**
 * Converts a hex string (with or without 0x prefix) to an array of byte values.
 */
function hexToBytes(hex: string): number[] {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 2) {
    bytes.push(parseInt(clean.substring(i, i + 2), 16));
  }
  return bytes;
}

const BYTE_ARRAY_CHUNK_SIZE = 31;

/**
 * Encodes a raw byte array as a Cairo `ByteArray` for Starknet calldata.
 *
 * Cairo ByteArray layout:
 *   [num_full_chunks, chunk_0, chunk_1, …, chunk_n, pending_word, pending_word_len]
 *
 * Each chunk packs up to 31 bytes into a single felt252 (big-endian).
 * Remaining bytes (< 31) go into pending_word.
 */
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

/**
 * Calls receive_message on Starknet's MessageTransmitterV2 contract
 * to mint USDC on the destination chain.
 *
 * Uses the Starkzap wallet (with AVNU paymaster for gasless execution).
 *
 * @param starknetWallet  The connected Starkzap WalletInterface
 * @param attestation     The attestation data from the Iris API
 */
export async function receiveMessageOnStarknet(
  starknetWallet: any,
  attestation: CCTPAttestationMessage,
): Promise<{txHash: string; explorerUrl: string}> {
  const messageBytes = hexToBytes(attestation.message);
  const attestationBytes = hexToBytes(attestation.attestation);

  const messageCalldata = encodeByteArrayForCalldata(messageBytes);
  const attestationCalldata = encodeByteArrayForCalldata(attestationBytes);

  console.log('[CCTP] Calling receive_message on Starknet:', {
    messageLength: messageBytes.length,
    attestationLength: attestationBytes.length,
    messageCalldataLen: messageCalldata.length,
    attestationCalldataLen: attestationCalldata.length,
  });

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
  console.log('[CCTP] Starknet receive_message confirmed:', txHash);

  return {
    txHash,
    explorerUrl: `https://voyager.online/tx/${txHash}`,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Converts a human-readable USDC amount (e.g. "10.5") to base units (bigint).
 * USDC has 6 decimals, so "10.5" → 10_500_000n.
 */
export function usdcToBaseUnits(amount: string): bigint {
  const parts = amount.split('.');
  const integer = parts[0] || '0';
  const fractional = (parts[1] || '').padEnd(6, '0').slice(0, 6);
  return BigInt(integer + fractional);
}

export function getSolscanLink(signature: string): string {
  return `https://solscan.io/tx/${signature}`;
}

export function getVoyagerLink(txHash: string): string {
  return `https://voyager.online/tx/${txHash}`;
}

/**
 * Retrieves CCTP fee information from the Iris API.
 */
export async function getCCTPFees(): Promise<{
  fee: string;
  feeUsd: string;
}> {
  try {
    const response = await fetch(
      `${IRIS_API_MAINNET}/v2/burn/USDC/fees/${SOLANA_DOMAIN}/${STARKNET_DOMAIN}`,
    );
    if (!response.ok) {
      return {fee: '0', feeUsd: '0'};
    }
    const data = await response.json();
    return {
      fee: data.fee || '0',
      feeUsd: data.feeUsd || '0',
    };
  } catch {
    return {fee: '0', feeUsd: '0'};
  }
}
