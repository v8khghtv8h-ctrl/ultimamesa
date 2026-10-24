import { NextResponse, type NextRequest } from "next/server";
import { csvResponse } from "@/lib/csv";
import { csvFilename, getMonthRows, parseMonth, reservationsCSV } from "@/lib/month";
import { getMyRestaurant } from "@/lib/panel";

// CSV con las reservas del mes del restaurante de la persona que ingresó.
export async function GET(request: NextRequest) {
  const me = await getMyRestaurant();
  if (me.kind === "login" || me.kind === "none") return new NextResponse("Ingresá con una cuenta de restaurante.", { status: 401 });
  const month = parseMonth(request.nextUrl.searchParams.get("mes") ?? undefined);
  const rows = await getMonthRows(me.restaurant.id, month);
  return csvResponse(reservationsCSV(rows), csvFilename(me.restaurant.name, month));
}
