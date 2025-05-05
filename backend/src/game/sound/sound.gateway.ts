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
import { PlayerSoundSettings } from './sound.types';

interface SoundToggleData {
  userId: string;
  enabled: boolean;
}

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000'],
    credentials: true,
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
  handleToggleSound(client: Socket, data: SoundToggleData): WsResponse<PlayerSoundSettings> {
    console.log(`Sound toggle request from ${client.id}:`, data);
    
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
  }

  /**
   * Handle sound settings request
   * @param client The socket client
   * @param userId The user ID
   * @returns The user's sound settings
   */
  @SubscribeMessage('getSoundSettings')
  handleGetSoundSettings(client: Socket, userId: string): WsResponse<PlayerSoundSettings> {
    console.log(`Sound settings request from ${client.id} for user ${userId}`);
    
    const settings = this.soundService.getSoundSettings(userId);
    
    return { 
      event: 'soundSettingsResponse', 
      data: settings 
    };
  }
} 