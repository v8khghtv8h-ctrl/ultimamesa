import Link from "next/link";
import { Deck } from "@/components/Deck";
import { TabBar } from "@/components/TabBar";
import { getTonightOffers } from "@/lib/offers";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [{ offers, demo }, supabase] = await Promise.all([getTonightOffers(), getServerSupabase()]);
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  const weekday = new Intl.DateTimeFormat("es-AR", { weekday: "long", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
  const today = weekday.charAt(0).toUpperCase() + weekday.slice(1);

  return (
    <main className="app">
      <header className="app-h">
        <div className="h-row">
          <Link href="/" className="logo display">última<br />mesa.</Link>
          <div className="ctx">
            <span style={{ color: "var(--ink)", fontWeight: 700 }}>{today} · esta noche</span>
            <span>{offers.length} {offers.length === 1 ? "mesa" : "mesas"} libres</span>
            {supabase && (user ? <Link href="/cuenta">Mi cuenta</Link> : <Link href="/login">Ingresar</Link>)}
          </div>
        </div>
      </header>
      {demo && <p className="banner">Datos de ejemplo: todavía no hay una base de datos conectada.</p>}
      <Deck offers={offers} demo={demo} loggedIn={Boolean(user)} />
      <TabBar current="/" />
    </main>
  );
}
