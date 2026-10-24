"use client";
import { useState } from "react";
import { benefitLabel, type Offer } from "@/lib/types";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function OfferDetail({ offer, party, onClose }: { offer: Offer; party: number; onClose: () => void }) {
  const open = offer.slots.filter((s) => s.tablesLeft > 0);
  const [slot, setSlot] = useState<string | null>(open.length === 1 ? open[0].id : null);
  const [people, setPeople] = useState(Math.min(party, offer.maxParty));
  const chosen = offer.slots.find((s) => s.id === slot);
  const r = offer.restaurant;

  return (
    <div className="detail" role="dialog" aria-modal="true" aria-label={r.name}
      style={{ ["--cbg" as string]: offer.cardBg, ["--cfg" as string]: offer.cardFg }}>
      <div className="detail-in">
        <button className="d-close" onClick={onClose} aria-label="Cerrar">✕</button>
        <div className="d-k">{r.cuisine} · {r.neighborhood}</div>
        <div className={`d-big display ${offer.benefit === "discount" ? "" : "word"}`}>{benefitLabel(offer)}</div>
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
          promociones. Tolerancia de 15 minutos. Podés cancelar sin costo hasta 1 hora antes.
        </p>
      </div>
      <div className="d-foot">
        <div className="d-foot-in">
          <span className="sum">
            {chosen ? <><b className="display" style={{ fontSize: 18, display: "block" }}>Hoy {chosen.startsAt}</b>{plural(people, "persona", "personas")}</> : "Elegí un horario"}
          </span>
          {/* La reserva con QR se conecta en la etapa 3 del plan. */}
          <button className="d-cta" disabled title="Disponible en la próxima versión">Reservar pronto</button>
        </div>
      </div>
    </div>
  );
}
