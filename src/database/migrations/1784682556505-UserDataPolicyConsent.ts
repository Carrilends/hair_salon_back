import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserDataPolicyConsent1784682556505 implements MigrationInterface {
  name = 'UserDataPolicyConsent1784682556505';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "data_policy_accepted_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "data_policy_accepted_at"`,
    );
  }
}
