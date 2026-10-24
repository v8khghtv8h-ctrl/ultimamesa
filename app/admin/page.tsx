import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminAccess, getSettlement, monthLabel, parseMonth, recentMonths, usd } from "@/lib/month";

export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ mes?: string | string[] }> }) {
  const month = parseMonth((await searchParams).mes);
  const access = await getAdminAccess();
  if (access === "login") redirect(`/login?next=/admin`);
  if (access === "denied") {
    return (
      <main className="page">
        <Link href="/" className="logo display" style={{ textDecoration: "none" }}>última<br />mesa.</Link>
        <h1 className="display">Liquidación</h1>
        <p>Esta página es solo para el equipo de Última Mesa.</p>
      </main>
    );
  }

  const rows = await getSettlement(month);
  const total = rows.reduce(
    (t, r) => ({ reservations: t.reservations + r.reservations, arrived: t.arrived + r.arrived, diners: t.diners + r.diners, feeCents: t.feeCents + r.feeCents }),
    { reservations: 0, arrived: 0, diners: 0, feeCents: 0 },
  );

  return (
    <main className="page panel-page">
      <div className="p-top">
        <Link href="/" className="logo display" style={{ textDecoration: "none" }}>última<br />mesa.</Link>
        <span className="p-tag">Equipo</span>
      </div>
      <h1 className="display">Liquidación de {monthLabel(month)}</h1>
      <p style={{ margin: 0 }}>Comisión por comensal que llegó, por restaurante. Las reservas cuentan por fecha de servicio.</p>
      {access === "demo" && <p className="banner" style={{ margin: "12px 0 0" }}>Modo de ejemplo: restaurantes y números inventados.</p>}

      <nav className="quick mo-months" aria-label="Elegir mes">
        {recentMonths(6).map((m) => (
          <Link key={m} href={`/admin?mes=${m}`} scroll={false} className="chip" aria-current={m === month ? "page" : undefined}>{monthLabel(m)}</Link>
        ))}
      </nav>

      <div className="p-stats">
        <div><b className="display">{usd(total.feeCents)}</b><span>Total a cobrar</span></div>
        <div><b className="display">{total.diners}</b><span>Comensales que llegaron</span></div>
        <div><b className="display">{rows.length}</b><span>Restaurantes con reservas</span></div>
      </div>

      <div className="mo-head">
        <h2 className="display p-h2">Por restaurante</h2>
        {rows.length > 0 && <a className="outline" href={`/admin/liquidacion?mes=${month}`} download>Descargar CSV</a>}
      </div>

      {rows.length === 0 ? <p>No hubo reservas en {monthLabel(month)}.</p> : (
        <div className="mo-table-wrap">
          <table className="mo-table">
            <thead>
              <tr><th scope="col">Restaurante</th><th scope="col">Reservas</th><th scope="col">Llegaron</th><th scope="col">No vinieron</th><th scope="col">Comensales</th><th scope="col">A cobrar</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.restaurantId}>
                  <th scope="row">{r.name}<small>{r.neighborhood} · {usd(r.feePerDinerCents)} por comensal</small></th>
                  <td>{r.reservations}</td><td>{r.arrived}</td><td>{r.noShows}</td><td>{r.diners}</td><td><b>{usd(r.feeCents)}</b></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><th scope="row">Total</th><td>{total.reservations}</td><td>{total.arrived}</td><td>{rows.reduce((n, r) => n + r.noShows, 0)}</td><td>{total.diners}</td><td>{usd(total.feeCents)}</td></tr>
            </tfoot>
          </table>
        </div>
      )}
    </main>
  );
}
