import { test, expect } from "@playwright/test";

// Backend simulado (no es ORBIS real): respuestas que replican los contratos de orbisBackend.
const CORS = {
  "Access-Control-Allow-Origin": "http://localhost:8090",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Headers": "Content-Type, X-XSRF-TOKEN",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

// Espía de voz: registra cada utterance y permite comprobar cancelaciones.
// speechSynthesis es una propiedad de solo lectura en el navegador: se redefine con defineProperty.
const VOICE_SPY = () => {
  window.__voz = { spoken: [], cancellations: 0 };
  class FakeUtterance { constructor(t) { this.text = t; this.lang = ""; this.rate = 1; } }
  window.SpeechSynthesisUtterance = FakeUtterance;
  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    value: {
      speak(u) { window.__voz.spoken.push(u.text); },
      cancel() { window.__voz.cancellations += 1; },
    },
  });
};

async function screen(page) {
  await page.goto("/index.html");
  await expect(page.locator("h1").first()).toBeVisible();
}

test.describe("acceso", () => {
  test("sin sesión redirige a iniciar sesión y oculta la navegación", async ({ page }) => {
    await page.goto("/index.html");
    await expect(page.locator("h1")).toHaveText("Iniciar sesión");
    await expect(page.locator("#navbar")).toBeHidden();
  });

  test("validación del inicio de sesión: errores asociados al campo", async ({ page }) => {
    await screen(page);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.locator("#email-error")).toHaveText("Escribe un correo válido.");
    await expect(page.locator("#email")).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#password-error")).toHaveText("Escribe tu contraseña.");
  });

  test("registro: contraseñas distintas se rechazan", async ({ page }) => {
    await page.goto("/index.html#/register");
    await page.locator("#name").fill("Ana");
    await page.locator("#email").fill("ana@test.com");
    await page.locator("#password").fill("clave-segura-1");
    await page.locator("#confirm").fill("otra-clave-2");
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page.locator("#confirm-error")).toHaveText("Las contraseñas no coinciden.");
  });

  test("mostrar y ocultar contraseña cambia el tipo de campo", async ({ page }) => {
    await screen(page);
    const field = page.locator("#password");
    await expect(field).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: /Mostrar contraseña/ }).click();
    await expect(field).toHaveAttribute("type", "text");
  });

  test("inicio de sesión correcto contra backend simulado", async ({ page }) => {
    await page.route("http://localhost:8080/auth/login", (r) =>
      r.fulfill({ status: 200, headers: CORS, contentType: "application/json", body: JSON.stringify({ email: "ana@test.com", message: "Login exitoso" }) }));
    await page.route("http://localhost:8080/auth/me", (r) =>
      r.fulfill({ status: 200, headers: CORS, contentType: "application/json", body: JSON.stringify({ email: "ana@test.com" }) }));
    await screen(page);
    await page.locator("#email").fill("ana@test.com");
    await page.locator("#password").fill("clave-segura-1");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.locator("h1")).toHaveText("Hola");
    await expect(page.locator("#navbar")).toBeVisible();
    await expect(page.locator("#connection-status")).toHaveText("Conectado");
  });

  test("credenciales incorrectas muestran un mensaje comprensible", async ({ page }) => {
    await page.route("http://localhost:8080/auth/login", (r) =>
      r.fulfill({ status: 401, headers: CORS, contentType: "application/json", body: "{}" }));
    await screen(page);
    await page.locator("#email").fill("ana@test.com");
    await page.locator("#password").fill("mal");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "No se pudo iniciar sesión" })).toContainText("Correo o contraseña incorrectos.");
  });

  test("sin backend: error de conexión comprensible, no se inventa un éxito", async ({ page }) => {
    await page.route("http://localhost:8080/**", (r) => r.abort("connectionrefused"));
    await screen(page);
    await page.locator("#email").fill("ana@test.com");
    await page.locator("#password").fill("clave-segura-1");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.locator(".error-message")).toContainText("No hay conexión con ORBIS");
    await expect(page.locator("h1")).toHaveText("Iniciar sesión");
  });

  test("sesión expirada vuelve al acceso con aviso", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("orbis.state.v1", JSON.stringify({ mode: "connected", email: "ana@test.com", captures: [] }));
    });
    await page.route("http://localhost:8080/auth/me", (r) =>
      r.fulfill({ status: 401, headers: CORS, contentType: "application/json", body: "{}" }));
    await page.goto("/index.html");
    await expect(page.locator("h1")).toHaveText("Iniciar sesión");
    await expect(page.locator("#announcements")).toContainText("Tu sesión ha caducado");
  });
});

test.describe("modo demostración", () => {
  test("entrar en demostración y mostrar aviso de simulado", async ({ page }) => {
    await screen(page);
    await page.getByRole("button", { name: /modo demostración/ }).click();
    await expect(page.locator("#connection-status")).toHaveText("Demostración");
    await expect(page.getByText("Modo demostración", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Describir el entorno/ })).toBeVisible();
  });

  test("selección de fotografía: estados visibles y resultado etiquetado como simulado", async ({ page }) => {
    await page.addInitScript(VOICE_SPY);
    await page.goto("/index.html#/login");
    await page.getByRole("button", { name: /modo demostración/ }).click();
    await page.locator("input[type=file]").setInputFiles({
      name: "foto.jpg", mimeType: "image/jpeg",
      buffer: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(6000, 1), Buffer.from([0xff, 0xd9])]),
    });
    await expect(page.locator(".badge", { hasText: "Descripción lista" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Simulada").first()).toBeVisible();
    await expect(page.getByRole("note")).toContainText("esta descripción es simulada");
    await expect(page.getByText("No se han detectado alertas", { exact: false })).toBeVisible();
  });

  test("voz: se lee el resultado al terminar y 'Detener' cancela", async ({ page }) => {
    await page.addInitScript(VOICE_SPY);
    await page.goto("/index.html#/login");
    await page.getByRole("button", { name: /modo demostración/ }).click();
    await page.locator("input[type=file]").setInputFiles({
      name: "foto.jpg", mimeType: "image/jpeg",
      buffer: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(6000, 1), Buffer.from([0xff, 0xd9])]),
    });
    await expect(page.locator(".badge", { hasText: "Descripción lista" })).toBeVisible({ timeout: 10_000 });
    await expect.poll(() => page.evaluate(() => window.__voz.spoken.length)).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Detener" }).click();
    await expect.poll(() => page.evaluate(() => window.__voz.cancellations)).toBeGreaterThan(0);
  });

  test("voz: 'Escuchar de nuevo' interrumpe con prioridad alta", async ({ page }) => {
    await page.addInitScript(VOICE_SPY);
    await page.goto("/index.html#/login");
    await page.getByRole("button", { name: /modo demostración/ }).click();
    await page.locator("input[type=file]").setInputFiles({
      name: "foto.jpg", mimeType: "image/jpeg",
      buffer: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(6000, 1), Buffer.from([0xff, 0xd9])]),
    });
    await expect(page.locator(".badge", { hasText: "Descripción lista" })).toBeVisible({ timeout: 10_000 });
    const before = await page.evaluate(() => window.__voz.cancellations);
    await page.getByRole("button", { name: "Escuchar la descripción de nuevo" }).click();
    await expect.poll(() => page.evaluate(() => window.__voz.cancellations)).toBeGreaterThan(before);
  });

  test("bastón y auxiliar: sin datos inventados ni controles activos", async ({ page }) => {
    await screen(page);
    await page.getByRole("button", { name: /modo demostración/ }).click();
    await page.goto("/index.html#/cane");
    await expect(page.getByText("No conectado")).toBeVisible();
    await expect(page.getByRole("button", { name: /Generar código de vinculación/ })).toBeDisabled();
    await page.goto("/index.html#/assistant");
    await expect(page.getByRole("button", { name: /Invitar a un auxiliar/ })).toBeDisabled();
    await expect(page.getByText("todavía no está disponible", { exact: false })).toBeVisible();
  });

  test("historial vacío muestra estado vacío con acción", async ({ page }) => {
    await screen(page);
    await page.getByRole("button", { name: /modo demostración/ }).click();
    await page.goto("/index.html#/history");
    await expect(page.getByRole("heading", { name: "Todavía no hay capturas" })).toBeVisible();
  });
});

test.describe("historial conectado", () => {
  test("lista eventos reales del backend simulado", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("orbis.state.v1", JSON.stringify({ mode: "connected", email: "ana@test.com", captures: [] }));
    });
    await page.route("http://localhost:8080/auth/me", (r) =>
      r.fulfill({ status: 200, headers: CORS, contentType: "application/json", body: JSON.stringify({ email: "ana@test.com" }) }));
    await page.route("http://localhost:8080/api/v1/events*", (r) =>
      r.fulfill({ status: 200, headers: CORS, contentType: "application/json", body: JSON.stringify({ content: [{ id: 1, mode: "PASSIVE", distanceCm: 42, createdAt: "2026-11-17T10:00:00" }], page: 0 }) }));
    await page.goto("/index.html#/history");
    await expect(page.getByText("Evento PASIVO: 42 cm.")).toBeVisible();
  });
});

test.describe("diseño y accesibilidad", () => {
  for (const [width, height] of [[360, 640], [390, 844], [768, 1024], [1280, 800]]) {
    test(`sin desplazamiento horizontal a ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width: width, height: height });
      await page.addInitScript(VOICE_SPY);
      await page.goto("/index.html#/login");
      await page.getByRole("button", { name: /modo demostración/ }).click();
      await page.goto("/index.html#/home");
      const overflowing = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflowing).toBe(false);
    });
  }

  test("movimiento reducido: la pantalla carga sin animaciones de error", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await screen(page);
    expect(errors).toEqual([]);
  });

  // Regresión: los campos no deben tener role="alert" vacío (un lector lo anunciaría como ruido).
  test("regresión: no hay alertas vacías en el formulario de acceso", async ({ page }) => {
    await screen(page);
    await expect(page.locator('[role="alert"]:empty')).toHaveCount(0);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.locator("#email-error")).not.toBeEmpty();
    await expect(page.locator('[role="alert"]:empty')).toHaveCount(0);
  });

  test("el foco llega al título al cambiar de pantalla", async ({ page }) => {
    await screen(page);
    await page.getByRole("button", { name: /modo demostración/ }).click();
    await page.goto("/index.html#/history");
    await expect(page.locator("h1").first()).toBeFocused();
  });
});
