'use client';
import React, { createContext, useContext, useState, ReactNode } from 'react';

// Define user type enum
export type UserType = 'hasClub' | 'noClub' | 'admin';

interface ClubContextType {
  hasClub: boolean;
  setHasClub: (value: boolean) => void;
  userType: UserType;
  setUserType: (value: UserType) => void;
}

const ClubContext = createContext<ClubContextType | undefined>(undefined);

export function ClubProvider({ children }: { children: ReactNode }) {
  const [hasClub, setHasClub] = useState(false);
  const [userType, setUserType] = useState<UserType>('noClub');

  return (
    <ClubContext.Provider value={{ hasClub, setHasClub, userType, setUserType }}>
      {children}
    </ClubContext.Provider>
  );
}

export function useClub() {
  const context = useContext(ClubContext);
  if (context === undefined) {
    throw new Error('useClub must be used within a ClubProvider');
  }
  return context;
} 