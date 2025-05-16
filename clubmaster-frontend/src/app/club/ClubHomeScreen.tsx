'use client';
import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import BottomNavigation from '../components/BottomNavigation';
import { useClub, UserType } from '../context/ClubContext';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';

export default function ClubHomeScreen() {
  const { hasClub, setHasClub, userType, setUserType } = useClub();
  const router = useRouter();
  const { user } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle user type change
  const handleUserTypeChange = (type: UserType) => {
    setUserType(type);
    setIsDropdownOpen(false);
    
    // Update hasClub state based on userType for backward compatibility
    setHasClub(type === 'hasClub');
  };

  // Get display text based on current user type
  const getDisplayText = () => {
    switch (userType) {
      case 'hasClub':
        return 'Has Club View';
      case 'noClub':
        return 'No Club View';
      case 'admin':
        return 'Admin User View';
      default:
        return 'Switch View';
    }
  };

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

        {!hasClub && (
          // No Club View - Featured event section
          <div className="w-full h-[111px] mx-auto mb-4">
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
        )}

        {/* Demo flow switch dropdown */}
        <div className="relative mb-4" ref={dropdownRef}>
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)} 
            className="px-4 py-2 bg-[#4A7C59] text-[#FAF3DD] rounded-md text-sm flex items-center justify-between min-w-[160px]"
          >
            <span>{getDisplayText()}</span>
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className={`h-4 w-4 ml-2 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {isDropdownOpen && (
            <div className="absolute z-50 mt-1 w-full bg-[#1F2323] border border-[#4A7C59] rounded-md shadow-lg">
              <button 
                className={`w-full text-left px-4 py-2 text-sm ${userType === 'hasClub' ? 'bg-[#4A7C59] text-[#FAF3DD]' : 'text-[#D9D9D9] hover:bg-[#4c5454]'}`}
                onClick={() => handleUserTypeChange('hasClub')}
              >
                Has Club View
              </button>
              <button 
                className={`w-full text-left px-4 py-2 text-sm ${userType === 'noClub' ? 'bg-[#4A7C59] text-[#FAF3DD]' : 'text-[#D9D9D9] hover:bg-[#4c5454]'}`}
                onClick={() => handleUserTypeChange('noClub')}
              >
                No Club View
              </button>
              <button 
                className={`w-full text-left px-4 py-2 text-sm ${userType === 'admin' ? 'bg-[#4A7C59] text-[#FAF3DD]' : 'text-[#D9D9D9] hover:bg-[#4c5454]'}`}
                onClick={() => handleUserTypeChange('admin')}
              >
                Admin User View
              </button>
            </div>
          )}
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
          <button className="w-[302px] h-[57px] rounded-[10px] bg-[#1F2323] text-[#D9D9D9] text-base flex items-center justify-center border border-[#000000] mb-4">
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
            // User has a club - Show "Play a club member" button
            <button className="w-[302px] h-[57px] rounded-[10px] bg-[#1F2323] text-[#D9D9D9] text-base flex items-center justify-center border border-[#000000] mb-4">
              <span className="mr-3">
                <Image 
                  src="/images/play a clb membr btn icon.svg" 
                  alt="Play a club member" 
                  width={30} 
                  height={30}
                />
              </span>
              Play a club member
            </button>
          ) : (
            // User doesn't have a club - Show "Join a club" button
            <Link 
              href="/clubs" 
              className="w-[302px] h-[57px] rounded-[10px] bg-[#1F2323] text-[#D9D9D9] text-base flex items-center justify-center border border-[#000000] mb-4"
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
            </Link>
          )}
          
          {/* Play a friend Button */}
          <button className="w-[302px] h-[57px] rounded-[10px] bg-[#1F2323] text-[#D9D9D9] text-base flex items-center justify-center border border-[#000000]">
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
        <BottomNavigation 
          onClubClick={() => {
            // Navigate to different club views based on userType
            if (userType === 'hasClub') {
              router.push('/club/my-clubs');
            } else if (userType === 'admin') {
              router.push('/club/preview?admin=1');
            } else {
              router.push('/club/clubs');
            }
          }}
        />
      </div>
    </div>
  );
} 