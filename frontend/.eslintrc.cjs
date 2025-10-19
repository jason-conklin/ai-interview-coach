/* eslint-env node */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
  },
  env: {
    browser: true,
    es2022: true,
  },
  plugins: [
    "react",
    "react-hooks",
    "@typescript-eslint",
    "@tanstack/query",
    "jsx-a11y",
    "tailwindcss",
  ],
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@tanstack/query/recommended",
    "plugin:jsx-a11y/recommended",
    "plugin:tailwindcss/recommended",
    "eslint-config-prettier",
  ],
  settings: {
    react: {
      version: "detect",
    },
    tailwindcss: {
      callees: ["cn", "clsx"],
    },
  },
  rules: {
    "react/react-in-jsx-scope": "off",
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/explicit-function-return-type": "off",
    "react/jsx-filename-extension": ["warn", { extensions: [".tsx"] }],
    "react-hooks/set-state-in-effect": "off",
  },
  ignorePatterns: ["dist", "node_modules"],
};
