/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#1a3a52",
        secondary: "#ffc107",
        accent: "#2c5aa0",
        darkBg: "#0F1419",
        lightBg: "#f8f9fa",
        text: "#1a1a1a",
        textLight: "#6b7280",
        border: "#e5e7eb",
        success: "#10b981",
        danger: "#ef4444",
        warning: "#f59e0b",
      },
      fontFamily: {
        sans: ["system-ui", "Avenir", "Helvetica", "Arial", "sans-serif"],
      },
      animation: {
        "pulse-bid": "pulse-bid 0.6s ease-in-out",
      },
      keyframes: {
        "pulse-bid": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.05)" },
        },
      },
    },
  },
  plugins: [],
};
