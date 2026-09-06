// Espejo del contrato de `GET /api/mobs` (backend/src/routes/mobs.ts,
// ticket 016) -- ver docs/API.md. Mismo criterio de duplicacion
// deliberada que `types/baseAssets.ts` (sin paquete compartido).

/** Entrada del catalogo de mobs -- exactamente lo que el menu de seleccion (ticket 018) necesita. */
export interface MobSummary {
  id: string;
  label: string;
}

export interface MobsResponse {
  mobs: MobSummary[];
}
