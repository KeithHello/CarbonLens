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
        // CarbonLens brand palette
        primary: {
          50: "#E8F5E9",
          100: "#C8E6C9",
          200: "#A5D6A7",
          300: "#81C784",
          400: "#66BB6A",
          500: "#4CAF50",
          600: "#43A047",
          700: "#388E3C",
          800: "#2E7D32",
          900: "#1B5E20",
          DEFAULT: "#2E7D32",
        },
        accent: {
          50: "#E8F5E9",
          100: "#C8E6C9",
          200: "#A5D6A7",
          300: "#81C784",
          400: "#66BB6A",
          500: "#66BB6A",
          DEFAULT: "#66BB6A",
        },
        warning: {
          400: "#FFA726",
          500: "#FF8F00",
          DEFAULT: "#FF8F00",
        },
        danger: {
          400: "#EF5350",
          500: "#D32F2F",
          DEFAULT: "#D32F2F",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          '"Noto Sans"',
          "sans-serif",
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"',
          '"Noto Color Emoji"',
        ],
      },
      borderRadius: {
        xl: "16px",
      },
      boxShadow: {
        card: "0 2px 8px rgba(0, 0, 0, 0.08)",
        "card-hover": "0 4px 16px rgba(0, 0, 0, 0.12)",
        glow: "0 0 20px rgba(46,125,50,0.4)",
        "glow-lg": "0 0 40px rgba(46,125,50,0.3)",
      },
      animation: {
        fadeIn: "fadeIn 0.3s ease-out",
        slideUp: "slideUp 0.4s ease-out",
        "pulse-ring": "pulseRing 1.5s ease-out infinite",
        "gauge-needle": "gaugeNeedle 1s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseRing: {
          "0%": { boxShadow: "0 0 0 0 rgba(239,83,80,0.5)" },
          "70%": { boxShadow: "0 0 0 16px rgba(239,83,80,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(239,83,80,0)" },
        },
        gaugeNeedle: {
          "0%": { transform: "rotate(-90deg)" },
          "100%": { transform: "rotate(var(--needle-angle))" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
