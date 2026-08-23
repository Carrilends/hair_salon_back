import { Injectable } from '@nestjs/common';
import { ClockPort } from '../../domain/ports/clock.port';

/** Reloj del sistema. Se sustituye por un doble determinista en las pruebas. */
@Injectable()
export class SystemClock implements ClockPort {
  now(): Date {
    return new Date();
  }
}
