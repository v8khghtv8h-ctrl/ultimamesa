"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { OfferDetail } from "@/components/OfferDetail";
import { savedStore } from "@/lib/local";
import { benefitLabel, type Offer } from "@/lib/types";

export function SavedList({ offers, demo, loggedIn }: { offers: Offer[]; demo: boolean; loggedIn: boolean }) {
  const [ids, setIds] = useState<string[] | null>(null);
  const [open, setOpen] = useState<Offer | null>(null);
  useEffect(() => setIds(savedStore.get()), []);

  if (ids === null) return null;
  const saved = ids.map((id) => offers.find((o) => o.id === id)).filter((o): o is Offer => Boolean(o));
  const remove = (id: string) => { const next = ids.filter((x) => x !== id); savedStore.set(next); setIds(next); };

  if (!saved.length) {
    return (
      <div className="empty-state">
        <b className="display">Todavía no guardaste nada</b>
        Deslizá una carta hacia la derecha para guardarla. Las que ya no tienen mesas desaparecen de acá.
        <Link className="outline" href="/">Ver mesas</Link>
      </div>
    );
  }
  return (
    <>
      {saved.map((o) => (
        <div key={o.id} className="mini" role="button" tabIndex={0} onClick={() => setOpen(o)}
          onKeyDown={(e) => { if (e.key === "Enter") setOpen(o); }}>
          <span className="sw display" style={{ ["--cbg" as string]: o.cardBg, ["--cfg" as string]: o.cardFg }}>{benefitLabel(o)}</span>
          <span>
            <b className="display">{o.restaurant.name}</b>
            <small>{o.appliesTo}</small>
            <small>{o.slots.filter((s) => s.tablesLeft > 0).map((s) => s.startsAt).join(" · ")}</small>
          </span>
          <button className="x" aria-label={`Quitar ${o.restaurant.name}`} onClick={(e) => { e.stopPropagation(); remove(o.id); }}>✕</button>
        </div>
      ))}
      {open && <OfferDetail offer={open} party={2} demo={demo} loggedIn={loggedIn} onClose={() => setOpen(null)} />}
    </>
  );
}
