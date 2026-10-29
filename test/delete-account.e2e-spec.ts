import { join } from 'path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { AuthModule } from 'src/auth/auth.module';
import { DeleteAccountUseCase } from 'src/auth/application/delete-account.use-case';
import { FailedAttemptLimiter } from 'src/auth/application/failed-attempt-limiter';
import {
  USER_REPOSITORY,
  PASSWORD_HASHER,
  AUTH_UNIT_OF_WORK,
  ACCOUNT_RESERVATIONS,
  ACCOUNT_REVIEWS,
  ACCOUNT_ASSISTANT_DATA,
  AUTH_CLOCK,
} from 'src/auth/application/tokens';
import { AccountAssistantDataPort } from 'src/auth/domain/ports/account-assistant-data.port';
import { ANONYMOUS_REVIEW_NAME } from 'src/auth/domain/account-deletion';
import { CancelReservationUseCase } from 'src/reservations/application/cancel-reservation.use-case';
import { TypeOrmReservationRepository } from 'src/reservations/infrastructure/persistence/typeorm-reservation.repository';
import { ReservationOrmEntity } from 'src/reservations/infrastructure/persistence/reservation.orm-entity';

/**
 * Eliminar la cuenta (DELETE /api/auth/me) contra PostgreSQL real, con las
 * claves de verdad: la transacción, los CASCADE / SET NULL y el vínculo
 * `reviewsByUser` sin `ON DELETE`. Escribe en la base, así que se niega a correr
 * fuera de `HairSalonE2E`. Todos los datos son ficticios y se borran al final.
 *
 * Cubre los focos de revisión 1 (un fallo a medias no deja nada a medias),
 * 2 (admin → 403 sin cambios), 3 (cada cita vigente conserva nombre y un
 * contacto) y 5 (la sesión no sobrevive y WhatsApp aún gestiona la cita).
 *
 * Ejecución: DB_NAME=HairSalonE2E npm run test:e2e -- delete-account
 */
describe('DELETE /api/auth/me (integración, HairSalonE2E)', () => {
  let app: INestApplication;
  let ds: DataSource;

  const sufijo = randomUUID().slice(0, 8);
  const CLAVE = 'Clave-Ficticia-1';
  const clienta = {
    id: randomUUID(),
    email: `clienta-borrar-${sufijo}@correo.test`,
    fullName: 'Clienta Ficticia de Prueba',
  };
  const admin = {
    id: randomUUID(),
    email: `admin-borrar-${sufijo}@correo.test`,
    fullName: 'Administradora Ficticia',
  };
  const TEL = '3009990001';
  const TEL_E164 = '573009990001';

  // Reservas de la clienta.
  const r = {
    sinTelefono: randomUUID(), // pendiente, futura, sin nombre ni contacto
    conTelefono: randomUUID(), // confirmada, futura, con E.164, sin nombre
    paraOtra: randomUUID(), // pendiente, futura, «para otra persona»
    pasada: randomUUID(), // cumplida, ya terminó
  };
  const resena = randomUUID();
  const vinculoResena = randomUUID();
  const conversacion = randomUUID();

  const conectar = () => ({
    type: 'postgres' as const,
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3334),
    username: process.env.DB_USER ?? 'luis',
    password: process.env.DB_PASSWORD ?? '123456',
    database: process.env.DB_NAME,
    entities: [
      join(__dirname, '../src/**/*.entity.ts'),
      join(__dirname, '../src/**/*.orm-entity.ts'),
    ],
    synchronize: false,
  });

  /** Foto de todo lo que la eliminación podría tocar de esta clienta. */
  const foto = async () => ({
    usuarios: await ds.query(
      'SELECT id, email, "fullName", roles FROM users WHERE id = ANY($1) ORDER BY email',
      [[clienta.id, admin.id]],
    ),
    reservas: await ds.query(
      `SELECT id, status, user_id, customer_name, customer_phone,
              customer_phone_e164, customer_email
         FROM reservations WHERE id = ANY($1) ORDER BY id`,
      [Object.values(r)],
    ),
    resenas: await ds.query(
      'SELECT id, name, description, score FROM reviews WHERE id = $1',
      [resena],
    ),
    vinculos: await ds.query('SELECT id FROM "reviewsByUser" WHERE id = $1', [
      vinculoResena,
    ]),
    conversaciones: await ds.query(
      'SELECT id, user_id FROM assistant_conversations WHERE id = $1',
      [conversacion],
    ),
    mensajes: await ds.query(
      'SELECT id FROM assistant_messages WHERE conversation_id = $1',
      [conversacion],
    ),
    sesiones: await ds.query(
      'SELECT id, revoked_at FROM refresh_tokens WHERE user_id = ANY($1) ORDER BY id',
      [[clienta.id, admin.id]],
    ),
  });

  const login = async (email: string) => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: CLAVE })
      .expect(201);
    const setCookie = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
    const cookie = setCookie.find((c) => c.startsWith('marlene_rt='));
    expect(cookie).toBeDefined();
    return {
      token: res.body.token as string,
      cookie: cookie!.split(';')[0],
    };
  };

  beforeAll(async () => {
    if (process.env.DB_NAME !== 'HairSalonE2E') {
      throw new Error(
        'Esta prueba escribe en PostgreSQL y solo corre con DB_NAME=HairSalonE2E',
      );
    }
    // Secreto ficticio solo para firmar los JWT de esta prueba.
    process.env.JWT_SECRET = process.env.JWT_SECRET || `e2e-${randomUUID()}`;

    const moduleRef = await Test.createTestingModule({
      imports: [TypeOrmModule.forRoot(conectar()), AuthModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
    ds = app.get(DataSource);

    // --- Siembra (ficticia) ---
    const hash = await bcrypt.hash(CLAVE, 10);
    await ds.query(
      `INSERT INTO users (id, email, password, "fullName", roles, email_verified_at, data_policy_accepted_at)
       VALUES ($1, $2, $3, $4, '{user}', now(), now()),
              ($5, $6, $3, $7, '{admin}', now(), now())`,
      [
        clienta.id,
        clienta.email,
        hash,
        clienta.fullName,
        admin.id,
        admin.email,
        admin.fullName,
      ],
    );

    const [worker] = await ds.query('SELECT id FROM workers LIMIT 1');
    expect(worker).toBeDefined();
    // Fechas lejanas y en horas distintas: la restricción de exclusión impide
    // que se solapen con la agenda sembrada de la pila E2E.
    const futura = (dia: number) => new Date(Date.UTC(2031, 2, dia, 14, 0));
    const insertar = async (
      id: string,
      inicio: Date,
      status: string,
      extra: {
        name?: string | null;
        phone?: string | null;
        e164?: string | null;
      } = {},
    ) => {
      const fin = new Date(inicio.getTime() + 60 * 60_000);
      await ds.query(
        `INSERT INTO reservations
           (id, scheduled_at, ended_at, worker_id, total_duration_minutes, status,
            user_id, customer_name, customer_phone, customer_phone_e164)
         VALUES ($1, $2, $3, $4, 60, $5, $6, $7, $8, $9)`,
        [
          id,
          inicio,
          fin,
          worker.id,
          status,
          clienta.id,
          extra.name ?? null,
          extra.phone ?? null,
          extra.e164 ?? null,
        ],
      );
      await ds.query(
        `INSERT INTO reservation_services (reservation_id, name, price, duration_minutes)
         VALUES ($1, 'Corte ficticio', 30000, 60)`,
        [id],
      );
    };
    await insertar(r.sinTelefono, futura(3), 'pendiente');
    await insertar(r.conTelefono, futura(4), 'confirmada', {
      phone: TEL,
      e164: TEL_E164,
    });
    await insertar(r.paraOtra, futura(5), 'pendiente', {
      name: 'Otra Persona Ficticia',
      phone: '3009990002',
      e164: '573009990002',
    });
    // La pasada, en una franja fija fuera del horario del salón (03:00 UTC =
    // 22:00 en Bogotá): ninguna reserva sembrada puede ocuparla, así que no
    // choca con la restricción de exclusión. No va a 2020 a propósito: la
    // prueba de la purga corre en paralelo y borra TODA reserva terminada hace
    // más de un mes; hace tres días queda fuera de su alcance.
    const pasada = new Date(Date.now() - 3 * 86_400_000);
    pasada.setUTCHours(3, 0, 0, 0);
    await insertar(r.pasada, pasada, 'cumplida');

    await ds.query(
      `INSERT INTO reviews (id, name, description, score)
       VALUES ($1, $2, 'Reseña ficticia de prueba', 5)`,
      [resena, clienta.fullName],
    );
    await ds.query(
      `INSERT INTO "reviewsByUser" (id, "userId", "reviewId") VALUES ($1, $2, $3)`,
      [vinculoResena, clienta.id, resena],
    );
    await ds.query(
      `INSERT INTO assistant_conversations (id, user_id, message_count) VALUES ($1, $2, 2)`,
      [conversacion, clienta.id],
    );
    await ds.query(
      `INSERT INTO assistant_messages (conversation_id, role, content)
       VALUES ($1, 'user', 'Hola, mensaje ficticio'),
              ($1, 'assistant', 'Respuesta ficticia')`,
      [conversacion],
    );
  });

  afterAll(async () => {
    if (ds?.isInitialized) {
      await ds.query('DELETE FROM reservations WHERE id = ANY($1)', [
        Object.values(r),
      ]);
      await ds.query('DELETE FROM "reviewsByUser" WHERE "userId" = ANY($1)', [
        [clienta.id, admin.id],
      ]);
      await ds.query('DELETE FROM reviews WHERE id = $1', [resena]);
      await ds.query('DELETE FROM assistant_conversations WHERE id = $1', [
        conversacion,
      ]);
      await ds.query('DELETE FROM users WHERE id = ANY($1)', [
        [clienta.id, admin.id],
      ]);
    }
    await app?.close();
  });

  it('sin sesión responde 401', async () => {
    await request(app.getHttpServer())
      .delete('/api/auth/me')
      .send({ password: CLAVE })
      .expect(401);
  });

  it('una administradora no puede borrarse: 403 y nada cambia (foco 2)', async () => {
    const { token } = await login(admin.email);
    const antes = await foto();
    const res = await request(app.getHttpServer())
      .delete('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: CLAVE })
      .expect(403);
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(await foto()).toEqual(antes);
    expect(antes.usuarios.map((u: { id: string }) => u.id)).toContain(admin.id);
  });

  it('el DTO es estricto: un campo desconocido da 400', async () => {
    const { token } = await login(clienta.email);
    await request(app.getHttpServer())
      .delete('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: CLAVE, borrarTodo: true })
      .expect(400);
  });

  it('con la confirmación mala: 422 (no 401) y nada cambia', async () => {
    const { token } = await login(clienta.email);
    const antes = await foto();
    await request(app.getHttpServer())
      .delete('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'No-Es-La-Clave-1' })
      .expect(422);
    // Con contraseña, mandar solo el correo tampoco basta.
    await request(app.getHttpServer())
      .delete('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: clienta.email })
      .expect(422);
    expect(await foto()).toEqual(antes);
  });

  it('si falla el último puerto, la base queda igual (foco 1)', async () => {
    const antes = await foto();
    const real = app.get<AccountAssistantDataPort>(ACCOUNT_ASSISTANT_DATA);
    // Hace su trabajo de verdad (borra conversación y mensajes en el tx) y
    // luego falla: lo ya escrito por los tres puertos tiene que revertirse.
    const queFalla: AccountAssistantDataPort = {
      purge: async (tx: EntityManager, userId: string) => {
        await real.purge(tx, userId);
        throw new Error('fallo forzado en el último puerto');
      },
    };
    const useCase = new DeleteAccountUseCase(
      app.get(USER_REPOSITORY),
      app.get(PASSWORD_HASHER),
      app.get(AUTH_UNIT_OF_WORK),
      app.get(ACCOUNT_RESERVATIONS),
      app.get(ACCOUNT_REVIEWS),
      queFalla,
      app.get(AUTH_CLOCK),
      new FailedAttemptLimiter(5, 15 * 60_000),
    );
    await expect(
      useCase.execute(clienta.id, { password: CLAVE }),
    ).rejects.toThrow('fallo forzado en el último puerto');
    expect(await foto()).toEqual(antes);
  });

  it('borra la cuenta, entrega las citas vigentes sin cancelarlas y cierra la sesión (focos 3, 5a y 5b)', async () => {
    const { token, cookie } = await login(clienta.email);
    const antes = await foto();
    const estadoAntes = Object.fromEntries(
      antes.reservas.map((x: { id: string; status: string }) => [
        x.id,
        x.status,
      ]),
    );

    const res = await request(app.getHttpServer())
      .delete('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', cookie)
      .send({ password: CLAVE })
      .expect(204);
    // La cookie de sesión se limpia (caduca ya) en la ruta de sesión.
    const limpiada = ([] as string[])
      .concat(res.headers['set-cookie'] ?? [])
      .find((c) => c.startsWith('marlene_rt='));
    expect(limpiada).toMatch(/^marlene_rt=;/);
    expect(limpiada).toMatch(/Path=\/api\/auth/);
    expect(limpiada).toMatch(/Expires=Thu, 01 Jan 1970/);

    const despues = await foto();
    // La cuenta ya no existe, sus sesiones cayeron; la admin sigue.
    expect(despues.usuarios.map((u: { id: string }) => u.id)).toEqual([
      admin.id,
    ]);
    expect(
      await ds.query('SELECT id FROM refresh_tokens WHERE user_id = $1', [
        clienta.id,
      ]),
    ).toEqual([]);

    const por = Object.fromEntries(
      despues.reservas.map((x: { id: string }) => [x.id, x]),
    );
    // Todas sin cuenta, ninguna cambió de estado.
    for (const id of Object.values(r)) {
      expect(por[id].user_id).toBeNull();
      expect(por[id].status).toBe(estadoAntes[id]);
    }
    // Vigente sin teléfono: nombre y correo de la cuenta.
    expect(por[r.sinTelefono]).toMatchObject({
      customer_name: clienta.fullName,
      customer_email: clienta.email,
      customer_phone_e164: null,
    });
    // Vigente con E.164: nombre sí, correo no (minimización).
    expect(por[r.conTelefono]).toMatchObject({
      customer_name: clienta.fullName,
      customer_email: null,
      customer_phone_e164: TEL_E164,
    });
    // «Para otra persona»: se respeta su nombre (foco 4, aquí con Postgres).
    expect(por[r.paraOtra]).toMatchObject({
      customer_name: 'Otra Persona Ficticia',
      customer_email: null,
    });
    // Pasada: no se le copia nada.
    expect(por[r.pasada]).toMatchObject({
      customer_name: null,
      customer_email: null,
    });
    // Foco 3: ninguna vigente queda sin nombre ni contacto.
    for (const id of [r.sinTelefono, r.conTelefono, r.paraOtra]) {
      expect(por[id].customer_name?.trim()).toBeTruthy();
      expect(
        por[id].customer_phone_e164 || por[id].customer_email,
      ).toBeTruthy();
    }

    // Reseña: se queda, con el nombre genérico y sin vínculo.
    expect(despues.resenas).toEqual([
      {
        id: resena,
        name: ANONYMOUS_REVIEW_NAME,
        description: 'Reseña ficticia de prueba',
        score: 5,
      },
    ]);
    expect(despues.vinculos).toEqual([]);
    // Asistente: la conversación y sus mensajes se fueron.
    expect(despues.conversaciones).toEqual([]);
    expect(despues.mensajes).toEqual([]);

    // Foco 5a: la cookie anterior ya no renueva la sesión.
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', cookie)
      .expect(401);
    // Y el access token aún sin caducar ya no abre nada: la cuenta no existe.
    await request(app.getHttpServer())
      .get('/api/auth/check-status')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    // Foco 5b: tras el borrado, WhatsApp (actor phone) aún cancela la cita
    // por el teléfono de la reserva, que ya no tiene cuenta.
    const cancelar = new CancelReservationUseCase(
      new TypeOrmReservationRepository(ds.getRepository(ReservationOrmEntity)),
      { now: () => new Date() },
      {
        reservationCreated: async () => undefined,
        reservationCancelled: async () => undefined,
        reservationRescheduled: async () => undefined,
        reservationConfirmed: async () => undefined,
      } as never,
    );
    const cancelada = await cancelar.execute(r.conTelefono, {
      kind: 'phone',
      phoneE164: TEL_E164,
    });
    expect(cancelada.status).toBe('cancelada');
    const [fila] = await ds.query(
      'SELECT status, user_id FROM reservations WHERE id = $1',
      [r.conTelefono],
    );
    expect(fila).toEqual({ status: 'cancelada', user_id: null });
  });
});
