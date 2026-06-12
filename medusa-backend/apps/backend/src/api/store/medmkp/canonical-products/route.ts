import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MEDMKP_MODULE } from "../../../../modules/medmkp"
import type MedMKPModuleService from "../../../../modules/medmkp/service"

function latestSnapshotsByProduct(snapshots: Awaited<ReturnType<MedMKPModuleService["listSupplierPriceSnapshots"]>>) {
  return snapshots.reduce((acc, snapshot) => {
    const existing = acc.get(snapshot.supplier_product_id)

    if (
      !existing ||
      new Date(snapshot.captured_at).getTime() >
        new Date(existing.captured_at).getTime()
    ) {
      acc.set(snapshot.supplier_product_id, snapshot)
    }

    return acc
  }, new Map<string, (typeof snapshots)[number]>())
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const medmkp = req.scope.resolve<MedMKPModuleService>(MEDMKP_MODULE)
  const url = new URL(req.url, "http://localhost")
  const q = url.searchParams.get("q")?.trim()
  const limitParam = Number(url.searchParams.get("limit"))
  const limit =
    Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(limitParam, 50)
      : 10

  const canonicalProducts = await medmkp.listCanonicalProducts(
    q ? { q } : {},
    { take: limit }
  )

  if (!canonicalProducts.length) {
    res.json({ count: 0, canonical_products: [] })
    return
  }

  const matches = await medmkp.listCanonicalProductMatches({
    canonical_product_id: canonicalProducts.map((product) => product.id),
  })
  const supplierProductIds = [
    ...new Set(matches.map((match) => match.supplier_product_id)),
  ]

  const [supplierProducts, priceSnapshots, suppliers] = supplierProductIds.length
    ? await Promise.all([
        medmkp.listSupplierProducts({ id: supplierProductIds }),
        medmkp.listSupplierPriceSnapshots({
          supplier_product_id: supplierProductIds,
        }),
        medmkp.listSuppliers(),
      ])
    : [[], [], []]
  const latestPrices = latestSnapshotsByProduct(priceSnapshots)

  res.json({
    count: canonicalProducts.length,
    canonical_products: canonicalProducts.map((product) => {
      const offers = matches
        .filter(
          (match) =>
            match.canonical_product_id === product.id &&
            match.match_status !== "unmatched"
        )
        .map((match) => {
          const supplierProduct = supplierProducts.find(
            (candidate) => candidate.id === match.supplier_product_id
          )
          const latestPrice = latestPrices.get(match.supplier_product_id)

          if (!supplierProduct || !latestPrice) {
            return null
          }

          const supplier = suppliers.find(
            (candidate) => candidate.id === supplierProduct.supplier_id
          )

          return {
            supplier_product_id: supplierProduct.id,
            supplier_id: supplierProduct.supplier_id,
            supplier_name: supplier?.name ?? "Unknown supplier",
            sku: supplierProduct.sku,
            name: supplierProduct.name,
            price_cents: latestPrice.price_cents,
            availability: latestPrice.availability,
            match_status: match.match_status,
          }
        })
        .filter((offer): offer is NonNullable<typeof offer> => Boolean(offer))
        .sort((a, b) => a.price_cents - b.price_cents)

      return {
        ...product,
        offer_count: offers.length,
        best_offer: offers[0] ?? null,
      }
    }),
  })
}
