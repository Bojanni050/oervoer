import { database } from "@/lib/db";
import { searchCatalog } from "@/lib/catalog";

/** De catalogus verandert buiten de app om (scanner), dus nooit cachen. */
export const dynamic = "force-dynamic";

/**
 * Zoeken in de productcatalogus, voor het invullen van wat een baasje voert.
 * GET /api/catalog/search?q=kipnek&limit=10
 */
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").trim();
  const limit = Math.min(25, Math.max(1, Number.parseInt(params.get("limit") ?? "10", 10) || 10));

  if (query.length < 2) {
    return Response.json({ ok: true, query, hits: [] });
  }

  try {
    const hits = searchCatalog(database(), query, limit);
    return Response.json({ ok: true, query, hits });
  } catch (error) {
    console.error("catalogus zoeken mislukt:", error);
    return Response.json({ ok: false, error: "catalogus niet beschikbaar" }, { status: 500 });
  }
}
