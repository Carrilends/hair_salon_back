/** Carga de trabajo de una estilista en un día concreto del salón. */
export interface AssignableWorkerLoad {
  id: string;
  /** Minutos ya ocupados ese día (sin contar canceladas). */
  usedMinutes: number;
}

export interface WorkerAvailabilityPort {
  countParallelStylists(): Promise<number>;
  getDefaultWorkerId(): Promise<string>;
  /**
   * Estilistas asignables (todas menos el pseudo-estilista por defecto) con los
   * minutos que ya tienen ocupados en `dateYmd` (`YYYY-MM-DD`, hora del salón).
   *
   * Lo necesita la asignación automática: sin la carga del día no hay forma de
   * repartir el trabajo y el orden de la consulta cargaría siempre a la misma.
   */
  listAssignableWorkloads(dateYmd: string): Promise<AssignableWorkerLoad[]>;
}
