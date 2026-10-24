import type { Offer } from "./types";

// Mismos restaurantes ficticios que supabase/seed.sql. Se usan cuando Supabase no está configurado.
const r = (id: string, name: string, neighborhood: string, cuisine: string, priceLevel: number, rating: number, ratingCount: number, description: string, highlights: string[]) =>
  ({ id, name, neighborhood, cuisine, priceLevel, rating, ratingCount, description, highlights });

export const demoOffers: Offer[] = [
  { id: "demo-1", restaurant: r("r1", "Brasa del Bajo", "Palermo", "Parrilla", 3, 4.8, 1240, "Parrilla a leña con cortes madurados en casa.", ["Cortes madurados", "Vino por copa", "Patio"]),
    benefit: "discount", discountPct: 30, giftLabel: null, appliesTo: "Ojo de bife para dos", maxParty: 4, cardBg: "#ff6b35", cardFg: "#1f0d05",
    slots: [{ id: "s1", startsAt: "21:30", tablesLeft: 1 }, { id: "s2", startsAt: "22:00", tablesLeft: 2 }] },
  { id: "demo-2", restaurant: r("r2", "Casa Ombú", "Recoleta", "De autor", 3, 4.7, 890, "Cocina de estación con producto de pequeños productores.", ["Menú de estación", "Opción vegetariana"]),
    benefit: "discount", discountPct: 25, giftLabel: null, appliesTo: "Menú de 3 pasos", maxParty: 4, cardBg: "#7a1f2b", cardFg: "#ffe9e0",
    slots: [{ id: "s3", startsAt: "21:30", tablesLeft: 2 }, { id: "s4", startsAt: "22:15", tablesLeft: 1 }] },
  { id: "demo-3", restaurant: r("r3", "Lupe", "Chacarita", "Mexicana", 2, 4.6, 530, "Tacos de maíz nixtamalizado en casa y barra de mezcales.", ["Tacos al pastor", "Barra de mezcal"]),
    benefit: "gift", discountPct: null, giftLabel: "Mezcal", appliesTo: "Copa de mezcal de bienvenida", maxParty: 4, cardBg: "#0f7b6c", cardFg: "#e6fff8",
    slots: [{ id: "s5", startsAt: "21:45", tablesLeft: 3 }, { id: "s6", startsAt: "22:30", tablesLeft: 2 }] },
  { id: "demo-4", restaurant: r("r4", "Almacén Arévalo", "Palermo", "Bodegón", 2, 4.5, 620, "Bodegón de barrio con vermú de la casa y picadas generosas.", ["Mesas largas", "Para grupos"]),
    benefit: "discount", discountPct: 15, giftLabel: null, appliesTo: "Vermú y picada", maxParty: 8, cardBg: "#ffd23f", cardFg: "#2a1d00",
    slots: [{ id: "s7", startsAt: "21:30", tablesLeft: 2 }, { id: "s8", startsAt: "23:00", tablesLeft: 4 }] },
  { id: "demo-5", restaurant: r("r5", "Nami Omakase", "Belgrano", "Sushi", 4, 4.9, 1100, "Ocho lugares en barra frente al itamae.", ["Solo barra", "Pescado del día"]),
    benefit: "gift", discountPct: null, giftLabel: "Barra", appliesTo: "Dos piezas extra del chef", maxParty: 2, cardBg: "#1d2b44", cardFg: "#d9f0ff",
    slots: [{ id: "s9", startsAt: "22:00", tablesLeft: 1 }] },
  { id: "demo-6", restaurant: r("r6", "Trattoria Lucca", "Villa Crespo", "Italiana", 2, 4.6, 640, "Pastas amasadas cada mañana y tiramisú de la nonna.", ["Pasta fresca", "Para grupos"]),
    benefit: "discount", discountPct: 20, giftLabel: null, appliesTo: "Pastas frescas y postre", maxParty: 6, cardBg: "#3f5b2a", cardFg: "#f2f7d8",
    slots: [{ id: "s10", startsAt: "21:30", tablesLeft: 3 }, { id: "s11", startsAt: "22:30", tablesLeft: 2 }] },
];
