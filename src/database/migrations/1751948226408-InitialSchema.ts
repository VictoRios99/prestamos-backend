import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1751948226408 implements MigrationInterface {
    name = 'InitialSchema1751948226408'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('SUPER_ADMIN', 'OPERATOR')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" SERIAL NOT NULL, "username" character varying NOT NULL, "email" character varying NOT NULL, "password" character varying NOT NULL, "full_name" character varying NOT NULL, "role" "public"."users_role_enum" NOT NULL DEFAULT 'OPERATOR', "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username"), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "customers" ("id" SERIAL NOT NULL, "code" character varying NOT NULL, "firstName" character varying NOT NULL, "lastName" character varying NOT NULL, "documentNumber" character varying NOT NULL, "phone" character varying, "email" character varying, "address" text, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdById" integer, CONSTRAINT "UQ_f2eee14aa1fe3e956fe193c142f" UNIQUE ("code"), CONSTRAINT "UQ_dffea8343d90688bccac70b63ad" UNIQUE ("documentNumber"), CONSTRAINT "PK_133ec679a801fab5e070f73d3ea" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."payments_payment_type_enum" AS ENUM('CAPITAL', 'INTEREST', 'BOTH')`);
        await queryRunner.query(`CREATE TABLE "payments" ("id" SERIAL NOT NULL, "payment_date" date NOT NULL, "amount" numeric(12,2) NOT NULL, "payment_type" "public"."payments_payment_type_enum" NOT NULL DEFAULT 'CAPITAL', "payment_method" character varying NOT NULL DEFAULT 'CASH', "receipt_number" character varying, "notes" text, "interest_paid" numeric(12,2) NOT NULL DEFAULT '0', "capital_paid" numeric(12,2) NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "loan_id" integer, "created_by" integer, CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "monthly_payments" ("id" SERIAL NOT NULL, "due_date" date NOT NULL, "expected_amount" numeric(12,2) NOT NULL, "paid_amount" numeric(12,2) NOT NULL DEFAULT '0', "interest_paid" numeric(12,2) NOT NULL DEFAULT '0', "capital_paid" numeric(12,2) NOT NULL DEFAULT '0', "is_paid" boolean NOT NULL DEFAULT false, "payment_date" date, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "loan_id" integer, CONSTRAINT "PK_97593e8159b2d12dc4bfb3d58c7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."loans_status_enum" AS ENUM('ACTIVE', 'PAID', 'OVERDUE', 'CANCELLED')`);
        await queryRunner.query(`CREATE TABLE "loans" ("id" SERIAL NOT NULL, "loan_date" date NOT NULL, "amount" numeric(12,4) NOT NULL, "current_balance" numeric(12,4), "total_interest_paid" numeric(12,4) NOT NULL DEFAULT '0', "total_capital_paid" numeric(12,4) NOT NULL DEFAULT '0', "monthly_interest_rate" numeric(5,4) NOT NULL DEFAULT '5', "status" "public"."loans_status_enum" NOT NULL DEFAULT 'ACTIVE', "notes" text, "months_paid" integer NOT NULL DEFAULT '0', "last_payment_date" date, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "customer_id" integer, "created_by" integer, CONSTRAINT "PK_5c6942c1e13e4de135c5203ee61" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."cash_movements_movementtype_enum" AS ENUM('LOAN_OUT', 'PAYMENT_IN', 'EXPENSE', 'DEPOSIT')`);
        await queryRunner.query(`CREATE TABLE "cash_movements" ("id" SERIAL NOT NULL, "movementDate" date NOT NULL, "movementType" "public"."cash_movements_movementtype_enum" NOT NULL, "amount" numeric(12,2) NOT NULL, "balanceAfter" numeric(12,2) NOT NULL, "referenceType" character varying, "referenceId" integer, "description" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "createdById" integer, CONSTRAINT "PK_25faead19e1ff74153a01604d37" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "customers" ADD CONSTRAINT "FK_aa88a28eac26e514147fc7d2039" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_a150bed3d0ff42298b5044c4021" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_2b505576ec68c4d47782a51a832" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "monthly_payments" ADD CONSTRAINT "FK_26e7c5d32d64d926a25393c6653" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "loans" ADD CONSTRAINT "FK_407d3207500ffa10289f908f0ef" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "loans" ADD CONSTRAINT "FK_c3b93ceba889c7bb9319d0b9e41" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "cash_movements" ADD CONSTRAINT "FK_1517a85666c2d3ca9feefbaf7fc" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "cash_movements" DROP CONSTRAINT "FK_1517a85666c2d3ca9feefbaf7fc"`);
        await queryRunner.query(`ALTER TABLE "loans" DROP CONSTRAINT "FK_c3b93ceba889c7bb9319d0b9e41"`);
        await queryRunner.query(`ALTER TABLE "loans" DROP CONSTRAINT "FK_407d3207500ffa10289f908f0ef"`);
        await queryRunner.query(`ALTER TABLE "monthly_payments" DROP CONSTRAINT "FK_26e7c5d32d64d926a25393c6653"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_2b505576ec68c4d47782a51a832"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_a150bed3d0ff42298b5044c4021"`);
        await queryRunner.query(`ALTER TABLE "customers" DROP CONSTRAINT "FK_aa88a28eac26e514147fc7d2039"`);
        await queryRunner.query(`DROP TABLE "cash_movements"`);
        await queryRunner.query(`DROP TYPE "public"."cash_movements_movementtype_enum"`);
        await queryRunner.query(`DROP TABLE "loans"`);
        await queryRunner.query(`DROP TYPE "public"."loans_status_enum"`);
        await queryRunner.query(`DROP TABLE "monthly_payments"`);
        await queryRunner.query(`DROP TABLE "payments"`);
        await queryRunner.query(`DROP TYPE "public"."payments_payment_type_enum"`);
        await queryRunner.query(`DROP TABLE "customers"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    }

}
