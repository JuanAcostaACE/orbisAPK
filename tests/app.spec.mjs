import { test, expect } from "@playwright/test";

// Backend simulado (no es ORBIS real): respuestas que replican los contratos de orbisBackend.
const CORS = {
  "Access-Control-Allow-Origin": "http://localhost:8090",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Headers": "Content-Type, X-XSRF-TOKEN, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

// Token de prueba del backend simulado (no es un secreto real). Debe verse solo en la cabecera Authorization.
const TOKEN_PRUEBA = "tok-prueba-8caracteres-0123456789";

// Inicio de sesión con el flujo de token (POST /auth/token + GET /auth/token/yo simulados).
async function iniciarSesionSimulada(page) {
  await page.route("http://localhost:8080/auth/token", (r) =>
    r.fulfill({ status: 200, headers: CORS, contentType: "application/json", body: JSON.stringify({ accessToken: TOKEN_PRUEBA, tokenType: "Bearer", expiresIn: 28800, correo: "ana@test.com", nombre: "Ana" }) }));
  await page.route("http://localhost:8080/auth/token/yo", (r) =>
    r.fulfill({ status: 200, headers: CORS, contentType: "application/json", body: JSON.stringify({ correo: "ana@test.com" }) }));
  await pantalla(page);
  await page.locator("#correo").fill("ana@test.com");
  await page.locator("#contrasena").fill("clave-segura-1");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.locator("h1")).toHaveText("Hola");
}

// Espía de voz: registra cada utterance y permite comprobar cancelaciones.
// speechSynthesis es una propiedad de solo lectura en el navegador: se redefine con defineProperty.
const ESPIA_VOZ = () => {
  window.__voz = { dichos: [], cancelaciones: 0 };
  class FakeUtterance { constructor(t) { this.text = t; this.lang = ""; this.rate = 1; } }
  window.SpeechSynthesisUtterance = FakeUtterance;
  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    value: {
      speak(u) { window.__voz.dichos.push(u.text); },
      cancel() { window.__voz.cancelaciones += 1; },
    },
  });
};

async function pantalla(page) {
  await page.goto("/index.html");
  await expect(page.locator("h1").first()).toBeVisible();
}

test.describe("acceso", () => {
  test("sin sesión redirige a iniciar sesión y oculta la navegación", async ({ page }) => {
    await page.goto("/index.html");
    await expect(page.locator("h1")).toHaveText("Iniciar sesión");
    await expect(page.locator("#barra")).toBeHidden();
  });

  test("validación del inicio de sesión: errores asociados al campo", async ({ page }) => {
    await pantalla(page);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.locator("#correo-error")).toHaveText("Escribe un correo válido.");
    await expect(page.locator("#correo")).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#contrasena-error")).toHaveText("Escribe tu contraseña.");
  });

  test("registro: contraseñas distintas se rechazan", async ({ page }) => {
    await page.goto("/index.html#/registro");
    await page.locator("#nombre").fill("Ana");
    await page.locator("#correo").fill("ana@test.com");
    await page.locator("#contrasena").fill("clave-segura-1");
    await page.locator("#confirmar").fill("otra-clave-2");
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page.locator("#confirmar-error")).toHaveText("Las contraseñas no coinciden.");
  });

  test("mostrar y ocultar contraseña cambia el tipo de campo", async ({ page }) => {
    await pantalla(page);
    const campo = page.locator("#contrasena");
    await expect(campo).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: /Mostrar contraseña/ }).click();
    await expect(campo).toHaveAttribute("type", "text");
  });

  test("inicio de sesión correcto contra backend simulado", async ({ page }) => {
    await iniciarSesionSimulada(page);
    await expect(page.locator("#barra")).toBeVisible();
    await expect(page.locator("#estado-conexion")).toHaveText("Conectado");
  });

  test("credenciales incorrectas muestran un mensaje comprensible", async ({ page }) => {
    await page.route("http://localhost:8080/auth/token", (r) =>
      r.fulfill({ status: 401, headers: CORS, contentType: "application/json", body: JSON.stringify({ error: "CREDENCIALES_INCORRECTAS" }) }));
    await pantalla(page);
    await page.locator("#correo").fill("ana@test.com");
    await page.locator("#contrasena").fill("mal");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "No se pudo iniciar sesión" })).toContainText("Correo o contraseña incorrectos.");
  });

  test("sin backend: error de conexión comprensible, no se inventa un éxito", async ({ page }) => {
    await page.route("http://localhost:8080/**", (r) => r.abort("connectionrefused"));
    await pantalla(page);
    await page.locator("#correo").fill("ana@test.com");
    await page.locator("#contrasena").fill("clave-segura-1");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.locator(".mensaje-error")).toContainText("No hay conexión con ORBIS");
    await expect(page.locator("h1")).toHaveText("Iniciar sesión");
  });

  // Adaptada al flujo de token: antes simulaba una cookie (/auth/me). Ahora el 401 llega en una llamada autenticada.
  test("sesión expirada vuelve al acceso con aviso", async ({ page }) => {
    await page.route("http://localhost:8080/api/v1/eventos*", (r) =>
      r.fulfill({ status: 401, headers: CORS, contentType: "application/json", body: "{}" }));
    await iniciarSesionSimulada(page);
    await page.evaluate(() => { location.hash = "#/historial"; });
    await expect(page.locator("h1")).toHaveText("Iniciar sesión");
    await expect(page.locator("#anuncios")).toContainText("Tu sesión ha caducado");
  });
});

test.describe("modo demostración", () => {
  test("entrar en demostración y mostrar aviso de simulado", async ({ page }) => {
    await pantalla(page);
    await page.getByRole("button", { name: /modo demostración/ }).click();
    await expect(page.locator("#estado-conexion")).toHaveText("Demostración");
    await expect(page.getByText("Modo demostración", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Describir el entorno/ })).toBeVisible();
  });

  test("selección de fotografía: estados visibles y resultado etiquetado como simulado", async ({ page }) => {
    await page.addInitScript(ESPIA_VOZ);
    await page.goto("/index.html#/login");
    await page.getByRole("button", { name: /modo demostración/ }).click();
    await page.locator("input[type=file]").setInputFiles({
      name: "foto.jpg", mimeType: "image/jpeg",
      buffer: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(6000, 1), Buffer.from([0xff, 0xd9])]),
    });
    await expect(page.locator(".insignia", { hasText: "Descripción lista" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Simulada").first()).toBeVisible();
    await expect(page.getByRole("note")).toContainText("esta descripción es simulada");
    await expect(page.getByText("No se han detectado alertas", { exact: false })).toBeVisible();
  });

  test("voz: se lee el resultado al terminar y 'Detener' cancela", async ({ page }) => {
    await page.addInitScript(ESPIA_VOZ);
    await page.goto("/index.html#/login");
    await page.getByRole("button", { name: /modo demostración/ }).click();
    await page.locator("input[type=file]").setInputFiles({
      name: "foto.jpg", mimeType: "image/jpeg",
      buffer: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(6000, 1), Buffer.from([0xff, 0xd9])]),
    });
    await expect(page.locator(".insignia", { hasText: "Descripción lista" })).toBeVisible({ timeout: 10_000 });
    await expect.poll(() => page.evaluate(() => window.__voz.dichos.length)).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Detener" }).click();
    await expect.poll(() => page.evaluate(() => window.__voz.cancelaciones)).toBeGreaterThan(0);
  });

  test("voz: 'Escuchar de nuevo' interrumpe con prioridad alta", async ({ page }) => {
    await page.addInitScript(ESPIA_VOZ);
    await page.goto("/index.html#/login");
    await page.getByRole("button", { name: /modo demostración/ }).click();
    await page.locator("input[type=file]").setInputFiles({
      name: "foto.jpg", mimeType: "image/jpeg",
      buffer: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(6000, 1), Buffer.from([0xff, 0xd9])]),
    });
    await expect(page.locator(".insignia", { hasText: "Descripción lista" })).toBeVisible({ timeout: 10_000 });
    const antes = await page.evaluate(() => window.__voz.cancelaciones);
    await page.getByRole("button", { name: "Escuchar la descripción de nuevo" }).click();
    await expect.poll(() => page.evaluate(() => window.__voz.cancelaciones)).toBeGreaterThan(antes);
  });

  test("bastón y auxiliar: sin datos inventados ni controles activos", async ({ page }) => {
    await pantalla(page);
    await page.getByRole("button", { name: /modo demostración/ }).click();
    await page.goto("/index.html#/baston");
    await expect(page.getByText("No conectado")).toBeVisible();
    await expect(page.getByRole("button", { name: /Generar código de vinculación/ })).toBeDisabled();
    await page.goto("/index.html#/auxiliar");
    await expect(page.getByRole("button", { name: /Invitar a un auxiliar/ })).toBeDisabled();
    await expect(page.getByText("todavía no está disponible", { exact: false })).toBeVisible();
  });

  test("historial vacío muestra estado vacío con acción", async ({ page }) => {
    await pantalla(page);
    await page.getByRole("button", { name: /modo demostración/ }).click();
    await page.goto("/index.html#/historial");
    await expect(page.getByRole("heading", { name: "Todavía no hay capturas" })).toBeVisible();
  });
});

test.describe("historial conectado", () => {
  // Adaptada al flujo de token: la sesión se inicia en la app y el historial debe enviar el Bearer.
  test("lista eventos reales del backend simulado", async ({ page }) => {
    let cabeceraAutorizacion = null;
    await page.route("http://localhost:8080/api/v1/eventos*", (r) => {
      cabeceraAutorizacion = r.request().headers()["authorization"] ?? null;
      return r.fulfill({ status: 200, headers: CORS, contentType: "application/json", body: JSON.stringify({ contenido: [{ id: 1, modo: "PASIVO", distanciaCm: 42, fechaHora: "2026-11-17T10:00:00" }], pagina: 0 }) });
    });
    await iniciarSesionSimulada(page);
    await page.evaluate(() => { location.hash = "#/historial"; });
    await expect(page.getByText("Evento PASIVO: 42 cm.")).toBeVisible();
    expect(cabeceraAutorizacion).toBe(`Bearer ${TOKEN_PRUEBA}`);
  });
});

test.describe("diseño y accesibilidad", () => {
  for (const [ancho, alto] of [[360, 640], [390, 844], [768, 1024], [1280, 800]]) {
    test(`sin desplazamiento horizontal a ${ancho}px`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: alto });
      await page.addInitScript(ESPIA_VOZ);
      await page.goto("/index.html#/login");
      await page.getByRole("button", { name: /modo demostración/ }).click();
      await page.goto("/index.html#/inicio");
      const desbordado = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(desbordado).toBe(false);
    });
  }

  test("movimiento reducido: la pantalla carga sin animaciones de error", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errores = [];
    page.on("pageerror", (e) => errores.push(e.message));
    await pantalla(page);
    expect(errores).toEqual([]);
  });

  // Regresión: los campos no deben tener role="alert" vacío (un lector lo anunciaría como ruido).
  test("regresión: no hay alertas vacías en el formulario de acceso", async ({ page }) => {
    await pantalla(page);
    await expect(page.locator('[role="alert"]:empty')).toHaveCount(0);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.locator("#correo-error")).not.toBeEmpty();
    await expect(page.locator('[role="alert"]:empty')).toHaveCount(0);
  });

  test("el foco llega al título al cambiar de pantalla", async ({ page }) => {
    await pantalla(page);
    await page.getByRole("button", { name: /modo demostración/ }).click();
    await page.goto("/index.html#/historial");
    await expect(page.locator("h1").first()).toBeFocused();
  });
});
