import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private static instance: SocketService;

  private constructor() {}

  static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  connect(): Socket {
    if (!this.socket) {
      this.socket = io(process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001', {
        transports: ['websocket'],
        autoConnect: true,
      });

      this.socket.on('connect', () => {
        console.log('Connected to WebSocket server');
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from WebSocket server');
      });

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
      });
    }
    return this.socket;
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Timer-specific methods
  joinGame(gameId: string): void {
    this.socket?.emit('joinGame', { gameId });
  }

  leaveGame(gameId: string): void {
    this.socket?.emit('leaveGame', { gameId });
  }

  initializeTimer(gameId: string, timeControl: 'BULLET' | 'BLITZ' | 'RAPID'): void {
    this.socket?.emit('initializeTimer', { gameId, timeControl });
  }

  startTimer(gameId: string): void {
    this.socket?.emit('startTimer', { gameId });
  }

  pauseTimer(gameId: string): void {
    this.socket?.emit('pauseTimer', { gameId });
  }

  switchTurn(gameId: string): void {
    this.socket?.emit('switchTurn', { gameId });
  }

  getTimerState(gameId: string): void {
    this.socket?.emit('getTimerState', { gameId });
  }
}

export const socketService = SocketService.getInstance(); 