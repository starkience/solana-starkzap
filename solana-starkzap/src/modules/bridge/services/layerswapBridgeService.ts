/**
 * Layerswap Bridge Service — fast USDC transfer from Arbitrum to Starknet.
 *
 * Flow:
 *   1. POST /swaps — create a swap, get deposit address + actions
 *   2. Execute deposit_actions (ERC-20 approve + transfer via Privy provider)
 *   3. Poll GET /swaps/{id} until status = Completed
 *
 * Avg completion: ~24 seconds. Fee: ~$0.05
 *
 * Docs: https://docs.layerswap.io/integration/API
 */

const LS_API = 'https://api.layerswap.io/api/v2';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LayerswapQuote {
  receiveAmount: string;
  fee: string;
  avgCompletionTime: string;
  minAmount: number;
  maxAmount: number;
}

export interface LayerswapSwap {
  swapId: string;
  depositAddress: string;
  depositActions: DepositAction[];
  status: string;
  receiveAmount: string;
}

interface DepositAction {
  type: string;
  to_address: string;
  amount: number;
  token_contract: string;
  call_data: string;
  order: number;
}

export interface LayerswapResult {
  swapId: string;
  status: string;
  txHash?: string;
}

// ─── Quote ──────────────────────────────────────────────────────────────────

export async function getLayerswapQuote(
  amount: number,
): Promise<LayerswapQuote> {
  const params = new URLSearchParams({
    source_network: 'ARBITRUM_MAINNET',
    source_token: 'USDC',
    destination_network: 'STARKNET_MAINNET',
    destination_token: 'USDC',
    amount: amount.toString(),
  });

  const response = await fetch(`${LS_API}/quote?${params}`);
  const data = await response.json();

  if (data.error) {
    throw new Error(`Layerswap quote error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  const q = data.data?.quote;
  if (!q) throw new Error('No quote returned from Layerswap');

  return {
    receiveAmount: q.receive_amount?.toString() || amount.toString(),
    fee: q.total_fee?.toString() || '0',
    avgCompletionTime: q.avg_completion_time || '~30s',
    minAmount: q.min_receive_amount || 0,
    maxAmount: 10000,
  };
}

// ─── Create Swap ────────────────────────────────────────────────────────────

export async function createLayerswapSwap(
  amount: number,
  sourceAddress: string,
  destinationAddress: string,
  apiKey: string,
): Promise<LayerswapSwap> {
  console.log(`[Layerswap] Creating swap: ${amount} USDC Arbitrum → Starknet`);

  const response = await fetch(`${LS_API}/swaps`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-LS-APIKEY': apiKey,
    },
    body: JSON.stringify({
      source_network: 'ARBITRUM_MAINNET',
      source_token: 'USDC',
      destination_network: 'STARKNET_MAINNET',
      destination_token: 'USDC',
      destination_address: destinationAddress,
      source_address: sourceAddress,
      amount,
      use_deposit_address: false,
    }),
  });

  const data = await response.json();

  if (data.error) {
    console.error('[Layerswap] Create swap error:', JSON.stringify(data.error));
    throw new Error(`Layerswap error: ${data.error.message || data.error.code || JSON.stringify(data.error)}`);
  }

  const swap = data.data?.swap;
  const depositActions = data.data?.deposit_actions || [];

  if (!swap?.id) {
    throw new Error('Layerswap did not return a swap ID');
  }

  console.log(`[Layerswap] Swap created: ${swap.id}, actions: ${depositActions.length}`);

  return {
    swapId: swap.id,
    depositAddress: depositActions[0]?.to_address || swap.deposit_address || '',
    depositActions: depositActions.map((a: any) => ({
      type: a.type,
      to_address: a.to_address,
      amount: a.amount,
      token_contract: a.token_contract_address || a.token_contract || '',
      call_data: a.call_data || '',
      order: a.order || 0,
    })),
    status: swap.status,
    receiveAmount: swap.destination_amount?.toString() || '',
  };
}

// ─── Execute deposit actions ────────────────────────────────────────────────

/**
 * Executes the deposit actions returned by Layerswap.
 * Typically: (1) ERC-20 approve, (2) transfer to deposit address.
 */
export async function executeDepositActions(
  evmProvider: any,
  swap: LayerswapSwap,
  onStatus?: (msg: string) => void,
): Promise<string> {
  const actions = [...swap.depositActions].sort((a, b) => a.order - b.order);
  let lastTxHash = '';

  for (const action of actions) {
    console.log(`[Layerswap] Executing action: ${action.type} → ${action.to_address}`);

    if (action.call_data) {
      // Contract call (approve or custom)
      onStatus?.(`Executing ${action.type}...`);
      const txHash = await evmProvider.request({
        method: 'eth_sendTransaction',
        params: [{
          to: action.to_address,
          data: action.call_data,
          value: '0x0',
        }],
      });
      lastTxHash = txHash;
      console.log(`[Layerswap] Action tx: ${txHash}`);

      // Wait for confirmation
      await waitForReceipt(evmProvider, txHash);
    } else if (action.token_contract) {
      // ERC-20 transfer
      onStatus?.('Sending USDC to bridge...');
      const transferData = encodeERC20Transfer(action.to_address, action.amount);
      const txHash = await evmProvider.request({
        method: 'eth_sendTransaction',
        params: [{
          to: action.token_contract,
          data: transferData,
          value: '0x0',
        }],
      });
      lastTxHash = txHash;
      console.log(`[Layerswap] Transfer tx: ${txHash}`);
      await waitForReceipt(evmProvider, txHash);
    }
  }

  return lastTxHash;
}

// ─── Poll status ────────────────────────────────────────────────────────────

export async function pollSwapStatus(
  swapId: string,
  apiKey: string,
  maxWaitMs: number = 5 * 60 * 1000,
  pollIntervalMs: number = 5000,
  onStatus?: (msg: string) => void,
): Promise<LayerswapResult> {
  const deadline = Date.now() + maxWaitMs;
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt++;
    try {
      const response = await fetch(`${LS_API}/swaps/${swapId}`, {
        headers: { 'X-LS-APIKEY': apiKey },
      });
      const data = await response.json();
      const swap = data.data?.swap;

      if (!swap) {
        await sleep(pollIntervalMs);
        continue;
      }

      const status = swap.status;
      onStatus?.(`Bridge status: ${status} (attempt ${attempt})...`);
      console.log(`[Layerswap] Poll #${attempt}: status=${status}`);

      if (status === 'Completed') {
        return { swapId, status: 'completed', txHash: swap.destination_transaction?.hash };
      }
      if (status === 'Failed' || status === 'Expired') {
        throw new Error(`Bridge ${status.toLowerCase()}. Funds will be refunded.`);
      }
      if (status === 'Refunded') {
        throw new Error('Bridge refunded — funds returned to your Arbitrum wallet.');
      }
    } catch (err: any) {
      if (err.message.includes('Bridge')) throw err;
      console.warn('[Layerswap] Poll error:', err.message);
    }

    await sleep(pollIntervalMs);
  }

  throw new Error('Bridge timed out. Check History for status updates.');
}

// ─── Full flow ──────────────────────────────────────────────────────────────

/**
 * Full Layerswap bridge: Arbitrum USDC → Starknet USDC.
 * ~24 second average completion, ~$0.05 fee.
 */
export async function bridgeViaLayerswap(
  evmProvider: any,
  usdcAmount: string,
  sourceAddress: string,
  starknetAddress: string,
  apiKey: string,
  onStatus?: (msg: string) => void,
): Promise<{ txHash: string; swapId: string }> {
  const amount = parseFloat(usdcAmount);

  // Step 1: Create swap
  onStatus?.('Creating bridge...');
  const swap = await createLayerswapSwap(amount, sourceAddress, starknetAddress, apiKey);

  // Step 2: Execute deposit actions (approve + transfer)
  onStatus?.('Bridging USDC from Arbitrum...');
  const txHash = await executeDepositActions(evmProvider, swap, onStatus);

  // Step 3: Poll until completed
  onStatus?.('Waiting for bridge confirmation...');
  const result = await pollSwapStatus(swap.swapId, apiKey, 5 * 60 * 1000, 5000, onStatus);

  console.log(`[Layerswap] Bridge complete: ${result.txHash || txHash}`);
  return { txHash: result.txHash || txHash, swapId: swap.swapId };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** ERC-20 transfer(address,uint256) selector = 0xa9059cbb */
function encodeERC20Transfer(to: string, amount: number): string {
  const paddedTo = to.toLowerCase().replace('0x', '').padStart(64, '0');
  const baseUnits = BigInt(Math.round(amount * 1e6));
  const paddedAmount = baseUnits.toString(16).padStart(64, '0');
  return `0xa9059cbb${paddedTo}${paddedAmount}`;
}

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
  console.warn(`[Layerswap] Timed out waiting for receipt of ${txHash}`);
}
