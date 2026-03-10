import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#100f0d",
          1: "#181714",
          2: "#1f1e1b",
          3: "#272521",
          4: "#302e29",
        },
        // Semantic zone palette
        zone: {
          calm:    "#7cc8a0",
          engaged: "#5ab5e8",
          intense: "#e8b84d",
          redline: "#e8705a",
        },
      },
      keyframes: {
        fadeSlideUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        ringPulse: {
          "0%, 100%": { opacity: "1" },
          "50%":       { opacity: "0.55" },
        },
      },
      animation: {
        fadeIn:    "fadeSlideUp 0.25s ease-out forwards",
        ringPulse: "ringPulse 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
