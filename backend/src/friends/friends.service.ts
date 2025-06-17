import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Friend, FriendStatus } from './friend.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { FriendResponseDto } from './dto';
import { NotificationType } from '../notifications/enums/notification-type.enum';
import * as admin from 'firebase-admin';

@Injectable()
export class FriendsService {
  private readonly logger = new Logger(FriendsService.name);

  constructor(
    @InjectRepository(Friend)
    private friendsRepository: Repository<Friend>,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Validates if the provided ID is in a valid Firebase UID format
   * @param id ID to validate
   * @returns boolean indicating if it's valid
   */
  private isValidFirebaseUID(id: string): boolean {
    if (!id || typeof id !== 'string') {
      return false;
    }
    // Firebase UIDs are typically 28 characters, but can vary
    // They're alphanumeric and we'll allow a range of 20-36 chars to be safe
    return /^[a-zA-Z0-9]{20,36}$/.test(id);
  }

  async sendFriendRequest(senderId: string, receiverId: string): Promise<Friend> {
    this.logger.log(`Sending friend request from ${senderId} to ${receiverId}`);
    
    // Validate UIDs
    if (!this.isValidFirebaseUID(senderId)) {
      this.logger.error(`Invalid sender ID format: ${senderId}`);
      throw new BadRequestException('Invalid sender ID format');
    }
    
    if (!this.isValidFirebaseUID(receiverId)) {
      this.logger.error(`Invalid receiver ID format: ${receiverId}`);
      throw new BadRequestException('Invalid receiver ID format');
    }
    
    // Prevent sending request to self
    if (senderId === receiverId) {
      throw new BadRequestException('Cannot send friend request to yourself');
    }

    // Check if friendship already exists
    const existingFriendship = await this.findExistingFriendship(senderId, receiverId);
    
    if (existingFriendship) {
      if (existingFriendship.status === FriendStatus.ACCEPTED) {
        throw new ConflictException('Already friends with this user');
      } else if (existingFriendship.status === FriendStatus.PENDING) {
        // If the receiver previously sent a request to the sender, accept it
        if (existingFriendship.userId === receiverId && existingFriendship.friendId === senderId) {
          return this.acceptFriendshipDirectly(existingFriendship.id);
        }
        throw new ConflictException('Friend request already sent');
      }
    }

    try {
      // Create a new friend request
      const friendRequest = this.friendsRepository.create({
        userId: senderId,
        friendId: receiverId,
        status: FriendStatus.PENDING,
      });

      const savedRequest = await this.friendsRepository.save(friendRequest);
      this.logger.log(`Friend request saved with ID: ${savedRequest.id}`);

      // Initialize sender information with defaults
      let senderName = 'Someone';
      let senderPhotoURL: string | null = null;
      let senderUsername: string | null = null;
      let senderCustomPhoto: string | null = null;
      let firebaseName: string | null = null;
      let firebasePhotoURL: string | null = null;
      let databaseProfileFound = false;
      
      // FIRST try to get user information from the database (prioritize this)
      try {
        this.logger.log(`Querying database for user with ID: ${senderId}`);
        
        // First, let's check the database schema to understand the structure
        try {
          this.logger.log('Examining database schema for users table');
          const tableInfo = await this.friendsRepository.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users'
            ORDER BY column_name
          `);
          
          this.logger.log(`Users table schema: ${JSON.stringify(tableInfo)}`);
        } catch (schemaError) {
          this.logger.error(`Error checking schema: ${schemaError.message}`);
        }
        
        // Query for the user in the database to get username and custom photo if available
        const query = `
          SELECT 
            u.*
          FROM 
            users u
          WHERE 
            u.id = $1 OR u."firebaseUid" = $1
          LIMIT 1
        `;
        
        this.logger.log(`Executing query: ${query.replace(/\s+/g, ' ')}`);
        this.logger.log(`With parameter: ${senderId}`);
        
        const dbUser = await this.friendsRepository.query(query, [senderId]);
        
        // Log query result
        this.logger.log(`Database query returned ${dbUser?.length || 0} rows`);
        
        if (dbUser && dbUser.length > 0) {
          // Log the exact database row for debugging
          this.logger.log(`Found user in database: ${JSON.stringify(dbUser[0])}`);
          
          // Flag that we found a record in the database
          databaseProfileFound = true;
          
          // Extract username from database if available
          if (dbUser[0].username) {
            senderUsername = dbUser[0].username;
            senderName = dbUser[0].username; // Use as primary name source
            this.logger.log(`Using database username: ${senderUsername}`);
          } else {
            this.logger.log(`Database username is null or empty`);
          }
          
          // Extract custom photo from database if available
          if (dbUser[0].custom_photo_base64) {
            senderCustomPhoto = dbUser[0].custom_photo_base64;
            this.logger.log(`Using database custom_photo_base64`);
          } else {
            this.logger.log(`Database custom_photo_base64 is null or empty`);
          }
          // Otherwise use photoURL if available
          if (dbUser[0].photoURL) {
            senderPhotoURL = dbUser[0].photoURL;
            this.logger.log(`Using database photoURL: ${senderPhotoURL}`);
          }
        } else {
          this.logger.log(`No user found in database for ID: ${senderId}`);
          
          // Let's try to query by firebaseUid only, as a fallback
          this.logger.log(`Trying alternative query with firebaseUid only`);
          const altQuery = `
            SELECT 
              u.id,
              u.username, 
              u."displayName",
              u."photoURL", 
              u.custom_photo_base64,
              u."firebaseUid"
            FROM 
              users u
            WHERE 
              u."firebaseUid" = $1
            LIMIT 1
          `;
          
          const altDbUser = await this.friendsRepository.query(altQuery, [senderId]);
          
          this.logger.log(`Alternative query returned ${altDbUser?.length || 0} rows`);
          
          if (altDbUser && altDbUser.length > 0) {
            // Log the exact database row for debugging
            this.logger.log(`Found user in database (alt query): ${JSON.stringify(altDbUser[0])}`);
            
            // Flag that we found a record in the database
            databaseProfileFound = true;
            
            // Extract username from database if available
            if (altDbUser[0].username) {
              senderUsername = altDbUser[0].username;
              senderName = altDbUser[0].username; // Use as primary name source
              this.logger.log(`Using database username (alt query): ${senderUsername}`);
            }
            
            // Extract custom photo from database if available
            if (altDbUser[0].custom_photo_base64) {
              senderCustomPhoto = altDbUser[0].custom_photo_base64;
              this.logger.log(`Using database custom_photo_base64 (alt query)`);
            } else {
              this.logger.log(`Database custom_photo_base64 is null or empty (alt query)`);
            }
            // Otherwise use photoURL if available
            if (altDbUser[0].photoURL) {
              senderPhotoURL = altDbUser[0].photoURL;
              this.logger.log(`Using database photoURL (alt query): ${senderPhotoURL}`);
            }
          }
        }
      } catch (dbError) {
        this.logger.error(`Error retrieving database user info: ${dbError.message}`);
        this.logger.error(`Stack trace: ${dbError.stack}`);
        // Fall back to Firebase if database query fails
      }
      
      // SECOND if database didn't yield complete results, try Firebase for fallback
      if (!databaseProfileFound || (!senderName && !senderPhotoURL && !senderCustomPhoto)) {
        try {
          // Try to get the user's information from Firebase
          const userRecord = await admin.auth().getUser(senderId);
          
          // Store Firebase data as fallbacks
          firebaseName = userRecord.displayName || userRecord.email?.split('@')[0] || null;
          firebasePhotoURL = userRecord.photoURL || null;
          
          this.logger.log(`Retrieved Firebase sender details: name=${firebaseName}, photoURL=${firebasePhotoURL ? 'Present' : 'None'}, email=${userRecord.email || 'None'}`);
          
          // Try to find the user in the database using their email
          if (userRecord.email) {
            try {
              this.logger.log(`Trying to find user in database by email: ${userRecord.email}`);
              const emailQuery = `
                SELECT *
                FROM users u
                WHERE u.email = $1
                LIMIT 1
              `;
              
              const emailUser = await this.friendsRepository.query(emailQuery, [userRecord.email]);
              
              if (emailUser && emailUser.length > 0) {
                this.logger.log(`Found user in database by email: ${JSON.stringify(emailUser[0])}`);
                databaseProfileFound = true;
                
                // Check for username and update if available
                if (emailUser[0].username) {
                  senderUsername = emailUser[0].username;
                  senderName = emailUser[0].username;
                  this.logger.log(`Using database username from email query: ${senderUsername}`);
                }
                
                // Check for custom photo and update if available
                if (emailUser[0].custom_photo_base64) {
                  senderCustomPhoto = emailUser[0].custom_photo_base64;
                  this.logger.log(`Using database custom_photo_base64 from email query`);
                }
              } else {
                this.logger.log(`No user found in database with email: ${userRecord.email}`);
              }
            } catch (emailError) {
              this.logger.error(`Error finding user by email: ${emailError.message}`);
            }
          }
          
          // Only use Firebase data if we don't have equivalent data from database
          if (!senderName && firebaseName) {
            senderName = firebaseName;
          }
          
          if (!senderPhotoURL && !senderCustomPhoto && firebasePhotoURL) {
            senderPhotoURL = firebasePhotoURL;
          }
        } catch (firebaseError) {
          this.logger.error(`Error retrieving Firebase user info: ${firebaseError.message}`);
          // If both database and Firebase fail, we'll use default values
        }
      }
      
      // Fall back to default name if nothing was found
      if (!senderName) {
        senderName = 'Someone';
      }

      // Prepare notification payload - prioritize specific fields for frontend display
      const notificationData = {
        senderUserId: senderId,
        
        // PRIMARY FIELDS - These should be used by the frontend if available
        username: senderUsername || null,                 // Database username field (PRIMARY)
        custom_photo_base64: senderCustomPhoto || null,   // Database custom photo (PRIMARY)
        
        // SECONDARY FIELDS - Only use these if PRIMARY fields are null
        displayName: senderName || firebaseName || null,
        photoURL: senderPhotoURL || firebasePhotoURL || null,
        
        // Fallback fields (from Firebase)
        firebaseName,
        firebasePhotoURL,
        
        // Flag to indicate source
        fromDatabase: databaseProfileFound,
        
        // Legacy fields for backward compatibility
        senderName,
        senderDisplayName: senderName,
        senderUsername,
        senderCustomPhoto,
        senderPhotoURL,
        
        // Notification specific fields
        message: 'sent you a friend request',
        referenceId: savedRequest.id
      };
      
      // Log the final notification payload for debugging
      this.logger.log(`Final notification payload: ${JSON.stringify(notificationData)}`);
      this.logger.log(`username field set to: ${notificationData.username}`);
      this.logger.log(`custom_photo_base64 field set to: ${notificationData.custom_photo_base64 ? '[base64 data available]' : 'null'}`);
      
      // Send notification to receiver with all available user info
      await this.notificationsService.sendNotification(
        receiverId, 
        'FRIEND_REQUEST' as NotificationType, 
        notificationData
      );

      return savedRequest;
    } catch (error) {
      this.logger.error(`Error saving friend request: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to send friend request');
    }
  }

  async acceptFriendRequest(userId: string, notificationId: string): Promise<Friend> {
    this.logger.log(`Accepting friend request for user ${userId}, notification ${notificationId}`);
    
    // Validate UID
    if (!this.isValidFirebaseUID(userId)) {
      this.logger.error(`Invalid user ID format: ${userId}`);
      throw new BadRequestException('Invalid user ID format');
    }
    
    // Find the notification
    const notificationResult = await this.notificationsService.findOne(notificationId);
    
    if (!notificationResult || notificationResult.recipientUserId !== userId) {
      throw new NotFoundException('Notification not found');
    }

    if (notificationResult.type !== 'FRIEND_REQUEST') {
      throw new BadRequestException('Invalid notification type');
    }

    // Extract referenceId from notification data
    const referenceId = notificationResult.data?.referenceId;
    if (!referenceId) {
      throw new BadRequestException('Invalid notification data');
    }

    // Find the friend request
    const friendRequest = await this.friendsRepository.findOne({
      where: { id: referenceId },
    });

    if (!friendRequest || friendRequest.friendId !== userId) {
      throw new NotFoundException('Friend request not found');
    }

    // Accept the friend request
    const result = await this.acceptFriendshipDirectly(friendRequest.id);

    // Mark notification as PROCESSED (not just read)
    try {
      await this.notificationsService.markAsProcessed(notificationId);
      this.logger.log(`Marked notification ${notificationId} as PROCESSED after accepting friend request`);
    } catch (error) {
      this.logger.error(`Error marking notification as processed: ${error.message}`);
      // Continue even if marking as processed fails
    }

    return result;
  }

  private async acceptFriendshipDirectly(friendshipId: string): Promise<Friend> {
    // Update the friend request status
    const updatedFriendship = await this.friendsRepository.preload({
      id: friendshipId,
      status: FriendStatus.ACCEPTED,
    });

    if (!updatedFriendship) {
      throw new NotFoundException('Friend request not found');
    }

    return this.friendsRepository.save(updatedFriendship);
  }

  async rejectFriendRequest(userId: string, notificationId: string): Promise<void> {
    this.logger.log(`Rejecting friend request for user ${userId}, notification ${notificationId}`);
    
    // Validate UID
    if (!this.isValidFirebaseUID(userId)) {
      this.logger.error(`Invalid user ID format: ${userId}`);
      throw new BadRequestException('Invalid user ID format');
    }
    
    // Find the notification
    const notificationResult = await this.notificationsService.findOne(notificationId);
    
    if (!notificationResult || notificationResult.recipientUserId !== userId) {
      throw new NotFoundException('Notification not found');
    }

    if (notificationResult.type !== 'FRIEND_REQUEST') {
      throw new BadRequestException('Invalid notification type');
    }

    // Extract referenceId from notification data
    const referenceId = notificationResult.data?.referenceId;
    if (!referenceId) {
      throw new BadRequestException('Invalid notification data');
    }

    // Find the friend request
    const friendRequest = await this.friendsRepository.findOne({
      where: { id: referenceId },
    });

    if (!friendRequest || friendRequest.friendId !== userId) {
      throw new NotFoundException('Friend request not found');
    }

    // Update the friend request status
    await this.friendsRepository.update(friendRequest.id, {
      status: FriendStatus.REJECTED,
    });

    // Mark notification as PROCESSED (not just read)
    try {
      await this.notificationsService.markAsProcessed(notificationId);
      this.logger.log(`Marked notification ${notificationId} as PROCESSED after rejecting friend request`);
    } catch (error) {
      this.logger.error(`Error marking notification as processed: ${error.message}`);
      // Continue even if marking as processed fails
    }
  }

  async getFriends(userId: string): Promise<FriendResponseDto[]> {
    this.logger.log(`Getting friends for user ${userId}`);
    
    // Validate UID
    if (!this.isValidFirebaseUID(userId)) {
      this.logger.error(`Invalid user ID format: ${userId}`);
      throw new BadRequestException('Invalid user ID format');
    }
    
    try {
      // Find all accepted friendships where the user is either the sender or receiver
      const friendships = await this.friendsRepository.find({
        where: [
          { userId, status: FriendStatus.ACCEPTED },
          { friendId: userId, status: FriendStatus.ACCEPTED },
        ],
      });

      // Extract the friend IDs (the other user in each friendship)
      const friendIds = friendships.map(friendship => 
        friendship.userId === userId ? friendship.friendId : friendship.userId
      );

      if (friendIds.length === 0) {
        return [];
      }

      // Query the users table to get friend details
      // This query will need to be adjusted based on your User entity structure
      const friends = await this.friendsRepository.query(`
        SELECT 
          u.id, 
          u.username, 
          COALESCE(u."photoURL", u.photo_url) as "avatarUrl", 
          COALESCE(p.rating, 1200) as rating
        FROM 
          users u
        LEFT JOIN 
          profiles p ON u.id = p."userId"
        WHERE 
          u.id IN (${friendIds.map(id => `'${id}'`).join(',')})
      `);

      return friends.map(friend => ({
        id: friend.id,
        username: friend.username,
        avatarUrl: friend.avatarUrl,
        rating: friend.rating,
      }));
    } catch (error) {
      this.logger.error(`Error getting friends: ${error.message}`, error.stack);
      return [];
    }
  }

  async isFriends(userA: string, userB: string): Promise<boolean> {
    this.logger.log(`Checking friendship between ${userA} and ${userB}`);
    
    // Validate UIDs
    if (!this.isValidFirebaseUID(userA) || !this.isValidFirebaseUID(userB)) {
      this.logger.error(`Invalid user ID format: userA=${userA}, userB=${userB}`);
      return false;
    }
    
    try {
      const friendship = await this.findExistingFriendship(userA, userB);
      return friendship?.status === FriendStatus.ACCEPTED;
    } catch (error) {
      this.logger.error(`Error checking friendship: ${error.message}`, error.stack);
      return false;
    }
  }

  private async findExistingFriendship(userA: string, userB: string): Promise<Friend | null> {
    return this.friendsRepository.findOne({
      where: [
        { userId: userA, friendId: userB },
        { userId: userB, friendId: userA },
      ],
    });
  }

  /**
   * Check if two users are friends
   * @param userId The current user's ID
   * @param friendId The potential friend's ID
   * @returns Boolean indicating if they are friends
   */
  async checkFriendship(userId: string, friendId: string): Promise<boolean> {
    // Validate UIDs
    if (!this.isValidFirebaseUID(userId) || !this.isValidFirebaseUID(friendId)) {
      this.logger.error(`Invalid user ID format: ${userId} or ${friendId}`);
      return false;
    }

    // Find friendship in either direction (userId -> friendId or friendId -> userId)
    const friendship = await this.findExistingFriendship(userId, friendId);
    
    // They are friends if a friendship exists and is in ACCEPTED status
    return !!friendship && friendship.status === FriendStatus.ACCEPTED;
  }

  /**
   * Check if there is a pending friend request between users
   * @param userId The current user's ID
   * @param friendId The potential friend's ID
   * @returns Boolean indicating if there is a pending request
   */
  async checkPendingRequest(userId: string, friendId: string): Promise<boolean> {
    // Validate UIDs
    if (!this.isValidFirebaseUID(userId) || !this.isValidFirebaseUID(friendId)) {
      this.logger.error(`Invalid user ID format: ${userId} or ${friendId}`);
      return false;
    }

    // Find friendship in either direction
    const friendship = await this.findExistingFriendship(userId, friendId);
    
    // Check if there's a pending request in either direction
    const isPending = !!friendship && friendship.status === FriendStatus.PENDING;
    
    // Log for debugging
    if (isPending) {
      this.logger.log(`Found pending request between ${userId} and ${friendId}: ${JSON.stringify({
        id: friendship.id,
        from: friendship.userId,
        to: friendship.friendId,
        status: friendship.status
      })}`);
    }
                     
    return isPending;
  }
} 