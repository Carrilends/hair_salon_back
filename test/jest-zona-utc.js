/**
 * La suite corre en UTC, como el contenedor y Railway. Sin esto, en un equipo
 * de desarrollo en Bogotá una hora sin zona se leía bien por casualidad y las
 * pruebas no veían el fallo de las 03:00 (prueba con móvil del 2026-10-20).
 */
module.exports = () => {
  process.env.TZ = 'UTC';
};
