import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket, WsException } from '@nestjs/websockets';
import { UseGuards, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import * as admin from 'firebase-admin';
import { UsersService } from '../users/users.service';

// Use a different namespace or no namespace if authentication should be global
// For now, let's use a dedicated 'auth' namespace or keep it in the main namespace if preferred.
// Let's stick to the main 'chess' namespace for simplicity if the goal is to authenticate before sending other chess events.
// If the goal is to authenticate *any* socket connection regardless of namespace, it should be global.
// Given the auth errors were on the 'chess' namespace, let's add it there.

@WebSocketGateway({
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  namespace: 'chess', // Or remove namespace if authenticating globally
})
export class AuthGateway {
  private readonly logger = new Logger(AuthGateway.name);

  constructor(private usersService: UsersService) {} // Inject UsersService

  @SubscribeMessage('authenticate')
  async handleAuthenticate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { token: string },
    ack?: (response: { success: boolean; message?: string; userId?: string }) => void,
  ): Promise<void> { // Change return type to void since we're using ack
    try {
      this.logger.log(`Received authenticate request from socket ${client.id}`);

      const { token } = payload;
      
      // Create a safe wrapper for the ack callback
      const safeAck = (response: { success: boolean; message?: string; userId?: string }) => {
        if (typeof ack === 'function') {
          try {
            ack(response);
          } catch (error) {
            this.logger.error(`Error calling ack callback: ${error.message}`);
          }
        } else {
          // If ack is not a function, emit an event instead
          this.logger.warn(`Socket ${client.id}: ack callback not provided, using emit fallback`);
          client.emit('authentication_result', response);
        }
      };
      
      if (!token) {
        this.logger.warn(`Socket ${client.id}: Authentication failed - No token provided.`);
        safeAck({ success: false, message: 'No authentication token provided.' });
        return;
      }

      // Verify the token using Firebase Admin SDK
      const decodedToken = await admin.auth().verifyIdToken(token);
      const firebaseUid = decodedToken.uid;

      this.logger.log(`✅ Socket ${client.id}: Token verified for Firebase UID: ${firebaseUid.substring(0, 6)}...`);

      // Find the user in your database using the firebaseUid
      const user = await this.usersService.findByFirebaseUid(firebaseUid);

      if (!user) {
        this.logger.error(`❌ Socket ${client.id}: User not found in database for Firebase UID: ${firebaseUid}`);
        // Do not disconnect, allow client to try again or use unauthenticated features
        client.data = {}; // Clear any potentially set data
        safeAck({ success: false, message: 'User not found in database.' });
        return;
      }

      this.logger.log(`✅ Socket ${client.id}: Database user found with ID: ${user.id.substring(0, 6)}...`);

      // Attach user data and mark as authenticated using the database user ID
      client.data = {
        ...client.data,
        userId: user.id, // Store the database UUID
        firebaseUid: firebaseUid, // Optionally store firebaseUid as well
        email: user.email,
        emailVerified: decodedToken.email_verified, // Use value from token as it's more up-to-date
        displayName: user.displayName || decodedToken.name, // Prioritize database name, fallback to token
        photoURL: user.photoURL || decodedToken.picture, // Prioritize database photo, fallback to token
        phoneNumber: user.phoneNumber || decodedToken.phone_number, // Prioritize database phone, fallback to token
        isAuthenticated: true, // Mark as authenticated
      };

      // Optionally join a private room for the user ID (database UUID) for targeted messaging
      client.join(user.id);
      this.logger.log(`Socket ${client.id} joined user room ${user.id}`);
      
      // Log room membership
      this.logger.log(`Socket ${client.id} is now in rooms: ${Array.from(client.rooms).join(', ')}`);
      
      // Send the acknowledgment
      this.logger.log(`Socket ${client.id}: Sending authentication success acknowledgment`);
      safeAck({ success: true, message: 'Authentication successful.', userId: user.id });

    } catch (error) {
      this.logger.error(`❌ Socket ${client.id}: Authentication failed - ${error.message}`);
      // Do not disconnect, allow client to try again or use unauthenticated features
      // Clear any potentially set data on failure, but keep socket open
      client.data = {}; // Or selectively clear auth-related data
      
      if (typeof ack === 'function') {
        try {
          ack({ success: false, message: `Authentication failed: ${error.message}` });
        } catch (ackError) {
          this.logger.error(`Error calling ack callback during error handling: ${ackError.message}`);
          client.emit('authentication_result', { success: false, message: `Authentication failed: ${error.message}` });
        }
      } else {
        // Fallback to emit if ack is not a function
        client.emit('authentication_result', { success: false, message: `Authentication failed: ${error.message}` });
      }
    }
  }
}

// You'll need to register this gateway in your backend module (e.g., AppModule or a dedicated WebSocket module) 