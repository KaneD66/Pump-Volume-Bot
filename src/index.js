import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, getMint } from '@solana/spl-token';
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
   * Detect which token program a mint uses
   * @param {PublicKey} mint - The mint address
   * @returns {Promise<PublicKey>} The token program ID (TOKEN_PROGRAM_ID or TOKEN_2022_PROGRAM_ID)
   */
  async detectTokenProgram(mint) {
    try {
      const mintInfo = await this.connection.getAccountInfo(mint);
      if (!mintInfo) {
        throw new Error(`Mint account not found: ${mint.toString()}`);
      }
      
      // Check which program owns the mint account
      if (mintInfo.owner.equals(TOKEN_2022_PROGRAM_ID)) {
        return TOKEN_2022_PROGRAM_ID;
      } else if (mintInfo.owner.equals(TOKEN_PROGRAM_ID)) {
        return TOKEN_PROGRAM_ID;
      } else {
        // Default to TOKEN_PROGRAM_ID if unknown
        console.warn(`Unknown token program owner: ${mintInfo.owner.toString()}. Defaulting to TOKEN_PROGRAM_ID`);
        return TOKEN_PROGRAM_ID;
      }
    } catch (error) {
      console.warn(`Error detecting token program: ${error.message}. Defaulting to TOKEN_PROGRAM_ID`);
      return TOKEN_PROGRAM_ID;
    }
  }

  /**
   * Buy tokens on pump.fun
   * @param {string} tokenMint - The mint address of the token to buy
   * @param {number} solAmount - Amount of SOL to spend (in SOL, not lamports)
   * @param {number} slippage - Slippage tolerance (default: 1%)
   * @param {PublicKey} tokenProgram - Token program ID (optional, will be auto-detected if not provided)
   * @returns {Promise<string>} Transaction signature
   */
  async buy(tokenMint, solAmount, slippage = 1, tokenProgram = null) {
    await this._ensureSDK();

    try {
      const mint = new PublicKey(tokenMint);
      
      // Auto-detect token program if not provided
      if (!tokenProgram) {
        console.log('Detecting token program...');
        tokenProgram = await this.detectTokenProgram(mint);
      }

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
   * @param {PublicKey} tokenProgram - Token program ID (optional, will be auto-detected if not provided)
   * @returns {Promise<string>} Transaction signature
   */
  async sell(tokenMint, tokenAmount, slippage = 1, tokenProgram = null) {
    await this._ensureSDK();

    try {
      const mint = new PublicKey(tokenMint);
      
      // Auto-detect token program if not provided
      if (!tokenProgram) {
        console.log('Detecting token program...');
        tokenProgram = await this.detectTokenProgram(mint);
      }
      const mintInfo = await getMint(this.connection, mint, 'confirmed', tokenProgram);
      console.log(`\n🔴 Selling token: ${tokenMint}`);
      console.log(`Amount: ${tokenAmount} tokens`);
      console.log(`Slippage: ${slippage}%`);
      console.log(`Token Program: ${tokenProgram.toString()}`);

      const user = this.wallet.publicKey;
      const tokenAmountBN = new BN(tokenAmount * 10 ** mintInfo.decimals);
      console.log('Token amount:', tokenAmountBN.toString());
      // Fetch required state
      console.log('Fetching global state...');
      const global = await this.onlinePumpSDK.fetchGlobal();
      
      console.log('Fetching fee config...');
      const feeConfig = await this.onlinePumpSDK.fetchFeeConfig();
      
      console.log('Fetching sell state...');
      const { bondingCurveAccountInfo, bondingCurve } = await this.onlinePumpSDK.fetchSellState(mint, user, tokenProgram);

      // Calculate SOL amount from token amount
      const solAmountBN = getSellSolAmountFromTokenAmount({
        global,
        feeConfig: feeConfig,
        mintSupply: bondingCurve.realTokenReserves,
        bondingCurve,
        amount: tokenAmountBN,
      });
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
   * Generate volume by buying and selling tokens repeatedly
   * @param {string} tokenMint - The mint address of the token to trade
   * @param {number} volumeTarget - Target volume in SOL (e.g., 10 SOL)
   * @param {number} perTransactionAmount - Amount of SOL per transaction (e.g., 0.1 SOL)
   * @param {number} slippage - Slippage tolerance (default: 1%)
   * @param {number} delayBetweenTrades - Delay in milliseconds between trades (default: 2000ms)
   * @returns {Promise<Object>} Summary of volume generation
   */
  async generateVolume(tokenMint, volumeTarget, perTransactionAmount, slippage = 1, delayBetweenTrades = 2000) {
    await this._ensureSDK();

    let totalVolumeGenerated = 0;
    let transactionCount = 0;
    let buyCount = 0;
    let sellCount = 0;
    const startTime = Date.now();
    const errors = [];

    // Helper function to sleep
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    try {
      // Check initial balance
      const initialBalance = await this.getSolBalance();
      console.log(`\n💰 Initial SOL Balance: ${initialBalance.toFixed(4)} SOL`);

      // Calculate how many transactions we'll need (each cycle = buy + sell = 2x perTransactionAmount volume)
      // But we'll track actual volume generated
      const estimatedCycles = Math.ceil(volumeTarget / (perTransactionAmount * 2));
      console.log(`Estimated cycles needed: ~${estimatedCycles} (buy + sell pairs)`);

      while (totalVolumeGenerated < volumeTarget) {
        try {
          // Check if we have enough balance
          const currentBalance = await this.getSolBalance();
          if (currentBalance < perTransactionAmount * 1.1) { // Need extra for fees
            console.warn(`⚠️ Insufficient balance. Current: ${currentBalance.toFixed(4)} SOL, Need: ${(perTransactionAmount * 1.1).toFixed(4)} SOL`);
            break;
          }

          transactionCount++;
          console.log(`\n📈 Cycle ${transactionCount} - Target Volume: ${volumeTarget} SOL, Generated: ${totalVolumeGenerated.toFixed(4)} SOL`);

          // BUY
          console.log(`\n🟢 [${transactionCount}.1] BUYING ${perTransactionAmount} SOL worth...`);
          try {
            const buySignature = await this.buy(tokenMint, perTransactionAmount, slippage);
            buyCount++;
            totalVolumeGenerated += perTransactionAmount;
            console.log(`✅ Buy successful! Volume generated: ${totalVolumeGenerated.toFixed(4)}/${volumeTarget} SOL`);
            
            // Wait before selling
            if (delayBetweenTrades > 0) {
              await sleep(delayBetweenTrades);
            }
          } catch (buyError) {
            console.error(`❌ Buy failed in cycle ${transactionCount}:`, buyError.message);
            errors.push({ cycle: transactionCount, type: 'buy', error: buyError.message });
            // Continue to next cycle even if buy fails
            if (delayBetweenTrades > 0) {
              await sleep(delayBetweenTrades);
            }
            continue;
          }

          // Check if we've reached the target after buy
          if (totalVolumeGenerated >= volumeTarget) {
            console.log(`\n🎯 Volume target reached after buy!`);
            break;
          }

          // SELL
          console.log(`\n🔴 [${transactionCount}.2] SELLING tokens...`);
          try {
            // Get current token balance
            const tokenBalance = await this.getTokenBalance(tokenMint);
            
            if (tokenBalance > 0) {
              const sellSignature = await this.sell(tokenMint, tokenBalance, slippage);
              sellCount++;
              
              // Estimate SOL received (approximate, actual may vary)
              // We'll track the buy amount as volume since sell volume is harder to track precisely
              // But we can add an estimate
              totalVolumeGenerated += perTransactionAmount; // Approximate sell volume
              console.log(`✅ Sell successful! Volume generated: ${totalVolumeGenerated.toFixed(4)}/${volumeTarget} SOL`);
            } else {
              console.warn(`⚠️ No tokens to sell after buy`);
            }
          } catch (sellError) {
            console.error(`❌ Sell failed in cycle ${transactionCount}:`, sellError.message);
            errors.push({ cycle: transactionCount, type: 'sell', error: sellError.message });
            // Continue even if sell fails - we'll try to sell in next cycle
          }

          // Wait before next cycle
          if (delayBetweenTrades > 0 && totalVolumeGenerated < volumeTarget) {
            await sleep(delayBetweenTrades);
          }

        } catch (cycleError) {
          console.error(`❌ Error in cycle ${transactionCount}:`, cycleError.message);
          errors.push({ cycle: transactionCount, type: 'cycle', error: cycleError.message });
          
          // Wait before retrying
          if (delayBetweenTrades > 0) {
            await sleep(delayBetweenTrades);
          }
        }

        // Safety check: if we've done too many cycles without progress, break
        if (transactionCount > 1000) {
          console.warn(`⚠️ Safety limit reached (1000 cycles). Stopping.`);
          break;
        }
      }

      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      const finalBalance = await this.getSolBalance();

      // Summary
      console.log(`\n\n📊 Volume Generation Summary:`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Target Volume: ${volumeTarget} SOL`);
      console.log(`Generated Volume: ${totalVolumeGenerated.toFixed(4)} SOL`);
      console.log(`Progress: ${((totalVolumeGenerated / volumeTarget) * 100).toFixed(2)}%`);
      console.log(`Total Cycles: ${transactionCount}`);
      console.log(`Successful Buys: ${buyCount}`);
      console.log(`Successful Sells: ${sellCount}`);
      console.log(`Errors: ${errors.length}`);
      console.log(`Duration: ${duration} seconds`);
      console.log(`Initial Balance: ${initialBalance.toFixed(4)} SOL`);
      console.log(`Final Balance: ${finalBalance.toFixed(4)} SOL`);
      console.log(`Balance Change: ${(finalBalance - initialBalance).toFixed(4)} SOL`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      if (errors.length > 0) {
        console.log(`\n⚠️ Errors encountered:`);
        errors.forEach((err, idx) => {
          console.log(`  ${idx + 1}. Cycle ${err.cycle} (${err.type}): ${err.error}`);
        });
      }

      return {
        success: totalVolumeGenerated >= volumeTarget * 0.95, // 95% success threshold
        targetVolume: volumeTarget,
        generatedVolume: totalVolumeGenerated,
        progress: (totalVolumeGenerated / volumeTarget) * 100,
        transactionCount,
        buyCount,
        sellCount,
        errors: errors.length,
        duration: parseFloat(duration),
        initialBalance,
        finalBalance,
        balanceChange: finalBalance - initialBalance,
        errorDetails: errors
      };

    } catch (error) {
      console.error(`❌ Volume generation failed:`, error.message);
      throw error;
    }
  }
}

// Example usage
async function main() {
  try {
    const bot = new PumpFunBot();

    const tokenMint = '8mb5FoFwKtdPByA9mrjeDAXyz3aeiyBYcRquib4baaV4';
    const volumeTarget = 0.04; // Target volume in SOL (e.g., 1 SOL)
    const perTransactionAmount = 0.01; // Amount per transaction in SOL (e.g., 0.1 SOL)
    const slippage = 1; // Slippage tolerance percentage
    const delayBetweenTrades = 2000; // Delay in milliseconds between trades
    
    // Run volume bot
    await bot.generateVolume(
      tokenMint,
      volumeTarget,
      perTransactionAmount,
      slippage,
      delayBetweenTrades
    );

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

