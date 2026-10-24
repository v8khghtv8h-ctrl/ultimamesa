export type Slot = {
  id: string;
  startsAt: string; // "21:30"
  tablesLeft: number;
};

// Una "carta": la oferta de un restaurante para hoy, tal como la ve el usuario.
export type Offer = {
  id: string;
  restaurant: {
    id: string;
    name: string;
    neighborhood: string;
    cuisine: string;
    priceLevel: number;
    rating: number | null;
    ratingCount: number;
    description: string | null;
    highlights: string[];
  };
  benefit: "discount" | "gift";
  discountPct: number | null;
  giftLabel: string | null;
  appliesTo: string;
  maxParty: number;
  cardBg: string;
  cardFg: string;
  slots: Slot[];
};

export function benefitLabel(o: Pick<Offer, "benefit" | "discountPct" | "giftLabel">) {
  return o.benefit === "discount" ? `-${o.discountPct}%` : o.giftLabel ?? "Regalo";
}

export function tablesLeft(o: Offer) {
  return o.slots.reduce((sum, s) => sum + s.tablesLeft, 0);
}
