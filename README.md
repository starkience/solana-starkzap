# Solana StarkZap

Solana StarkZap is a mobile app that onboards Solana users to Starknet in a single flow. It’s built with Expo + React Native and uses **Starkzap** to make Starknet transactions feel native inside a Solana‑first app.

This README is written for developers who want to understand **how Starkzap enables cross‑chain apps** and how to replicate this architecture.

**What the app does**
1. One email login via **Privy**.
2. The app provisions **two addresses**:
   - A **Solana** address for Solana‑native actions.
   - A **Starknet** address for staking, swaps, and lending.
3. The Earn flow bridges USDC from Solana, swaps on Starknet, and then stakes or lends.

**Why Starkzap**
Starkzap is the glue that makes Starknet feel like a first‑class target inside a Solana app:
- Wallet connection and signing on Starknet.
- Staking pool discovery (STRK and BTC).
- Swaps through **AVNU** with a unified API.
- Lending via **Vesu** through Starkzap’s lending client.

**Tech stack**
- Expo, React Native, TypeScript
- Solana Web3.js
- Starknet + Starkzap
- Redux Toolkit + Redux Persist
- Express + PostgreSQL (server)

**Main code paths**
- App entry: `solana-starkzap/App.tsx`
- Navigation: `solana-starkzap/src/shared/navigation/RootNavigator.tsx`
- Earn flows (bridge → swap → stake/lend): `solana-starkzap/src/screens/Earn/EarnScreen.tsx`
- Starknet wallet + staking: `solana-starkzap/src/modules/starknet`
- AVNU swaps: `solana-starkzap/src/modules/starknet/services/avnuSwapService.ts`
- CCTP bridge: `solana-starkzap/src/modules/bridge`
- Vesu lending: `solana-starkzap/src/modules/starknet/services/vesuService.ts`

---

# Step‑By‑Step: How It Works

**1) Privy login → Solana address**
1. User logs in with email via Privy.
2. Privy returns a **Solana embedded wallet**.
3. The Solana address is stored in app state.

Where to look:
- Auth logic: `solana-starkzap/src/modules/wallet-providers`
- Redux auth state: `solana-starkzap/src/shared/state/auth`

**2) Solana address → Starknet wallet**
1. The app calls `POST /api/starknet/wallet` with the Solana address.
2. The backend creates (or returns) a Starknet wallet **via Privy’s server SDK**.
3. The app uses **Starkzap** to connect that wallet and derive the Starknet address.

Where to look:
- Client hook: `solana-starkzap/src/modules/starknet/hooks/useStarknetWallet.ts`
- Server route: `solana-starkzap/server/src/routes/starknet/starknetWalletRoutes.ts`
- Server wallet creation: `solana-starkzap/server/src/service/starknet/starknetWalletService.ts`

**3) CCTP bridge (Solana → Starknet)**
1. USDC is burned on Solana using CCTP.
2. Attestation is polled.
3. USDC is minted on Starknet.

Where to look:
- CCTP flow: `solana-starkzap/src/modules/bridge/services/cctpBridgeService.ts`
- Earn orchestration: `solana-starkzap/src/screens/Earn/EarnScreen.tsx`

**4) Swap on Starknet (AVNU)**
1. After USDC arrives, the app swaps into STRK / WBTC / wstETH.
2. Swaps are executed through Starkzap’s `wallet.swap()` with provider = `avnu`.

Where to look:
- AVNU swap service: `solana-starkzap/src/modules/starknet/services/avnuSwapService.ts`

**5) Stake or lend**
- **Staking (STRK / BTC)** uses Starkzap staking pools.
- **Lending (USDC / wstETH / sUSN)** uses Starkzap’s lending client routed to Vesu.

Where to look:
- Staking actions: `solana-starkzap/src/modules/starknet/services/starknetService.ts`
- Vesu lending: `solana-starkzap/src/modules/starknet/services/vesuService.ts`
- Earn flows: `solana-starkzap/src/screens/Earn/EarnScreen.tsx`

---

# Starknet Protocols Used (via Starkzap)

- **Starkzap**: wallet connection, pool discovery, staking actions.
- **AVNU**: Starknet swaps (USDC → STRK / WBTC / wstETH).
- **Vesu**: lending pools (USDC, wstETH, sUSN).
- **CCTP**: USDC bridge from Solana → Starknet.

---

# Run It Locally

**App**
```sh
cd solana-starkzap
pnpm install
pnpm start
```

**Server**
```sh
cd solana-starkzap/server
pnpm install
pnpm dev
```

Full docs:
- App README: `solana-starkzap/README.md`
- Server README: `solana-starkzap/server/README.md`
