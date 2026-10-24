"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PanelReservation, PanelRestaurant } from "@/lib/panel";
import { markNoShow, registerArrival } from "@/app/panel/actions";
import { QRScanner } from "./QRScanner";

type Props = { restaurant: PanelRestaurant; reservations: PanelReservation[]; demo: boolean };

const STATUS: Record<PanelReservation["status"], string> = {
  confirmed: "Por llegar",
  arrived: "Llegó",
  no_show: "No vino",
  cancelled: "Canceló",
};

const usd = (cents: number) => `USD ${(cents / 100).toLocaleString("es-AR")}`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// Minutos desde la medianoche en Buenos Aires, para saber si ya pasó la tolerancia.
function nowMinutesAR() {
  const [h, m] = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .format(new Date()).split(":").map(Number);
  return h * 60 + m;
}
const toMinutes = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
const plus15 = (hhmm: string) => { const t = toMinutes(hhmm) + 15; return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; };

export function PanelServicio({ restaurant, reservations: initial, demo }: Props) {
  const router = useRouter();
  const [list, setList] = useState(initial);
  const [code, setCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  useEffect(() => setList(initial), [initial]);

  // Durante el servicio entran reservas nuevas: refrescamos cada minuto.
  useEffect(() => {
    setNow(nowMinutesAR());
    const id = window.setInterval(() => { setNow(nowMinutesAR()); if (!demo) router.refresh(); }, 60_000);
    return () => clearInterval(id);
  }, [demo, router]);

  const update = (id: string, patch: Partial<PanelReservation>) => setList((l) => l.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  function arrive(raw: string) {
    setScanning(false);
    setNotice(null);
    const wanted = raw.toUpperCase().match(/UM-[A-Z0-9]{5}/)?.[0];
    if (!wanted) { setNotice({ kind: "bad", text: "Ese código no parece de Última Mesa. Tiene la forma UM-XXXXX." }); return; }
    const local = list.find((r) => r.code === wanted);

    if (demo) {
      if (!local) return setNotice({ kind: "bad", text: "Código desconocido para este restaurante." });
      if (local.status !== "confirmed") return setNotice({ kind: "bad", text: `Esta reserva ya figura como "${STATUS[local.status].toLowerCase()}".` });
      const fee = local.party * restaurant.feeCents;
      update(local.id, { status: "arrived", feeCents: fee });
      setCode("");
      setNotice({ kind: "ok", text: `Llegó ${local.guestName}, ${plural(local.party, "persona", "personas")}. Comisión ${usd(fee)} (modo de ejemplo, no se guarda).` });
      return;
    }

    startTransition(async () => {
      const r = await registerArrival(wanted);
      if (!r.ok) { setNotice({ kind: "bad", text: r.error }); return; }
      update(r.id, { status: "arrived", feeCents: r.feeCents });
      setCode("");
      const who = local ? `${local.guestName}, ${plural(local.party, "persona", "personas")}` : r.code;
      setNotice({ kind: "ok", text: `Llegó ${who}. Comisión ${usd(r.feeCents ?? 0)}.` });
      router.refresh();
    });
  }

  function noShow(r: PanelReservation) {
    setNotice(null);
    if (demo) {
      update(r.id, { status: "no_show" });
      setNotice({ kind: "ok", text: `${r.guestName} quedó como "no vino". No se cobra comisión (modo de ejemplo).` });
      return;
    }
    startTransition(async () => {
      const res = await markNoShow(r.id);
      if (!res.ok) { setNotice({ kind: "bad", text: res.error }); return; }
      update(r.id, { status: "no_show" });
      setNotice({ kind: "ok", text: `${r.guestName} quedó como "no vino". No se cobra comisión.` });
      router.refresh();
    });
  }

  const waiting = list.filter((r) => r.status === "confirmed");
  const arrived = list.filter((r) => r.status === "arrived");
  const diners = arrived.reduce((n, r) => n + r.party, 0);
  const fees = arrived.reduce((n, r) => n + (r.feeCents ?? 0), 0);
  const times = [...new Set(list.map((r) => r.startsAt))];

  return (
    <>
      <div className="p-stats">
        <div><b className="display">{waiting.length}</b><span>Reservas por llegar</span></div>
        <div><b className="display">{diners}</b><span>Comensales que llegaron</span></div>
        <div><b className="display">{usd(fees)}</b><span>Comisión de hoy</span></div>
      </div>

      <div className="sv-check">
        <button className="book" onClick={() => setScanning(true)} disabled={pending}>Escanear QR</button>
        <form className="sv-code" onSubmit={(e) => { e.preventDefault(); arrive(code); }}>
          <label className="sr-only" htmlFor="code">Código de la reserva</label>
          <input id="code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="UM-XXXXX"
            autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={20} />
          <button className="outline" disabled={pending || !code.trim()}>{pending ? "Registrando…" : "Registrar llegada"}</button>
        </form>
      </div>

      {notice && (
        <p className={`msg ${notice.kind}`} role="status">
          {notice.text} <button className="link-btn" onClick={() => setNotice(null)} aria-label="Cerrar aviso">✕</button>
        </p>
      )}

      <h2 className="display p-h2">Reservas de hoy</h2>
      {list.length === 0 && <p>Todavía no hay reservas para hoy. Cuando alguien reserve una de tus cartas, aparece acá.</p>}
      {times.map((t) => (
        <section key={t} className="sv-slot">
          <h3 className="display">{t}</h3>
          <ul className="sv-list">
            {list.filter((r) => r.startsAt === t).map((r) => (
              <li key={r.id} className={`sv-r is-${r.status}`}>
                <div className="sv-who">
                  <b>{r.guestName}</b>
                  <span>{plural(r.party, "persona", "personas")} · <code>{r.code}</code></span>
                  {r.note && <span className="sv-note">{r.note}</span>}
                </div>
                {r.status === "confirmed" ? (
                  <div className="sv-act">
                    <button className="sv-yes" disabled={pending} onClick={() => arrive(r.code)}>Llegó</button>
                    {now != null && now >= toMinutes(r.startsAt) + 15
                      ? <NoShowButton onConfirm={() => noShow(r)} disabled={pending} />
                      : <span className="sv-wait">“No vino” desde las {plus15(r.startsAt)}</span>}
                  </div>
                ) : (
                  <span className={`sv-st is-${r.status}`}>
                    {STATUS[r.status]}{r.status === "arrived" && r.feeCents != null ? ` · ${usd(r.feeCents)}` : ""}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className="sv-foot">
        Pagás {usd(restaurant.feeCents)} por comensal solo cuando registrás la llegada. Si alguien no viene, no se cobra.
      </p>

      {scanning && <QRScanner onCode={arrive} onClose={() => setScanning(false)} />}
    </>
  );
}

function NoShowButton({ onConfirm, disabled }: { onConfirm: () => void; disabled: boolean }) {
  const [sure, setSure] = useState(false);
  return (
    <button className={`outline ${sure ? "danger" : ""}`} disabled={disabled}
      onClick={() => (sure ? onConfirm() : setSure(true))} onBlur={() => setSure(false)}>
      {sure ? "¿Seguro?" : "No vino"}
    </button>
  );
}
