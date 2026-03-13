 # Solana StarkZap

Mobile app for Solana ↔ Starknet users, built on Expo + React Native. The app focuses on embedded wallets, swaps, and cross-chain staking flows (BTC, STRK), with a companion backend server for data and transaction helpers.

**Repo layout**
- App (Expo + React Native): `/Users/starkience/solana-starkzap/solana-starkzap`
- Server (Express + TypeScript): `/Users/starkience/solana-starkzap/solana-starkzap/server`

**Key features**
- Embedded wallet providers: Privy, Dynamic, Turnkey
- Solana swaps and launchpads: Jupiter, Pump, Raydium, Meteora
- Starknet flows: Starkzap staking, AVNU swaps, Vesu lending
- Cross-chain staking flows (Solana → Starknet)
- Portfolio, Earn, Trade, and social UI sections

**Tech stack**
- Expo, React Native, TypeScript
- Solana Web3.js
- Starknet + Starkzap
- Redux Toolkit + Redux Persist
- Express + PostgreSQL (server)

**Prerequisites**
- Node.js `>=18`
- `pnpm` (recommended)
- iOS: Xcode + CocoaPods
- Android: Android Studio + SDK

**Install**
```sh
pnpm install
```

**Run the app**
```sh
pnpm start
```

Standard dev mode with developer tools:
```sh
pnpm start --dev
```

**Run on device**
```sh
npx expo run:ios
npx expo run:android
```

**Scripts**
- `pnpm start` — start Expo
- `pnpm dev` — start Expo with dev tools
- `pnpm lint` — run ESLint
- `pnpm docs:generate` — generate typedoc
- `pnpm docs:convert` — convert docs to Mintlify
- `pnpm check-env` — validate env config

**Server**
```sh
cd /Users/starkience/solana-starkzap/solana-starkzap/server
pnpm install
pnpm dev
```

Server README: `/Users/starkience/solana-starkzap/solana-starkzap/server/README.md`

**Environment**
Create `.env` / `.env.local` values for API keys and provider configs. The app and server both read `SERVER_URL` and provider keys from `@env`.

**Project structure**
- `src/modules` — protocol integrations (pump-fun, raydium, meteora, starknet, swap, token-mill, etc.)
- `src/screens` — app screens (Earn, Portfolio, Trade, etc.)
- `src/core` — shared UI and dev tooling
- `src/shared` — navigation, state, utils

**Notes**
- Starknet wallet identity is derived server-side from the Solana address.
- Dev/standard modes toggle additional UI and diagnostics.
- pnpm or yarn or npm
- iOS: XCode and CocoaPods
- Android: Android Studio, Android SDK, and JDK
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- PostgreSQL database (for the server)

---

## 🚀 Quick Start

1. Clone the repository:

   ```sh
   git clone https://github.com/SendArcade/solana-app-kit.git
   cd solana-app-kit
   ```

2. Install dependencies:

   ```sh
   pnpm install
   ```

3. Create a `.env.local` file with your environment variables (see Environment Variables section)

4. Run the app in development mode with dev tools enabled:

   ```sh
   # Run with development tools enabled
   pnpm dev

   # Or with the standard npm command
   npm run dev
   ```

5. Run on a specific platform:

   ```sh
   # For iOS
   npx expo run:ios

   # For Android
   npx expo run:android
   ```

To run in development mode with cache clearing:

```sh
pnpm start --dev --clear
```

### Development vs Standard Mode

Solana App Kit supports two running modes:

- **Standard Mode**: Default production-like experience
- **Development Mode**: Enhanced with developer tools, navigation helpers, and error handling

To run in development mode, use the `--dev` flag or the `dev` script:

```sh
# Using npm script
npm run dev

# Or with the start script flag
npm start --dev
```

---

## ⌨️ Hotkeys

When running the Expo development server:

| Key | Action                   |
| --- | ------------------------ |
| `i` | Open on iOS simulator    |
| `a` | Open on Android emulator |
| `r` | Reload the app           |
| `m` | Toggle the menu          |
| `d` | Open developer tools     |

---

## 🧪 Development Mode Guide

For details on running the app in development mode, including environment variable handling and troubleshooting, please refer to the [Development Mode Guide](docs/DEV_MODE.md).

---

## 🏁 Getting Started

This project consists of two main parts:

1. React Native mobile application (in the root directory)
2. Backend server (in the `server` directory)

### Mobile App Installation

1. Clone the repository:

   ```sh
   git clone https://github.com/SendArcade/solana-app-kit.git
   cd solana-app-kit
   ```

2. Install dependencies:

   ```sh
   pnpm install
   ```

3. Set up environment variables:
   Create a `.env.local` file in the root directory with the necessary variables as shown in the example below:

   ```
   # Blockchain
   CLUSTER=mainnet-beta

   # Authentication
   PRIVY_APP_ID=your_privy_app_id
   PRIVY_CLIENT_ID=your_privy_client_id
   DYNAMIC_ENVIRONMENT_ID=your_dynamic_env_id

   # Turnkey wallet
   TURNKEY_BASE_URL=https://api.turnkey.com
   TURNKEY_RP_ID=host.exp.exponent
   TURNKEY_RP_NAME=send-fi
   TURNKEY_ORGANIZATION_ID=your_turnkey_organization_id
   TURNKEY_API_PUBLIC_KEY=your_turnkey_public_key
   TURNKEY_API_PRIVATE_KEY=your_turnkey_private_key

   # APIs
   HELIUS_API_KEY=your_helius_api_key
   HELIUS_RPC_CLUSTER=mainnet
   HELIUS_STAKED_URL=your_helius_staked_url
   HELIUS_STAKED_API_KEY=your_helius_staked_api_key
   SERVER_URL=your_server_url
   TENSOR_API_KEY=your_tensor_api_key
   COINGECKO_API_KEY=your_coingecko_api_key
   BIRDEYE_API_KEY=your_birdeye_api_key
   COIN_MARKE_CAPAPI_KEY=your_coinmarketcap_api_key
   OPENAI_API_KEY=your_openai_api_key
   COMMISSION_WALLET=your_commission_wallet_address
   ```

### Server Installation

1. Navigate to the server directory:

   ```sh
   cd server
   ```

2. Install server dependencies:

   ```sh
   pnpm install
   ```

3. Set up server environment variables:

   ```sh
   cp .env.example .env
   ```

   Required server environment variables:

   ```
   WALLET_PRIVATE_KEY=your_wallet_private_key
   RPC_URL=your_helius_rpc_url
   TOKEN_MILL_PROGRAMID=your_token_mill_program_id
   TOKEN_MILL_CONFIG_PDA=your_token_mill_config_pda
   SWAP_AUTHORITY_KEY=your_swap_authority_key
   COMMISSION_WALLET=your_commission_wallet_address

   # Pinata for IPFS
   PINATA_JWT=your_pinata_jwt
   PINATA_GATEWAY=your_pinata_gateway
   PINATA_SECRET=your_pinata_secret
   PINATA_API_KEY=your_pinata_api_key

   # Database and Storage
   DATABASE_URL=your_postgresql_url
   GCS_BUCKET_NAME=your_gcs_bucket_name
   SERVICE_ACCOUNT_EMAIL=your_service_account_email

   # Turnkey
   TURNKEY_API_URL=https://api.turnkey.com
   TURNKEY_ORGANIZATION_ID=your_turnkey_organization_id
   TURNKEY_API_PUBLIC_KEY=your_turnkey_api_public_key
   TURNKEY_API_PRIVATE_KEY=your_turnkey_api_private_key

   # Supabase
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Start the development server:
   ```sh
   pnpm dev
   # or
   yarn dev
   ```

For more details about the server, see the [Server README](server/README.md).

### Environment Variables for EAS Builds

The project is configured to use the `.env.local` file for both local development and EAS builds. When building with EAS, the environment file is automatically loaded:

```sh
# Example for a development build on Android
npx eas build --profile development --platform android
```

The configuration in `eas.json` specifies the `.env.local` file for each build profile. The babel configuration dynamically loads this file during the build process.

### Running the Mobile App

#### Standard vs Development Mode

The app can run in two modes:

1. **Standard Mode** (Default):

   - Regular production-like environment
   - Missing environment variables will show warnings but limit functionality

2. **Development Mode**:
   - Enhanced developer tools and diagnostics
   - Visual indicator showing "DEV MODE" at the bottom of the screen
   - Access to developer drawer with navigation shortcuts and environment variable status
   - Ability to bypass authentication for testing
   - Missing environment variables are clearly displayed with options to fix

#### Starting the App

To start the app:

```sh
# Standard mode
pnpm start
# or
npm start

# Development mode
pnpm dev
# or
npm run dev
# or
pnpm start --dev
```

#### Missing Environment Variables

If you're missing environment variables:

- In standard mode: A warning banner will appear on the login screen alerting you
- In dev mode: A detailed drawer will show all missing variables, and you can bypass authentication

To enable dev mode from standard mode when env vars are missing:

1. A warning will appear with an "Enable Dev Mode" button
2. After enabling, restart the app
3. You'll see a green "DEV MODE" indicator at the bottom of the screen
4. Tap it to access developer tools

#### iOS

For iOS, you need to install CocoaPods dependencies first:

```sh
# Install Ruby bundler (first time only)
bundle install

# Install CocoaPods dependencies
bundle exec pod install
```

Then run the app:

```sh
pnpm ios
# or
yarn ios
# or
npm run ios
```

#### Android

```sh
pnpm android
# or
yarn android
# or
npm run android
```

##### Android SDK Setup

If you encounter Android SDK location errors, you need to set up your Android environment variables. Add the following to your shell configuration file (`.zshrc`, `.bashrc`, or `.bash_profile`):

```sh
# Android SDK setup (macOS)
export ANDROID_HOME=~/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

For temporary setup in your current terminal session:

```sh
export ANDROID_HOME=~/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

**Note:** Make sure you have Android Studio installed and the Android SDK is located at `~/Library/Android/sdk` (macOS) or adjust the path accordingly for your system.

---

## 📂 Project Structure

```
solana-app-kit/
├── src/                # Mobile app source code
│   ├── assets/         # Images, icons, and other static assets
│   │   ├── images/     # Image assets for the app
│   │   ├── svgs/       # SVG graphic files
│   │   ├── colors.ts   # Color definitions
│   │   └── typography.ts # Typography definitions
│   ├── core/           # Core application components
│   │   ├── chat/       # Chat functionality components
│   │   ├── dev-mode/   # Development mode utilities
│   │   ├── profile/    # User profile related components
│   │   ├── shared-ui/  # Common UI components
│   │   └── thread/     # Thread-related components
│   ├── modules/        # Feature modules (core functionality)
│   │   ├── data-module/ # Data management module
│   │   ├── meteora/    # Meteora integration
│   │   ├── moonpay/    # Moonpay integration
│   │   ├── nft/        # NFT display and management
│   │   ├── pump-fun/   # Pump.fun integration
│   │   ├── raydium/    # Raydium integration
│   │   ├── solana-agent-kit/ # Solana agent kit integration
│   │   ├── swap/       # Swap functionality
│   │   ├── token-mill/ # Token creation and management
│   │   └── wallet-providers/ # Wallet connection adapters
│   ├── screens/        # App screens and UI flows
│   │   ├── common/     # Common screen components
│   │   ├── sample-ui/  # Sample UI screens
│   │   └── index.ts    # Screen exports
│   ├── server/         # Server-related functionality
│   │   └── meteora/    # Meteora server integration
│   └── shared/         # Shared utilities and components
│       ├── config/     # Configuration files
│       ├── context/    # React context providers
│       ├── hooks/      # Custom React hooks
│       ├── mocks/      # Mock data for testing
│       ├── navigation/ # Navigation configuration
│       ├── services/   # API integrations and business logic
│       ├── state/      # Redux store and slices
│       │   ├── auth/   # Authentication state management
│       │   ├── chat/   # Chat state management
│       │   ├── notification/ # Notification state management
│       │   ├── profile/ # Profile state management
│       │   ├── thread/ # Thread state management
│       │   ├── transaction/ # Transaction state management
│       │   ├── users/  # User state management
│       │   └── store.ts # Redux store configuration
│       ├── types/      # TypeScript type definitions
│       └── utils/      # Utility functions and helpers
│           └── common/ # Common utility functions
├── server/             # Backend server code
│   ├── src/            # Server source code
│   │   ├── controllers/ # Controller functions
│   │   ├── db/         # Database configuration
│   │   ├── routes/     # API endpoints
│   │   ├── service/    # Service implementations
│   │   ├── types/      # TypeScript types
│   │   └── utils/      # Utility functions
│   ├── .env.example    # Example environment variables
│   └── README.md       # Server documentation
├── App.tsx             # Main application component
├── index.js            # Entry point
├── app.config.js       # Expo configuration
├── app.json            # App configuration
├── babel.config.js     # Babel configuration
├── metro.config.js     # Metro bundler configuration
├── tsconfig.json       # TypeScript configuration
├── docs/               # Documentation files
├── CONTRIBUTING.md     # Contribution guidelines
├── LICENSE             # License information
└── package.json        # Dependencies and scripts
```

---

## 🧩 Modules

The Solana App Kit provides several modular features that can be used independently:

| Module                  | Capabilities                                                                                                                                                                                                                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🔐 **embedded-wallet-providers** | • Multiple wallet connection methods (Privy, Dynamic, Mobile Wallet Adapter)<br>• Standardized wallet interface<br>• Transaction handling across providers<br>• Support for embedded wallets, social login, and external wallets                                                 |
| 📊 **data-module**      | • Fetching on-chain data with optimized RPC calls<br>• Token balance tracking<br>• Transaction history display<br>• Real-time data synchronization                                                                                                                               |
| 🖼️ **nft**              | • NFT display, management, and trading<br>• Collection viewing with floor prices<br>• Compressed NFT support<br>• Integration with threads and posts                                                                                                                             |
| 💱 **swap**             | • Token swapping using multiple DEX SDKs<br>• Liquidity pool creation with custom token pairs<br>• Liquidity management (add and remove liquidity)<br>• Pool creation with custom parameters<br>• Real-time quotes and price impact estimates<br>• Transaction status monitoring |
| 🚀 **pump-fun**         | • Integration with the Pump.fun ecosystem<br>• Meme token creation and management<br>• Community engagement tools                                                                                                                                                                |
| 💹 **raydium**          | • Raydium DEX integration<br>• Token launching and trading<br>• Pool creation and management                                                                                                                                                                                     |
| 🌊 **meteora**          | • Meteora protocol integration<br>• Token launching capabilities<br>• Pool and liquidity management                                                                                                                                                                              |
| 💸 **moonpay**          | • Fiat on-ramp integration<br>• Buy crypto with credit cards and Apple Pay<br>• Seamless payment flow                                                                                                                                                                            |
| 🏦 **mercuryo**         | • Fiat gateway integration *(work in progress)*<br>• On-ramp functionality<br>• Multiple payment methods support<br>• Real-time exchange rates                                                                                                                      |
| 🤖 **solana-agent-kit** | • AI agent integration for Solana interactions<br>• Automated workflows and actions<br>• Enhanced user assistance                                                                                                                                                                |
| 🪙 **token-mill**       | • Token creation with configurable parameters<br>• Bonding curve configuration for token pricing<br>• Token swapping (buy/sell) functionality<br>• Staking tokens for rewards<br>• Creating and releasing vesting plans                                                          |

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

For detailed guidelines on how to contribute to this project, see our [Contributing Guide](CONTRIBUTING.md).

---

## 👥 Contributors

<div align="center">
  <a href="https://github.com/SendArcade/solana-app-kit/graphs/contributors">
    <img src="https://contrib.rocks/image?repo=SendArcade/solana-app-kit" alt="Contributors" />
  </a>
</div>

---

## 🔒 Security

This toolkit handles transaction generation, signing and sending, using provided wallets. Always ensure you're using it in a secure environment and never share your private keys.

---

## ❓ Troubleshooting

Common issues and their solutions:

| Issue                        | Solution                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| **Expo build errors**        | Clear your cache with `expo start --clear`                                                  |
| **Wallet connection issues** | Ensure you're using the correct provider and have properly configured environment variables |
| **iOS simulator issues**     | Try resetting the simulator or running `pod install` in the iOS directory                   |

---

## 🌐 Community

Join our community to get help, share your projects, and contribute:

[![telegram_badge]][telegram_link]

[telegram_badge]: https://img.shields.io/badge/telegram-❤️-252850?style=plastic&logo=telegram
[telegram_link]: https://t.me/solanaappkit

[![X (formerly Twitter) Follow](https://img.shields.io/twitter/follow/solanaappkit)](https://x.com/solanaappkit)

---

## 📄 License

This project is licensed under the Apache-2.0 License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

Built with ❤️ for the Solana ecosystem by SendAI and Send Arcade.

</div>
