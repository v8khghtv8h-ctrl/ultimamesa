"use client";
import { useState, type ReactNode } from "react";

type Tab = "servicio" | "cartas" | "mes";

// Vistas del panel: la noche de servicio (llegadas), las cartas publicadas y el cierre del mes.
export function PanelTabs({ servicio, cartas, mes, waiting, initial }: {
  servicio: ReactNode; cartas: ReactNode; mes: ReactNode; waiting: number; initial: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initial);
  return (
    <>
      <div className="p-tabs" role="tablist">
        <button role="tab" aria-selected={tab === "servicio"} onClick={() => setTab("servicio")}>
          Servicio de hoy{waiting > 0 && <span>{waiting}</span>}
        </button>
        <button role="tab" aria-selected={tab === "cartas"} onClick={() => setTab("cartas")}>Cartas</button>
        <button role="tab" aria-selected={tab === "mes"} onClick={() => setTab("mes")}>Mes</button>
      </div>
      {/* Las vistas quedan montadas para no perder lo que se hizo al cambiar de pestaña. */}
      <div role="tabpanel" hidden={tab !== "servicio"}>{servicio}</div>
      <div role="tabpanel" hidden={tab !== "cartas"}>{cartas}</div>
      <div role="tabpanel" hidden={tab !== "mes"}>{mes}</div>
    </>
  );
}
