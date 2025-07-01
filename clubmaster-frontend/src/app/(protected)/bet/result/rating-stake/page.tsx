"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '@/app/components/Header';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/useToast';

export default function RatingStakeResultPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isWinner = searchParams.get('isWinner') === 'true';
  const gameId = searchParams.get('gameId');
  const { user } = useAuth();
  const toast = useToast();
  
  const [stakeAmount, setStakeAmount] = useState<number>(50); // Default stake amount
  const [playerRating, setPlayerRating] = useState<number>(1500);
  const [opponentData, setOpponentData] = useState<{
    username: string;
    photoURL: string | null;
    rating: number;
  }>({
    username: 'Opponent',
    photoURL: null,
    rating: 1500
  });
  
  // Fetch game result data
  useEffect(() => {
    const fetchData = async () => {
      if (!gameId) return;
      
      try {
        // In a real implementation, we'd fetch the game data from the backend
        // For this demo, we'll just use mock data
        const mockStakeAmount = 50;
        const mockPlayerRating = isWinner ? 1550 : 1450;
        const mockOpponentRating = isWinner ? 1450 : 1550;
        
        setStakeAmount(mockStakeAmount);
        setPlayerRating(mockPlayerRating);
        setOpponentData({
          username: isWinner ? 'Opponent' : 'Winner',
          photoURL: null,
          rating: mockOpponentRating
        });
        
      } catch (error) {
        console.error('Error fetching game data:', error);
        toast.error('Failed to load game data');
      }
    };
    
    fetchData();
  }, [gameId, isWinner, toast]);
  
  return (
    <div className="min-h-screen bg-[#4A7C59] text-white">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-center mb-6">
          {isWinner ? 'Victory!' : 'Defeat'}
        </h1>
        
        <div className="bg-[#333939] rounded-lg shadow-lg p-6 max-w-md mx-auto">
          <div className="text-center mb-6">
            <div className="w-24 h-24 bg-[#E9CB6B] rounded-full mx-auto mb-4 flex items-center justify-center overflow-hidden">
              {opponentData.photoURL ? (
                <Image 
                  src={opponentData.photoURL} 
                  alt="Profile" 
                  width={96} 
                  height={96} 
                  className="object-cover"
                />
              ) : (
                <span className="text-[#333939] text-4xl font-bold">
                  {opponentData.username.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            
            <h2 className="text-2xl font-semibold mb-1">
              {isWinner ? 'You won!' : 'You lost!'}
            </h2>
            <p className="text-[#E9CB6B] mb-4">
              Rating Stake: {stakeAmount} points
            </p>
          </div>
          
          <div className="bg-[#2A2E2E] p-4 rounded-lg mb-6">
            {isWinner ? (
              <>
                <div className="flex justify-between items-center mb-2">
                  <span>Your new rating:</span>
                  <span className="text-[#E9CB6B] font-bold">{playerRating} (+{stakeAmount})</span>
                </div>
                <div className="w-full bg-[#1f1f1f] h-2 rounded-full mb-4">
                  <div 
                    className="bg-[#E9CB6B] h-2 rounded-full" 
                    style={{width: `${Math.min(100, (playerRating / 2000) * 100)}%`}}
                  ></div>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span>Opponent's new rating:</span>
                  <span className="text-red-400 font-bold">{opponentData.rating} (-{stakeAmount})</span>
                </div>
                <div className="w-full bg-[#1f1f1f] h-2 rounded-full mb-4">
                  <div 
                    className="bg-red-400 h-2 rounded-full" 
                    style={{width: `${Math.min(100, (opponentData.rating / 2000) * 100)}%`}}
                  ></div>
                </div>
                <p className="text-center mt-4">
                  You gained {stakeAmount} rating points!
                </p>
              </>
            ) : (
              <>
                <div className="flex justify-between items-center mb-2">
                  <span>Your new rating:</span>
                  <span className="text-red-400 font-bold">{playerRating} (-{stakeAmount})</span>
                </div>
                <div className="w-full bg-[#1f1f1f] h-2 rounded-full mb-4">
                  <div 
                    className="bg-red-400 h-2 rounded-full" 
                    style={{width: `${Math.min(100, (playerRating / 2000) * 100)}%`}}
                  ></div>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span>Opponent's new rating:</span>
                  <span className="text-[#E9CB6B] font-bold">{opponentData.rating} (+{stakeAmount})</span>
                </div>
                <div className="w-full bg-[#1f1f1f] h-2 rounded-full mb-4">
                  <div 
                    className="bg-[#E9CB6B] h-2 rounded-full" 
                    style={{width: `${Math.min(100, (opponentData.rating / 2000) * 100)}%`}}
                  ></div>
                </div>
                <p className="text-center mt-4">
                  You lost {stakeAmount} rating points!
                </p>
              </>
            )}
          </div>
          
          <div className="mt-6 flex justify-center">
            <button 
              onClick={() => router.push('/play')} 
              className="bg-transparent border border-white text-white py-2 px-6 rounded-lg hover:bg-white hover:text-[#333939] transition-colors"
            >
              Back to Play Menu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 