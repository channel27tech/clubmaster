import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Club } from './club.entity';
import { CreateClubDto } from './dto/create-club.dto';
import { BadRequestException } from '@nestjs/common';

@Injectable()
export class ClubService {
  constructor(
    @InjectRepository(Club)
    private clubRepository: Repository<Club>,
  ) {}

  async findAll(): Promise<Club[]> {
    return this.clubRepository.find();
  }

  async create(createClubDto: CreateClubDto, userId: number) {
    // Check if user already owns a club
    const existingClub = await this.clubRepository.findOne({ where: { superAdminId: userId } });
    if (existingClub) {
      throw new BadRequestException('User already owns a club.');
    }

    // Check if club name is unique
    const nameExists = await this.clubRepository.findOne({ where: { name: createClubDto.name } });
    if (nameExists) {
      throw new BadRequestException('Club name already exists.');
    }

    // Create and save the new club
    const club = this.clubRepository.create({
      ...createClubDto,
      points: 300,
      credits: 50,
      superAdminId: userId,
    });
    return this.clubRepository.save(club);
  }
} 