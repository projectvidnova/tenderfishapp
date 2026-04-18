import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Brand (from mockup design system)
        brand: {
          orange: "#E8622C",
          "orange-hover": "#D4551F",
          "orange-light": "rgba(232, 98, 44, 0.07)",
          "orange-border": "rgba(232, 98, 44, 0.2)",
          blue: "#0071E3",
          "blue-hover": "#0062CC",
          "blue-light": "rgba(0, 113, 227, 0.06)",
          black: "#1d1d1f",
        },

        // Sidebar (white theme from landing page)
        sidebar: {
          bg: "#ffffff",
          "bg-hover": "#f5f5f7",
          "bg-active": "rgba(232, 98, 44, 0.07)",
          text: "#86868b",
          "text-hover": "#1d1d1f",
          "text-active": "#E8622C",
          border: "rgba(0,0,0,0.06)",
        },

        // Backgrounds
        bg: {
          app: "#f5f5f7",
          card: "#ffffff",
          "card-hover": "#fafafa",
          elevated: "#ffffff",
          inset: "#f5f5f7",
          page: "#fbfbfd",
        },

        // Text
        text: {
          primary: "#1d1d1f",
          secondary: "#6e6e73",
          tertiary: "#86868b",
          quaternary: "#aeaeb2",
        },

        // Borders (from landing page)
        border: {
          DEFAULT: "#d2d2d7",
          light: "rgba(0,0,0,0.04)",
          focus: "#E8622C",
        },

        // Status
        status: {
          success: "#34C759",
          "success-light": "rgba(52, 199, 89, 0.08)",
          warning: "#FF9F0A",
          "warning-light": "rgba(255, 159, 10, 0.08)",
          danger: "#FF3B30",
          "danger-light": "rgba(255, 59, 48, 0.08)",
          info: "#007AFF",
          "info-light": "rgba(0, 122, 255, 0.06)",

          // Opaque badge/chip backgrounds (for status indicators with text)
          "success-bg": "#dcfce7",
          "success-fg": "#15803d",
          "success-border": "#86efac",
          "warning-bg": "#fef3c7",
          "warning-fg": "#b45309",
          "warning-border": "#fcd34d",
          "danger-bg": "#fee2e2",
          "danger-fg": "#b91c1c",
          "danger-border": "#fca5a5",
          "info-bg": "#dbeafe",
          "info-fg": "#1d4ed8",
          "info-border": "#93c5fd",
          "purple-bg": "#f3e8ff",
          "purple-fg": "#7e22ce",
          "purple-border": "#d8b4fe",
          "emerald-bg": "#d1fae5",
          "emerald-fg": "#047857",
          "teal-bg": "#ccfbf1",
          "teal-fg": "#0d9488",
          "indigo-bg": "#eef2ff",
          "indigo-fg": "#4f46e5",

          // Semantic outcome colors (used across status configs)
          approve: "#3F7A5A",
          reject: "#B04A3A",
        },

        // Data state chips
        state: {
          "confirmed-bg": "rgba(52, 199, 89, 0.08)",
          "confirmed-text": "#248A3D",
          "derived-bg": "rgba(0, 122, 255, 0.06)",
          "derived-text": "#007AFF",
          "unclear-bg": "rgba(255, 159, 10, 0.08)",
          "unclear-text": "#C77C02",
          "missing-bg": "rgba(255, 59, 48, 0.08)",
          "missing-text": "#D70015",
        },

        // Gate status
        gate: {
          complete: "#34C759",
          progress: "#E8622C",
          "locked-bg": "#f5f5f7",
          "locked-text": "#86868b",
          overridden: "#FF9F0A",
        },

        // Health
        health: {
          green: "#34C759",
          amber: "#FF9F0A",
          red: "#FF3B30",
        },

        // Schedule bars
        schedule: {
          "on-track": "rgba(52, 199, 89, 0.08)",
          "at-risk": "rgba(255, 159, 10, 0.08)",
          overdue: "rgba(255, 59, 48, 0.08)",
          future: "#f5f5f7",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "Inter",
          "Helvetica Neue",
          "sans-serif",
        ],
        mono: ["SF Mono", "JetBrains Mono", "monospace"],
      },
      borderRadius: {
        sm: "8px",
        md: "10px",
        lg: "14px",
        xl: "20px",
        full: "980px",
      },
      fontSize: {
        "sidebar-item": [
          "0.8125rem",
          { lineHeight: "1.4", fontWeight: "450" },
        ],
        "data-mono": [
          "0.8125rem",
          { lineHeight: "1.4", fontWeight: "500" },
        ],
      },
      spacing: {
        sidebar: "240px",
        topbar: "52px",
      },
      width: {
        sidebar: "240px",
      },
      height: {
        topbar: "52px",
      },
      boxShadow: {
        card: "0 0.5px 1px rgba(0,0,0,0.03), 0 2px 6px rgba(0,0,0,0.02)",
        "card-hover": "0 2px 12px rgba(0,0,0,0.06)",
        sm: "0 1px 3px rgba(0,0,0,0.04)",
        md: "0 4px 12px rgba(0,0,0,0.06)",
        lg: "0 8px 30px rgba(0,0,0,0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
