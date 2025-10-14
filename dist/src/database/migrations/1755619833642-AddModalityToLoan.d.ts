import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class AddModalityToLoan1755619833642 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
