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
  // Add any other public routes here
];

/**
 * RouteGuard component to protect routes that require authentication
 * Use this component to wrap content in pages that should be protected
 */
export default function RouteGuard({ children }: RouteGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useAuth();
  const [authorized, setAuthorized] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    console.log("RouteGuard - Auth state:", { user: !!user, isLoading, pathname });
    
    // Authentication check function
    const authCheck = () => {
      // Check if we're on a public path
      const isPublicPath = publicPaths.some(path => pathname?.startsWith(path));
      
      // If the user is logged in and on a public path (like login), redirect to home
      if (user && isPublicPath) {
        console.log("User is logged in but on a public path, redirecting to home");
        setAuthorized(false); // Prevent rendering while redirect happens
        setCheckingAuth(false);
        router.push('/');
        return;
      }
      
      // For public paths, allow access without authentication
      if (isPublicPath) {
        console.log("Public path detected, allowing access");
        setAuthorized(true);
        setCheckingAuth(false);
        return;
      }

      // If user is logged in (including anonymous/guest users), allow access to protected routes
      if (user) {
        console.log("User authenticated, allowing access to protected route");
        setAuthorized(true);
        setCheckingAuth(false);
        return;
      }

      // If not authenticated and trying to access a protected route, redirect to login
      console.log("User not authenticated, redirecting to login");
      setAuthorized(false);
      setCheckingAuth(false);
      router.push('/login');
    };

    // Only check auth status when Firebase auth loading is complete
    if (!isLoading) {
      authCheck();
    }
  }, [user, isLoading, pathname, router]);

  // Show loading when checking authentication
  if (isLoading || checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#333939" }}>
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E9CB6B]"></div>
      </div>
    );
  }

  // If on public page or authorized, show children
  return authorized ? <>{children}</> : null;
} 