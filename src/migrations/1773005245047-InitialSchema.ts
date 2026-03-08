import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1773005245047 implements MigrationInterface {
    name = 'InitialSchema1773005245047'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP EXTENSION IF EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE TYPE "public"."invoice_log_status_enum" AS ENUM('pending', 'created', 'sent', 'paid', 'error')`);
        await queryRunner.query(`CREATE TABLE "invoice_log" ("id" SERIAL NOT NULL, "client_mapping_id" integer NOT NULL, "period_year" smallint NOT NULL, "period_month" smallint NOT NULL, "fakturoid_invoice_id" bigint, "fakturoid_number" character varying(50), "total_hours" numeric(8,2) NOT NULL, "total_amount" numeric(12,2) NOT NULL, "status" "public"."invoice_log_status_enum" NOT NULL DEFAULT 'pending', "error_message" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_4bb1d3eab4530678c7f90e69159" UNIQUE ("client_mapping_id", "period_year", "period_month"), CONSTRAINT "PK_1be79907ba240e3a3df70682dc8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "client_mapping" ("id" SERIAL NOT NULL, "name" character varying(255) NOT NULL, "toggl_client_id" bigint NOT NULL, "toggl_workspace_id" bigint NOT NULL, "fakturoid_subject_id" bigint NOT NULL, "hourly_rate" numeric(10,2) NOT NULL, "currency" character varying(3) NOT NULL DEFAULT 'CZK', "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_655e0fe1ed2394ee890968621a2" UNIQUE ("toggl_client_id"), CONSTRAINT "PK_30199bd7c5550760e1d94720cab" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "time_report" ("id" SERIAL NOT NULL, "client_mapping_id" integer NOT NULL, "period_year" smallint NOT NULL, "period_month" smallint NOT NULL, "toggl_project_id" bigint NOT NULL, "project_name" character varying(255) NOT NULL, "total_seconds" integer NOT NULL, "total_hours" numeric(8,2) NOT NULL, "amount" numeric(12,2) NOT NULL, "fetched_at" TIMESTAMP NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_e9a4ccf559bb13027f316b42138" UNIQUE ("client_mapping_id", "period_year", "period_month", "toggl_project_id"), CONSTRAINT "PK_bc9808a1358688365607b8c24fa" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "service_config" ("id" SERIAL NOT NULL, "service_name" character varying(100) NOT NULL, "config_key" character varying(100) NOT NULL, "encrypted_value" bytea, "plain_value" character varying(500), "is_secret" boolean NOT NULL DEFAULT false, "iv" bytea, "auth_tag" bytea, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_57cba1329c50e4689963726d76a" UNIQUE ("service_name", "config_key"), CONSTRAINT "PK_73b7a8a75c1488606fbda13ea59" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "invoice_log" ADD CONSTRAINT "FK_3d64578250ff82db8dbc4ae3e19" FOREIGN KEY ("client_mapping_id") REFERENCES "client_mapping"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "time_report" ADD CONSTRAINT "FK_7f710e3f38052d460e1507f2488" FOREIGN KEY ("client_mapping_id") REFERENCES "client_mapping"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "time_report" DROP CONSTRAINT "FK_7f710e3f38052d460e1507f2488"`);
        await queryRunner.query(`ALTER TABLE "invoice_log" DROP CONSTRAINT "FK_3d64578250ff82db8dbc4ae3e19"`);
        await queryRunner.query(`DROP TABLE "service_config"`);
        await queryRunner.query(`DROP TABLE "time_report"`);
        await queryRunner.query(`DROP TABLE "client_mapping"`);
        await queryRunner.query(`DROP TABLE "invoice_log"`);
        await queryRunner.query(`DROP TYPE "public"."invoice_log_status_enum"`);
    }

}
