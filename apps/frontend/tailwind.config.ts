import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        sm: "1.5rem",
        lg: "2rem",
        xl: "3rem"
      }
    },
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        brand: {
          navy: "#0B2A4A",
          orange: "#F27A1A",
          light: "#F4F8FC"
        },
        orange: {
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c"
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))"
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))"
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))"
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))"
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))"
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))"
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        sidebar: "hsl(var(--sidebar) / <alpha-value>)",
        "surface-raised": "hsl(var(--surface-raised) / <alpha-value>)",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))"
        }
      },
      borderRadius: {
        "2xl": "1.25rem",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)"
      },
      boxShadow: {
        soft: "0 10px 30px rgba(11, 42, 74, 0.08)",
        premium: "0 20px 60px rgba(15, 23, 42, 0.14)",
        glow: "0 0 30px rgba(249, 115, 22, 0.28)",
        "elevated-sm": "0 2px 8px rgba(0, 0, 0, 0.35), 0 1px 2px rgba(0, 0, 0, 0.2)",
        elevated: "0 4px 24px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.25)",
        "elevated-lg": "0 8px 40px rgba(0, 0, 0, 0.45), 0 4px 16px rgba(0, 0, 0, 0.3)",
        "glow-dark": "0 0 20px rgba(230, 138, 46, 0.22), 0 4px 14px rgba(0, 0, 0, 0.35)",
        "glow-dark-lg": "0 0 32px rgba(230, 138, 46, 0.32), 0 6px 20px rgba(0, 0, 0, 0.4)"
      },
      backgroundImage: {
        "hero-gradient":
          "radial-gradient(circle at 20% 20%, rgba(251,146,60,0.14), transparent 40%), radial-gradient(circle at 80% 0%, rgba(251,146,60,0.1), transparent 35%), linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
        "dark-workspace":
          "radial-gradient(circle at 12% 18%, rgba(230, 138, 46, 0.06), transparent 42%), radial-gradient(circle at 88% 6%, rgba(230, 138, 46, 0.04), transparent 48%), linear-gradient(180deg, hsl(228 21% 7%) 0%, hsl(228 18% 6%) 100%)"
      },
      keyframes: {
        "float-slow": {
          "0%, 100%": { transform: "translateY(0px) translateX(0px)" },
          "50%": { transform: "translateY(-14px) translateX(6px)" }
        },
        shine: {
          "0%": { transform: "translateX(-120%)" },
          "100%": { transform: "translateX(220%)" }
        }
      },
      animation: {
        "float-slow": "float-slow 8s ease-in-out infinite",
        shine: "shine 2.8s ease-in-out infinite"
      }
    }
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
