import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/auth/entities/user.entity';

export const ADMIN_ROOM = 'admins';

@WebSocketGateway({
  namespace: '/eventos',
  // El socket NO pasa por el proxy de Netlify (N4): para él, el frontend es un
  // origen cruzado y necesita su propia lista de orígenes permitidos.
  cors: {
    origin: (process.env.FRONT_URL ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    credentials: true,
  },
})
export class AdminEventsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(AdminEventsGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      // N5: el token viaja en el handshake `auth`, nunca en la query string
      // (la query queda en los registros de acceso del servidor y del proxy).
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) throw new Error('sin token');

      const payload = this.jwtService.verify<{ id: string }>(token, {
        secret: process.env.JWT_SECRET,
      });
      const user = await this.users.findOne({ where: { id: payload.id } });
      if (!user || !user.isActive || !user.roles.includes('admin')) {
        throw new Error('sin permisos');
      }

      await client.join(ADMIN_ROOM);
      this.logger.log(`Panel conectado (${user.email})`);
    } catch (error) {
      // Desconexión silenciosa: no se le explica al cliente por qué falló.
      this.logger.warn(
        `Conexión de socket rechazada: ${(error as Error).message}`,
      );
      client.disconnect(true);
    }
  }
}
