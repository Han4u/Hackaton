"use client";
import { useState } from "react";
import { ethers } from "ethers";
import { motion } from "framer-motion"; // Diperlukan jika menggunakan motion
import { useSearchParams } from 'next/navigation';
import Link from "next/link"; // 🔥 IMPORT BARU: Untuk navigasi
import contractABI from "../abi.json"; 

// Ganti dengan alamat kontrak kamu yang sudah di-deploy
const CONTRACT_ADDRESS = "0x2445C0C2Cd556AAf622f6f1b7AE2Bad7Af0923D8"; 
const ETHERSCAN_URL = "https://sepolia.etherscan.io/address/";

// Interface untuk metadata NFT yang akan kita ambil
interface NftMetadata {
    name: string;
    description: string;
    image: string;
    attributes: Array<{ trait_type: string, value: string }>;
}

export default function VerifyPage() {
    const searchParams = useSearchParams();
    const ownerFromQuery = searchParams?.get('owner') ?? "";
    const [tokenId, setTokenId] = useState("");
    const [ownerAddress, setOwnerAddress] = useState("");
    const [nftMetadata, setNftMetadata] = useState<NftMetadata | null>(null); // State baru
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const verifyCertificate = async () => {
        setError("");
        setOwnerAddress("");
        setNftMetadata(null); // Reset metadata
        setIsLoading(true);

        try {
            // Gunakan Public RPC Provider untuk membaca data (read-only)
            const provider = new ethers.JsonRpcProvider("https://sepolia.publicgoods.network"); 
            const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, provider);

            // --- 1. CEK KEPEMILIKAN DARI KONTRAK (ownerOf) ---
            const owner = await contract.ownerOf(tokenId);
            setOwnerAddress(owner);

            // --- 2. AMBIL URI METADATA (tokenURI) ---
            const tokenURI = await contract.tokenURI(tokenId);
            
            // 🔥 PERBAIKAN: Mengganti 'let' menjadi 'const'
            // Ubah URI IPFS menjadi URI HTTP (menggunakan gateway publik)
            // Asumsi: URI IPFS kamu berbentuk ipfs://Qm...
            const httpUri = tokenURI.replace("ipfs://", "https://cloudflare-ipfs.com/ipfs/"); 

            // --- 3. AMBIL DATA JSON METADATA ---
            const metadataResponse = await fetch(httpUri);
            
            if (!metadataResponse.ok) {
                 throw new Error(`Gagal mengambil metadata: ${metadataResponse.statusText}`);
            }

            const metadata: NftMetadata = await metadataResponse.json();
            setNftMetadata(metadata);

        } catch (error: unknown) { 
            console.error("Verifikasi Gagal:", error);
            
            // Penanganan Error Khusus untuk ERC721
            if (error instanceof Error) {
                // Ethers.js sering membungkus error revert dari kontrak
                if (error.message.includes("ERC721: owner query for nonexistent token")) {
                    setError(`Sertifikat ID #${tokenId} tidak ditemukan atau belum di-mint.`);
                } else if (error.message.includes("could not resolve ENS name")) {
                    setError("Gagal koneksi ke Sepolia RPC. Coba lagi.");
                } else {
                    setError(`Verifikasi gagal: ${error.message}`);
                }
            } else {
                setError("Terjadi kesalahan tak terduga.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#050511] text-white p-8 font-sans">
            <div className="max-w-2xl mx-auto pt-20 pb-10 text-center">
                
                {/* Header Navigasi */}
                {/* 🔥 PERBAIKAN: Menggunakan Link dari next/link */}
                <Link 
                    href="/" 
                    className="mb-6 text-slate-500 hover:text-white text-sm flex items-center gap-2 justify-center"
                >
                    ← Kembali ke Dashboard
                </Link>

                <h2 className="text-4xl font-extrabold text-blue-400 mb-2">Verifikasi CertiBlock</h2>
                {ownerFromQuery && (
                    <div className="text-sm text-slate-400 mb-4">
                        <strong className="text-slate-300">Terdeteksi alamat login:</strong>
                        <div className="font-mono text-xs text-green-300 break-all mt-1">{ownerFromQuery}</div>
                    </div>
                )}
                <p className="text-slate-400 mb-8">Masukkan Token ID (Nomor Sertifikat) untuk membuktikan keasliannya di Blockchain.</p>

                <input
                    type="number"
                    value={tokenId}
                    onChange={(e) => setTokenId(e.target.value)}
                    placeholder="Masukkan Token ID Sertifikat (Misal: 0, 1, 2)"
                    className="w-full p-3 mb-4 rounded-lg bg-slate-800 border border-slate-700 text-white focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
                
                <button
                    onClick={verifyCertificate}
                    disabled={isLoading || !tokenId}
                    className="w-full py-3 bg-green-600 hover:bg-green-500 rounded-lg font-bold text-white transition-all disabled:opacity-50 shadow-lg"
                >
                    {isLoading ? "Memverifikasi..." : "Verifikasi di Blockchain"}
                </button>

                {/* TAMPILAN HASIL VERIFIKASI */}
                {ownerAddress && nftMetadata && (
                    <motion.div 
                        initial={{ scale: 0.9, opacity: 0 }} 
                        animate={{ scale: 1, opacity: 1 }} 
                        className="mt-8 p-6 bg-[#0f1524] rounded-xl text-left border border-green-500/50 shadow-xl"
                    >
                        <h3 className="text-xl font-bold text-green-400 mb-4">✅ Sertifikat Ditemukan & Terverifikasi!</h3>
                        
                        {/* GAMBAR SERTIFIKAT */}
                        {nftMetadata.image && (
                            <img 
                                // Ganti ipfs:// menjadi URL HTTP untuk tampilan
                                src={nftMetadata.image.replace("ipfs://", "https://cloudflare-ipfs.com/ipfs/")} 
                                alt={nftMetadata.name} 
                                className="w-full max-w-sm h-auto rounded-lg mx-auto mb-4 border border-slate-700 shadow-md"
                            />
                        )}
                        
                        <h4 className="2xl font-bold text-white mb-2">{nftMetadata.name}</h4>
                        
                        <p className="font-mono text-sm break-all mt-1 p-2 bg-slate-700/50 rounded">
                             <strong className="text-slate-400">ID #{tokenId} </strong>
                        </p>
                        
                        {/* DATA ATRIBUT DAN KEPEMILIKAN */}
                        <div className="mt-4 border-t border-slate-700 pt-3">
                            <p className="text-sm text-slate-300 mb-2">
                                <strong className="text-slate-100">Pemilik Sah (Wallet):</strong>
                            </p>
                            <p className="font-mono text-xs break-all text-green-400 mb-3">{ownerAddress}</p>

                            {/* TAMPILKAN ATRIBUT NFT */}
                            {nftMetadata.attributes.map((attr, index: number) => (
                                <p key={index} className="text-sm text-slate-500">
                                    <strong className="text-slate-300">{attr.trait_type}:</strong> {attr.value}
                                </p>
                            ))}
                        </div>
                        
                        <a href={`${ETHERSCAN_URL}token/${CONTRACT_ADDRESS}?a=${tokenId}`} target="_blank" className="text-blue-500 text-xs mt-3 block hover:underline">
                            Lihat Token di Etherscan →
                        </a>
                    </motion.div>
                )}
                
                {error && <p className="mt-4 p-3 bg-red-900/30 rounded text-red-400 font-bold">{error}</p>}

            </div>
        </div>
    );
}