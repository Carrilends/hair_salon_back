/**
 * Una ranura de un paquete por evento: una categoría (nombre de etiqueta REAL del
 * catálogo, verificado contra la BD sembrada), si es obligatoria, y su prioridad
 * al repartir el presupuesto (1 = primero).
 */
export interface PackageSlot {
  categoria: string;
  obligatoria: boolean;
  prioridad: number;
}

/**
 * Plantillas de evento como **constantes de dominio**, no como tabla: evita una
 * migración, se lee de un vistazo y basta para el alcance. Los nombres de
 * categoría son etiquetas reales verificadas en el catálogo (Recogidos, Novia,
 * Manicure, Pedicure, Cejas y pestañas, Quinceañera, Peinados, Social y
 * fotográfico). `###` (Conviene que Marlene valide qué se pide junto en cada
 * evento en Sopó; su criterio vale más que la inferencia desde los datos.)
 */
export const EVENT_TEMPLATES: Record<string, PackageSlot[]> = {
  boda: [
    { categoria: 'Recogidos', obligatoria: true, prioridad: 1 },
    { categoria: 'Novia', obligatoria: true, prioridad: 2 },
    { categoria: 'Manicure', obligatoria: false, prioridad: 3 },
    { categoria: 'Pedicure', obligatoria: false, prioridad: 4 },
    { categoria: 'Cejas y pestañas', obligatoria: false, prioridad: 5 },
  ],
  quinceanera: [
    { categoria: 'Recogidos', obligatoria: true, prioridad: 1 },
    { categoria: 'Quinceañera', obligatoria: true, prioridad: 2 },
    { categoria: 'Manicure', obligatoria: false, prioridad: 3 },
    { categoria: 'Pedicure', obligatoria: false, prioridad: 4 },
  ],
  grado: [
    { categoria: 'Peinados', obligatoria: true, prioridad: 1 },
    { categoria: 'Social y fotográfico', obligatoria: true, prioridad: 2 },
    { categoria: 'Manicure', obligatoria: false, prioridad: 3 },
  ],
};

/** Nombres de evento válidos, para validar la entrada sin exponer el objeto. */
export const EVENT_NAMES = Object.keys(EVENT_TEMPLATES);
