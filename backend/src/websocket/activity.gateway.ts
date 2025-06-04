import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { UserActivityService, UserActivityStatus } from '../users/user-activity.service';
import { UsersService } from '../users/users.service';
 
@WebSocketGateway({
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  namespace: 'activity',
  transports: ['websocket'],
})
export class ActivityGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('ActivityGateway');
 
  // Map to track heartbeats for each client
  private lastHeartbeat: Map<string, Date> = new Map();
  // Interval for checking heartbeats
  private heartbeatInterval: NodeJS.Timeout;
  // Heartbeat timeout in milliseconds (20 seconds)
  private readonly heartbeatTimeout = 20000;
 
  constructor(
    private readonly userActivityService: UserActivityService,
    private readonly usersService: UsersService,
  ) {}
 
  /**
   * Helper method to safely get a socket by ID
   * @param socketId The socket ID to find
   * @returns The socket if found, null otherwise
   */
  private safeGetSocket(socketId: string): Socket | null {
    try {
      if (this.server && this.server.sockets && this.server.sockets.sockets) {
        return this.server.sockets.sockets.get(socketId) || null;
      }
      this.logger.warn(`Cannot access socket collection when looking for socket ${socketId}`);
      return null;
    } catch (error) {
      this.logger.error(`Error accessing socket ${socketId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }
 
  /**
   * This method runs when the gateway is initialized
   */
  afterInit() {
    this.logger.log('Activity WebSocket Gateway Initialized');
   
    // Start heartbeat check interval
    this.startHeartbeatCheck();
  }
 
  /**
   * This method runs when a client connects
   */
  async handleConnection(client: Socket) {
    this.logger.log(`Client connected to activity gateway: ${client.id}`);
   
    // Get the Firebase UID from the handshake auth
    const { uid } = client.handshake.auth;
   
    if (!uid) {
      this.logger.warn(`Client ${client.id} connected without uid, disconnecting`);
      client.disconnect();
      return;
    }
   
    // Register the connection
    this.userActivityService.registerConnection(uid, client.id);
   
    // Record initial heartbeat
    this.lastHeartbeat.set(client.id, new Date());
   
    // Broadcast updated user activity to all clients
    this.userActivityService.broadcastActivityUpdates(this.server);
   
    // Send the current state of all users to the newly connected client
    client.emit('initial_activity_state', this.userActivityService.getAllUserActivities());
  }
 
  /**
   * This method runs when a client disconnects
   */
  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from activity gateway: ${client.id}`);
   
    // Register the disconnection
    this.userActivityService.registerDisconnection(client.id);
   
    // Clean up heartbeat tracking
    this.lastHeartbeat.delete(client.id);
   
    // Broadcast updated user activity to all clients
    this.userActivityService.broadcastActivityUpdates(this.server);
  }
 
  /**
   * Handle heartbeats from clients to keep track of active connections
   */
  @SubscribeMessage('heartbeat')
  handleHeartbeat(
    @ConnectedSocket() client: Socket,
  ): void {
    // Update last heartbeat time
    this.lastHeartbeat.set(client.id, new Date());
   
    // Get user ID from socket ID
    const activity = this.userActivityService.getUserActivityBySocketId(client.id);
    if (activity) {
      // Register activity to reset away timer
      this.userActivityService.registerActivity(activity.userId);
    }
  }
 
  /**
   * Get all active users
   */
  @SubscribeMessage('get_active_users')
  handleGetActiveUsers(): { event: string; data: any } {
    return {
      event: 'active_users',
      data: this.userActivityService.getAllUserActivities(),
    };
  }
 
  /**
   * Get activity status for a specific user
   */
  @SubscribeMessage('get_user_activity')
  handleGetUserActivity(
    @MessageBody() payload: { userId: string },
  ): { event: string; data: any } {
    const { userId } = payload;
    const activity = this.userActivityService.getUserActivity(userId);
   
    return {
      event: 'user_activity',
      data: activity || { userId, status: UserActivityStatus.OFFLINE },
    };
  }
 
  /**
   * Set up heartbeat checking interval
   */
  private startHeartbeatCheck() {
    // Check for inactive users every minute (60000 ms)
    this.heartbeatInterval = setInterval(() => {
      const now = new Date();
     
      // Check each client's last heartbeat
      for (const [clientId, lastHeartbeat] of this.lastHeartbeat.entries()) {
        const elapsed = now.getTime() - lastHeartbeat.getTime();
       
        // If heartbeat timeout exceeded, consider the client disconnected
        if (elapsed > this.heartbeatTimeout) {
          this.logger.log(`Client ${clientId} heartbeat timeout, marking as disconnected`);
         
          // Find the socket by ID using safe method
          const socket = this.safeGetSocket(clientId);
          if (socket) {
            // Disconnect the socket
            socket.disconnect(true);
          }
         
          // Register the disconnection
          this.userActivityService.registerDisconnection(clientId);
         
          // Clean up heartbeat tracking in this gateway
          this.lastHeartbeat.delete(clientId);
        }
      }
     
      // Broadcast updated activity statuses
      this.userActivityService.broadcastActivityUpdates(this.server);
    }, 60000); // Check every minute
  }
 
  /**
   * Clean up on module destroy
   */
  onModuleDestroy() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }
}