import { NextResponse, type NextRequest } from "next/server";
import { csvResponse } from "@/lib/csv";
import { getAdminAccess, getSettlement, parseMonth, settlementCSV } from "@/lib/month";

// CSV de la liquidación del mes: cuánto cobrarle a cada restaurante.
export async function GET(request: NextRequest) {
  const access = await getAdminAccess();
  if (access === "login" || access === "denied") return new NextResponse("Solo para el equipo de Última Mesa.", { status: 403 });
  const month = parseMonth(request.nextUrl.searchParams.get("mes") ?? undefined);
  return csvResponse(settlementCSV(await getSettlement(month)), `ultimamesa-liquidacion-${month}.csv`);
}
