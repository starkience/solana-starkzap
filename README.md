# Solana StarkZap

Solana StarkZap is a mobile app that connects **Solana** and **Starknet** into a single user experience. It’s built with Expo + React Native and focuses on embedded wallets, swaps, and cross‑chain staking flows (BTC, STRK), with a companion backend server for data and transaction helpers.

**What the app does**
- Lets users sign in with **Privy email**, then uses that identity to provision **two addresses**:
  - A **Solana** address for Solana‑native assets and transactions.
  - A **Starknet** address for Starknet staking, swaps, and lending.
- Bridges USDC from Solana → Starknet, swaps into target tokens, and stakes or lends on Starknet.
- Shows portfolio, Earn positions, and transaction history across chains.

**How it works (high‑level)**
1. User logs in with Privy.
2. App gets a Solana address from the embedded wallet.
3. App requests (or fetches) a Starknet wallet tied to the Solana address.
4. For Starknet actions, the app uses Starkzap to sign and submit transactions.
5. Earn flows can bridge USDC to Starknet, swap into STRK/WBTC/wstETH, and stake or lend.

**How we use Starkzap**
Starkzap is the core Starknet SDK in the app:
- Wallet connection and signing on Starknet.
- Pool discovery for **STRK** and **BTC** staking.
- Staking and unstaking transactions.
- Swap execution on Starknet via **AVNU** (using Starkzap’s swap provider).
- Token balance reads for STRK/WBTC/wstETH/sUSN.

**Starknet protocols used (via Starkzap)**
- **Starkzap**: wallet connection, pool discovery, staking actions.
- **AVNU**: Starknet swaps (USDC → STRK / WBTC / wstETH).
- **Vesu**: lending pools (USDC, wstETH, sUSN) in Earn.
- **CCTP**: USDC bridge flow from Solana → Starknet for staking/lending.

**Where the main things happen**
- App entry: `solana-starkzap/App.tsx`
- Navigation: `solana-starkzap/src/shared/navigation/RootNavigator.tsx`
- Earn flows (bridge, swap, stake, lend): `solana-starkzap/src/screens/Earn/EarnScreen.tsx`
- Starknet wallet + staking: `solana-starkzap/src/modules/starknet`
- Swap routing on Starknet (AVNU): `solana-starkzap/src/modules/starknet/services/avnuSwapService.ts`
- Bridge logic (CCTP): `solana-starkzap/src/modules/bridge`

**Project layout**
- App: `solana-starkzap/`
- Server: `solana-starkzap/server/`

**Start the app**
```sh
cd solana-starkzap
pnpm install
pnpm start
```

**Start the server**
```sh
cd solana-starkzap/server
pnpm install
pnpm dev
```

**Full docs**
- App README: `solana-starkzap/README.md`
- Server README: `solana-starkzap/server/README.md`
