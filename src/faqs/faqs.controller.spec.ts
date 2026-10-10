import {
  BadRequestException,
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { FaqsController } from './faqs.controller';
import { FaqsService, ORDEN_DESACTUALIZADO } from './faqs.service';

const A = '3f1c2b9e-8a4d-4c1e-9b7a-1d2e3f4a5b6c';
const B = '7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d';

/**
 * Sustituye a Passport (la prueba va de rutas, no de JWT). La cabecera
 * `x-rol` dice quién llama; sin ella, nadie. El `UserRoleGuard` es el real:
 * así se comprueba de verdad que la ruta es solo de la dueña.
 */
const pasaporteFalso = {
  canActivate: (contexto: ExecutionContext) => {
    const peticion = contexto.switchToHttp().getRequest();
    const rol = peticion.headers['x-rol'];
    if (!rol) throw new UnauthorizedException();
    peticion.user = { roles: [rol], fullName: 'Prueba' };
    return true;
  },
};

describe('FaqsController (HTTP)', () => {
  let app: INestApplication;
  const servicio = {
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    reordenar: jest.fn(),
  };

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [FaqsController],
      providers: [{ provide: FaqsService, useValue: servicio }],
    })
      .overrideGuard(AuthGuard())
      .useValue(pasaporteFalso)
      .compile();

    app = modulo.createNestApplication();
    // El borde real de `src/main.ts`: prefijo y validación estricta.
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    // `listen(0)` y no `init()`: ver la nota en `mcp.controller.spec.ts`.
    await app.listen(0);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const reordenar = (cuerpo: object, rol: string | null = 'admin') => {
    const peticion = request(app.getHttpServer()).patch('/api/faqs/orden');
    if (rol) peticion.set('x-rol', rol);
    return peticion.send(cuerpo);
  };

  it('PATCH /api/faqs/orden llega a reordenar, no a la edición por id', async () => {
    servicio.reordenar.mockResolvedValue([
      { id: B, sortOrder: 0 },
      { id: A, sortOrder: 1 },
    ]);

    const respuesta = await reordenar({ ids: [B, A] });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.map((faq: { id: string }) => faq.id)).toEqual([B, A]);
    expect(servicio.reordenar).toHaveBeenCalledWith([B, A]);
    expect(servicio.update).not.toHaveBeenCalled();
  });

  it.each([
    ['ids repetidos', { ids: [A, A] }],
    ['una lista vacía', { ids: [] }],
    ['un id que no es uuid', { ids: [A, 'orden'] }],
    ['campos de más', { ids: [A], sortOrder: 1 }],
    ['sin lista', {}],
  ])('responde 400 con %s, sin llegar al servicio', async (_caso, cuerpo) => {
    const respuesta = await reordenar(cuerpo);

    expect(respuesta.status).toBe(400);
    expect(servicio.reordenar).not.toHaveBeenCalled();
  });

  it('el 400 del servicio (la lista cambió) llega tal cual', async () => {
    servicio.reordenar.mockRejectedValue(
      new BadRequestException(ORDEN_DESACTUALIZADO),
    );

    const respuesta = await reordenar({ ids: [A, B] });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.message).toBe(ORDEN_DESACTUALIZADO);
  });

  it('responde 403 si quien llama no es la dueña', async () => {
    const respuesta = await reordenar({ ids: [A, B] }, 'user');

    expect(respuesta.status).toBe(403);
    expect(servicio.reordenar).not.toHaveBeenCalled();
  });

  it('responde 401 sin sesión', async () => {
    const respuesta = await reordenar({ ids: [A, B] }, null);

    expect(respuesta.status).toBe(401);
  });

  it('PATCH /api/faqs/:id sigue editando por id', async () => {
    servicio.update.mockResolvedValue({ id: A });

    const respuesta = await request(app.getHttpServer())
      .patch(`/api/faqs/${A}`)
      .set('x-rol', 'admin')
      .send({ question: '¿Hay parqueadero cerca?' });

    expect(respuesta.status).toBe(200);
    expect(servicio.update).toHaveBeenCalledWith(A, {
      question: '¿Hay parqueadero cerca?',
    });
    expect(servicio.reordenar).not.toHaveBeenCalled();
  });
});
