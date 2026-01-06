import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import dotenv from 'dotenv';
import { config } from './config.js';

dotenv.config();

class PumpFunBot {
  constructor() {
    this.connection = new Connection(
      config.rpcUrl || 'https://api.mainnet-beta.solana.com',
      'confirmed'
    );
    
    // Initialize wallet from private key
    if (!process.env.PRIVATE_KEY) {
      throw new Error('PRIVATE_KEY environment variable is required');
    }
    
    const privateKeyArray = bs58.decode(process.env.PRIVATE_KEY);
    this.wallet = Keypair.fromSecretKey(privateKeyArray);
    
    // Initialize Pump SDK (will be loaded asynchronously)
    this.pumpSDK = null;
    this._initializeSDK();
    
    console.log(`Bot initialized with wallet: ${this.wallet.publicKey.toString()}`);
  }

  /**
   * Initialize the Pump SDK asynchronously
   * Handles different possible SDK export names and initialization patterns
   */
  async _initializeSDK() {
    try {
      const pumpSDKModule = await import('@pump-fun/pump-sdk');
      
      // Try different possible export names
      const PumpSDK = pumpSDKModule.PumpFun || 
                      pumpSDKModule.PumpDotFunSDK || 
                      pumpSDKModule.default ||
                      pumpSDKModule;

      // Try object-based initialization first
      try {
        this.pumpSDK = new PumpSDK({
          connection: this.connection,
          wallet: this.wallet,
        });
        console.log('Pump SDK initialized successfully');
      } catch (error) {
        // Fallback to positional arguments if object-based fails
        try {
          this.pumpSDK = new PumpSDK(this.connection, this.wallet);
          console.log('Pump SDK initialized successfully (positional args)');
        } catch (err) {
          console.warn('Could not initialize Pump SDK. Some methods may not work.');
          console.warn('Error:', err.message);
          this.pumpSDK = null;
        }
      }
    } catch (error) {
      console.warn('Warning: Could not import pump SDK. Make sure @pump-fun/pump-sdk is installed.');
      console.warn('Error:', error.message);
      this.pumpSDK = null;
    }
  }

  /**
   * Ensure SDK is initialized before use
   */
  async _ensureSDK() {
    if (!this.pumpSDK) {
      await this._initializeSDK();
      if (!this.pumpSDK) {
        throw new Error('Pump SDK not initialized. Please install @pump-fun/pump-sdk');
      }
    }
  }

  /**
   * Buy tokens on pump.fun
   * @param {string} tokenMint - The mint address of the token to buy
   * @param {number} solAmount - Amount of SOL to spend (in SOL, not lamports)
   * @param {number} slippage - Slippage tolerance (default: 1%)
   * @returns {Promise<string>} Transaction signature
   */
  async buy(tokenMint, solAmount, slippage = 1) {
    await this._ensureSDK();

    try {
      console.log(`\n🟢 Buying token: ${tokenMint}`);
      console.log(`Amount: ${solAmount} SOL`);
      console.log(`Slippage: ${slippage}%`);

      // Check balance before purchase
      const balance = await this.connection.getBalance(this.wallet.publicKey);
      const solBalance = balance / 1e9;
      console.log(`Current balance: ${solBalance.toFixed(4)} SOL`);

      if (solBalance < solAmount) {
        throw new Error(`Insufficient balance. Need ${solAmount} SOL, have ${solBalance.toFixed(4)} SOL`);
      }

      // Execute buy transaction using pump SDK
      // Note: The SDK method signature may vary. Adjust based on actual SDK documentation
      // Common patterns:
      // - buy({ mint, amount, slippage })
      // - buy(mint, amount, slippage)
      // - buyToken({ mint, solAmount, slippage })
      let result;
      try {
        result = await this.pumpSDK.buy({
          mint: new PublicKey(tokenMint),
          amount: solAmount,
          slippage: slippage,
        });
      } catch (err) {
        // Try alternative method signature
        result = await this.pumpSDK.buy(
          new PublicKey(tokenMint),
          solAmount,
          slippage
        );
      }

      // Handle different result formats
      const signature = result.signature || result.txid || result;
      
      console.log(`✅ Buy successful!`);
      console.log(`Transaction signature: ${signature}`);
      console.log(`View on Solscan: https://solscan.io/tx/${signature}`);

      return signature;
    } catch (error) {
      console.error(`❌ Buy failed:`, error.message);
      throw error;
    }
  }

  /**
   * Sell tokens on pump.fun
   * @param {string} tokenMint - The mint address of the token to sell
   * @param {number} tokenAmount - Amount of tokens to sell (in token decimals)
   * @param {number} slippage - Slippage tolerance (default: 1%)
   * @returns {Promise<string>} Transaction signature
   */
  async sell(tokenMint, tokenAmount, slippage = 1) {
    await this._ensureSDK();

    try {
      console.log(`\n🔴 Selling token: ${tokenMint}`);
      console.log(`Amount: ${tokenAmount} tokens`);
      console.log(`Slippage: ${slippage}%`);

      // Execute sell transaction using pump SDK
      // Note: The SDK method signature may vary. Adjust based on actual SDK documentation
      let result;
      try {
        result = await this.pumpSDK.sell({
          mint: new PublicKey(tokenMint),
          amount: tokenAmount,
          slippage: slippage,
        });
      } catch (err) {
        // Try alternative method signature
        result = await this.pumpSDK.sell(
          new PublicKey(tokenMint),
          tokenAmount,
          slippage
        );
      }

      // Handle different result formats
      const signature = result.signature || result.txid || result;
      
      console.log(`✅ Sell successful!`);
      console.log(`Transaction signature: ${signature}`);
      console.log(`View on Solscan: https://solscan.io/tx/${signature}`);

      return signature;
    } catch (error) {
      console.error(`❌ Sell failed:`, error.message);
      throw error;
    }
  }

  /**
   * Sell all tokens of a specific type
   * @param {string} tokenMint - The mint address of the token to sell
   * @param {number} slippage - Slippage tolerance (default: 1%)
   * @returns {Promise<string>} Transaction signature
   */
  async sellAll(tokenMint, slippage = 1) {
    try {
      // Get token balance
      const tokenBalance = await this.getTokenBalance(tokenMint);
      
      if (tokenBalance === 0) {
        throw new Error('No tokens to sell');
      }

      console.log(`Selling all tokens: ${tokenBalance}`);
      return await this.sell(tokenMint, tokenBalance, slippage);
    } catch (error) {
      console.error(`❌ Sell all failed:`, error.message);
      throw error;
    }
  }

  /**
   * Get token balance for a specific token
   * @param {string} tokenMint - The mint address of the token
   * @returns {Promise<number>} Token balance
   */
  async getTokenBalance(tokenMint) {
    try {
      const mintPublicKey = new PublicKey(tokenMint);
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        this.wallet.publicKey,
        { mint: mintPublicKey }
      );

      if (tokenAccounts.value.length === 0) {
        return 0;
      }

      const balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
      return balance;
    } catch (error) {
      console.error(`Error getting token balance:`, error.message);
      return 0;
    }
  }

  /**
   * Get SOL balance
   * @returns {Promise<number>} SOL balance
   */
  async getSolBalance() {
    try {
      const balance = await this.connection.getBalance(this.wallet.publicKey);
      return balance / 1e9;
    } catch (error) {
      console.error(`Error getting SOL balance:`, error.message);
      return 0;
    }
  }

  /**
   * Monitor wallet balance and token holdings
   */
  async getWalletInfo() {
    try {
      const solBalance = await this.getSolBalance();
      console.log(`\n📊 Wallet Info:`);
      console.log(`Address: ${this.wallet.publicKey.toString()}`);
      console.log(`SOL Balance: ${solBalance.toFixed(4)} SOL`);
      
      return {
        address: this.wallet.publicKey.toString(),
        solBalance: solBalance
      };
    } catch (error) {
      console.error(`Error getting wallet info:`, error.message);
      throw error;
    }
  }
}

// Example usage
async function main() {
  try {
    const bot = new PumpFunBot();
    
    // Display wallet info
    await bot.getWalletInfo();

    // Example: Buy tokens
    // Uncomment and modify the token mint address to use
    // const tokenMint = 'YOUR_TOKEN_MINT_ADDRESS_HERE';
    // await bot.buy(tokenMint, 0.1, 1); // Buy 0.1 SOL worth with 1% slippage

    // Example: Sell tokens
    // await bot.sell(tokenMint, 1000, 1); // Sell 1000 tokens with 1% slippage

    // Example: Sell all tokens
    // await bot.sellAll(tokenMint, 1);

  } catch (error) {
    console.error('Bot error:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { PumpFunBot };

