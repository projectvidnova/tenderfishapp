import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Core
        ink: "#0B0B0C",
        cream: "#F7F5F2",
        warm: "#ECE8E1",
        bronze: "#B7792E",
        "bronze-dark": "#9A6526",

        // Sidebar
        sidebar: {
          bg: "#0B0B0C",
          text: "rgba(255,255,255,0.6)",
          active: "#FFFFFF",
          border: "#B7792E",
        },

        // Surface
        topbar: {
          border: "#DCD7CF",
        },
        card: {
          bg: "#FFFFFF",
          border: "#DCD7CF",
        },

        // Data state chips
        state: {
          "confirmed-bg": "#0D2B1A",
          "confirmed-text": "#3F7A5A",
          "derived-bg": "#0D1B2A",
          "derived-text": "#4A637D",
          "unclear-bg": "#2A1A08",
          "unclear-text": "#C47A2C",
          "missing-bg": "#2A0D0D",
          "missing-text": "#B04A3A",
        },

        // Gate status
        gate: {
          complete: "#3F7A5A",
          progress: "#B7792E",
          "locked-bg": "#DCD7CF",
          "locked-text": "#6B6B6B",
          overridden: "#C47A2C",
        },

        // Health
        health: {
          green: "#3F7A5A",
          amber: "#B7792E",
          red: "#B04A3A",
        },

        // Schedule bars
        schedule: {
          "on-track": "#0D2B1A",
          "at-risk": "#2A1A08",
          overdue: "#2A0D0D",
          future: "#ECE8E1",
        },
      },
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        button: "0px",
        card: "4px",
        input: "4px",
      },
      fontSize: {
        // App-specific sizes
        "sidebar-item": ["14px", { lineHeight: "20px", fontWeight: "500" }],
        "data-mono": ["13px", { lineHeight: "18px", fontWeight: "500" }],
      },
      spacing: {
        sidebar: "240px",
        topbar: "64px",
      },
      width: {
        sidebar: "240px",
      },
      height: {
        topbar: "64px",
      },
    },
  },
  plugins: [],
};

export default config;
