import { getServerSupabase } from "./supabase/server";
import { benefitLabel } from "./types";

// Lo que la persona ve de una reserva, venga de la base o del modo de ejemplo.
export type ReservationView = {
  id: string;
  code: string;
  status: "confirmed" | "arrived" | "no_show" | "cancelled";
  startsAt: string;
  party: number;
  guestName: string;
  restaurantName: string;
  neighborhood: string;
  benefit: string;
  appliesTo: string;
  cardBg: string;
  cardFg: string;
};

type Row = {
  id: string; code: string; status: ReservationView["status"]; party_size: number; guest_name: string;
  offer_slots: { starts_at: string } | null;
  offers: { benefit: "discount" | "gift"; discount_pct: number | null; gift_label: string | null; applies_to: string; card_bg: string; card_fg: string } | null;
  restaurants: { name: string; neighborhood: string } | null;
};

export async function getMyReservations(): Promise<ReservationView[] | null> {
  const supabase = await getServerSupabase();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("reservations")
    .select(`id, code, status, party_size, guest_name,
      offer_slots (starts_at),
      offers (benefit, discount_pct, gift_label, applies_to, card_bg, card_fg),
      restaurants (name, neighborhood)`)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30)
    .returns<Row[]>();
  if (error) throw new Error(`No pudimos cargar tus reservas: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id, code: r.code, status: r.status, party: r.party_size, guestName: r.guest_name,
    startsAt: r.offer_slots?.starts_at.slice(0, 5) ?? "--:--",
    restaurantName: r.restaurants?.name ?? "Restaurante",
    neighborhood: r.restaurants?.neighborhood ?? "",
    // Si el restaurante pausó la carta después, la reserva sigue valiendo aunque no veamos sus datos.
    benefit: r.offers ? benefitLabel({ benefit: r.offers.benefit, discountPct: r.offers.discount_pct, giftLabel: r.offers.gift_label }) : "Beneficio",
    appliesTo: r.offers?.applies_to ?? "Según la carta reservada",
    cardBg: r.offers?.card_bg ?? "#191512",
    cardFg: r.offers?.card_fg ?? "#ffe14d",
  }));
}
