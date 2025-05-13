'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ClubsRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/club/clubs');
  }, [router]);

  return (
    <div className="min-h-screen bg-[#393E3E] flex flex-col items-center justify-center w-full">
      <p className="text-white text-lg">Redirecting to clubs page...</p>
    </div>
  );
} 