import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#151923",
        paper: "#f7f5ef",
        line: "#ded7cb",
        accent: "#2f7a6d",
        ember: "#d55d3f"
      },
      boxShadow: {
        soft: "0 18px 60px rgba(21, 25, 35, 0.10)"
      }
    }
  },
  plugins: []
};

export default config;
