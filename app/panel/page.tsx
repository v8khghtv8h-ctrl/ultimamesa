import Link from "next/link";
import { redirect } from "next/navigation";
import { PanelCartas } from "@/components/panel/PanelCartas";
import { PanelServicio } from "@/components/panel/PanelServicio";
import { PanelTabs } from "@/components/panel/PanelTabs";
import {
  demoPanelOffers, demoPanelReservations, demoRestaurant, getRestaurantOffers, getTodayReservations,
  type PanelOffer, type PanelReservation, type PanelRestaurant,
} from "@/lib/panel";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type StaffRow = {
  role: "owner" | "staff";
  restaurants: { id: string; name: string; neighborhood: string; cuisine: string; price_level: number; fee_cents: number };
};

export default async function PanelPage() {
  const supabase = await getServerSupabase();
  if (!supabase) return <Panel restaurant={demoRestaurant} offers={demoPanelOffers} reservations={demoPanelReservations} demo />;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/panel");

  const { data: staff } = await supabase
    .from("restaurant_staff")
    .select("role, restaurants (id, name, neighborhood, cuisine, price_level, fee_cents)")
    .eq("user_id", user.id)
    .returns<StaffRow[]>();

  if (!staff?.length) {
    return (
      <main className="page">
        <Link href="/" className="logo display" style={{ textDecoration: "none" }}>última<br />mesa.</Link>
        <h1 className="display">Panel para restaurantes</h1>
        <p>Tu cuenta ({user.email}) todavía no está asociada a un restaurante. Pedile al equipo de Última Mesa que te dé acceso.</p>
      </main>
    );
  }

  const r = staff[0].restaurants;
  const restaurant: PanelRestaurant = { id: r.id, name: r.name, neighborhood: r.neighborhood, cuisine: r.cuisine, feeCents: r.fee_cents };
  const [offers, reservations] = await Promise.all([
    getRestaurantOffers({ ...restaurant, priceLevel: r.price_level }),
    getTodayReservations(restaurant.id),
  ]);
  return <Panel restaurant={restaurant} offers={offers} reservations={reservations} demo={false} />;
}

type PanelProps = { restaurant: PanelRestaurant; offers: PanelOffer[]; reservations: PanelReservation[]; demo: boolean };

function Panel({ restaurant, offers, reservations, demo }: PanelProps) {
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
        waiting={reservations.filter((r) => r.status === "confirmed").length}
        servicio={<PanelServicio restaurant={restaurant} reservations={reservations} demo={demo} />}
        cartas={<PanelCartas restaurant={restaurant} offers={offers} demo={demo} />}
      />
    </main>
  );
}
