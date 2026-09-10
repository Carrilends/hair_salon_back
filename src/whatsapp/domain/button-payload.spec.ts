import {
  MAX_PAYLOAD_BYTES,
  encodeButtonPayload,
  parseButtonPayload,
  type ButtonPayload,
} from './button-payload';

const RID = '4d2f0e4e-6f1b-4a3e-9a2f-2b1c3d4e5f60';

const TODOS: ButtonPayload[] = [
  { action: 'cancel', reservationId: RID },
  { action: 'cancel_ok', reservationId: RID },
  { action: 'confirm', reservationId: RID },
  { action: 'reschedule', reservationId: RID },
  { action: 'reschedule_day', reservationId: RID, dateYmd: '2026-09-12' },
  {
    action: 'reschedule_day',
    reservationId: RID,
    dateYmd: '2026-09-12',
    offset: 10,
  },
  {
    action: 'reschedule_at',
    reservationId: RID,
    whenYmdHm: '2026-09-12T15:30',
  },
  { action: 'reservation', reservationId: RID },
  { action: 'noop' },
];

describe('button-payload · ida y vuelta', () => {
  it.each(TODOS)('codifica y vuelve a leer %j', (payload) => {
    expect(parseButtonPayload(encodeButtonPayload(payload))).toEqual(payload);
  });

  it('ningún payload emitido supera el tope de la plataforma', () => {
    // Los botones de respuesta rápida de una plantilla admiten 128 bytes; es el
    // límite más estrecho de los dos (las filas de lista admiten más). Si un
    // paso nuevo no cupiera, haría falta estado de servidor: esta prueba es la
    // que avisaría.
    for (const p of TODOS) {
      const bytes = Buffer.byteLength(encodeButtonPayload(p), 'utf8');
      expect(bytes).toBeLessThanOrEqual(MAX_PAYLOAD_BYTES);
    }
  });
});

describe('button-payload · entradas corruptas', () => {
  it.each([
    ['cadena vacía', ''],
    ['solo espacios', '   '],
    ['acción desconocida', `EXPLOTA|${RID}`],
    ['sin identificador', 'CANCEL'],
    ['identificador que no es UUID', 'CANCEL|no-es-uuid'],
    ['fecha mal formada', `RSDAY|${RID}|12-09-2026`],
    ['hora mal formada', `RSAT|${RID}|2026-09-12 15:30`],
    ['desplazamiento no numérico', `RSDAY|${RID}|2026-09-12|x`],
    ['sobra un campo', `CANCEL|${RID}|extra`],
  ])('devuelve null ante %s', (_caso, texto) => {
    expect(parseButtonPayload(texto)).toBeNull();
  });

  it('nunca lanza, por raro que sea lo que llegue', () => {
    const raros = [null, undefined, 42, {}, [], ' ', 'A'.repeat(1000)];
    for (const r of raros) {
      expect(() => parseButtonPayload(r as never)).not.toThrow();
      expect(parseButtonPayload(r as never)).toBeNull();
    }
  });
});
