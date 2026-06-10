import { dentalCityAdapter } from "./dentalcity"
import { dcDentalAdapter } from "./dcdental"
import { genericAdapter } from "./generic"
import { pearsonAdapter } from "./pearson"
import { shopifyAdapter } from "./shopify"
import type {
  ProductPageCandidate,
  SupplierProductAdapter,
} from "../types"

const adapters: SupplierProductAdapter[] = [
  dcDentalAdapter,
  dentalCityAdapter,
  pearsonAdapter,
  shopifyAdapter,
  genericAdapter,
]

export function adapterForCandidate(candidate: ProductPageCandidate) {
  return adapters.find((adapter) => adapter.matches(candidate)) ?? genericAdapter
}
