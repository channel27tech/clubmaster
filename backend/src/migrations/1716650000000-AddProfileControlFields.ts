import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProfileControlFields1716650000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profileControlledBy" VARCHAR`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profileControlExpiry" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profileLocked" BOOLEAN DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profileLockExpiry" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "profileControlledBy"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "profileControlExpiry"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "profileLocked"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "profileLockExpiry"`);
  }
} 