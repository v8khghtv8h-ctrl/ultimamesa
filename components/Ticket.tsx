"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { ReservationView } from "@/lib/reservations";

const STATUS: Record<ReservationView["status"], { text: string; cls: string }> = {
  confirmed: { text: "Confirmada · mostrá este código al llegar", cls: "ok" },
  arrived: { text: "Asistencia registrada · ¡gracias por venir!", cls: "done" },
  no_show: { text: "El restaurante marcó que no llegaste", cls: "off" },
  cancelled: { text: "Cancelada · la mesa volvió a estar disponible", cls: "off" },
};

export function QR({ value, size }: { value: string; size: number }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    QRCode.toDataURL(value, { width: size * 2, margin: 1, color: { dark: "#191512", light: "#ffffff" } }).then(setSrc).catch(() => setSrc(""));
  }, [value, size]);
  return src
    ? <img src={src} width={size} height={size} alt={`Código QR de la reserva ${value.replace("ULTIMAMESA:", "")}`} />
    : <span style={{ width: size, height: size, display: "grid", placeItems: "center", fontWeight: 800 }}>{value.replace("ULTIMAMESA:", "")}</span>;
}

export function Ticket({ r, onCancel, busy }: { r: ReservationView; onCancel?: () => void; busy?: boolean }) {
  const [sure, setSure] = useState(false);
  const active = r.status === "confirmed";
  return (
    <article className="tk" style={{ ["--cbg" as string]: r.cardBg, ["--cfg" as string]: r.cardFg }}>
      <div className="tk-top"><b className="display">{r.restaurantName}</b><span className="display">{r.startsAt}</span></div>
      <div className="tk-body">
        <ul>
          <li><span>Personas</span> {r.party}</li>
          <li><span>A nombre de</span> {r.guestName}</li>
          <li><span>Beneficio</span> {r.benefit} · {r.appliesTo}</li>
          {r.neighborhood && <li><span>Barrio</span> {r.neighborhood}</li>}
          <li className="tk-code">{r.code}</li>
        </ul>
        <div style={{ opacity: active ? 1 : 0.25 }}><QR value={`ULTIMAMESA:${r.code}`} size={96} /></div>
      </div>
      <p className={`tk-status ${STATUS[r.status].cls}`}>{STATUS[r.status].text}</p>
      {active && onCancel && (
        <div className="tk-act">
          <button className={`outline ${sure ? "danger" : ""}`} disabled={busy} onBlur={() => setSure(false)}
            onClick={() => (sure ? onCancel() : setSure(true))}>
            {sure ? "¿Seguro? Tocá de nuevo para cancelar" : "Cancelar reserva"}
          </button>
        </div>
      )}
    </article>
  );
}
