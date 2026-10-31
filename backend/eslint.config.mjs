// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // Build output and coverage reports are generated, not source (flat config ignores .gitignore).
    ignores: ['eslint.config.mjs', 'dist/**', 'coverage/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      "prettier/prettier": ["error", { endOfLine: "auto" }],
      // Import order enforcement (Issue #223)
      '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],
      'no-duplicate-imports': 'error',
    },
  },
  {
    // The ONE scoped exception to type-aware linting: plain JavaScript / CommonJS
    // files (scripts/*.js, test/full-stack/*.cjs). They are not part of any tsconfig,
    // so the project service cannot type them and every type-aware rule would fail
    // to parse ("was not found by the project service"). For these files only, the
    // type-aware rules are turned off (this block must stay LAST so the rule
    // overrides above cannot re-enable them); all syntax rules (eslint recommended,
    // typescript-eslint non-type-aware rules, prettier) still apply.
    // Application TypeScript is never matched here.
    files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // Same files: they are CommonJS (package.json has no "type": "module", and CI
    // preloads test/full-stack/clerk-users-stub.cjs with `node --require`), so
    // require() is their module system, not a style choice. The rule exists to keep
    // TypeScript on ES imports; it stays on for every .ts file.
    files: ['**/*.js', '**/*.cjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);
