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

  it('advierte de que el mensaje se procesa fuera del país, como promete la política', () => {
    expect(avisoLegal(undefined)).toMatch(/fuera del país/);
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
    const ms = mensajesDeLaRespuesta(
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
    const foto = ms[1];
    expect(textos(ms)[0]).toContain('1. Corte');
    expect(foto.kind).toBe('image');
    if (foto.kind !== 'image') return;
    expect(foto.imageUrl).toContain('f_jpg,w_800,c_limit');
    expect(foto.caption).toContain('Corte');
    expect(foto.caption).toContain('35.000');
    expect(foto.caption).toContain('45 min');
  });

  // ---------------------------------------------------------- catálogo con fotos
  const SID = (n: number) =>
    `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}`;
  const REPLY_OK =
    'https://res.cloudinary.com/demo/image/upload/v17/respaldo.jpg';
  const servicio = (n: number, conFoto = true) => ({
    id: SID(n),
    nombre: `Servicio ${String.fromCharCode(64 + n)}`,
    precio: 10000 * n,
    minutos: 30,
    ...(conFoto ? { imagen: FOTO } : {}),
  });
  const listaDe = (
    n: number,
    conFoto: (i: number) => boolean = () => true,
  ): AssistantPresentation => ({
    tipo: 'servicios',
    servicios: Array.from({ length: n }, (_, i) => servicio(i + 1, conFoto(i))),
  });
  const mensajes = (
    presentaciones: AssistantPresentation[],
    respaldo?: string,
  ) =>
    mensajesDeLaRespuesta(
      { reply: 'Mira.', presentaciones },
      TO,
      null,
      respaldo,
    );
  const carrusel = (ms: WhatsAppMessage[]) => {
    const c = ms.find((m) => m.kind === 'carousel');
    if (!c || c.kind !== 'carousel') throw new Error('sin carrusel');
    return c;
  };

  it('varios con foto: texto con lista y luego carrusel, sin más mensajes', () => {
    const ms = mensajes([listaDe(6)]);
    expect(ms.map((m) => m.kind)).toEqual(['text', 'carousel']);
    expect(textos(ms)[0]).toContain('Mira.');
    expect(textos(ms)[0]).toContain('1. Servicio A');
    expect(textos(ms)[0]).toContain('6. Servicio F');
    const c = carrusel(ms);
    expect(c.body).toBe('Desliza para ver las opciones.');
    expect(c.cards).toHaveLength(6);
    expect(c.cards[0].buttonTitle).toBe('Me interesa');
    expect(c.cards[0].imageUrl).toContain('f_jpg,w_800,c_limit');
  });

  it('con respaldo, los que no tienen foto llevan la de respaldo', () => {
    const ms = mensajes([listaDe(6, (i) => i < 3)], REPLY_OK);
    const c = carrusel(ms);
    expect(c.cards).toHaveLength(6);
    expect(c.cards[5].imageUrl).toBe(REPLY_OK);
    expect(
      textos(ms)[0]
        .split('\n')
        .filter((l) => /^\d\. /.test(l)),
    ).toHaveLength(6);
  });

  it('con respaldo y ninguna foto real, también hay carrusel', () => {
    const ms = mensajes([listaDe(3, () => false)], REPLY_OK);
    expect(carrusel(ms).cards.map((x) => x.imageUrl)).toEqual([
      REPLY_OK,
      REPLY_OK,
      REPLY_OK,
    ]);
  });

  it('un solo servicio sin foto y con respaldo: foto por defecto con pie', () => {
    const ms = mensajes([listaDe(1, () => false)], REPLY_OK);
    expect(ms.map((m) => m.kind)).toEqual(['text', 'image']);
    const foto = ms[1];
    if (foto.kind !== 'image') throw new Error('sin foto');
    expect(foto.imageUrl).toBe(REPLY_OK);
    expect(foto.caption).toContain('Servicio A');
    expect(textos(ms)[0]).toContain('1. Servicio A');
  });

  it('un solo servicio sin foto y sin respaldo: solo la lista', () => {
    const ms = mensajes([listaDe(1, () => false)]);
    expect(ms.map((m) => m.kind)).toEqual(['text']);
    expect(textos(ms)[0]).toContain('1. Servicio A');
  });

  it('sin respaldo, el resto va solo en la lista y la numeración es la de la lista', () => {
    const ms = mensajes([listaDe(6, (i) => i % 2 === 1)]);
    const c = carrusel(ms);
    expect(c.cards).toHaveLength(3);
    expect(c.cards.map((x) => x.body.slice(0, 2))).toEqual(['2.', '4.', '6.']);
    expect(
      textos(ms)[0]
        .split('\n')
        .filter((l) => /^\d\. /.test(l)),
    ).toHaveLength(6);
  });

  it('sin respaldo y una sola con foto: esa foto con pie numerado', () => {
    const ms = mensajes([listaDe(3, (i) => i === 2)]);
    expect(ms.map((m) => m.kind)).toEqual(['text', 'image']);
    const foto = ms[1];
    if (foto.kind !== 'image') throw new Error('sin foto');
    expect(foto.caption).toContain('3. Servicio C');
  });

  it('sin respaldo y ninguna con foto: solo la lista', () => {
    const ms = mensajes([listaDe(3, () => false)]);
    expect(ms.map((m) => m.kind)).toEqual(['text']);
  });

  it('dos presentaciones con un mismo servicio: una tarjeta', () => {
    const ms = mensajes([
      { tipo: 'servicios', servicios: [servicio(1), servicio(2)] },
      { tipo: 'servicios', servicios: [servicio(1)] },
    ]);
    expect(carrusel(ms).cards).toHaveLength(2);
  });

  it('nunca más de 6, aunque lleguen más', () => {
    const ms = mensajes([listaDe(9)]);
    expect(carrusel(ms).cards).toHaveLength(6);
    expect(textos(ms)[0]).not.toContain('7. ');
  });

  it('una imagen de placehold.co usa el respaldo; sin respaldo, no da tarjeta', () => {
    const malo = {
      ...servicio(2),
      imagen: 'https://placehold.co/600x400',
    };
    const lista: AssistantPresentation = {
      tipo: 'servicios',
      servicios: [servicio(1), malo, servicio(3)],
    };
    expect(carrusel(mensajes([lista], REPLY_OK)).cards[1].imageUrl).toBe(
      REPLY_OK,
    );
    expect(carrusel(mensajes([lista])).cards).toHaveLength(2);
  });

  it('Review Focus 5: con confirmación y varios servicios, ni lista ni carrusel', () => {
    const ms = mensajes([listaDe(6), reserva(PID_1)], REPLY_OK);
    expect(ms.map((m) => m.kind)).toEqual(['text', 'interactive-buttons']);
    expect(textos(ms)[0]).toBe('Mira.');
  });

  it('con confirmación y un servicio sin foto, ni siquiera la de respaldo', () => {
    const ms = mensajes([listaDe(1, () => false), reserva(PID_1)], REPLY_OK);
    expect(ms.map((m) => m.kind)).toEqual(['text', 'interactive-buttons']);
  });

  it('con confirmación y un servicio: aviso, texto sin la línea del servicio, foto y botones', () => {
    const ms = mensajesDeLaRespuesta(
      { reply: 'Te propongo.', presentaciones: [listaDe(1), reserva(PID_1)] },
      TO,
      'AVISO',
    );
    expect(ms.map((m) => m.kind)).toEqual([
      'text',
      'text',
      'image',
      'interactive-buttons',
    ]);
    expect(textos(ms)).toEqual(['AVISO', 'Te propongo.']);
  });

  it('con respuesta y lista que juntas pasan el tope, ninguna línea se parte y nada se pierde', () => {
    const reply = 'palabra '.repeat(510).trim(); // 4079 caracteres
    const largo = mensajesDeLaRespuesta(
      { reply, presentaciones: [listaDe(3, () => false)] },
      TO,
      null,
    );
    const cuerpos = textos(largo);
    expect(cuerpos.length).toBeGreaterThan(1);
    expect(cuerpos.every((c) => c.length <= 4096)).toBe(true);
    // nada se pierde: la respuesta entera y las tres líneas, cada una completa
    expect(
      cuerpos
        .join(' ')
        .split(/\s+/)
        .filter((w) => w === 'palabra'),
    ).toHaveLength(510);
    const lineas = cuerpos.join('\n').split('\n');
    for (const n of [1, 2, 3]) {
      const linea = lineas.filter((l) => l.startsWith(`${n}. Servicio`));
      expect(linea).toHaveLength(1);
      expect(linea[0]).toMatch(/\(30 min\)$/);
    }
  });

  it('el botón de cada tarjeta lleva SERVICE y el id', () => {
    const c = carrusel(mensajes([listaDe(2)]));
    expect(c.cards[0].buttonId).toBe(`SERVICE|${SID(1)}`);
    expect(c.cards[1].buttonId).toBe(`SERVICE|${SID(2)}`);
  });

  it('la tarjeta se recorta a 160', () => {
    const largo = { ...servicio(1), nombre: 'X'.repeat(300) };
    const c = carrusel(
      mensajes([{ tipo: 'servicios', servicios: [largo, servicio(2)] }]),
    );
    expect(c.cards[0].body).toHaveLength(160);
    expect(c.cards[0].body.endsWith('…')).toBe(true);
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

describe('mensajesDeLaRespuesta · agenda de la dueña', () => {
  const agenda = (lineas: string[]): AssistantPresentation => ({
    tipo: 'agenda',
    lineas,
    hayMas: false,
  });

  it('con una presentación de agenda envía una línea por cita', () => {
    const lineas = [
      '*jueves, 15 de octubre*',
      '10:00 · Ana · Corte · con Monica',
      '11:00 · Luisa · Tinte · con Pedro',
    ];
    const ms = mensajesDeLaRespuesta(
      { reply: 'Esta es la agenda.', presentaciones: [agenda(lineas)] },
      TO,
      null,
    );
    expect(textos(ms)).toEqual(['Esta es la agenda.', lineas.join('\n')]);
  });

  it('parte la agenda larga en trozos de 4096', () => {
    const lineas = Array.from(
      { length: 200 },
      (_, i) =>
        `10:00 · Clienta ${'x'.repeat((i % 7) + 1)} · ${'Corte, '.repeat(5)}Tinte · con Monica`,
    );
    const ms = mensajesDeLaRespuesta(
      { reply: 'Agenda.', presentaciones: [agenda(lineas)] },
      TO,
      null,
    );
    const t = textos(ms).slice(1);
    expect(t.length).toBeGreaterThan(1);
    expect(t.every((x) => x.length <= 4096)).toBe(true);
    expect(t.join('\n').split('\n')).toEqual(lineas);
  });

  it('los botones de confirmación ignoran la agenda', () => {
    const ms = mensajesDeLaRespuesta(
      { reply: 'Hola', presentaciones: [agenda(['10:00 · A · B · con C'])] },
      TO,
      null,
    );
    expect(ms.some((m) => m.kind === 'interactive-buttons')).toBe(false);
  });
});

describe('mensajesDeLaRespuesta · texto presentado', () => {
  it('envía las líneas de una presentación de texto, partidas en 4096', () => {
    const lineas = Array.from(
      { length: 200 },
      (_, i) => `${i + 1}. ${'x'.repeat(40)} · Corte · con Monica`,
    );
    const ms = mensajesDeLaRespuesta(
      { reply: 'Estas son.', presentaciones: [{ tipo: 'texto', lineas }] },
      TO,
      null,
    );
    const t = textos(ms).slice(1);
    expect(t.every((x) => x.length <= 4096)).toBe(true);
    expect(t.join('\n').split('\n')).toEqual(lineas);
  });
});
