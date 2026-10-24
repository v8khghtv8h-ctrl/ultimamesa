"use client";
import { useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    setState("sending");
    const redirect = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
    if (error) { setError(error.message); setState("error"); } else setState("sent");
  }

  if (state === "sent") return <p className="msg ok">Listo. Revisá {email} y tocá el link para entrar.</p>;
  return (
    <form onSubmit={submit}>
      <label className="field">Email
        <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vos@ejemplo.com" />
      </label>
      <button className="book" style={{ width: "100%" }} disabled={state === "sending"}>
        {state === "sending" ? "Enviando…" : "Mandame el link"}
      </button>
      {state === "error" && <p className="msg bad">No pudimos mandar el link: {error}</p>}
    </form>
  );
}
