"use client";

import { useState, useEffect } from "react";
import Image from 'next/image';
import { ethers } from "ethers";
import { motion } from "framer-motion";
import contractABI from "./abi.json"; 
import Link from "next/link"; 

// --- 1. DEFINISI TIPE DATA ---
interface Question {
  q: string;
  opts: string[];
  a: number; 
}

interface Course {
  id: number;
  title: string;
  description: string;
  color: string;
  icon: string;
  tags: string[];
  // relative file name for thumbnail stored in /public
  thumbnail?: string;
  // optional video URL (mp4 or other) shown when user opens the course before quiz
  video?: string;
  questions: Question[];
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ethereum: any;
  }
}

// 🔥 ALAMAT KONTRAK BARU (HARUS SAMA DENGAN VERIFY/PAGE.TSX)
const CONTRACT_ADDRESS = "0x2445C0C2Cd556AAf622f6f1b7AE2Bad7Af0923D8"; 
const SEPOLIA_CHAIN_ID = "0xaa36a7";

export default function Home() {
  const [walletAddress, setWalletAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState("");
  // State baru untuk loading saat login
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isMobileDetected, setIsMobileDetected] = useState(false);
  const [hasProvider, setHasProvider] = useState(false);
  
  const [viewState, setViewState] = useState<"landing" | "dashboard" | "learning" | "quiz" | "success">("landing");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [isVideoWatched, setIsVideoWatched] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [mintedTokenId, setMintedTokenId] = useState<number | null>(null);
  const [certImageUrl, setCertImageUrl] = useState<string | null>(null);
  const [mintedTokenURI, setMintedTokenURI] = useState<string | null>(null);

  // --- DATA KURSUS ---
  const courses: Course[] = [
    {
      id: 1,
      title: "Blockchain Foundation",
      description: "Pelajari dasar teknologi rantai blok & desentralisasi.",
      color: "bg-orange-500", 
      icon: "⛓️",
      thumbnail: "course-blockchain.svg",
      video: "https://www.youtube.com/watch?v=pVGGOn_ntdg",
      tags: ["THEORY", "BEGINNER"],
      questions: [
        { q: "Apa sifat utama data di Blockchain?", opts: ["Bisa diedit", "Abadi (Immutable)", "Rahasia"], a: 1 },
        { q: "Siapa penemu Bitcoin?", opts: ["Elon Musk", "Satoshi Nakamoto", "Vitalik Buterin"], a: 1 },
        { q: "Apa itu Desentralisasi?", opts: ["Tidak ada satu penguasa", "Diatur pemerintah", "Satu server pusat"], a: 0 }
      ]
    },
    {
      id: 2,
      title: "Smart Contract 101",
      description: "Membuat perjanjian otomatis tanpa perantara.",
      color: "bg-yellow-400",
      icon: "📜",
      thumbnail: "course-smart-contract.svg",
      video: "https://samplelib.com/lib/preview/mp4/sample-5s.mp4",
      tags: ["SOLIDITY", "INTERMEDIATE"],
      questions: [
        { q: "Bahasa pemrograman Smart Contract di Ethereum?", opts: ["Python", "Solidity", "Java"], a: 1 },
        { q: "Apa yang dibutuhkan untuk deploy kontrak?", opts: ["Gas Fee", "Izin Polisi", "Email"], a: 0 },
        { q: "Dimana kode kontrak disimpan?", opts: ["Di Laptop", "Di Blockchain", "Di Google Drive"], a: 1 }
      ]
    },
    {
      id: 3,
      title: "NFT & Metaverse",
      description: "Memahami aset digital unik dan kepemilikan virtual.",
      color: "bg-blue-500",
      icon: "🦄",
      thumbnail: "course-nft.svg",
      video: "https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
      tags: ["ART", "BEGINNER"],
      questions: [
        { q: "Kepanjangan NFT adalah?", opts: ["Non-Fungible Token", "New File Type", "No Fun Today"], a: 0 },
        { q: "Apa bedanya NFT dengan Bitcoin?", opts: ["Sama saja", "NFT itu unik, Bitcoin itu sama", "Bitcoin itu gambar"], a: 1 },
        { q: "Marketplace NFT terbesar adalah?", opts: ["Tokopedia", "OpenSea", "Facebook"], a: 1 }
      ]
    }
  ];

  // --- FUNGSI LOGIKA ---

  const checkNetwork = async () => {
    if (window.ethereum) {
      const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
      if (currentChainId !== SEPOLIA_CHAIN_ID) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: SEPOLIA_CHAIN_ID }],
          });
        } catch (error) {
          console.error(error);
        }
      }
    }
  };

  // --- 🔥 FUNGSI LOGIN DENGAN TANDA TANGAN (SIGNATURE) 🔥 ---
  const loginWithMetaMask = async () => {
    // Mobile browsers often don't inject window.ethereum unless the page
    // opens inside the MetaMask in-app browser. If the provider is missing on
    // mobile we give a better hint instead of asking the user to "install" MetaMask.
    const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(navigator.userAgent);

    if (typeof window.ethereum !== "undefined") {
      try {
        setIsLoggingIn(true);
        await checkNetwork(); // 1. Cek Jaringan dulu

        // Tambahkan jeda waktu singkat untuk sinkronisasi Metamask di HP
        await new Promise(resolve => setTimeout(resolve, 1000)); 

        const provider = new ethers.BrowserProvider(window.ethereum);
        
        // 2. Request Akses Akun
        const accounts = await provider.send("eth_requestAccounts", []);
        const account = accounts[0];

        // 3. SIAPKAN PESAN LOGIN
        const signer = await provider.getSigner();
        const message = `Selamat datang di CertiBlock!\n\nSilakan tekan konfirmasi pesan ini untuk verifikasi login.\n\nWallet: ${account}\nTimestamp: ${new Date().toLocaleString()}`;

        // 4. PAKSA USER TANDA TANGAN (POP-UP METAMASK MUNCUL)
        // Panggil alert untuk UX di HP sebelum sign
        alert("⚠️ PERHATIAN! sebelum lanjut anda harus login ke akun metamask anda dan tekan 'Sign' untuk masuk.");
        
        const signature = await signer.signMessage(message);

        // 5. JIKA TANDA TANGAN BERHASIL -> LOGIN
        if (signature) {
            setWalletAddress(account);
            setViewState("dashboard");
        }

      } catch (error) {
        console.error("Login Gagal:", error);
        alert("Login dibatalkan. Anda harus menekan 'Sign' untuk masuk.");
      } finally {
        setIsLoggingIn(false);
      }
    } else {
      if (isMobile) {
        // Tell user to open this site in the MetaMask mobile in-app browser
        // or provide a deep-link URL to open this URL inside the app automatically.
        // Give a clearer option for phone users
        if (confirm("MetaMask tidak terdeteksi di browser ini. Buka situs ini di aplikasi MetaMask (direkomendasikan) sekarang?")) {
          // if the app is running on localhost or an http:// URL, deep linking might fail because
          // the MetaMask app browser cannot reach localhost on your machine. Warn user first.
          const currentHref = typeof window !== 'undefined' ? window.location.href : '';
          const host = typeof window !== 'undefined' ? window.location.hostname : '';
          if (host.includes('localhost') || host === '127.0.0.1' || currentHref.startsWith('http://')) {
            if (!confirm('Perhatian: URL ini tampak berjalan di localhost atau menggunakan HTTP. MetaMask in-app browser mungkin tidak dapat mengakses URL ini.\n\nPilihan: (OK) Buka MetaMask lalu buka URL ini secara manual di browser internal, atau Batalkan dan deploy/ekspos URL ke jaringan publik (contoh: gunakan ngrok).\n\nLanjutkan untuk mencoba membuka MetaMask?')) {
              return;
            }
          }

          // navigate to deep-link which will open the MetaMask app and load this dapp in the internal browser
          // use the full encoded URL so the app opens to the exact page (not just host)
          const deepLinkFull = `https://metamask.app.link/dapp/${encodeURIComponent(currentHref)}`;
          window.location.href = deepLinkFull;
        }
      } else {
        alert("MetaMask tidak terdeteksi. Pastikan extension MetaMask sudah terpasang atau gunakan browser yang mendukung injection (e.g., MetaMask's browser).\nIf you are on mobile, open this site inside the MetaMask app browser or install the MetaMask mobile app.");
      }
    }
  };

  

  const startLearning = (course: Course) => {
    setSelectedCourse(course);
    setCurrentQuestion(0);
    setScore(0);
    setIsVideoWatched(false);
    setViewState("learning");
  };

  // Track whether the user is on mobile so we can present the MetaMask deep-link
  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      const mobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(navigator.userAgent);
      setIsMobileDetected(mobile);
      // check provider presence after first render
      setHasProvider(typeof window !== 'undefined' && typeof window.ethereum !== 'undefined');
    }
  }, []);

  const handleAnswer = (index: number) => {
    if (!selectedCourse) return;
    if (index === selectedCourse.questions[currentQuestion].a) {
      setScore(score + 1);
    }
    const nextQ = currentQuestion + 1;
    if (nextQ < selectedCourse.questions.length) {
      setCurrentQuestion(nextQ);
    } else {
      setViewState("success");
    }
  };

  const mintCertificate = async () => {
    setIsLoading(true);
    try {
      await checkNetwork();
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, signer);

      console.log("Minting...");
      // Panggil fungsi tanpa argumen karena kita menggunakan _msgSender() di Solidity
      const tx = await contract.mintSertifikat();
      const receipt = await tx.wait();

      setTxHash(tx.hash);

      // Try to extract the minted tokenId from Transfer event in the receipt
      try {
        let foundTokenId: string | null = null;
        for (const log of receipt.logs) {
          // only parse logs emitted by our contract address
          if (log.address && log.address.toLowerCase() === String(contract.address).toLowerCase()) {
            try {
              const parsed = contract.interface.parseLog(log);
              if (parsed && parsed.name === 'Transfer') {
                // args: from, to, tokenId
                const tokenIdArg = parsed.args[2];
                // BigInt -> string
                const tokenIdStr = String(tokenIdArg?.toString?.() ?? tokenIdArg);
                if (tokenIdStr) {
                  foundTokenId = tokenIdStr;
                  break;
                }
              }
            } catch {
              // not an event this interface can parse, ignore
            }
          }
        }

        if (foundTokenId !== null) {
          const tokenIdNum = Number(foundTokenId);
          setMintedTokenId(tokenIdNum);

          // fetch tokenURI
          try {
            // pass explicit Sepolia chain id to avoid provider auto-detection and retries
            const readProvider = new ethers.JsonRpcProvider('https://sepolia.publicgoods.network', 11155111);
            const readContract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, readProvider);
            // read tokenURI and try multiple strategies to obtain an image
            const tokenURI: string = await readContract.tokenURI(tokenIdNum);
            setMintedTokenURI(tokenURI);

            const normalizeIpfs = (uri: string) => uri.replace(/^ipfs:\/\/(ipfs\/)?/, 'https://cloudflare-ipfs.com/ipfs/');

            // If tokenURI itself looks like an image link (ends with an image extension), use it directly
            let resolvedImage: string | null = null;

            const trySetImage = async (candidate: string) => {
              try {
                // Normalize ipfs candidates
                const url = candidate.startsWith('ipfs://') ? normalizeIpfs(candidate) : candidate;
                // Quick fetch to verify it's reachable
                const resp = await fetch(url, { method: 'HEAD' });
                if (resp && resp.ok) {
                  // HEAD succeeded, treat candidate as valid image/url
                  resolvedImage = url;
                  return true;
                }
              } catch {
                // HEAD sometimes blocked; fallback to try GET and check content-type
                try {
                  const getResp = await fetch(candidate.startsWith('ipfs://') ? normalizeIpfs(candidate) : candidate);
                  if (getResp && getResp.ok) {
                    const contentType = getResp.headers.get('content-type') || '';
                    if (contentType.startsWith('image/') || candidate.match(/\.(png|jpe?g|gif|svg|webp)$/i)) {
                      resolvedImage = candidate.startsWith('ipfs://') ? normalizeIpfs(candidate) : candidate;
                      return true;
                    }
                  }
                } catch {
                  // ignore
                }
              }
              return false;
            };

            // 1) If tokenURI already looks like an image, try that first
            if (tokenURI.match(/\.(png|jpe?g|gif|svg|webp)$/i) || tokenURI.startsWith('ipfs://')) {
              if (await trySetImage(tokenURI)) {
                setCertImageUrl(resolvedImage);
              }
            }

            // 2) If tokenURI looks like JSON metadata, fetch it and look for image fields
            if (!resolvedImage) {
              try {
                const httpUri = tokenURI.startsWith('ipfs://') ? normalizeIpfs(tokenURI) : tokenURI;
                const metaResp = await fetch(httpUri);
                if (metaResp.ok) {
                  const meta = await metaResp.json();
                  // Support several possible image fields
                  const imageFields = ['image', 'image_url', 'imageUrl', 'imageURI'];
                  for (const f of imageFields) {
                    const val = meta[f];
                    if (val) {
                      if (await trySetImage(String(val))) {
                        setCertImageUrl(resolvedImage);
                        break;
                      }
                    }
                  }

                  // if still not resolved, and metadata contains a relative path like "images/1.png", try baseTokenURI
                  if (!resolvedImage) {
                    const base = meta?.base_uri || meta?.baseURI || null;
                    if (base && typeof base === 'string') {
                      const candidate = base.endsWith('/') ? `${base}${tokenIdNum}` : `${base}/${tokenIdNum}`;
                      if (await trySetImage(candidate)) setCertImageUrl(resolvedImage);
                    }
                  }
                }
              } catch {
                // ignore JSON fetch issues, we'll try contract baseTokenURI next
              }
            }

            // 3) fallback - use contract.baseTokenURI() and attempt common patterns
            if (!resolvedImage) {
              try {
                const baseUri: string = await readContract.baseTokenURI();
                if (baseUri) {
                  const candidates = [
                    `${baseUri}${tokenIdNum}`,
                    `${baseUri}${tokenIdNum}.png`,
                    `${baseUri}${tokenIdNum}.jpg`,
                    `${baseUri}${tokenIdNum}.jpeg`,
                    `${baseUri}${tokenIdNum}.json`,
                  ];
                  for (const c of candidates) {
                    if (await trySetImage(c)) {
                      setCertImageUrl(resolvedImage);
                      break;
                    }
                  }
                }
              } catch {
                // no baseTokenURI or fetch failed
              }
            }
          } catch {
            console.warn('Failed to fetch tokenURI or metadata after mint');
          }
        }
      } catch {
        console.warn('Could not determine tokenId from receipt');
      }
      setIsLoading(false);
    } catch (error) {
      console.error("Gagal:", error);
      setIsLoading(false);
      alert("Transaksi Gagal. Cek saldo Sepolia dan pastikan alamat kontrak benar.");
    }
  };

  // --- TAMPILAN UI ---
  return (
    <main className="min-h-screen bg-[#050511] text-white font-sans selection:bg-purple-500 selection:text-white">
      
      {/* NAVBAR */}
      <nav className="fixed top-0 w-full p-4 sm:p-4 border-b border-slate-800 bg-[#050511]/90 backdrop-blur z-50 flex justify-between items-center">
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded overflow-hidden border border-slate-700 bg-[#0b1220] flex items-center justify-center">
              <Image src="/logo-new.png" alt="CertiBlock" width={32} height={32} unoptimized className="object-contain" />
            </div>
            <h1 className="text-lg font-bold tracking-wide text-slate-200">
                Certi<span className="text-blue-700">Block</span>
            </h1>
        </div>
        
        <div className="flex items-center gap-4"> 
           
            {walletAddress ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="font-mono text-xs text-slate-400">
                {walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)}
                </span>
            </div>
            ) : (
                <button onClick={loginWithMetaMask} className="text-sm sm:text-sm md:text-sm font-bold text-slate-300 hover:text-white transition-colors px-2 py-1">
                    Login
                </button>
            )}
        </div>
      </nav>

      <div className="max-w-5xl mx-auto pt-32 px-6 pb-20">
        
        {/* VIEW 1: LANDING PAGE (BELUM LOGIN) */}
        {!walletAddress && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-10">
             <div className="inline-block px-4 py-1 rounded-full bg-blue-900/30 border border-blue-500/30 text-blue-400 text-xs font-mono mb-6 uppercase tracking-wider">
                Web3 Learning Platform
            </div>
            <h1 className="text-6xl md:text-7xl font-extrabold mb-6 leading-tight text-white">
              Unlock Your <br/>
              <span className="text-transparent bg-clip-text bg-linear-to-r from-purple-500 to-blue-500">
                Digital Certificate
              </span>
            </h1>
            <p className="text-slate-400 text-md md:text-lg max-w-3xl mx-auto mb-10 leading-relaxed">
              Platform pembelajaran terdesentralisasi. Selesaikan modul, buktikan keahlianmu, dan dapatkan sertifikat NFT yang abadi di Blockchain.
            </p>
            
            <button 
              onClick={loginWithMetaMask}
              disabled={isLoggingIn}
              className="bg-white hover:bg-slate-200 text-black px-6 sm:px-8 py-3 sm:py-4 rounded-xl text-base sm:text-lg font-bold shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all transform hover:scale-105 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoggingIn ? (
                  <span className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      Waiting for Signature...
                  </span>
              ) : "🚀 Login with MetaMask"}
            </button>

            {/* If on mobile and provider isn't injected show a helper deep-link button */}
            {isMobileDetected && !hasProvider && (
              <div className="mt-4">
                <div className="text-xs text-slate-400 mb-2">MetaMask tidak terdeteksi di browser ini.</div>
                <div className="flex justify-center gap-2">
                  <button
                    onClick={() => {
                      if (typeof window === 'undefined') return;
                      const currentHref = window.location.href;
                      const host = window.location.hostname;
                      // warn user about localhost / http when necessary
                      if ((host.includes('localhost') || host === '127.0.0.1' || currentHref.startsWith('http://')) && !confirm('Perhatian: URL ini tampak berjalan di localhost atau menggunakan HTTP. MetaMask in-app browser mungkin tidak dapat mengakses URL ini.\n\nPilihan: (OK) Buka MetaMask lalu buka URL ini secara manual di browser internal, atau Batalkan dan deploy/ekspos URL ke jaringan publik (contoh: gunakan ngrok).\n\nLanjutkan untuk mencoba membuka MetaMask?')) {
                        return;
                      }

                      const deepLinkFull = `https://metamask.app.link/dapp/${encodeURIComponent(currentHref)}`;
                      // open as new tab / app intent
                      window.open(deepLinkFull, '_blank');
                    }}
                    className="px-4 py-2 rounded-lg bg-linear-to-r from-blue-600 to-purple-600 text-sm font-bold shadow-lg hover:opacity-95 transition-colors"
                  >
                    Buka di MetaMask App
                  </button>
                  <button onClick={() => {
                      const host = typeof window !== 'undefined' ? window.location.hostname : '';
                      if (host.includes('localhost') || host === '127.0.0.1') {
                        alert('Info: Saat mengembangkan di localhost, MetaMask in-app browser tidak akan dapat mengakses halaman pada komputer Anda. Untuk menguji di HP, deploy ke public URL atau gunakan layanan tunneling seperti ngrok, atau buka MetaMask app -> Browser -> masukkan URL aplikasi Anda.');
                      } else {
                        alert('Jika MetaMask tidak terbuka otomatis, coba: 1) Pastikan MetaMask mobile terpasang, 2) Berikan izin untuk membuka app, 3) Buka MetaMask dan jalankan URL ini dari browser internal MetaMask. Alternatif: gunakan WalletConnect untuk koneksi tanpa in-app browser.');
                      }
                    }} className="px-3 py-2 rounded-lg border border-slate-700 text-sm hover:bg-slate-800 transition-all">
                    Bantuan
                  </button>
                </div>
              </div>
            )}

            <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg mx-auto opacity-90">
               {/* Show course thumbnails here (three boxes under the login CTA) */}
                 {courses.slice(0, 3).map((course) => {
                 const file = course.thumbnail ?? `course-${String(course.title).toLowerCase().replace(/[^a-z0-9]+/g, '-')}.svg`;
                 return (
                   <div key={course.id} className={`h-28 sm:h-20 rounded-lg overflow-hidden border border-slate-800 bg-linear-to-tr group transition-transform transform hover:-translate-y-1`}> 
                     <div className="relative w-full h-full">
                       <Image
                         src={`/${file}`}
                         alt={`${course.title} thumbnail`}
                         fill
                         unoptimized
                         className="object-contain block opacity-95 group-hover:opacity-100 bg-[#0f1724]"
                         // onError isn't ideal with next/image but keep graceful behavior minimal
                       />
                     </div>
                   </div>
                 );
               })}
            </div>
            <p className="mt-4 text-xs text-slate-600">Please sign the message to verify ownership.</p>
          </motion.div>
        )}

        {/* VIEW 2: DASHBOARD (GRID KARTU - MUNCUL SETELAH LOGIN) */}
        {walletAddress && viewState === "dashboard" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-white mb-2 font-mono">Available Modules</h2>
                    <p className="text-slate-400">Pilih topik untuk memulai sertifikasi.</p>
                </div>

                {/* NEW: show verification feature after login */}
                <div className="text-right">
                  
                  <div className="mt-2 text-xs text-slate-400">gunakan tombol di bawah untuk memeriksa sertifikat.</div>
                  <div className="mt-3 flex gap-2 justify-end">
                      <Link href={`/verify?owner=${walletAddress}`} className="px-3 py-1 rounded-md bg-slate-800 border border-slate-700 text-xs hover:bg-slate-700 transition-colors">
                        Buka Verifikasi
                      </Link>
                  </div>
                </div>
            </div>

            {/* GRID LAYOUT */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {courses.map((course) => (
                    <motion.div 
                        key={course.id}
                        whileHover={{ y: -5 }}
                        className="bg-[#0f1524] border border-slate-800 rounded-xl overflow-hidden cursor-pointer group hover:border-slate-600 transition-all"
                        onClick={() => startLearning(course)}
                    >
                        <div className={`h-32 w-full ${course.color} flex items-center justify-center`}>
                            <span className="text-7xl sm:text-6xl drop-shadow-lg transform group-hover:scale-110 transition-transform duration-300">{course.icon}</span>
                        </div>
                        <div className="p-5">
                            <div className="text-xs font-bold tracking-wider text-slate-500 mb-1 uppercase">Course</div>
                            <h3 className="text-lg font-bold text-white mb-2 leading-tight group-hover:text-blue-400 transition-colors">
                                {course.title}
                            </h3>
                            <p className="text-slate-400 text-xs mb-4 line-clamp-2">{course.description}</p>
                            <div className="flex gap-2">
                                {course.tags.map((tag, idx) => (
                                    <span key={idx} className="px-2 py-1 bg-slate-800 rounded text-[10px] font-mono text-slate-300 border border-slate-700">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
          </motion.div>
        )}

        {/* VIEW 3: QUIZ */}
        {walletAddress && viewState === "quiz" && selectedCourse && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="max-w-2xl mx-auto">
            <button 
                onClick={() => setViewState("dashboard")} 
                className="mb-6 text-slate-500 hover:text-white text-sm flex items-center gap-2"
            >
                ← Back to Dashboard
            </button>

            <div className="bg-[#0f1524] border border-slate-800 p-8 rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-slate-800">
                    <div 
                        className={`h-full ${selectedCourse.color.replace('bg-', 'bg-')} transition-all duration-500`} 
                        style={{ width: `${((currentQuestion + 1) / selectedCourse.questions.length) * 100}%` }}
                    ></div>
                </div>

                <div className="flex items-center gap-2 mb-6">
                    <span className="text-2xl">{selectedCourse.icon}</span>
                    <h2 className="text-xl font-bold text-slate-200">{selectedCourse.title}</h2>
                </div>

                <div className="mb-8">
                    <span className="text-slate-500 text-xs font-mono uppercase">Question {currentQuestion + 1} of {selectedCourse.questions.length}</span>
                    <h3 className="text-2xl font-bold mt-2 text-white">{selectedCourse.questions[currentQuestion].q}</h3>
                </div>

                <div className="space-y-3">
                    {selectedCourse.questions[currentQuestion].opts.map((opt: string, idx: number) => (
                        <button
                            key={idx}
                            onClick={() => handleAnswer(idx)}
                            className="w-full text-left p-4 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-500 hover:bg-slate-800 transition-all text-slate-300 hover:text-white"
                        >
                            <span className="mr-3 font-mono text-slate-500">{String.fromCharCode(65 + idx)}.</span>
                            {opt}
                        </button>
                    ))}
                </div>
            </div>
          </motion.div>
        )}

        {/* VIEW: LEARNING - show course video before the quiz */}
        {walletAddress && viewState === "learning" && selectedCourse && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="max-w-3xl mx-auto">
            <button
              onClick={() => setViewState("dashboard")}
              className="mb-6 text-slate-500 hover:text-white text-sm flex items-center gap-2"
            >
              ← Back to Dashboard
            </button>

            <div className="bg-[#0f1524] border border-slate-800 p-8 rounded-2xl relative overflow-hidden text-center">
              <div className="flex items-center gap-3 mb-6 justify-center">
                <span className="text-3xl">{selectedCourse.icon}</span>
                <div>
                  <h2 className="text-2xl font-bold text-white">{selectedCourse.title}</h2>
                  <p className="text-sm text-slate-400">Tonton video pengantar sebelum memulai kuis</p>
                </div>
              </div>

              <div className="mb-6">
                {selectedCourse.video ? (
                  // Support both mp4 files and YouTube links. For YouTube we use an iframe
                  // and provide a 'Mark as watched' control because we can't detect playback end
                  (selectedCourse.video.includes('youtube.com') || selectedCourse.video.includes('youtu.be')) ? (
                    <div className="w-full max-w-2xl mx-auto rounded-lg border border-slate-700 bg-black overflow-hidden">
                      <div className="relative" style={{ paddingTop: '56.25%' }}>
                        {/* embed Youtube */}
                        <iframe
                          src={selectedCourse.video.includes('watch?v=') ? selectedCourse.video.replace('watch?v=', 'embed/') : selectedCourse.video.replace('youtu.be/', 'www.youtube.com/embed/')}
                          title={selectedCourse.title}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="absolute inset-0 w-full h-full bg-black"
                        />
                      </div>

                      <div className="mt-3 flex gap-3 justify-center items-center">
                        <button onClick={() => setIsVideoWatched(true)} className="px-3 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-sm text-white">Saya sudah menonton</button>
                        <button onClick={() => setIsVideoWatched(false)} className="px-3 py-2 rounded-lg border border-slate-700 text-sm text-slate-300">Tandai belum</button>
                      </div>
                    </div>
                  ) : (
                    <video
                      src={selectedCourse.video}
                      controls
                      autoPlay
                      onEnded={() => setIsVideoWatched(true)}
                      className="w-full max-w-2xl mx-auto rounded-lg border border-slate-700 bg-black"
                    />
                  )
                ) : (
                  <div className="p-10 bg-slate-900 rounded-lg border border-slate-700 text-slate-400">Tidak ada video untuk course ini — Anda bisa langsung memulai kuis.</div>
                )}
              </div>

              <div className="flex justify-center items-center gap-3">
                <button
                  onClick={() => {
                    setCurrentQuestion(0);
                    setScore(0);
                    setViewState("quiz");
                  }}
                  disabled={!isVideoWatched && !!selectedCourse.video}
                  className={`px-4 py-2 rounded-lg font-bold text-white text-sm transition-all ${isVideoWatched || !selectedCourse.video ? 'bg-blue-600 hover:bg-blue-500' : 'bg-slate-700/40 cursor-not-allowed'}`}
                >
                  {selectedCourse.video ? (isVideoWatched ? 'Start Quiz' : 'Tonton sampai selesai untuk memulai') : 'Start Quiz'}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* VIEW 4: SUCCESS */}
        {walletAddress && viewState === "success" && selectedCourse && (
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-xl mx-auto text-center">
            {score === selectedCourse.questions.length ? (
                <div className="bg-[#0f1524] p-1 rounded-2xl border border-slate-800 shadow-2xl">
                    <div className="bg-[#0f1524] rounded-xl p-8">
                        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/20">
                            <span className="text-3xl">🏆</span>
                        </div>
                        <h2 className="text-3xl font-bold text-white mb-2">Tutorial Completed!</h2>
                        <p className="text-slate-400 mb-6 text-sm">Nilai sempurna! Klaim sertifikat <strong className="text-white">{selectedCourse.title}</strong> sekarang.</p>

                        <div className="relative group cursor-pointer mb-8 w-full max-w-xs mx-auto">
                          {certImageUrl ? (
                            <Image src={certImageUrl} alt={`Certificate #${mintedTokenId ?? ''}`} width={900} height={600} unoptimized className="rounded-lg border border-slate-700 w-full opacity-95 group-hover:opacity-100 transition-opacity" />
                          ) : (
                            <div className="rounded-lg border border-slate-700 w-full p-6 text-slate-400 bg-[#081021]">
                              <div className="text-sm mb-2">Gambar sertifikat tidak ditemukan / sudah dihapus.</div>
                              {mintedTokenId !== null && (
                                <div className="text-xs font-mono text-slate-300">Token ID: #{mintedTokenId}</div>
                              )}
                              <div className="mt-3 flex gap-2 justify-center">
                                {mintedTokenId !== null && (
                                  <a href={`https://sepolia.etherscan.io/token/${CONTRACT_ADDRESS}?a=${mintedTokenId}`} target="_blank" className="text-xs bg-slate-800 px-3 py-1 rounded border border-slate-700 hover:bg-slate-700">Buka di Etherscan</a>
                                )}
                                {/* if txHash is present, let user view tx */}
                                {txHash && (
                                  <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" className="text-xs bg-slate-800 px-3 py-1 rounded border border-slate-700 hover:bg-slate-700">Lihat transaksi</a>
                                )}
                                {/* If tokenURI was discovered, add a link too (try to reuse certImageUrl->metadata if available) */}
                                {mintedTokenURI && (
                                  <a href={mintedTokenURI.startsWith('ipfs://') ? mintedTokenURI.replace(/^ipfs:\/\/(ipfs\/)?/, 'https://cloudflare-ipfs.com/ipfs/') : mintedTokenURI} target="_blank" rel="noreferrer" className="text-xs bg-slate-800 px-3 py-1 rounded border border-slate-700 hover:bg-slate-700">Lihat metadata</a>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {!txHash ? (
                            <button onClick={mintCertificate} disabled={isLoading} className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold text-white shadow-lg transition-all disabled:opacity-50">
                                {isLoading ? "Processing..." : "Claim NFT Certificate"}
                            </button>
                        ) : (
                            <div className="space-y-3 animate-fade-in-up">
                                <div className="p-3 bg-green-900/20 border border-green-500/30 rounded-lg text-green-400 text-sm font-bold">
                                    ✅ Certificate Minted!
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" className="py-2 bg-slate-800 rounded-lg text-xs font-mono text-slate-300 hover:bg-slate-700 text-center border border-slate-700">
                                        Etherscan
                                    </a>
                                    <a href={`https://testnet.rarible.com/user/${walletAddress}/owned`} target="_blank" className="py-2 bg-yellow-600/20 text-yellow-500 border border-yellow-600/50 rounded-lg text-xs font-mono hover:bg-yellow-600/30 text-center">
                                        Rarible
                                    </a>
                                </div>
                            </div>
                        )}
                         <button onClick={() => setViewState("dashboard")} className="mt-6 text-slate-500 hover:text-white text-xs underline">Back to Dashboard</button>
                    </div>
                </div>
            ) : (
                 <div className="bg-[#0f1524] border border-slate-800 p-8 rounded-2xl">
                    <h2 className="text-2xl font-bold text-white mb-2">Try Again</h2>
                    <p className="text-slate-400 mb-6 text-sm">Skor: {score}/{selectedCourse.questions.length}. Harus benar semua.</p>
                    <button onClick={() => startLearning(selectedCourse!)} className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2 rounded-lg font-bold">Restart</button>
                    <div className="mt-4"><button onClick={() => setViewState("dashboard")} className="text-slate-600 hover:text-slate-400 text-xs">Quit</button></div>
                </div>
            )}
          </motion.div>
        )}

      </div>
    </main>
  );
}