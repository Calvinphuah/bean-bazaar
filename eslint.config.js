import js from "@eslint/js"
import pluginVue from "eslint-plugin-vue"
import tseslint from "typescript-eslint"
import globals from "globals"

export default [
  {
    ignores: ["node_modules/**", "public/**", "dist/**"],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs["flat/recommended"],

  {
    files: ["**/*.{js,ts,vue}"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      // vue-eslint-parser handles the SFC; it needs the TS parser for the
      // <script lang="ts"> block inside.
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: [".vue"],
      },
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
    },
    rules: {
      "vue/multi-word-component-names": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", ignoreRestSiblings: true }],
      // `any` silently disables every check after it.
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
]
