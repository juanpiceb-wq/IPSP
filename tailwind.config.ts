import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Paleta corporativa (referencia cromática: azules corporativos IPSP)
        navy: {
          900: "#07223c",
          800: "#0b2e4f",
          700: "#0f3a63",
          600: "#134a7c",
        },
        corp: {
          700: "#084a84",
          600: "#0b5fa5",
          500: "#1c7fc4",
          400: "#4fa6de",
          300: "#87c4ea",
          200: "#c2e0f5",
          100: "#eaf3fb",
        },
        ink: "#1b2430",
        muted: "#667c8c",
        line: "#dce3ea",
        shell: "#f3f5f7",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "Segoe UI", "Arial", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(11,46,79,.06), 0 8px 24px rgba(11,46,79,.06)",
      },
    },
  },
  plugins: [],
};
export default config;
