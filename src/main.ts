import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { useContainer } from 'class-validator';
import cookieParser from 'cookie-parser';
import { enteroDeEntorno } from './common/config/entero-de-entorno';
import { middlewareIpDeNetlify } from './common/netlify-client-ip';

async function bootstrap() {
  // `rawBody: true` conserva los bytes crudos de cada petición además del cuerpo
  // ya analizado. Lo exige el webhook de WhatsApp: Meta firma con
  // `X-Hub-Signature-256` un HMAC sobre los BYTES, y sobre el objeto reanalizado
  // la firma no cuadraría (el orden de claves y el espaciado no se conservan).
  // No cambia el análisis ni la `ValidationPipe`; el resto de rutas no se entera.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  app.setGlobalPrefix('api');

  // Cuántos proxies propios hay delante. De ello depende qué acaba en `req.ip`,
  // y de `req.ip` depende el tope por origen del asistente.
  //
  // `X-Forwarded-For` la puede escribir cualquiera, así que leerla a pelo no
  // protege de nada: quien quisiera saltarse el tope inventaría una IP por
  // petición. Contando saltos, Express se queda con la entrada que escribió el
  // proxy más cercano que sí controlamos y descarta lo que traía el cliente.
  //
  // Por defecto 0 —no se confía en nadie y `req.ip` es la dirección del
  // socket—, que es lo correcto en local y en Docker. En el despliegue previsto
  // (Netlify → Railway → contenedor) hay que fijarlo; con el valor de menos,
  // todo el mundo compartiría el cubo del proxy y el tope echaría a clientas
  // reales. Ver `TRUST_PROXY_HOPS` en `.env.example`.
  const saltosDeProxy = enteroDeEntorno('TRUST_PROXY_HOPS', 0);
  app.set('trust proxy', saltosDeProxy);
  // El aviso mira el valor EFECTIVO, no si la variable está declarada: el
  // `.env.example` la trae a 0 y copiarlo tal cual es lo normal al desplegar.
  // Con 0 detrás de un proxy, `req.ip` es la dirección del proxy para todo el
  // mundo y el tope por origen acabaría echando a clientas reales.
  if (process.env.NODE_ENV === 'production' && saltosDeProxy === 0) {
    new Logger('Bootstrap').warn(
      'TRUST_PROXY_HOPS efectivo = 0 en produccion: si hay un proxy delante, TODAS las peticiones compartiran el tope por origen del asistente. Mide el valor con GET /api/health.',
    );
  }

  // Detrás del proxy de Netlify, contar saltos no basta: la IP de la clienta no
  // llega en una posición fija de `X-Forwarded-For` (medido el 2026-11-17).
  // Con el proxy firmado (`signed` en `netlify.toml`) y el mismo secreto aquí,
  // `req.ip` pasa a ser la de `x-nf-client-connection-ip`; sin firma válida no
  // cambia nada. Ver `src/common/netlify-client-ip.ts`.
  const secretoProxyNetlify = process.env.NETLIFY_PROXY_SECRET?.trim();
  app.use(middlewareIpDeNetlify(secretoProxyNetlify));
  if (process.env.NODE_ENV === 'production' && !secretoProxyNetlify) {
    new Logger('Bootstrap').warn(
      'NETLIFY_PROXY_SECRET sin definir en produccion: las peticiones que llegan por el proxy de Netlify compartiran el tope por origen del asistente por nodo de Netlify.',
    );
  }

  // Lee la cookie httpOnly del refresh token (Fase 3b) en req.cookies.
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  const frontUrl = process.env.FRONT_URL;
  app.enableCors({
    origin: frontUrl ? frontUrl.split(',').map((s) => s.trim()) : true,
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
