import { pearsonAdapter } from "../pearson"
import type { ProductPageCandidate } from "../../types"

function candidate(partial: Partial<ProductPageCandidate> = {}): ProductPageCandidate {
  return {
    distributor: "Pearson Dental",
    website_url: "https://www.pearsondental.com",
    origin: "https://www.pearsondental.com",
    prices: "Y",
    sitemap_url: "https://www.pearsondental.com/site-map",
    url: "https://www.pearsondental.com/catalog/product2.asp?pid=99147",
    url_type: "product",
    confidence_score: 90,
    reasons: ["test"],
    category: "Gloves",
    subcategory: "Nitrile",
    ...partial,
  }
}

describe("pearsonAdapter", () => {
  it("stores direct Pearson product image URLs on extracted item rows", () => {
    const rows = pearsonAdapter.extractProducts?.(
      candidate(),
      `
        <html>
          <head><title>Vivid GenCare (Pearson) | Pearson Dental</title></head>
          <body>
            <img src="/images/Header_Banner.png" alt="Home page">
            <img src="/pix/thumb_display_magic_lg.asp?picname=F870022_Group.jpg&amp;img_dir=img" alt="Vivid GenCare">
            <img src="/catalog/img/F870022_Group.jpg" alt="Vivid GenCare">
            <img src="/catalog/img_ext/F870022_Glove.jpg" alt="Vivid GenCare">
            <img src="/catalog/img/F870022_Group.jpg" alt="Duplicate">
            <tr valign="top">
              <td><b>Vivid GenCare Nitrile Gloves Box of 100</b> Mfg. Part #: F870022</td>
              <td><a href="/catalog/product.asp?bin2=99147"><b>99147</b></a></td>
              <td>$12.34</td>
            </tr>
          </body>
        </html>
      `
    )

    expect(rows).toHaveLength(1)
    expect(rows?.[0].image_url).toBe(
      "https://www.pearsondental.com/catalog/img/F870022_Group.jpg"
    )
    expect(rows?.[0].raw).toMatchObject({
      image_urls: [
        "https://www.pearsondental.com/catalog/img/F870022_Group.jpg",
        "https://www.pearsondental.com/catalog/img_ext/F870022_Glove.jpg",
      ],
    })
  })
})
