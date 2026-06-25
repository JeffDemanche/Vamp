import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// React Native Web setup: code imports from "react-native" and we alias it to
// "react-native-web" for the web bundle. The extra resolve extensions let
// platform-specific files (e.g. `Foo.web.tsx`) win on web.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "react-native": "react-native-web",
    },
    extensions: [
      ".web.tsx",
      ".web.ts",
      ".web.jsx",
      ".web.js",
      ".tsx",
      ".ts",
      ".jsx",
      ".js",
      ".json",
    ],
  },
  define: {
    // Several React Native libraries reference this global at runtime.
    __DEV__: JSON.stringify(process.env.NODE_ENV !== "production"),
  },
  server: {
    port: 5173,
  },
});
