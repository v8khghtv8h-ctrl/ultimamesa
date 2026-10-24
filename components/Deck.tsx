"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { OfferCard } from "./OfferCard";
import { OfferDetail } from "./OfferDetail";
import type { Offer } from "@/lib/types";
import { savedStore } from "@/lib/local";

type Decision = { id: string; dir: 1 | -1 };

export function Deck({ offers, demo, loggedIn }: { offers: Offer[]; demo: boolean; loggedIn: boolean }) {
  const [party, setParty] = useState(2);
  const [cuisines, setCuisines] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<Decision[]>([]);
  const [open, setOpen] = useState<Offer | null>(null);
  const [leaving, setLeaving] = useState<Decision | null>(null);

  const allCuisines = useMemo(() => [...new Set(offers.map((o) => o.restaurant.cuisine))], [offers]);
  const decided = useMemo(() => new Set(history.map((h) => h.id)), [history]);
  const saved = history.filter((h) => h.dir === 1).length;
  const visible = offers.filter(
    (o) => !decided.has(o.id) && o.maxParty >= party && (!cuisines.size || cuisines.has(o.restaurant.cuisine)),
  );
  const top = visible[0];

  // Las cartas guardadas se recuerdan en este navegador para la pestaña Guardadas.
  useEffect(() => {
    const ids = savedStore.get();
    if (ids.length) setHistory(ids.filter((id) => offers.some((o) => o.id === id)).map((id) => ({ id, dir: 1 as const })));
  }, [offers]);
  function remember(next: Decision[]) {
    savedStore.set(next.filter((h) => h.dir === 1).map((h) => h.id));
    return next;
  }

  function decide(dir: 1 | -1) {
    if (!top || leaving) return;
    setLeaving({ id: top.id, dir });
    setTimeout(() => {
      setHistory((h) => remember([...h, { id: top.id, dir }]));
      setLeaving(null);
    }, 240);
  }

  function toggleCuisine(c: string) {
    const next = new Set(cuisines);
    next.has(c) ? next.delete(c) : next.add(c);
    setCuisines(next);
  }

  return (
    <>
      <div className="quick" role="group" aria-label="Filtros rápidos" style={{ padding: "0 20px" }}>
        <button className="chip" aria-pressed="true" onClick={() => setParty(party >= 6 ? 1 : party + 1)}>
          {party} {party === 1 ? "persona" : "personas"}
        </button>
        {allCuisines.map((c) => (
          <button key={c} className="chip" aria-pressed={cuisines.has(c)} onClick={() => toggleCuisine(c)}>{c}</button>
        ))}
      </div>

      <div className="deck" onKeyDown={(e) => { if (e.key === "ArrowRight") decide(1); if (e.key === "ArrowLeft") decide(-1); }}>
        {top ? (
          visible.slice(0, 3).map((o, i) => (
            <SwipeCard key={o.id} offer={o} depth={i} leaving={leaving?.id === o.id ? leaving.dir : 0}
              onDecide={decide} onOpen={() => setOpen(o)} />
          )).reverse()
        ) : (
          <div className="end">
            <h2 className="display">Viste todas las mesas de esta noche</h2>
            <p>{saved ? `Guardaste ${saved}. ` : ""}Se liberan mesas a cada rato.</p>
            {history.some((h) => h.dir === -1) && <button className="outline" onClick={() => setHistory((h) => h.filter((x) => x.dir === 1))}>Ver las que pasé</button>}
          </div>
        )}
      </div>

      <div className="actions">
        <button className="round" style={{ width: 40, height: 40, fontSize: 15 }} aria-label="Deshacer"
          disabled={!history.length} onClick={() => setHistory((h) => remember(h.slice(0, -1)))}>↺</button>
        <button className="round" aria-label="Pasar" disabled={!top} onClick={() => decide(-1)}>✕</button>
        <button className="book" disabled={!top} onClick={() => top && setOpen(top)}>Reservar</button>
        <button className="round" aria-label="Guardar" disabled={!top} onClick={() => decide(1)}>♥</button>
      </div>

      {open && <OfferDetail offer={open} party={party} demo={demo} loggedIn={loggedIn} onClose={() => setOpen(null)} />}
    </>
  );
}

function SwipeCard({ offer, depth, leaving, onDecide, onOpen }: {
  offer: Offer; depth: number; leaving: 0 | 1 | -1; onDecide: (dir: 1 | -1) => void; onOpen: () => void;
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef(0);
  const isTop = depth === 0;

  const transform = leaving
    ? `translateX(${leaving * 140}%) rotate(${leaving * 20}deg)`
    : dragging || dx
      ? `translateX(${dx}px) rotate(${dx / 16}deg)`
      : `translateY(${depth * 12}px) scale(${1 - depth * 0.05})`;

  return (
    <div
      tabIndex={isTop ? 0 : -1}
      onPointerDown={isTop ? (e) => { start.current = e.clientX; setDragging(true); e.currentTarget.setPointerCapture(e.pointerId); } : undefined}
      onPointerMove={isTop ? (e) => { if (dragging) setDx(e.clientX - start.current); } : undefined}
      onPointerUp={isTop ? () => {
        setDragging(false);
        if (Math.abs(dx) > 90) onDecide(dx > 0 ? 1 : -1);
        else if (Math.abs(dx) < 6) onOpen();
        setDx(0);
      } : undefined}
      onPointerCancel={() => { setDragging(false); setDx(0); }}
      onKeyDown={isTop ? (e) => { if (e.key === "Enter") onOpen(); } : undefined}
      style={{ position: "absolute", inset: 0, zIndex: 10 - depth }}
    >
      <OfferCard
        offer={offer}
        className={dragging ? "drag" : ""}
        style={{ transform, opacity: leaving ? 0 : 1, ["--yes" as string]: Math.max(0, Math.min(1, dx / 90)), ["--no" as string]: Math.max(0, Math.min(1, -dx / 90)) }}
      />
    </div>
  );
}
