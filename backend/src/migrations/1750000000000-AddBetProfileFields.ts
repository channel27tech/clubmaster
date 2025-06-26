import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBetProfileFields1750000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "controlledNickname" VARCHAR`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "controlledAvatarType" VARCHAR`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "controlledNickname"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "controlledAvatarType"`);
  }
} 