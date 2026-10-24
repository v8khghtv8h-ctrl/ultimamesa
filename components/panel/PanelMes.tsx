import Link from "next/link";
import { byDay, dayLabel, monthLabel, recentMonths, summarize, usd, type MonthRow } from "@/lib/month";
import type { PanelRestaurant } from "@/lib/panel";

type Props = { restaurant: PanelRestaurant; month: string; rows: MonthRow[]; demo: boolean };

export function PanelMes({ restaurant, month, rows, demo }: Props) {
  const s = summarize(rows);
  const days = byDay(rows);
  const closed = s.arrived + s.noShows;
  const attendance = closed ? Math.round((s.arrived / closed) * 100) : null;

  return (
    <>
      <nav className="quick mo-months" aria-label="Elegir mes">
        {recentMonths(6).map((m) => (
          <Link key={m} href={`/panel?mes=${m}`} scroll={false} className="chip" aria-current={m === month ? "page" : undefined}>
            {monthLabel(m)}
          </Link>
        ))}
      </nav>

      <div className="p-stats">
        <div><b className="display">{usd(s.feeCents)}</b><span>Comisión de {monthLabel(month).split(" ")[0]}</span></div>
        <div><b className="display">{s.diners}</b><span>Comensales que llegaron</span></div>
        <div><b className="display">{attendance == null ? "—" : `${attendance}%`}</b><span>Asistencia</span></div>
      </div>
      <p className="mo-line">
        {s.reservations} reservas · {s.arrived} llegaron · {s.noShows} no vinieron · {s.cancelled} cancelaron
        {s.pending > 0 && ` · ${s.pending} por llegar`}
      </p>

      <div className="mo-head">
        <h2 className="display p-h2">Día por día</h2>
        {rows.length > 0 && (
          <a className="outline" href={`/panel/mes?mes=${month}`} download>Descargar CSV</a>
        )}
      </div>

      {days.length === 0 ? (
        <p>No hubo reservas en {monthLabel(month)}.</p>
      ) : (
        <div className="mo-table-wrap">
          <table className="mo-table">
            <thead>
              <tr><th scope="col">Día</th><th scope="col">Reservas</th><th scope="col">Llegaron</th><th scope="col">Comensales</th><th scope="col">Comisión</th></tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.date}>
                  <th scope="row">{dayLabel(d.date)}</th>
                  <td>{d.reservations}</td>
                  <td>{d.arrived}</td>
                  <td>{d.diners}</td>
                  <td>{usd(d.feeCents)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><th scope="row">Total</th><td>{s.reservations}</td><td>{s.arrived}</td><td>{s.diners}</td><td>{usd(s.feeCents)}</td></tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="sv-foot">
        La comisión es de {usd(restaurant.feeCents)} por comensal que llega. El CSV trae cada reserva con su estado, para conciliar con tu caja.
        {demo && " En modo de ejemplo los números son inventados."}
      </p>
    </>
  );
}
