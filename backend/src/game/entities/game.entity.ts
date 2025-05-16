import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('games')
export class Game {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  whitePlayerId: string;

  @Column()
  blackPlayerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'whitePlayerId' })
  whitePlayer: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'blackPlayerId' })
  blackPlayer: User;

  @Column({ nullable: true })
  winnerId: string;

  @Column({ default: 'ongoing' })
  status: 'ongoing' | 'white_win' | 'black_win' | 'draw' | 'aborted';

  @Column({ default: false })
  rated: boolean;

  @Column({ default: 1500 })
  whitePlayerRating: number;

  @Column({ default: 1500 })
  blackPlayerRating: number;

  @Column({ nullable: true })
  endReason: string;

  @Column({ default: '5+0' })
  timeControl: string;

  @Column({ type: 'text', nullable: true })
  pgn: string;

  @Column({ type: 'jsonb', nullable: true })
  moves: any[];

  @Column({ type: 'int', default: 0 })
  totalMoves: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 