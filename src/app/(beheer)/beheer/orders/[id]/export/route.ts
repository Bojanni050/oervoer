import { getOrder, getPicklist } from "@/lib/db";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const order = getOrder(Number(id));
  const picklist = order ? getPicklist(order.id) : null;
  if (!order || !picklist) {
    return new Response("Geen picklijst gevonden.", { status: 404 });
  }

  const rows: (string | number)[][] = [
    ["vleestype", "sku", "naam", "vak", "aantal", "gram_per_stuk"],
  ];
  for (const item of picklist.items) {
    rows.push([
      item.typeVlees,
      item.sku,
      item.name,
      item.shelf,
      item.count,
      Math.round(item.weight * 1000),
    ]);
  }
  rows.push([]);
  rows.push(["totaal_kg", picklist.totalKg.toFixed(2)]);
  rows.push(["maaltijd_gram", Math.round(picklist.mealSize * 1000)]);
  rows.push(["dagen", picklist.days]);

  const filename = `picklijst-${order.animal}-${order.owner}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return new Response(`\uFEFF${toCsv(rows)}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename || "picklijst"}.csv"`,
    },
  });
}
