import { WhatsAppMessage } from 'src/notifications/domain/ports/whatsapp-sender.port';
import { AssistantPresentation } from 'src/assistant/application/tools/assistant-presentation';
import {
  aFormatoWhatsApp,
  avisoLegal,
  mensajesDeLaRespuesta,
  partirTexto,
} from './respuesta-del-asistente';

const TO = '573001112233';
const PID_1 = '11111111-1111-4111-8111-111111111111';
const PID_2 = '22222222-2222-4222-8222-222222222222';
const FOTO =
  'https://res.cloudinary.com/demo/image/upload/v17/servicios/corte.webp';

const textos = (ms: WhatsAppMessage[]) =>
  ms
    .filter((m) => m.kind === 'text')
    .map((m) => (m.kind === 'text' ? m.body : ''));

describe('aFormatoWhatsApp', () => {
  it('traduce el Markdown que se cuele', () => {
    expect(aFormatoWhatsApp('**Corte** y __tinte__')).toBe('*Corte* y _tinte_');
    expect(aFormatoWhatsApp('## Servicios')).toBe('*Servicios*');
    expect(aFormatoWhatsApp('[política](https://x.co/p)')).toBe(
      'política: https://x.co/p',
    );
    expect(aFormatoWhatsApp('- Corte\n* Tinte')).toBe('• Corte\n• Tinte');
  });

  it('respeta lo que ya está en formato de WhatsApp', () => {
    expect(aFormatoWhatsApp('*Corte*: $ 35.000')).toBe('*Corte*: $ 35.000');
  });

  it('una viñeta con negrita queda como viñeta con negrita', () => {
    expect(aFormatoWhatsApp('* **Corte**: 45 min')).toBe('• *Corte*: 45 min');
  });
});

describe('partirTexto', () => {
  it('un texto corto va entero', () => {
    expect(partirTexto('hola')).toEqual(['hola']);
  });

  it('parte por salto de línea o espacio, sin pasar del tope', () => {
    const partes = partirTexto('aaaa bbbb\ncccc dddd', 10);
    expect(partes.every((p) => p.length <= 10)).toBe(true);
    expect(partes.join(' ').replace(/\s+/g, ' ')).toBe('aaaa bbbb cccc dddd');
  });

  it('una palabra más larga que el tope se corta a la fuerza', () => {
    expect(partirTexto('x'.repeat(25), 10)).toEqual([
      'x'.repeat(10),
      'x'.repeat(10),
      'x'.repeat(5),
    ]);
  });

  it('vacío no produce mensajes', () => {
    expect(partirTexto('')).toEqual([]);
  });
});

describe('avisoLegal', () => {
  it('dice que es IA, que nada queda hecho sin el botón y enlaza la política', () => {
    const aviso = avisoLegal(
      'https://peluqueriamarlene.com/politica-tratamiento-datos',
    );
    expect(aviso).toMatch(/inteligencia artificial/);
    expect(aviso).toMatch(/Confirmar/);
    expect(aviso).toContain(
      'https://peluqueriamarlene.com/politica-tratamiento-datos',
    );
  });

  it('sin URL no deja un enlace roto', () => {
    expect(avisoLegal(undefined)).not.toMatch(/undefined|http/);
  });
});

describe('mensajesDeLaRespuesta', () => {
  const reserva = (propuestaId: string): AssistantPresentation => ({
    tipo: 'confirmar-reserva',
    propuestaId,
    nombre: 'Ana',
    servicios: ['Corte'],
    fecha: 'martes 20 de octubre',
    hora: '10:00 a. m.',
  });

  it('orden: aviso, texto, foto, botones', () => {
    const ms = mensajesDeLaRespuesta(
      {
        reply: 'Te propongo el corte.',
        presentaciones: [
          {
            tipo: 'servicios',
            servicios: [
              {
                id: 's1',
                nombre: 'Corte',
                precio: 35000,
                minutos: 45,
                imagen: FOTO,
              },
            ],
          },
          reserva(PID_1),
        ],
      },
      TO,
      'AVISO',
    );
    expect(ms.map((m) => m.kind)).toEqual([
      'text',
      'text',
      'image',
      'interactive-buttons',
    ]);
    expect(textos(ms)).toEqual(['AVISO', 'Te propongo el corte.']);
  });

  it('la foto sale en JPG y con nombre, precio y duración en el pie', () => {
    const [, foto] = mensajesDeLaRespuesta(
      {
        reply: 'Este es.',
        presentaciones: [
          {
            tipo: 'servicios',
            servicios: [
              {
                id: 's1',
                nombre: 'Corte',
                precio: 35000,
                minutos: 45,
                imagen: FOTO,
              },
            ],
          },
        ],
      },
      TO,
      null,
    );
    expect(foto.kind).toBe('image');
    if (foto.kind !== 'image') return;
    expect(foto.imageUrl).toContain('f_jpg,w_800,c_limit');
    expect(foto.caption).toContain('Corte');
    expect(foto.caption).toContain('35.000');
    expect(foto.caption).toContain('45 min');
  });

  it('sin foto cuando hay varios servicios, ninguno o una imagen que no es de Cloudinary', () => {
    const casos: AssistantPresentation[][] = [
      [
        {
          tipo: 'servicios',
          servicios: [
            { id: 's1', nombre: 'Corte', precio: 1, minutos: 1, imagen: FOTO },
            { id: 's2', nombre: 'Tinte', precio: 1, minutos: 1, imagen: FOTO },
          ],
        },
      ],
      [
        {
          tipo: 'servicios',
          servicios: [{ id: 's1', nombre: 'Corte', precio: 1, minutos: 1 }],
        },
      ],
      [
        {
          tipo: 'servicios',
          servicios: [
            {
              id: 's1',
              nombre: 'Corte',
              precio: 1,
              minutos: 1,
              imagen: 'https://placehold.co/600x400',
            },
          ],
        },
      ],
    ];
    for (const presentaciones of casos) {
      const ms = mensajesDeLaRespuesta(
        { reply: 'x', presentaciones },
        TO,
        null,
      );
      expect(ms.some((m) => m.kind === 'image')).toBe(false);
    }
  });

  it('de varias propuestas de reserva en un turno, solo la última lleva botones', () => {
    const ms = mensajesDeLaRespuesta(
      { reply: 'x', presentaciones: [reserva(PID_1), reserva(PID_2)] },
      TO,
      null,
    );
    const botones = ms.filter((m) => m.kind === 'interactive-buttons');
    expect(botones).toHaveLength(1);
    expect(JSON.stringify(botones[0])).toContain(PID_2);
    expect(JSON.stringify(botones[0])).not.toContain(PID_1);
  });

  it('cancelar y mover llevan cada uno sus botones', () => {
    const cita = { fecha: 'lunes', hora: '9:00 a. m.', servicios: ['Corte'] };
    const ms = mensajesDeLaRespuesta(
      {
        reply: 'x',
        presentaciones: [
          { tipo: 'confirmar-cancelacion', reservaId: PID_1, cita },
          {
            tipo: 'confirmar-cambio',
            reservaId: PID_2,
            cuandoLocal: '2026-10-21T10:00',
            fecha: 'martes',
            hora: '10:00 a. m.',
            cita,
          },
        ],
      },
      TO,
      null,
    );
    expect(ms.filter((m) => m.kind === 'interactive-buttons')).toHaveLength(2);
  });

  it('un paquete no añade nada al texto (el modelo ya lo cuenta)', () => {
    const ms = mensajesDeLaRespuesta(
      {
        reply: 'Para tu boda: …',
        presentaciones: [
          {
            tipo: 'paquete',
            evento: 'boda',
            completa: true,
            total: 1,
            minutos: 1,
            lineas: [],
            serviciosIds: [],
            omitidas: [],
          },
        ],
      },
      TO,
      null,
    );
    expect(ms.map((m) => m.kind)).toEqual(['text']);
  });
  it('una respuesta en blanco sin botones no deja a la persona sin contestar (NF11)', () => {
    const ms = mensajesDeLaRespuesta(
      { reply: ' \n ', presentaciones: [] },
      TO,
      null,
    );
    expect(ms).toHaveLength(1);
    expect(textos(ms)[0]).toMatch(/de otra forma/);
  });
});
