import { demoOffers } from "./demo";
import { getServerSupabase } from "./supabase/server";

export type AdminRestaurant = {
  id: string; slug: string; name: string; neighborhood: string; cuisine: string; active: boolean;
  feeCents: number; staff: number; invites: string[];
};

type Row = {
  id: string; slug: string; name: string; neighborhood: string; cuisine: string; active: boolean; fee_cents: number;
  restaurant_staff: { user_id: string }[];
  restaurant_invites: { email: string; accepted_at: string | null }[];
};

export async function getAdminRestaurants(): Promise<AdminRestaurant[]> {
  const supabase = await getServerSupabase();
  if (!supabase) {
    const seen = new Map(demoOffers.map((o) => [o.restaurant.id, o.restaurant]));
    return [...seen.values()].map((r, i) => ({
      id: r.id, slug: `demo-${r.id}`, name: r.name, neighborhood: r.neighborhood, cuisine: r.cuisine, active: true,
      feeCents: 200, staff: i === 0 ? 1 : 0, invites: i === 1 ? ["duenia@casaombu.com.ar"] : [],
    }));
  }
  const { data, error } = await supabase
    .from("restaurants")
    .select("id, slug, name, neighborhood, cuisine, active, fee_cents, restaurant_staff (user_id), restaurant_invites (email, accepted_at)")
    .order("created_at", { ascending: false })
    .returns<Row[]>();
  if (error) throw new Error(`No pudimos cargar los restaurantes: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id, slug: r.slug, name: r.name, neighborhood: r.neighborhood, cuisine: r.cuisine, active: r.active,
    feeCents: r.fee_cents, staff: r.restaurant_staff.length,
    invites: r.restaurant_invites.filter((i) => !i.accepted_at).map((i) => i.email),
  }));
}

export function slugify(name: string) {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "restaurante";
}
