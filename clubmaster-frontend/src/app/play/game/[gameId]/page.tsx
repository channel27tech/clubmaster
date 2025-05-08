"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Header from "@/app/components/Header";
import MoveTracker from "@/app/components/MoveTracker";
import ChessBoardWrapper from "@/app/components/ChessBoardWrapper";

// Helper function to validate and format time control
const validateTimeControl = (timeControlStr: string | null): string => {
  if (!timeControlStr) {
    console.warn('No time control provided, defaulting to 5+0');
    return '5+0';
  }

  try {
    // Extract minutes from the time control string (e.g., "3+0" -> 3)
    const minutes = parseInt(timeControlStr.split('+')[0]);
    
    // Validate known time controls
    if (minutes === 3) return '3+0';  // Bullet
    if (minutes === 5) return '5+0';  // Blitz
    if (minutes === 10) return '10+0'; // Rapid
    
    // For any other valid number, format it properly
    if (!isNaN(minutes) && minutes > 0) {
      return `${minutes}+0`;
    }
    
    console.warn('Invalid time control format, defaulting to 5+0');
    return '5+0';
  } catch (error) {
    console.error('Error validating time control:', error);
    return '5+0';
  }
};

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
      console.log('🔍 Retrieved from localStorage - timeControl:', storedTimeControl);
      
      // Use helper function to validate and format time control
      const validatedTimeControl = validateTimeControl(storedTimeControl);
      setTimeControl(validatedTimeControl);
      console.log(`✅ Using time control: ${validatedTimeControl}`);
      
      // Also log any gameMode that might be stored
      const storedGameMode = localStorage.getItem("gameMode");
      console.log('🔍 Retrieved from localStorage - gameMode:', storedGameMode);

      console.log(`🎮 Game page loaded with gameId: ${gameId}`);
      console.log(`👤 Player: ${storedColor}, ⏱️ Time control: ${validatedTimeControl}`);
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