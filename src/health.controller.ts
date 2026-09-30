import { Controller, Get, Req } from '@nestjs/common';

@Controller('health')
export class HealthController {
  /**
   * Además del pulso, devuelve **el origen tal como lo resolvió el servidor**.
   *
   * No es telemetría. De `req.ip` depende el tope por origen del asistente
   * (`NF14`), y `req.ip` depende a su vez de cuántos saltos de proxy propios se
   * declaren en `TRUST_PROXY_HOPS`. Sin poder ver qué dirección resuelve el
   * servidor, ese número se configura a ciegas: quedarse corto mete a todas las
   * visitantes en un mismo contador y pasarse permite falsificar el origen. Con
   * esto, medirlo en el despliegue es una petición con `curl`.
   *
   * Lo que se revela es la dirección de quien pregunta, que ya conoce. No hay
   * nada de terceros aquí.
   */
  @Get()
  health(@Req() req: { ip?: string }) {
    return { ok: true, ip: req.ip ?? null };
  }
}
