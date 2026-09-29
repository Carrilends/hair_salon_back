import { SlidingWindowRateLimiter } from 'src/common/rate-limit/sliding-window-rate-limiter';

/**
 * Ventana deslizante por remitente del webhook entrante.
 *
 * Por qué vive **dentro del manejador** y no como un guard que devuelva 429: a
 * Meta un 429 le parece un fallo y **reintenta**, con lo que un pico se
 * convertiría en una tormenta. La ruta responde 200 igualmente y lo que se
 * descarta es el trabajo, no la respuesta.
 *
 * Por qué en memoria y no con `@nestjs/throttler`: la ruta ya está protegida por
 * la firma HMAC —sin el *App Secret* no se pasa—, así que esto no es una defensa
 * contra un atacante, sino contra un bucle o un cliente que se atasca. Para eso,
 * una dependencia nueva cuyo comportamiento por defecto es justo el equivocado
 * no compensa.
 *
 * El mecanismo es el genérico de `src/common/rate-limit`: esta clase existe
 * para que el token de inyección del canal siga teniendo un tipo propio y para
 * conservar aquí el porqué del canal, que no es el del asistente.
 */
export class InboundRateLimiter extends SlidingWindowRateLimiter {}
