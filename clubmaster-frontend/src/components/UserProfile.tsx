'use client';

import React from 'react';
import Image from 'next/image';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';

interface UserProfileProps {
  compact?: boolean;
}

export default function UserProfile({ compact = false }: UserProfileProps) {
  const { user, isGuest, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (!user) {
    return null;
  }

  // Determine display name and avatar
  const displayName = user.displayName || (isGuest ? 'Guest Player' : 'Chess Player');
  const photoURL = user.photoURL || '/images/atm_profile_avatar-icon.png';
  
  // Compact version for header/navbar
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full overflow-hidden">
          <Image
            src={photoURL}
            alt={displayName}
            width={32}
            height={32}
            className="object-cover"
          />
        </div>
        <button
          onClick={handleLogout}
          className="text-[#FAF3DD] text-sm hover:underline"
        >
          Logout
        </button>
      </div>
    );
  }

  // Full profile component
  return (
    <div className="bg-[#1A1E1D] rounded-lg p-4 w-full max-w-sm">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full overflow-hidden">
          <Image
            src={photoURL}
            alt={displayName}
            width={64}
            height={64}
            className="object-cover"
          />
        </div>
        <div className="flex-1">
          <h3 className="text-[#FAF3DD] text-lg font-poppins font-semibold">
            {displayName}
          </h3>
          <p className="text-[#D9D9D9] text-sm">
            {isGuest ? 'Guest Account' : user.email || 'Club Member'}
          </p>
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t border-[#4C5454]">
        <button
          onClick={handleLogout}
          className="w-full bg-[#4A7C59] text-[#FAF3DD] rounded-lg py-2 font-poppins font-medium"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
} 