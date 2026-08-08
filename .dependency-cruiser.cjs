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
        'apps/web/app may not import an adapter. Route handlers and Server Actions call use cases. ' +
        'If you need an adapter here, you have found a missing use case.',
      from: { path: '^apps/web/app/' },
      to: { path: '^packages/adapter-' },
    },
    {
      name: 'composition-root-is-the-only-door',
      severity: 'error',
      comment:
        'Only apps/web/src/composition may import an adapter. Everything else in the app — ' +
        'read models, components, actions — goes through a use case. Without this rule, ' +
        'a helper module under src/ becomes a second, undocumented composition root.',
      from: { path: '^apps/web/src/', pathNot: '^apps/web/src/composition/' },
      to: { path: '^packages/adapter-' },
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
      comment: 'packages/ui renders. It does not know about use cases, ports or adapters.',
      from: { path: '^packages/ui/' },
      to: { path: '^packages/(application|adapter-)' },
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
        pathNot: ['\\.d\\.ts$', '(^|/)\\.[^/]+\\.(js|cjs|mjs|ts)$', '\\.config\\.(js|cjs|mjs|ts)$'],
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
    tsConfig: { fileName: 'tsconfig.json' },
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
