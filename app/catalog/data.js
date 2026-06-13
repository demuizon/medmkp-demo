import { headers } from "next/headers"

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

async function requestOrigin() {
  const headerList = await headers()
  const protocol =
    headerList.get("x-forwarded-proto") ||
    (headerList.get("host")?.includes("localhost") ? "http" : "https")
  const host = headerList.get("x-forwarded-host") || headerList.get("host") || "127.0.0.1:3000"

  return `${protocol}://${host}`
}

async function fetchJson(pathname, searchParams) {
  const url = new URL(pathname, await requestOrigin())

  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value == null || value === "") {
        return
      }

      url.searchParams.set(key, String(value))
    })
  }

  const response = await fetch(url, { cache: "no-store" })

  if (!response.ok) {
    throw new Error(`Failed to fetch ${pathname}: ${response.status}`)
  }

  return response.json()
}

export function formatMoney(cents) {
  if (typeof cents !== "number" || Number.isNaN(cents)) {
    return "Price pending"
  }

  return money.format(cents / 100)
}

export function formatPriceRange(range, offerCount) {
  if (!range) {
    return "Price pending"
  }

  if (range.lowest === range.highest) {
    return formatMoney(range.lowest)
  }

  return `${formatMoney(range.lowest)} to ${formatMoney(range.highest)} across ${offerCount} vendor${offerCount === 1 ? "" : "s"}`
}

export function availabilityLabel(value) {
  if (value === "in_stock") return "In stock"
  if (value === "backordered") return "Backordered"
  if (value === "limited") return "Limited"
  return "Availability pending"
}

export function normalizeParam(value) {
  return typeof value === "string" ? value.trim() : ""
}

export function productBreadcrumb(product) {
  const parts = [product.category, product.handle?.replace(/-/g, " "), product.name]
    .filter(Boolean)
    .map((part) => String(part))

  return parts
}

export async function getCatalogCategories() {
  const payload = await fetchJson("/api/catalog")
  return {
    categories: payload.categories || [],
    source: payload.source || "unknown",
    warning: payload.warning || "",
  }
}

export async function getCatalogProducts(filters = {}) {
  const payload = await fetchJson("/api/canonical-products", filters)
  return {
    products: payload.canonical_products || [],
    count: payload.count || 0,
    source: payload.source || "unknown",
    warning: payload.warning || "",
  }
}
