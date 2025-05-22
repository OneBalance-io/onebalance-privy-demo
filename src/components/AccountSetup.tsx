// Example usage in a component
'use client';

import { useEffect, useState } from 'react';
import { useWallets } from '@privy-io/react-auth';
import { predictAccountAddress } from '@/lib/onebalance';

export function AccountSetup() {
  const { wallets } = useWallets();
  const [accountAddress, setAccountAddress] = useState<string | null>(null);

  // Find the Privy-managed embedded wallet
  const embeddedWallet = wallets.find(wallet => wallet.walletClientType === 'privy');

  useEffect(() => {
    async function setupAccount() {
      if (embeddedWallet && embeddedWallet.address) {
        try {
          // Using the same address as both session and admin for simplicity
          const predictedAddress = await predictAccountAddress(
            embeddedWallet.address,
            embeddedWallet.address
          );
          setAccountAddress(predictedAddress);
          console.log(`Smart Contract Account Address: ${predictedAddress}`);
        } catch (err) {
          console.error('Error setting up account:', err);
        }
      }
    }

    setupAccount();
  }, [embeddedWallet]);

  return (
    <div>
      {accountAddress ? (
        <p>Your OneBalance Smart Account: {accountAddress}</p>
      ) : (
        <p>Loading account address...</p>
      )}
    </div>
  );
}