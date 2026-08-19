/**
 * Reloj del dominio del asistente. Propio del contexto (no se reutiliza el de
 * Reservas), para que el bucle sea determinista en las pruebas.
 */
export interface ClockPort {
  now(): Date;
}
