/**
 * Socket service proxy - forwards to the main socketService.ts
 * @deprecated This file exists for backward compatibility. Please use @/services/socketService.ts directly.
 */

import * as socketServiceImplementation from '@/services/socketService';
import { Socket } from 'socket.io-client';

/**
 * Singleton SocketService class that just forwards to the main socketService.ts
 */
class SocketService {
  private static instance: SocketService;

  private constructor() {
    // Nothing to do here, just forwarding
    console.warn('[DEPRECATED] Using deprecated SocketService class. Please use @/services/socketService.ts directly.');
  }

  static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  // Forward the connect method
  connect(): Socket {
    return socketServiceImplementation.getSocket();
  }

  // Forward all methods
  getSocket(): Socket | null {
    return socketServiceImplementation.getSocket();
  }

  disconnect(): void {
    return socketServiceImplementation.disconnectSocket();
  }

  isConnected(): boolean {
    return socketServiceImplementation.isConnected();
  }

  // Forward timer methods
  joinGame(gameId: string): void {
    socketServiceImplementation.joinGame({ gameType: 'chess' });
  }

  leaveGame(gameId: string): void {
    // Not directly implemented in the functional service
    const socket = socketServiceImplementation.getSocket();
    if (socket?.connected) {
      socket.emit('leaveGame', { gameId });
    }
  }

  // Forward timer initialization with proper conversion
  initializeTimer(gameId: string, timeControlStr: string): void {
    return socketServiceImplementation.initializeTimer(gameId, timeControlStr);
  }

  // Forward other timer methods
  startTimer(gameId: string): void {
    const socket = socketServiceImplementation.getSocket();
    if (socket?.connected) {
      socket.emit('startTimer', { gameId });
    }
  }

  pauseTimer(gameId: string): void {
    const socket = socketServiceImplementation.getSocket();
    if (socket?.connected) {
      socket.emit('pauseTimer', { gameId });
    }
  }

  switchTurn(gameId: string): void {
    const socket = socketServiceImplementation.getSocket();
    if (socket?.connected) {
      socket.emit('switchTurn', { gameId });
    }
  }

  getTimerState(gameId: string): void {
    const socket = socketServiceImplementation.getSocket();
    if (socket?.connected) {
      socket.emit('getTimerState', { gameId });
    }
  }

  // Forward matchmaking methods
  startMatchmaking(options: {
    gameMode?: string;
    timeControl?: string;
    rated?: boolean;
    preferredSide?: string;
  }): void {
    socketServiceImplementation.startMatchmaking(options);
  }

  cancelMatchmaking(): void {
    socketServiceImplementation.cancelMatchmaking();
  }

  // Event handler registration is taken care of by the component directly calling the correct service
}

export const socketService = SocketService.getInstance(); 