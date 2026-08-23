import { buildAssistantTools } from './build-assistant-tools';

describe('buildAssistantTools', () => {
  it('registra las cinco herramientas del asistente, en orden estable', () => {
    // Las dependencias solo se guardan por referencia en cada herramienta; no se
    // invocan al construir, así que fakes vacíos bastan para verificar el registro.
    const tools = buildAssistantTools(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    expect(tools.map((t) => t.name)).toEqual([
      'listarServicios',
      'consultarDisponibilidad',
      'crearReserva',
      'misReservas',
      'cancelarReserva',
    ]);
  });
});
