"use client";
import type { ReservationView } from "./reservations";

// Guardadas y reservas del modo de ejemplo viven solo en este navegador.
const SAVED = "um-guardadas";
const DEMO_RES = "um-reservas-ejemplo";

function read<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sin almacenamiento: queda en memoria */ }
}

export const savedStore = {
  get: () => read<string[]>(SAVED, []),
  set: (ids: string[]) => write(SAVED, ids),
};
export const demoReservations = {
  get: () => read<ReservationView[]>(DEMO_RES, []),
  set: (list: ReservationView[]) => write(DEMO_RES, list),
};
