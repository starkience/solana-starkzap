# Solana StarkZap

**A Solana + Starknet mobile app powered by Starkzap.** One email login creates a Solana address and a Starknet address. USDC can move cross‑chain, swap on Starknet, and earn yield.

Solana StarkZap is built with Expo + React Native. Starkzap makes Starknet transactions feel native inside a Solana‑first app.

---

## From Solana to Starknet with the Starkzap SDK

This project is a step‑by‑step example of how to take a Solana app and add Starknet features using the [Starkzap SDK](https://github.com/keep-starknet-strange/starkzap).

**The starting point:** a Solana‑native wallet app with swaps and portfolio.

**The end result:** the same app, but with Starknet staking and lending flows, powered by Starkzap, AVNU, Vesu, and CCTP.

Install the SDK (already included in this repo):

```bash
pnpm add starkzap
```

---

## Step 1: Understand the Architecture

Starkzap handles Starknet wallet connection, smart‑account interactions, swap routing, and lending. A minimal backend holds secrets (Privy App Secret, AVNU API key) and exposes wallet + signing endpoints. CCTP is used to bridge USDC from Solana to Starknet.

```
┌─────────────────────────────────────────────────────────────────────┐
│                              USER (Mobile)                          │
│                                                                     │
│  1. Email login ─────────► Privy SDK ─────► Privy Cloud              │
│  2. Solana address ready   (embedded wallet)                         │
│  3. Fetch Starknet wallet ───────┐                                   │
│  4. Starkzap connect + execute ──┤                                   │
└──────────────┬───────────────────┘                                   │
               │                                                       │
               │  POST /api/starknet/wallet (create + fetch)           │
               │  POST /api/starknet/sign   (rawSign)                  │
               ▼                                                       │
┌─────────────────────────────────┐                                    │
│        MINIMAL EXPRESS BACKEND  │                                    │
│                                 │   ┌───────────────────────┐        │
│  1. Create wallet ──────────────┼──►│   Privy Wallet API     │        │
│  2. Sign hash ──────────────────┼──►│   (rawSign)            │        │
└─────────────────────────────────┘   └───────────────────────┘        │
                                                                      │
               CCTP bridge + Starkzap actions ────────────────────────┤
                                                 ▼                    │
                                    ┌───────────────────────┐         │
                                    │      STARKNET         │         │
                                    │                       │         │
                                    │  Vesu Lending         │         │
                                    │  Starkzap Staking     │         │
                                    │  AVNU Swaps           │         │
                                    └───────────────────────┘         │
```

**In short:** users never handle keys or Starknet wallets directly. Privy handles identity and Solana, Starkzap handles Starknet interactions, and the backend safely holds secrets.

```
solana-starkzap/
├── solana-starkzap/              # Expo + React Native app
│   └── src/
│       ├── screens/              # Earn, Portfolio, Trade flows
│       ├── modules/              # starknet, bridge, swap, etc.
│       └── shared/               # state, navigation, utils
└── solana-starkzap/server/        # Express backend (wallet + signing)
```

---

## Step 2: Add Social Login with Privy

[Privy](https://www.privy.io/) gives users email login without wallet extensions. In this app, that login produces a **Solana embedded wallet**.

Where to look:
- Auth logic: `solana-starkzap/src/modules/wallet-providers`
- Auth state: `solana-starkzap/src/shared/state/auth`

Setup: create a Privy app at [console.privy.io](https://console.privy.io) and set `PRIVY_APP_ID` + `PRIVY_APP_SECRET`.

---

## Step 3: Create a Starknet Wallet via Privy + Connect with Starkzap

The app calls the backend to create or fetch a Starknet wallet linked to the Solana address. The backend uses Privy’s server SDK to create the Starknet wallet, and the app uses Starkzap to connect and sign.

Short Starkzap usage (client connect):
```ts
// src/modules/starknet/hooks/useStarknetWallet.ts
const wallet = await connectStarknetWallet(walletId, publicKey);
```

Where to look:
- Client hook: `solana-starkzap/src/modules/starknet/hooks/useStarknetWallet.ts`
- Server route: `solana-starkzap/server/src/routes/starknet/starknetWalletRoutes.ts`
- Server wallet creation: `solana-starkzap/server/src/service/starknet/starknetWalletService.ts`

---

## Step 4: Bridge USDC with CCTP (Solana → Starknet)

Earn flows begin with a CCTP bridge:
1. Burn USDC on Solana.
2. Poll the attestation.
3. Mint USDC on Starknet.

Where to look:
- CCTP flow: `solana-starkzap/src/modules/bridge/services/cctpBridgeService.ts`
- Earn orchestration: `solana-starkzap/src/screens/Earn/EarnScreen.tsx`

---

## Step 5: Swap on Starknet via AVNU

After USDC arrives, the app swaps into the target asset using Starkzap’s swap provider with AVNU.

Short Starkzap usage (swap):
```ts
// src/modules/starknet/services/avnuSwapService.ts
const tx = await wallet.swap({ tokenIn, tokenOut, amountIn, provider: 'avnu' });
await tx.wait();
```

Where to look:
- AVNU swap service: `solana-starkzap/src/modules/starknet/services/avnuSwapService.ts`

---

## Step 6: Route into Vesu Lending Pools

Lending uses Starkzap’s lending client, routed to **Vesu** pools (USDC, wstETH, sUSN).

Short Starkzap usage (lend):
```ts
// src/modules/starknet/services/vesuService.ts
const lendingClient = wallet.lending();
const tx = await lendingClient.deposit({ token, amount, poolAddress, provider: 'vesu' });
```

Where to look:
- Vesu lending: `solana-starkzap/src/modules/starknet/services/vesuService.ts`
- Earn UI: `solana-starkzap/src/screens/Earn/EarnScreen.tsx`

---

## Step 7: Staking on Starknet via Starkzap

Staking flows use Starkzap staking pools for STRK and BTC.

Short Starkzap usage (stake):
```ts
// src/modules/starknet/services/starknetService.ts
const tx = await stakeInPool(wallet, poolAddress, amount, 'STRK');
```

Where to look:
- Staking actions: `solana-starkzap/src/modules/starknet/services/starknetService.ts`
- Earn flow wiring: `solana-starkzap/src/screens/Earn/EarnScreen.tsx`

---

## Summary: What Starkzap Enables

Starkzap enables a Solana‑first app to:
- Connect Starknet wallets without exposing keys.
- Swap on Starknet via AVNU.
- Lend on Vesu.
- Stake STRK and BTC.
- Orchestrate everything inside a single mobile UX.

---

## Quick Start

### Prerequisites
- Node.js 18+
- Privy app (App ID + Secret)
- AVNU API key
- Starknet RPC URL
- CCTP configuration (Solana + Starknet)

### Run Locally

```bash
# App
cd solana-starkzap
pnpm install
pnpm start

# Server (separate terminal)
cd solana-starkzap/server
pnpm install
pnpm dev
```

---

## Learn More

- [Starkzap SDK](https://github.com/keep-starknet-strange/starkzap)
- [Privy Docs](https://docs.privy.io/)
- [AVNU](https://docs.avnu.fi/)
- [Vesu](https://vesu.xyz/)
