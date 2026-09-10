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

/**
 * Composición del arreglo `ASSISTANT_TOOLS` (P1 de la Fase 6: esta fase solo
 * **añade** herramientas; el bucle, el presupuesto y la telemetría no se tocan).
 * Se extrae del módulo para poder probar el registro sin levantar la DI de Nest.
 * El orden de los parámetros debe coincidir con el arreglo `inject` del módulo.
 */
export function buildAssistantTools(
  catalog: ServiceCatalogQueryAdapter,
  availability: AvailabilityQueryAdapter,
  createReservation: CreateReservationUseCase,
  getMyReservations: GetMyReservationsUseCase,
  cancelReservation: CancelReservationUseCase,
  rescheduleReservation: RescheduleReservationUseCase,
): AssistantTool[] {
  return [
    new ListServicesTool(catalog),
    new CheckAvailabilityTool(availability),
    new CreateReservationTool(createReservation),
    new MyReservationsTool(getMyReservations),
    new CancelReservationTool(cancelReservation),
    new RescheduleReservationTool(rescheduleReservation),
    new RecommendServicesTool(catalog),
    new ComposePackageTool(catalog),
    new ReservePackageTool(createReservation),
  ];
}
