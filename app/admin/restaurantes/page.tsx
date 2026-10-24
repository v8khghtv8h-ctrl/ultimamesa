import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { RestaurantAdmin } from "@/components/admin/RestaurantAdmin";
import { getAdminRestaurants } from "@/lib/admin";
import { getAdminAccess } from "@/lib/month";

export const dynamic = "force-dynamic";

export default async function AdminRestaurantsPage() {
  const access = await getAdminAccess();
  if (access === "login") redirect("/login?next=/admin/restaurantes");
  if (access === "denied") {
    return (
      <main className="page">
        <Link href="/" className="logo display" style={{ textDecoration: "none" }}>última<br />mesa.</Link>
        <h1 className="display">Restaurantes</h1>
        <p>Esta página es solo para el equipo de Última Mesa.</p>
      </main>
    );
  }
  const restaurants = await getAdminRestaurants();
  return (
    <main className="page panel-page">
      <div className="p-top">
        <Link href="/" className="logo display" style={{ textDecoration: "none" }}>última<br />mesa.</Link>
        <span className="p-tag">Equipo</span>
      </div>
      <h1 className="display">Restaurantes</h1>
      <p style={{ margin: 0 }}>Dalos de alta e invitá a quien va a manejar el panel. Con su email entra a <b>/panel</b>, sin contraseña.</p>
      {access === "demo" && <p className="banner" style={{ margin: "12px 0 0" }}>Modo de ejemplo: podés probar todo, pero los cambios no se guardan.</p>}
      <AdminNav current="restaurantes" />
      <RestaurantAdmin restaurants={restaurants} demo={access === "demo"} />
    </main>
  );
}
