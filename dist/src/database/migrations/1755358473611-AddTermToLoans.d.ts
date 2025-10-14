import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class AddTermToLoans1755358473611 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
