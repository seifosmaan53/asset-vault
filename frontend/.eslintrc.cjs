// ESLint configuration to prevent common issues
module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    // Prevent Grid/Grid2 mismatches
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: '@mui/material',
            importNames: ['Grid'],
            message: 'Use Grid2 instead of Grid. Import: import { Grid2 } from "@mui/material";',
          },
        ],
        patterns: [
          {
            group: ['@mui/material/Grid2'],
            message: 'Import Grid2 as named export: import { Grid2 } from "@mui/material";',
          },
        ],
      },
    ],
    // Ensure getErrorMessage is imported when used
    'no-undef': 'error',
    // Prevent unused imports
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
};

