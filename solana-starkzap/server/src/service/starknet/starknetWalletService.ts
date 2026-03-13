import { PrivyClient } from '@privy-io/node';

let privyClient: PrivyClient | null = null;

function getPrivyClient(): PrivyClient {
  if (!privyClient) {
    const appId = process.env.PRIVY_APP_ID || '';
    const appSecret = process.env.PRIVY_APP_SECRET || '';
    if (!appId || !appSecret) {
      throw new Error(
        'PRIVY_APP_ID and PRIVY_APP_SECRET must be set in environment variables',
      );
    }
    privyClient = new PrivyClient({
      appId,
      appSecret,
    });
  }
  return privyClient;
}

export interface StarknetWalletInfo {
  id: string;
  address: string;
  publicKey: string;
}

export async function createStarknetWallet(
  _userId?: string,
): Promise<StarknetWalletInfo> {
  const client = getPrivyClient();

  console.log('[StarknetWalletService] Creating Starknet wallet via Privy...');
  const wallet = await client.wallets().create({
    chain_type: 'starknet',
  });

  console.log('[StarknetWalletService] Wallet created:', {
    id: wallet.id,
    address: wallet.address,
    publicKey: wallet.public_key,
  });

  return {
    id: wallet.id,
    address: wallet.address,
    publicKey: wallet.public_key || '',
  };
}

export async function signWithStarknetWallet(
  walletId: string,
  hash: string,
): Promise<string> {
  const client = getPrivyClient();
  console.log('[StarknetWalletService] Signing hash for wallet:', walletId);
  const result = await client.wallets().rawSign(walletId, {
    params: { hash },
  });
  return result.signature;
}
