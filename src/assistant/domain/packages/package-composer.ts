import { PackageSlot } from './event-template';

/** Candidato de servicio para una categoría del paquete (proyección pobre). */
export interface PackageCandidate {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
}

export type OmissionReason = 'sin_candidatos' | 'presupuesto_insuficiente';

/** Una línea elegida del paquete, con la categoría de la que salió. */
export interface ComposedLine {
  serviceId: string;
  nombre: string;
  precio: number;
  minutos: number;
  categoria: string;
}

export interface Omission {
  categoria: string;
  motivo: OmissionReason;
}

export interface ComposedPackage {
  lineas: ComposedLine[];
  total: number;
  minutos: number;
  omitidas: Omission[];
  /** false si alguna categoría OBLIGATORIA no pudo cubrirse. */
  completa: boolean;
}

/**
 * Compositor de paquetes por evento: **función pura del dominio**. Algoritmo
 * voraz por prioridad —para cada categoría, en orden de prioridad, elige el
 * candidato más barato que quepa en el presupuesto restante—. Si ninguno cabe (o
 * no hay candidatos), la categoría se omite con su motivo; si esa categoría era
 * obligatoria, la propuesta se marca `completa: false`. Deliberadamente simple: se
 * explica en una frase, se prueba de forma exhaustiva y su comportamiento es
 * predecible. No decide si el paquete cabe en la agenda —de eso se encarga el
 * caso de uso de Reservas (A6) sobre la duración total—.
 */
export function compose(
  plantilla: PackageSlot[],
  candidatosPorCategoria: Map<string, PackageCandidate[]>,
  presupuesto: number | undefined,
): ComposedPackage {
  const slots = [...plantilla].sort((a, b) => a.prioridad - b.prioridad);

  const lineas: ComposedLine[] = [];
  const omitidas: Omission[] = [];
  let total = 0;
  let minutos = 0;
  let restante = presupuesto ?? Infinity;
  let completa = true;

  for (const slot of slots) {
    const candidatos = candidatosPorCategoria.get(slot.categoria) ?? [];
    if (candidatos.length === 0) {
      omitidas.push({ categoria: slot.categoria, motivo: 'sin_candidatos' });
      if (slot.obligatoria) completa = false;
      continue;
    }

    // El más barato de la categoría. Si cabe en el restante, se toma (es el más
    // barato que quepa); si no cabe, ningún otro cabe (todos son ≥ este).
    const masBarato = candidatos.reduce((min, c) =>
      c.price < min.price ? c : min,
    );

    if (masBarato.price > restante) {
      omitidas.push({
        categoria: slot.categoria,
        motivo: 'presupuesto_insuficiente',
      });
      if (slot.obligatoria) completa = false;
      continue;
    }

    lineas.push({
      serviceId: masBarato.id,
      nombre: masBarato.name,
      precio: masBarato.price,
      minutos: masBarato.durationMinutes,
      categoria: slot.categoria,
    });
    total += masBarato.price;
    minutos += masBarato.durationMinutes;
    restante -= masBarato.price;
  }

  return { lineas, total, minutos, omitidas, completa };
}
