/**
 * Hexagon boundary enforcement — docs/03-architecture.md § 2.
 *
 * These rules are the architecture. Everything else in the docs is description;
 * this file is the part that actually stops a violation from merging.
 */
module.exports = {
  forbidden: [
    {
      name: 'domain-is-pure',
      severity: 'error',
      comment:
        'packages/domain must import nothing at all — no framework, no driver, no utility library. ' +
        'If a rule needs the outside world, it is not a domain rule.',
      // Scoped to src/ — a package's own build and test config is tooling,
      // not domain source, and is allowed to import the shared presets.
      from: { path: '^packages/domain/src/' },
      to: { pathNot: '^packages/domain/src/' },
    },
    {
      name: 'application-knows-no-tech',
      severity: 'error',
      comment:
        'packages/application may import packages/domain and nothing else. ' +
        'A use case that imports a driver has the wrong dependency — add a port.',
      from: { path: '^packages/application/src/' },
      to: {
        pathNot: '^(packages/application|packages/domain)/src/',
        dependencyTypesNot: ['type-only'],
      },
    },
    {
      name: 'routes-use-cases-only',
      severity: 'error',
      comment:
        'No app route may import an adapter. Route handlers and Server Actions call use cases. ' +
        'If you need an adapter here, you have found a missing use case.',
      from: { path: '^apps/[^/]+/app/' },
      to: { path: '^packages/adapter-' },
    },
    {
      name: 'composition-root-is-the-only-door',
      severity: 'error',
      comment:
        'Only packages/web-kit/src/composition may import an adapter. It moved there from ' +
        'apps/web/src when the studio became its own deployment (ADR-0011) — two apps wiring ' +
        'the same graph twice is the thing this rule exists to prevent. Everything else — ' +
        'read models, components, actions, either app — goes through a use case.',
      from: {
        path: '^(apps/[^/]+/src|packages/web-kit/src)/',
        pathNot: '^packages/web-kit/src/composition/',
      },
      to: { path: '^packages/adapter-' },
    },
    {
      name: 'deployables-are-independent',
      severity: 'error',
      comment:
        'apps/web and apps/studio are separate deployments. Neither may import the other — ' +
        'a single import is enough to make one undeployable without the other, which is ' +
        'exactly the coupling ADR-0011 removed. Shared code goes to packages/web-kit ' +
        '(runtime) or packages/ui (presentation).',
      from: { path: '^apps/([^/]+)/' },
      to: { path: '^apps/(?!$1)([^/]+)/' },
    },
    {
      name: 'adapters-are-siblings',
      severity: 'error',
      comment:
        'One adapter may never import another. Orchestration belongs to the use case.',
      from: { path: '^packages/adapter-([^/]+)/' },
      to: { path: '^packages/adapter-(?!$1)([^/]+)/' },
    },
    {
      name: 'nothing-imports-apps',
      severity: 'error',
      comment: 'apps/* are driving adapters. Nothing depends on them.',
      from: { pathNot: '^apps/' },
      to: { path: '^apps/' },
    },
    {
      name: 'ui-is-presentational',
      severity: 'error',
      comment:
        'packages/ui renders. It does not know about use cases, ports, adapters or the ' +
        'composition root — a component that reaches into web-kit has stopped being ' +
        'presentational and belongs in the app that needs it.',
      from: { path: '^packages/ui/' },
      to: { path: '^packages/(application|adapter-|web-kit)' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Cycles make the dependency direction meaningless.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      comment: 'An unreferenced module is either dead code or a missing wire-up.',
      from: {
        orphan: true,
        // `public/` assets are served at the web root, never imported — an
        // orphan warning there (e.g. the service worker) is noise by design.
        pathNot: [
          '\\.d\\.ts$',
          '(^|/)\\.[^/]+\\.(js|cjs|mjs|ts)$',
          '\\.config\\.(js|cjs|mjs|ts)$',
          '(^|/)public/',
        ],
      },
      to: {},
    },
  ],

  options: {
    doNotFollow: { path: 'node_modules' },
    // Anchor build-output exclusions to workspace paths. An unanchored
    // `/dist/` also matches `node_modules/<pkg>/dist/`, which would hide every
    // external dependency from `domain-is-pure` and silently disarm the rule.
    exclude: {
      path: '(\\.test\\.ts$|\\.spec\\.ts$|/testing/|^(packages|apps)/[^/]+/(dist|coverage|\\.next)/)',
    },
    tsPreCompilationDeps: true,
    // The web app's `@/*` mapping lives in apps/web/tsconfig.json. Reading
    // only the root one left every app-internal import unresolved, so the
    // app's own module graph was invisible here and a component imported
    // solely through `@/` looked like an orphan.
    tsConfig: { fileName: 'tsconfig.depcruise.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.js', '.ts', '.tsx', '.mjs', '.cjs'],
    },
    reporterOptions: {
      archi: { collapsePattern: '^(packages|apps|services)/[^/]+' },
    },
  },
}
