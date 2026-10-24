import Link from "next/link";
import { redirect } from "next/navigation";
import { PanelCartas } from "@/components/panel/PanelCartas";
import { PanelMes } from "@/components/panel/PanelMes";
import { PanelServicio } from "@/components/panel/PanelServicio";
import { PanelTabs } from "@/components/panel/PanelTabs";
import { getMonthRows, parseMonth, type MonthRow } from "@/lib/month";
import {
  demoPanelOffers, demoPanelReservations, getMyRestaurant, getRestaurantOffers, getTodayReservations,
  type PanelOffer, type PanelReservation, type PanelRestaurant,
} from "@/lib/panel";

export const dynamic = "force-dynamic";

export default async function PanelPage({ searchParams }: { searchParams: Promise<{ mes?: string | string[] }> }) {
  const params = await searchParams;
  const month = parseMonth(params.mes);
  const me = await getMyRestaurant();
  if (me.kind === "login") redirect("/login?next=/panel");

  if (me.kind === "none") {
    return (
      <main className="page">
        <Link href="/" className="logo display" style={{ textDecoration: "none" }}>última<br />mesa.</Link>
        <h1 className="display">Panel para restaurantes</h1>
        <p>Tu cuenta ({me.email}) todavía no está asociada a un restaurante. Pedile al equipo de Última Mesa que te dé acceso.</p>
      </main>
    );
  }

  const demo = me.kind === "demo";
  const [offers, reservations, monthRows] = await Promise.all([
    demo ? demoPanelOffers : getRestaurantOffers({ ...me.restaurant, priceLevel: me.priceLevel }),
    demo ? demoPanelReservations : getTodayReservations(me.restaurant.id),
    getMonthRows(me.restaurant.id, month),
  ]);
  return (
    <Panel restaurant={me.restaurant} offers={offers} reservations={reservations} month={month} monthRows={monthRows}
      openMonth={params.mes !== undefined} demo={demo} />
  );
}

type PanelProps = {
  restaurant: PanelRestaurant; offers: PanelOffer[]; reservations: PanelReservation[];
  month: string; monthRows: MonthRow[]; openMonth: boolean; demo: boolean;
};

function Panel({ restaurant, offers, reservations, month, monthRows, openMonth, demo }: PanelProps) {
  const waiting = reservations.filter((r) => r.status === "confirmed").length;
  return (
    <main className="page panel-page">
      <div className="p-top">
        <Link href="/" className="logo display" style={{ textDecoration: "none" }}>última<br />mesa.</Link>
        <span className="p-tag">Para restaurantes</span>
      </div>
      <h1 className="display">{restaurant.name}</h1>
      <p style={{ margin: 0 }}>{restaurant.cuisine} · {restaurant.neighborhood}</p>
      {demo && <p className="banner" style={{ margin: "12px 0 0" }}>Modo de ejemplo: podés probar todo, pero los cambios no se guardan.</p>}
      <PanelTabs
        waiting={waiting}
        initial={openMonth ? "mes" : waiting > 0 ? "servicio" : "cartas"}
        servicio={<PanelServicio restaurant={restaurant} reservations={reservations} demo={demo} />}
        cartas={<PanelCartas restaurant={restaurant} offers={offers} demo={demo} />}
        mes={<PanelMes restaurant={restaurant} month={month} rows={monthRows} demo={demo} />}
      />
    </main>
  );
}
