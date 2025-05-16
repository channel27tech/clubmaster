import { Controller, Get, Post, Body, Req, UsePipes, ValidationPipe } from '@nestjs/common';
import { ClubService } from './club.service';
import { CreateClubDto } from './dto/create-club.dto';

@Controller('club')
export class ClubController {
  constructor(private readonly clubService: ClubService) {}

  @Get()
  findAll() {
    return this.clubService.findAll();
  }

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async create(@Body() createClubDto: CreateClubDto, @Req() req) {
    // For demonstration, mock userId. In real app, get from auth token/session.
    const userId = req.user?.id || 3; // Replace with real user ID in production
    return this.clubService.create(createClubDto, userId);
  }
} 