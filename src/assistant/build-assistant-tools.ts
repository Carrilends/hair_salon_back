import { CreateReservationUseCase } from 'src/reservations/application/create-reservation.use-case';
import { GetMyReservationsUseCase } from 'src/reservations/application/get-my-reservations.use-case';
import { CancelReservationUseCase } from 'src/reservations/application/cancel-reservation.use-case';
import { RescheduleReservationUseCase } from 'src/reservations/application/reschedule-reservation.use-case';

import { AssistantTool } from './application/tools/assistant-tool';
import { ListServicesTool } from './application/tools/list-services.tool';
import { CheckAvailabilityTool } from './application/tools/check-availability.tool';
import { CreateReservationTool } from './application/tools/create-reservation.tool';
import { MyReservationsTool } from './application/tools/my-reservations.tool';
import { CancelReservationTool } from './application/tools/cancel-reservation.tool';
import { RescheduleReservationTool } from './application/tools/reschedule-reservation.tool';
import { RecommendServicesTool } from './application/tools/recommend-services.tool';
import { ComposePackageTool } from './application/tools/compose-package.tool';
import { ReservePackageTool } from './application/tools/reserve-package.tool';
import { ServiceCatalogQueryAdapter } from './infrastructure/catalog/service-catalog-query.adapter';
import { AvailabilityQueryAdapter } from './infrastructure/availability/availability-query.adapter';
import { JudgmentPort } from './domain/ports/judgment.port';
import { JudgmentSettings } from './application/judgment-settings';

/**
 * Composición del arreglo `ASSISTANT_TOOLS` (P1 de la Fase 6: esta fase solo
 * **añade** herramientas; el bucle, el presupuesto y la telemetría no se tocan).
 * Se extrae del módulo para poder probar el registro sin levantar la DI de Nest.
 * El orden de los parámetros debe coincidir con el arreglo `inject` del módulo.
 *
 * `judge` y `settings` son **opcionales** (plan 04): sin ellos las herramientas
 * son exactamente las de antes. Importa porque esta misma lista es la que
 * publica el servidor MCP —`ASSISTANT_TOOLS`, un solo arreglo para los dos—, y
 * montar la verificación cuando no hay proveedor se la impondría también a él.
 */
export function buildAssistantTools(
  catalog: ServiceCatalogQueryAdapter,
  availability: AvailabilityQueryAdapter,
  createReservation: CreateReservationUseCase,
  getMyReservations: GetMyReservationsUseCase,
  cancelReservation: CancelReservationUseCase,
  rescheduleReservation: RescheduleReservationUseCase,
  judge?: JudgmentPort,
  settings?: JudgmentSettings,
): AssistantTool[] {
  // Verificación de correspondencia previa a crear (T5) y reordenación por
  // relevancia del listado (T7). Se montan solo si hay proveedor; que estén
  // encendidas o apagadas lo decide el modo de cada una.
  const verificacion =
    judge && settings ? { judge, modo: settings.reserva, catalog } : undefined;
  const reorden =
    judge && settings ? { judge, modo: settings.orden } : undefined;
  return [
    new ListServicesTool(catalog, reorden),
    new CheckAvailabilityTool(availability),
    new CreateReservationTool(createReservation, verificacion),
    new MyReservationsTool(getMyReservations),
    new CancelReservationTool(cancelReservation),
    new RescheduleReservationTool(rescheduleReservation),
    new RecommendServicesTool(catalog),
    new ComposePackageTool(catalog),
    new ReservePackageTool(createReservation),
  ];
}
