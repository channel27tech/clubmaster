import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsResponse,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SoundService } from './sound.service';
import { PlayerSoundSettings, PlayerSoundSettingsWithError } from './sound.types';

interface SoundToggleData {
  userId: string;
  enabled: boolean;
}

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'Cache-Control', 'X-Requested-With', 'Range', 'Origin'],
  },
  namespace: 'sound',
})
export class SoundGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly soundService: SoundService) {}

  handleConnection(client: Socket) {
    console.log(`Client connected to sound gateway: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected from sound gateway: ${client.id}`);
  }

  /**
   * Handle sound toggle request
   * @param client The socket client
   * @param data The toggle data
   * @returns The updated sound settings
   */
  @SubscribeMessage('toggleSound')
  handleToggleSound(client: Socket, data: SoundToggleData): WsResponse<PlayerSoundSettings | PlayerSoundSettingsWithError> {
    console.log(`Sound toggle request from ${client.id}:`, data);
    
    try {
      const updatedSettings = this.soundService.updateSoundSettings(
        data.userId,
        data.enabled
      );
      
      // Broadcast the update to all connected clients
      client.broadcast.emit('soundSettingsUpdated', updatedSettings);
      
      return { 
        event: 'soundSettingsUpdated', 
        data: updatedSettings
      };
    } catch (error) {
      console.error('Error handling sound toggle:', error);
      return {
        event: 'soundSettingsError',
        data: { 
          userId: data.userId, 
          soundEnabled: data.enabled, 
          error: 'Failed to update sound settings' 
        } as PlayerSoundSettingsWithError
      };
    }
  }

  /**
   * Handle sound settings request
   * @param client The socket client
   * @param userId The user ID
   * @returns The user's sound settings
   */
  @SubscribeMessage('getSoundSettings')
  handleGetSoundSettings(client: Socket, userId: string): WsResponse<PlayerSoundSettings | PlayerSoundSettingsWithError> {
    console.log(`Sound settings request from ${client.id} for user ${userId}`);
    
    try {
      const settings = this.soundService.getSoundSettings(userId);
      
      return { 
        event: 'soundSettingsResponse', 
        data: settings 
      };
    } catch (error) {
      console.error('Error getting sound settings:', error);
      return {
        event: 'soundSettingsResponse',
        data: { 
          userId, 
          soundEnabled: true, 
          error: 'Failed to get sound settings' 
        } as PlayerSoundSettingsWithError
      };
    }
  }
} 