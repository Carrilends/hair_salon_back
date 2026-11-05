import {
  AssistantPresentation,
  PresentedService,
} from './assistant-presentation';
import { MAX_SERVICIOS_WHATSAPP } from '../../domain/catalogo-acotado';

export const PESOS = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

/** Los servicios presentados en el turno: sin repetidos, en orden, máximo 6. */
export function serviciosDelTurno(
  p: AssistantPresentation[],
): PresentedService[] {
  const vistos = new Set<string>();
  const salida: PresentedService[] = [];
  for (const x of p) {
    if (x.tipo !== 'servicios') continue;
    for (const sv of x.servicios) {
      if (vistos.has(sv.id)) continue;
      vistos.add(sv.id);
      salida.push(sv);
    }
  }
  return salida.slice(0, MAX_SERVICIOS_WHATSAPP);
}

/** El turno termina en un botón de confirmación. */
export function pideConfirmacion(p: AssistantPresentation[]): boolean {
  return p.some(
    (x) =>
      x.tipo === 'confirmar-reserva' ||
      x.tipo === 'confirmar-cancelacion' ||
      x.tipo === 'confirmar-cambio',
  );
}

/** `1. Corte: $ 35.000 (45 min)` */
export function lineaDeServicio(s: PresentedService, i: number): string {
  return `${i + 1}. ${s.nombre}: ${PESOS.format(s.precio)} (${s.minutos} min)`;
}

/**
 * Lo que se guarda en el historial en lugar de la lista enviada: sin ids ni
 * URL. Vacía si el turno pide confirmación o no hubo servicios.
 */
export function marcaDeServicios(p: AssistantPresentation[]): string {
  if (pideConfirmacion(p)) return '';
  const ss = serviciosDelTurno(p);
  if (ss.length === 0) return '';
  const lineas = ss.map(lineaDeServicio).join(' ; ');
  return `[Se le enviaron aparte, con foto si la hay: ${lineas}]`;
}
