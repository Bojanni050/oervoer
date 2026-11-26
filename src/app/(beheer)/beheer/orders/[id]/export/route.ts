import { getOrder, getPicklist } from "@/lib/db";
import { toCsv } from "@/lib/csv";
import { bandFor, mineralStatusLabel, productMinerals } from "@/lib/minerals";
import { picklistMineralReport } from "@/lib/picklist";

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

  const minerals = picklistMineralReport(picklist.items, bandFor(order.ras, order.pup));
  const rows: (string | number)[][] = [
    [
      "vleestype",
      "sku",
      "naam",
      "vak",
      "aantal",
      "gram_per_stuk",
      "calcium_pct",
      "fosfor_pct",
      "energie_kcal_per_100g",
    ],
  ];
  for (const item of picklist.items) {
    const values = productMinerals({
      typeVlees: item.typeVlees,
      calcium: item.calcium ?? null,
      fosfor: item.fosfor ?? null,
      energie: item.energie ?? null,
    });
    rows.push([
      item.typeVlees,
      item.sku,
      item.name,
      item.shelf,
      item.count,
      Math.round(item.weight * 1000),
      values.calcium ?? "",
      values.fosfor ?? "",
      values.energie ?? "",
    ]);
  }
  rows.push([]);
  rows.push(["totaal_kg", picklist.totalKg.toFixed(2)]);
  rows.push(["maaltijd_gram", Math.round(picklist.mealSize * 1000)]);
  rows.push(["dagen", picklist.days]);
  rows.push(["calcium_g_per_100g", minerals.calciumPer100g]);
  rows.push(["calcium_g_totaal", minerals.calciumG]);
  rows.push(["energie_kcal_per_100g", minerals.energiePer100g ?? "onbekend"]);
  rows.push(["energie_bron", minerals.energieBron ?? "onbekend"]);
  rows.push(["calcium_g_per_1000_kcal", minerals.calciumPer1000Kcal ?? "onbekend"]);
  rows.push(["calcium_fosfor_verhouding", minerals.caP ?? "onbekend"]);
  rows.push(["calcium_status", mineralStatusLabel(minerals.status)]);
  rows.push(["calcium_toelichting", minerals.message]);

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
