# Oda shopping-list integration

Checked 2026-09-17 against Oda's authenticated MCP tool schemas and live calls, OAuth metadata, and community source at commit `721898f9d8a05767d5640d2f48ec030812ce7c20`. Account connection and functional checks were authorized by the user. No personal address or order history is recorded here.

## Recommendation

Use **Oda's official hosted MCP at `https://oda.com/mcp`**. Authenticated checks proved product search, cart transfer, saved-list export and checkout-link retrieval. Plan Eat Repeat should handle choosing products and pack quantities, then send the approved selection to Oda. The community server is useful reference material, but its password login and dependence on website internals make it a weaker app foundation. [Official MCP schemas and live calls](https://oda.com/mcp), [OAuth metadata](https://oda.com/.well-known/oauth-authorization-server), [community client](https://github.com/gbbirkisson/mcp-oda/blob/721898f9d8a05767d5640d2f48ec030812ce7c20/src/oda-client.ts)

## Capability comparison

Official capabilities below were verified in the authenticated inventory of 25 tools. Live execution is distinguished in the next section. Community capabilities were checked in its 19 tool registrations and response types.

| Area | Official Oda MCP | Community `gbbirkisson/mcp-oda` |
| --- | --- | --- |
| Connection | Hosted HTTPS; OAuth with per-user authorization. | Local TypeScript server over stdio, plus CLI; password login and cookie files. |
| Find products | Batch keyword search, category and brand browsing, similar products. | Keyword search and pagination. |
| Product data | IDs, descriptions, brand, prices, unit prices, availability and product URLs. | IDs, package text, brand, prices, unit prices, availability, discounts and images. |
| Preferences | Usual purchases, discovery recommendations, order details/history. | Frequent purchases and cart recommendations. |
| Cart | Read, batch additions/removals, clear; import recipes, lists or previous orders. | Read, add/remove, set quantity, clear; import recipes and lists. |
| Saved lists | Create, read, edit and delete shopping or dinner lists. | Read/edit lists and add their contents to cart. |
| Delivery/payment | Read/select slots; checkout and payment require Oda's shop. | Read slots only; no checkout. |

Sources: [official tool schemas](https://oda.com/mcp), [community registrations](https://github.com/gbbirkisson/mcp-oda/blob/721898f9d8a05767d5640d2f48ec030812ce7c20/src/server.ts), [community types](https://github.com/gbbirkisson/mcp-oda/blob/721898f9d8a05767d5640d2f48ec030812ce7c20/src/types.ts).

## Authenticated checks

- Client registration and browser OAuth completed successfully, followed by authenticated discovery of all 25 tools. This removes the original authentication blocker.
- Live searches for milk, lactose-free milk, onion, eggs, chopped tomatoes and chicken returned concrete products. Milk pagination returned different products on page two.
- A batch added two 1-litre milk cartons and two 400-gram tomato packs. A separate cart read confirmed all quantities and returned `https://oda.com/no/cart/`. Adding one more milk produced three, confirming relative quantities.
- A temporary saved list with the same products was created, read and imported into the cart as a named group. Removing that group and deleting the temporary list worked.
- The cart and saved-list collection were restored to their original empty state, verified by exact response equality. No order, payment or delivery-slot change was made.
- A later matching check found that `likely_to_buy` returned no suggestions for this account, while `get_orders` returned a past order with product lines. Purchase history is available even when reorder suggestions are empty; no private order details are recorded here.
- `get_product_lists` with `size: 100` failed because the runtime maximum is 20, a restriction missing from the exposed parameter description. Handle validation errors rather than assuming every limit is described.

These are direct observations from the [official MCP](https://oda.com/mcp). Delivery-slot selection, token refresh and production web callbacks remain untested. Product line subtotals summed to NOK 76 while the returned cart total was NOK 286.70; display product estimates separately from Oda's checkout total without inventing a fee breakdown.

## What matching still needs

`product_search` accepts up to ten query strings per call. Pagination applies to the whole batch. It returns candidate products, not a resolved shopping list. `likely_to_buy` can help select the shopper's usual milk; `similar_and_related_products` can offer alternatives. `unique_for_you` emphasizes new discoveries and is less suitable for default staples. [Official tool descriptions](https://oda.com/mcp)

Live search for the nonsense query `qzxvplmnkjhgf20260917` returned milk and shower gel. Nonempty results do not establish a valid match. Require a relevance check and an unresolved/manual-choice state. Related-product results also included broad category groups such as tea alongside milk alternatives; only plausible substitutes should be offered. [Live search and related-product calls](https://oda.com/mcp)

There is **no normalized pack-size field** in the product schema. `unitName` describes the unit price, not the pack quantity. Live results included count-based packs priced per kilogram. Extract pack sizes from descriptions and require review when ambiguous; dividing price by unit price is not a reliable count conversion. There is also no generic ingredient resolver, standalone product-by-ID detail tool, or structured allergen/ingredient data in the exposed product schema. Do not promise verified allergen matching from these tools. [Official product schema and live search responses](https://oda.com/mcp)

Our items already include name, note and optional amount/unit. Remember approved Oda products per household `OwnItem`, whose identity includes both name and note. Recheck product availability when exporting. Existing conversions cover selected weight/volume units; cups, spoons and arbitrary units need explicit handling. [Schema](../../packages/db/prisma/schema.prisma), [quantity rules](../adr/0016-allow-arbitrary-units-with-numeric-amounts.md), [item identity](../adr/0018-remember-own-items-by-name-and-note.md)

## Cart transfer and account integration

`manipulate_cart` accepts a batch of product, recipe, list or order operations. Product quantities are relative changes, never target totals. No idempotency key is exposed. After a timeout, reread the cart before retrying to avoid duplicates. Product removals affect all matching lines, including recipe/list groups. Reordering an order always adds its contents, even with a negative quantity. Saved lists keep zero-quantity rows unless `delete: true` is supplied. [Official mutation schemas](https://oda.com/mcp)

The subsequent design session chose direct transfer into the existing Oda cart, with product review in Oda, and deferred the optional product picker. See [ADR 0020](../adr/0020-share-oda-shopping-transfers-within-the-household.md) for the current decisions. Oda explicitly requires checkout/payment in its shop, using the `url` returned by `get_cart`. Saved-list export is also supported, but its schema provides no direct list URL. [Official cart/list schemas](https://oda.com/mcp)

OAuth advertises authorization-code flow, PKCE S256, refresh tokens, revocation and dynamic client registration with scope `mcp`. The successful desktop flow proves authorization by an Oda account holder. It does not prove acceptance of our production redirect URI, refresh/reconnection behavior or a deployed multiuser integration. The subsequent design session chose one shared connection per Household; make the destination Oda account explicit when exporting. No general rate-limit or integration-service commitment was found. [Resource metadata](https://oda.com/.well-known/oauth-protected-resource/mcp), [authorization metadata](https://oda.com/.well-known/oauth-authorization-server), [ADR 0020](../adr/0020-share-oda-shopping-transfers-within-the-household.md)

The community server parses Next.js pages and calls website REST endpoints. Its August 2026 changelog records a repair after breakage. The old `kolonialno/oda-mcp` GitHub repository now returns 404; cached descriptions of it are not the current hosted service's specification. [Community implementation](https://github.com/gbbirkisson/mcp-oda/blob/721898f9d8a05767d5640d2f48ec030812ce7c20/src/oda-client.ts), [changelog](https://github.com/gbbirkisson/mcp-oda/blob/721898f9d8a05767d5640d2f48ec030812ce7c20/CHANGELOG.md), [old repository](https://github.com/kolonialno/oda-mcp)
