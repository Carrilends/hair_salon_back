/**
 * Minimización de datos en los registros (logs) de producción: un correo o un
 * teléfono completo en Railway es un dato personal más guardado fuera de la
 * base. Se deja lo justo para reconocer el caso al depurar.
 */

/** `lucia.perez@gmail.com` → `l***@gmail.com`. */
export function ocultarCorreo(correo: string | null | undefined): string {
  const arroba = correo?.indexOf('@') ?? -1;
  if (!correo || arroba < 1) return '***';
  return `${correo[0]}***${correo.slice(arroba)}`;
}

/** `573118558210` → `…8210`. */
export function ocultarTelefono(telefono: string | null | undefined): string {
  const digitos = (telefono ?? '').replace(/\D/g, '');
  return digitos.length < 7 ? '…' : `…${digitos.slice(-4)}`;
}
