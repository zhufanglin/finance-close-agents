import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // zhufanglin.cc 风格主题色
        brand: {
          50: "#e1f5ee",
          100: "#9fe1cb",
          200: "#5dcaa5",
          400: "#1d9e75",
          600: "#23675f",
          700: "#1f4f49",
          800: "#174f49",
          900: "#085041",
        },
        // 文字三级（slate）
        ink: {
          primary: "#1e293b",
          secondary: "#64748b",
          tertiary: "#94a3b8",
        },
        line: "#e2e8f0",
        page: "#f8fafc",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"PingFang SC"',
          '"Microsoft YaHei"',
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem",
      },
    },
  },
  plugins: [],
};
export default config;
