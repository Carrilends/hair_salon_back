/**
 * Dirección del salón: la única que conoce el back. La usan el pie del correo
 * (`branded-email.ts`) y los prompts del asistente (`system-prompt.ts`), que no
 * pueden escribirla a mano (M-325 a M-327: un dato del salón escrito en dos
 * sitios acaba diciendo dos cosas). Debe coincidir con
 * `hari_salon_front/src/constants/salon-location.ts`.
 */
export const SALON_ADDRESS = 'Carrera 3 #1-18, Sopó, Cundinamarca';
