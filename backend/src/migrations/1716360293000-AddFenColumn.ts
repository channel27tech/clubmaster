import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFenColumn1716360293000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "games" ADD COLUMN IF NOT EXISTS "fen" VARCHAR`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "games" DROP COLUMN IF EXISTS "fen"`);
  }
}
