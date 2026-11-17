// Pruebas de la app en navegador. Simulan el backend con page.route: no usan producción.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:8090",
    headless: true,
    screenshot: "only-on-failure",
    trace: "off",
  },
  webServer: {
    command: "python -m http.server 8090 --bind 127.0.0.1 --directory www",
    url: "http://localhost:8090/index.html",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
