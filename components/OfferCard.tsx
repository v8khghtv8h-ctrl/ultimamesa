import { benefitLabel, tablesLeft, type Offer } from "@/lib/types";

export function OfferCard({ offer, style, className = "" }: { offer: Offer; style?: React.CSSProperties; className?: string }) {
  const open = offer.slots.filter((s) => s.tablesLeft > 0);
  const left = tablesLeft(offer);
  const label = benefitLabel(offer);
  return (
    <article
      className={`c ${className}`}
      style={{ ["--cbg" as string]: offer.cardBg, ["--cfg" as string]: offer.cardFg, ...style }}
      aria-label={`${offer.restaurant.name}, ${label}, ${offer.appliesTo}`}
    >
      <div className="ck">
        <span>Hoy · {open[0]?.startsAt ?? "--:--"}{open.length > 1 ? ` +${open.length - 1}` : ""}</span>
        <span>{left} {left === 1 ? "mesa" : "mesas"}</span>
      </div>
      <span className="stamp yes display">GUARDAR</span>
      <span className="stamp no display">PASO</span>
      <div className={`big display ${offer.benefit === "discount" ? "" : "word"}`}>{label}</div>
      <div className="what">{offer.appliesTo}</div>
      <div className="nm display">{offer.restaurant.name}</div>
      <div className="mt">
        <span>{offer.restaurant.cuisine} · {offer.restaurant.neighborhood}</span>
        {offer.restaurant.rating != null && <span>★ {offer.restaurant.rating.toLocaleString("es-AR")}</span>}
      </div>
    </article>
  );
}
