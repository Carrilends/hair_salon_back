import { Logger } from '@nestjs/common';

const logger = new Logger('Configuracion');

/**
 * Los tres estados de una colocación del juicio:
 *
 * - `off`: no se pregunta nada. Es el estado por defecto y el de hoy.
 * - `shadow`: se pregunta, se registra el veredicto y la latencia, y **no se
 *   actúa**. Es el paso obligatorio antes de encender: con unos días de sombra
 *   el umbral se calibra sobre turnos reales en vez de copiarse del banco.
 * - `on`: se pregunta y se actúa.
 */
export const MODOS = ['off', 'shadow', 'on'] as const;
export type ModoDeJuicio = (typeof MODOS)[number];

/**
 * Lee el modo de una colocación del entorno. Un valor ilegible **no enciende
 * nada**: cae a `off` y deja constancia. Es el mismo criterio de
 * `enteroDeEntorno` —un valor mal escrito no puede cambiar el comportamiento en
 * silencio— con el valor seguro puesto donde toca: encender una colocación por
 * un error de tecleo pondría a juzgar turnos de clientas reales sin que nadie
 * lo haya decidido.
 */
export function modoDeEntorno(
  nombre: string,
  porDefecto: ModoDeJuicio = 'off',
  avisar: (mensaje: string) => void = (m) => logger.warn(m),
): ModoDeJuicio {
  const crudo = process.env[nombre];
  if (crudo === undefined) return porDefecto;
  const texto = crudo.trim().toLowerCase();
  if ((MODOS as readonly string[]).includes(texto)) {
    return texto as ModoDeJuicio;
  }
  avisar(
    `${nombre}="${crudo}" no es uno de ${MODOS.join(' | ')}; se deja en off.`,
  );
  return 'off';
}

/**
 * Qué colocaciones del juicio están encendidas. Cada una se decide por
 * separado: el plan recomienda la verificación previa a reservar y el juicio
 * diferido, y deja las otras dos como opcionales.
 */
export interface JudgmentSettings {
  /** (T5) Verificación de correspondencia antes de crear una reserva. */
  reserva: ModoDeJuicio;
  /** (T6) Corte semántico del bucle de herramientas desde la vuelta 3. */
  bucle: ModoDeJuicio;
  /** (T7) Reordenación por relevancia de los resultados de herramienta. */
  orden: ModoDeJuicio;
  /**
   * (T8) Juicio diferido tras responder. No tiene `shadow` porque ya está
   * **fuera del camino crítico**: preguntar sin actuar es todo lo que hace.
   */
  diferido: boolean;
}

const VARIABLES = {
  reserva: 'ASSISTANT_JUDGE_RESERVATION',
  bucle: 'ASSISTANT_JUDGE_LOOP',
  orden: 'ASSISTANT_JUDGE_RERANK',
  diferido: 'ASSISTANT_JUDGE_DEFERRED',
} as const;

const TODO_APAGADO: JudgmentSettings = {
  reserva: 'off',
  bucle: 'off',
  orden: 'off',
  diferido: false,
};

/**
 * Qué colocaciones quedan encendidas, según el entorno y según si hay proveedor
 * de verdad detrás.
 *
 * **Sin proveedor no se enciende nada, y se dice.** Un interruptor en `on` con
 * la clave sin aprovisionar no cambiaba el comportamiento —el adaptador nulo
 * falla y todo pasa abierto—, pero sí preparaba la pregunta: una consulta a la
 * base por cada turno que reservara, a cambio de nada y sin una línea en el
 * log. Es el fallo que nadie relacionaría con la causa, y aquí es donde se
 * corta.
 */
export const ajustesDeJuicioDeEntorno = (
  proveedorDisponible = true,
  avisar: (mensaje: string) => void = (m) => logger.warn(m),
): JudgmentSettings => {
  const pedidos: JudgmentSettings = {
    reserva: modoDeEntorno(VARIABLES.reserva),
    bucle: modoDeEntorno(VARIABLES.bucle),
    orden: modoDeEntorno(VARIABLES.orden),
    diferido: modoDeEntorno(VARIABLES.diferido) !== 'off',
  };
  if (proveedorDisponible) return pedidos;

  const encendidos: string[] = [
    pedidos.reserva !== 'off' ? VARIABLES.reserva : '',
    pedidos.bucle !== 'off' ? VARIABLES.bucle : '',
    pedidos.orden !== 'off' ? VARIABLES.orden : '',
    pedidos.diferido ? VARIABLES.diferido : '',
  ].filter((nombre) => nombre !== '');
  if (encendidos.length) {
    avisar(
      `No hay proveedor de juicios configurado (falta TYPESAFE_API_KEY), así que se ignora ${encendidos.join(', ')} y las colocaciones quedan apagadas.`,
    );
  }
  return TODO_APAGADO;
};
