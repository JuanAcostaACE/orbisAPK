import { test, expect } from "@playwright/test";

// Pruebas del flujo de token (Authorization: Bearer) con backend SIMULADO por page.route. No usan ORBIS real.
const CORS = {
  "Access-Control-Allow-Origin": "http://localhost:8090",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Headers": "Content-Type, X-XSRF-TOKEN, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};
const URL_BACKEND = "https://orbisbackend-production.up.railway.app";
const TOKEN = "tok-sesion-prueba-abcdef-0123456789";
const RESPUESTA_TOKEN = { accessToken: TOKEN, tokenType: "Bearer", expiresIn: 28800, correo: "ana@test.com", nombre: "Ana" };

const json = (status, cuerpo) => ({ status, headers: CORS, contentType: "application/json", body: JSON.stringify(cuerpo) });

async function abrirAcceso(page) {
  await page.goto("/index.html");
  await expect(page.locator("h1")).toHaveText("Iniciar sesión");
}

async function escribirCredenciales(page) {
  await page.locator("#correo").fill("ana@test.com");
  await page.locator("#contrasena").fill("clave-segura-1");
  await page.getByRole("button", { name: "Entrar" }).click();
}

// Devuelve el token de prueba en todos los almacenes del navegador para comprobar que no aparece.
async function volcadoAlmacenamiento(page) {
  return page.evaluate(() => {
    const valores = [];
    for (const almacen of [localStorage, sessionStorage]) {
      for (let i = 0; i < almacen.length; i += 1) {
        const clave = almacen.key(i);
        valores.push(clave, almacen.getItem(clave));
      }
    }
    return valores.join("\n");
  });
}

test.describe("token de acceso", () => {
  test("login correcto: guarda el token en memoria y lo envía como Bearer en la siguiente llamada", async ({ page }) => {
    const cabeceras = {};
    await page.route(`${URL_BACKEND}/auth/token`, async (r) => {
      cabeceras.login = r.request().headers()["authorization"] ?? null;
      await r.fulfill(json(200, RESPUESTA_TOKEN));
    });
    await page.route(`${URL_BACKEND}/auth/token/yo`, async (r) => {
      cabeceras.yo = r.request().headers()["authorization"] ?? null;
      await r.fulfill(json(200, { correo: "ana@test.com" }));
    });
    await page.route(`${URL_BACKEND}/api/v1/eventos*`, async (r) => {
      cabeceras.eventos = r.request().headers()["authorization"] ?? null;
      await r.fulfill(json(200, { contenido: [], pagina: 0 }));
    });
    await page.route(/\/api\/v1\/dispositivos\/capturas(\?.*)?$/,(r) => r.fulfill(json(404, {})));
    await abrirAcceso(page);
    await escribirCredenciales(page);
    await expect(page.locator("h1")).toHaveText("Hola");
    await expect(page.locator("#estado-conexion")).toHaveText("Conectado");

    expect(cabeceras.login).toBeNull(); // el login no envía token
    expect(cabeceras.yo).toBe(`Bearer ${TOKEN}`); // la siguiente llamada ya lo lleva

    await page.evaluate(() => { location.hash = "#/historial"; });
    await expect(page.getByRole("heading", { name: "Todavía no hay capturas" })).toBeVisible();
    expect(cabeceras.eventos).toBe(`Bearer ${TOKEN}`);
  });

  test("credenciales incorrectas: muestra el error y no inicia sesión", async ({ page }) => {
    await page.route(`${URL_BACKEND}/auth/token`, (r) => r.fulfill(json(401, { error: "CREDENCIALES_INCORRECTAS" })));
    await abrirAcceso(page);
    await escribirCredenciales(page);
    await expect(page.getByRole("alert").filter({ hasText: "No se pudo iniciar sesión" })).toContainText("Correo o contraseña incorrectos.");
    await expect(page.locator("h1")).toHaveText("Iniciar sesión");
    await expect(page.locator("#barra")).toBeHidden();
    expect(await volcadoAlmacenamiento(page)).not.toContain(TOKEN);
  });

  test("401 en /auth/token/yo: no inicia sesión, borra el token y muestra el aviso en acceso", async ({ page }) => {
    await page.route(`${URL_BACKEND}/auth/token`, (r) => r.fulfill(json(200, RESPUESTA_TOKEN)));
    await page.route(`${URL_BACKEND}/auth/token/yo`, (r) => r.fulfill(json(401, {})));
    await abrirAcceso(page);
    await escribirCredenciales(page);
    await expect(page.getByRole("alert").filter({ hasText: "No se pudo iniciar sesión" })).toContainText("Tu sesión ha caducado");
    await expect(page.locator("h1")).toHaveText("Iniciar sesión");
    await expect(page.locator("#barra")).toBeHidden();
  });

  test("logout llama a /auth/token/logout con Bearer, borra la sesión y vuelve al acceso", async ({ page }) => {
    let cabeceraLogout = null;
    let llamadasLogout = 0;
    await page.route(`${URL_BACKEND}/auth/token`, (r) => r.fulfill(json(200, RESPUESTA_TOKEN)));
    await page.route(`${URL_BACKEND}/auth/token/yo`, (r) => r.fulfill(json(200, { correo: "ana@test.com" })));
    await page.route(`${URL_BACKEND}/auth/token/logout`, async (r) => {
      llamadasLogout += 1;
      cabeceraLogout = r.request().headers()["authorization"] ?? null;
      await r.fulfill({ status: 204, headers: CORS, body: "" });
    });
    await abrirAcceso(page);
    await escribirCredenciales(page);
    await expect(page.locator("h1")).toHaveText("Hola");
    await page.locator("#barra").getByRole("link", { name: "Ajustes" }).click();
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page.locator("h1")).toHaveText("Iniciar sesión");
    expect(llamadasLogout).toBe(1);
    expect(cabeceraLogout).toBe(`Bearer ${TOKEN}`);
    expect(await volcadoAlmacenamiento(page)).not.toContain(TOKEN);
  });

  test("logout sin red: igualmente borra la sesión local y vuelve al acceso", async ({ page }) => {
    await page.route(`${URL_BACKEND}/auth/token`, (r) => r.fulfill(json(200, RESPUESTA_TOKEN)));
    await page.route(`${URL_BACKEND}/auth/token/yo`, (r) => r.fulfill(json(200, { correo: "ana@test.com" })));
    await page.route(`${URL_BACKEND}/auth/token/logout`, (r) => r.abort("connectionrefused"));
    await abrirAcceso(page);
    await escribirCredenciales(page);
    await expect(page.locator("h1")).toHaveText("Hola");
    await page.locator("#barra").getByRole("link", { name: "Ajustes" }).click();
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page.locator("h1")).toHaveText("Iniciar sesión");
    expect(await volcadoAlmacenamiento(page)).not.toContain(TOKEN);
  });

  test("el token no aparece en localStorage, sessionStorage ni en la URL", async ({ page }) => {
    await page.route(`${URL_BACKEND}/auth/token`, (r) => r.fulfill(json(200, RESPUESTA_TOKEN)));
    await page.route(`${URL_BACKEND}/auth/token/yo`, (r) => r.fulfill(json(200, { correo: "ana@test.com" })));
    await abrirAcceso(page);
    await escribirCredenciales(page);
    await expect(page.locator("h1")).toHaveText("Hola");
    expect(await volcadoAlmacenamiento(page)).not.toContain(TOKEN);
    expect(page.url()).not.toContain(TOKEN);
  });

  test("recargar en el navegador pierde la sesión: vuelve a acceso con aviso y sin token", async ({ page }) => {
    const cabeceras = [];
    await page.route(`${URL_BACKEND}/auth/token`, (r) => r.fulfill(json(200, RESPUESTA_TOKEN)));
    await page.route(`${URL_BACKEND}/auth/token/yo`, (r) => r.fulfill(json(200, { correo: "ana@test.com" })));
    await page.route(`${URL_BACKEND}/api/v1/eventos*`, (r) => {
      cabeceras.push(r.request().headers()["authorization"] ?? null);
      return r.fulfill(json(200, { contenido: [], pagina: 0 }));
    });
    await abrirAcceso(page);
    await escribirCredenciales(page);
    await expect(page.locator("h1")).toHaveText("Hola");
    await page.reload();
    await expect(page.locator("h1")).toHaveText("Iniciar sesión");
    await expect(page.locator("#anuncios")).toContainText("Inicia sesión de nuevo");
    await page.evaluate(() => { location.hash = "#/historial"; });
    await expect(page.locator("h1")).toHaveText("Iniciar sesión");
    expect(cabeceras).toEqual([]); // sin token no se llama a ninguna ruta protegida
  });
});
