# OneBalance + Privy Demo

A Next.js application showcasing integration between [OneBalance](https://onebalance.io) and [Privy](https://privy.io) for seamless chain-abstracted transactions and user authentication.

## Overview

This demo demonstrates:
- User authentication via Privy (email, social, or wallet)
- Smart account prediction and creation with OneBalance
- Cross-chain asset transfers and swaps
- Aggregated balance view across multiple chains

## Technologies

- Next.js 15 with App Router
- TypeScript
- Privy for authentication
- OneBalance for smart accounts and cross-chain transactions
- TailwindCSS for styling

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Create a `.env` file with the following variables:
   ```
   NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id
   NEXT_PUBLIC_ONEBALANCE_API_KEY=your-onebalance-api-key
   ```

4. Run the development server:
   ```bash
   pnpm dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) to view the application

## Features

- **Authentication**: Login with email, social accounts, or connect an existing wallet
- **Smart Accounts**: Each user gets a OneBalance smart account that works across multiple chains
- **Asset Management**: View and manage assets across different blockchains
- **Transfers & Swaps**: Perform cross-chain transfers and asset swaps with optimized routing

## Learn More

- [OneBalance Documentation](https://docs.onebalance.io/)
- [Privy Documentation](https://docs.privy.io/)
