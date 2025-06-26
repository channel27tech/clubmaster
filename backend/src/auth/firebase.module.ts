import { Module, Global, OnModuleInit, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
 
@Global()
@Module({
  providers: [],
  exports: [],
})
 
// This is the module that is used to initialize the Firebase Admin SDK
export class FirebaseModule implements OnModuleInit {
  private readonly logger = new Logger(FirebaseModule.name);
 
  onModuleInit() {
    // Initialize Firebase Admin SDK if not already initialized
    if (!admin.apps.length) {
      try {
        // The application default credentials will be used if service account isn't explicitly set
        admin.initializeApp({
          // If you want to use a service account key file instead of application default credentials:
          // credential: admin.credential.cert(require('path/to/serviceAccountKey.json')),
          credential: admin.credential.applicationDefault(),
        });
        this.logger.log('Firebase Admin SDK initialized successfully');
      } catch (error) {
        this.logger.error(`Failed to initialize Firebase Admin SDK: ${error.message}`, error.stack);
        throw error;
      }
    }
  }
}