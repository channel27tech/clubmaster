'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import ClubHomeScreen from './club/ClubHomeScreen';

export default function Home() {
  const { user, isLoading, isGuest } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Only run this effect after authentication state is loaded
    if (!isLoading) {
      if (!user) {
        // Case 1: Fresh visitor (no user at all) - redirect to login
        console.log('Fresh visitor detected, redirecting to login page');
        router.push('/login');
      } else if (isGuest) {
        // Case 2: Guest user (anonymous) - redirect directly to play
        console.log('Guest user detected, redirecting to play page');
        router.push('/play');
      }
      // Case 3: Registered user - show home page (default return below)
    }
  }, [user, isLoading, isGuest, router]);

  // Show loading state while checking authentication
  if (isLoading) {
  return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#333939" }}>
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E9CB6B]"></div>
      </div>
    );
  }

  // Don't render anything while redirecting
  if (!user || isGuest) {
    return null;
  }

  // If user is authenticated (and not guest), show the ClubHomeScreen component
  return <ClubHomeScreen />;
}
