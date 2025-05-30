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
      const token = this.extractTokenFromSocket(client);

      if (!token) {
        this.logger.warn('❌ Missing or invalid auth token in socket connection');
        throw new WsException('Unauthorized: Missing or invalid auth token');
      }

      this.logger.log('🔑 Attempting to verify Firebase token in WebSocket...');

      // Verify the token using Firebase Admin SDK
      const decodedToken = await admin.auth().verifyIdToken(token);
      
      // Log successful verification
      this.logger.log(`✅ Socket token verified for user ID: ${decodedToken.uid.substring(0, 6)}...`);
      
      // Attach user data to socket
      client.data = {
        ...client.data,
        userId: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified,
        displayName: decodedToken.name,
        photoURL: decodedToken.picture,
        phoneNumber: decodedToken.phone_number,
      };
      
      return true;
    } catch (error) {
      this.logger.error(`❌ Socket authentication failed: ${error.message}`, error.stack);
      throw new WsException('Unauthorized: Invalid token');
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