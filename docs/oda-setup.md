# Oda setup

Set `ODA_CREDENTIAL_KEY` to a random 32-byte base64 key on the server. Generate it with `openssl rand -base64 32`. Keep it stable across deployments. Existing encrypted connections cannot be read after replacing the key.

`NEXT_PUBLIC_APP_URL` determines the exact OAuth callback URL, `/api/oda/callback`. The app registers that URL with Oda when a member connects. No assistant credentials or Oda password are used.

After deploying, open Shopping List settings and connect Oda. Confirm the browser returns to the list and Open Oda cart works. Reconnect from another household member and check shared access. Leave the connection until its access token expires, then open the cart again to exercise refresh. Disconnect and check that the app no longer has access. These live checks remain necessary even when the controlled-provider tests pass.

Do not place an order during verification. Transfer testing should use a small reversible addition, followed by restoring the cart in Oda.

## Matching check

On 2026-09-17, the configured real model interpreted a controlled candidate set through the application transfer operation. With one litre of milk already in the simulated cart, an explicit two-litre requirement plus unspecified Milk produced two additional one-litre packs. “Two eggs” produced one six-egg pack. All requirements completed. Oda transport was controlled, so this exercised real model interpretation without changing an Oda cart. It does not establish general matching quality or live stock availability.

A second real-model exercise on the same date checked purchase-history limits. Unspecified Milk chose a single one-litre pack despite a cheaper six-pack in purchase history. A lactose-free Shopping Note selected lactose-free milk despite ordinary milk in purchase history. These calls also used controlled Oda responses and made no real cart changes.
