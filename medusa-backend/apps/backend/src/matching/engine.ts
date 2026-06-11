import { scorePair, jaccard, compareNumericAttrs } from "./score"
import { brandsAgree } from "./normalize"
import type {
  Cluster,
  MatchRunResult,
  NormalizedProduct,
  ScoredPair,
  SubstituteCandidate,
} from "./types"

const MAX_POSTING_LIST = 100
const SUBSTITUTE_TOKEN_MAX_DF = 600
const SUBSTITUTE_MIN_TYPE_SIM = 0.5
const MAX_SUBSTITUTES_PER_CLUSTER = 5

class UnionFind {
  private parent: number[]

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i)
  }

  find(x: number): number {
    let root = x
    while (this.parent[root] !== root) {
      root = this.parent[root]
    }
    while (this.parent[x] !== root) {
      const next = this.parent[x]
      this.parent[x] = root
      x = next
    }
    return root
  }

  union(a: number, b: number) {
    const rootA = this.find(a)
    const rootB = this.find(b)
    if (rootA !== rootB) {
      this.parent[rootB] = rootA
    }
  }
}

/**
 * Candidate generation. Two products become a candidate pair when they share
 * a normalized catalog code: either manufacturer_sku, or a catalog-number
 * token embedded in the product name. Scoring decides from there.
 */
function generateCandidatePairs(products: NormalizedProduct[]): Array<[number, number]> {
  const postings = new Map<string, number[]>()
  const add = (key: string, idx: number) => {
    let list = postings.get(key)
    if (!list) {
      list = []
      postings.set(key, list)
    }
    list.push(idx)
  }

  products.forEach((product, idx) => {
    if (product.mfrSku.length >= 4 && product.skuStrength > 0.1) {
      add(product.mfrSku, idx)
    }
    for (const token of product.skuLikeTokens) {
      if (token !== product.mfrSku) {
        add(token, idx)
      }
    }
  })

  const seen = new Set<string>()
  const pairs: Array<[number, number]> = []
  for (const list of postings.values()) {
    if (list.length < 2 || list.length > MAX_POSTING_LIST) {
      continue
    }
    const unique = [...new Set(list)]
    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        const key = `${unique[i]}:${unique[j]}`
        if (!seen.has(key)) {
          seen.add(key)
          pairs.push([unique[i], unique[j]])
        }
      }
    }
  }
  return pairs
}

function pickRepresentative(members: NormalizedProduct[]): NormalizedProduct {
  if (members.length <= 2) {
    return members.reduce((best, candidate) =>
      candidate.nameTokens.length > best.nameTokens.length ? candidate : best
    )
  }
  let best = members[0]
  let bestScore = -1
  for (const candidate of members) {
    let total = 0
    for (const other of members) {
      if (other !== candidate) {
        total += jaccard(candidate.nameTokens, other.nameTokens)
      }
    }
    if (total > bestScore) {
      bestScore = total
      best = candidate
    }
  }
  return best
}

/**
 * Substitutes: for each cluster that already has multi-supplier price
 * coverage, find products of the same type (shared core vocabulary, no
 * size/gauge/shade conflicts) from a different brand that are cheaper
 * per unit than the cluster's best price.
 */
function findSubstitutes(
  products: NormalizedProduct[],
  clusters: Cluster[],
  memberToCluster: Map<string, number>
): SubstituteCandidate[] {
  const tokenIndex = new Map<string, number[]>()
  products.forEach((product, idx) => {
    for (const token of new Set(product.coreTokens)) {
      let list = tokenIndex.get(token)
      if (!list) {
        list = []
        tokenIndex.set(token, list)
      }
      list.push(idx)
    }
  })

  const substitutes: SubstituteCandidate[] = []

  for (const cluster of clusters) {
    if (cluster.supplierCount < 2) {
      continue
    }
    const clusterPrices = cluster.members
      .map((member) => member.unitPriceCents)
      .filter((price): price is number => price !== null)
    if (!clusterPrices.length) {
      continue
    }
    const bestClusterPrice = Math.min(...clusterPrices)
    const clusterBrands = new Set(
      cluster.members.map((member) => member.brandKey).filter((brand): brand is string => !!brand)
    )
    const rep = cluster.representative

    const overlapCounts = new Map<number, number>()
    for (const token of new Set(rep.coreTokens)) {
      const list = tokenIndex.get(token)
      if (!list || list.length > SUBSTITUTE_TOKEN_MAX_DF) {
        continue
      }
      for (const idx of list) {
        overlapCounts.set(idx, (overlapCounts.get(idx) ?? 0) + 1)
      }
    }

    const candidates: SubstituteCandidate[] = []
    for (const [idx, sharedTokens] of overlapCounts) {
      if (sharedTokens < 2) {
        continue
      }
      const candidate = products[idx]
      if (memberToCluster.get(candidate.row.id) === cluster.key) {
        continue
      }
      if (candidate.unitPriceCents === null || candidate.unitPriceCents >= bestClusterPrice) {
        continue
      }
      if (candidate.brandKey && clusterBrands.has(candidate.brandKey)) {
        continue
      }
      const typeSim = jaccard(rep.coreTokens, candidate.coreTokens)
      if (typeSim < SUBSTITUTE_MIN_TYPE_SIM) {
        continue
      }
      const numeric = compareNumericAttrs(rep, candidate)
      if (numeric.hardConflict) {
        continue
      }
      const brandRel = brandsAgree(rep, candidate)
      if (brandRel === "match") {
        continue
      }
      const knownBrandBonus = candidate.brandKey ? 0.1 : 0
      const confidence = Math.round(100 * Math.min(0.69, 0.25 + 0.4 * typeSim + knownBrandBonus))
      candidates.push({
        clusterKey: cluster.key,
        product: candidate,
        typeSim,
        confidence,
        reason: `auto:substitute type-sim=${typeSim.toFixed(2)} unit-price=${candidate.unitPriceCents} vs cluster-best=${bestClusterPrice}`,
      })
    }

    candidates.sort((a, b) => b.typeSim - a.typeSim || a.product.unitPriceCents! - b.product.unitPriceCents!)
    substitutes.push(...candidates.slice(0, MAX_SUBSTITUTES_PER_CLUSTER))
  }

  return substitutes
}

export function runMatching(products: NormalizedProduct[]): MatchRunResult {
  const pairs = generateCandidatePairs(products)

  const acceptedPairs: ScoredPair[] = []
  const reviewPairs: ScoredPair[] = []
  const unionFind = new UnionFind(products.length)

  for (const [i, j] of pairs) {
    const decision = scorePair(products[i], products[j])
    if (decision.status === "exact" || decision.status === "variant") {
      acceptedPairs.push({ a: products[i], b: products[j], decision })
      unionFind.union(i, j)
    } else if (decision.status === "needs_review") {
      reviewPairs.push({ a: products[i], b: products[j], decision })
    }
  }

  const clusterMembers = new Map<number, number[]>()
  products.forEach((_, idx) => {
    const root = unionFind.find(idx)
    let list = clusterMembers.get(root)
    if (!list) {
      list = []
      clusterMembers.set(root, list)
    }
    list.push(idx)
  })

  const clusters: Cluster[] = []
  const memberToCluster = new Map<string, number>()
  let clusterKey = 0
  for (const indices of clusterMembers.values()) {
    if (indices.length < 2) {
      continue
    }
    const members = indices.map((idx) => products[idx])
    const cluster: Cluster = {
      key: clusterKey,
      members,
      representative: pickRepresentative(members),
      supplierCount: new Set(members.map((member) => member.row.supplier_id)).size,
    }
    clusters.push(cluster)
    for (const member of members) {
      memberToCluster.set(member.row.id, clusterKey)
    }
    clusterKey += 1
  }

  const substitutes = findSubstitutes(products, clusters, memberToCluster)

  return { products, acceptedPairs, reviewPairs, clusters, substitutes }
}

export { generateCandidatePairs }
