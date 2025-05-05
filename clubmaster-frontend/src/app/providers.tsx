'use client';

import React from 'react';
import { SocketProvider } from '../contexts/SocketContext';

interface ProvidersProps {
  children: React.ReactNode;
}

export const Providers: React.FC<ProvidersProps> = ({ children }) => {
  return (
    <SocketProvider>
      {children}
    </SocketProvider>
  );
}; 