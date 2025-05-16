'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import BottomNavigation from '../../components/BottomNavigation';

// Only the club creator (admin) is in the list initially
const players = [
  { rank: 1, name: 'Salih', avatar: '/images/user profile 1.svg', rating: 2100 },
];

export default function ClubCreatedDetailPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('players');

  return (
    <div className="min-h-screen bg-[#333939] flex flex-col w-full max-w-[400px] mx-auto relative">
      {/* Header */}
      <div className="bg-[#333939] p-4 flex items-center justify-between">
        <button 
          onClick={() => router.push('/club')} 
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
        <button className="text-[#BFC0C0]">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
          </svg>
        </button>
      </div>

      {/* Club Info Card - Exactly matching the joined club screen */}
      <div className="mx-4 rounded-lg p-3 mb-3 relative" style={{
        background: 'linear-gradient(to left, #4A7C59, #4c5454)'
      }}>
        {/* Question mark icon */}
        <div className="absolute top-4 right-4">
          <div className="w-4 h-4 rounded-full bg-[#8FC0A9] flex items-center justify-center">
            <span className="text-[#1F2323] text-sm font-medium">?</span>
          </div>
        </div>
        
        <div className="flex">
          <div className="flex-1">
            <div className="flex items-center">
              <h2 className="text-[#E9CB6B] text-lg font-semibold">Athani Club</h2>
            </div>
            <div className="flex items-center text-[#D9D9D9] text-xs">
              <span>227 members</span>
              <div className="flex items-center mx-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="#8FC0A9" viewBox="0 0 24 24" className="w-3 h-3">
                  <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
              </div>
              <span>Ernakulam</span>
            </div>

            {/* Stats */}
            <div className="mt-2 space-y-0.5">
              <div className="flex items-center">
                <span className="text-[#E9CB6B] mr-1 text-sm">🥇</span>
                <span className="text-[#D9D9D9] text-xs">#23</span>
              </div>
              <div className="flex items-center">
                <span className="text-[#E9CB6B] mr-1 text-sm">👉</span>
                <span className="text-[#D9D9D9] text-xs">12,345 pts</span>
              </div>
              <div className="flex items-center">
                <span className="text-[#E9CB6B] mr-1 text-sm">⭐</span>
                <span className="text-[#D9D9D9] text-xs">115</span>
              </div>
            </div>

            {/* Description with Read More */}
            <div className="mt-1">
              <p className="text-[#D9D9D9] text-[10px]">
                Athani club since 2023 have ...
                <button className="text-[#D9D9D9] underline text-[10px] ml-1">
                  Read more
                </button>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-2.5 h-2.5 inline ml-1 text-[#D9D9D9]">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </p>
            </div>
          </div>

          {/* Club Logo */}
          <div className="flex items-center justify-end mr-5">
            <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center border-2 border-[#E9CB6B]">
              <Image 
                src="/images/athani logo.svg"
                alt="Athani Club Logo"
                width={52}
                height={52}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-[#505454] mx-4 mb-2">
        <button 
          className={`flex-1 text-center py-1 text-sm ${activeTab === 'players' ? 'text-[#FAF3DD] border-b-2 border-[#E9CB6B] font-medium' : 'text-[#D9D9D9]'}`}
          onClick={() => setActiveTab('players')}
        >
          Players
        </button>
        <button 
          className={`flex-1 text-center py-1 text-sm ${activeTab === 'tournaments' ? 'text-[#FAF3DD] border-b-2 border-[#E9CB6B] font-medium' : 'text-[#D9D9D9]'}`}
          onClick={() => setActiveTab('tournaments')}
        >
          Tournaments
        </button>
      </div>

      {/* Table Header - Added back the border-b border */}
      <div className="mx-4 my-1 mb-2">
        <div className="flex py-2 bg-[#4C5454] rounded-lg text-[#D9D9D9]">
          <div className="w-16 text-xs text-center">Rank</div>
          <div className="flex-1 text-xs pl-12">Players</div>
          <div className="w-24 text-right text-xs pr-4">Rating</div>
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="pt-2 pb-[24px] overflow-y-auto flex-1 mb-[76px]">
        {/* Player List - Removed border-b from each player item */}
        {activeTab === 'players' && (
          <div className="mx-4 mb-4">
            {players.map((player, index) => (
              <div key={index} className="flex items-center py-2 bg-transparent">
                {/* Rank column */}
                <div className="w-16 text-[#D9D9D9] text-xs text-center">#{player.rank}</div>
                
                {/* Players column with fixed width for consistent layout */}
                <div className="flex-1 flex items-center">
                  <div className="w-9 h-9 rounded-full bg-white overflow-hidden mr-3">
                    <Image src={player.avatar} alt="Player Avatar" width={36} height={36} />
                  </div>
                  <span className="text-[#D9D9D9] text-sm">{player.name}</span>
                </div>
                
                {/* Rating column */}
                <div className="w-16 text-right text-[#D9D9D9] pr-4 text-sm">{player.rating}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tournament Tab Content */}
        {activeTab === 'tournaments' && (
          <div className="mx-4 flex items-center justify-center text-[#D9D9D9] h-[200px]">
            <p>No tournaments available</p>
          </div>
        )}
      </div>

      {/* Create Tournament Button - Removed border-t */}
      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-[400px] px-4 py-3 bg-[#333939]">
        <button 
          className="w-full py-3 rounded-lg bg-[#4A7C59] text-[#FAF3DD] font-medium border border-[#E9CB6B]"
        >
          Create Tournament
        </button>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[400px] z-10">
        <BottomNavigation />
      </div>
    </div>
  );
} 