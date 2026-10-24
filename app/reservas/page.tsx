import Link from "next/link";
import { TabBar } from "@/components/TabBar";
import { MyReservations } from "@/components/reservas/MyReservations";
import { getMyReservations } from "@/lib/reservations";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export default async function ReservationsPage() {
  const demo = !isSupabaseConfigured;
  const list = demo ? [] : await getMyReservations();
  return (
    <main className="app">
      <section className="view">
        <h1 className="v-title display">Reservas</h1>
        <p className="v-sub">Mostrá el código al llegar. Reservar no tiene costo.</p>
        {list === null ? (
          <div className="empty-state">
            <b className="display">Ingresá para ver tus reservas</b>
            <Link className="outline" href="/login?next=/reservas">Ingresar</Link>
          </div>
        ) : (
          <MyReservations initial={list} demo={demo} />
        )}
      </section>
      <TabBar current="/reservas" />
    </main>
  );
}
