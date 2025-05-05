import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

const SOCKET_SERVER_URL = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || 'http://localhost:3000';

/**
 * Initialize and get the socket connection
 * @returns Socket instance
 */
export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(`${SOCKET_SERVER_URL}/chess`, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  }
  
  return socket;
};

/**
 * Disconnect the socket
 */
export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

/**
 * Get the connection status
 * @returns True if socket is connected, false otherwise
 */
export const isConnected = (): boolean => {
  return socket?.connected || false;
};

/**
 * Join a game
 * @param gameOptions Game options
 */
export const joinGame = (gameOptions: { gameType: string }): void => {
  if (socket?.connected) {
    socket.emit('joinGame', gameOptions);
  }
};

/**
 * Offer a draw to the opponent
 * @param gameId Game ID
 */
export const offerDraw = (gameId: string): void => {
  if (socket?.connected) {
    socket.emit('offer_draw', { gameId });
  }
};

/**
 * Accept a draw offer
 * @param gameId Game ID
 */
export const acceptDraw = (gameId: string): void => {
  if (socket?.connected) {
    socket.emit('accept_draw', { gameId });
  }
};

/**
 * Decline a draw offer
 * @param gameId Game ID
 */
export const declineDraw = (gameId: string): void => {
  if (socket?.connected) {
    socket.emit('decline_draw', { gameId });
  }
};

/**
 * Resign from a game
 * @param gameId Game ID
 */
export const resignGame = (gameId: string): void => {
  if (socket?.connected) {
    socket.emit('resign_game', { gameId });
  }
};

/**
 * Abort a game
 * @param gameId Game ID
 */
export const abortGame = (gameId: string): void => {
  if (socket?.connected) {
    socket.emit('abort_game', { gameId });
  }
}; 