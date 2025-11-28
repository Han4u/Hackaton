"use client";

import { useState } from "react";
import Image from 'next/image';

type Meta = {
  name: string;
  description: string;
  image: string;
  attributes: Array<{ trait_type: string; value: string }>;
};

export default function VerifyClient({ list, initialOwner }: { list: Meta[]; initialOwner?: string }) {
  const [owner, setOwner] = useState(initialOwner ?? "");
  const [tokenId, setTokenId] = useState<string>("");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const verify = async (id?: string) => {
    const tid = id ?? tokenId;
    if (!tid) return setResult("Masukkan Token ID terlebih dahulu");

    setLoading(true);
    setResult(null);
    try {
      const url = new URL('/api/verify', window.location.origin);
      url.searchParams.set('tokenId', String(tid));
      if (owner) url.searchParams.set('owner', owner);

      const res = await fetch(url.toString());
      const json = await res.json();
      if (!res.ok) {
        setResult(json?.error || 'Verifikasi gagal');
      } else {
        if (json.verified === false) {
          setResult(`Token #${tid} ada — Owner on-chain: ${json.onChainOwner} — Tidak cocok dengan alamat yang dimasukkan.`);
        } else if (json.verified === true) {
          setResult(`✅ Terverifikasi — Token #${tid} dimiliki oleh ${json.onChainOwner}`);
        } else {
          setResult(`Info: owner on-chain ${json.onChainOwner}`);
        }
      }
    } catch (err) {
      setResult(`Error: ${String(err)}`);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Alamat pemilik (optional)" className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-200" />
        <input value={tokenId} onChange={(e) => setTokenId(e.target.value)} placeholder="Token ID" className="w-36 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-200" />
        <button disabled={loading} onClick={() => verify()} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-bold">{loading ? 'Checking...' : 'Verify'}</button>
      </div>

      <div>
        <h3 className="text-sm font-bold text-slate-300 mb-2">Available certificates</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {list.map((meta) => {
            const attr = meta.attributes?.find((a) => a.trait_type === 'Token ID');
            const tid = attr?.value ?? 'unknown';
            const image = meta.image?.startsWith('ipfs://') ? meta.image.replace(/^ipfs:\/\/(ipfs\/)?/, 'https://cloudflare-ipfs.com/ipfs/') : meta.image;
            return (
              <div key={tid} className="p-3 rounded-lg bg-[#0f1524] border border-slate-800">
                <div className="mb-2 text-xs text-slate-400">#{tid}</div>
                <div className="h-28 rounded-md bg-black border border-slate-700 overflow-hidden flex items-center justify-center mb-3">
                  {image ? (
                    <Image src={image} alt={meta.name} unoptimized width={360} height={220} className="max-h-full object-contain" />
                  ) : (
                    <div className="text-xs text-slate-500">no image</div>
                  )}
                </div>
                <div className="text-sm text-slate-200 font-bold mb-1">{meta.name}</div>
                <div className="text-xs text-slate-400 mb-2 line-clamp-3">{meta.description}</div>
                <div className="flex gap-2">
                  <button onClick={() => { setTokenId(String(tid)); verify(String(tid)); }} className="text-xs px-2 py-1 rounded bg-slate-800 border border-slate-700">Verify</button>
                  <a href={`https://sepolia.etherscan.io/token/0x2445C0C2Cd556AAf622f6f1b7AE2Bad7Af0923D8?a=${tid}`} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 rounded border border-slate-700">Etherscan</a>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        {result && <div className="p-3 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-200">{result}</div>}
      </div>
    </div>
  );
}
