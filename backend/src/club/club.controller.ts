import { Controller, Get, Post, Body, Req, UsePipes, ValidationPipe, UseGuards, UnauthorizedException, Param, NotFoundException, Patch } from '@nestjs/common';
import { ClubService } from './club.service';
import { CreateClubDto } from './dto/create-club.dto';
import { FirebaseAuthGuard } from '../firebase/firebase-auth.guard';
import { UpdateClubDto } from './dto/update-club.dto';

// Extend the Express Request interface to include our firebaseUser property
interface FirebaseRequest extends Request {
  user: {
    uid: string;
    email?: string;
    emailVerified?: boolean;
    displayName?: string;
  };
}

@Controller('club')
export class ClubController {
  constructor(private readonly clubService: ClubService) {}

  @Get()
  findAll() {
    return this.clubService.findAll();
  }

  @Post()
  @UseGuards(FirebaseAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async create(@Body() createClubDto: CreateClubDto, @Req() req: FirebaseRequest) {
    if (!req.user || !req.user.uid) {
      throw new UnauthorizedException('User authentication required');
    }
    
    // Use actual user ID from Firebase authentication
    return this.clubService.create(createClubDto, req.user.uid);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const club = await this.clubService.findOneById(Number(id));
    if (!club) throw new NotFoundException('Club not found');
    return club;
  }

  @Patch(':id')
  @UseGuards(FirebaseAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async update(
    @Param('id') id: string,
    @Body() updateClubDto: UpdateClubDto,
    @Req() req: FirebaseRequest
  ) {
    return this.clubService.updateClub(Number(id), updateClubDto, req.user.uid);
  }
} 