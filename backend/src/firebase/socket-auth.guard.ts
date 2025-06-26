import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import * as admin from 'firebase-admin';
import { Socket } from 'socket.io';

@Injectable()
export class SocketAuthGuard implements CanActivate {
  private readonly logger = new Logger(SocketAuthGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient();
      
      // Remove detailed logging for handshake data as we're changing auth flow
      // this.logger.log(`Socket handshake auth: ${JSON.stringify(client.handshake?.auth)}`);
      // this.logger.log(`Socket handshake headers: ${JSON.stringify(client.handshake?.headers?.authorization)}`);
      // this.logger.log(`Socket handshake query: ${JSON.stringify(client.handshake?.query?.token)}`);

      // Check if the socket has already been authenticated via the 'authenticate' event
      if (client.data?.isAuthenticated) {
        this.logger.log(`Γ£à Socket ${client.id} already authenticated.`);
        return true; // Socket is authenticated, allow access
      }

      // If not authenticated via the event, check for token in handshake (fallback)
      const token = this.extractTokenFromSocket(client);

      if (!token) {
        this.logger.debug(`Socket ${client.id}: No auth token in handshake. Socket will need to authenticate via event.`);
        // Do NOT throw immediately, allow connection for auth event
        return false; // Block access to protected events, socket needs to authenticate
      }

      this.logger.log(`≡ƒöæ Socket ${client.id}: Attempting to verify Firebase token from handshake...`);

      // Verify the token using Firebase Admin SDK (if found in handshake)
      const decodedToken = await admin.auth().verifyIdToken(token);
      
      // Log successful verification
      this.logger.log(`Γ£à Socket ${client.id}: Handshake token verified for user ID: ${decodedToken.uid.substring(0, 6)}...`);
      
      // Mark socket as authenticated and attach user data
      client.data = {
        ...client.data,
        userId: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified,
        displayName: decodedToken.name,
        photoURL: decodedToken.picture,
        phoneNumber: decodedToken.phone_number,
        isAuthenticated: true, // Mark as authenticated
      };
      
      return true; // Authentication successful

    } catch (error) {
      // Log specific error but don't throw here, let it be handled by event handler or lack of auth flag
      this.logger.error(`Γ¥î Socket ${context.switchToWs().getClient().id}: Handshake authentication failed: ${error.message}`);
      // Return false to block access to protected events
      return false;
    }
  }

  private extractTokenFromSocket(client: Socket): string | null {
    // Try to get token from handshake auth
    const authToken = client.handshake?.auth?.token;
    if (authToken) {
      return authToken;
    }

    // Try to get token from handshake headers (Authorization: Bearer token)
    const authHeader = client.handshake?.headers?.authorization;
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Try to get token from handshake query params
    const queryToken = client.handshake?.query?.token;
    if (queryToken && typeof queryToken === 'string') {
      return queryToken;
    }

    return null;
  }
} 