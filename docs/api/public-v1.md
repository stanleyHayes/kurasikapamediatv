# Public news API v1

Kurasikapa's read-only public API delivers published journalism to syndication
partners, prototypes and future reader applications. It never exposes drafts,
workflow state, internal revisions or credentials.

## Base URL

Production currently uses:

```text
https://kurasikapa-media-api.onrender.com/v1
```

`GET /v1` is the discovery document. `GET /v1/openapi.json` is the canonical
OpenAPI 3.1 contract. A future `api.kurasikapa.tv` alias may replace the host;
the versioned paths will remain unchanged.

## Resources

```http
GET /v1/{locale}/articles?limit=12&after={cursor}&categoryId={categoryId}
GET /v1/{locale}/articles/{slug}
```

`locale` is the edition code, currently `en` or `fr`. `limit` defaults to 12
and is bounded to 50. `after` is opaque: clients must copy
`pagination.nextCursor` or `links.next` and must not parse or manufacture it.

Collection responses use a stable envelope:

```json
{
  "apiVersion": "v1",
  "data": [],
  "pagination": { "nextCursor": "" },
  "links": { "self": "/v1/en/articles?limit=12" }
}
```

An article item contains its public identifier, slug, locale, headline,
category and public author identifiers, publication time, approved excerpt,
reading-time estimate, and any verified hero image or narration. The detail
resource additionally contains the approved Markdown body and revision time.

## Delivery and safety

- Authentication is not required. Only `GET` and CORS `OPTIONS` are exposed.
- `Access-Control-Allow-Origin: *` permits browser-based reader clients.
- Responses are cached for 60 seconds and may be served stale for five minutes
  while revalidating. The discovery document and OpenAPI contract cache for one
  hour.
- Unknown or unpublished articles return the existing RFC 7807-style problem
  response. Drafts and scheduled stories are indistinguishable from missing
  resources.
- Consumers must display the Kurasikapa byline and link to the canonical public
  article. Republishing full article bodies requires a separate syndication
  agreement.

## Compatibility

Fields may be added within `v1`; documented fields will not be removed or
change meaning. Breaking changes require a new top-level version. Consumers
should ignore unknown fields and use link relations instead of constructing
pagination URLs.
