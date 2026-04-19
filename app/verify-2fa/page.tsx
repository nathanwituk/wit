'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Verify2FA() {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  async function verify() {
    setError('');
    const res = await fetch('/api/auth/verify-totp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (res.ok) {
      router.push('/dashboard');
    } else {
      setError('Invalid code — try again');
      setToken('');
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setToken(val);
    if (val.length === 6) {
      // Auto-submit when 6 digits entered (iOS autofill triggers this)
      setTimeout(() => {
        fetch('/api/auth/verify-totp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: val }),
        }).then(res => {
          if (res.ok) router.push('/dashboard');
          else setError('Invalid code — try again');
        });
      }, 100);
    }
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-6">
      <div className="flex flex-col items-center gap-6 max-w-sm w-full">

        <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center">
          <span className="text-[#0a0a0a] font-bold text-xl tracking-tight">W</span>
        </div>

        <div className="text-center">
          <h1 className="text-white text-2xl font-semibold tracking-tight mb-2">Two-factor auth</h1>
          <p className="text-[#555] text-sm">Enter the 6-digit code from your Passwords app.</p>
        </div>

        <div className="w-full flex flex-col gap-3">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            value={token}
            onChange={handleChange}
            autoFocus
            className="w-full bg-[#1a1a1a] text-white rounded-xl py-4 px-5 text-center text-2xl tracking-widest placeholder:text-[#333] outline-none border border-[#2a2a2a] focus:border-[#444]"
          />
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button
            onClick={verify}
            disabled={token.length !== 6}
            className="w-full bg-white text-[#0a0a0a] rounded-xl py-4 font-medium disabled:opacity-30 hover:bg-[#f0f0f0] transition-colors cursor-pointer"
          >
            Enter Wit
          </button>
        </div>
      </div>
    </main>
  );
}
