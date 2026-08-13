# @kurasikapa/ui

Presentational components shared by `apps/web` and `apps/studio`.

This package **renders**. It does not know about use cases, ports or adapters —
`pnpm boundaries` enforces that with the `ui-is-presentational` rule.

A component earns a place here only when both deployables genuinely render it.
Two similar-looking components with different meanings are not duplication; a
premature shared component is the more expensive mistake, because it couples
two deployments that were just separated.

Styling is Tailwind utility classes against the Regal Precision tokens, which
each app loads from `@kurasikapa/web-kit/styles/theme.css`. This package ships
no CSS of its own.
