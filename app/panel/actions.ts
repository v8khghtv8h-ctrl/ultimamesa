"use server";
import { revalidatePath } from "next/cache";
import { CARD_COLORS, SERVICE_HOURS } from "@/lib/palette";
import { todayAR } from "@/lib/panel";
import { getServerSupabase } from "@/lib/supabase/server";

export type NewOffer = {
  restaurantId: string;
  benefit: "discount" | "gift";
  discountPct: number;
  giftLabel: string;
  appliesTo: string;
  hours: string[];
  tablesPerSlot: number;
  maxParty: number;
  color: number;
};

type Result = { ok: true } | { ok: false; error: string };

// Las reglas de acceso de la base ya impiden tocar cartas de otro restaurante;
// acá validamos los datos para devolver mensajes claros.
async function client() {
  const supabase = await getServerSupabase();
  if (!supabase) return { supabase: null, error: "La base de datos no está conectada." };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase: null, error: "Tu sesión venció. Volvé a ingresar." };
  return { supabase, error: null };
}

export async function createOffer(input: NewOffer): Promise<Result> {
  const c = await client();
  if (!c.supabase) return { ok: false, error: c.error };
  const appliesTo = input.appliesTo.trim();
  const gift = input.giftLabel.trim();
  const hours = [...new Set(input.hours)].filter((h) => SERVICE_HOURS.includes(h));
  const color = CARD_COLORS[input.color];
  if (!appliesTo || appliesTo.length > 60) return { ok: false, error: "Contá sobre qué aplica el beneficio (hasta 60 letras)." };
  if (!hours.length) return { ok: false, error: "Elegí al menos un horario." };
  if (!color) return { ok: false, error: "Elegí un color de la lista." };
  if (input.benefit === "discount" && !(input.discountPct >= 5 && input.discountPct <= 60)) return { ok: false, error: "El descuento va de 5% a 60%." };
  if (input.benefit === "gift" && (!gift || gift.length > 14)) return { ok: false, error: "El regalo necesita un nombre corto (hasta 14 letras)." };
  if (!(input.tablesPerSlot >= 1 && input.tablesPerSlot <= 20)) return { ok: false, error: "Las mesas por horario van de 1 a 20." };
  if (!(input.maxParty >= 1 && input.maxParty <= 12)) return { ok: false, error: "Las personas por mesa van de 1 a 12." };

  const { data: offer, error } = await c.supabase.from("offers").insert({
    restaurant_id: input.restaurantId,
    benefit: input.benefit,
    discount_pct: input.benefit === "discount" ? Math.round(input.discountPct) : null,
    gift_label: input.benefit === "gift" ? gift : null,
    applies_to: appliesTo,
    max_party: input.maxParty,
    service_date: todayAR(),
    card_bg: color.bg,
    card_fg: color.fg,
  }).select("id").single();
  if (error || !offer) return { ok: false, error: `No pudimos publicar la carta: ${error?.message ?? "sin respuesta"}` };

  const { error: slotError } = await c.supabase.from("offer_slots")
    .insert(hours.map((h) => ({ offer_id: offer.id, starts_at: h, tables_left: input.tablesPerSlot })));
  if (slotError) {
    await c.supabase.from("offers").delete().eq("id", offer.id);
    return { ok: false, error: `No pudimos guardar los horarios: ${slotError.message}` };
  }
  revalidatePath("/panel");
  revalidatePath("/");
  return { ok: true };
}

export async function setOfferActive(offerId: string, active: boolean): Promise<Result> {
  const c = await client();
  if (!c.supabase) return { ok: false, error: c.error };
  const { error, count } = await c.supabase.from("offers").update({ active }, { count: "exact" }).eq("id", offerId);
  if (error || !count) return { ok: false, error: "No pudimos cambiar la carta." };
  revalidatePath("/panel");
  revalidatePath("/");
  return { ok: true };
}

export async function setSlotTables(slotId: string, tables: number): Promise<Result> {
  const c = await client();
  if (!c.supabase) return { ok: false, error: c.error };
  if (!(tables >= 0 && tables <= 20)) return { ok: false, error: "Las mesas van de 0 a 20." };
  const { error, count } = await c.supabase.from("offer_slots").update({ tables_left: tables }, { count: "exact" }).eq("id", slotId);
  if (error || !count) return { ok: false, error: "No pudimos cambiar las mesas." };
  revalidatePath("/panel");
  revalidatePath("/");
  return { ok: true };
}

// Si la carta ya tiene reservas no se puede borrar (hay que conservarlas): se pausa.
export async function retireOffer(offerId: string): Promise<Result & { paused?: boolean }> {
  const c = await client();
  if (!c.supabase) return { ok: false, error: c.error };
  const { count } = await c.supabase.from("reservations").select("id", { count: "exact", head: true }).eq("offer_id", offerId);
  if (count) {
    const r = await setOfferActive(offerId, false);
    return r.ok ? { ok: true, paused: true } : r;
  }
  const { error, count: deleted } = await c.supabase.from("offers").delete({ count: "exact" }).eq("id", offerId);
  if (error || !deleted) return { ok: false, error: "No pudimos retirar la carta." };
  revalidatePath("/panel");
  revalidatePath("/");
  return { ok: true };
}
