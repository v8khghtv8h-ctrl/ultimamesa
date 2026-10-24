"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { benefitLabel, type Offer } from "@/lib/types";
import type { ReservationView } from "@/lib/reservations";
import { demoReservations } from "@/lib/local";
import { bookSlot } from "@/app/reservas/actions";
import { QR } from "./Ticket";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

type Props = { offer: Offer; party: number; demo: boolean; loggedIn: boolean; onClose: () => void };

export function OfferDetail({ offer, party, demo, loggedIn, onClose }: Props) {
  const router = useRouter();
  const open = offer.slots.filter((s) => s.tablesLeft > 0);
  const [slot, setSlot] = useState<string | null>(open.length === 1 ? open[0].id : null);
  const [people, setPeople] = useState(Math.min(party, offer.maxParty));
  const [step, setStep] = useState<"pick" | "confirm">("pick");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [booked, setBooked] = useState<ReservationView | null>(null);
  const [pending, startTransition] = useTransition();
  const chosen = offer.slots.find((s) => s.id === slot);
  const r = offer.restaurant;
  const label = benefitLabel(offer);

  function next() {
    if (!chosen) return;
    if (!demo && !loggedIn) { router.push("/login?next=/"); return; }
    setStep("confirm");
  }

  function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!chosen) return;
    setError("");
    const view = (id: string, code: string): ReservationView => ({
      id, code, status: "confirmed", startsAt: chosen.startsAt, party: people, guestName: name.trim() || "Invitado",
      restaurantName: r.name, neighborhood: r.neighborhood, benefit: label, appliesTo: offer.appliesTo,
      cardBg: offer.cardBg, cardFg: offer.cardFg,
    });
    if (demo) {
      const code = `UM-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      const v = view(`ejemplo-${Date.now()}`, code);
      demoReservations.set([v, ...demoReservations.get()]);
      setBooked(v);
      return;
    }
    startTransition(async () => {
      const res = await bookSlot({ slotId: chosen.id, party: people, guestName: name, note });
      if (!res.ok) {
        if (res.needsLogin) { router.push("/login?next=/"); return; }
        setError(res.error);
        return;
      }
      setBooked(view(res.id, res.code));
      router.refresh();
    });
  }

  if (booked) {
    return (
      <div className="confirmed" role="dialog" aria-modal="true" aria-label="Reserva confirmada">
        <div className="confirmed-in">
          <div className="d-k">Mesa confirmada</div>
          <h2 className="display">Tu mesa<br />te espera.</h2>
          <div className="t-card">
            <QR value={`ULTIMAMESA:${booked.code}`} size={150} />
            <b style={{ letterSpacing: "0.12em" }}>{booked.code}</b>
            <div className="t-lines"><b>{r.name}</b> · {r.neighborhood}<br />Hoy {booked.startsAt} · {plural(booked.party, "persona", "personas")}<br />{label} · {offer.appliesTo}</div>
          </div>
          <p style={{ margin: 0, fontSize: 13 }}>Mostrá este código al llegar. Si no podés ir, cancelá desde Reservas.</p>
          {demo && <p className="banner" style={{ margin: 0 }}>Reserva de ejemplo: queda solo en este navegador.</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <Link className="book" href="/reservas" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Ver mis reservas</Link>
            <button className="outline" onClick={onClose}>Seguir mirando</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="detail" role="dialog" aria-modal="true" aria-label={r.name}
      style={{ ["--cbg" as string]: offer.cardBg, ["--cfg" as string]: offer.cardFg }}>
      <div className="detail-in">
        <button className="d-close" onClick={step === "pick" ? onClose : () => setStep("pick")} aria-label={step === "pick" ? "Cerrar" : "Volver"}>
          {step === "pick" ? "✕" : "←"}
        </button>
        {step === "pick" ? (
          <>
            <div className="d-k">{r.cuisine} · {r.neighborhood}</div>
            <div className={`d-big display ${offer.benefit === "discount" ? "" : "word"}`}>{label}</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{offer.appliesTo}</div>
            <div className="d-name display">{r.name}</div>
            <div className="facts">
              {r.rating != null && <span>★ {r.rating.toLocaleString("es-AR")} ({r.ratingCount.toLocaleString("es-AR")})</span>}
              <span>{"$".repeat(r.priceLevel)}</span>
            </div>
            {r.description && <p style={{ fontSize: 13.5, margin: "12px 0 0" }}>{r.description}</p>}
            {r.highlights.length > 0 && <div className="hl">{r.highlights.map((h) => <span key={h}>{h}</span>)}</div>}

            <div className="d-sec">Elegí horario</div>
            <div className="slots">
              {offer.slots.map((s) => (
                <button key={s.id} className="slot" aria-pressed={slot === s.id} disabled={!s.tablesLeft} onClick={() => setSlot(s.id)}>
                  <b className="display">{s.startsAt}</b>
                  <small>{s.tablesLeft ? plural(s.tablesLeft, "mesa", "mesas") : "Agotado"}</small>
                </button>
              ))}
            </div>

            <div className="d-sec">Personas</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button className="slot" style={{ minWidth: 0 }} onClick={() => setPeople(Math.max(1, people - 1))} aria-label="Menos personas">−</button>
              <b>{plural(people, "persona", "personas")}</b>
              <button className="slot" style={{ minWidth: 0 }} onClick={() => setPeople(Math.min(offer.maxParty, people + 1))} aria-label="Más personas">+</button>
            </div>

            <div className="d-sec">Condiciones</div>
            <p className="cond">
              Beneficio válido para esta reserva, hasta {plural(offer.maxParty, "persona", "personas")}. No acumulable con otras
              promociones. Tolerancia de 15 minutos. Si no podés ir, cancelá desde Reservas para liberar la mesa.
            </p>
          </>
        ) : (
          <form id="confirm-form" className="confirm-form" onSubmit={confirm}>
            <div className="d-k">Confirmá tu mesa</div>
            <div className="d-big display word" style={{ marginTop: 16 }}>{r.name}</div>
            <p style={{ fontSize: 15, fontWeight: 700 }}>Hoy {chosen?.startsAt} · {plural(people, "persona", "personas")}<br />{label} · {offer.appliesTo}</p>
            <label className="field">Nombre de la reserva
              <input id="guestName" autoComplete="name" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="field">Algo que el restaurante deba saber (opcional)
              <input id="note" maxLength={140} placeholder="Ej.: es un cumpleaños, celíaco" value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            <p className="cond">Reservar es gratis. Si no podés ir, cancelá desde Reservas para liberar la mesa.</p>
            {error && <p className="msg bad">{error}</p>}
          </form>
        )}
      </div>
      <div className="d-foot">
        <div className="d-foot-in">
          <span className="sum">
            {chosen ? <><b className="display" style={{ fontSize: 18, display: "block" }}>Hoy {chosen.startsAt}</b>{plural(people, "persona", "personas")}</> : "Elegí un horario"}
          </span>
          {step === "pick"
            ? <button className="d-cta" disabled={!chosen} onClick={next}>{!demo && !loggedIn ? "Ingresá para reservar" : "Continuar"}</button>
            : <button className="d-cta" type="submit" form="confirm-form" disabled={pending}>{pending ? "Reservando…" : "Confirmar reserva"}</button>}
        </div>
      </div>
    </div>
  );
}
