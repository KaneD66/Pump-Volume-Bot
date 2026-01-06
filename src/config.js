import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // RPC URL - Use a reliable Solana RPC endpoint
  rpcUrl: process.env.RPC_URL || 'https://api.mainnet-beta.solana.com',
  
  // Alternative RPC URLs (uncomment to use):
  // rpcUrl: 'https://solana-api.projectserum.com',
  // rpcUrl: 'https://rpc.ankr.com/solana',
  
  // Default slippage tolerance (percentage)
  defaultSlippage: parseFloat(process.env.DEFAULT_SLIPPAGE) || 1,
  
  // Transaction confirmation settings
  commitment: 'confirmed', // 'processed', 'confirmed', or 'finalized'
  
  // Retry settings
  maxRetries: 3,
  retryDelay: 1000, // milliseconds
  
  // Volume bot settings
  volumeBot: {
    // Default delay between trades (milliseconds)
    defaultDelayBetweenTrades: 2000,
    // Safety limit for maximum cycles
    maxCycles: 1000,
  },
};

