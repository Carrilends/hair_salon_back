import { Logger } from '@nestjs/common';
import { AdminEventsGateway, ADMIN_ROOM } from './admin-events.gateway';

type FakeSocket = {
  handshake: { auth: Record<string, unknown> };
  join: jest.Mock;
  disconnect: jest.Mock;
};

function fakeSocket(auth: Record<string, unknown>): FakeSocket {
  return {
    handshake: { auth },
    join: jest.fn(async () => undefined),
    disconnect: jest.fn(),
  };
}

describe('AdminEventsGateway.handleConnection', () => {
  it('desconecta y no une a la sala si no hay token', async () => {
    const jwt = { verify: jest.fn() };
    const users = { findOne: jest.fn() };
    const gateway = new AdminEventsGateway(jwt as any, users as any);
    const client = fakeSocket({});

    await gateway.handleConnection(client as any);

    expect(client.disconnect).toHaveBeenCalled();
    expect(client.join).not.toHaveBeenCalled();
    expect(jwt.verify).not.toHaveBeenCalled();
  });

  it('desconecta si el token no es válido', async () => {
    const jwt = {
      verify: jest.fn(() => {
        throw new Error('token inválido');
      }),
    };
    const users = { findOne: jest.fn() };
    const gateway = new AdminEventsGateway(jwt as any, users as any);
    const client = fakeSocket({ token: 'malo' });

    await gateway.handleConnection(client as any);

    expect(client.disconnect).toHaveBeenCalled();
    expect(client.join).not.toHaveBeenCalled();
  });

  it('desconecta si el usuario es válido pero no es administrador', async () => {
    const jwt = { verify: jest.fn(() => ({ id: 'u-1' })) };
    const users = {
      findOne: jest.fn(async () => ({
        id: 'u-1',
        isActive: true,
        roles: ['user'],
      })),
    };
    const gateway = new AdminEventsGateway(jwt as any, users as any);
    const client = fakeSocket({ token: 'bueno' });

    await gateway.handleConnection(client as any);

    expect(client.disconnect).toHaveBeenCalled();
    expect(client.join).not.toHaveBeenCalled();
  });

  it('une a la sala de administración a un admin autenticado', async () => {
    const jwt = { verify: jest.fn(() => ({ id: 'u-1' })) };
    const users = {
      findOne: jest.fn(async () => ({
        id: 'u-1',
        isActive: true,
        roles: ['admin'],
        email: 'admin@salon.com',
      })),
    };
    const gateway = new AdminEventsGateway(jwt as any, users as any);
    const client = fakeSocket({ token: 'bueno' });

    await gateway.handleConnection(client as any);

    expect(client.join).toHaveBeenCalledWith(ADMIN_ROOM);
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it('registra la conexión con el id, no con el correo del admin', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const jwt = { verify: jest.fn(() => ({ id: 'u-1' })) };
    const users = {
      findOne: jest.fn(async () => ({
        id: 'u-1',
        isActive: true,
        roles: ['admin'],
        email: 'admin@salon.com',
      })),
    };
    const gateway = new AdminEventsGateway(jwt as any, users as any);

    await gateway.handleConnection(fakeSocket({ token: 'bueno' }) as any);

    const escrito = log.mock.calls.map((c) => String(c[0])).join('\n');
    expect(escrito).toContain('u-1');
    expect(escrito).not.toContain('admin@salon.com');
    log.mockRestore();
  });
});
