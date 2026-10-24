import Link from "next/link";

export function AdminNav({ current }: { current: "liquidacion" | "restaurantes" }) {
  return (
    <div className="p-tabs" role="navigation" aria-label="Secciones del equipo">
      <Link href="/admin" aria-current={current === "liquidacion" ? "page" : undefined}>Liquidación</Link>
      <Link href="/admin/restaurantes" aria-current={current === "restaurantes" ? "page" : undefined}>Restaurantes</Link>
    </div>
  );
}
