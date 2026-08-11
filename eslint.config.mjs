// @ts-check
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

/**
 * Size and complexity limits from docs/07-quality-gates.md § 1.
 * These fail the build. They are not warnings.
 */
const sizeLimits = {
  'max-lines': ['error', { max: 250, skipBlankLines: true, skipComments: true }],
  'max-lines-per-function': ['error', { max: 50, skipBlankLines: true, skipComments: true }],
  complexity: ['error', 10],
  'max-params': ['error', 4],
  'max-depth': ['error', 3],
  'max-nested-callbacks': ['error', 3],
}

/**
 * Determinism rules from AGENTS.md § 5.
 *
 * Everywhere: reading the ambient clock or entropy source is banned. These are
 * the calls that make a test depend on when it ran.
 */
const determinism = {
  'no-restricted-properties': [
    'error',
    { object: 'Date', property: 'now', message: 'Inject ClockPort instead.' },
    { object: 'Math', property: 'random', message: 'Inject IdPort or a seeded source instead.' },
    { object: 'crypto', property: 'randomUUID', message: 'Inject IdPort instead.' },
  ],
}

/**
 * The inner rings go further: they may not name `Date` at all.
 *
 * Not applied globally, because `new Date(isoString)` is deterministic parsing
 * — the presentation layer needs it to format a timestamp for `Intl`. A rule
 * that cannot tell those apart, applied everywhere, only teaches people to
 * disable it.
 */
const noAmbientTime = {
  'no-restricted-globals': [
    'error',
    { name: 'Date', message: 'The domain and application layers receive time via ClockPort.' },
  ],
}

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/node_modules/**',
      'services/media-svc/**',
      'stitch_kurasikapa_ai_media_platform/**',
      // Worker globals (`self`, `caches`) are not in the app ESLint env.
      // Path rules are tested in `apps/web/src/pwa/offline-policy.test.ts`.
      'apps/web/public/sw.js',
    ],
  },

  eslint.configs.recommended,

  // Type-aware rules need a TypeScript program, so they apply to .ts only.
  // Config files (.mjs/.cjs) are linted by the base rules alone.
  ...tseslint.configs.strictTypeChecked.map((c) => ({ ...c, files: ['**/*.ts', '**/*.tsx'] })),
  ...tseslint.configs.stylisticTypeChecked.map((c) => ({ ...c, files: ['**/*.ts', '**/*.tsx'] })),

  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...sizeLimits,
      ...determinism,
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        { allowExpressions: true, allowTypedFunctionExpressions: true },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      // A leading underscore marks a parameter that exists to satisfy a
      // signature — common when implementing an interface method that
      // genuinely ignores an argument.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      eqeqeq: ['error', 'always'],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },

  // NOTE: eslint-plugin-react-hooks is deliberately absent. It pulls a Babel
  // subtree that fails our pnpm trust policy, and that policy has already
  // caught two real supply-chain signals on this project. Two lint rules do
  // not outweigh it. Hooks are instead written so they need no escape hatch —
  // see useAutosave, whose dependency array is fixed-size by construction.
  // Revisit if the plugin's dependency tree becomes attested.

  // The inner rings never touch the clock, in any form.
  {
    files: ['packages/domain/src/**/*.ts', 'packages/application/src/**/*.ts'],
    ignores: ['**/*.test.ts', '**/testing/**'],
    rules: noAmbientTime,
  },

  // Domain purity is enforced by dependency-cruiser (`domain-is-pure`), not here —
  // ESLint's no-restricted-imports cannot distinguish a bare specifier from a
  // relative one without also banning the domain's own internal imports.
  // One rule, one enforcement point. See .dependency-cruiser.cjs.

  // Tests may be long, but only in the body of a test case.
  {
    files: ['**/*.test.ts', '**/*.spec.ts', '**/testing/**/*.ts'],
    rules: {
      'max-lines-per-function': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-restricted-globals': 'off',
      'no-restricted-properties': 'off',
    },
  },

  // The composition root is the one place allowed to know everything.
  {
    files: ['apps/web/src/composition/**/*.ts'],
    rules: {
      'no-restricted-globals': 'off',
      'no-restricted-properties': 'off',
    },
  },
)
