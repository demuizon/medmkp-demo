# MedMKP Product Brief

## Wedge

MedMKP is a concierge procurement marketplace for medical offices. The first target is PT, chiro, and rehab clinics because the supplies are lower-regulation, frequently purchased, fragmented across vendors, and painful to compare.

The buyer promise:

- Upload a catalog, invoice, reorder list, or free-form supply need.
- See the best-value option for each product category.
- Choose whether they need the exact brand or will accept flexible alternatives.
- Submit one concierge request instead of chasing scattered suppliers.

The supplier promise:

- Create an account and upload a catalog/SKU list with minimal manual entry.
- Publish offers with price, inventory, shipping estimate, and certifications.
- Receive qualified B2B demand from clinics.

## Starting ICP

1. PT / Chiro / Rehab
   - Lower-regulation Type I style products.
   - Frequently purchased consumables and therapy supplies.
   - Fragmented supplier landscape.
2. Dental
   - Later wedge. More category complexity and less obvious drop-shipping fit.
3. CPAP
   - Later wedge. More regulatory and product-fit complexity.

## Core Workflows

```text
Buyer need upload -> Product/category extraction -> Supplier offer matching
                  -> Best-value recommendation -> Concierge buy request
```

```text
Supplier catalog upload -> SKU parsing -> Canonical product mapping
                        -> Vetting/certification check -> Live offers
```

## Marketplace Model

This is closer to Amazon Business plus concierge procurement than pure drop-shipping.

- Suppliers create their own accounts.
- Buyers can search or upload needs.
- MedMKP normalizes products so buyers compare comparable offers.
- Buyer pays supplier, MedMKP takes commission.
- Stripe ACH is preferred for lower B2B payment cost. Stripe Connect can support payouts and commission tracking. Plaid may help later for bank/account verification.

## Matching Criteria

Best value is not only lowest price. Rank offers by:

- Cost of item.
- Supplier reliability.
- Inventory availability.
- Shipping estimate.
- Exact brand requirement versus acceptable alternative.
- Certification/vetting status.
- Prior buyer reorder history.

## Supplier Vetting

Minimum supplier profile:

- EIN.
- Certifications.
- Product categories served.
- Shipping regions and estimated delivery windows.
- Inventory feed or inventory estimate policy.
- Portal/API/catalog upload method.

Potential supplier sourcing:

- Thomasnet.
- Integrated Medical.
- Direct outreach to therapy-supply distributors.

## Product Architecture Implication

The system should separate canonical products from seller offers:

```text
Supplier SKU -> Canonical Product -> Comparable Offer -> Best Value Match -> Buy Request
```

This lets one product category show multiple comparable offers without flooding buyers with duplicate SKUs.

## Open Questions

- Do suppliers have portals/APIs, or will most start with catalog uploads?
- How fresh does inventory need to be for v1: live count, daily estimate, or supplier-confirmed after request?
- Should v1 be an RFQ/concierge workflow before checkout, or a direct order checkout?
- What product categories produce the fastest first ten supplier conversations?
- What non-binding LOI language should clinics sign before implementation?
- What HIPAA posture is required if the platform avoids patient data entirely?
