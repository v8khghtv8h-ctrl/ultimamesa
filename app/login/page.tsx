import Link from "next/link";
import { LoginForm } from "./LoginForm";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <main className="page">
      <Link href="/" className="logo display" style={{ textDecoration: "none" }}>última<br />mesa.</Link>
      <h1 className="display">Ingresá</h1>
      <p>Te mandamos un link a tu email. Sin contraseñas.</p>
      {error && <p className="msg bad">El link venció o ya se usó. Pedí uno nuevo.</p>}
      {isSupabaseConfigured
        ? <LoginForm next={safeNext(next)} />
        : <p className="msg bad">El ingreso se activa cuando se conecta la base de datos (ver README).</p>}
    </main>
  );
}

// Solo rutas internas, para que nadie use el login para redirigir a otro sitio.
function safeNext(next?: string) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
