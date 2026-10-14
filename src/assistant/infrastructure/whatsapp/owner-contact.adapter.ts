import { normalizeCoPhoneToE164 } from 'src/common/phone';
import { WhatsAppSenderPort } from 'src/notifications/domain/ports/whatsapp-sender.port';
import {
  OwnerContactPort,
  ResultadoDelAviso,
} from '../../domain/ports/owner-contact.port';

export interface OwnerContactConfig {
  /** Móvil personal de la dueña (`SALON_OWNER_WHATSAPP`). */
  ownerPhone: string;
  /** `WHATSAPP_TEMPLATE_CONTACTO_DUENA`. */
  templateName: string;
}

const SIN_DATO = 'No lo indicó';

/**
 * El aviso «una clienta quiere hablar contigo» como plantilla de WhatsApp
 * (`contacto_duena`: `{{1}}` nombre · `{{2}}` número · `{{3}}` motivo). Va
 * con plantilla porque la dueña no le ha escrito a la línea del negocio: no hay
 * ventana de 24 h abierta.
 */
export class WhatsAppOwnerContactAdapter implements OwnerContactPort {
  constructor(
    private readonly sender: WhatsAppSenderPort,
    private readonly config: OwnerContactConfig,
  ) {}

  async avisar(aviso: {
    nombre: string | null;
    telefonoE164: string;
    motivo: string;
  }): Promise<ResultadoDelAviso> {
    const to = normalizeCoPhoneToE164(this.config.ownerPhone);
    if (!to || !this.config.templateName) return 'sin_configurar';

    await this.sender.send({
      kind: 'template',
      to,
      templateName: this.config.templateName,
      bodyParams: [
        paraPlantilla(aviso.nombre, 60),
        legible(aviso.telefonoE164),
        paraPlantilla(aviso.motivo, 200),
      ],
    });
    return 'enviado';
  }
}

/**
 * Meta rechaza la plantilla entera si un parámetro trae saltos de línea,
 * tabuladores o más de cuatro espacios seguidos, o si llega vacío. Lo escribe
 * la clienta, así que se limpia siempre.
 */
function paraPlantilla(texto: string | null, max: number): string {
  const limpio = (texto ?? '').replace(/\s+/g, ' ').trim();
  if (!limpio) return SIN_DATO;
  return limpio.length > max ? `${limpio.slice(0, max - 1)}…` : limpio;
}

/** `573001112233` → `+57 300 111 2233`: que la dueña lo lea y lo marque. */
function legible(waId: string): string {
  const m = /^57(\d{3})(\d{3})(\d{4})$/.exec(waId);
  return m ? `+57 ${m[1]} ${m[2]} ${m[3]}` : `+${waId}`;
}
