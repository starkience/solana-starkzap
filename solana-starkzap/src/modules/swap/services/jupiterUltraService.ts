import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { JUPITER_API_KEY } from '@env';
import { TokenInfo } from '@/modules/data-module';
import { TransactionService } from '@/modules/wallet-providers/services/transaction/transactionService';

const JUPITER_API = 'https://api.jup.ag';

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (JUPITER_API_KEY) {
    headers['x-api-key'] = JUPITER_API_KEY;
  }
  return headers;
}

export interface JupiterQuoteResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
  contextSlot: number;
  timeTaken: number;
}

export interface JupiterSwapResponse {
  swapTransaction: string;
  lastValidBlockHeight: number;
  prioritizationFeeLamports: number;
  computeUnitLimit: number;
  prioritizationType: {
    computeBudget: {
      microLamports: number;
      estimatedMicroLamports: number;
    };
  };
  dynamicSlippageReport: {
    slippageBps: number;
    otherAmount: number;
    simulatedIncurredSlippageBps: number;
    amplificationRatio: string;
  } | null;
  simulationError: string | null;
}

export interface JupiterUltraOrderResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  transaction: string | null;
  requestId: string;
  swapType: string;
  [key: string]: any;
}

export interface JupiterUltraExecuteResponse {
  status: 'Success' | 'Failed';
  signature: string;
  error?: string;
}

export interface JupiterUltraBalancesResponse {
  balances: Array<{
    mint: string;
    amount: string;
    decimals: number;
    uiAmount: number;
  }>;
}

export interface JupiterUltraSwapResponse {
  success: boolean;
  signature?: string;
  error?: Error | string;
  inputAmount: number;
  outputAmount: number;
}

export interface SwapCallback {
  statusCallback?: (status: string) => void;
  isComponentMounted?: () => boolean;
}

export class JupiterUltraService {

  /**
   * Get a quote from Jupiter Swap API (works with Free tier key)
   */
  static async getQuote(
    inputMint: string,
    outputMint: string,
    amount: string | number,
    slippageBps: number = 50
  ): Promise<JupiterQuoteResponse> {
    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount: amount.toString(),
      slippageBps: slippageBps.toString(),
    });

    const url = `${JUPITER_API}/swap/v1/quote?${params.toString()}`;
    console.log('[JupiterService] Getting quote:', url);
    console.log('[JupiterService] API key present:', !!JUPITER_API_KEY);

    const response = await fetch(url, { headers: getHeaders() });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      console.error('[JupiterService] Quote error:', response.status, errorBody);
      throw new Error(`Jupiter quote failed (${response.status}): ${errorBody || response.statusText}`);
    }

    const data: JupiterQuoteResponse = await response.json();
    console.log('[JupiterService] Quote received:', data.inAmount, '->', data.outAmount);
    return data;
  }

  /**
   * Build a swap transaction from a quote (works with Free tier key)
   */
  static async buildSwapTransaction(
    quoteResponse: JupiterQuoteResponse,
    userPublicKey: string
  ): Promise<JupiterSwapResponse> {
    const url = `${JUPITER_API}/swap/v1/swap`;

    const response = await fetch(url, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        quoteResponse,
        userPublicKey,
        dynamicComputeUnitLimit: true,
        dynamicSlippage: true,
        prioritizationFeeLamports: 'auto',
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      console.error('[JupiterService] Swap build error:', response.status, errorBody);
      throw new Error(`Jupiter swap build failed (${response.status}): ${errorBody || response.statusText}`);
    }

    const data: JupiterSwapResponse = await response.json();

    if (data.simulationError) {
      throw new Error(`Swap simulation failed: ${data.simulationError}`);
    }

    console.log('[JupiterService] Swap transaction built, blockHeight:', data.lastValidBlockHeight);
    return data;
  }

  /**
   * Legacy getSwapOrder — now uses quote + swap build internally
   */
  static async getSwapOrder(
    inputMint: string,
    outputMint: string,
    amount: string | number,
    taker?: string
  ): Promise<JupiterUltraOrderResponse> {
    console.log('[JupiterService] Getting swap order');
    console.log(`[JupiterService] Input: ${inputMint} -> Output: ${outputMint}, Amount: ${amount}`);

    const quote = await JupiterUltraService.getQuote(inputMint, outputMint, amount);

    if (!taker) {
      throw new Error('Taker (wallet public key) is required to build the swap transaction');
    }

    const swapData = await JupiterUltraService.buildSwapTransaction(quote, taker);

    return {
      inputMint: quote.inputMint,
      outputMint: quote.outputMint,
      inAmount: quote.inAmount,
      outAmount: quote.outAmount,
      transaction: swapData.swapTransaction,
      requestId: `swap_${Date.now()}`,
      swapType: 'swap',
    };
  }

  static async executeSwapOrder(
    signedTransaction: string,
    requestId: string
  ): Promise<JupiterUltraExecuteResponse> {
    return {
      status: 'Success',
      signature: requestId,
    };
  }

  static async getBalances(walletAddress: string): Promise<JupiterUltraBalancesResponse> {
    try {
      const response = await fetch(`${JUPITER_API}/ultra/v1/balances?wallet=${walletAddress}`, {
        headers: getHeaders(),
      });

      if (!response.ok) {
        return { balances: [] };
      }

      return await response.json();
    } catch {
      return { balances: [] };
    }
  }

  /**
   * Complete swap flow:
   * 1. Get quote from Jupiter
   * 2. Build swap transaction
   * 3. Sign via wallet and send to RPC
   */
  static async executeUltraSwap(
    inputToken: TokenInfo,
    outputToken: TokenInfo,
    inputAmount: string,
    walletPublicKey: PublicKey,
    sendBase64Transaction: (base64Tx: string, connection: any, options?: any) => Promise<string>,
    connection: Connection,
    callbacks?: SwapCallback
  ): Promise<JupiterUltraSwapResponse> {
    const { statusCallback } = callbacks || {};

    const updateStatus = (status: string) => {
      console.log(`[JupiterService] Status: ${status}`);
      statusCallback?.(status);
    };

    try {
      updateStatus('Getting best price from Jupiter...');

      const inputLamports = JupiterUltraService.toBaseUnits(inputAmount, inputToken.decimals);

      const quote = await JupiterUltraService.getQuote(
        inputToken.address,
        outputToken.address,
        inputLamports.toString(),
      );

      updateStatus('Building swap transaction...');

      const swapData = await JupiterUltraService.buildSwapTransaction(
        quote,
        walletPublicKey.toString(),
      );

      if (!swapData.swapTransaction) {
        throw new Error('Jupiter did not return a transaction. The pair or amount may not be supported.');
      }

      updateStatus('Sending transaction to wallet for signing...');

      const signature = await sendBase64Transaction(
        swapData.swapTransaction,
        connection,
        { statusCallback: updateStatus }
      );

      if (!signature) {
        throw new Error('Transaction was not signed or failed to send.');
      }

      updateStatus('Swap successful!');

      TransactionService.showSuccess(signature, 'swap');

      return {
        success: true,
        signature,
        inputAmount: JupiterUltraService.fromBaseUnits(quote.inAmount, inputToken.decimals),
        outputAmount: JupiterUltraService.fromBaseUnits(quote.outAmount, outputToken.decimals),
      };
    } catch (error: any) {
      console.error('[JupiterService] Swap failed:', error);
      updateStatus('Swap failed.');
      return {
        success: false,
        error: error.message || 'An unknown error occurred during the swap.',
        inputAmount: parseFloat(inputAmount),
        outputAmount: 0,
      };
    }
  }

  static toBaseUnits(amount: string, decimals: number): number {
    return Math.round(parseFloat(amount) * Math.pow(10, decimals));
  }

  static fromBaseUnits(amount: string | number, decimals: number): number {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return num / Math.pow(10, decimals);
  }
}
