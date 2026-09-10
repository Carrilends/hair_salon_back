import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { useContainer } from 'class-validator';
import cookieParser from 'cookie-parser';

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
