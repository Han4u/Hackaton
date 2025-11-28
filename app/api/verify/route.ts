import { NextResponse } from 'next/server';
import abi from '../../abi.json';
import { ethers } from 'ethers';

// This route uses the `ethers` library which requires the Node runtime.
export const runtime = 'nodejs';

const RPC = 'https://sepolia.publicgoods.network';
const CONTRACT_ADDRESS = '0x2445C0C2Cd556AAf622f6f1b7AE2Bad7Af0923D8';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tokenId = searchParams.get('tokenId');
    const ownerParam = searchParams.get('owner');

    if (!tokenId) {
      return NextResponse.json({ error: 'Missing tokenId param' }, { status: 400 });
    }

    // basic validation: tokenId should be numeric
    if (!/^[0-9]+$/.test(tokenId)) {
      return NextResponse.json({ error: 'tokenId must be a non-negative integer' }, { status: 400 });
    }

    // Provide the Sepolia chain id so provider won't attempt automatic network detection
    // which can produce repeated "failed to detect network" logs if the node can't be reached.
    const provider = new ethers.JsonRpcProvider(RPC, 11155111);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contract = new ethers.Contract(CONTRACT_ADDRESS, abi as any, provider);

    let onChainOwner: string | null = null;
    try {
      // ownerOf expects an integer (BigNumberish) — convert to Number safely
      const tid = Number(tokenId);
      const w = await contract.ownerOf(tid);
      onChainOwner = String(w);
    } catch {
      // token probably doesn't exist or call reverted — return null
      onChainOwner = null;
    }

    // result structure
    const verified = ownerParam && onChainOwner ? String(ownerParam).toLowerCase() === String(onChainOwner).toLowerCase() : undefined;

    return NextResponse.json({ tokenId, onChainOwner, verified });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
