import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class AddLoanTypeToLoan1755637581120 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
