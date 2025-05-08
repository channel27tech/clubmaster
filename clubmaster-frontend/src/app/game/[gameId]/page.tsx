"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function GameRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const gameId = Array.isArray(params.gameId) ? params.gameId[0] : params.gameId as string;
  
  useEffect(() => {
    // Redirect to the new route structure
    router.replace(`/play/game/${gameId}`);
  }, [gameId, router]);

  return (
    <div className="flex flex-col min-h-screen bg-[#4A7C59] items-center justify-center">
      <div className="text-white text-xl">
        Redirecting to new game page...
      </div>
    </div>
  );
} 