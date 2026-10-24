import { demoOffers } from "./demo";
import { todayAR } from "./panel";
import { getServerSupabase } from "./supabase/server";

// Cierre de mes: reservas de un mes por fecha de servicio, resumen y CSV.

export type MonthRow = {
  code: string;
  date: string; // AAAA-MM-DD
  startsAt: string;
  guestName: string;
  party: number;
  status: "confirmed" | "arrived" | "no_show" | "cancelled";
  feeCents: number | null;
};

export type MonthSummary = {
  reservations: number; arrived: number; noShows: number; cancelled: number; pending: number;
  diners: number; feeCents: number;
};

export type SettlementRow = MonthSummary & { restaurantId: string; name: string; neighborhood: string; feePerDinerCents: number };

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export const currentMonthAR = () => todayAR().slice(0, 7);

// "AAAA-MM" válido o el mes actual.
export function parseMonth(value: string | string[] | undefined) {
  const v = Array.isArray(value) ? value[0] : value;
  return v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : currentMonthAR();
}

export function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { from: `${month}-01`, to: `${next}-01` };
}

export function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

// El mes actual y los anteriores, para elegir.
export function recentMonths(n: number) {
  const [y, m] = currentMonthAR().split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

export function dayLabel(date: string) {
  const s = new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", weekday: "short", day: "numeric", month: "numeric" })
    .format(new Date(`${date}T12:00:00Z`));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const usd = (cents: number) =>
  `USD ${(cents / 100).toLocaleString("es-AR", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

export function summarize(rows: MonthRow[]): MonthSummary {
  const s: MonthSummary = { reservations: rows.length, arrived: 0, noShows: 0, cancelled: 0, pending: 0, diners: 0, feeCents: 0 };
  for (const r of rows) {
    if (r.status === "arrived") { s.arrived++; s.diners += r.party; s.feeCents += r.feeCents ?? 0; }
    else if (r.status === "no_show") s.noShows++;
    else if (r.status === "cancelled") s.cancelled++;
    else s.pending++;
  }
  return s;
}

export function byDay(rows: MonthRow[]) {
  const days = new Map<string, MonthRow[]>();
  for (const r of rows) days.set(r.date, [...(days.get(r.date) ?? []), r]);
  return [...days.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([date, list]) => ({ date, ...summarize(list) }));
}

// Excel en español abre bien un CSV con punto y coma, coma decimal y BOM.
const cell = (v: string | number) => {
  const s = String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const money = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
const STATUS: Record<MonthRow["status"], string> = { confirmed: "Por llegar", arrived: "Llegó", no_show: "No vino", cancelled: "Canceló" };

export function toCSV(header: (string | number)[], lines: (string | number)[][]) {
  return "﻿" + [header, ...lines].map((l) => l.map(cell).join(";")).join("\r\n") + "\r\n";
}

export function reservationsCSV(rows: MonthRow[]) {
  return toCSV(
    ["Fecha", "Hora", "Código", "A nombre de", "Personas", "Estado", "Comisión (USD)"],
    [...rows].sort((a, b) => a.date.localeCompare(b.date) || a.startsAt.localeCompare(b.startsAt))
      .map((r) => [r.date, r.startsAt, r.code, r.guestName, r.party, STATUS[r.status], r.status === "arrived" ? money(r.feeCents ?? 0) : "0,00"]),
  );
}

export function settlementCSV(rows: SettlementRow[]) {
  return toCSV(
    ["Restaurante", "Barrio", "Reservas", "Llegaron", "No vinieron", "Cancelaron", "Comensales", "Comisión por comensal (USD)", "Total a cobrar (USD)"],
    rows.map((r) => [r.name, r.neighborhood, r.reservations, r.arrived, r.noShows, r.cancelled, r.diners, money(r.feePerDinerCents), money(r.feeCents)]),
  );
}

export const csvFilename = (name: string, month: string) =>
  `ultimamesa-${name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${month}.csv`;

// Datos de la base -------------------------------------------------------

type Row = {
  code: string; status: MonthRow["status"]; party_size: number; guest_name: string; fee_cents: number | null;
  offer_slots: { starts_at: string } | null; offers: { service_date: string };
};

export async function getMonthRows(restaurantId: string, month: string): Promise<MonthRow[]> {
  const supabase = await getServerSupabase();
  if (!supabase) return demoMonthRows(restaurantId, month);
  const { from, to } = monthRange(month);
  const rows: MonthRow[] = [];
  // Supabase devuelve hasta 1000 filas por pedido: leemos por páginas.
  for (let page = 0; ; page++) {
    const { data, error } = await supabase
      .from("reservations")
      .select("code, status, party_size, guest_name, fee_cents, offer_slots (starts_at), offers!inner (service_date)")
      .eq("restaurant_id", restaurantId)
      .gte("offers.service_date", from)
      .lt("offers.service_date", to)
      .order("created_at")
      .range(page * 1000, page * 1000 + 999)
      .returns<Row[]>();
    if (error) throw new Error(`No pudimos cargar las reservas del mes: ${error.message}`);
    rows.push(...(data ?? []).map((r) => ({
      code: r.code, date: r.offers.service_date, startsAt: r.offer_slots?.starts_at.slice(0, 5) ?? "--:--",
      guestName: r.guest_name, party: r.party_size, status: r.status, feeCents: r.fee_cents,
    })));
    if (!data || data.length < 1000) return rows;
  }
}

type SettlementDb = {
  restaurant_id: string; name: string; neighborhood: string; fee_per_diner_cents: number;
  reservations: number; arrived: number; no_shows: number; cancelled: number; diners: number; fee_cents: number;
};

export async function getSettlement(month: string): Promise<SettlementRow[]> {
  const supabase = await getServerSupabase();
  if (!supabase) return demoSettlement(month);
  const { data, error } = await supabase.rpc("month_settlement", { p_month: monthRange(month).from });
  if (error) throw new Error(`No pudimos calcular la liquidación: ${error.message}`);
  return ((data ?? []) as SettlementDb[]).map((r) => {
    const reservations = Number(r.reservations), arrived = Number(r.arrived), noShows = Number(r.no_shows), cancelled = Number(r.cancelled);
    return {
      restaurantId: r.restaurant_id, name: r.name, neighborhood: r.neighborhood, feePerDinerCents: r.fee_per_diner_cents,
      reservations, arrived, noShows, cancelled, pending: reservations - arrived - noShows - cancelled,
      diners: Number(r.diners), feeCents: Number(r.fee_cents),
    };
  });
}

// Modo de ejemplo --------------------------------------------------------

const NAMES = ["Lucía Fernández", "Martín Gómez", "Sofía Paz", "Diego Ruiz", "Valentina López", "Tomás Díaz", "Camila Sosa", "Juan Pérez", "Florencia Ríos", "Nicolás Romero", "Agustina Vega", "Mateo Álvarez"];
const HOURS = ["21:00", "21:30", "22:00", "22:30", "23:00"];
const CODE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// Números pseudoaleatorios estables: el mismo mes muestra siempre lo mismo.
function seeded(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export function demoMonthRows(restaurantId: string, month: string, feePerDinerCents = 200): MonthRow[] {
  const today = todayAR();
  const { from } = monthRange(month);
  if (from > today) return [];
  const rand = seeded(`${restaurantId}-${month}`);
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const rows: MonthRow[] = [];
  for (let d = 1; d <= lastDay; d++) {
    const date = `${month}-${String(d).padStart(2, "0")}`;
    if (date > today) break;
    const count = Math.floor(rand() * 5);
    for (let i = 0; i < count; i++) {
      const party = 2 + Math.floor(rand() * 3);
      const roll = rand();
      const status: MonthRow["status"] = date === today ? "confirmed" : roll < 0.8 ? "arrived" : roll < 0.9 ? "no_show" : "cancelled";
      rows.push({
        code: "UM-" + Array.from({ length: 5 }, () => CODE[Math.floor(rand() * CODE.length)]).join(""),
        date, startsAt: HOURS[Math.floor(rand() * HOURS.length)], guestName: NAMES[Math.floor(rand() * NAMES.length)],
        party, status, feeCents: status === "arrived" ? party * feePerDinerCents : null,
      });
    }
  }
  return rows;
}

function demoSettlement(month: string): SettlementRow[] {
  const restaurants = [...new Map(demoOffers.map((o) => [o.restaurant.id, o.restaurant])).values()];
  return restaurants
    .map((r) => ({ restaurantId: r.id, name: r.name, neighborhood: r.neighborhood, feePerDinerCents: 200, ...summarize(demoMonthRows(r.id, month)) }))
    .filter((r) => r.reservations > 0)
    .sort((a, b) => b.feeCents - a.feeCents || a.name.localeCompare(b.name));
}

// Acceso del equipo de Última Mesa a la liquidación.
export async function getAdminAccess(): Promise<"demo" | "login" | "denied" | "ok"> {
  const supabase = await getServerSupabase();
  if (!supabase) return "demo";
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "login";
  const { data } = await supabase.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  return data ? "ok" : "denied";
}
