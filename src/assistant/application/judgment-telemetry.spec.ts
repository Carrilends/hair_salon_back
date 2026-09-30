import { TelemetriaDeJuicios } from './judgment-telemetry';

describe('TelemetriaDeJuicios', () => {
  it('cuenta los turnos y los que llegaron a la vuelta 3', () => {
    // La fracción de turnos que encadena tres vueltas es la cifra que dirá si
    // el corte semántico valió la pena, y hoy no la sabe nadie. Este contador
    // no necesita proveedor: es aritmética.
    const t = new TelemetriaDeJuicios();

    t.anotarTurno({ llegoALaVuelta3: false });
    t.anotarTurno({ llegoALaVuelta3: true });
    t.anotarTurno({ llegoALaVuelta3: false });

    expect(t.informe()).toMatchObject({ turnos: 3, turnosConTresVueltas: 1 });
  });

  it('cuenta las intenciones para saber qué le preguntan al asistente', () => {
    const t = new TelemetriaDeJuicios();

    t.anotarJuicio({ intencion: 'reservar', resuelta: 0.9, ms: 200 });
    t.anotarJuicio({ intencion: 'reservar', resuelta: 0.8, ms: 300 });
    t.anotarJuicio({ intencion: 'precio_o_catalogo', resuelta: 0.7, ms: 250 });

    expect(t.informe().intenciones).toEqual({
      reservar: 2,
      precio_o_catalogo: 1,
    });
  });

  it('resume la latencia sin guardar una muestra por turno', () => {
    // Un arreglo que crece con cada turno es una fuga de memoria con nombre de
    // telemetría. Se guardan agregados.
    const t = new TelemetriaDeJuicios();

    t.anotarJuicio({ intencion: 'reservar', resuelta: 0.9, ms: 100 });
    t.anotarJuicio({ intencion: 'reservar', resuelta: 0.9, ms: 300 });

    expect(t.informe().latenciaMs).toEqual({ media: 200, maxima: 300, n: 2 });
  });

  it('cuenta los juicios que no volvieron, que es lo que dice si vale la pena', () => {
    const t = new TelemetriaDeJuicios();

    t.anotarJuicio({ intencion: null, resuelta: null, ms: null });

    expect(t.informe()).toMatchObject({ juicios: 1, sinVeredicto: 1 });
    expect(t.informe().intenciones).toEqual({});
  });

  it('el informe de una telemetría recién creada no miente con ceros raros', () => {
    expect(new TelemetriaDeJuicios().informe()).toEqual({
      turnos: 0,
      turnosConTresVueltas: 0,
      juicios: 0,
      sinVeredicto: 0,
      intenciones: {},
      latenciaMs: null,
      resueltaMedia: null,
    });
  });

  it('promedia la probabilidad de «se resolvió» para la redacción', () => {
    const t = new TelemetriaDeJuicios();

    t.anotarJuicio({ intencion: 'reservar', resuelta: 0.6, ms: 10 });
    t.anotarJuicio({ intencion: 'reservar', resuelta: 0.8, ms: 10 });

    expect(t.informe().resueltaMedia).toBeCloseTo(0.7, 5);
  });
});
