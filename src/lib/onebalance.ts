// src/lib/onebalance.ts
import axios from 'axios';

// Create an axios client that points to our proxy
export const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// OneBalance API base URL and API key (for reference)
export const API_BASE_URL = 'https://be.onebalance.io/api';
export const API_KEY = process.env.NEXT_PUBLIC_ONEBALANCE_API_KEY;

// Predict account address for a user based on their Privy wallet
export async function predictAccountAddress(sessionAddress: string, adminAddress: string) {
  try {
    const response = await apiClient.post('/account/predict-address', {
      sessionAddress,
      adminAddress
    });
    return response.data?.predictedAddress;
  } catch (error) {
    console.error('Error predicting account address:', error);
    throw error;
  }
}

// Get aggregated balance for a smart account
export async function getAggregatedBalance(address: string) {
  try {
    const response = await apiClient.get(`/v2/balances/aggregated-balance?address=${address}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching aggregated balance:', error);
    throw error;
  }
}

// Get a quote for swapping or transferring tokens
export async function getQuote(params: {
  from: {
    account: {
      sessionAddress: string;
      adminAddress: string;
      accountAddress: string;
    };
    asset: {
      assetId: string;
    };
    amount: string;
  };
  to: {
    asset: {
      assetId: string;
    };
  };
}) {
  try {
    const response = await apiClient.post('/v1/quote', params);
    return response.data;
  } catch (error) {
    console.error('Error getting quote:', error);
    throw error;
  }
}

// Execute a quote after getting user signature
export async function executeQuote(signedQuote: any) {
  try {
    const response = await apiClient.post('/quotes/execute-quote', signedQuote);
    return response.data;
  } catch (error) {
    console.error('Error executing quote:', error);
    throw error;
  }
}

// Check transaction status
export async function checkTransactionStatus(quoteId: string) {
  try {
    const response = await apiClient.get(`/status/get-execution-status?quoteId=${quoteId}`);
    return response.data;
  } catch (error) {
    console.error('Error checking transaction status:', error);
    throw error;
  }
}