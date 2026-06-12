import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: { parserOptions: { ecmaVersion: "latest", sourceType: "module" } },
    rules: { "no-unused-vars": "off" }
  }
];
