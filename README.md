# Pump.fun Trading Bot

A Node.js trading bot for buying and selling tokens on pump.fun using the official Pump SDK.

## Features

- ✅ Buy tokens with SOL
- ✅ Sell tokens for SOL
- ✅ Sell all tokens of a specific type
- ✅ Check wallet balance and token holdings
- ✅ Configurable slippage tolerance
- ✅ Transaction tracking with Solscan links

## Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn
- A Solana wallet with SOL for trading
- Private key of your Solana wallet (Base58 encoded)

## Installation

1. Clone or download this repository

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

4. Edit `.env` and add your private key:
```
PRIVATE_KEY=your_base58_encoded_private_key_here
RPC_URL=https://api.mainnet-beta.solana.com
DEFAULT_SLIPPAGE=1
```

## Getting Your Private Key

### From Phantom Wallet:
1. Open Phantom wallet
2. Go to Settings → Security & Privacy
3. Export Private Key
4. Copy the Base58 encoded string

### From Solflare:
1. Open Solflare wallet
2. Go to Settings → Export Private Key
3. Copy the Base58 encoded string

**⚠️ WARNING: Never share your private key or commit it to version control!**

## Usage

### Basic Usage

```javascript
import { PumpFunBot } from './src/index.js';

const bot = new PumpFunBot();

// Check wallet info
await bot.getWalletInfo();

// Buy tokens
const tokenMint = 'YOUR_TOKEN_MINT_ADDRESS';
await bot.buy(tokenMint, 0.1, 1); // Buy 0.1 SOL worth with 1% slippage

// Sell tokens
await bot.sell(tokenMint, 1000, 1); // Sell 1000 tokens with 1% slippage

// Sell all tokens
await bot.sellAll(tokenMint, 1);
```

### Running the Bot

```bash
# Run the bot
npm start

# Run in development mode (with auto-reload)
npm run dev
```

## API Reference

### `PumpFunBot` Class

#### Constructor
```javascript
const bot = new PumpFunBot();
```
Initializes the bot with wallet and connection from environment variables.

#### Methods

##### `buy(tokenMint, solAmount, slippage = 1)`
Buy tokens with SOL.

- `tokenMint` (string): The mint address of the token to buy
- `solAmount` (number): Amount of SOL to spend
- `slippage` (number): Slippage tolerance percentage (default: 1)
- Returns: `Promise<string>` - Transaction signature

##### `sell(tokenMint, tokenAmount, slippage = 1)`
Sell tokens for SOL.

- `tokenMint` (string): The mint address of the token to sell
- `tokenAmount` (number): Amount of tokens to sell
- `slippage` (number): Slippage tolerance percentage (default: 1)
- Returns: `Promise<string>` - Transaction signature

##### `sellAll(tokenMint, slippage = 1)`
Sell all tokens of a specific type.

- `tokenMint` (string): The mint address of the token to sell
- `slippage` (number): Slippage tolerance percentage (default: 1)
- Returns: `Promise<string>` - Transaction signature

##### `getTokenBalance(tokenMint)`
Get token balance for a specific token.

- `tokenMint` (string): The mint address of the token
- Returns: `Promise<number>` - Token balance

##### `getSolBalance()`
Get SOL balance.

- Returns: `Promise<number>` - SOL balance in SOL

##### `getWalletInfo()`
Get wallet address and SOL balance.

- Returns: `Promise<Object>` - Wallet information

## Configuration

Edit `src/config.js` or set environment variables:

- `RPC_URL`: Solana RPC endpoint (default: public mainnet)
- `DEFAULT_SLIPPAGE`: Default slippage tolerance (default: 1%)
- `PRIVATE_KEY`: Your wallet's private key (Base58 encoded)

## RPC Providers

For better performance and reliability, consider using a paid RPC provider:

- **Helius**: https://www.helius.dev/
- **QuickNode**: https://www.quicknode.com/
- **Alchemy**: https://www.alchemy.com/
- **Triton**: https://triton.one/

## Security Best Practices

1. **Never commit your private key** - Always use `.env` file and ensure it's in `.gitignore`
2. **Use a dedicated trading wallet** - Don't use your main wallet
3. **Start with small amounts** - Test with minimal amounts first
4. **Monitor transactions** - Check Solscan links after each transaction
5. **Use secure RPC endpoints** - Consider using paid RPC providers for better security

## Troubleshooting

### "Insufficient balance" error
- Ensure your wallet has enough SOL for the transaction
- Remember: You need SOL for transaction fees (~0.000005 SOL per transaction)

### Transaction failures
- Check your internet connection
- Verify the token mint address is correct
- Try increasing slippage tolerance
- Check if the token is still tradeable on pump.fun

### RPC errors
- Try switching to a different RPC endpoint
- Consider using a paid RPC provider for better reliability

## Disclaimer

This bot is for educational purposes. Trading cryptocurrencies involves risk. Always:
- Do your own research (DYOR)
- Start with small amounts
- Understand the risks involved
- Never invest more than you can afford to lose

## License

MIT

## Support

For issues related to:
- **Pump SDK**: Check the [official SDK documentation](https://www.npmjs.com/package/@pump-fun/pump-sdk)
- **Solana**: Visit [Solana documentation](https://docs.solana.com/)
- **This bot**: Open an issue on GitHub

