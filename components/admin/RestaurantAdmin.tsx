"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AdminRestaurant } from "@/lib/admin";
import { createRestaurant, inviteToRestaurant, setRestaurantActive, type NewRestaurant } from "@/app/admin/actions";

type Notice = { kind: "ok" | "bad"; text: string } | null;

const EMPTY: NewRestaurant = {
  name: "", neighborhood: "", cuisine: "", address: "", priceLevel: 2, description: "", highlights: "", feeUsd: 2, ownerEmail: "",
};

export function RestaurantAdmin({ restaurants: initial, demo }: { restaurants: AdminRestaurant[]; demo: boolean }) {
  const router = useRouter();
  const [list, setList] = useState(initial);
  const [d, setD] = useState<NewRestaurant>(EMPTY);
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, startTransition] = useTransition();
  useEffect(() => setList(initial), [initial]);
  const set = (p: Partial<NewRestaurant>) => setD({ ...d, ...p });

  function done(r: { ok: true; text: string } | { ok: false; error: string }, after?: () => void) {
    if (!r.ok) { setNotice({ kind: "bad", text: r.error }); return; }
    setNotice({ kind: "ok", text: r.text });
    after?.();
    router.refresh();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (demo) {
      const email = d.ownerEmail.trim().toLowerCase();
      setList([{ id: `nuevo-${Date.now()}`, slug: "", name: d.name.trim(), neighborhood: d.neighborhood.trim(), cuisine: d.cuisine.trim(),
        active: true, feeCents: Math.round(d.feeUsd * 100), staff: 0, invites: email ? [email] : [] }, ...list]);
      setNotice({ kind: "ok", text: `${d.name.trim()} quedó dado de alta (modo de ejemplo, no se guarda).` });
      setD(EMPTY);
      return;
    }
    startTransition(async () => done(await createRestaurant(d), () => setD(EMPTY)));
  }

  function invite(r: AdminRestaurant, email: string, clear: () => void) {
    if (demo) {
      setList(list.map((x) => (x.id === r.id ? { ...x, invites: [...x.invites, email.trim().toLowerCase()] } : x)));
      setNotice({ kind: "ok", text: `Invitamos a ${email.trim()} (modo de ejemplo, no se guarda).` });
      clear();
      return;
    }
    startTransition(async () => done(await inviteToRestaurant(r.id, email), clear));
  }

  function toggle(r: AdminRestaurant) {
    if (demo) { setList(list.map((x) => (x.id === r.id ? { ...x, active: !r.active } : x))); return; }
    startTransition(async () => done(await setRestaurantActive(r.id, !r.active)));
  }

  return (
    <>
      <form className="ad-form" onSubmit={submit}>
        <h2 className="display p-h2" style={{ marginTop: 0 }}>Dar de alta un restaurante</h2>
        <div className="ad-grid">
          <label className="field">Nombre<input id="r-name" required maxLength={60} value={d.name} onChange={(e) => set({ name: e.target.value })} /></label>
          <label className="field">Barrio<input id="r-hood" required maxLength={40} value={d.neighborhood} placeholder="Palermo" onChange={(e) => set({ neighborhood: e.target.value })} /></label>
          <label className="field">Tipo de cocina<input id="r-cuisine" required maxLength={40} value={d.cuisine} placeholder="Parrilla" onChange={(e) => set({ cuisine: e.target.value })} /></label>
          <label className="field">Dirección<input id="r-address" maxLength={120} value={d.address} onChange={(e) => set({ address: e.target.value })} /></label>
          <label className="field">Precio
            <select id="r-price" value={d.priceLevel} onChange={(e) => set({ priceLevel: +e.target.value })}>
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{"$".repeat(n)}</option>)}
            </select>
          </label>
          <label className="field">Comisión por comensal (USD)
            <input id="r-fee" type="number" min={0} max={20} step={0.5} value={d.feeUsd} onChange={(e) => set({ feeUsd: +e.target.value })} />
          </label>
          <label className="field wide">Descripción (opcional)
            <textarea id="r-desc" maxLength={240} value={d.description} placeholder="Una línea que lo presente en la app" onChange={(e) => set({ description: e.target.value })} />
          </label>
          <label className="field wide">Destacados (opcional) <small>separados por coma, hasta 6</small>
            <input id="r-hl" maxLength={160} value={d.highlights} placeholder="Patio, Vino por copa, Opción vegana" onChange={(e) => set({ highlights: e.target.value })} />
          </label>
          <label className="field wide">Email del dueño o encargado <small>entra al panel con este email</small>
            <input id="r-email" type="email" maxLength={120} value={d.ownerEmail} placeholder="duenio@restaurante.com" onChange={(e) => set({ ownerEmail: e.target.value })} />
          </label>
        </div>
        <button className="book" style={{ marginTop: 16 }} disabled={pending}>{pending ? "Guardando…" : "Dar de alta"}</button>
      </form>

      {notice && (
        <p className={`msg ${notice.kind}`} role="status">
          {notice.text} <button className="link-btn" onClick={() => setNotice(null)} aria-label="Cerrar aviso">✕</button>
        </p>
      )}

      <h2 className="display p-h2">Restaurantes ({list.length})</h2>
      {list.length === 0 && <p>Todavía no hay restaurantes. Dá de alta el primero arriba.</p>}
      <ul className="ad-list">
        {list.map((r) => <RestaurantRow key={r.id} r={r} busy={pending} onInvite={invite} onToggle={toggle} />)}
      </ul>
    </>
  );
}

function RestaurantRow({ r, busy, onInvite, onToggle }: {
  r: AdminRestaurant; busy: boolean;
  onInvite: (r: AdminRestaurant, email: string, clear: () => void) => void;
  onToggle: (r: AdminRestaurant) => void;
}) {
  const [email, setEmail] = useState("");
  return (
    <li className={`ad-r ${r.active ? "" : "off"}`}>
      <h3 className="display">{r.name}</h3>
      <p>{r.cuisine} · {r.neighborhood} · USD {(r.feeCents / 100).toLocaleString("es-AR")} por comensal</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <span className={`ad-pill ${r.staff ? "ok" : ""}`}>{r.staff ? `${r.staff} con acceso al panel` : "Nadie con acceso todavía"}</span>
        {r.invites.map((e) => <span key={e} className="ad-pill">Invitado: {e}</span>)}
      </div>
      <form className="ad-inv" onSubmit={(e) => { e.preventDefault(); if (email.trim()) onInvite(r, email, () => setEmail("")); }}>
        <label className="sr-only" htmlFor={`inv-${r.id}`}>Email para invitar a {r.name}</label>
        <input id={`inv-${r.id}`} type="email" placeholder="Invitar por email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="outline" disabled={busy || !email.trim()}>Invitar</button>
      </form>
      <label className="switch">
        <input type="checkbox" checked={r.active} onChange={() => onToggle(r)} disabled={busy} />
        {r.active ? "Visible en la app" : "Pausado"}
      </label>
    </li>
  );
}
