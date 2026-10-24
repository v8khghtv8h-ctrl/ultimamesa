"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { OfferCard } from "@/components/OfferCard";
import { CARD_COLORS, SERVICE_HOURS } from "@/lib/palette";
import type { PanelOffer, PanelRestaurant } from "@/lib/panel";
import { tablesLeft } from "@/lib/types";
import { createOffer, retireOffer, setOfferActive, setSlotTables, type NewOffer } from "@/app/panel/actions";

type Props = { restaurant: PanelRestaurant; offers: PanelOffer[]; demo: boolean };

const TEMPLATES: { title: string; hint: string; draft: Partial<NewOffer> }[] = [
  { title: "Mesa vacía ya", hint: "Descuento fuerte, sale en minutos", draft: { benefit: "discount", discountPct: 35, appliesTo: "Toda la carta", hours: ["21:30"], tablesPerSlot: 1, maxParty: 2, color: 0 } },
  { title: "Turno tranquilo", hint: "Llená el último turno", draft: { benefit: "discount", discountPct: 20, appliesTo: "Platos principales", hours: ["23:00", "23:30"], tablesPerSlot: 3, maxParty: 6, color: 5 } },
  { title: "Me cancelaron", hint: "Regalo para la mesa", draft: { benefit: "gift", giftLabel: "Postre", appliesTo: "Postre de la casa para la mesa", hours: ["22:00"], tablesPerSlot: 1, maxParty: 4, color: 2 } },
];

export function PanelCartas({ restaurant, offers: initial, demo }: Props) {
  const router = useRouter();
  const [offers, setOffers] = useState(initial);
  const [creating, setCreating] = useState(initial.length === 0);
  const [notice, setNotice] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  useEffect(() => setOffers(initial), [initial]);

  // Aplica el cambio en pantalla y, con base de datos, lo guarda; si falla, vuelve atrás.
  function run(change: (list: PanelOffer[]) => PanelOffer[], save: () => Promise<{ ok: boolean; error?: string; okText?: string }>, okText: string) {
    const before = offers;
    setOffers(change(offers));
    if (demo) { setNotice({ kind: "ok", text: `${okText} (modo de ejemplo, no se guarda)` }); return; }
    startTransition(async () => {
      const r = await save();
      if (!r.ok) { setOffers(before); setNotice({ kind: "bad", text: r.error ?? "Algo falló." }); return; }
      setNotice({ kind: "ok", text: r.okText ?? okText });
      router.refresh();
    });
  }

  const toggle = (o: PanelOffer) => run(
    (l) => l.map((x) => (x.id === o.id ? { ...x, active: !o.active } : x)),
    () => setOfferActive(o.id, !o.active),
    o.active ? "Carta pausada: ya no aparece en el mazo." : "Carta visible en la app.",
  );
  const tables = (o: PanelOffer, slotId: string, n: number) => run(
    (l) => l.map((x) => (x.id === o.id ? { ...x, slots: x.slots.map((s) => (s.id === slotId ? { ...s, tablesLeft: n } : s)) } : x)),
    () => setSlotTables(slotId, n),
    "Mesas actualizadas.",
  );
  const retire = (o: PanelOffer) => run(
    (l) => l.filter((x) => x.id !== o.id),
    async () => {
      const r = await retireOffer(o.id);
      return r.ok && r.paused ? { ok: true, okText: "Tenía reservas, así que la pausamos en lugar de borrarla." } : r;
    },
    "Carta retirada de la app.",
  );

  function publish(draft: NewOffer) {
    const color = CARD_COLORS[draft.color];
    const local: PanelOffer = {
      id: `nueva-${Date.now()}`, active: true, benefit: draft.benefit,
      discountPct: draft.benefit === "discount" ? draft.discountPct : null,
      giftLabel: draft.benefit === "gift" ? draft.giftLabel : null,
      appliesTo: draft.appliesTo, maxParty: draft.maxParty, cardBg: color.bg, cardFg: color.fg,
      restaurant: { id: restaurant.id, name: restaurant.name, neighborhood: restaurant.neighborhood, cuisine: restaurant.cuisine, priceLevel: 2, rating: null, ratingCount: 0, description: null, highlights: [] },
      slots: [...draft.hours].sort().map((h, i) => ({ id: `nueva-${Date.now()}-${i}`, startsAt: h, tablesLeft: draft.tablesPerSlot })),
    };
    setCreating(false);
    run((l) => [local, ...l], () => createOffer(draft), "Carta publicada. Ya aparece en el mazo de la app.");
  }

  const live = offers.filter((o) => o.active);
  const free = live.reduce((sum, o) => sum + tablesLeft(o), 0);

  return (
    <>
      <div className="p-stats">
        <div><b className="display">{live.length}</b><span>Cartas visibles hoy</span></div>
        <div><b className="display">{free}</b><span>Mesas libres publicadas</span></div>
        <div><b className="display">USD {(restaurant.feeCents / 100).toLocaleString("es-AR")}</b><span>Por comensal que llega</span></div>
      </div>

      {notice && (
        <p className={`msg ${notice.kind}`} role="status">
          {notice.text} <button className="link-btn" onClick={() => setNotice(null)} aria-label="Cerrar aviso">✕</button>
        </p>
      )}

      {creating
        ? <OfferForm restaurant={restaurant} onCancel={offers.length ? () => setCreating(false) : undefined} onPublish={publish} busy={pending} />
        : <button className="book" style={{ width: "100%", marginTop: 16 }} onClick={() => setCreating(true)}>+ Publicar una mesa</button>}

      <h2 className="display p-h2">Tus cartas de hoy</h2>
      {offers.length === 0 && <p>Todavía no publicaste cartas hoy.</p>}
      <div className="p-grid">
        {offers.map((o) => (
          <div key={o.id} className={`p-offer ${o.active ? "" : "paused"}`}>
            <div className="p-card"><OfferCard offer={o} /></div>
            <div className="p-controls">
              <label className="switch">
                <input type="checkbox" checked={o.active} onChange={() => toggle(o)} disabled={pending} />
                {o.active ? "Visible en la app" : "Pausada"}
              </label>
              <ul className="list">
                {o.slots.map((s) => (
                  <li key={s.id}>
                    <span><b>{s.startsAt}</b> · mesas libres</span>
                    <span className="stepper">
                      <button aria-label={`Menos mesas a las ${s.startsAt}`} disabled={pending || s.tablesLeft === 0} onClick={() => tables(o, s.id, s.tablesLeft - 1)}>−</button>
                      <b>{s.tablesLeft}</b>
                      <button aria-label={`Más mesas a las ${s.startsAt}`} disabled={pending || s.tablesLeft >= 20} onClick={() => tables(o, s.id, s.tablesLeft + 1)}>+</button>
                    </span>
                  </li>
                ))}
              </ul>
              <RetireButton onConfirm={() => retire(o)} disabled={pending} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function RetireButton({ onConfirm, disabled }: { onConfirm: () => void; disabled: boolean }) {
  const [sure, setSure] = useState(false);
  return (
    <button className={`outline ${sure ? "danger" : ""}`} disabled={disabled}
      onClick={() => (sure ? onConfirm() : setSure(true))} onBlur={() => setSure(false)}>
      {sure ? "¿Seguro? Tocá de nuevo para retirar" : "Retirar carta"}
    </button>
  );
}

function OfferForm({ restaurant, onCancel, onPublish, busy }: {
  restaurant: PanelRestaurant; onCancel?: () => void; onPublish: (d: NewOffer) => void; busy: boolean;
}) {
  const [d, setD] = useState<NewOffer>({
    restaurantId: restaurant.id, benefit: "discount", discountPct: 30, giftLabel: "Postre",
    appliesTo: "", hours: ["21:30", "22:00"], tablesPerSlot: 2, maxParty: 4, color: 0,
  });
  const [error, setError] = useState("");
  const set = (p: Partial<NewOffer>) => { setD({ ...d, ...p }); setError(""); };
  const color = CARD_COLORS[d.color];
  const preview: PanelOffer = {
    id: "preview", active: true, benefit: d.benefit, discountPct: d.discountPct, giftLabel: d.giftLabel.trim() || "Regalo",
    appliesTo: d.appliesTo.trim() || "Contá qué incluye", maxParty: d.maxParty, cardBg: color.bg, cardFg: color.fg,
    restaurant: { id: restaurant.id, name: restaurant.name, neighborhood: restaurant.neighborhood, cuisine: restaurant.cuisine, priceLevel: 2, rating: null, ratingCount: 0, description: null, highlights: [] },
    slots: [...d.hours].sort().map((h) => ({ id: h, startsAt: h, tablesLeft: d.tablesPerSlot })),
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!d.appliesTo.trim()) return setError("Contá sobre qué aplica el beneficio.");
    if (!d.hours.length) return setError("Elegí al menos un horario.");
    if (d.benefit === "gift" && !d.giftLabel.trim()) return setError("Poné qué regalás.");
    onPublish(d);
  }

  return (
    <form className="p-form" onSubmit={submit}>
      <div className="p-form-fields">
        <h2 className="display p-h2" style={{ marginTop: 0 }}>Publicar una mesa</h2>
        <div className="p-k">Empezá con una plantilla</div>
        <div className="p-tpls">
          {TEMPLATES.map((t) => (
            <button type="button" key={t.title} className="p-tpl" onClick={() => set(t.draft)}>
              <b>{t.title}</b>{t.hint}
            </button>
          ))}
        </div>

        <div className="p-k">Beneficio</div>
        <div className="quick">
          <button type="button" className="chip" aria-pressed={d.benefit === "discount"} onClick={() => set({ benefit: "discount" })}>Descuento</button>
          <button type="button" className="chip" aria-pressed={d.benefit === "gift"} onClick={() => set({ benefit: "gift" })}>Regalo</button>
        </div>
        {d.benefit === "discount" ? (
          <label className="p-range">
            <span className="sr-only">Porcentaje de descuento</span>
            <input id="pct" type="range" min={5} max={60} step={5} value={d.discountPct} onChange={(e) => set({ discountPct: +e.target.value })} />
            <output className="display">-{d.discountPct}%</output>
          </label>
        ) : (
          <label className="field">Qué regalás (una o dos palabras)
            <input id="gift" maxLength={14} value={d.giftLabel} onChange={(e) => set({ giftLabel: e.target.value })} />
          </label>
        )}

        <label className="field">Sobre qué aplica
          <input id="appliesTo" maxLength={60} value={d.appliesTo} placeholder="Ej.: Ojo de bife para dos" onChange={(e) => set({ appliesTo: e.target.value })} />
        </label>

        <div className="p-k">Horarios de hoy</div>
        <div className="quick" style={{ flexWrap: "wrap" }}>
          {SERVICE_HOURS.map((h) => (
            <button type="button" key={h} className="chip" aria-pressed={d.hours.includes(h)}
              onClick={() => set({ hours: d.hours.includes(h) ? d.hours.filter((x) => x !== h) : [...d.hours, h] })}>{h}</button>
          ))}
        </div>

        <div className="p-two">
          <div><div className="p-k">Mesas por horario</div><Stepper value={d.tablesPerSlot} min={1} max={20} onChange={(n) => set({ tablesPerSlot: n })} label="mesas" /></div>
          <div><div className="p-k">Personas por mesa (máx.)</div><Stepper value={d.maxParty} min={1} max={12} onChange={(n) => set({ maxParty: n })} label="personas" /></div>
        </div>

        <div className="p-k">Color de la carta</div>
        <div className="p-swatches">
          {CARD_COLORS.map((c, i) => (
            <button type="button" key={c.bg} className="p-swatch" style={{ background: c.bg }} aria-pressed={d.color === i}
              aria-label={`Color ${i + 1}`} onClick={() => set({ color: i })} />
          ))}
        </div>

        {error && <p className="msg bad">{error}</p>}
        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <button className="book" disabled={busy}>{busy ? "Publicando…" : "Publicar carta"}</button>
          {onCancel && <button type="button" className="outline" onClick={onCancel}>Cancelar</button>}
        </div>
      </div>
      <div className="p-preview">
        <div className="p-k">Así la ve el usuario</div>
        <div className="p-card"><OfferCard offer={preview} /></div>
      </div>
    </form>
  );
}

function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (n: number) => void; label: string }) {
  return (
    <span className="stepper">
      <button type="button" aria-label={`Menos ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
      <b>{value}</b>
      <button type="button" aria-label={`Más ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
    </span>
  );
}
