import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase 5 — Asistente conversacional. Crea las dos tablas del historial (A4):
 * `assistant_conversations` (con la telemetría de tokens acumulada por
 * conversación, §6.2) y `assistant_messages`.
 *
 * Escrita a mano (no autogenerada), como la de la Fase 3a, para no arrastrar el
 * drift del volumen dev ni el churn de TypeORM —que querría dropear la exclusión
 * de solape de M5 y renombrar el FK de `auth_tokens`—.
 *
 * `assistant_conversations.user_id` con ON DELETE SET NULL: borrar una cuenta no
 * borra la traza, pero tampoco deja una FK rota. `assistant_messages.conversation_id`
 * con ON DELETE CASCADE: los mensajes pertenecen a su conversación.
 */
export class AssistantConversations1787154216000 implements MigrationInterface {
  name = 'AssistantConversations1787154216000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "assistant_conversations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid, "summary" text, "prompt_tokens" integer NOT NULL DEFAULT 0, "completion_tokens" integer NOT NULL DEFAULT 0, "message_count" integer NOT NULL DEFAULT 0, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_assistant_conversations_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "assistant_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "conversation_id" uuid NOT NULL, "seq" BIGSERIAL NOT NULL, "role" text NOT NULL, "content" text NOT NULL, "tool_name" text, "tool_call_id" text, "prompt_tokens" integer, "completion_tokens" integer, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_assistant_messages_id" PRIMARY KEY ("id"))`,
    );
    // La ventana se lee por `seq` (orden total de inserción), no por `created_at`:
    // los dos mensajes de un turno comparten timestamp y no darían un orden estable.
    await queryRunner.query(
      `CREATE INDEX "IDX_assistant_messages_conversation_seq" ON "assistant_messages" ("conversation_id", "seq")`,
    );
    await queryRunner.query(
      `ALTER TABLE "assistant_conversations" ADD CONSTRAINT "FK_assistant_conversations_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "assistant_messages" ADD CONSTRAINT "FK_assistant_messages_conversation_id" FOREIGN KEY ("conversation_id") REFERENCES "assistant_conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "assistant_messages" DROP CONSTRAINT "FK_assistant_messages_conversation_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "assistant_conversations" DROP CONSTRAINT "FK_assistant_conversations_user_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_assistant_messages_conversation_seq"`,
    );
    await queryRunner.query(`DROP TABLE "assistant_messages"`);
    await queryRunner.query(`DROP TABLE "assistant_conversations"`);
  }
}
