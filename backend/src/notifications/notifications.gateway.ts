import { 
  WebSocketGateway, 
  WebSocketServer, 
  OnGatewayConnection, 
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: '*', // Configure as needed for your frontend
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private userSocketMap = new Map<string, string[]>(); // Maps userId to socketIds

  async handleConnection(client: Socket): Promise<void> {
    try {
      const userId = client.handshake.query.userId as string;
      
      if (!userId) {
        this.logger.warn(`Client connected without userId, disconnecting: ${client.id}`);
        client.disconnect();
        return;
      }

      this.logger.log(`Client connected: ${client.id} for user: ${userId}`);
      
      // Join the user-specific room
      await client.join(userId);
      
      // Track this socket connection for the user
      const userSockets = this.userSocketMap.get(userId) || [];
      userSockets.push(client.id);
      this.userSocketMap.set(userId, userSockets);
      
      // Inform the client they're connected successfully
      client.emit('connection_established', { 
        status: 'connected',
        socketId: client.id,
        timestamp: new Date()
      });
    } catch (error) {
      this.logger.error(`Error in handleConnection: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    try {
      const userId = client.handshake.query.userId as string;
      
      if (userId) {
        // Remove this socket from the user's tracked connections
        const userSockets = this.userSocketMap.get(userId) || [];
        const updatedSockets = userSockets.filter(socketId => socketId !== client.id);
        
        if (updatedSockets.length > 0) {
          this.userSocketMap.set(userId, updatedSockets);
        } else {
          this.userSocketMap.delete(userId);
        }
      }
      
      this.logger.log(`Client disconnected: ${client.id}`);
    } catch (error) {
      this.logger.error(`Error in handleDisconnect: ${error.message}`);
    }
  }

  @SubscribeMessage('join_user_room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string }
  ): { success: boolean } {
    try {
      if (!data.userId) {
        return { success: false };
      }
      
      client.join(data.userId);
      this.logger.log(`Client ${client.id} joined room: ${data.userId}`);
      
      return { success: true };
    } catch (error) {
      this.logger.error(`Error joining room: ${error.message}`);
      return { success: false };
    }
  }

  /**
   * Emit an event to a specific user's room
   * @param userId - The user ID (room) to emit to
   * @param event - The event name
   * @param payload - The data to send
   */
  emitToUser(userId: string, event: string, payload: any): boolean {
    try {
      this.server.to(userId).emit(event, payload);
      this.logger.debug(`Emitted ${event} to user ${userId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to emit ${event} to user ${userId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Get the number of connected clients for a user
   * @param userId - The user ID to check
   * @returns The number of connected clients
   */
  getUserConnectionCount(userId: string): number {
    const sockets = this.userSocketMap.get(userId) || [];
    return sockets.length;
  }
} 