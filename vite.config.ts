import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "favicon.ico"],
      manifest: {
        name: "Ground Crew HQ",
        short_name: "HQ",
        description: "Workforce planning and field operations for outdoor crews.",
        theme_color: "#1f2937",
        background_color: "#0f172a",
        display: "standalone",
        start_url: "/",
      },
      workbox: {
        globPatterns: ["**/*.{html,css}", "assets/vendor-react*.js", "assets/index*.js"],
        globIgnores: ["**/assets/vendor-charts*.js", "**/assets/MobileFieldMap*.js", "**/assets/*Page-*.js"],
      },
    }),
  ].filter(Boolean),
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("/react/") || id.includes("\\react\\") || id.includes("react-dom") || id.includes("react-router-dom")) {
            return "vendor-react";
          }
          if (id.includes("@supabase/supabase-js")) {
            return "vendor-supabase";
          }
          if (id.includes("@radix-ui")) {
            return "vendor-ui";
          }
          if (id.includes("@tanstack/react-query") || id.includes("@tanstack/query-core")) {
            return "vendor-query";
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
