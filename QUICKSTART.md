# Quick Start Guide

## 1. Install Dependencies

```bash
npm install
```

## 2. Set Up Environment Variables

Create a `.env` file in the root directory:

```bash
PRIVATE_KEY=your_base58_encoded_private_key_here
RPC_URL=https://api.mainnet-beta.solana.com
DEFAULT_SLIPPAGE=1
```

## 3. Get Your Private Key

### From Phantom Wallet:
1. Open Phantom
2. Settings → Security & Privacy → Export Private Key
3. Copy the Base58 string

### From Solflare:
1. Open Solflare
2. Settings → Export Private Key
3. Copy the Base58 string

**⚠️ NEVER share your private key or commit it to git!**

## 4. Basic Usage

### Check Wallet Balance

```javascript
import { PumpFunBot } from './src/index.js';

const bot = new PumpFunBot();
await bot.getWalletInfo();
```

### Buy Tokens

```javascript
const tokenMint = 'YOUR_TOKEN_MINT_ADDRESS';
await bot.buy(tokenMint, 0.1, 1); // Buy 0.1 SOL worth with 1% slippage
```

### Sell Tokens

```javascript
await bot.sell(tokenMint, 1000, 1); // Sell 1000 tokens with 1% slippage
```

### Sell All Tokens

```javascript
await bot.sellAll(tokenMint, 1); // Sell all tokens with 1% slippage
```

## 5. Run the Bot

```bash
npm start
```

## Important Notes

1. **Start Small**: Test with small amounts first (0.01-0.1 SOL)
2. **Transaction Fees**: Keep some SOL for transaction fees (~0.000005 SOL per tx)
3. **Slippage**: Adjust slippage based on token liquidity (1-5% is common)
4. **RPC Limits**: Free RPCs have rate limits. Consider a paid RPC for production use

## Troubleshooting

- **"PRIVATE_KEY environment variable is required"**: Make sure your `.env` file exists and has the PRIVATE_KEY set
- **"Pump SDK not initialized"**: Run `npm install` to ensure @pump-fun/pump-sdk is installed
- **Transaction failures**: Check your SOL balance, token mint address, and network connection

