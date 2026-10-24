"use client";
import { useState, type ReactNode } from "react";

// Dos vistas del panel: la noche de servicio (llegadas) y las cartas publicadas.
export function PanelTabs({ servicio, cartas, waiting }: { servicio: ReactNode; cartas: ReactNode; waiting: number }) {
  const [tab, setTab] = useState<"servicio" | "cartas">(waiting > 0 ? "servicio" : "cartas");
  return (
    <>
      <div className="p-tabs" role="tablist">
        <button role="tab" aria-selected={tab === "servicio"} onClick={() => setTab("servicio")}>
          Servicio de hoy{waiting > 0 && <span>{waiting}</span>}
        </button>
        <button role="tab" aria-selected={tab === "cartas"} onClick={() => setTab("cartas")}>Cartas</button>
      </div>
      {/* Las dos vistas quedan montadas para no perder lo que se hizo al cambiar de pestaña. */}
      <div role="tabpanel" hidden={tab !== "servicio"}>{servicio}</div>
      <div role="tabpanel" hidden={tab !== "cartas"}>{cartas}</div>
    </>
  );
}
