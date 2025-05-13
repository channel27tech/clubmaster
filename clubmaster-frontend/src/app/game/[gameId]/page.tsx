"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ChessBoardWrapper from "../../components/ChessBoardWrapper";
import { useSocket } from "../../../contexts/SocketContext";

export default function GameRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const gameId = Array.isArray(params.gameId) ? params.gameId[0] : params.gameId as string;
  const [playerColor, setPlayerColor] = useState<'white' | 'black' | null>(null);
  const [timeControl, setTimeControl] = useState<string>('5+0');
  const { socket } = useSocket();
  
  useEffect(() => {
    // Redirect to the new route structure
    router.replace(`/play/game/${gameId}`);
  }, [gameId, router]);

  useEffect(() => {
    // Get player color and time control from localStorage (set during matchmaking)
    const storedColor = localStorage.getItem('playerColor');
    if (storedColor === 'white' || storedColor === 'black') {
      setPlayerColor(storedColor);
    }
    
    const storedTimeControl = localStorage.getItem('timeControl');
    if (storedTimeControl) {
      setTimeControl(storedTimeControl);
    }
    
    // Join the game room
    if (socket && gameId) {
      console.log(`Joining game room: ${gameId}`);
      socket.emit('enter_game', { gameId });
    }
  }, [socket, gameId]);

  return (
    <div className="flex flex-col min-h-screen bg-[#4A7C59] items-center justify-center">
      <div className="text-white text-xl">
        Redirecting to new game page...
      </div>
    </div>
  );
} 