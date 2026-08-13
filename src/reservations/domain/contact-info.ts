/** Datos de contacto de una reserva anónima (sin usuario autenticado). */
export interface ContactInfo {
  name: string;
  phone: string;
  email?: string | null;
}
