'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import BottomNavigation from '../../../components/BottomNavigation';

export default function CreateTournamentPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#333939] flex flex-col w-full max-w-[400px] mx-auto relative">
      {/* Header */}
      <div className="bg-[#333939] p-4 flex items-center justify-between">
        <button 
          onClick={() => router.back()} 
          className="text-[#BFC0C0]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </button>
        <div className="flex-1 flex justify-center">
          <Image
            src="/logo.svg"
            alt="Club Master Logo"
            width={118}
            height={48}
            priority
          />
        </div>
        <div className="w-6 h-6"></div> {/* Empty div for spacing */}
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4">
        <h1 className="text-[#FAF3DD] text-xl font-semibold mb-6">Create Tournament</h1>
        
        <div className="bg-[#4C5454] rounded-lg p-4 mb-4">
          <div className="mb-4">
            <label className="block text-[#D9D9D9] text-sm mb-2">Tournament Name</label>
            <input 
              type="text" 
              className="w-full bg-[#333939] text-[#FAF3DD] rounded-md p-2 border border-[#8FC0A9]"
              placeholder="Enter tournament name"
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-[#D9D9D9] text-sm mb-2">Tournament Type</label>
            <select className="w-full bg-[#333939] text-[#FAF3DD] rounded-md p-2 border border-[#8FC0A9]">
              <option>Swiss</option>
              <option>Round Robin</option>
              <option>Elimination</option>
            </select>
          </div>
          
          <div className="mb-4">
            <label className="block text-[#D9D9D9] text-sm mb-2">Start Date</label>
            <input 
              type="date" 
              className="w-full bg-[#333939] text-[#FAF3DD] rounded-md p-2 border border-[#8FC0A9]"
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-[#D9D9D9] text-sm mb-2">End Date</label>
            <input 
              type="date" 
              className="w-full bg-[#333939] text-[#FAF3DD] rounded-md p-2 border border-[#8FC0A9]"
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-[#D9D9D9] text-sm mb-2">Description</label>
            <textarea 
              className="w-full bg-[#333939] text-[#FAF3DD] rounded-md p-2 border border-[#8FC0A9] h-24"
              placeholder="Enter tournament description"
            ></textarea>
          </div>
        </div>
        
        <button 
          className="w-full py-3 rounded-lg bg-[#4A7C59] text-[#FAF3DD] font-medium border border-[#E9CB6B] mb-4"
        >
          Create Tournament
        </button>
      </div>

      {/* Bottom Navigation */}
      <div className="w-full">
        <BottomNavigation />
      </div>
    </div>
  );
} 