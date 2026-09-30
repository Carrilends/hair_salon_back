import { Logger } from '@nestjs/common';

const logger = new Logger('Configuracion');

/**
 * Lee un entero no negativo del entorno, o cae al valor por defecto avisando.
 *
 * Por qué no vale `Number(process.env.X ?? porDefecto)`, que es lo que había:
 *
 * - `Number('200_000')` es `NaN`, y **toda** comparación contra `NaN` es falsa.
 *   Un tope leído así deja de dispararse sin que nada lo diga. El separador de
 *   millares es exactamente como se escribe el valor por defecto en el código
 *   fuente, así que copiarlo al panel de despliegue es el error más fácil de
 *   cometer y el más difícil de notar: el sistema queda **abierto**.
 * - `Number('')` es `0`, y una variable declarada sin valor es lo normal en un
 *   panel de despliegue. Un tope de cero rechaza a todo el mundo: el asistente
 *   se queda mudo para el público, también sin decir por qué.
 *
 * Un tope que no se puede leer no es un tope. Ante cualquier duda se usa el
 * valor por defecto —que es seguro por construcción— y se deja constancia en
 * el log, que es el único sitio donde alguien va a mirar cuando el
 * comportamiento no cuadre con lo que puso en el panel.
 *
 * El `cero` sí es un valor legítimo cuando se escribe explícitamente: es como
 * se desactiva el techo diario.
 */
export function enteroDeEntorno(
  nombre: string,
  porDefecto: number,
  avisar: (mensaje: string) => void = (m) => logger.warn(m),
): number {
  const crudo = process.env[nombre];
  if (crudo === undefined) return porDefecto;

  const texto = crudo.trim();
  if (texto === '') {
    avisar(
      `${nombre} está declarada pero vacía; se usa el valor por defecto ${porDefecto}.`,
    );
    return porDefecto;
  }

  // `Number.parseInt` se traga la cola («20 # por hora» → 20), así que no sirve
  // aquí: lo que se quiere es detectar el error, no adivinar la intención.
  const valor = Number(texto);
  if (!Number.isInteger(valor) || valor < 0) {
    avisar(
      `${nombre} no es un entero no negativo (se leyó «${texto}»); se usa el valor por defecto ${porDefecto}.`,
    );
    return porDefecto;
  }

  return valor;
}
