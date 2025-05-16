import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from './entities/user.entity';
import { SyncUserDto } from './dto/sync-user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  async findOne(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findByFirebaseUid(firebaseUid: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { firebaseUid } });
  }

  async create(userData: Partial<User>): Promise<User> {
    const user = this.usersRepository.create(userData);
    return this.usersRepository.save(user);
  }

  async update(id: string, userData: Partial<User>): Promise<User> {
    await this.usersRepository.update(id, userData);
    const updatedUser = await this.findOne(id);
    
    if (!updatedUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    
    return updatedUser;
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    
    await this.usersRepository.delete(id);
  }

  async updateRating(id: string, newRating: number): Promise<User> {
    await this.usersRepository.update(id, { rating: newRating });
    const updatedUser = await this.findOne(id);
    
    if (!updatedUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    
    return updatedUser;
  }

  async incrementGameStats(id: string, result: 'win' | 'loss' | 'draw'): Promise<User> {
    const user = await this.findOne(id);
    
    if (!user) {
      this.logger.warn(`Attempted to update stats for non-existent user: ${id}`);
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    
    // Increment appropriate counter
    switch (result) {
      case 'win':
        user.gamesWon += 1;
        break;
      case 'loss':
        user.gamesLost += 1;
        break;
      case 'draw':
        user.gamesDraw += 1;
        break;
    }
    
    // Always increment total games played
    user.gamesPlayed += 1;
    
    return this.usersRepository.save(user);
  }

  /**
   * Syncs a user from Firebase, handling potential duplicate conflicts
   * Uses a database transaction to ensure atomicity and prevent race conditions
   * 
   * @param firebaseUid - The Firebase UID of the user
   * @param dto - The SyncUserDTO containing user data to sync
   * @returns The synchronized user
   */
  async syncUser(firebaseUid: string, dto: SyncUserDto): Promise<User> {
    this.logger.log(`🔍 Syncing user with Firebase UID: ${firebaseUid.substring(0, 6)}...`);
    
    // Execute everything in a transaction to prevent race conditions
    return this.dataSource.transaction(async (manager) => {
      // Get the User repository from the transaction manager
      const userRepo = manager.getRepository(User);
      
      // Check for existing users by both identifiers separately - within the transaction
      const existingByUid = firebaseUid ? 
        await userRepo.findOne({ where: { firebaseUid } }) : null;
      
      const existingByEmail = dto.email ? 
        await userRepo.findOne({ where: { email: dto.email } }) : null;
      
      // Use either existing record - prioritize the UID match if both exist
      const existing = existingByUid || existingByEmail;
      
      if (existing) {
        // If we found the user by email but they don't have a Firebase UID yet, link them
        if (existingByEmail && !existingByEmail.firebaseUid && firebaseUid) {
          this.logger.log(`🔗 Linking existing email account (${dto.email?.substring(0, 3)}...) to Firebase UID`);
        }
        
        this.logger.log(`🔄 Updating existing user: ID=${existing.id}, Email=${existing.email?.substring(0, 3)}...`);
        
        // Prepare update data
        const updateData: Partial<User> = {
          // Always update firebaseUid to ensure accounts are linked
          firebaseUid,
          // Only update these fields if provided in the DTO
          ...(dto.displayName && { displayName: dto.displayName }),
          ...(dto.photoURL && { photoURL: dto.photoURL }),
          ...(dto.phoneNumber && { phoneNumber: dto.phoneNumber }),
          ...(dto.isAnonymous !== undefined && { isAnonymous: dto.isAnonymous }),
        };
        
        // Update within the transaction
        await userRepo.update(existing.id, updateData);
        
        // Fetch the updated user within the transaction
        const updatedUser = await userRepo.findOne({ where: { id: existing.id } });
        if (!updatedUser) {
          throw new NotFoundException(`User with ID ${existing.id} not found after update`);
        }
        
        this.logger.log(`✅ User updated successfully within transaction`);
        return updatedUser;
      } else {
        // Create new user with default values
        this.logger.log(`➕ Creating new user with Firebase UID: ${firebaseUid.substring(0, 6)}...`);
        
        const newUser = userRepo.create({
          firebaseUid,
          email: dto.email,
          displayName: dto.displayName,
          photoURL: dto.photoURL,
          phoneNumber: dto.phoneNumber,
          isAnonymous: dto.isAnonymous || false,
          // Set default gaming values
          rating: 1500,
          gamesPlayed: 0,
          gamesWon: 0,
          gamesLost: 0,
          gamesDraw: 0,
        });
        
        try {
          // Save within the transaction
          const savedUser = await userRepo.save(newUser);
          this.logger.log(`✅ New user created with ID: ${savedUser.id} inside transaction`);
          return savedUser;
        } catch (error) {
          if (error.code === '23505') { // PostgreSQL duplicate key error
            this.logger.error(`⚠️ Conflict creating user inside transaction: ${error.detail || error.message}`);
            
            // Even in a transaction, there's a small chance of a race condition 
            // with a concurrent transaction that committed first
            // In this case, try to find the user that was just created
            const conflictUser = dto.email 
              ? await userRepo.findOne({ where: { email: dto.email } })
              : await userRepo.findOne({ where: { firebaseUid } });
            
            if (conflictUser) {
              this.logger.log(`🔄 Found conflicting user, returning instead: ${conflictUser.id}`);
              return conflictUser;
            }
            
            throw new ConflictException('A user with this email or UID already exists');
          }
          this.logger.error(`❌ Error saving new user inside transaction: ${error.message}`, error.stack);
          throw error;
        }
      }
    });
  }
} 