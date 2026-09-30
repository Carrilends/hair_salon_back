import { isIP } from 'node:net';

/**
 * Cubo compartido para las peticiones cuya IP no se puede determinar. Que todas
 * caigan juntas es deliberado: sin origen conocido, el tope se aplica igual. Es
 * la versión de «fallar cerrado» para el limitador — nunca un pase libre.
 */
export const CLAVE_DESCONOCIDA = 'desconocida';

/**
 * Clave de cubo del limitador por origen.
 *
 * Por qué no se usa `req.ip` tal cual: en IPv6 un cliente doméstico recibe un
 * prefijo `/64` entero, así que cambiar de dirección dentro de su propia red
 * es gratis y un tope por dirección completa no acotaría nada. Se recorta a los
 * cuatro primeros grupos, que es la unidad que de verdad se asigna a un
 * abonado. En IPv4 no hay nada que recortar.
 *
 * Quién rellena `req.ip` es asunto de Express: con `trust proxy` en 0 es la
 * dirección del socket, y con el número de saltos del despliegue es el extremo
 * que escribió el proxy propio. Aquí no se lee `X-Forwarded-For` a mano
 * precisamente para no confiar en una cabecera que cualquiera puede escribir.
 *
 * Aun así, lo que llega se **valida**: con saltos declarados el valor procede
 * de esa cabecera, y Express no comprueba que sea una dirección. Sin validar,
 * bastaría con enviar una cadena distinta en cada petición para tener un cubo
 * nuevo cada vez —tope infinito— y hacer crecer el mapa una entrada por
 * petición. Lo que no es una dirección va al cubo compartido.
 */
export function clavePorIp(req: { ip?: string }): string {
  const cruda = (req.ip ?? '').trim();
  if (!cruda) return CLAVE_DESCONOCIDA;

  // El identificador de zona (`%eth0`) describe la interfaz local, no al cliente.
  const sinZona = cruda.split('%')[0];

  const familia = isIP(sinZona);
  if (familia === 0) return CLAVE_DESCONOCIDA;
  if (familia === 4) return sinZona;

  // Node entrega las conexiones IPv4 de un socket dual como `::ffff:a.b.c.d`.
  // Sin desenvolverlas, la misma máquina ocuparía dos cubos según el transporte.
  const mapeada = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(sinZona);
  if (mapeada) return mapeada[1];

  const grupos = expandirIpv6(sinZona);
  // Ya se sabe que es IPv6 válida, así que `expandirIpv6` solo devuelve `null`
  // en las formas con IPv4 embebida (`::ffff:c0a8:101` ya salió arriba; queda
  // `a::b:1.2.3.4`). Se usa entera: acota menos de lo ideal, pero nunca agrupa
  // a clientes distintos en un mismo cubo por error.
  return grupos ? grupos.slice(0, 4).join(':') : sinZona;
}

/**
 * Los ocho grupos de una IPv6, con el `::` expandido y sin ceros a la izquierda.
 * `null` si la dirección no tiene la forma esperada.
 */
function expandirIpv6(ip: string): string[] | null {
  const partes = ip.split('::');
  if (partes.length > 2) return null;

  const izquierda = partes[0] ? partes[0].split(':') : [];
  const derecha = partes.length === 2 && partes[1] ? partes[1].split(':') : [];

  if (partes.length === 1) {
    return izquierda.length === 8 ? izquierda.map(normalizarGrupo) : null;
  }

  const faltan = 8 - izquierda.length - derecha.length;
  if (faltan < 0) return null;

  return [...izquierda, ...Array<string>(faltan).fill('0'), ...derecha].map(
    normalizarGrupo,
  );
}

/** `0484` y `484` son el mismo grupo; sin normalizar serían dos cubos. */
function normalizarGrupo(grupo: string): string {
  const valor = Number.parseInt(grupo, 16);
  return Number.isNaN(valor) ? grupo : valor.toString(16);
}
