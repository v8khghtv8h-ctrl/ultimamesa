"use client";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ticket } from "@/components/Ticket";
import { demoReservations } from "@/lib/local";
import type { ReservationView } from "@/lib/reservations";
import { cancelReservation } from "@/app/reservas/actions";

// Con base de datos recibe las reservas del servidor; en modo de ejemplo las lee de este navegador.
export function MyReservations({ initial, demo }: { initial: ReservationView[]; demo: boolean }) {
  const router = useRouter();
  const [list, setList] = useState<ReservationView[] | null>(demo ? null : initial);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  useEffect(() => { setList(demo ? demoReservations.get() : initial); }, [demo, initial]);

  function cancel(r: ReservationView) {
    setError("");
    if (demo) {
      const next = (list ?? []).map((x) => (x.id === r.id ? { ...x, status: "cancelled" as const } : x));
      demoReservations.set(next);
      setList(next);
      return;
    }
    startTransition(async () => {
      const res = await cancelReservation(r.id);
      if (!res.ok) { setError(res.error ?? "No pudimos cancelar."); return; }
      router.refresh();
    });
  }

  if (list === null) return null;
  if (!list.length) {
    return (
      <div className="empty-state">
        <b className="display">No tenés reservas</b>
        Cuando reserves una mesa, tu código QR aparece acá.
        <Link className="outline" href="/">Buscar una mesa</Link>
      </div>
    );
  }
  return (
    <>
      {error && <p className="msg bad">{error}</p>}
      {list.map((r) => <Ticket key={r.id} r={r} busy={pending} onCancel={() => cancel(r)} />)}
    </>
  );
}
