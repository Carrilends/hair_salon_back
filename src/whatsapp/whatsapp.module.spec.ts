import { WhatsAppModule } from './whatsapp.module';
import { LEGAL_NOTICE_LOG } from './application/tokens';

/**
 * El manejador recibe el registro del aviso legal como dependencia opcional
 * (las pruebas lo omiten). En la aplicación tiene que estar: sin él, nadie
 * recibiría el aviso de tratamiento de datos.
 */
describe('WhatsAppModule', () => {
  it('provee el registro del aviso legal', () => {
    const providers = Reflect.getMetadata('providers', WhatsAppModule) as {
      provide?: unknown;
    }[];
    expect(providers.some((p) => p?.provide === LEGAL_NOTICE_LOG)).toBe(true);
  });
});
