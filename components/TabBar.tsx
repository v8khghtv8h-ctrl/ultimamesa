import Link from "next/link";

const TABS = [
  { href: "/", label: "Mesas", glyph: "◆" },
  { href: "/guardadas", label: "Guardadas", glyph: "♥" },
  { href: "/reservas", label: "Reservas", glyph: "▣" },
];

export function TabBar({ current }: { current: string }) {
  return (
    <nav className="tabs" aria-label="Secciones">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} aria-current={current === t.href ? "page" : undefined}>
          <b className="display">{t.glyph}</b>{t.label}
        </Link>
      ))}
    </nav>
  );
}
