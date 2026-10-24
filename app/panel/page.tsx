import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type StaffRow = { role: "owner" | "staff"; restaurants: { id: string; name: string; neighborhood: string; fee_cents: number } };

// Entrada al panel del restaurante. En esta etapa valida el acceso; publicar cartas llega en la etapa 2.
export default async function PanelPage() {
  const supabase = await getServerSupabase();
  if (!supabase) {
    return (
      <main className="page">
        <h1 className="display">Panel para restaurantes</h1>
        <p className="msg bad">El panel se activa cuando se conecta la base de datos (ver README).</p>
      </main>
    );
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/panel");

  const { data: staff } = await supabase
    .from("restaurant_staff")
    .select("role, restaurants (id, name, neighborhood, fee_cents)")
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

  const restaurant = staff[0].restaurants;
  const { count } = await supabase.from("offers").select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurant.id).eq("active", true);

  return (
    <main className="page">
      <Link href="/" className="logo display" style={{ textDecoration: "none" }}>última<br />mesa.</Link>
      <h1 className="display">{restaurant.name}</h1>
      <p>{restaurant.neighborhood} · {staff[0].role === "owner" ? "Dueño" : "Equipo"}</p>
      <div className="box">
        <ul className="list">
          <li><span>Cartas activas</span><b>{count ?? 0}</b></li>
          <li><span>Comisión por comensal que llega</span><b>USD {(restaurant.fee_cents / 100).toLocaleString("es-AR")}</b></li>
        </ul>
      </div>
    </main>
  );
}
