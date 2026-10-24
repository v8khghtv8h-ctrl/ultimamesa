import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const supabase = await getServerSupabase();
  if (!supabase) redirect("/");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/cuenta");

  const { data: staff } = await supabase
    .from("restaurant_staff")
    .select("role, restaurants (name)")
    .eq("user_id", user.id)
    .returns<{ role: string; restaurants: { name: string } }[]>();

  return (
    <main className="page">
      <Link href="/" className="logo display" style={{ textDecoration: "none" }}>última<br />mesa.</Link>
      <h1 className="display">Mi cuenta</h1>
      <p>{user.email}</p>
      <div className="box">
        <h2 className="display">Reservar es gratis</h2>
        <p style={{ margin: 0 }}>El restaurante paga una comisión solo cuando llegás, por eso te pedimos cancelar si no vas a ir.</p>
      </div>
      {staff && staff.length > 0 && (
        <div className="box">
          <h2 className="display">Tus restaurantes</h2>
          <ul className="list">{staff.map((s) => <li key={s.restaurants.name}><span>{s.restaurants.name}</span><Link href="/panel">Abrir panel</Link></li>)}</ul>
        </div>
      )}
      <form action="/auth/salir" method="post" style={{ marginTop: 20 }}>
        <button className="outline">Salir</button>
      </form>
    </main>
  );
}
