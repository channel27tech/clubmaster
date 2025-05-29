import { Module, forwardRef } from '@nestjs/common';
import { BetService } from './bet.service';
import { BetGateway } from './bet.gateway';
import { UsersModule } from '../users/users.module';
import { GameModule } from '../game/game.module';

@Module({
  imports: [
    UsersModule,
    forwardRef(() => GameModule),
  ],
  providers: [
    BetService,
    BetGateway,
  ],
  exports: [
    BetService,
  ],
})
export class BetModule {} 