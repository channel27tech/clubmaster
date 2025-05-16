import { Module, Global, OnModuleInit, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

@Global()
@Module({
  providers: [],
  exports: [],
})
export class FirebaseModule implements OnModuleInit {
  private readonly logger = new Logger(FirebaseModule.name);

  onModuleInit() {
    // Initialize Firebase Admin SDK if not already initialized
    if (!admin.apps.length) {
      try {
        this.logger.log('⚙️ Initializing Firebase Admin SDK...');
        
        // Set path to the service account file
        const serviceAccountPath = path.join(process.cwd(), 'src/config/clubmaster-chess-firebase-adminsdk-fbsvc-22fbf6838f.json');
        
        // Check if the service account file exists
        if (!fs.existsSync(serviceAccountPath)) {
          this.logger.error(`❌ Firebase service account file not found at: ${serviceAccountPath}`);
          throw new Error('Firebase service account file not found');
        }
        
        // Load service account from file
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        
        // Initialize the Firebase Admin SDK with the service account
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        
        this.logger.log('🔥 Firebase Admin SDK initialized successfully');
        
        // Test the Firebase Admin SDK connection
        admin.auth().listUsers(1)
          .then(() => this.logger.log('✅ Firebase Admin authentication test succeeded'))
          .catch(error => {
            this.logger.error(`⚠️ Firebase Admin authentication test failed: ${error.message}`);
            // Don't throw here - just log the error
          });
          
      } catch (error) {
        this.logger.error(`❌ Failed to initialize Firebase Admin SDK: ${error.message}`, error.stack);
        throw error;
      }
    } else {
      this.logger.log('👍 Firebase Admin SDK already initialized');
    }
  }
} 