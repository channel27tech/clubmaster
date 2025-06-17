import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Club } from './club.entity';
import { CreateClubDto } from './dto/create-club.dto';
import { BadRequestException } from '@nestjs/common';
import { User } from '../users/entities/user.entity';
import * as fs from 'fs';
import * as path from 'path';
import { ClubMember } from '../club-member/club-member.entity';
import { UpdateClubDto } from './dto/update-club.dto';

@Injectable()
export class ClubService {
  constructor(
    @InjectRepository(Club)
    private clubRepository: Repository<Club>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(ClubMember)
    private clubMemberRepository: Repository<ClubMember>,
  ) {}

  async findAll(): Promise<any[]> {
    const clubs = await this.clubRepository.find();
    const clubsWithMemberCount = await Promise.all(
      clubs.map(async (club) => {
        const memberCount = await this.clubMemberRepository.count({ where: { clubId: club.id } });
        return { ...club, members: memberCount };
      })
    );
    return clubsWithMemberCount;
  }

  async create(createClubDto: CreateClubDto, firebaseUid: string) {
    // First, get the user record by Firebase UID
    const user = await this.userRepository.findOne({ where: { firebaseUid } });
    if (!user) {
      throw new NotFoundException(`User with Firebase UID ${firebaseUid} not found`);
    }
    
    // Check if user already owns a club
    const existingClub = await this.clubRepository.findOne({ where: { superAdminId: user.id } });
    if (existingClub) {
      throw new BadRequestException('User already owns a club.');
    }

    // Check if club name is unique
    const nameExists = await this.clubRepository.findOne({ where: { name: createClubDto.name } });
    if (nameExists) {
      throw new BadRequestException('Club name already exists.');
    }

    // Handle logo upload (base64 string)
    let logoPath = createClubDto.logo;
    if (logoPath && logoPath.startsWith('data:image/')) {
      // Parse base64 string
      const matches = logoPath.match(/^data:image\/(png|jpeg|jpg|svg\+xml);base64,(.+)$/);
      if (matches) {
        const ext = matches[1] === 'svg+xml' ? 'svg' : matches[1];
        const data = matches[2];
        const buffer = Buffer.from(data, 'base64');
        const filename = `club_${Date.now()}.${ext}`;
        const uploadDir = path.join(__dirname, '../../public/uploads');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        const filePath = path.join(uploadDir, filename);
        try {
          fs.writeFileSync(filePath, buffer);
          console.log(`[ClubService] Logo image written to: ${filePath}`);
          logoPath = `/uploads/${filename}`;
        } catch (err) {
          console.error(`[ClubService] Error writing logo image:`, err);
          // Fallback to default logo if write fails
          logoPath = '/uploads/default-logo.png';
        }
      } else {
        console.warn('[ClubService] Logo base64 string did not match expected pattern. Using default logo.');
        logoPath = '/uploads/default-logo.png';
      }
    } else {
      if (!logoPath) {
        console.log('[ClubService] No logo provided, using default logo.');
        logoPath = '/uploads/default-logo.png';
      } else {
        console.log(`[ClubService] Using provided logo path: ${logoPath}`);
      }
    }

    // Create and save the new club
    const club = this.clubRepository.create({
      ...createClubDto,
      logo: logoPath,
      points: 300,
      credits: 50,
      superAdminId: user.id, // Use actual user ID, not Firebase UID
      ratingLimit: createClubDto.ratingLimit ?? 1000,
    });
    const savedClub = await this.clubRepository.save(club);

    // Add the creator as a club member (super_admin)
    await this.clubMemberRepository.save({
      userId: user.id,
      clubId: savedClub.id,
      role: 'super_admin',
      joinedAt: new Date(),
      rating: user.rating,
      location: user.location || undefined,
    });

    return savedClub;
  }

  async deleteClub(clubId: number) {
    const club = await this.clubRepository.findOne({ where: { id: clubId } });
    if (!club) throw new NotFoundException('Club not found');

    // Only delete if the logo is a file in uploads (not a default or remote image)
    if (club.logo && club.logo.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, '../../public', club.logo);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`[ClubService] Deleted logo file: ${filePath}`);
        }
      } catch (err) {
        console.warn(`[ClubService] Could not delete logo file: ${filePath}`, err);
      }
    }

    // Now delete the club from the database
    await this.clubRepository.delete(clubId);
    console.log(`[ClubService] Deleted club with id: ${clubId}`);
  }

  async findOneById(id: number): Promise<any> {
    // Find the club
    const club = await this.clubRepository.findOne({ where: { id } });
    if (!club) return null;

    // Get all club members with user info
    const clubMembers = await this.clubMemberRepository
      .createQueryBuilder('clubMember')
      .leftJoinAndSelect('clubMember.user', 'user')
      .where('clubMember.clubId = :clubId', { clubId: id })
      .select([
        'clubMember.id',
        'clubMember.role',
        'clubMember.rating',
        'user.id',
        'user.displayName',
        'user.photoURL',
        'user.firebaseUid',
      ])
      .getMany();

    // Map to the desired format, skipping any clubMembers with null user
    const members = clubMembers
      .filter(member => member.user)
      .map(member => ({
        id: member.user.id,
        firebaseUid: member.user.firebaseUid,
        displayName: member.user.displayName,
        photoURL: member.user.photoURL || '/images/default-avatar.svg',
        rating: member.rating,
        role: member.role,
      }));

    // Sort members by rating (highest first)
    members.sort((a, b) => b.rating - a.rating);

    return { 
      ...club, 
      members,
      memberCount: members.length 
    };
  }

  async updateClub(clubId: number, updateClubDto: UpdateClubDto, firebaseUid: string) {
    const club = await this.clubRepository.findOne({ where: { id: clubId } });
    if (!club) throw new NotFoundException('Club not found');

    const user = await this.userRepository.findOne({ where: { firebaseUid } });
    if (!user || club.superAdminId !== user.id) throw new ForbiddenException('Only super admin can edit');

    // Prevent location edit for private_by_location
    if (club.type === 'private_by_location' && updateClubDto.location) {
      delete updateClubDto.location;
    }

    // If name is changing, check uniqueness
    if (updateClubDto.name && updateClubDto.name !== club.name) {
      const exists = await this.clubRepository.findOne({ where: { name: updateClubDto.name } });
      if (exists) throw new BadRequestException('Club name already exists');
    }

    // Handle logo upload if needed (reuse logic from create)
    if (updateClubDto.logo && updateClubDto.logo.startsWith('data:image/')) {
      const matches = updateClubDto.logo.match(/^data:image\/(png|jpeg|jpg|svg\+xml);base64,(.+)$/);
      if (matches) {
        const ext = matches[1] === 'svg+xml' ? 'svg' : matches[1];
        const data = matches[2];
        const buffer = Buffer.from(data, 'base64');
        const filename = `club_${Date.now()}.${ext}`;
        const uploadDir = path.join(__dirname, '../../public/uploads');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        const filePath = path.join(uploadDir, filename);
        try {
          fs.writeFileSync(filePath, buffer);
          updateClubDto.logo = `/uploads/${filename}`;
        } catch (err) {
          updateClubDto.logo = '/uploads/default-logo.png';
        }
      } else {
        updateClubDto.logo = '/uploads/default-logo.png';
      }
    }

    Object.assign(club, updateClubDto);
    return this.clubRepository.save(club);
  }
} 