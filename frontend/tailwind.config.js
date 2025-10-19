/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx,js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#2563eb",
          light: "#3b82f6",
          dark: "#1d4ed8",
        },
        "brand-muted": "#dbeafe",
        success: "#16a34a",
        warning: "#f59e0b",
        danger: "#dc2626",
      },
      boxShadow: {
        card: "0px 16px 32px rgba(15, 23, 42, 0.1)",
      },
    },
  },
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/typography")],
};
