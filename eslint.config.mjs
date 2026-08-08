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
 * Time and identity come from ClockPort and IdPort, never from the ambient runtime.
 */
const determinism = {
  'no-restricted-globals': ['error', { name: 'Date', message: 'Inject ClockPort instead.' }],
  'no-restricted-properties': [
    'error',
    { object: 'Date', property: 'now', message: 'Inject ClockPort instead.' },
    { object: 'Math', property: 'random', message: 'Inject IdPort or a seeded source instead.' },
    { object: 'crypto', property: 'randomUUID', message: 'Inject IdPort instead.' },
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
