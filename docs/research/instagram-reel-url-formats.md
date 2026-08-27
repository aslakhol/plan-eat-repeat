# Instagram Reel URL formats

Checked 2026-08-27 against Meta's official embed implementation, Supadata's current documentation, and live responses from Instagram-owned hosts. This note focuses on public URLs a user could paste into recipe import. It separates published contracts from routes that work today but have no first-party stability promise.

## Conclusion

The parser now covers the main direct-media formats, including the plural `/reels/` URL that prompted this work, plus the other public Reel links found during this research.

The form that needs special handling is `https://www.instagram.com/share/reel/{share-token}/`. Instagram's share service redirects that URL to a normal `/reel/{shortcode}/` permalink. The share token is not the media shortcode, so the importer follows the Instagram redirect before parsing or calling Supadata.

The parser also normalizes `m.instagram.com` links, username-prefixed paths such as `/{username}/reel/{shortcode}/`, legacy `instagr.am/p/{shortcode}/` links, and embed paths.

## Published first-party contract

Meta's official Meta Embeds for WordPress project lists these Instagram media formats:

- `https://www.instagram.com/reel/{media-shortcode}/` for a Reel
- `https://www.instagram.com/p/{media-shortcode}/` for an image or carousel post

The project's actual provider pattern accepts `http` or `https`, optional `www`, and `/p/` or `/reel/`. Its tests also cover an optional trailing slash. Meta does not list plural `/reels/`, `/tv/`, share-token URLs, mobile hosts, or username-prefixed paths as supported oEmbed inputs. [Meta supported URL formats](https://github.com/facebook/meta-embeds-for-wordpress/blob/main/README.md#supported-url-formats), [provider pattern](https://github.com/facebook/meta-embeds-for-wordpress/blob/main/includes/class-meta-embeds.php#L48-L55), [URL variant tests](https://github.com/facebook/meta-embeds-for-wordpress/blob/main/tests/MetaEmbedsTest.php#L181-L208)

Instagram's own Apple universal-link manifest recognizes `/reel/*`, `/reels/*`, `/share/*`, and `/share/reel/*`. It explicitly excludes `/share/p/*` from opening as an app universal link, although that route still resolves on the website. This manifest proves that plural and share routes belong to Instagram's current link handling, but it is not a promise that Supadata accepts them. [Instagram universal-link manifest](https://www.instagram.com/.well-known/apple-app-site-association)

Supadata documents a narrower transcript input, `https://instagram.com/reel/{shortcode}/`. Its metadata endpoint documents `/reel/{shortcode}`, `/p/{shortcode}`, and `/tv/{shortcode}`. Neither page promises support for plural, share-token, username-prefixed, mobile-host, legacy short-domain, or embed URLs. [Supadata transcript formats](https://docs.supadata.ai/get-transcript#supported-url-formats), [Supadata metadata formats](https://docs.supadata.ai/get-metadata#supported-url-formats)

The safest provider input is therefore a direct `https://www.instagram.com/reel/{shortcode}/` URL. The app can accept more first-party routes at its boundary, then normalize them before sending them to Supadata.

## URL forms found

| Form                                                            | Status                                                                             | Current parser                            | Import relevance                                                                                                           |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `https://www.instagram.com/reel/{shortcode}/`                   | Documented by Meta and Supadata                                                    | Accepted                                  | Canonical Reel input.                                                                                                      |
| `https://instagram.com/reel/{shortcode}`                        | Documented variants cover bare host and no trailing slash                          | Accepted                                  | Normalize to the canonical `www` URL with a trailing slash.                                                                |
| `http://[www.]instagram.com/reel/{shortcode}[/]`                | Meta's official tests accept HTTP                                                  | Accepted                                  | It works, but canonical output should stay HTTPS.                                                                          |
| `https://www.instagram.com/reel/{shortcode}/?…`                 | A live Instagram share redirect and Meta's oEmbed output append query parameters   | Accepted                                  | Query parameters do not identify the media and may be removed during canonicalization.                                     |
| `https://www.instagram.com/reels/{shortcode}/`                  | Live, undocumented Instagram route                                                 | Accepted and changed to singular `/reel/` | Keep accepting it. Supadata and Meta do not document it as provider input.                                                 |
| `https://www.instagram.com/p/{shortcode}/`                      | Documented by Meta and Supadata                                                    | Accepted                                  | The URL alone does not prove the post is a Reel. Provider metadata must determine whether it is video, image, or carousel. |
| `https://www.instagram.com/tv/{shortcode}/`                     | Documented by Supadata metadata                                                    | Accepted                                  | Legacy IGTV alias. Live oEmbed can resolve a Reel through this route, but Supadata does not list it as a transcript input. |
| `https://www.instagram.com/share/reel/{share-token}/`           | Live, undocumented redirect                                                        | Accepted and resolved                     | Resolve it first because the token is not a media shortcode.                                                               |
| `https://www.instagram.com/share/{share-token}/`                | Declared in Instagram's universal-link manifest and observed redirecting live      | Accepted and resolved                     | The tested tokens redirected to `/p/{shortcode}/`, which may contain video, image, or carousel media.                      |
| `https://www.instagram.com/share/p/{share-token}/`              | Declared but excluded from app opening by the universal-link manifest; live on web | Accepted and resolved                     | Supports current post share-sheet links.                                                                                   |
| `https://m.instagram.com/reel/{shortcode}/`                     | Live, undocumented redirect to `www`                                               | Accepted and changed to `www`             | Normalize after validating the host.                                                                                       |
| `https://www.instagram.com/{username}/reel/{shortcode}/`        | Live, undocumented media route                                                     | Accepted and owner removed                | Extract the third path segment, then normalize to `/reel/{shortcode}/`.                                                    |
| `https://instagr.am/p/{shortcode}/`                             | Live legacy redirect to `www.instagram.com/p/…`                                    | Accepted and changed to `www`             | Compatibility is limited to `/p/`; `instagr.am/reel/` returned 404.                                                        |
| `https://www.instagram.com/reel/{shortcode}/embed[/captioned]/` | Live first-party embed pages                                                       | Accepted and embed suffix removed         | These are embed sources, not normal share links.                                                                           |

Direct parsing and canonicalization live in [`packages/shared/src/recipeImport.ts`](../../packages/shared/src/recipeImport.ts). Opaque share-token resolution lives in [`apps/web/src/server/recipes/instagram.ts`](../../apps/web/src/server/recipes/instagram.ts).

## Dated Instagram and Meta probes

The following requests were made without an Instagram login on 2026-08-27. They establish current behavior, not a published contract.

| Request                                                                                                              | Response                                                                       |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [`instagram.com/reel/DOybkebkcaw/`](https://instagram.com/reel/DOybkebkcaw/)                                         | `301` to `www.instagram.com/reel/DOybkebkcaw/`                                 |
| [`m.instagram.com/reel/DOybkebkcaw/`](https://m.instagram.com/reel/DOybkebkcaw/)                                     | `301` to `www.instagram.com/reel/DOybkebkcaw/`                                 |
| [`www.instagram.com/reels/DOybkebkcaw/`](https://www.instagram.com/reels/DOybkebkcaw/)                               | `200`                                                                          |
| [`www.instagram.com/share/reel/_69O6RoGd/`](https://www.instagram.com/share/reel/_69O6RoGd/)                         | `302` to `www.instagram.com/reel/DB0YWyzPdcX/?igsh=…`                          |
| [`www.instagram.com/share/BA2FWY8aBb/`](https://www.instagram.com/share/BA2FWY8aBb/)                                 | `302` to `www.instagram.com/p/C_0x-tLNM-c/?igsh=…`                             |
| [`www.instagram.com/share/p/BALv9Ep4YH/`](https://www.instagram.com/share/p/BALv9Ep4YH/)                             | `302` to `www.instagram.com/p/DC2konOtSse/?igsh=…`                             |
| [`www.instagram.com/instagram/reel/DOybkebkcaw/`](https://www.instagram.com/instagram/reel/DOybkebkcaw/)             | `302` to the owner-qualified `www.instagram.com/iankyo/reel/DOybkebkcaw/` path |
| [`www.instagram.com/iankyo/reel/DOybkebkcaw/`](https://www.instagram.com/iankyo/reel/DOybkebkcaw/)                   | `200`                                                                          |
| [`instagr.am/p/DOybkebkcaw/`](https://instagr.am/p/DOybkebkcaw/)                                                     | `301` to `www.instagram.com/p/DOybkebkcaw/?short_redirect=1`                   |
| [`instagr.am/reel/DOybkebkcaw/`](https://instagr.am/reel/DOybkebkcaw/)                                               | `404`                                                                          |
| [`ig.me/p/DOybkebkcaw/`](https://ig.me/p/DOybkebkcaw/)                                                               | `302` to the Instagram home page, not the media                                |
| [`ig.me/reel/DOybkebkcaw/`](https://ig.me/reel/DOybkebkcaw/)                                                         | `404`                                                                          |
| [`www.instagram.com/reel/DOybkebkcaw/embed/`](https://www.instagram.com/reel/DOybkebkcaw/embed/)                     | `200`                                                                          |
| [`www.instagram.com/reel/DOybkebkcaw/embed/captioned/`](https://www.instagram.com/reel/DOybkebkcaw/embed/captioned/) | `200`                                                                          |

Meta's official `instagram_oembed` endpoint was also called with the same shortcode through `/reel/`, `/p/`, `/tv/`, and `/reels/` inputs. `/reel/`, `/p/`, and `/tv/` returned embed HTML whose `data-instgrm-permalink` was the singular `/reel/DOybkebkcaw/` URL. The plural `/reels/` input returned Meta error `100/2207047`, "Invalid URL." This is direct evidence that accepting plural URLs in the UI and canonicalizing them before a provider call is the right split. [Meta's oEmbed endpoint registration](https://github.com/facebook/meta-embeds-for-wordpress/blob/main/includes/class-meta-embeds.php#L48-L55), [canonical Reel used in the probe](https://www.instagram.com/reel/DOybkebkcaw/)

## What should remain rejected

- `https://www.instagram.com/reels/` is the Reels feed, not one media item.
- `https://www.instagram.com/reels/audio/{audio-id}/` is an audio page shared by many posts, not one Reel.
- Profile, story, highlight, explore, login, and direct-message URLs do not identify one public Reel.
- `ig.me` is not a Reel permalink host. The tested media-shaped paths did not resolve to the requested media.
- Lookalike domains must remain invalid even if their path resembles an Instagram URL.

## Implemented parser boundary

The app accepts direct URLs without a network lookup when they match one of these shapes:

```text
https?://(www.|m.)?instagram.com/(reel|reels|p|tv)/{shortcode}[/][?…]
https?://(www.|m.)?instagram.com/{username}/(reel|reels|p|tv)/{shortcode}[/][?…]
https?://instagr.am/p/{shortcode}[/][?…]
```

Embed suffixes are compatibility inputs, not part of the normal paste flow.

The server handles `/share/reel/{share-token}`, `/share/{share-token}`, and `/share/p/{share-token}` separately:

1. Request only an allowlisted Instagram share URL with a small redirect limit.
2. Require the resolved URL to remain on `instagram.com` or `www.instagram.com`.
3. Parse the resolved direct-media URL using the same strict parser.
4. Send the resulting canonical direct URL to Supadata.

Do not place the share token into `/reel/{token}/`. The two identifiers are different, as the live `_69O6RoGd` redirect to Reel shortcode `DB0YWyzPdcX` shows.

## Final coverage assessment

No known user-facing Reel link family found in this research remains unsupported. Direct, plural, mobile, owner-qualified, legacy post, embed, and opaque share URLs now reach the same canonical Supadata input.

The undocumented routes can still change. The share resolver therefore limits redirects, follows only Instagram URLs, and rejects any final destination that is not one supported direct-media shape. Reel feeds, audio pages, profiles, stories, `ig.me`, and lookalike domains remain rejected.
