import { TabBar } from "@/components/TabBar";
import { SavedList } from "@/components/reservas/SavedList";
import { getTonightOffers } from "@/lib/offers";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const [{ offers, demo }, supabase] = await Promise.all([getTonightOffers(), getServerSupabase()]);
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  return (
    <main className="app">
      <section className="view">
        <h1 className="v-title display">Guardadas</h1>
        <p className="v-sub">Mesas que te gustaron esta noche. Pueden agotarse en cualquier momento.</p>
        <SavedList offers={offers} demo={demo} loggedIn={Boolean(user)} />
      </section>
      <TabBar current="/guardadas" />
    </main>
  );
}
