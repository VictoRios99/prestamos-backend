import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class RemoveCodeAndDocumentFromCustomer1755360097885 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
