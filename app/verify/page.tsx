import fs from 'fs/promises';
import path from 'path';
import VerifyClient from './VerifyClient';
// prevent prerendering during build — the page reads local files and uses client-side interactions
export const dynamic = 'force-dynamic';
import Link from 'next/link';

type Meta = {
  name: string;
  description: string;
  image: string;
  attributes: Array<{ trait_type: string; value: string }>;
};

export default async function VerifyPage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
  // certiblock_metadata sits next to `my-app` in the repository root
  const metaDir = path.join(process.cwd(), '..', 'certiblock_metadata');
  let files: string[] = [];
  try {
    files = await fs.readdir(metaDir);
  } catch {
    files = [];
  }

  const list: Meta[] = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    try {
      const raw = await fs.readFile(path.join(metaDir, f), 'utf-8');
      list.push(JSON.parse(raw));
    } catch {
      // ignore malformed
    }
  }

  // allow pre-filling owner address from query param `owner`
  const owner = typeof searchParams?.owner === 'string' ? searchParams.owner : undefined;

  return (
    <main className="min-h-screen bg-[#050511] text-white font-sans selection:bg-purple-500 selection:text-white">
      <div className="max-w-5xl mx-auto pt-24 px-6 pb-20">
        <div className="flex justify-between items-center mb-10">
          <div>
            <div className="flex items-center gap-4">
              <Link href="/" className="px-3 py-1 rounded-md border border-slate-700 bg-slate-800 text-sm hover:bg-slate-700">← Back to Dashboard</Link>
              <h1 className="text-3xl font-bold text-white">Certificate Verification</h1>
            </div>
            <p className="text-slate-400 text-sm">Gunakan halaman ini untuk memeriksa metadata sertifikat dan memastikan kepemilikan di Sepolia.</p>
          </div>

          <div className="text-xs text-slate-400">Quick check from local metadata + on-chain owner</div>
        </div>

        <div className="bg-[#0f1524] border border-slate-800 rounded-xl p-6">
          <VerifyClient list={list} initialOwner={owner} />
        </div>
      </div>
    </main>
  );
}
