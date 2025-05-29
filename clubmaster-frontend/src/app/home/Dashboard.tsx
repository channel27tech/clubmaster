'use client';
import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import BottomNavigation from '../components/BottomNavigation';
import { useClub, UserType } from '../context/ClubContext';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';

export default function Dashboard() {
  const { hasClub, setHasClub, userType, setUserType } = useClub();
  const router = useRouter();
  const { user } = useAuth();

  // Automatically set hasClub and userType based on user/club data
  useEffect(() => {
    const fetchClubStatus = async () => {
      if (!user) return;
      try {
        const token = await user.getIdToken();
        const res = await fetch('http://localhost:3001/club-member/my', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch club status');
        const data = await res.json();
        if (data && data.club) {
          setHasClub(true);
          setUserType(data.role === 'super_admin' || data.role === 'admin' ? 'admin' : 'hasClub');
        } else {
          setHasClub(false);
          setUserType('noClub');
        }
      } catch (err) {
        setHasClub(false);
        setUserType('noClub');
      }
    };
    fetchClubStatus();
  }, [user, setHasClub, setUserType]);

  // Handle navigation to play screen
  const handlePlayClick = () => {
    router.push('/play');
  };

  // Handle navigation to profile page
  const handleProfileClick = () => {
    router.push('/user_profile');
  };

  return (
    <div className="min-h-screen bg-[#333939] flex flex-col items-center w-full max-w-[430px] mx-auto relative">
      {/* Fixed header with Figma specs */}
      <div className="w-[430px] h-[62px] bg-[#333939] fixed top-0 left-1/2 -translate-x-1/2 max-w-[430px] z-50">
        <div className="flex justify-between items-center h-full py-2 px-[21px]">
          {/* Profile Icon */}
          <div className="flex items-center">
            <div 
              className="w-8 h-8 flex items-center justify-center cursor-pointer"
              onClick={handleProfileClick}
            >
              <Image 
                src="/images/home pageprofile icon.svg" 
                alt="Profile" 
                width={21} 
                height={20}
              />
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
            <Image 
              src="/images/hone page notification icon.svg" 
              alt="Notifications" 
              width={29} 
              height={23}
            />
          </div>
        </div>
      </div>

      {/* Scrollable content area with padding to account for fixed header and footer */}
      <div className="w-full overflow-y-auto flex-1 pt-[62px] pb-[62px] flex flex-col items-center px-[21px]">
        {/* Watch section */}
        <div className="w-full h-[60px] mx-auto mt-4 mb-4">
          {hasClub ? (
            // Has Club View - Watch with dropdown icon
            <div className="flex items-center justify-between h-full bg-[#4C5454] rounded-[10px] px-3 py-2">
              <span
                className="text-[#FAF3DD] text-base font-medium font-['Poppins']"
                style={{ fontSize: '16px', fontFamily: 'Poppins, sans-serif', fontWeight: '500' }}
              >
                watch
              </span>
              <div className="ml-2">
                <Image 
                  src="/images/watch drpdown home page icon.svg" 
                  alt="Dropdown" 
                  width={24} 
                  height={24}
                />
              </div>
            </div>
          ) : (
            // No Club View - Watch with dropdown
            <div className="flex items-center h-full bg-[#4C5454] rounded-[10px] px-3 py-2">
              <input
                className="flex-1 bg-transparent outline-none text-[#FAF3DD] placeholder-[#FAF3DD] text-base font-medium font-['Poppins']"
                placeholder="watch"
                disabled
                style={{ fontSize: '16px', fontFamily: 'Poppins, sans-serif', fontWeight: '500' }}
              />
              <div className="ml-2">
                <Image 
                  src="/images/watch drpdown home page icon.svg" 
                  alt="Dropdown" 
                  width={24} 
                  height={24}
                />
              </div>
            </div>
          )}
        </div>

        {/* Featured event section - now shown for all users */}
        <div className="w-full h-[111px] mx-auto mb-4 mt-4">
          <div className="h-full rounded-[5px] overflow-hidden shadow-lg" style={{
            background: 'linear-gradient(to right, #4A7C59, #4c5454)',
          }}>
            <div className="flex h-full">
              <div className="w-[172px] flex items-center justify-center">
                <Image 
                  src="/images/chess league.svg" 
                  alt="chess league" 
                  width={150} 
                  height={97} 
                  className="rounded-l-[5px]"
                />
              </div>
              <div className="flex-1 p-3 flex flex-col justify-center">
                <h3 className="text-[#F5F5F5] leading-tight" style={{ 
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: '16px',
                  fontWeight: '600'
                }}>
                  Speed Chess Championship 2024
                </h3>
                <p className="text-[#F5F5F5] mt-2" style={{ 
                  fontFamily: 'Roboto, sans-serif',
                  fontSize: '10px',
                  fontWeight: '600'
                }}>
                  Sep 4, 2024 - Sep 24, 2024
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main actions - Button section */}
        <div className="w-full mx-auto bg-[#4C5454] rounded-[10px] flex flex-col items-center justify-evenly py-6 px-4 my-4">
          {/* Start Game Button */}
          <button 
            className="w-[302px] h-[57px] rounded-[10px] bg-[#4A7C59] text-[#FAF3DD] border-[3px] border-[#E9CB6B] mb-4" 
            style={{
            fontFamily: 'Roboto, sans-serif',
            fontSize: '18px',
            fontWeight: '500'
            }}
            onClick={handlePlayClick}
          >
            Start Game
          </button>
          
          {/* Tournaments Button */}
          <button className="w-[302px] h-[57px] rounded-[10px] bg-[#1F2323] text-[#D9D9D9] text-base flex items-center justify-center border border-[#000000] mb-4">
            <span className="mr-3">
              <Image 
                src="/images/trnmnt btb icon.svg" 
                alt="Tournaments" 
                width={28} 
                height={25}
              />
            </span>
            Tournaments
          </button>
          
          {/* Play for bet Button */}
          <button 
            className="w-[302px] h-[57px] rounded-[10px] bg-[#1F2323] text-[#D9D9D9] text-base flex items-center justify-center border border-[#000000] mb-4"
            onClick={() => router.push('/bet/opponents')}
          >
            <span className="mr-3">
              <Image 
                src="/images/bet btn icon.svg" 
                alt="Play for bet" 
                width={30} 
                height={30}
              />
            </span>
            Play for bet
          </button>
          
          {/* Conditional rendering based on club status */}
          {hasClub ? (
            // User has a club - Show "Play with club member" button
            <button
              className="w-[302px] h-[57px] rounded-[10px] bg-[#1F2323] text-[#D9D9D9] text-base flex items-center justify-center border border-[#000000] mb-4"
              onClick={() => router.push('/club/created-detail')}
            >
              <span className="mr-3">
                <Image 
                  src="/images/play a clb membr btn icon.svg" 
                  alt="Play with club member" 
                  width={30} 
                  height={30}
                />
              </span>
              Play with club member
            </button>
          ) : (
            // User doesn't have a club - Show "Join a club" button
            <button
              className="w-[302px] h-[57px] rounded-[10px] bg-[#1F2323] text-[#D9D9D9] text-base flex items-center justify-center border border-[#000000] mb-4"
              onClick={() => router.push('/club/clubs')}
            >
              <span className="mr-3">
                <Image 
                  src="/images/join club btn icon.svg" 
                  alt="Join a club" 
                  width={25} 
                  height={25}
                />
              </span>
              Join a club
            </button>
          )}
          
          {/* Play a friend Button */}
          <button className="w-[302px] h-[57px] rounded-[10px] bg-[#1F2323] text-[#D9D9D9] text-base flex items-center justify-center border border-[#000000]"
            onClick={() => router.push('/club/friends?mode=play')}
          >
            <span className="mr-3">
              <Image 
                src="/images/ply frnd btn icon.svg" 
                alt="Play a friend" 
                width={31} 
                height={22}
              />
            </span>
            Play a friend
          </button>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50">
        <BottomNavigation />
      </div>
    </div>
  );
} 