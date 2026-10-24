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
