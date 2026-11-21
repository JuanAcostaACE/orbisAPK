// Genera capturas de las pantallas principales en tamaño de teléfono (390x844).
// Son capturas del NAVEGADOR con el mismo código de la app, no del APK en un dispositivo.
import { test, expect } from "@playwright/test";
import path from "node:path";

const DIR = path.resolve("docs/capturas");
test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

// JPEG real generado en el navegador (imagen sintética, no una fotografía de un entorno real).
async function testJpeg(page) {
  const base64 = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 640; c.height = 480;
    const g = c.getContext("2d");
    g.fillStyle = "#4a7c59"; g.fillRect(0, 0, 640, 480);
    g.fillStyle = "#6b4f2a"; g.fillRect(180, 120, 280, 300);
    g.fillStyle = "#c9a227"; g.fillRect(260, 240, 40, 40);
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.9));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let text = "";
    for (const b of bytes) text += String.fromCharCode(b);
    return btoa(text);
  });
  return Buffer.from(base64, "base64");
}

test("capturas de pantallas principales", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/index.html#/login");
  await expect(page.locator("h1")).toHaveText("Iniciar sesión");
  await page.screenshot({ path: path.join(DIR, "01-inicio-sesion.png"), fullPage: true });

  await page.getByRole("button", { name: /modo demostración/ }).click();
  await expect(page.getByRole("button", { name: /Describir el entorno/ })).toBeVisible();
  await page.screenshot({ path: path.join(DIR, "02-inicio-principal.png"), fullPage: true });

  const JPEG = await testJpeg(page);
  await page.locator("input[type=file]").setInputFiles({ name: "foto-prueba.jpg", mimeType: "image/jpeg", buffer: JPEG });
  await expect(page.locator(".badge", { hasText: "Descripción lista" })).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: path.join(DIR, "03-resultado.png"), fullPage: true });

  await page.goto("/index.html#/history");
  await expect(page.locator("h1")).toHaveText("Historial");
  await page.screenshot({ path: path.join(DIR, "04-historial.png"), fullPage: true });

  await page.goto("/index.html#/cane");
  await expect(page.locator("h1")).toHaveText("Bastón");
  await page.screenshot({ path: path.join(DIR, "05-baston.png"), fullPage: true });

  await page.goto("/index.html#/assistant");
  await expect(page.locator("h1")).toHaveText("Auxiliar");
  await page.screenshot({ path: path.join(DIR, "06-auxiliar.png"), fullPage: true });

  await page.goto("/index.html#/settings");
  await expect(page.locator("h1")).toHaveText("Configuración");
  await page.screenshot({ path: path.join(DIR, "07-configuracion.png"), fullPage: true });
});
