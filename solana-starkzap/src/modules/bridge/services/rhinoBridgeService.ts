/**
 * Rhino.fi Bridge Service — fast USDC transfer from Arbitrum to Starknet.
 *
 * Flow:
 *   1. Authenticate with API key → get JWT
 *   2. Get user quote (amount, fees, quoteId)
 *   3. Commit quote
 *   4. Approve USDC + call depositWithId on bridge contract
 *   5. Poll bridge status until EXECUTED
 *
 * ~30 second avg completion, ~$0.01 fee.
 *
 * Docs: https://docs.rhino.fi/api-integration/bridge
 */

const RHINO_API = 'https://api.rhino.fi';

/** Rhino.fi bridge contract on Arbitrum */
const ARB_BRIDGE_CONTRACT = '0x10417734001162Ea139e8b044DFe28DbB8B28ad0';

/** USDC on Arbitrum */
const ARB_USDC = '0xaf88d065e77c8cc2239327c5edb3a432268e5831';
const USDC_DECIMALS = 6;

// ─── ABI encoding helpers ───────────────────────────────────────────────────

/** approve(address,uint256) = 0x095ea7b3 */
function encodeApprove(spender: string, amount: bigint): string {
  const s = spender.toLowerCase().replace('0x', '').padStart(64, '0');
  const a = amount.toString(16).padStart(64, '0');
  return `0x095ea7b3${s}${a}`;
}

/** depositWithId(address token, uint256 amount, uint256 commitmentId) */
function encodeDepositWithId(token: string, amount: bigint, commitmentId: string): string {
  // keccak256("depositWithId(address,uint256,uint256)") = 0x2700bbaf
  const t = token.toLowerCase().replace('0x', '').padStart(64, '0');
  const a = amount.toString(16).padStart(64, '0');
  // commitmentId is a hex string — convert to uint256
  const c = commitmentId.replace('0x', '').padStart(64, '0');
  return `0x2700bbaf${t}${a}${c}`;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RhinoQuote {
  quoteId: string;
  payAmount: string;
  receiveAmount: string;
  fee: string;
  estimatedDuration: number;
}

export interface RhinoBridgeResult {
  quoteId: string;
  depositTxHash: string;
  status: string;
  withdrawTxHash?: string;
}

// ─── Step 1: Authenticate ───────────────────────────────────────────────────

async function getJWT(apiKey: string): Promise<string> {
  const res = await fetch(`${RHINO_API}/authentication/auth/apiKey`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey }),
  });
  const data = await res.json();
  if (!data.jwt) throw new Error(`Rhino auth failed: ${JSON.stringify(data)}`);
  return data.jwt;
}

// ─── Step 2: Get quote ──────────────────────────────────────────────────────

async function getUserQuote(
  jwt: string,
  amount: string,
  depositor: string,
  recipient: string,
): Promise<RhinoQuote> {
  const res = await fetch(`${RHINO_API}/bridge/quote/user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': jwt,
    },
    body: JSON.stringify({
      amount,
      chainIn: 'ARBITRUM',
      chainOut: 'STARKNET',
      token: 'USDC',
      mode: 'pay',
      depositor,
      recipient,
      amountNative: '0',
    }),
  });

  const data = await res.json();
  if (data._tag === 'Unauthorized' || data.error) {
    throw new Error(`Rhino quote failed: ${data.message || JSON.stringify(data)}`);
  }
  if (!data.quoteId) {
    throw new Error(`No quoteId in response: ${JSON.stringify(data).slice(0, 200)}`);
  }

  console.log(`[Rhino] Quote: pay=${data.payAmount}, receive=${data.receiveAmount}, fee=${data.fees?.fee}, est=${data.estimatedDuration}ms`);

  return {
    quoteId: data.quoteId,
    payAmount: data.payAmount,
    receiveAmount: data.receiveAmount,
    fee: data.fees?.fee || '0',
    estimatedDuration: data.estimatedDuration || 30000,
  };
}

// ─── Step 3: Commit quote ───────────────────────────────────────────────────

async function commitQuote(jwt: string, quoteId: string): Promise<void> {
  const res = await fetch(`${RHINO_API}/bridge/quote/commit/${quoteId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': jwt,
    },
  });

  const data = await res.json();
  if (res.status >= 400) {
    throw new Error(`Rhino commit failed: ${JSON.stringify(data).slice(0, 200)}`);
  }
  console.log(`[Rhino] Quote committed: ${quoteId}`);
}

// ─── Step 4: Smart contract deposit ─────────────────────────────────────────

async function executeDeposit(
  evmProvider: any,
  payAmount: string,
  quoteId: string,
  onStatus?: (msg: string) => void,
): Promise<string> {
  const amountBaseUnits = BigInt(Math.round(parseFloat(payAmount) * 10 ** USDC_DECIMALS));

  // 4a: Approve USDC spending
  onStatus?.('Approving USDC...');
  console.log(`[Rhino] Approving ${amountBaseUnits} USDC for bridge contract`);

  const approveTx = await evmProvider.request({
    method: 'eth_sendTransaction',
    params: [{
      to: ARB_USDC,
      data: encodeApprove(ARB_BRIDGE_CONTRACT, amountBaseUnits),
      value: '0x0',
    }],
  });
  console.log(`[Rhino] Approve tx: ${approveTx}`);
  await waitForReceipt(evmProvider, approveTx);

  // 4b: depositWithId
  onStatus?.('Depositing to bridge...');
  console.log(`[Rhino] depositWithId: ${amountBaseUnits} USDC, commitmentId=${quoteId}`);

  const depositTx = await evmProvider.request({
    method: 'eth_sendTransaction',
    params: [{
      to: ARB_BRIDGE_CONTRACT,
      data: encodeDepositWithId(ARB_USDC, amountBaseUnits, quoteId),
      value: '0x0',
    }],
  });
  console.log(`[Rhino] Deposit tx: ${depositTx}`);
  await waitForReceipt(evmProvider, depositTx);

  return depositTx;
}

// ─── Step 5: Poll status ────────────────────────────────────────────────────

async function pollBridgeStatus(
  jwt: string,
  quoteId: string,
  maxWaitMs: number = 5 * 60 * 1000,
  onStatus?: (msg: string) => void,
): Promise<RhinoBridgeResult> {
  const deadline = Date.now() + maxWaitMs;
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt++;
    try {
      const res = await fetch(`${RHINO_API}/bridge/history/bridge/${quoteId}`, {
        headers: { 'Authorization': jwt },
      });

      if (res.ok) {
        const data = await res.json();
        const state = data.state || data.status;
        onStatus?.(`Bridge: ${state} (${attempt})...`);
        console.log(`[Rhino] Poll #${attempt}: state=${state}`);

        if (state === 'EXECUTED') {
          return {
            quoteId,
            depositTxHash: data.depositTxHash || '',
            status: 'completed',
            withdrawTxHash: data.withdrawTxHash,
          };
        }
        if (state === 'FAILED' || state === 'CANCELLED') {
          throw new Error(`Bridge ${state.toLowerCase()}`);
        }
      }
    } catch (err: any) {
      if (err.message.includes('Bridge')) throw err;
    }

    await sleep(5000);
  }

  throw new Error('Bridge timed out. Check History for updates.');
}

// ─── Full flow ──────────────────────────────────────────────────────────────

/**
 * Full rhino.fi bridge: Arbitrum USDC → Starknet USDC.
 * ~30s completion, ~$0.01 fee.
 */
export async function bridgeViaRhino(
  evmProvider: any,
  usdcAmount: string,
  sourceAddress: string,
  starknetAddress: string,
  apiKey: string,
  onStatus?: (msg: string) => void,
): Promise<{ txHash: string; quoteId: string }> {
  // 1. Auth
  onStatus?.('Connecting to bridge...');
  const jwt = await getJWT(apiKey);

  // 2. Quote
  onStatus?.('Getting bridge quote...');
  const quote = await getUserQuote(jwt, usdcAmount, sourceAddress, starknetAddress);

  // 3. Commit
  onStatus?.('Preparing bridge...');
  await commitQuote(jwt, quote.quoteId);

  // 4. Execute deposit on Arbitrum
  onStatus?.('Bridging USDC from Arbitrum...');
  const txHash = await executeDeposit(evmProvider, quote.payAmount, quote.quoteId, onStatus);

  // 5. Poll until complete
  onStatus?.('Waiting for bridge confirmation...');
  await pollBridgeStatus(jwt, quote.quoteId, 5 * 60 * 1000, onStatus);

  console.log(`[Rhino] Bridge complete!`);
  return { txHash, quoteId: quote.quoteId };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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
}
