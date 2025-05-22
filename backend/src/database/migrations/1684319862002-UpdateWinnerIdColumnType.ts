import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateWinnerIdColumnType1684319862002 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop any existing foreign key constraint on winnerId
        await queryRunner.query(`
            ALTER TABLE games 
            DROP CONSTRAINT IF EXISTS FK_games_winner_user
        `);

        // Change the column type to UUID, allowing NULL values
        await queryRunner.query(`
            ALTER TABLE games 
            ALTER COLUMN "winnerId" TYPE uuid USING "winnerId"::uuid,
            ALTER COLUMN "winnerId" DROP NOT NULL
        `);

        // Add the foreign key constraint
        await queryRunner.query(`
            ALTER TABLE games 
            ADD CONSTRAINT FK_games_winner_user 
            FOREIGN KEY ("winnerId") REFERENCES users(id)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop the foreign key constraint
        await queryRunner.query(`
            ALTER TABLE games 
            DROP CONSTRAINT IF EXISTS FK_games_winner_user
        `);

        // Revert the column type to character varying
        await queryRunner.query(`
            ALTER TABLE games 
            ALTER COLUMN "winnerId" TYPE character varying
        `);
    }
} 