import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfileController } from './profile.controller';
import { ProfileDataService } from './profile-data.service';
import { User } from '../users/entities/user.entity';
import { Game } from '../game/entities/game.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Game]),
  ],
  controllers: [ProfileController],
  providers: [ProfileDataService],
  exports: [ProfileDataService],
})
export class ProfileModule {}
