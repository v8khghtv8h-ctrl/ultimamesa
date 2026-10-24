import { demoOffers } from "./demo";
import { getServerSupabase } from "./supabase/server";
import type { Offer } from "./types";

type Row = {
  id: string;
  benefit: "discount" | "gift";
  discount_pct: number | null;
  gift_label: string | null;
  applies_to: string;
  max_party: number;
  card_bg: string;
  card_fg: string;
  restaurants: {
    id: string; name: string; neighborhood: string; cuisine: string; price_level: number;
    rating: number | null; rating_count: number; description: string | null; highlights: string[];
  };
  offer_slots: { id: string; starts_at: string; tables_left: number }[];
};

// Cartas de hoy con al menos una mesa libre. Sin Supabase devuelve las de ejemplo.
export async function getTonightOffers(): Promise<{ offers: Offer[]; demo: boolean }> {
  const supabase = await getServerSupabase();
  if (!supabase) return { offers: demoOffers, demo: true };

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
  const { data, error } = await supabase
    .from("offers")
    .select(`id, benefit, discount_pct, gift_label, applies_to, max_party, card_bg, card_fg,
      restaurants!inner (id, name, neighborhood, cuisine, price_level, rating, rating_count, description, highlights),
      offer_slots (id, starts_at, tables_left)`)
    .eq("active", true)
    .eq("service_date", today)
    .order("created_at", { ascending: false })
    .returns<Row[]>();
  if (error) throw new Error(`No pudimos cargar las mesas: ${error.message}`);

  const offers = (data ?? [])
    .map((o): Offer => ({
      id: o.id,
      restaurant: {
        id: o.restaurants.id, name: o.restaurants.name, neighborhood: o.restaurants.neighborhood,
        cuisine: o.restaurants.cuisine, priceLevel: o.restaurants.price_level, rating: o.restaurants.rating,
        ratingCount: o.restaurants.rating_count, description: o.restaurants.description, highlights: o.restaurants.highlights,
      },
      benefit: o.benefit, discountPct: o.discount_pct, giftLabel: o.gift_label, appliesTo: o.applies_to,
      maxParty: o.max_party, cardBg: o.card_bg, cardFg: o.card_fg,
      slots: o.offer_slots
        .map((s) => ({ id: s.id, startsAt: s.starts_at.slice(0, 5), tablesLeft: s.tables_left }))
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    }))
    .filter((o) => o.slots.some((s) => s.tablesLeft > 0));
  return { offers, demo: false };
}
