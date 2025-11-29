"use client";

import { useState, useEffect } from "react";
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
    <div className="space-y-6">
      {/* Top controls: stacked on mobile, horizontal on larger screens */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch">
        <input
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          placeholder="Alamat pemilik (optional)"
          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-200"
        />

        <div className="flex gap-3 items-center sm:items-stretch w-full sm:w-auto">
          <input
            value={tokenId}
            onChange={(e) => setTokenId(e.target.value)}
            placeholder="Token ID"
            className="w-full sm:w-36 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-200"
          />
          <button
            disabled={loading}
            onClick={() => verify()}
            className="w-full sm:w-auto px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-bold"
          >
            {loading ? 'Checking...' : 'Verify'}
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-slate-300 mb-2">Available certificates</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {list.map((meta) => {
            const attr = meta.attributes?.find((a) => a.trait_type === 'Token ID');
            const tid = attr?.value ?? 'unknown';
            // Pass the raw image string to the card and let it try multiple gateways.
            const imageRaw = meta.image ?? '';

            // render each card as a small component so we can keep per-card state
            return <CertificateCard key={tid} meta={meta} tid={String(tid)} imageRaw={imageRaw} verify={verify} setTokenId={setTokenId} />;
          })}
        </div>
      </div>

      <div>
        {result && <div className="p-3 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-200">{result}</div>}
      </div>
    </div>
  );
}

function CertificateCard({ meta, imageRaw, tid, verify, setTokenId }: { meta: Meta; imageRaw: string; tid: string; verify: (id?: string) => Promise<void>; setTokenId: (v: string) => void }) {
  const [imageError, setImageError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);

  const openInIpfs = () => {
    // open the currently chosen source (best-effort), otherwise build a cloudflare URL
    const fallbackBase = 'https://cloudflare-ipfs.com/ipfs/';
    let openUrl = currentSrc ?? '';
    if (!openUrl) {
      if (!imageRaw) return alert('No image URL available');
      openUrl = imageRaw.startsWith('ipfs://') ? imageRaw.replace(/^ipfs:\/\/(ipfs\/)?/, fallbackBase) : imageRaw;
    }
    if (typeof window !== 'undefined') window.open(openUrl, '_blank');
  };

  useEffect(() => {
    if (!imageRaw) return;

    // prepare gateways from env or defaults
    const env = typeof process !== 'undefined' ? (process.env.NEXT_PUBLIC_IPFS_GATEWAYS ?? '') : '';
    // prefer Pinata gateway first because you pinned the file there — it's more likely to respond
    const defaultGateways = ['https://gateway.pinata.cloud/ipfs/', 'https://cloudflare-ipfs.com/ipfs/', 'https://ipfs.io/ipfs/'];
    const gateways = env ? env.split(',').map(g => g.trim()).filter(Boolean) : defaultGateways;

    // helper: attempt to load an image using an <img> element to detect success
    const loadImageViaTag = (src: string) => new Promise<boolean>((resolve) => {
      // Use document.createElement('img') to avoid constructor signature issues in some TS configs
      const i = typeof document !== 'undefined' ? document.createElement('img') : null;
      if (!i) return resolve(false);
      i.onload = () => resolve(true);
      i.onerror = () => resolve(false);
      i.src = src;
    });

    const tryAll = async () => {
      // reset per-attempt state here (do not call synchronously at effect start)
      setImageError(false);
      setCurrentSrc(null);
      setLoadingImage(true);
      // if imageRaw is http(s), try that first
      if (/^https?:\/\//i.test(imageRaw)) {
        console.debug('[IPFS DEBUG] trying direct http(s) image URL', imageRaw);
        const ok = await loadImageViaTag(imageRaw);
        console.debug('[IPFS DEBUG] direct http(s) url result ->', ok, imageRaw);
        if (ok) {
          setCurrentSrc(imageRaw);
          setLoadingImage(false);
          return;
        }
      }

      // Pull the path after ipfs:// or /ipfs/
      let clean = imageRaw;
      if (clean.startsWith('ipfs://')) clean = clean.replace(/^ipfs:\/\/(ipfs\/)?/, '');
      const maybeCidPath = clean.split('/');
      const cid = maybeCidPath.shift();
      const rest = maybeCidPath.join('/');

      if (!cid) {
        setLoadingImage(false);
        setImageError(true);
        return;
      }

      for (const g of gateways) {
        const root = g.endsWith('/') ? `${g}${cid}` : `${g}/${cid}`;
        console.debug('[IPFS DEBUG] probing gateway root', root);
        const okRoot = await loadImageViaTag(root);
        console.debug('[IPFS DEBUG] gateway probe result ->', okRoot, root);
        if (okRoot) {
          setCurrentSrc(root);
          setLoadingImage(false);
          return;
        }

        if (rest) {
          const withRest = g.endsWith('/') ? `${g}${cid}/${rest}` : `${g}/${cid}/${rest}`;
          console.debug('[IPFS DEBUG] probing gateway with path', withRest);
          const ok = await loadImageViaTag(withRest);
          console.debug('[IPFS DEBUG] gateway probe result ->', ok, withRest);
          if (ok) {
            setCurrentSrc(withRest);
            setLoadingImage(false);
            return;
          }
        }
      }

      setLoadingImage(false);
      setImageError(true);
    };

    tryAll();
  }, [imageRaw]);

  // expose small visual debug when ?debug=1 is present to inspect tries on mobile
  const isDebugUI = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1';

  return (
    <div className="p-3 rounded-lg bg-[#0f1524] border border-slate-800 shadow-sm">
      <div className="mb-2 text-xs text-slate-400 flex justify-between items-center">
        <div>#{tid}</div>
        <div className="text-xs text-slate-500">CertiBlock</div>
      </div>

      <div className="h-36 sm:h-28 rounded-md bg-black border border-slate-700 overflow-hidden flex items-center justify-center mb-3">
        {!imageRaw ? (
          <div className="text-xs text-slate-500">no image</div>
        ) : imageError ? (
          <div className="flex flex-col items-center gap-2 px-4">
            <div className="text-xs text-slate-500">Gagal memuat gambar.</div>
            <button onClick={openInIpfs} className="px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs">Buka di IPFS</button>
            {isDebugUI && (
              <div className="mt-2 text-xs text-slate-400">DEBUG: periksa console (devtools) untuk hasil gateway probe</div>
            )}
          </div>
        ) : (
          (loadingImage && !currentSrc) ? (
            <div className="text-xs text-slate-500">Loading image…</div>
          ) : (
            <Image src={currentSrc ?? imageRaw} alt={meta.name} unoptimized width={360} height={220} className="max-h-full object-contain" onError={() => setImageError(true)} />
          )
        )}
      </div>

      <div className="text-sm text-slate-200 font-extrabold mb-1 leading-tight">{meta.name}</div>
      <div className="text-xs text-slate-400 mb-2 line-clamp-3">{meta.description}</div>

      <div className="flex gap-2">
        <button onClick={() => { setTokenId(String(tid)); verify(String(tid)); }} className="flex-1 text-xs px-2 py-2 rounded bg-blue-600 hover:bg-blue-500 border border-blue-700 text-white text-center">Verify</button>
        <a href={`https://gateway.pinata.cloud/ipfs/${(imageRaw || '').replace(/^ipfs:\/\/(ipfs\/)?/, '')}`} target="_blank" rel="noreferrer" className="flex-1 text-xs px-2 py-2 rounded border border-slate-700 text-center">IPFS (Pinata)</a>
      </div>
    </div>
  );
}
