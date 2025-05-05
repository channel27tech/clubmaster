import { Injectable, Logger } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

export interface GameTimer {
  gameId: string;
  whiteTimeMs: number;
  blackTimeMs: number;
  lastMoveTimestamp: number;
  isWhiteTurn: boolean;
  isRunning: boolean;
  timeControl: TimeControl;
}

export enum TimeControl {
  BULLET = 'BULLET',
  BLITZ = 'BLITZ',
  RAPID = 'RAPID'
}

const TIME_CONTROL_VALUES = {
  [TimeControl.BULLET]: 180000,  // 3 minutes
  [TimeControl.BLITZ]: 300000,   // 5 minutes
  [TimeControl.RAPID]: 600000    // 10 minutes
};

const UPDATE_INTERVAL = 100; // Update every 100ms

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  transports: ['websocket'],
  pingInterval: 10000,
  pingTimeout: 5000,
})
export class TimerService {
  @WebSocketServer()
  private server: Server;
  private readonly logger = new Logger(TimerService.name);

  private activeTimers: Map<string, GameTimer> = new Map();
  private timerIntervals: Map<string, NodeJS.Timeout> = new Map();

  initializeTimer(gameId: string, timeControl: TimeControl): GameTimer {
    // Clean up existing timer if it exists
    this.cleanupTimer(gameId);

    const initialTime = TIME_CONTROL_VALUES[timeControl];
    if (!initialTime) {
      throw new Error(`Invalid time control: ${timeControl}`);
    }

    const timer: GameTimer = {
      gameId,
      whiteTimeMs: initialTime,
      blackTimeMs: initialTime,
      lastMoveTimestamp: Date.now(),
      isWhiteTurn: true,
      isRunning: false,
      timeControl,
    };

    this.activeTimers.set(gameId, timer);
    this.emitTimerUpdate(gameId);
    return timer;
  }

  startTimer(gameId: string): void {
    const timer = this.activeTimers.get(gameId);
    if (!timer) {
      throw new Error(`Timer not found for game: ${gameId}`);
    }

    if (timer.isRunning) {
      throw new Error(`Timer is already running for game: ${gameId}`);
    }

    timer.isRunning = true;
    timer.lastMoveTimestamp = Date.now();
    this.startTimerInterval(gameId);
    this.emitTimerUpdate(gameId);
  }

  pauseTimer(gameId: string): void {
    const timer = this.activeTimers.get(gameId);
    if (!timer) {
      throw new Error(`Timer not found for game: ${gameId}`);
    }

    if (!timer.isRunning) {
      throw new Error(`Timer is not running for game: ${gameId}`);
    }

    this.updateTimerState(timer);
    timer.isRunning = false;
    this.stopTimerInterval(gameId);
    this.emitTimerUpdate(gameId);
  }

  switchTurn(gameId: string): void {
    const timer = this.activeTimers.get(gameId);
    if (!timer) {
      throw new Error(`Timer not found for game: ${gameId}`);
    }

    this.updateTimerState(timer);
    timer.isWhiteTurn = !timer.isWhiteTurn;
    timer.lastMoveTimestamp = Date.now();
    this.emitTimerUpdate(gameId);
  }

  getTimerState(gameId: string): GameTimer | undefined {
    const timer = this.activeTimers.get(gameId);
    if (timer && timer.isRunning) {
      this.updateTimerState(timer);
    }
    return timer;
  }

  private startTimerInterval(gameId: string): void {
    // Clear any existing interval
    this.stopTimerInterval(gameId);

    // Start new interval
    const intervalId = setInterval(() => {
      const timer = this.activeTimers.get(gameId);
      if (!timer || !timer.isRunning) {
        this.stopTimerInterval(gameId);
        return;
      }

      this.updateTimerState(timer);
      this.emitTimerUpdate(gameId);

      // Check for timeout
      if (timer.whiteTimeMs <= 0 || timer.blackTimeMs <= 0) {
        this.handleTimeout(gameId);
      }
    }, UPDATE_INTERVAL);

    this.timerIntervals.set(gameId, intervalId);
  }

  private stopTimerInterval(gameId: string): void {
    const intervalId = this.timerIntervals.get(gameId);
    if (intervalId) {
      clearInterval(intervalId);
      this.timerIntervals.delete(gameId);
    }
  }

  private updateTimerState(timer: GameTimer): void {
    if (!timer.isRunning) return;

    const now = Date.now();
    const elapsed = now - timer.lastMoveTimestamp;

    if (timer.isWhiteTurn) {
      timer.whiteTimeMs = Math.max(0, timer.whiteTimeMs - elapsed);
    } else {
      timer.blackTimeMs = Math.max(0, timer.blackTimeMs - elapsed);
    }

    timer.lastMoveTimestamp = now;
  }

  private handleTimeout(gameId: string): void {
    const timer = this.activeTimers.get(gameId);
    if (!timer) return;

    timer.isRunning = false;
    this.stopTimerInterval(gameId);
    
    // Emit timeout event
    this.server.to(gameId).emit('gameTimeout', {
      gameId,
      winner: timer.whiteTimeMs <= 0 ? 'black' : 'white'
    });
  }

  private emitTimerUpdate(gameId: string): void {
    const timer = this.activeTimers.get(gameId);
    if (!timer) return;

    this.server.to(gameId).emit('timerUpdate', {
      gameId: timer.gameId,
      whiteTimeMs: timer.whiteTimeMs,
      blackTimeMs: timer.blackTimeMs,
      isWhiteTurn: timer.isWhiteTurn,
      isRunning: timer.isRunning
    });
  }

  hasTimeRunOut(gameId: string): boolean {
    const timer = this.activeTimers.get(gameId);
    if (!timer) {
      throw new Error(`Timer not found for game: ${gameId}`);
    }
    
    // Update timer state before checking
    if (timer.isRunning) {
      this.updateTimerState(timer);
    }
    
    return timer.whiteTimeMs <= 0 || timer.blackTimeMs <= 0;
  }

  cleanupTimer(gameId: string): void {
    this.stopTimerInterval(gameId);
    this.activeTimers.delete(gameId);
  }
} 