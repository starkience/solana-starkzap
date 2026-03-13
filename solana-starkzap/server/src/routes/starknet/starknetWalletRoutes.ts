import { Router } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import {
  createStarknetWallet,
  signWithStarknetWallet,
} from '../../service/starknet/starknetWalletService';

const starknetRouter = Router();

// JSON file store — used when PostgreSQL is unavailable (local dev)
const WALLETS_FILE = path.join(__dirname, '..', '..', '..', '.starknet-wallets.json');

interface WalletRecord {
  user_id: string;
  privy_wallet_id: string;
  wallet_address: string;
  public_key: string;
}

function loadWallets(): WalletRecord[] {
  try {
    if (fs.existsSync(WALLETS_FILE)) {
      return JSON.parse(fs.readFileSync(WALLETS_FILE, 'utf-8'));
    }
  } catch { /* ignore */ }
  return [];
}

function saveWallets(wallets: WalletRecord[]) {
  fs.writeFileSync(WALLETS_FILE, JSON.stringify(wallets, null, 2));
}

let knexAvailable = false;
let knexInstance: any = null;

try {
  knexInstance = require('../../db/knex').default;
  // Quick probe — will be validated on first actual request
  knexAvailable = true;
} catch {
  console.warn('[Starknet Routes] knex not available, using JSON file store');
}

async function findWallet(userId: string): Promise<WalletRecord | undefined> {
  if (knexAvailable && knexInstance) {
    try {
      const row = await knexInstance('starknet_wallets').where({ user_id: userId }).first();
      if (row) {
        return {
          user_id: row.user_id,
          privy_wallet_id: row.privy_wallet_id,
          wallet_address: row.wallet_address,
          public_key: row.public_key,
        };
      }
      return undefined;
    } catch (err: any) {
      console.warn('[Starknet Routes] DB query failed, falling back to JSON:', err.message);
      knexAvailable = false;
    }
  }
  const wallets = loadWallets();
  return wallets.find(w => w.user_id === userId);
}

async function insertWallet(record: WalletRecord) {
  if (knexAvailable && knexInstance) {
    try {
      await knexInstance('starknet_wallets').insert({
        ...record,
        created_at: new Date(),
        updated_at: new Date(),
      });
      return;
    } catch (err: any) {
      console.warn('[Starknet Routes] DB insert failed, falling back to JSON:', err.message);
      knexAvailable = false;
    }
  }
  const wallets = loadWallets();
  wallets.push(record);
  saveWallets(wallets);
}

starknetRouter.post('/wallet', async (req: any, res: any) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'Missing userId' });
    }

    console.log('[Starknet Wallet] POST /wallet for userId:', userId);

    const existing = await findWallet(userId);
    if (existing) {
      console.log('[Starknet Wallet] Found existing wallet:', existing.wallet_address);
      return res.json({
        success: true,
        wallet: {
          id: existing.privy_wallet_id,
          address: existing.wallet_address,
          publicKey: existing.public_key,
        },
      });
    }

    console.log('[Starknet Wallet] Creating new wallet via Privy...');
    const wallet = await createStarknetWallet(userId);
    console.log('[Starknet Wallet] Created:', wallet.address);

    await insertWallet({
      user_id: userId,
      privy_wallet_id: wallet.id,
      wallet_address: wallet.address,
      public_key: wallet.publicKey,
    });

    return res.json({
      success: true,
      wallet: {
        id: wallet.id,
        address: wallet.address,
        publicKey: wallet.publicKey,
      },
    });
  } catch (error: any) {
    console.error('[Starknet Wallet Create] error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

starknetRouter.get('/wallet', async (req: any, res: any) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      return res
        .status(400)
        .json({ success: false, error: 'Missing userId query param' });
    }

    const existing = await findWallet(userId);
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, error: 'No Starknet wallet found for user' });
    }

    return res.json({
      success: true,
      wallet: {
        id: existing.privy_wallet_id,
        address: existing.wallet_address,
        publicKey: existing.public_key,
      },
    });
  } catch (error: any) {
    console.error('[Starknet Wallet Get] error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

starknetRouter.post('/sign', async (req: any, res: any) => {
  try {
    const { walletId, hash } = req.body;
    if (!walletId || !hash) {
      return res
        .status(400)
        .json({ success: false, error: 'walletId and hash are required' });
    }

    console.log('[Starknet Sign] Signing hash for wallet:', walletId);
    const signature = await signWithStarknetWallet(walletId, hash);

    return res.json({ success: true, signature });
  } catch (error: any) {
    console.error('[Starknet Sign] error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default starknetRouter;
