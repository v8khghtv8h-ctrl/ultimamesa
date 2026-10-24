"use server";
import { revalidatePath } from "next/cache";
import { slugify } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase/server";

export type NewRestaurant = {
  name: string; neighborhood: string; cuisine: string; address: string; priceLevel: number;
  description: string; highlights: string; feeUsd: number; ownerEmail: string;
};

type Result = { ok: true; text: string } | { ok: false; error: string };

// Las reglas de la base solo dejan escribir al equipo (platform_admins); acá validamos para dar mensajes claros.
async function client() {
  const supabase = await getServerSupabase();
  if (!supabase) return { supabase: null, error: "La base de datos no está conectada." };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase: null, error: "Tu sesión venció. Volvé a ingresar." };
  return { supabase, error: null };
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const inviteText = (r: string, email: string) => r === "added"
  ? `${email} ya tenía cuenta: ya puede entrar al panel.`
  : `Invitamos a ${email}: cuando ingrese con ese email, va a ver el panel.`;

export async function createRestaurant(input: NewRestaurant): Promise<Result> {
  const c = await client();
  if (!c.supabase) return { ok: false, error: c.error };
  const name = input.name.trim(), neighborhood = input.neighborhood.trim(), cuisine = input.cuisine.trim();
  const email = input.ownerEmail.trim().toLowerCase();
  if (!name || name.length > 60) return { ok: false, error: "Poné el nombre del restaurante (hasta 60 letras)." };
  if (!neighborhood || !cuisine) return { ok: false, error: "Completá barrio y tipo de cocina." };
  if (!(input.priceLevel >= 1 && input.priceLevel <= 4)) return { ok: false, error: "El precio va de $ a $$$$." };
  if (!(input.feeUsd >= 0 && input.feeUsd <= 20)) return { ok: false, error: "La comisión va de USD 0 a USD 20 por comensal." };
  if (email && !EMAIL.test(email)) return { ok: false, error: "El email del dueño no parece válido." };

  const base = slugify(name);
  const { data: taken } = await c.supabase.from("restaurants").select("slug").like("slug", `${base}%`);
  const used = new Set((taken ?? []).map((t) => t.slug));
  let slug = base;
  for (let i = 2; used.has(slug); i++) slug = `${base}-${i}`;

  const { data: created, error } = await c.supabase.from("restaurants").insert({
    slug, name, neighborhood, cuisine,
    address: input.address.trim() || null,
    price_level: input.priceLevel,
    description: input.description.trim() || null,
    highlights: input.highlights.split(",").map((h) => h.trim()).filter(Boolean).slice(0, 6),
    fee_cents: Math.round(input.feeUsd * 100),
  }).select("id").single();
  if (error || !created) return { ok: false, error: `No pudimos crear el restaurante: ${error?.message ?? "sin respuesta"}` };

  revalidatePath("/admin/restaurantes");
  if (!email) return { ok: true, text: `${name} quedó dado de alta. Falta invitar a alguien para que maneje el panel.` };
  const { data: r, error: invError } = await c.supabase.rpc("invite_to_restaurant", { p_restaurant: created.id, p_email: email });
  if (invError) return { ok: false, error: `Creamos ${name}, pero no pudimos invitar a ${email}: ${invError.message}` };
  return { ok: true, text: `${name} quedó dado de alta. ${inviteText(String(r), email)}` };
}

export async function inviteToRestaurant(restaurantId: string, rawEmail: string): Promise<Result> {
  const c = await client();
  if (!c.supabase) return { ok: false, error: c.error };
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL.test(email)) return { ok: false, error: "Ese email no parece válido." };
  const { data, error } = await c.supabase.rpc("invite_to_restaurant", { p_restaurant: restaurantId, p_email: email });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/restaurantes");
  return { ok: true, text: inviteText(String(data), email) };
}

export async function setRestaurantActive(restaurantId: string, active: boolean): Promise<Result> {
  const c = await client();
  if (!c.supabase) return { ok: false, error: c.error };
  const { error, count } = await c.supabase.from("restaurants").update({ active }, { count: "exact" }).eq("id", restaurantId);
  if (error || !count) return { ok: false, error: "No pudimos cambiar el restaurante." };
  revalidatePath("/admin/restaurantes");
  revalidatePath("/");
  return { ok: true, text: active ? "Restaurante visible en la app." : "Restaurante pausado: sus cartas no aparecen en la app." };
}
