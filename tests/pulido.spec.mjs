import { test, expect } from "@playwright/test";

// Pulido de la entrega: historial del servidor, errores comprensibles, voz y accesibilidad táctil.
// Backend SIMULADO con page.route (no se usa producción).
const BACKEND = "https://orbisbackend-production.up.railway.app";
const CORS = {
  "Access-Control-Allow-Origin": "http://localhost:8090",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Headers": "Content-Type, X-XSRF-TOKEN, Authorization, X-Capture-Id",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};
const TOKEN = "tok-pulido-prueba-0123456789";
const json = (status, cuerpo) => ({ status, headers: CORS, contentType: "application/json", body: JSON.stringify(cuerpo) });
const preflight = () => ({ status: 204, headers: CORS, body: "" });

const ESPIA_VOZ = () => {
  window.__voz = { dichos: [], cancelaciones: 0 };
  class FakeUtterance { constructor(t) { this.text = t; this.lang = ""; this.rate = 1; } }
  window.SpeechSynthesisUtterance = FakeUtterance;
  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    value: { speak(u) { window.__voz.dichos.push(u.text); }, cancel() { window.__voz.cancelaciones += 1; } },
  });
};

async function iniciarSesion(page) {
  await page.route(`${BACKEND}/auth/token`, (r) =>
    r.request().method() === "OPTIONS"
      ? r.fulfill(preflight())
      : r.fulfill(json(200, { accessToken: TOKEN, tokenType: "Bearer", expiresIn: 28800, correo: "ana@test.com", nombre: "Ana" })));
  await page.route(`${BACKEND}/auth/token/yo`, (r) => r.fulfill(json(200, { correo: "ana@test.com" })));
  await page.route(`${BACKEND}/api/v1/eventos*`, (r) => r.fulfill(json(200, { contenido: [], pagina: 0 })));
}
async function entrar(page) {
  await page.goto("/index.html");
  await page.locator("#correo").fill("ana@test.com");
  await page.locator("#contrasena").fill("clave-segura-1");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.locator("h1")).toHaveText("Hola");
}
async function irA(page, hash) {
  await page.evaluate((h) => { location.hash = h; }, hash);
}

// Fotografía con ruido para que la reducción en el teléfono la acepte (>= 5 KB).
async function fotoRuido(page) {
  const base64 = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 900; c.height = 700;
    const g = c.getContext("2d");
    const d = g.createImageData(900, 700);
    for (let i = 0; i < d.data.length; i += 4) { d.data[i] = Math.random() * 255; d.data[i + 1] = Math.random() * 255; d.data[i + 2] = Math.random() * 255; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0);
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.95));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let t = "";
    for (let i = 0; i < bytes.length; i += 0x8000) t += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(t);
  });
  return { name: "foto.jpg", mimeType: "image/jpeg", buffer: Buffer.from(base64, "base64") };
}

const RUTA_CAPTURAS = /\/api\/v1\/dispositivos\/capturas(\/[^?]*)?(\?.*)?$/;
const ID1 = "7d9f1c52-3a64-4b8e-9c10-5e2f8a1b4d63";
const ID2 = "11111111-2222-4333-8444-555555555555";
const LISTA = {
  contenido: [
    { captureId: ID1, estado: "DESCRITA", descripcion: "Hay una silla y una mesa.", etiquetas: ["silla", "mesa"], motivoFallo: null, recibidaEn: "2026-11-19T10:00:00Z" },
    { captureId: ID2, estado: "FALLIDA", descripcion: null, etiquetas: [], motivoFallo: "IMAGEN_NO_DECODIFICABLE", recibidaEn: "2026-11-19T09:00:00Z" },
  ],
  totalElementos: 2, pagina: 0,
};
const POST_OK = (req) => json(202, { captureId: req.headers()["x-capture-id"], estado: "RECIBIDA", duplicada: false });

test.describe("historial del servidor", () => {
  test("pide page=0&size=20 con Bearer, muestra carga y luego las capturas reales (con motivo de fallo)", async ({ page }) => {
    await iniciarSesion(page);
    let url = null; let auth = null;
    await page.route(RUTA_CAPTURAS, async (r) => {
      if (r.request().method() === "OPTIONS") return r.fulfill(preflight());
      url = r.request().url(); auth = r.request().headers()["authorization"];
      await new Promise((x) => setTimeout(x, 600));
      return r.fulfill(json(200, LISTA));
    });
    await entrar(page);
    await irA(page, "#/historial");
    await expect(page.getByText("Cargando capturas…")).toBeVisible();
    const lista = page.locator("ul[aria-label='Capturas analizadas en la nube']");
    await expect(lista).toContainText("Hay una silla y una mesa.");
    await expect(lista).toContainText("No pude leer la fotografía. Prueba con otra.");
    await expect(lista.getByRole("link")).toHaveCount(2);
    expect(url).toContain("/api/v1/dispositivos/capturas?page=0&size=20");
    expect(auth).toBe(`Bearer ${TOKEN}`);
  });

  test("error 500: muestra lo guardado en el teléfono con aviso (sin alerta) y Reintentar recupera el servidor", async ({ page }) => {
    await iniciarSesion(page);
    let llamadas = 0;
    await page.route(RUTA_CAPTURAS, (r) => {
      if (r.request().method() === "OPTIONS") return r.fulfill(preflight());
      llamadas += 1;
      return llamadas === 1 ? r.fulfill(json(500, { error: "ERROR_INTERNO" })) : r.fulfill(json(200, LISTA));
    });
    await entrar(page);
    await irA(page, "#/historial");
    await expect(page.getByText("No se pudo cargar el historial del servidor")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Todavía no hay capturas" })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await page.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.locator("ul[aria-label='Capturas analizadas en la nube']")).toContainText("Hay una silla y una mesa.");
    expect(llamadas).toBe(2);
  });

  test("sin red: aviso de conexión y fallback al historial local", async ({ page }) => {
    await iniciarSesion(page);
    await page.route(RUTA_CAPTURAS, (r) => (r.request().method() === "OPTIONS" ? r.fulfill(preflight()) : r.abort("failed")));
    await entrar(page);
    await irA(page, "#/historial");
    await expect(page.getByText("Sin conexión: se muestran las capturas guardadas en este teléfono.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
  });

  test("servidor sin capturas y sin locales: estado vacío con acción", async ({ page }) => {
    await iniciarSesion(page);
    await page.route(RUTA_CAPTURAS, (r) => (r.request().method() === "OPTIONS" ? r.fulfill(preflight()) : r.fulfill(json(200, { contenido: [], totalElementos: 0, pagina: 0 }))));
    await entrar(page);
    await irA(page, "#/historial");
    await expect(page.getByRole("heading", { name: "Todavía no hay capturas" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ir al inicio" })).toBeVisible();
  });

  test("401 en el listado: vuelve al acceso con aviso de sesión caducada", async ({ page }) => {
    await iniciarSesion(page);
    await page.route(RUTA_CAPTURAS, (r) => (r.request().method() === "OPTIONS" ? r.fulfill(preflight()) : r.fulfill(json(401, {}))));
    await entrar(page);
    await irA(page, "#/historial");
    await expect(page.locator("h1")).toHaveText("Iniciar sesión");
    await expect(page.locator("#anuncios")).toContainText("Tu sesión ha caducado");
  });
});

test.describe("flujo foto -> resultado: errores y voz", () => {
  test("sin red al subir: mensaje claro y el reintento funciona", async ({ page }) => {
    await page.addInitScript(ESPIA_VOZ);
    await iniciarSesion(page);
    let fallar = true;
    await page.route(RUTA_CAPTURAS, (r) => {
      const req = r.request();
      if (req.method() === "OPTIONS") return r.fulfill(preflight());
      if (req.method() === "POST") return fallar ? r.abort("failed") : r.fulfill(POST_OK(req));
      return r.fulfill(json(200, { captureId: "x", estado: "DESCRITA", descripcion: "Hay una puerta.", etiquetas: ["puerta"], motivoFallo: null }));
    });
    await entrar(page);
    await page.locator("input[type=file]").setInputFiles(await fotoRuido(page));
    await expect(page.getByRole("alert")).toContainText("No hay conexión con ORBIS");
    fallar = false;
    await page.getByRole("button", { name: "Intentar de nuevo" }).click();
    await expect(page.getByText("Hay una puerta.").first()).toBeVisible({ timeout: 10_000 });
  });

  test("429 al subir: mensaje de demasiadas fotografías seguidas", async ({ page }) => {
    await iniciarSesion(page);
    await page.route(RUTA_CAPTURAS, (r) => (r.request().method() === "OPTIONS" ? r.fulfill(preflight()) : r.fulfill(json(429, {}))));
    await entrar(page);
    await page.locator("input[type=file]").setInputFiles(await fotoRuido(page));
    await expect(page.getByRole("alert")).toContainText("demasiadas fotografías seguidas");
    await expect(page.getByRole("button", { name: "Intentar de nuevo" })).toBeVisible();
  });

  test("sondeo sin red: avisa de que no hay conexión sin inventar resultado", async ({ page }) => {
    await iniciarSesion(page);
    await page.route(RUTA_CAPTURAS, (r) => {
      const req = r.request();
      if (req.method() === "OPTIONS") return r.fulfill(preflight());
      if (req.method() === "POST") return r.fulfill(POST_OK(req));
      return r.abort("failed");
    });
    await entrar(page);
    await page.locator("input[type=file]").setInputFiles(await fotoRuido(page));
    await expect(page.getByText("Sin conexión con ORBIS. Seguiré intentándolo")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("#t-descripcion")).toHaveCount(0);
  });

  test("'Repetir descripción': desactivado hasta tener descripción y luego la vuelve a leer", async ({ page }) => {
    await page.addInitScript(ESPIA_VOZ);
    await iniciarSesion(page);
    await page.route(RUTA_CAPTURAS, (r) => {
      const req = r.request();
      if (req.method() === "OPTIONS") return r.fulfill(preflight());
      if (req.method() === "POST") return r.fulfill(POST_OK(req));
      return r.fulfill(json(200, { captureId: "x", estado: "DESCRITA", descripcion: "Hay un banco.", etiquetas: ["banco"], motivoFallo: null }));
    });
    await entrar(page);
    await page.locator("input[type=file]").setInputFiles(await fotoRuido(page));
    const repetir = page.getByRole("button", { name: "Repetir la descripción en voz alta" });
    await expect(repetir).toBeDisabled();
    await expect(page.getByText("Hay un banco.").first()).toBeVisible({ timeout: 10_000 });
    await expect(repetir).toBeEnabled();
    await expect.poll(() => page.evaluate(() => window.__voz.dichos.length)).toBe(1);
    await repetir.click();
    await expect.poll(() => page.evaluate(() => window.__voz.dichos.filter((t) => t === "Hay un banco.").length)).toBe(2);
  });
});

test.describe("accesibilidad táctil y de lectores de pantalla", () => {
  test("controles interactivos de 48 px o más y con nombre accesible (inicio, historial, resultado)", async ({ page }) => {
    await page.addInitScript(ESPIA_VOZ);
    await iniciarSesion(page);
    await page.route(RUTA_CAPTURAS, (r) => {
      const req = r.request();
      if (req.method() === "OPTIONS") return r.fulfill(preflight());
      if (req.method() === "POST") return r.fulfill(POST_OK(req));
      if (new URL(req.url()).pathname.endsWith("/capturas")) return r.fulfill(json(200, LISTA));
      return r.fulfill(json(200, { captureId: ID1, estado: "DESCRITA", descripcion: "Hay un banco.", etiquetas: ["banco"], motivoFallo: null }));
    });
    await page.setViewportSize({ width: 360, height: 740 });
    await entrar(page);

    const revisar = () => page.evaluate(() => {
      const malos = [];
      for (const n of document.querySelectorAll("a[href], button, input, select, textarea")) {
        if (n.hidden || n.closest("[hidden]") || n.getAttribute("aria-hidden") === "true" || n.type === "hidden") continue;
        if (n.matches(".saltar")) continue;
        const r = n.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const nombre = (n.getAttribute("aria-label") || n.textContent || "").trim();
        if (r.height < 48 || r.width < 48) malos.push(`${n.tagName} "${nombre}" ${Math.round(r.width)}x${Math.round(r.height)}`);
        if (!nombre && !(n.labels && n.labels.length)) malos.push(`${n.tagName} sin nombre`);
      }
      return malos;
    });

    expect(await revisar()).toEqual([]);
    await irA(page, "#/historial");
    await expect(page.locator("ul[aria-label='Capturas analizadas en la nube']")).toBeVisible();
    expect(await revisar()).toEqual([]);
    await page.locator("ul[aria-label='Capturas analizadas en la nube'] a").first().click();
    await expect(page.getByText("Hay un banco.").first()).toBeVisible({ timeout: 10_000 });
    expect(await revisar()).toEqual([]);
    // Cada pantalla tiene un único h1 y el foco empieza en él.
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toBeFocused();
  });

  test("el progreso se anuncia como estado y la descripción en curso marca aria-busy", async ({ page }) => {
    await iniciarSesion(page);
    await page.route(RUTA_CAPTURAS, (r) => {
      const req = r.request();
      if (req.method() === "OPTIONS") return r.fulfill(preflight());
      if (req.method() === "POST") return r.fulfill(POST_OK(req));
      return r.fulfill(json(200, { captureId: "x", estado: "EN_PROCESO", descripcion: null, etiquetas: [], motivoFallo: null }));
    });
    await entrar(page);
    await page.locator("input[type=file]").setInputFiles(await fotoRuido(page));
    await expect(page.getByRole("status").filter({ hasText: "Analizando la fotografía…" })).toBeVisible();
    await expect(page.locator("[aria-busy='true']")).toHaveCount(1);
  });
});
