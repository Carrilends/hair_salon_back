import {
  WEEKDAY_CLOSE_MIN,
  WEEKDAY_OPEN_MIN,
  WEEKEND_CLOSE_MIN,
  WEEKEND_OPEN_MIN,
} from './salon-schedule';
import { horaEnDoceHoras } from './salon-time';

/** Minutos desde medianoche → «9:00 a. m.» (12 horas, como se dicen en Colombia). */
function enDoceHoras(minutos: number): string {
  return horaEnDoceHoras(Math.floor(minutos / 60), minutos % 60);
}

/**
 * El horario del salón **dicho en palabras**, generado desde
 * `salon-schedule.ts`: «lunes a viernes de 8:00 a. m. a 8:00 p. m.; sábados,
 * domingos y festivos de 9:00 a. m. a 7:00 p. m.».
 *
 * Existe para los prompts del asistente (M-325 a M-327: el modelo dijo que el
 * salón cierra los domingos). Se genera y no se escribe a mano para que no
 * pueda quedarse atrás: si cambia el horario, cambia el prompt.
 */
export function horarioDelSalonEnPalabras(): string {
  return (
    `lunes a viernes de ${enDoceHoras(WEEKDAY_OPEN_MIN)} a ${enDoceHoras(WEEKDAY_CLOSE_MIN)}; ` +
    `sábados, domingos y festivos de ${enDoceHoras(WEEKEND_OPEN_MIN)} a ${enDoceHoras(WEEKEND_CLOSE_MIN)}`
  );
}
