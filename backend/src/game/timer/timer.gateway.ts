import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket, OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit } from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { Logger } from '@nestjs/common';
import { TimerService, TimeControl } from './timer.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/',
  transports: ['websocket'],
  pingInterval: 10000,
  pingTimeout: 5000,
})
export class TimerGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  private readonly logger = new Logger(TimerGateway.name);
  private connectedClients: Map<string, Set<string>> = new Map(); // gameId -> Set of socketIds

  constructor(private readonly timerService: TimerService) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    
    // Handle ping manually if needed
    client.on('ping', () => {
      client.emit('pong');
    });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    // Remove client from all game rooms
    this.connectedClients.forEach((clients, gameId) => {
      if (clients.has(client.id)) {
        clients.delete(client.id);
        if (clients.size === 0) {
          this.connectedClients.delete(gameId);
          // Optionally pause the timer when all clients disconnect
          try {
            this.timerService.pauseTimer(gameId);
          } catch (error) {
            this.logger.error(`Failed to pause timer for game ${gameId}: ${error.message}`);
          }
        }
      }
    });
  }

  @SubscribeMessage('joinGame')
  handleJoinGame(
    @MessageBody() data: { gameId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { gameId } = data;
      
      // Add client to game room
      client.join(gameId);
      
      // Track client in our map
      if (!this.connectedClients.has(gameId)) {
        this.connectedClients.set(gameId, new Set());
      }
      const clients = this.connectedClients.get(gameId);
      if (clients) {
        clients.add(client.id);
      }

      this.logger.log(`Client ${client.id} joined game ${gameId}`);

      // Send current timer state if it exists
      const timer = this.timerService.getTimerState(gameId);
      if (timer) {
        client.emit('timerUpdate', {
          gameId: timer.gameId,
          whiteTimeMs: timer.whiteTimeMs,
          blackTimeMs: timer.blackTimeMs,
          isWhiteTurn: timer.isWhiteTurn,
          isRunning: timer.isRunning,
        });
      }

      return { event: 'joinedGame', data: { gameId } };
    } catch (error) {
      this.logger.error(`Error joining game: ${error.message}`);
      return { event: 'error', data: { message: error.message } };
    }
  }

  @SubscribeMessage('leaveGame')
  handleLeaveGame(
    @MessageBody() data: { gameId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { gameId } = data;
      
      // Remove client from game room
      client.leave(gameId);
      
      // Remove from our tracking
      const clients = this.connectedClients.get(gameId);
      if (clients) {
        clients.delete(client.id);
        if (clients.size === 0) {
          this.connectedClients.delete(gameId);
        }
      }

      this.logger.log(`Client ${client.id} left game ${gameId}`);
      
      return { event: 'leftGame', data: { gameId } };
    } catch (error) {
      this.logger.error(`Error leaving game: ${error.message}`);
      return { event: 'error', data: { message: error.message } };
    }
  }

  @SubscribeMessage('initializeTimer')
  handleInitializeTimer(
    @MessageBody() data: { gameId: string; timeControl: TimeControl },
  ) {
    const timer = this.timerService.initializeTimer(data.gameId, data.timeControl);
    return { event: 'timerInitialized', data: timer };
  }

  @SubscribeMessage('startTimer')
  handleStartTimer(@MessageBody() data: { gameId: string }) {
    this.timerService.startTimer(data.gameId);
    return { event: 'timerStarted', data: { gameId: data.gameId } };
  }

  @SubscribeMessage('pauseTimer')
  handlePauseTimer(@MessageBody() data: { gameId: string }) {
    this.timerService.pauseTimer(data.gameId);
    return { event: 'timerPaused', data: { gameId: data.gameId } };
  }

  @SubscribeMessage('switchTurn')
  handleSwitchTurn(@MessageBody() data: { gameId: string }) {
    this.timerService.switchTurn(data.gameId);
    return { event: 'turnSwitched', data: { gameId: data.gameId } };
  }

  @SubscribeMessage('getTimerState')
  handleGetTimerState(@MessageBody() data: { gameId: string }) {
    try {
      const timer = this.timerService.getTimerState(data.gameId);
      if (!timer) {
        return { event: 'error', data: { message: 'Timer not found' } };
      }
      return {
        event: 'timerState',
        data: {
          gameId: timer.gameId,
          whiteTimeMs: timer.whiteTimeMs,
          blackTimeMs: timer.blackTimeMs,
          isWhiteTurn: timer.isWhiteTurn,
          isRunning: timer.isRunning,
        },
      };
    } catch (error) {
      this.logger.error(`Error getting timer state: ${error.message}`);
      return { event: 'error', data: { message: error.message } };
    }
  }
} 