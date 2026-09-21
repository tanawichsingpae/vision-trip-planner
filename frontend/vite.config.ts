import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const fsqKey = env.VITE_FOURSQUARE_API_KEY || "GX2H45UIADKETIZWD1EENJ5UEGIRIJJME2ORYQYBXYATLAXQ";
  const fsqAuth = fsqKey.startsWith("Bearer ") ? fsqKey : `Bearer ${fsqKey.trim()}`;

  return {
    server: {
      host: "::",
      port: 5173,
      allowedHosts: "all",
      hmr: {
        overlay: false,
      },
      proxy: {
        "/fsq-api": {
          target: "https://places-api.foursquare.com",
          changeOrigin: true,
          secure: true,
          rewrite: (p) => p.replace(/^\/fsq-api/, ""),
          headers: {
            Authorization: fsqAuth,
            "X-Places-Api-Version": "2025-06-17",
            Accept: "application/json",
          },
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              proxyReq.setHeader("Authorization", fsqAuth);
              proxyReq.setHeader("X-Places-Api-Version", "2025-06-17");
              proxyReq.setHeader("Accept", "application/json");
            });
            proxy.on("proxyRes", (proxyRes) => {
              if (proxyRes.statusCode === 429 || proxyRes.statusCode === 402) {
                proxyRes.statusCode = 200;
                proxyRes.headers["x-foursquare-exhausted"] = "true";
              }
            });
          },
        },
      },
    },
    envPrefix: ["VITE_", "NEXT_PUBLIC_"],
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    },
  };
});