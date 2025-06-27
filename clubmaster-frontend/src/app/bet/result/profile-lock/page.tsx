"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '@/app/components/Header';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/useToast';

export default function ProfileLockResultPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isWinner = searchParams.get('isWinner') === 'true';
  const gameId = searchParams.get('gameId');
  const { user } = useAuth();
  const toast = useToast();
  
  const [opponentData, setOpponentData] = useState<{
    username: string;
    photoURL: string | null;
  }>({
    username: 'Opponent',
    photoURL: null
  });
  
  const [lockExpiry, setLockExpiry] = useState<string>('');
  
  // Fetch opponent information based on game ID
  useEffect(() => {
    const fetchData = async () => {
      if (!gameId) return;
      
      try {
        // In a real implementation, we'd fetch the opponent data from the backend
        // For this demo, we'll just use mock data
        const mockOpponentData = {
          username: isWinner ? 'Opponent' : 'You',
          photoURL: null
        };
        
        setOpponentData(mockOpponentData);
        
        // Set expiry date (24 hours from now)
        const expiryDate = new Date();
        expiryDate.setHours(expiryDate.getHours() + 24);
        setLockExpiry(expiryDate.toLocaleString());
      } catch (error) {
        console.error('Error fetching opponent data:', error);
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
              Profile Lock Bet
            </p>
          </div>
          
          <div className="bg-[#2A2E2E] p-4 rounded-lg mb-6">
            {isWinner ? (
              <>
                <p className="mb-4">
                  {opponentData.username}'s profile is now locked until:
                </p>
                <p className="text-[#E9CB6B] text-center font-semibold mb-4">
                  {lockExpiry}
                </p>
                <p>
                  They cannot change their profile details during this period.
                </p>
              </>
            ) : (
              <>
                <p className="mb-4">
                  Your profile is now locked until:
                </p>
                <p className="text-[#E9CB6B] text-center font-semibold mb-4">
                  {lockExpiry}
                </p>
                <p>
                  You cannot change your profile details during this period.
                </p>
                <div className="mt-6 p-3 bg-[#1f1f1f] rounded-lg border border-[#E9CB6B] bg-opacity-50">
                  <p className="text-sm">
                    <span className="text-[#E9CB6B] font-bold">Note:</span> If you attempt to edit your profile before the lock expires, your changes will be rejected.
                  </p>
                </div>
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