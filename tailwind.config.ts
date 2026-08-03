import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: "var(--color-paper)",
          raised: "var(--color-paper-raised)",
        },
        ink: {
          DEFAULT: "var(--color-ink)",
          soft: "var(--color-ink-soft)",
          faint: "var(--color-ink-faint)",
        },
        rule: "var(--color-rule)",
        urgent: {
          DEFAULT: "var(--color-urgent)",
          bg: "var(--color-urgent-bg)",
          line: "var(--color-urgent-line)",
        },
        attention: {
          DEFAULT: "var(--color-attention)",
          bg: "var(--color-attention-bg)",
          line: "var(--color-attention-line)",
        },
        calm: {
          DEFAULT: "var(--color-calm)",
          bg: "var(--color-calm-bg)",
          line: "var(--color-calm-line)",
        },
        sheipe: {
          DEFAULT: "var(--color-sheipe)",
          deep: "var(--color-sheipe-deep)",
          on: "var(--color-on-sheipe)",
        },
        // Trio de acentos do anel do dia, um por métrica.
        treino: {
          DEFAULT: "var(--color-treino)",
          deep: "var(--color-treino-deep)",
          on: "var(--color-on-treino)",
        },
        agua: {
          DEFAULT: "var(--color-agua)",
          deep: "var(--color-agua-deep)",
          on: "var(--color-on-agua)",
        },
        dieta: {
          DEFAULT: "var(--color-dieta)",
          deep: "var(--color-dieta-deep)",
          on: "var(--color-on-dieta)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-monospace", "monospace"],
        body: ["var(--font-body)", "ui-sans-serif", "sans-serif"],
        data: ["var(--font-data)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
