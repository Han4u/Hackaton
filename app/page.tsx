"use client";

import { useState } from "react";
import { ethers } from "ethers";
import { motion } from "framer-motion";
import contractABI from "./abi.json"; 

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
  questions: Question[];
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ethereum: any;
  }
}

const CONTRACT_ADDRESS = "0x6a276e3D4948421B01cCdf4c85C209A6FEaD3AE0"; 
const SEPOLIA_CHAIN_ID = "0xaa36a7";

export default function Home() {
  const [walletAddress, setWalletAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState("");
  // State baru untuk loading saat login
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  const [viewState, setViewState] = useState<"landing" | "dashboard" | "quiz" | "success">("landing");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);

  // --- DATA KURSUS ---
  const courses: Course[] = [
    {
      id: 1,
      title: "Blockchain Foundation",
      description: "Pelajari dasar teknologi rantai blok & desentralisasi.",
      color: "bg-orange-500", 
      icon: "⛓️",
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
    if (typeof window.ethereum !== "undefined") {
      try {
        setIsLoggingIn(true);
        await checkNetwork(); // 1. Cek Jaringan dulu

        const provider = new ethers.BrowserProvider(window.ethereum);
        
        // 2. Request Akses Akun
        const accounts = await provider.send("eth_requestAccounts", []);
        const account = accounts[0];

        // 3. SIAPKAN PESAN LOGIN
        const signer = await provider.getSigner();
        const message = `Selamat datang di CertiBlock!\n\nSilakan tekan konfirmasi pesan ini untuk verifikasi login.\n\nWallet: ${account}\nTimestamp: ${new Date().toLocaleString()}`;

        // 4. PAKSA USER TANDA TANGAN (POP-UP METAMASK MUNCUL)
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
      alert("Install MetaMask dulu!");
    }
  };

  const startQuiz = (course: Course) => {
    setSelectedCourse(course);
    setCurrentQuestion(0);
    setScore(0);
    setViewState("quiz");
  };

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
      const tx = await contract.mintSertifikat(); 
      await tx.wait(); 

      setTxHash(tx.hash);
      setIsLoading(false);
    } catch (error) {
      console.error("Gagal:", error);
      setIsLoading(false);
      alert("Transaksi Gagal. Cek saldo Sepolia.");
    }
  };

  // --- TAMPILAN UI ---
  return (
    <main className="min-h-screen bg-[#050511] text-white font-sans selection:bg-purple-500 selection:text-white">
      
      {/* NAVBAR */}
      <nav className="fixed top-0 w-full p-4 border-b border-slate-800 bg-[#050511]/90 backdrop-blur z-50 flex justify-between items-center">
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded flex items-center justify-center font-bold text-lg">C</div>
            <h1 className="text-lg font-bold tracking-wide text-slate-200">
                Certi<span className="text-blue-500">Block</span>
            </h1>
        </div>
        
        {walletAddress ? (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="font-mono text-xs text-slate-400">
              {walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)}
            </span>
          </div>
        ) : (
            <button onClick={loginWithMetaMask} className="text-sm font-bold text-slate-300 hover:text-white transition-colors">
                Login
            </button>
        )}
      </nav>

      <div className="max-w-5xl mx-auto pt-32 px-6 pb-20">
        
        {/* VIEW 1: LANDING PAGE (BELUM LOGIN) */}
        {!walletAddress && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-10">
             <div className="inline-block px-4 py-1 rounded-full bg-blue-900/30 border border-blue-500/30 text-blue-400 text-xs font-mono mb-6 uppercase tracking-wider">
                Web3 Learning Platform
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold mb-6 leading-tight text-white">
              Unlock Your <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-blue-500">
                Digital Certificate
              </span>
            </h1>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
              Platform pembelajaran terdesentralisasi. Selesaikan modul, buktikan keahlianmu, dan dapatkan sertifikat NFT yang abadi di Blockchain.
            </p>
            
            <button 
              onClick={loginWithMetaMask}
              disabled={isLoggingIn}
              className="bg-white hover:bg-slate-200 text-black px-8 py-4 rounded-xl text-lg font-bold shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all transform hover:scale-105 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoggingIn ? (
                  <span className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      Waiting for Signature...
                  </span>
              ) : "🚀 Login with MetaMask"}
            </button>

            <div className="mt-16 grid grid-cols-3 gap-4 opacity-50 max-w-lg mx-auto">
               <div className="h-20 bg-slate-800 rounded-lg animate-pulse"></div>
               <div className="h-20 bg-slate-800 rounded-lg animate-pulse delay-75"></div>
               <div className="h-20 bg-slate-800 rounded-lg animate-pulse delay-150"></div>
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
            </div>

            {/* GRID LAYOUT */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {courses.map((course) => (
                    <motion.div 
                        key={course.id}
                        whileHover={{ y: -5 }}
                        className="bg-[#0f1524] border border-slate-800 rounded-xl overflow-hidden cursor-pointer group hover:border-slate-600 transition-all"
                        onClick={() => startQuiz(course)}
                    >
                        <div className={`h-32 w-full ${course.color} flex items-center justify-center`}>
                            <span className="text-6xl drop-shadow-lg transform group-hover:scale-110 transition-transform duration-300">{course.icon}</span>
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
                            <img src="https://i.postimg.cc/WbN1qk4W/certificate-dummy.jpg" alt="Cert" className="rounded-lg border border-slate-700 w-full opacity-80 group-hover:opacity-100 transition-opacity" />
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
                    <button onClick={() => startQuiz(selectedCourse)} className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2 rounded-lg font-bold">Restart Quiz</button>
                    <div className="mt-4"><button onClick={() => setViewState("dashboard")} className="text-slate-600 hover:text-slate-400 text-xs">Quit</button></div>
                </div>
            )}
          </motion.div>
        )}

      </div>
    </main>
  );
}