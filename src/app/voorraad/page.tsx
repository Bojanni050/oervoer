import { AlertTriangle, Check, Minus, Plus, Search } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shell";
import { Stat } from "@/components/ui";
import { adjustQtyAction, setQtyAction } from "@/app/actions";
import { listProducts } from "@/lib/db";
import { isMenuProduct } from "@/lib/picklist";
import { formatGram } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function VoorraadPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; filter?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const type = params.type ?? "alle";
  const filter = params.filter ?? "alles";

  const all = listProducts();
  const menuProducts = all.filter((product) => isMenuProduct(product));
  const types = [...new Set(all.map((product) => product.typeVlees).filter(Boolean))].sort();

  const filtered = all.filter((product) => {
    if (type !== "alle" && product.typeVlees !== type) return false;
    if (filter === "laag" && !(isMenuProduct(product) && product.qty < 5)) return false;
    if (filter === "leeg" && product.qty > 0) return false;
    if (!query) return true;
    const haystack = `${product.name} ${product.sku} ${product.smaak} ${product.typeVlees}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  const totalQty = all.reduce((sum, product) => sum + product.qty, 0);
  const low = menuProducts.filter((product) => product.qty < 5).length;

  const buildHref = (next: { filter?: string; type?: string }) => {
    const search = new URLSearchParams();
    const nextFilter = next.filter ?? filter;
    const nextType = next.type ?? type;
    if (query) search.set("q", query);
    if (nextFilter !== "alles") search.set("filter", nextFilter);
    if (nextType !== "alle") search.set("type", nextType);
    const value = search.toString();
    return value ? `/voorraad?${value}` : "/voorraad";
  };

  return (
    <div>
      <PageHeader
        eyebrow="Magazijn"
        title="Voorraad"
        description="De wizard pakt alleen producten die in het menu zitten en op voorraad zijn. Pas aantallen aan na het pakken."
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Producten" value={all.length} hint="Alle SKU's" accent="ink" />
        <Stat label="Totaal stuks" value={totalQty.toLocaleString("nl-NL")} accent="moss" />
        <Stat label="In het menu" value={menuProducts.length} hint="Geschikt voor picklijsten" />
        <Stat
          label="Lage voorraad"
          value={low}
          hint="Menuproducten onder 5 stuks"
          accent={low > 0 ? "rust" : "moss"}
        />
      </section>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-full border border-line bg-paper p-1">
          {[
            { key: "alles", label: "Alles" },
            { key: "laag", label: "Laag" },
            { key: "leeg", label: "Uitverkocht" },
          ].map((tab) => (
            <Link
              key={tab.key}
              href={buildHref({ filter: tab.key })}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                filter === tab.key ? "bg-moss text-white" : "text-muted hover:text-ink"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        <form action="/voorraad" method="get" className="flex flex-wrap items-center gap-2">
          {filter !== "alles" ? <input type="hidden" name="filter" value={filter} /> : null}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Zoek product of SKU…"
              className="input w-full pl-9 sm:w-56"
            />
          </div>
          <select name="type" defaultValue={type} className="input w-full sm:w-44">
            <option value="alle">Alle vleessoorten</option>
            {types.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn-secondary">
            Filter
          </button>
        </form>
      </div>

      <p className="mt-3 text-xs text-muted">
        {filtered.length} product{filtered.length === 1 ? "" : "en"} getoond
        {type !== "alle" ? ` · ${type}` : ""}
        {query ? ` · “${query}”` : ""}
      </p>

      <div className="surface mt-3 overflow-x-auto">
        <table className="table min-w-[780px]">
          <thead>
            <tr>
              <th>Product</th>
              <th>Type</th>
              <th className="text-right">Per stuk</th>
              <th className="text-right">Voorraad</th>
              <th className="w-40 text-right">Bijwerken</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((product) => (
              <tr
                key={product.sku}
                className={
                  product.qty === 0
                    ? "bg-rust-soft/25"
                    : product.geschiktMenu && product.qty < 5
                      ? "bg-ochre-soft/30"
                      : undefined
                }
              >
                <td>
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{product.name}</span>
                    {!isMenuProduct(product) ? (
                      <span className="pill border-line bg-bone text-[0.62rem] text-muted">
                        geen menu
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block font-mono text-[0.62rem] uppercase tracking-wide text-muted">
                    {product.sku}
                    {product.smaak ? ` · ${product.smaak}` : ""}
                    {product.verpaktPer > 1 ? ` · ${product.verpaktPer}-pack` : ""}
                  </span>
                </td>
                <td>
                  <span className="pill border-line bg-white text-[0.68rem]">
                    {product.typeVlees || "—"}
                  </span>
                </td>
                <td className="num whitespace-nowrap text-right text-xs text-muted">
                  {formatGram(product.normWeight)}
                </td>
                <td className="text-right">
                  <span
                    className={`num inline-flex min-w-10 justify-center rounded-full px-2.5 py-1 text-sm font-semibold ${
                      product.qty === 0
                        ? "bg-rust text-white"
                        : product.qty < 5
                          ? "bg-ochre text-white"
                          : "bg-moss-soft text-moss"
                    }`}
                  >
                    {product.qty}
                  </span>
                  {product.qty === 0 ? (
                    <span className="mt-1 flex items-center justify-end gap-1 text-[0.62rem] text-rust">
                      <AlertTriangle className="size-3" /> uitverkocht
                    </span>
                  ) : null}
                </td>
                <td>
                  <div className="flex items-center justify-end gap-1">
                    <form action={adjustQtyAction}>
                      <input type="hidden" name="sku" value={product.sku} />
                      <input type="hidden" name="current" value={product.qty} />
                      <input type="hidden" name="delta" value="-1" />
                      <button
                        type="submit"
                        className="grid size-7 place-items-center rounded-full border border-line bg-white text-muted hover:border-rust hover:text-rust"
                        aria-label={`${product.name} één aftrekken`}
                      >
                        <Minus className="size-3.5" />
                      </button>
                    </form>
                    <form action={setQtyAction} className="flex items-center gap-1">
                      <input type="hidden" name="sku" value={product.sku} />
                      <input
                        key={product.qty}
                        name="qty"
                        type="number"
                        min="0"
                        defaultValue={product.qty}
                        className="input w-16 px-2 py-1 text-center text-sm"
                        aria-label={`Voorraad van ${product.name}`}
                      />
                      <button
                        type="submit"
                        className="grid size-7 place-items-center rounded-full border border-line bg-white text-muted hover:border-moss hover:text-moss"
                        aria-label={`Voorraad van ${product.name} opslaan`}
                      >
                        <Check className="size-3.5" />
                      </button>
                    </form>
                    <form action={adjustQtyAction}>
                      <input type="hidden" name="sku" value={product.sku} />
                      <input type="hidden" name="current" value={product.qty} />
                      <input type="hidden" name="delta" value="1" />
                      <button
                        type="submit"
                        className="grid size-7 place-items-center rounded-full border border-line bg-white text-muted hover:border-moss hover:text-moss"
                        aria-label={`${product.name} één toevoegen`}
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted">
            Geen producten die aan deze filters voldoen.
          </p>
        ) : null}
      </div>
    </div>
  );
}
