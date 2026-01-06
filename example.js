/**
 * Example usage of the PumpFunBot
 * 
 * This file demonstrates how to use the bot for various trading scenarios.
 * Uncomment and modify the examples to use them.
 */

import { PumpFunBot } from './index.js';
import dotenv from 'dotenv';

dotenv.config();

async function exampleBuy() {
  const bot = new PumpFunBot();
  
  // Example: Buy 0.1 SOL worth of a token
  const tokenMint = 'YOUR_TOKEN_MINT_ADDRESS_HERE';
  
  try {
    const txSignature = await bot.buy(tokenMint, 0.1, 1);
    console.log(`Buy transaction completed: ${txSignature}`);
  } catch (error) {
    console.error('Buy failed:', error);
  }
}

async function exampleSell() {
  const bot = new PumpFunBot();
  
  // Example: Sell 1000 tokens
  const tokenMint = 'YOUR_TOKEN_MINT_ADDRESS_HERE';
  
  try {
    const txSignature = await bot.sell(tokenMint, 1000, 1);
    console.log(`Sell transaction completed: ${txSignature}`);
  } catch (error) {
    console.error('Sell failed:', error);
  }
}

async function exampleSellAll() {
  const bot = new PumpFunBot();
  
  // Example: Sell all tokens of a specific type
  const tokenMint = 'YOUR_TOKEN_MINT_ADDRESS_HERE';
  
  try {
    // Check balance first
    const balance = await bot.getTokenBalance(tokenMint);
    console.log(`Current token balance: ${balance}`);
    
    if (balance > 0) {
      const txSignature = await bot.sellAll(tokenMint, 1);
      console.log(`Sell all transaction completed: ${txSignature}`);
    } else {
      console.log('No tokens to sell');
    }
  } catch (error) {
    console.error('Sell all failed:', error);
  }
}

async function exampleWalletInfo() {
  const bot = new PumpFunBot();
  
  try {
    const info = await bot.getWalletInfo();
    console.log('Wallet Information:', info);
    
    // Check token balance for a specific token
    const tokenMint = 'YOUR_TOKEN_MINT_ADDRESS_HERE';
    const tokenBalance = await bot.getTokenBalance(tokenMint);
    console.log(`Token balance: ${tokenBalance}`);
  } catch (error) {
    console.error('Error getting wallet info:', error);
  }
}

async function exampleTradingStrategy() {
  const bot = new PumpFunBot();
  const tokenMint = 'YOUR_TOKEN_MINT_ADDRESS_HERE';
  
  try {
    // 1. Check initial balance
    console.log('=== Initial State ===');
    await bot.getWalletInfo();
    
    // 2. Buy tokens
    console.log('\n=== Buying Tokens ===');
    await bot.buy(tokenMint, 0.1, 1);
    
    // Wait a bit (in a real bot, you might want to monitor price)
    // await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 3. Check token balance
    const tokenBalance = await bot.getTokenBalance(tokenMint);
    console.log(`\nToken balance after buy: ${tokenBalance}`);
    
    // 4. Sell tokens (example: sell half)
    console.log('\n=== Selling Tokens ===');
    if (tokenBalance > 0) {
      await bot.sell(tokenMint, tokenBalance / 2, 1);
    }
    
    // 5. Final state
    console.log('\n=== Final State ===');
    await bot.getWalletInfo();
    const finalTokenBalance = await bot.getTokenBalance(tokenMint);
    console.log(`Final token balance: ${finalTokenBalance}`);
    
  } catch (error) {
    console.error('Trading strategy failed:', error);
  }
}

// Run examples (uncomment the one you want to test)
async function main() {
  // await exampleWalletInfo();
  // await exampleBuy();
  // await exampleSell();
  // await exampleSellAll();
  // await exampleTradingStrategy();
  
  console.log('No example selected. Uncomment an example function in example.js to run it.');
}

main().catch(console.error);

