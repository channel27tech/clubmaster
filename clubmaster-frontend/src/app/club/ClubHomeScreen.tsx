'use client';
import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import BottomNavigation from '../components/BottomNavigation';

export default function ClubHomeScreen() {
  return (
    <div className="min-h-screen bg-[#393E3E] flex flex-col items-center w-full max-w-[400px] mx-auto relative">
      {/* Fixed header with same styling as main page */}
      <div className="w-full bg-[#2B3131] fixed top-0 left-1/2 -translate-x-1/2 max-w-[400px] z-50">
        <div className="flex justify-between items-center py-2 px-4">
          {/* Profile Icon */}
          <div className="flex items-center">
            <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-gray-600">
                <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          
          {/* Logo */}
          <Image 
            src="/logo.svg" 
            alt="Club Master Logo" 
            width={118} 
            height={48} 
            priority
          />
          
          {/* Notification Bell */}
          <div className="flex items-center relative">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-[#E9CB6B]">
              <path d="M5.85 3.5a.75.75 0 00-1.117-1 9.719 9.719 0 00-2.348 4.876.75.75 0 001.479.248A8.219 8.219 0 015.85 3.5zM19.267 2.5a.75.75 0 10-1.118 1 8.22 8.22 0 011.987 4.124.75.75 0 001.48-.248A9.72 9.72 0 0019.266 2.5z" />
              <path fillRule="evenodd" d="M12 2.25A6.75 6.75 0 005.25 9v.75a8.217 8.217 0 01-2.119 5.52.75.75 0 00.298 1.206c1.544.57 3.16.99 4.831 1.243a3.75 3.75 0 107.48 0 24.583 24.583 0 004.83-1.244.75.75 0 00.298-1.205 8.217 8.217 0 01-2.118-5.52V9A6.75 6.75 0 0012 2.25zM9.75 18c0-.034 0-.067.002-.1a25.05 25.05 0 004.496 0l.002.1a2.25 2.25 0 11-4.5 0z" clipRule="evenodd" />
            </svg>
            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              +5
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable content area with padding to account for fixed header and footer */}
      <div className="w-full overflow-y-auto flex-1 pt-[64px] pb-[72px]">
        {/* Search bar */}
        <div className="w-[90%] mx-auto mb-0 mt-4">
          <div className="flex items-center bg-[#505454] rounded-lg px-3 py-2">
            <input
              className="flex-1 bg-transparent outline-none text-white placeholder-[#BDBDBD] text-base"
              placeholder="watch"
              disabled
            />
            <span className="text-[#BDBDBD] text-lg ml-2">▼</span>
          </div>
        </div>

        {/* Featured event - Updated championship section */}
        <div className="w-[90%] mx-auto mt-6 mb-6">
          <div className="rounded-lg overflow-hidden shadow-lg" style={{
            background: 'linear-gradient(to right, #4A7C59, #4c5454)',
          }}>
            <div className="flex">
              <div className="w-[172px] flex items-center justify-center">
                <Image 
                  src="/images/chess league.svg" 
                  alt="chess league" 
                  width={150} 
                  height={97} 
                  className="rounded-l-lg"
                />
              </div>
              <div className="flex-1 p-3 flex flex-col justify-center">
                <h3 className="text-[#D9D9D9] font-semibold text-lg leading-tight">
                  Speed Chess Championship 2024
                </h3>
                <p className="text-[#D9D9D9] text-xs mt-2">
                  Sep 4, 2024 - Sep 24, 2024
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main actions */}
        <div className="w-[90%] mx-auto bg-[#505454] rounded-xl p-4 flex flex-col space-y-3 my-4">
          <button className="w-full py-2 rounded-lg bg-[#4A7C59] text-[#F9F3DD] text-lg font-semibold border-2 border-[#E9CB6B] mb-5">Start Game</button>
          <button className="w-full py-2 rounded-lg bg-[#232323] text-white text-base flex items-center justify-center"><span className="mr-3">🏆</span>Tournaments</button>
          <button className="w-full py-2 rounded-lg bg-[#232323] text-white text-base flex items-center justify-center"><span className="mr-3">🤝</span>Play for bet</button>
          <Link 
            href="/clubs" 
            className="w-full py-2 rounded-lg bg-[#232323] text-white text-base flex items-center justify-center"
          >
            <span className="mr-3">🔗</span>Join a club
          </Link>
          <button className="w-full py-2 rounded-lg bg-[#232323] text-white text-base flex items-center justify-center"><span className="mr-3">👥</span>Play a friend</button>
        </div>
      </div>

      {/* Fixed bottom navigation */}
      <BottomNavigation />
    </div>
  );
} 