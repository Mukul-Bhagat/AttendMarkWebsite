// vite.config.ts
import { defineConfig } from "file:///C:/Users/mukul/AttendanceMark/client/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/mukul/AttendanceMark/client/node_modules/@vitejs/plugin-react/dist/index.js";
var vite_config_default = defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:5001",
        changeOrigin: true,
        secure: false,
        // ✅ CRITICAL: Disable caching in Vite proxy to prevent 304 responses
        configure: (proxy, _options) => {
          proxy.on("proxyReq", (proxyReq, req, _res) => {
            proxyReq.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
            proxyReq.setHeader("Pragma", "no-cache");
            proxyReq.setHeader("Expires", "0");
            console.log("\u{1F535} [VITE PROXY]", req.method, req.url);
          });
          proxy.on("proxyRes", (proxyRes, req, _res) => {
            proxyRes.headers["cache-control"] = "no-store, no-cache, must-revalidate, proxy-revalidate";
            proxyRes.headers["pragma"] = "no-cache";
            proxyRes.headers["expires"] = "0";
            console.log("\u2705 [VITE PROXY]", req.method, req.url, "\u2192", proxyRes.statusCode);
          });
        }
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxtdWt1bFxcXFxBdHRlbmRhbmNlTWFya1xcXFxjbGllbnRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXG11a3VsXFxcXEF0dGVuZGFuY2VNYXJrXFxcXGNsaWVudFxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvbXVrdWwvQXR0ZW5kYW5jZU1hcmsvY2xpZW50L3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcclxuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xyXG5cclxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuICBwbHVnaW5zOiBbcmVhY3QoKV0sXHJcbiAgc2VydmVyOiB7XHJcbiAgICBwcm94eToge1xyXG4gICAgICAnL2FwaSc6IHtcclxuICAgICAgICB0YXJnZXQ6ICdodHRwOi8vbG9jYWxob3N0OjUwMDEnLFxyXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcclxuICAgICAgICBzZWN1cmU6IGZhbHNlLFxyXG4gICAgICAgIC8vIFx1MjcwNSBDUklUSUNBTDogRGlzYWJsZSBjYWNoaW5nIGluIFZpdGUgcHJveHkgdG8gcHJldmVudCAzMDQgcmVzcG9uc2VzXHJcbiAgICAgICAgY29uZmlndXJlOiAocHJveHksIF9vcHRpb25zKSA9PiB7XHJcbiAgICAgICAgICBwcm94eS5vbigncHJveHlSZXEnLCAocHJveHlSZXEsIHJlcSwgX3JlcykgPT4ge1xyXG4gICAgICAgICAgICAvLyBGb3JjZSBuby1jYWNoZSBoZWFkZXJzIG9uIGV2ZXJ5IHByb3hpZWQgcmVxdWVzdFxyXG4gICAgICAgICAgICBwcm94eVJlcS5zZXRIZWFkZXIoJ0NhY2hlLUNvbnRyb2wnLCAnbm8tc3RvcmUsIG5vLWNhY2hlLCBtdXN0LXJldmFsaWRhdGUnKTtcclxuICAgICAgICAgICAgcHJveHlSZXEuc2V0SGVhZGVyKCdQcmFnbWEnLCAnbm8tY2FjaGUnKTtcclxuICAgICAgICAgICAgcHJveHlSZXEuc2V0SGVhZGVyKCdFeHBpcmVzJywgJzAnKTtcclxuXHJcbiAgICAgICAgICAgIC8vIExvZyBwcm94aWVkIHJlcXVlc3RzIGZvciBkZWJ1Z2dpbmdcclxuICAgICAgICAgICAgY29uc29sZS5sb2coJ1x1RDgzRFx1REQzNSBbVklURSBQUk9YWV0nLCByZXEubWV0aG9kLCByZXEudXJsKTtcclxuICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgIHByb3h5Lm9uKCdwcm94eVJlcycsIChwcm94eVJlcywgcmVxLCBfcmVzKSA9PiB7XHJcbiAgICAgICAgICAgIC8vIE92ZXJyaWRlIHJlc3BvbnNlIGNhY2hlIGhlYWRlcnNcclxuICAgICAgICAgICAgcHJveHlSZXMuaGVhZGVyc1snY2FjaGUtY29udHJvbCddID0gJ25vLXN0b3JlLCBuby1jYWNoZSwgbXVzdC1yZXZhbGlkYXRlLCBwcm94eS1yZXZhbGlkYXRlJztcclxuICAgICAgICAgICAgcHJveHlSZXMuaGVhZGVyc1sncHJhZ21hJ10gPSAnbm8tY2FjaGUnO1xyXG4gICAgICAgICAgICBwcm94eVJlcy5oZWFkZXJzWydleHBpcmVzJ10gPSAnMCc7XHJcblxyXG4gICAgICAgICAgICAvLyBMb2cgcmVzcG9uc2Ugc3RhdHVzXHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdcdTI3MDUgW1ZJVEUgUFJPWFldJywgcmVxLm1ldGhvZCwgcmVxLnVybCwgJ1x1MjE5MicsIHByb3h5UmVzLnN0YXR1c0NvZGUpO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfSxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgfSxcclxufSlcclxuXHJcblxyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXdTLFNBQVMsb0JBQW9CO0FBQ3JVLE9BQU8sV0FBVztBQUdsQixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsTUFBTSxDQUFDO0FBQUEsRUFDakIsUUFBUTtBQUFBLElBQ04sT0FBTztBQUFBLE1BQ0wsUUFBUTtBQUFBLFFBQ04sUUFBUTtBQUFBLFFBQ1IsY0FBYztBQUFBLFFBQ2QsUUFBUTtBQUFBO0FBQUEsUUFFUixXQUFXLENBQUMsT0FBTyxhQUFhO0FBQzlCLGdCQUFNLEdBQUcsWUFBWSxDQUFDLFVBQVUsS0FBSyxTQUFTO0FBRTVDLHFCQUFTLFVBQVUsaUJBQWlCLHFDQUFxQztBQUN6RSxxQkFBUyxVQUFVLFVBQVUsVUFBVTtBQUN2QyxxQkFBUyxVQUFVLFdBQVcsR0FBRztBQUdqQyxvQkFBUSxJQUFJLDBCQUFtQixJQUFJLFFBQVEsSUFBSSxHQUFHO0FBQUEsVUFDcEQsQ0FBQztBQUVELGdCQUFNLEdBQUcsWUFBWSxDQUFDLFVBQVUsS0FBSyxTQUFTO0FBRTVDLHFCQUFTLFFBQVEsZUFBZSxJQUFJO0FBQ3BDLHFCQUFTLFFBQVEsUUFBUSxJQUFJO0FBQzdCLHFCQUFTLFFBQVEsU0FBUyxJQUFJO0FBRzlCLG9CQUFRLElBQUksdUJBQWtCLElBQUksUUFBUSxJQUFJLEtBQUssVUFBSyxTQUFTLFVBQVU7QUFBQSxVQUM3RSxDQUFDO0FBQUEsUUFDSDtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
