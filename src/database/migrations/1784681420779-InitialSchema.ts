import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1784681420779 implements MigrationInterface {
  name = 'InitialSchema1784681420779';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Todas las claves primarias usan `uuid_generate_v4()`. El driver de
    // TypeORM crea la extensión de forma implícita, pero se declara aquí
    // para que la migración sea autosuficiente y reproducible sobre
    // cualquier PostgreSQL vacío (incluido el de Railway).
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE TABLE "tag" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" text NOT NULL, "parentId" uuid, CONSTRAINT "UQ_6a9775008add570dc3e5a0bab7b" UNIQUE ("name"), CONSTRAINT "PK_8e4052373c579afc1471f526760" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "service" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" text NOT NULL, "type" text, "price" numeric NOT NULL, "isSpecial" boolean NOT NULL DEFAULT false, "have_promotion" boolean NOT NULL DEFAULT false, "porcentage_disscount" numeric NOT NULL DEFAULT '0', "duration" integer NOT NULL DEFAULT '30', "slug" text NOT NULL DEFAULT '', "detail_id" uuid NOT NULL, CONSTRAINT "UQ_7806a14d42c3244064b4a1706ca" UNIQUE ("name"), CONSTRAINT "REL_9bbef42f10fafcf9c9fd55f48a" UNIQUE ("detail_id"), CONSTRAINT "PK_85a21558c006647cd76fdce044b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "detail" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "description" text NOT NULL, "specifications" jsonb NOT NULL, CONSTRAINT "PK_28de27ee9ae6103af88ab1b3c0c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "planne" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" text NOT NULL, "servicesIds" text array NOT NULL, "gender" text NOT NULL, "detailId" uuid, CONSTRAINT "UQ_00f8f9fe71b6b2618e721e152d5" UNIQUE ("name"), CONSTRAINT "REL_45a3c2297d340e56b1f8bd24d6" UNIQUE ("detailId"), CONSTRAINT "PK_574b5f18287d22c75431f1f2ae1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "image_manager" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "publicId" text NOT NULL DEFAULT 'example_public_id', "version" text, "url" text NOT NULL DEFAULT '/', "isPrincipal" boolean NOT NULL DEFAULT false, "serviceId" uuid, "planneId" uuid, CONSTRAINT "PK_89adfc523c3ea78eda37d570a7c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "reservations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "scheduled_at" TIMESTAMP WITH TIME ZONE NOT NULL, "ended_at" TIMESTAMP WITH TIME ZONE NOT NULL, "worker_id" uuid NOT NULL, "total_duration_minutes" integer NOT NULL, CONSTRAINT "PK_da95cef71b617ac35dc5bcda243" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "workers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" text NOT NULL, "is_default" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_e950c9aba3bd84a4f193058d838" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "type" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "translateKey" text NOT NULL, CONSTRAINT "PK_40410d6bf0bedb43f9cadae6fef" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" text NOT NULL, "password" text NOT NULL, "fullName" text NOT NULL, "roles" text array NOT NULL DEFAULT '{user}', "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "reviews" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" text NOT NULL, "description" text NOT NULL, "score" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_231ae565c273ee700b283f15c1d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "reviewsByUser" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" uuid NOT NULL, "reviewId" uuid NOT NULL, CONSTRAINT "UQ_bcc2af1fcef0be39cf9c7b176e4" UNIQUE ("userId", "reviewId"), CONSTRAINT "PK_4a2706da5f3b027795254f1ca72" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "faqs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "question" text NOT NULL, "answer" text NOT NULL, "sortOrder" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_2ddf4f2c910f8e8fa2663a67bf0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "service_tags_tag" ("serviceId" uuid NOT NULL, "tagId" uuid NOT NULL, CONSTRAINT "PK_2f1e93522993ff0afb0a8cc0351" PRIMARY KEY ("serviceId", "tagId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_89d3643a767b3c7551c45d9318" ON "service_tags_tag" ("serviceId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6b9529e6d4558dd00fb2e759b1" ON "service_tags_tag" ("tagId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "tag" ADD CONSTRAINT "FK_5f4effb7cd258ffa9ef554cfbbb" FOREIGN KEY ("parentId") REFERENCES "tag"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "service" ADD CONSTRAINT "FK_9bbef42f10fafcf9c9fd55f48a6" FOREIGN KEY ("detail_id") REFERENCES "detail"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "planne" ADD CONSTRAINT "FK_45a3c2297d340e56b1f8bd24d6f" FOREIGN KEY ("detailId") REFERENCES "detail"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "image_manager" ADD CONSTRAINT "FK_b40fd1da30dfcc0990cdbe1171d" FOREIGN KEY ("serviceId") REFERENCES "service"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "image_manager" ADD CONSTRAINT "FK_ba0dd99d3cb65dfa2758535024d" FOREIGN KEY ("planneId") REFERENCES "planne"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" ADD CONSTRAINT "FK_1834ead84dfb79d54d08ff3f3fe" FOREIGN KEY ("worker_id") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviewsByUser" ADD CONSTRAINT "FK_90911aa1d412eb682c7128f0957" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviewsByUser" ADD CONSTRAINT "FK_00e91bb4716a6fe4394ff1e5321" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "service_tags_tag" ADD CONSTRAINT "FK_89d3643a767b3c7551c45d93181" FOREIGN KEY ("serviceId") REFERENCES "service"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "service_tags_tag" ADD CONSTRAINT "FK_6b9529e6d4558dd00fb2e759b19" FOREIGN KEY ("tagId") REFERENCES "tag"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "service_tags_tag" DROP CONSTRAINT "FK_6b9529e6d4558dd00fb2e759b19"`,
    );
    await queryRunner.query(
      `ALTER TABLE "service_tags_tag" DROP CONSTRAINT "FK_89d3643a767b3c7551c45d93181"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviewsByUser" DROP CONSTRAINT "FK_00e91bb4716a6fe4394ff1e5321"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviewsByUser" DROP CONSTRAINT "FK_90911aa1d412eb682c7128f0957"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" DROP CONSTRAINT "FK_1834ead84dfb79d54d08ff3f3fe"`,
    );
    await queryRunner.query(
      `ALTER TABLE "image_manager" DROP CONSTRAINT "FK_ba0dd99d3cb65dfa2758535024d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "image_manager" DROP CONSTRAINT "FK_b40fd1da30dfcc0990cdbe1171d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "planne" DROP CONSTRAINT "FK_45a3c2297d340e56b1f8bd24d6f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "service" DROP CONSTRAINT "FK_9bbef42f10fafcf9c9fd55f48a6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tag" DROP CONSTRAINT "FK_5f4effb7cd258ffa9ef554cfbbb"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6b9529e6d4558dd00fb2e759b1"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_89d3643a767b3c7551c45d9318"`,
    );
    await queryRunner.query(`DROP TABLE "service_tags_tag"`);
    await queryRunner.query(`DROP TABLE "faqs"`);
    await queryRunner.query(`DROP TABLE "reviewsByUser"`);
    await queryRunner.query(`DROP TABLE "reviews"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "type"`);
    await queryRunner.query(`DROP TABLE "workers"`);
    await queryRunner.query(`DROP TABLE "reservations"`);
    await queryRunner.query(`DROP TABLE "image_manager"`);
    await queryRunner.query(`DROP TABLE "planne"`);
    await queryRunner.query(`DROP TABLE "detail"`);
    await queryRunner.query(`DROP TABLE "service"`);
    await queryRunner.query(`DROP TABLE "tag"`);
  }
}
