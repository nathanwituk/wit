'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';

export default function Setup2FA() {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/generate-totp')
      .then(r => r.json())
      .then(async ({ secret, otpauth }) => {
        setSecret(secret);
        const qr = await QRCode.toDataURL(otpauth);
        setQrDataUrl(qr);
      });
  }, []);

  async function verify() {
    setError('');
    const res = await fetch('/api/auth/verify-totp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (res.ok) {
      // Save secret to .env.local via a setup endpoint (dev only)
      await fetch('/api/auth/save-totp-secret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret }),
      });
      router.push('/dashboard');
    } else {
      setError('Invalid code — try again');
    }
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-6">
      <div className="flex flex-col items-center gap-6 max-w-sm w-full">
        <div className="text-center">
          <h1 className="text-white text-2xl font-semibold tracking-tight mb-2">Set up 2FA</h1>
          <p className="text-[#555] text-sm">Scan this QR code with your iOS Passwords app or any authenticator.</p>
        </div>

        {qrDataUrl && (
          <div className="bg-white p-4 rounded-2xl">
            <img src={qrDataUrl} alt="QR Code" className="w-48 h-48" />
          </div>
        )}

        {secret && (
          <p className="text-[#444] text-xs text-center font-mono break-all">
            Manual key: {secret}
          </p>
        )}

        <div className="w-full flex flex-col gap-3">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="Enter 6-digit code"
            value={token}
            onChange={e => setToken(e.target.value)}
            className="w-full bg-[#1a1a1a] text-white rounded-xl py-4 px-5 text-center text-xl tracking-widest placeholder:text-[#444] outline-none border border-[#2a2a2a] focus:border-[#555]"
          />
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button
            onClick={verify}
            disabled={token.length !== 6}
            className="w-full bg-white text-[#0a0a0a] rounded-xl py-4 font-medium disabled:opacity-30 hover:bg-[#f0f0f0] transition-colors cursor-pointer"
          >
            Verify & Enter Wit
          </button>
        </div>
      </div>
    </main>
  );
}
