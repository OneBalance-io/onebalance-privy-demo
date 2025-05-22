// src/app/page.tsx
'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const { login, ready, authenticated } = usePrivy();
  const router = useRouter();

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (ready && authenticated) {
      router.push('/dashboard');
    }
  }, [ready, authenticated, router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-md text-center text-black">
        <h1 className="text-3xl font-bold mb-6">OneBalance Demo</h1>
        <p className="mb-6 text-gray-600">
          Experience seamless chain-abstracted transactions with OneBalance and Privy
        </p>

        <button
          onClick={login}
          className="w-full py-3 px-4 bg-[#FFAB40] text-white rounded-lg font-medium hover:bg-[#FF9800] transition-all"
        >
          Login with Privy
        </button>

        <p className="mt-4 text-xs text-gray-500">
          Login with email, social, or connect your wallet to get started
        </p>
      </div>
    </main>
  );
}