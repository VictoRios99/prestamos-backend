import { MigrationInterface, QueryRunner } from "typeorm";
export declare class AddLateInterestToPayments1760207496040 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
