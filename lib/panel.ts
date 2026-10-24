import { demoOffers } from "./demo";
import { getServerSupabase } from "./supabase/server";
import type { Offer } from "./types";

export type PanelOffer = Offer & { active: boolean };
export type PanelRestaurant = { id: string; name: string; neighborhood: string; cuisine: string; feeCents: number };

export function todayAR() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
}

type Row = {
  id: string; active: boolean; benefit: "discount" | "gift"; discount_pct: number | null; gift_label: string | null;
  applies_to: string; max_party: number; card_bg: string; card_fg: string;
  offer_slots: { id: string; starts_at: string; tables_left: number }[];
};

export async function getRestaurantOffers(restaurant: PanelRestaurant & { priceLevel?: number }): Promise<PanelOffer[]> {
  const supabase = await getServerSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("offers")
    .select("id, active, benefit, discount_pct, gift_label, applies_to, max_party, card_bg, card_fg, offer_slots (id, starts_at, tables_left)")
    .eq("restaurant_id", restaurant.id)
    .eq("service_date", todayAR())
    .order("created_at", { ascending: false })
    .returns<Row[]>();
  if (error) throw new Error(`No pudimos cargar tus cartas: ${error.message}`);
  return (data ?? []).map((o) => ({
    id: o.id, active: o.active, benefit: o.benefit, discountPct: o.discount_pct, giftLabel: o.gift_label,
    appliesTo: o.applies_to, maxParty: o.max_party, cardBg: o.card_bg, cardFg: o.card_fg,
    restaurant: { id: restaurant.id, name: restaurant.name, neighborhood: restaurant.neighborhood, cuisine: restaurant.cuisine,
      priceLevel: restaurant.priceLevel ?? 2, rating: null, ratingCount: 0, description: null, highlights: [] },
    slots: o.offer_slots.map((s) => ({ id: s.id, startsAt: s.starts_at.slice(0, 5), tablesLeft: s.tables_left }))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
  }));
}

// Restaurante y cartas de ejemplo para ver el panel sin base de datos.
export const demoRestaurant: PanelRestaurant = { id: "r1", name: "Brasa del Bajo", neighborhood: "Palermo", cuisine: "Parrilla", feeCents: 200 };
export const demoPanelOffers: PanelOffer[] = demoOffers
  .filter((o) => o.restaurant.id === "r1")
  .map((o) => ({ ...o, active: true }));

// Reservas de hoy para la noche de servicio.
export type PanelReservation = {
  id: string;
  code: string;
  status: "confirmed" | "arrived" | "no_show" | "cancelled";
  startsAt: string;
  party: number;
  guestName: string;
  note: string | null;
  feeCents: number | null;
};

type ReservationRow = {
  id: string; code: string; status: PanelReservation["status"]; party_size: number; guest_name: string;
  note: string | null; fee_cents: number | null; offer_slots: { starts_at: string } | null;
};

export async function getTodayReservations(restaurantId: string): Promise<PanelReservation[]> {
  const supabase = await getServerSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("reservations")
    .select("id, code, status, party_size, guest_name, note, fee_cents, offer_slots (starts_at), offers!inner (service_date)")
    .eq("restaurant_id", restaurantId)
    .eq("offers.service_date", todayAR())
    .returns<ReservationRow[]>();
  if (error) throw new Error(`No pudimos cargar las reservas de hoy: ${error.message}`);
  return sortByTime((data ?? []).map((r) => ({
    id: r.id, code: r.code, status: r.status, party: r.party_size, guestName: r.guest_name,
    note: r.note, feeCents: r.fee_cents, startsAt: r.offer_slots?.starts_at.slice(0, 5) ?? "--:--",
  })));
}

export const sortByTime = (list: PanelReservation[]) =>
  [...list].sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.guestName.localeCompare(b.guestName));

export const demoPanelReservations: PanelReservation[] = sortByTime([
  { id: "rv1", code: "UM-K7P2Q", status: "confirmed", startsAt: "21:30", party: 2, guestName: "Lucía Fernández", note: "Es un cumpleaños", feeCents: null },
  { id: "rv2", code: "UM-Q9TZM", status: "arrived", startsAt: "21:30", party: 2, guestName: "Sofía Paz", note: null, feeCents: 400 },
  { id: "rv3", code: "UM-3HXR8", status: "confirmed", startsAt: "22:00", party: 4, guestName: "Martín Gómez", note: null, feeCents: null },
  { id: "rv4", code: "UM-B4N6W", status: "confirmed", startsAt: "22:00", party: 3, guestName: "Diego Ruiz", note: "Una persona celíaca", feeCents: null },
]);
