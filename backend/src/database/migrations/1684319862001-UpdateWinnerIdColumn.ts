import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateWinnerIdColumn1684319862001 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop existing constraints if any
        await queryRunner.query(`
            ALTER TABLE games 
            DROP CONSTRAINT IF EXISTS FK_games_winner_user
        `);

        // Change column type to UUID and add foreign key constraint
        await queryRunner.query(`
            ALTER TABLE games 
            ALTER COLUMN "winnerId" TYPE uuid USING "winnerId"::uuid,
            ADD CONSTRAINT FK_games_winner_user 
            FOREIGN KEY ("winnerId") REFERENCES users(id)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove foreign key constraint
        await queryRunner.query(`
            ALTER TABLE games 
            DROP CONSTRAINT IF EXISTS FK_games_winner_user
        `);

        // Change column type back to varchar
        await queryRunner.query(`
            ALTER TABLE games 
            ALTER COLUMN "winnerId" TYPE character varying
        `);
    }
} 