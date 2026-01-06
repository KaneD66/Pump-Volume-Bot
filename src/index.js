import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import bs58 from 'bs58';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import BN from 'bn.js';
import { getBuyTokenAmountFromSolAmount, getSellSolAmountFromTokenAmount, PumpSdk, OnlinePumpSdk } from '@pump-fun/pump-sdk';
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
    this.onlinePumpSDK = null;
    this._initializeSDK();
    
    console.log(`Bot initialized with wallet: ${this.wallet.publicKey.toString()}`);
  }

  /**
   * Initialize the Pump SDK asynchronously
   * Handles different possible SDK export names and initialization patterns
   */
  async _initializeSDK() {
    try {
      this.pumpSDK = new PumpSdk();
      this.onlinePumpSDK = new OnlinePumpSdk(this.connection);
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
   * @param {PublicKey} tokenProgram - Token program ID (default: TOKEN_PROGRAM_ID)
   * @returns {Promise<string>} Transaction signature
   */
  async buy(tokenMint, solAmount, slippage = 1, tokenProgram = TOKEN_PROGRAM_ID) {
    await this._ensureSDK();

    try {
      console.log(`\n🟢 Buying token: ${tokenMint}`);
      console.log(`Amount: ${solAmount} SOL`);
      console.log(`Slippage: ${slippage}%`);
      console.log(`Token Program: ${tokenProgram.toString()}`);

      // Check balance before purchase
      const balance = await this.connection.getBalance(this.wallet.publicKey);
      const solBalance = balance / 1e9;
      console.log(`Current balance: ${solBalance.toFixed(4)} SOL`);

      if (solBalance < solAmount) {
        throw new Error(`Insufficient balance. Need ${solAmount} SOL, have ${solBalance.toFixed(4)} SOL`);
      }

      const mint = new PublicKey(tokenMint);
      const user = this.wallet.publicKey;
      const solAmountBN = new BN(solAmount * 1e9); // Convert to lamports

      // Fetch required state
      console.log('Fetching global state...');
      const global = await this.onlinePumpSDK.fetchGlobal();
      
      console.log('Fetching fee config...');
      const feeConfig = await this.onlinePumpSDK.fetchFeeConfig();
      
      console.log('Fetching buy state...');
      const { bondingCurveAccountInfo, bondingCurve, associatedUserAccountInfo } =
        await this.onlinePumpSDK.fetchBuyState(mint, user, tokenProgram);

      // Calculate token amount from SOL amount
      const tokenAmount = getBuyTokenAmountFromSolAmount({
        global,
        amount: solAmountBN,
        bondingCurve,
        feeConfig: feeConfig,
        mintSupply: bondingCurve.realTokenReserves
      });
      console.log(`Expected tokens: ${tokenAmount.toString()}`);

      // Get buy instructions
      console.log('Building buy instructions...');
      const instructions = await this.pumpSDK.buyInstructions({
        global,
        bondingCurveAccountInfo,
        bondingCurve,
        associatedUserAccountInfo,
        mint,
        user,
        amount: tokenAmount,
        solAmount: solAmountBN,
        slippage: slippage,
        tokenProgram: tokenProgram,
      });

      // Create and send transaction
      const transaction = new Transaction().add(...instructions);
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.wallet],
        { commitment: 'confirmed' }
      );
      
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
   * @param {PublicKey} tokenProgram - Token program ID (default: TOKEN_PROGRAM_ID)
   * @returns {Promise<string>} Transaction signature
   */
  async sell(tokenMint, tokenAmount, slippage = 1, tokenProgram = TOKEN_PROGRAM_ID) {
    await this._ensureSDK();

    try {
      console.log(`\n🔴 Selling token: ${tokenMint}`);
      console.log(`Amount: ${tokenAmount} tokens`);
      console.log(`Slippage: ${slippage}%`);
      console.log(`Token Program: ${tokenProgram.toString()}`);

      const mint = new PublicKey(tokenMint);
      const user = this.wallet.publicKey;
      const tokenAmountBN = new BN(tokenAmount);

      // Fetch required state
      console.log('Fetching global state...');
      const global = await this.onlinePumpSDK.fetchGlobal();
      
      console.log('Fetching sell state...');
      const { bondingCurveAccountInfo, bondingCurve } = await this.onlinePumpSDK.fetchSellState(mint, user, tokenProgram);

      // Calculate SOL amount from token amount
      const solAmountBN = getSellSolAmountFromTokenAmount(global, bondingCurve, tokenAmountBN);
      console.log(`Expected SOL: ${(solAmountBN.toNumber() / 1e9).toFixed(6)} SOL`);

      // Get sell instructions
      console.log('Building sell instructions...');
      const instructions = await this.pumpSDK.sellInstructions({
        global,
        bondingCurveAccountInfo,
        bondingCurve,
        mint,
        user,
        amount: tokenAmountBN,
        solAmount: solAmountBN,
        slippage: slippage,
        tokenProgram: tokenProgram,
      });

      // Create and send transaction
      const transaction = new Transaction().add(...instructions);
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.wallet],
        { commitment: 'confirmed' }
      );
      
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
    const tokenMint = '8mb5FoFwKtdPByA9mrjeDAXyz3aeiyBYcRquib4baaV4';
    await bot.buy(tokenMint, 0.001, 1); // Buy 0.001 SOL worth with 1% slippage

    // Example: Sell tokens
    // await bot.sell(tokenMint, 1000, 1); // Sell 1000 tokens with 1% slippage

    // Example: Sell all tokens
    await bot.sellAll(tokenMint, 1);

  } catch (error) {
    console.error('Bot error:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename || process.argv[1].replace(/\\/g, '/') === __filename.replace(/\\/g, '/')) {
  main();
}

export { PumpFunBot };

