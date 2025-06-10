'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

interface RouteGuardProps {
  children: React.ReactNode;
}

// List of public paths that don't require authentication
const publicPaths = [
  '/login', 
  '/login/login_with_phone', 
  '/login/login_with_phone_otp',
  '/play', // Allow access to the play page without authentication
  // Add any other public routes here
];

// Paths that guest users can access (in addition to public paths)
const guestAllowedPaths = [
  '/play',
  // Add any other paths that guest users should be able to access
];

/**
 * RouteGuard component to protect routes that require authentication
 * Use this component to wrap content in pages that should be protected
 */
export default function RouteGuard({ children }: RouteGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, isGuest } = useAuth();
  const [authorized, setAuthorized] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    console.log("RouteGuard - Auth state:", { 
      userExists: !!user, 
      isGuest, 
      loading, 
      pathname 
    });
    
    // Authentication check function
    const authCheck = () => {
      // Check if we're on a public path (anyone can access)
      const isPublicPath = publicPaths.some(path => pathname?.startsWith(path));
      
      // Check if this is a guest-allowed path
      const isGuestAllowedPath = guestAllowedPaths.some(path => pathname?.startsWith(path));
      
      // CASE 1: User is on a public path
      if (isPublicPath) {
        console.log("Public path detected, allowing access");
        setAuthorized(true);
        setCheckingAuth(false);
        return;
      }

      // CASE 2: Registered user is logged in (not guest) - allow access to any path
      if (user && !isGuest) {
        console.log("Registered user authenticated, allowing access");
        setAuthorized(true);
        setCheckingAuth(false);
        return;
      }
      
      // CASE 3: Guest user accessing guest-allowed path
      if (user && isGuest && isGuestAllowedPath) {
        console.log("Guest user accessing allowed path, granting access");
        setAuthorized(true);
        setCheckingAuth(false);
        return;
      }

      // CASE 4: Guest user accessing non-guest allowed path - redirect to /play
      if (user && isGuest) {
        console.log("Guest user attempting to access protected route, redirecting to play");
        setAuthorized(false);
        setCheckingAuth(false);
        router.push('/play');
        return;
      }
      
      // CASE 5: No user at all (fresh visitor) - redirect to login
      console.log("User not authenticated, redirecting to login");
      setAuthorized(false);
      setCheckingAuth(false);
      router.push('/login');
    };

    // Only check auth status when Firebase auth loading is complete
    if (!loading) {
      authCheck();
    }
  }, [user, loading, isGuest, pathname, router]);

  // Show loading when checking authentication
  if (loading || checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#333939" }}>
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E9CB6B]"></div>
      </div>
    );
  }

  // If on public page or authorized, show children
  return authorized ? <>{children}</> : null;
} 