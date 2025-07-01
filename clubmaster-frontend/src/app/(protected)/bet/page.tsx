"use client";
import React, { useEffect } from "react";
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function BetPage() {
  const router = useRouter();

  // Automatically redirect to opponents page
  useEffect(() => {
    router.push('/bet/opponents');
  }, [router]);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center" style={{ background: '#333939' }}>
      <div className="text-center p-8">
        <div className="mb-4">
          <Image 
            src="/images/bet btn icon.svg" 
            alt="Bet" 
            width={60} 
            height={60}
          />
        </div>
        <h1 className="text-[#FAF3DD] text-2xl font-semibold mb-2">Play for Bet</h1>
        <p className="text-[#D9D9D9] mb-4">Finding opponents...</p>
      </div>
    </div>
  );
} 