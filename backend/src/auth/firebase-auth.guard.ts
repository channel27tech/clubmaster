import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as admin from 'firebase-admin';
 
// This is the guard that is used to authenticate the user
@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
 
    console.log('[FirebaseAuthGuard] Incoming Authorization header:', authHeader);
 
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('[FirebaseAuthGuard] Missing or invalid authorization token');
      throw new UnauthorizedException('Missing or invalid authorization token');
    }
 
    const token = authHeader.split('Bearer ')[1];
 
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      console.log('[FirebaseAuthGuard] Decoded token:', decodedToken);
      // Attach the Firebase UID to the request object
      request.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified,
        displayName: decodedToken.name,
      };
      console.log('[FirebaseAuthGuard] UID set on request.user:', request.user.uid);
      return true;
    } catch (error) {
      console.error('[FirebaseAuthGuard] Token verification failed:', error);
      throw new UnauthorizedException('Invalid or expired Firebase token');
    }
  }
}