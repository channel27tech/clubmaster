"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Header from "@/app/components/Header";
import MoveTracker from "@/app/components/MoveTracker";
import ChessBoardWrapper from "@/app/components/ChessBoardWrapper";

export default function GamePage() {
  const params = useParams();
  const gameId = Array.isArray(params.gameId) ? params.gameId[0] : params.gameId as string;
  const [playerColor, setPlayerColor] = useState<'white' | 'black' | null>(null);
  const [timeControl, setTimeControl] = useState<string>('5+0');

  useEffect(() => {
    if (typeof window !== "undefined") {
      // Get playerColor
      const storedColor = localStorage.getItem("playerColor");
      // Only set valid values
      if (storedColor === 'white' || storedColor === 'black') {
        setPlayerColor(storedColor);
      }
      
      // Get timeControl
      const storedTimeControl = localStorage.getItem("timeControl");
      if (storedTimeControl) {
        setTimeControl(storedTimeControl);
      }

      console.log(`Game page loaded with gameId: ${gameId}`);
      console.log(`Player color: ${storedColor}, Time control: ${storedTimeControl}`);
    }
  }, [gameId]);

  return (
    <div className="flex flex-col min-h-screen bg-[#4A7C59]">
      <Header />
      <MoveTracker />
      <div className="flex-grow flex flex-col items-center justify-center">
        <div className="w-full max-w-md mx-auto">
          <ChessBoardWrapper 
            playerColor={playerColor} 
            timeControl={timeControl}
            gameId={gameId}
          />
        </div>
      </div>
    </div>
  );
} 