const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

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
