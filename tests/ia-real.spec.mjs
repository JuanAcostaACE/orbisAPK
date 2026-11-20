import { test, expect } from "@playwright/test";
import { INTERVALO_SONDEO_MS, TIEMPO_MAX_ANALISIS_MS } from "../www/js/config.js";

// Análisis REAL en modo conectado, con el backend SIMULADO por page.route (no se usa producción).
// El contrato replicado es el de POST/GET /api/v1/dispositivos/capturas.
const BACKEND = "https://orbisbackend-production.up.railway.app";
const CORS = {
  "Access-Control-Allow-Origin": "http://localhost:8090",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Headers": "Content-Type, X-XSRF-TOKEN, Authorization, X-Capture-Id",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};
const TOKEN = "tok-ia-real-prueba-0123456789";
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const AVISO = "Detecta objetos de 80 categorías. No mide distancias ni garantiza que el camino esté libre.";

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
  await page.goto("/index.html");
  await page.locator("#correo").fill("ana@test.com");
  await page.locator("#contrasena").fill("clave-segura-1");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.locator("h1")).toHaveText("Hola");
}

// Fotografía grande con ruido (como una foto de móvil, aunque más pequeña) generada en el navegador.
async function fotoGrande(page, ancho = 1600, alto = 1200) {
  const base64 = await page.evaluate(async ([w, h]) => {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");
    const datos = g.createImageData(w, h);
    for (let i = 0; i < datos.data.length; i += 4) {
      datos.data[i] = Math.random() * 255; datos.data[i + 1] = Math.random() * 255;
      datos.data[i + 2] = Math.random() * 255; datos.data[i + 3] = 255;
    }
    g.putImageData(datos, 0, 0);
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.95));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let t = "";
    for (let i = 0; i < bytes.length; i += 0x8000) t += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(t);
  }, [ancho, alto]);
  return { name: "foto.jpg", mimeType: "image/jpeg", buffer: Buffer.from(base64, "base64") };
}

// Backend de capturas simulado. secuencia: estados que devuelve cada GET (el último se repite).
function simularCapturas(page, { subida = null, secuencia, lista = null } = {}) {
  const visto = { posts: [], gets: 0, listados: 0 };
  page.route(/\/api\/v1\/dispositivos\/capturas(\/[^?]*)?(\?.*)?$/, (r) => {
    const req = r.request();
    if (req.method() === "OPTIONS") return r.fulfill(preflight());
    const url = new URL(req.url());
    if (req.method() === "POST") {
      const h = req.headers();
      const cuerpo = req.postDataBuffer();
      visto.posts.push({ tipo: h["content-type"], id: h["x-capture-id"], auth: h["authorization"], cuerpo });
      if (subida) return r.fulfill(json(subida, { error: "X" }));
      return r.fulfill(json(202, { captureId: h["x-capture-id"], estado: "RECIBIDA", duplicada: false }));
    }
    if (url.pathname.endsWith("/capturas")) {
      visto.listados += 1;
      return lista ? r.fulfill(json(lista.status, lista.cuerpo)) : r.fulfill(json(404, {}));
    }
    const id = decodeURIComponent(url.pathname.split("/").pop());
    const paso = secuencia[Math.min(visto.gets, secuencia.length - 1)];
    visto.gets += 1;
    return r.fulfill(json(200, { captureId: id, duplicada: false, descripcion: null, etiquetas: [], motivoFallo: null, ...paso }));
  });
  return visto;
}

const DESCRITA = { estado: "DESCRITA", descripcion: "Hay un inodoro.", etiquetas: ["inodoro"] };

test.describe("análisis real (modo conectado)", () => {
  test("constantes de sondeo: 1,5 s y máximo 30 s", () => {
    expect(INTERVALO_SONDEO_MS).toBe(1500);
    expect(TIEMPO_MAX_ANALISIS_MS).toBe(30_000);
  });

  test("sube JPEG reducido, sondea RECIBIDA -> EN_PROCESO -> DESCRITA y muestra el resultado real", async ({ page }) => {
    await page.addInitScript(ESPIA_VOZ);
    const visto = simularCapturas(page, {
      secuencia: [{ estado: "RECIBIDA" }, { estado: "EN_PROCESO" }, DESCRITA],
    });
    await iniciarSesion(page);
    await page.locator("input[type=file]").setInputFiles(await fotoGrande(page));

    await expect(page.locator("h1")).toHaveText("Resultado");
    await expect(page.locator(".insignia", { hasText: "Descripción lista" })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".insignia", { hasText: "Análisis real (YOLOX-Nano)" })).toBeVisible();
    await expect(page.getByText("Simulada")).toHaveCount(0);
    await expect(page.getByText("Hay un inodoro.")).toBeVisible();
    await expect(page.locator("li", { hasText: "inodoro" })).toBeVisible();
    await expect(page.getByText(AVISO)).toBeVisible();
    await expect(page.getByText("camino despejado")).toHaveCount(0);

    // Una sola subida con la cabecera y el cuerpo correctos.
    expect(visto.posts).toHaveLength(1);
    const p = visto.posts[0];
    expect(p.tipo).toBe("image/jpeg");
    expect(p.id).toMatch(UUID_V4);
    expect(p.auth).toBe(`Bearer ${TOKEN}`);
    expect([p.cuerpo[0], p.cuerpo[1]]).toEqual([0xff, 0xd8]);
    expect([p.cuerpo.at(-2), p.cuerpo.at(-1)]).toEqual([0xff, 0xd9]);
    expect(p.cuerpo.length).toBeLessThanOrEqual(480 * 1024);
    expect(p.cuerpo.length).toBeGreaterThanOrEqual(5 * 1024);
    expect(visto.gets).toBe(3);

    // La voz lee la descripción real.
    await expect.poll(() => page.evaluate(() => window.__voz.dichos)).toContain("Hay un inodoro.");

    // Solo metadatos locales: sin bytes de imagen, simulado=false, origen real.
    const almacen = await page.evaluate(() => localStorage.getItem("orbis.estado.v1"));
    expect(almacen.length).toBeLessThan(3000);
    expect(almacen).not.toContain("/9j/");
    expect(almacen).not.toContain(TOKEN);
    const captura = JSON.parse(almacen).capturas[0];
    expect(captura).toMatchObject({ id: p.id, origen: "real", simulado: false, estado: "DESCRITA", descripcion: "Hay un inodoro.", etiquetas: ["inodoro"] });
  });

  test("sin etiquetas: muestra la descripción del servidor tal cual y nunca dice camino despejado", async ({ page }) => {
    const texto = "No pude identificar objetos con seguridad en esta imagen.";
    simularCapturas(page, { secuencia: [{ estado: "DESCRITA", descripcion: texto, etiquetas: [] }] });
    await iniciarSesion(page);
    await page.locator("input[type=file]").setInputFiles(await fotoGrande(page, 900, 700));
    await expect(page.getByText(texto)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "Elementos reconocidos" })).toHaveCount(0);
    await expect(page.getByText(AVISO)).toBeVisible();
    await expect(page.getByText(/despejado/i)).toHaveCount(0);
  });

  for (const [motivo, mensaje] of [
    ["IMAGEN_NO_DECODIFICABLE", "No pude leer la fotografía. Prueba con otra."],
    ["IA_NO_DISPONIBLE", "El análisis no está disponible ahora. Inténtalo de nuevo en un momento."],
    ["ERROR_INFERENCIA", "El análisis no está disponible ahora. Inténtalo de nuevo en un momento."],
    ["IMAGEN_CADUCADA", "No se pudo analizar la fotografía. Inténtalo de nuevo."],
  ]) {
    test(`FALLIDA (${motivo}): mensaje por motivo, sin descripción inventada y con reintento`, async ({ page }) => {
      simularCapturas(page, { secuencia: [{ estado: "FALLIDA", motivoFallo: motivo }] });
      await iniciarSesion(page);
      await page.locator("input[type=file]").setInputFiles(await fotoGrande(page, 900, 700));
      await expect(page.getByRole("alert")).toContainText(mensaje, { timeout: 10_000 });
      await expect(page.locator(".insignia", { hasText: "No se pudo analizar" })).toBeVisible();
      await expect(page.locator("#t-descripcion")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Intentar de nuevo" })).toBeVisible();
    });
  }

  test("413 y 422 se muestran con mensajes en español y no se sondea", async ({ page }) => {
    for (const [estado, mensaje] of [[413, "La fotografía es demasiado grande"], [422, "No pude leer la fotografía. Inténtalo de nuevo."]]) {
      const visto = simularCapturas(page, { subida: estado, secuencia: [DESCRITA] });
      await iniciarSesion(page);
      await page.locator("input[type=file]").setInputFiles(await fotoGrande(page, 900, 700));
      await expect(page.getByRole("alert")).toContainText(mensaje, { timeout: 10_000 });
      expect(visto.gets).toBe(0);
      await page.unrouteAll({ behavior: "ignoreErrors" });
      await page.goto("about:blank");
    }
  });

  test("401 al subir: vuelve a acceso con aviso de sesión caducada", async ({ page }) => {
    simularCapturas(page, { subida: 401, secuencia: [DESCRITA] });
    await iniciarSesion(page);
    await page.locator("input[type=file]").setInputFiles(await fotoGrande(page, 900, 700));
    await expect(page.locator("h1")).toHaveText("Iniciar sesión");
    await expect(page.locator("#anuncios")).toContainText("Tu sesión ha caducado");
  });

  test("tiempo agotado a los 30 s: mensaje honesto, sin resultado inventado", async ({ page }) => {
    await page.clock.install();
    const visto = simularCapturas(page, { secuencia: [{ estado: "EN_PROCESO" }] });
    await iniciarSesion(page);
    await page.locator("input[type=file]").setInputFiles(await fotoGrande(page, 900, 700));
    await expect(page.locator("h1")).toHaveText("Resultado");
    const mensaje = page.getByText("El análisis está tardando más de lo normal. Puedes volver a intentarlo.");
    for (let i = 0; i < 60 && !(await mensaje.isVisible()); i += 1) {
      await page.clock.runFor(INTERVALO_SONDEO_MS);
      await page.waitForTimeout(40);
    }
    await expect(mensaje).toBeVisible();
    expect(visto.gets).toBeGreaterThanOrEqual(TIEMPO_MAX_ANALISIS_MS / INTERVALO_SONDEO_MS - 2);
    expect(visto.gets).toBeLessThanOrEqual(TIEMPO_MAX_ANALISIS_MS / INTERVALO_SONDEO_MS + 1);
    await expect(page.locator("#t-descripcion")).toHaveCount(0);
    await expect(page.locator(".insignia", { hasText: "Descripción lista" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Consultar de nuevo" })).toBeVisible();
  });
});

test.describe("historial con análisis real", () => {
  test("listado 404: degrada a las capturas locales sin errores alarmantes", async ({ page }) => {
    simularCapturas(page, { secuencia: [DESCRITA] });
    await iniciarSesion(page);
    await page.locator("input[type=file]").setInputFiles(await fotoGrande(page, 900, 700));
    await expect(page.getByText("Hay un inodoro.")).toBeVisible({ timeout: 10_000 });
    await page.evaluate(() => { location.hash = "#/historial"; });
    await expect(page.locator("h1")).toHaveText("Historial");
    await expect(page.locator("ul[aria-label='Capturas guardadas']")).toContainText("Hay un inodoro.");
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("listado del servidor: muestra capturas remotas y el detalle se abre sin copia local", async ({ page }) => {
    const remota = "7d9f1c52-3a64-4b8e-9c10-5e2f8a1b4d63";
    simularCapturas(page, {
      secuencia: [{ estado: "DESCRITA", descripcion: "Hay una silla.", etiquetas: ["silla"] }],
      lista: { status: 200, cuerpo: { contenido: [{ captureId: remota, estado: "DESCRITA", descripcion: "Hay una silla.", etiquetas: ["silla"], motivoFallo: null, recibidaEn: "2026-11-19T10:00:00Z" }], pagina: 0 } },
    });
    await iniciarSesion(page);
    await page.evaluate(() => { location.hash = "#/historial"; });
    const fila = page.locator("ul[aria-label='Capturas analizadas en la nube']");
    await expect(fila).toContainText("Hay una silla.");
    await fila.getByRole("link").click();
    await expect(page.locator("h1")).toHaveText("Resultado");
    await expect(page.getByText("Hay una silla.").first()).toBeVisible();
    await expect(page.locator("li", { hasText: "silla" })).toBeVisible();
    await expect(page.locator(".insignia", { hasText: "Análisis real (YOLOX-Nano)" })).toBeVisible();
  });
});

test.describe("reducción de imagen en el teléfono", () => {
  test("3000x2000 con ruido sale <= 480 KB, JPEG válido y <= 800 px", async ({ page }) => {
    await page.goto("/index.html");
    const r = await page.evaluate(async () => {
      const { prepararFotografia } = await import("/js/imagen.js");
      const c = document.createElement("canvas");
      c.width = 3000; c.height = 2000;
      const g = c.getContext("2d");
      const d = g.createImageData(3000, 2000);
      for (let i = 0; i < d.data.length; i += 4) {
        d.data[i] = Math.random() * 255; d.data[i + 1] = Math.random() * 255; d.data[i + 2] = Math.random() * 255; d.data[i + 3] = 255;
      }
      g.putImageData(d, 0, 0);
      const original = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.95));
      const salida = await prepararFotografia(new File([original], "grande.jpg", { type: "image/jpeg" }));
      const bytes = new Uint8Array(await salida.arrayBuffer());
      const bmp = await createImageBitmap(salida);
      return { original: original.size, tamano: salida.size, tipo: salida.type, ini: [bytes[0], bytes[1]], fin: [bytes.at(-2), bytes.at(-1)], ancho: bmp.width, alto: bmp.height };
    });
    expect(r.original).toBeGreaterThan(1_000_000);
    expect(r.tamano).toBeLessThanOrEqual(480 * 1024);
    expect(r.tamano).toBeGreaterThanOrEqual(5 * 1024);
    expect(r.tipo).toBe("image/jpeg");
    expect(r.ini).toEqual([0xff, 0xd8]);
    expect(r.fin).toEqual([0xff, 0xd9]);
    expect(Math.max(r.ancho, r.alto)).toBeLessThanOrEqual(800);
  });

  test("una imagen diminuta (< 5 KB) da un error claro", async ({ page }) => {
    await page.goto("/index.html");
    const mensaje = await page.evaluate(async () => {
      const { prepararFotografia } = await import("/js/imagen.js");
      const c = document.createElement("canvas");
      c.width = 40; c.height = 40;
      c.getContext("2d").fillRect(0, 0, 40, 40);
      const blob = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.9));
      try { await prepararFotografia(new File([blob], "mini.jpg", { type: "image/jpeg" })); return null; } catch (e) { return e.message; }
    });
    expect(mensaje).toContain("demasiado pequeña");
  });
});
