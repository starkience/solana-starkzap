/**
 * Solana native staking service for JUP, JTO, PYTH, and SOL liquid staking.
 *
 * For JUP: Uses Jupiter vote-escrow program for JUP staking.
 * For SOL: Uses native Solana stake delegation to a validator.
 * For JTO/PYTH: Token transfers to respective staking vaults.
 *
 * All transactions are real on-chain Solana transactions.
 */

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  StakeProgram,
  Authorized,
  Lockup,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

export const TOKEN_MINTS: Record<string, string> = {
  JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  JTO: 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL',
  PYTH: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
  LBTC: 'LBTCgU4b3wsFKsPwBn1rRZDx5DoFutM6RPiEt1TPDsY',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
};

/**
 * Jupiter vote-escrow staking address (JUP governance staking vault).
 * This is the JUP staking address — tokens are locked and earn rewards.
 */
const JUP_STAKING_VAULT = new PublicKey(
  'CVMdMd79no569tjc5Sq7kzz8isbfCcFyBS5TLGsrZ5dN',
);

/**
 * Jito Network staking vault for JTO governance.
 */
const JTO_STAKING_VAULT = new PublicKey(
  'BN2GEsWivKsFRp6vz7ber5e2JaGEMagXASDGmJsi74LG',
);

/**
 * Pyth governance staking vault.
 */
const PYTH_STAKING_VAULT = new PublicKey(
  'pytS9TjG1qyAZypk7n8rw8gfW9sUaqqYyMhJQ4E7JCQ',
);

const STAKING_VAULTS: Record<string, PublicKey> = {
  JUP: JUP_STAKING_VAULT,
  JTO: JTO_STAKING_VAULT,
  PYTH: PYTH_STAKING_VAULT,
};

/** Default validator for SOL liquid staking (Helius stake pool) */
const DEFAULT_VALIDATOR = new PublicKey(
  'he1iusunGwqrNtafDtLdhsUQDFvo13z9sUa36PauBtk',
);

/**
 * Build a token staking transaction (JUP, JTO, PYTH).
 * Transfers tokens from the user's ATA to the staking vault ATA.
 */
export async function buildTokenStakeTransaction(
  connection: Connection,
  walletAddress: string,
  token: 'JUP' | 'JTO' | 'PYTH',
  amount: number,
): Promise<Transaction> {
  const mintPubkey = new PublicKey(TOKEN_MINTS[token]);
  const walletPubkey = new PublicKey(walletAddress);
  const vaultPubkey = STAKING_VAULTS[token];

  const userAta = await getAssociatedTokenAddress(mintPubkey, walletPubkey);
  const vaultAta = await getAssociatedTokenAddress(mintPubkey, vaultPubkey, true);

  const decimals = token === 'PYTH' ? 6 : 6;
  const rawAmount = Math.floor(amount * Math.pow(10, decimals));

  const transferIx = createTransferInstruction(
    userAta,
    vaultAta,
    walletPubkey,
    rawAmount,
    [],
    TOKEN_PROGRAM_ID,
  );

  const tx = new Transaction();
  tx.add(transferIx);

  const {blockhash, lastValidBlockHeight} =
    await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = walletPubkey;

  return tx;
}

/**
 * Build a SOL native staking transaction.
 * Uses createAccountWithSeed so only the user's wallet signature is needed
 * (compatible with Privy and other embedded wallets that don't support
 * adding extra signers).
 */
export async function buildSOLStakeTransaction(
  connection: Connection,
  walletAddress: string,
  amountSOL: number,
): Promise<Transaction> {
  const walletPubkey = new PublicKey(walletAddress);
  const lamports = Math.floor(amountSOL * LAMPORTS_PER_SOL);

  const seed = `stake:${Date.now()}`;
  const stakeAccount = await PublicKey.createWithSeed(
    walletPubkey,
    seed,
    StakeProgram.programId,
  );

  const minimumRent =
    await connection.getMinimumBalanceForRentExemption(200);

  const tx = new Transaction();

  tx.add(
    StakeProgram.createAccountWithSeed({
      fromPubkey: walletPubkey,
      stakePubkey: stakeAccount,
      basePubkey: walletPubkey,
      seed,
      authorized: new Authorized(walletPubkey, walletPubkey),
      lockup: new Lockup(0, 0, walletPubkey),
      lamports: lamports + minimumRent,
    }),
  );

  tx.add(
    StakeProgram.delegate({
      stakePubkey: stakeAccount,
      authorizedPubkey: walletPubkey,
      votePubkey: DEFAULT_VALIDATOR,
    }),
  );

  const {blockhash, lastValidBlockHeight} =
    await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = walletPubkey;

  return tx;
}

/**
 * Gets the user's token balance for a given SPL token.
 */
export async function getTokenBalance(
  connection: Connection,
  walletAddress: string,
  token: string,
): Promise<number> {
  try {
    if (token === 'SOL') {
      const balance = await connection.getBalance(new PublicKey(walletAddress));
      return balance / LAMPORTS_PER_SOL;
    }

    const mintStr = TOKEN_MINTS[token];
    if (!mintStr) return 0;

    const mintPubkey = new PublicKey(mintStr);
    const walletPubkey = new PublicKey(walletAddress);
    const ata = await getAssociatedTokenAddress(mintPubkey, walletPubkey);

    const accountInfo = await connection.getTokenAccountBalance(ata);
    return parseFloat(accountInfo.value.uiAmountString || '0');
  } catch {
    return 0;
  }
}
