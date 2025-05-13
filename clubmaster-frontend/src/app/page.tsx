'use client';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex flex-col min-h-screen bg-[#4A7C59] items-center justify-center">
      <div className="text-center p-8 max-w-md bg-[#333939] rounded-xl shadow-lg">
        <h1 className="text-3xl font-bold text-white mb-6">Clubmaster Chess</h1>
        <p className="text-gray-300 mb-8">
          Welcome to Clubmaster Chess! This is a placeholder for the future landing page.
        </p>
        
        <Link 
          href="/play" 
          className="inline-block py-3 px-8 bg-[#E9CB6B] hover:bg-[#d9bb5b] text-[#333939] font-medium rounded-lg transition-colors"
        >
          Play Chess
        </Link>
      </div>
    </main>
  );
}
