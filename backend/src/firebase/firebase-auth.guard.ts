import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(FirebaseAuthGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    this.logger.log(`🔒 Processing ${request.method} request to ${request.url}`);
    
    if (!authHeader) {
      this.logger.warn('❌ Missing Authorization header');
      throw new UnauthorizedException('Authorization header is required');
    }
    
    if (!authHeader.startsWith('Bearer ')) {
      this.logger.warn('❌ Invalid Authorization format, expected Bearer token');
      throw new UnauthorizedException('Invalid authorization token format, expected Bearer token');
    }

    const token = authHeader.split('Bearer ')[1];

    if (!token || token.trim() === '') {
      this.logger.warn('❌ Empty token provided');
      throw new UnauthorizedException('Empty token provided');
    }

    this.logger.log('🔑 Attempting to verify Firebase token...');

    try {
      // Verify the token using Firebase Admin SDK
      const decodedToken = await admin.auth().verifyIdToken(token);
      
      // Log successful verification
      this.logger.log(`✅ Token verified for user ID: ${decodedToken.uid.substring(0, 6)}...`);
      
      // Attach Firebase user data to request objects (both conventions)
      const userData = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified,
        displayName: decodedToken.name,
        photoURL: decodedToken.picture,
        phoneNumber: decodedToken.phone_number,
      };
      
      // Set on both firebaseUser and user properties for compatibility
      request.firebaseUser = userData;
      request.user = userData;
      
      return true;
    } catch (error) {
      // Handle different Firebase auth error codes with appropriate messages
      this.logger.error(`❌ Token verification failed: ${error.message}`, error.stack);
      
      let message = 'Invalid Firebase token';
      
      if (error.code === 'auth/id-token-expired') {
        message = 'Firebase token has expired. Please login again.';
      } else if (error.code === 'auth/id-token-revoked') {
        message = 'Firebase token has been revoked. Please login again.';
      } else if (error.code === 'auth/invalid-id-token') {
        message = 'Invalid Firebase token. Please login again.';
      } else if (error.code === 'auth/argument-error') {
        message = 'Invalid token format. Please login again.';
      }
      
      throw new UnauthorizedException(message);
    }
  }
} 