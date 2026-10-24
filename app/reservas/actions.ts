"use server";
import { revalidatePath } from "next/cache";
import { getServerSupabase } from "@/lib/supabase/server";

type BookResult = { ok: true; id: string; code: string } | { ok: false; error: string; needsLogin?: boolean };

// La función book_slot de la base valida cupo, personas y duplicados, y bloquea el horario.
export async function bookSlot(input: { slotId: string; party: number; guestName: string; note: string }): Promise<BookResult> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "La base de datos no está conectada." };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ingresá para reservar.", needsLogin: true };

  const { data, error } = await supabase.rpc("book_slot", {
    p_slot: input.slotId,
    p_party: input.party,
    p_guest_name: input.guestName.slice(0, 60),
    p_note: input.note.slice(0, 140),
  });
  if (error || !data) return { ok: false, error: error?.message ?? "No pudimos reservar." };
  revalidatePath("/");
  revalidatePath("/reservas");
  return { ok: true, id: data.id, code: data.code };
}

export async function cancelReservation(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, error: "La base de datos no está conectada." };
  const { error } = await supabase.rpc("cancel_reservation", { p_reservation: id });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  revalidatePath("/reservas");
  return { ok: true };
}
