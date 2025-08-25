import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddModalityToLoan1755619833642 implements MigrationInterface {
  name = 'AddModalityToLoan1755619833642';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loans" ADD "modality" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "loans" DROP COLUMN "modality"`);
  }
}
