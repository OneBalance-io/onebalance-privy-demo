// src/app/dashboard/page.tsx
'use client';

import { useEffect, useState, useRef, ChangeEvent } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { getQuote, executeQuote, checkTransactionStatus, predictAccountAddress, getAggregatedBalance } from '@/lib/onebalance';
import { Quote } from '@/lib/types/quote';
import { signQuote } from '@/lib/privySigningUtils';
import { formatUnits } from 'viem';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const router = useRouter();
  const { user, ready, authenticated, logout } = usePrivy();
  const { wallets } = useWallets();
  const [loading, setLoading] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [accountAddress, setAccountAddress] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
  const [ethBalance, setEthBalance] = useState<string | null>(null);
  const [usdcChainBalances, setUsdcChainBalances] = useState<Array<{chainId: string, balance: string, numericBalance: number, assetType: string}>>([]);
  const [ethChainBalances, setEthChainBalances] = useState<Array<{chainId: string, balance: string, numericBalance: number, assetType: string}>>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const statusPollingRef = useRef<NodeJS.Timeout | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [swapAmount, setSwapAmount] = useState('5.00');
  const [estimatedAmount, setEstimatedAmount] = useState<string | null>(null);
  const [fetchingQuote, setFetchingQuote] = useState(false);
  const [swapDirection, setSwapDirection] = useState<'USDC_TO_ETH' | 'ETH_TO_USDC'>('USDC_TO_ETH');
  const [showUsdcChainDetails, setShowUsdcChainDetails] = useState(false);
  const [showEthChainDetails, setShowEthChainDetails] = useState(false);

  // Helper function to get chain name from chain ID
  const getChainName = (chainId: string): string => {
    const chainMap: Record<string, string> = {
      '1': 'Ethereum',
      '137': 'Polygon',
      '42161': 'Arbitrum',
      '10': 'Optimism',
      '8453': 'Base',
      '59144': 'Linea',
      '43114': 'Avalanche'
    };
    
    return chainMap[chainId] || `Chain ${chainId}`;
  };

  const embeddedWallet = wallets.find(wallet => wallet.walletClientType === 'privy');

  // Handle logout and redirect to home page
  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  // Get OneBalance account address based on Privy wallet
  useEffect(() => {
    async function setupAccount() {
      if (embeddedWallet && embeddedWallet.address) {
        try {
          // For this demo, we'll use the same address as both session and admin
          const predictedAddress = await predictAccountAddress(
            embeddedWallet.address,
            embeddedWallet.address
          );
          setAccountAddress(predictedAddress);
          
          // Get aggregated balance for USDC and ETH
          fetchBalances(predictedAddress);
        } catch (err) {
          console.error('Error setting up account:', err);
          setError('Failed to set up OneBalance account');
        }
      }
    }

    if (ready && authenticated) {
      setupAccount();
    }

    // Clean up polling interval on unmount
    return () => {
      if (statusPollingRef.current) {
        clearInterval(statusPollingRef.current);
      }
    };
  }, [embeddedWallet, ready, authenticated]);

  // Handle swap direction toggle
  const toggleSwapDirection = () => {
    // Reset current quote and estimated amount
    setQuote(null);
    setEstimatedAmount(null);
    
    // Toggle direction
    setSwapDirection(prevDirection => 
      prevDirection === 'USDC_TO_ETH' ? 'ETH_TO_USDC' : 'USDC_TO_ETH'
    );
    
    // Reset swap amount to a sensible default based on direction
    if (swapDirection === 'USDC_TO_ETH') {
      // Switching to ETH -> USDC, set a default ETH amount (0.001 ETH)
      setSwapAmount('0.001');
    } else {
      // Switching to USDC -> ETH, set a default USDC amount (5 USDC)
      setSwapAmount('5.00');
    }
    
    // Fetch a new quote after a brief delay to ensure state is updated
    setTimeout(() => {
      if (accountAddress && embeddedWallet) {
        fetchEstimatedQuote(swapDirection === 'USDC_TO_ETH' ? '0.001' : '5.00');
      }
    }, 300);
  };

  // Handle swap amount change
  const handleSwapAmountChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (isNaN(Number(value)) || Number(value) <= 0) {
      return;
    }
    
    setSwapAmount(value);
    
    // Reset estimated amount when input changes
    setEstimatedAmount(null);
    
    // If we have a valid amount and an account, fetch a new quote
    if (Number(value) > 0 && accountAddress && embeddedWallet) {
      fetchEstimatedQuote(value);
    }
  };

  // Fetch a quote for estimation purposes
  const fetchEstimatedQuote = async (amountStr: string) => {
    if (!accountAddress || !embeddedWallet) return;
    
    try {
      setFetchingQuote(true);
      
      // Convert to smallest unit based on direction
      // USDC has 6 decimals, ETH has 18 decimals
      const amount = swapDirection === 'USDC_TO_ETH'
        ? (parseFloat(amountStr) * 1_000_000).toString() // USDC -> ETH (6 decimals)
        : (parseFloat(amountStr) * 1e18).toString();     // ETH -> USDC (18 decimals)
      
      const quoteRequest = {
        from: {
          account: {
            sessionAddress: embeddedWallet.address,
            adminAddress: embeddedWallet.address,
            accountAddress: accountAddress,
          },
          asset: {
            assetId: swapDirection === 'USDC_TO_ETH' ? 'ob:usdc' : 'ob:eth',
          },
          amount,
        },
        to: {
          asset: {
            assetId: swapDirection === 'USDC_TO_ETH' ? 'ob:eth' : 'ob:usdc',
          },
        },
      };

      const quoteResponse = await getQuote(quoteRequest);
      setQuote(quoteResponse);
      
      // Extract estimated amount from the quote
      if (quoteResponse.destinationToken && quoteResponse.destinationToken.amount) {
        // Format based on direction
        if (swapDirection === 'USDC_TO_ETH') {
          // USDC -> ETH (ETH has 18 decimals)
          const ethAmount = parseFloat(formatUnits(BigInt(quoteResponse.destinationToken.amount), 18)).toFixed(6);
          setEstimatedAmount(ethAmount);
        } else {
          // ETH -> USDC (USDC has 6 decimals)
          const usdcAmount = parseFloat(formatUnits(BigInt(quoteResponse.destinationToken.amount), 6)).toFixed(2);
          setEstimatedAmount(usdcAmount);
        }
      }
    } catch (err) {
      console.error('Error fetching quote for estimation:', err);
      setEstimatedAmount(null);
    } finally {
      setFetchingQuote(false);
    }
  };

  // Fetch USDC and ETH balances
  const fetchBalances = async (address: string) => {
    try {
      const balanceData = await getAggregatedBalance(address);
      
      // Find USDC in the balance data
      const usdcAsset = balanceData.balanceByAggregatedAsset.find(
        (asset: any) => asset.aggregatedAssetId === 'ob:usdc'
      );
      
      // Find ETH in the balance data
      const ethAsset = balanceData.balanceByAggregatedAsset.find(
        (asset: any) => asset.aggregatedAssetId === 'ob:eth'
      );
      
      if (usdcAsset) {
        // Format the balance (USDC has 6 decimals)
        const formattedBalance = parseFloat(formatUnits(BigInt(usdcAsset.balance), 6)).toFixed(2);
        setUsdcBalance(formattedBalance);

        // Extract individual chain balances for USDC
        if (usdcAsset.individualAssetBalances && usdcAsset.individualAssetBalances.length > 0) {
          const chainBalances = usdcAsset.individualAssetBalances
            .map((chainBalance: any) => {
              // Extract chain ID from assetType (format: eip155:CHAIN_ID/...)
              const chainId = chainBalance.assetType.split(':')[1].split('/')[0];
              const formattedBalance = parseFloat(formatUnits(BigInt(chainBalance.balance), 6)).toFixed(2);
              return {
                chainId,
                balance: formattedBalance,
                numericBalance: parseFloat(formattedBalance), // For sorting
                assetType: chainBalance.assetType
              };
            })
            // Filter out zero balances
            .filter((chainBalance: {numericBalance: number}) => chainBalance.numericBalance > 0)
            // Sort by balance in descending order
            .sort((a: {numericBalance: number}, b: {numericBalance: number}) => b.numericBalance - a.numericBalance);
            
          setUsdcChainBalances(chainBalances);
        }
      } else {
        setUsdcBalance('0.00');
        setUsdcChainBalances([]);
      }
      
      if (ethAsset) {
        // Format the balance (ETH has 18 decimals)
        const formattedBalance = parseFloat(formatUnits(BigInt(ethAsset.balance), 18)).toFixed(6);
        setEthBalance(formattedBalance);

        // Extract individual chain balances for ETH
        if (ethAsset.individualAssetBalances && ethAsset.individualAssetBalances.length > 0) {
          const chainBalances = ethAsset.individualAssetBalances
            .map((chainBalance: any) => {
              // Extract chain ID from assetType (format: eip155:CHAIN_ID/...)
              const chainId = chainBalance.assetType.split(':')[1].split('/')[0];
              const formattedBalance = parseFloat(formatUnits(BigInt(chainBalance.balance), 18)).toFixed(6);
              return {
                chainId,
                balance: formattedBalance,
                numericBalance: parseFloat(formattedBalance), // For sorting
                assetType: chainBalance.assetType
              };
            })
            // Filter out zero balances
            .filter((chainBalance: {numericBalance: number}) => chainBalance.numericBalance > 0)
            // Sort by balance in descending order
            .sort((a: {numericBalance: number}, b: {numericBalance: number}) => b.numericBalance - a.numericBalance);
            
          setEthChainBalances(chainBalances);
        }
      } else {
        setEthBalance('0.000000');
        setEthChainBalances([]);
      }
      
      // After getting balances, fetch an initial quote estimate using the default amount
      if (address && embeddedWallet) {
        fetchEstimatedQuote(swapAmount);
      }
    } catch (err) {
      console.error('Error fetching balances:', err);
      setUsdcBalance('0.00');
      setEthBalance('0.000000');
      setUsdcChainBalances([]);
      setEthChainBalances([]);
    }
  };

  // Poll for transaction status
  const startStatusPolling = (quoteId: string) => {
    if (statusPollingRef.current) {
      clearInterval(statusPollingRef.current);
    }
    
    setIsPolling(true);
    
    statusPollingRef.current = setInterval(async () => {
      try {
        const statusData = await checkTransactionStatus(quoteId);
        setStatus(statusData);
        
        // If the transaction is completed or failed, stop polling
        if (statusData.status === 'COMPLETED' || statusData.status === 'FAILED') {
          if (statusPollingRef.current) {
            clearInterval(statusPollingRef.current);
            setIsPolling(false);
          }
          
          // Refresh balances after transaction is completed
          if (accountAddress && statusData.status === 'COMPLETED') {
            fetchBalances(accountAddress);
          }
        }
      } catch (err) {
        console.error('Error polling transaction status:', err);
        if (statusPollingRef.current) {
          clearInterval(statusPollingRef.current);
          setIsPolling(false);
        }
      }
    }, 1000); // Poll every 1 second
  };

  // Request and execute a chain-abstracted swap
  const handleSwap = async () => {
    if (!accountAddress || !embeddedWallet) {
      setError('Wallet not connected or OneBalance account not set up');
      return;
    }

    setLoading(true);
    setSwapping(true);
    setError(null);
    setSuccess(false);

    try {
      // Use already fetched quote if available
      let quoteResponse = quote;
      
      // If no quote available or it's stale, fetch a new one
      if (!quoteResponse) {
        // Convert to smallest unit based on direction
        const amount = swapDirection === 'USDC_TO_ETH'
          ? (parseFloat(swapAmount) * 1_000_000).toString() // USDC -> ETH (6 decimals)
          : (parseFloat(swapAmount) * 1e18).toString();     // ETH -> USDC (18 decimals)
        
        const quoteRequest = {
          from: {
            account: {
              sessionAddress: embeddedWallet.address,
              adminAddress: embeddedWallet.address,
              accountAddress: accountAddress,
            },
            asset: {
              assetId: swapDirection === 'USDC_TO_ETH' ? 'ob:usdc' : 'ob:eth',
            },
            amount,
          },
          to: {
            asset: {
              assetId: swapDirection === 'USDC_TO_ETH' ? 'ob:eth' : 'ob:usdc',
            },
          },
        };

        quoteResponse = await getQuote(quoteRequest);
        setQuote(quoteResponse);
      }
      
      if (!quoteResponse) {
        throw new Error('Failed to get a quote for the swap');
      }
      
      // Step 2: Sign the quote
      const signedQuote = await signQuote(quoteResponse, embeddedWallet);

      // Step 3: Execute the quote
      setLoading(true);
      const executionResponse = await executeQuote(signedQuote);

      // Step 4: Start polling for transaction status
      startStatusPolling(quoteResponse.id);
      setSuccess(true);
      setLoading(false);
    } catch (err: any) {
      console.error('Error in swap process:', err);
      setError(err.message || 'Failed to complete swap');
      setLoading(false);
    } finally {
      setSwapping(false);
    }
  };

  if (!ready || !authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFAB40]"></div>
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center text-black p-4 md:p-24">
      <div className="max-w-lg w-full bg-white p-8 rounded-xl shadow-md">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">OneBalance Dashboard</h1>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Logout
          </button>
        </div>

        <div className="mb-6">
          <div className="text-sm text-gray-500 mb-1">Connected as</div>
          <div className="font-medium truncate">
            {user?.email?.address || embeddedWallet?.address || 'Anonymous'}
          </div>
        </div>

        {/* Account Info Section */}
        <div className="bg-gray-50 p-6 rounded-lg mb-6">
          <h2 className="text-xl font-semibold mb-4">Account Information</h2>
          
          <div className="space-y-3">
            <div>
              <div className="text-gray-500 text-sm mb-1">OneBalance Smart Account</div>
              <div className="font-semibold text-sm break-all">
                {accountAddress || <div className="animate-pulse bg-gray-200 h-4 w-12 rounded"></div>}
              </div>
            </div>
            
            <div className="flex flex-row space-x-4">
              <div className="flex-1">
                <div className="text-gray-500 text-sm mb-1">USDC Balance</div>
                <div className="font-medium text-xl mb-1">
                  {usdcBalance ? `${usdcBalance} USDC` : <div className="animate-pulse bg-gray-200 h-4 w-12 rounded"></div>}
                </div>
                <div className="text-xs text-gray-500 flex items-center cursor-pointer" 
                     onClick={() => setShowUsdcChainDetails(!showUsdcChainDetails)}>
                  {showUsdcChainDetails ? "Hide chain details" : "Show chain details"} 
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ml-1 transition-transform ${showUsdcChainDetails ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                {showUsdcChainDetails && (
                  <div className="mt-2 space-y-1 text-xs">
                    {usdcChainBalances.length > 0 ? (
                      usdcChainBalances.map((chainBalance, idx) => (
                        <div key={`usdc-${idx}`} className="flex justify-between border-b border-gray-100 pb-1">
                          <span>{getChainName(chainBalance.chainId)}</span>
                          <span>{chainBalance.balance} USDC</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-gray-400">No chain data available</div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="flex-1">
                <div className="text-gray-500 text-sm mb-1">ETH Balance</div>
                <div className="font-medium text-xl mb-1">
                  {ethBalance ? `${ethBalance} ETH` : <div className="animate-pulse bg-gray-200 h-4 w-12 rounded"></div>}
                </div>
                <div className="text-xs text-gray-500 flex items-center cursor-pointer"
                     onClick={() => setShowEthChainDetails(!showEthChainDetails)}>
                  {showEthChainDetails ? "Hide chain details" : "Show chain details"}
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ml-1 transition-transform ${showEthChainDetails ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                {showEthChainDetails && (
                  <div className="mt-2 space-y-1 text-xs">
                    {ethChainBalances.length > 0 ? (
                      ethChainBalances.map((chainBalance, idx) => (
                        <div key={`eth-${idx}`} className="flex justify-between border-b border-gray-100 pb-1">
                          <span>{getChainName(chainBalance.chainId)}</span>
                          <span>{chainBalance.balance} ETH</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-gray-400">No chain data available</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-6 rounded-lg mb-6">
          <h2 className="text-xl font-semibold mb-4">Chain-Abstracted Swap</h2>
          <div className="flex items-center justify-between mb-4">
            <div className="text-center p-3 bg-white rounded-md shadow-sm w-5/12">
              <div className="text-gray-500 text-sm mb-1">From</div>
              <div className="font-medium">
                <input 
                  type="text" 
                  value={swapAmount}
                  onChange={handleSwapAmountChange}
                  className="w-20 text-center border-b border-gray-300 focus:outline-none focus:border-[#FFAB40]"
                /> {swapDirection === 'USDC_TO_ETH' ? 'USDC' : 'ETH'}
              </div>
              <div className="text-xs text-gray-400">on any chain</div>
            </div>

            <div 
              className="text-[#FFAB40] cursor-pointer hover:text-[#FF9800] hover:scale-125 transition-all duration-200"
              onClick={toggleSwapDirection}
              title="Reverse swap direction"
            >
              ↔
            </div>

            <div className="text-center p-3 bg-white rounded-md shadow-sm w-5/12">
              <div className="text-gray-500 text-sm mb-1">To</div>
              <div className="font-medium">
                {fetchingQuote ? (
                  <div className="inline-block w-12 h-4">
                    <div className="animate-pulse bg-gray-200 h-4 w-12 rounded"></div>
                  </div>
                ) : estimatedAmount ? (
                  `${estimatedAmount} ${swapDirection === 'USDC_TO_ETH' ? 'ETH' : 'USDC'}`
                ) : (
                  swapDirection === 'USDC_TO_ETH' ? 'ETH' : 'USDC'
                )}
              </div>
              <div className="text-xs text-gray-400">on any chain</div>
            </div>
          </div>

          <button
            onClick={handleSwap}
            disabled={loading || !accountAddress || parseFloat(swapAmount) <= 0}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
              loading || parseFloat(swapAmount) <= 0
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-[#FFAB40] text-white hover:bg-[#FF9800]'
            }`}
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                {swapping ? 'Swapping...' : 'Processing...'}
              </div>
            ) : (
              'Swap Now'
            )}
          </button>

          <div className="mt-3 text-xs text-gray-500 text-center">
            No gas tokens needed - pay fees with your {swapDirection === 'USDC_TO_ETH' ? 'USDC' : 'ETH'} balance!
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg">
            <p className="font-medium">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-lg">
            <p className="font-medium">Success!</p>
            <p className="text-sm">
              Your chain-abstracted swap has been initiated.
              {isPolling && ' Monitoring transaction status...'}
            </p>
          </div>
        )}

        {status && (
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold mb-3">Transaction Status</h3>
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Status:</span>
                <span className={`font-medium ${
                  status.status === 'COMPLETED' ? 'text-green-600' : 
                  status.status === 'FAILED' ? 'text-red-600' : 'text-yellow-600'
                }`}>
                  {status.status || 'Pending'}
                </span>
              </div>
              {status.originChainOperations?.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Origin Chain:</span>
                  <a
                    href={status.originChainOperations[0].explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline truncate ml-2 max-w-[200px]"
                  >
                    View Transaction
                  </a>
                </div>
              )}
              {status.destinationChainOperations?.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Destination Chain:</span>
                  <a
                    href={status.destinationChainOperations[0].explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline truncate ml-2 max-w-[200px]"
                  >
                    View Transaction
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}