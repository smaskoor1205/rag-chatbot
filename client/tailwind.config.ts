import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172026",
        panel: "#f7f8fa",
        line: "#d9dee5",
        accent: "#0f766e",
        signal: "#b45309"
      }
    }
  },
  plugins: []
} satisfies Config;
