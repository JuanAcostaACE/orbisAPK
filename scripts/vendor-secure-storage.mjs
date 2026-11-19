// Copia el módulo ESM del plugin @aparajita/capacitor-secure-storage a www/vendor/secure-storage.
// La app no usa bundler: el módulo importa "@capacitor/core", que aquí se redirige al shim
// www/vendor/capacitor-core.js (que toma las piezas de window.Capacitor). Ejecutar tras cambiar la versión del plugin.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const origen = join(raiz, "node_modules/@aparajita/capacitor-secure-storage/dist/esm");
const destino = join(raiz, "www/vendor/secure-storage");

rmSync(destino, { recursive: true, force: true });
mkdirSync(destino, { recursive: true });
for (const archivo of ["index.js", "base.js", "definitions.js", "native.js", "web.js"]) {
  const codigo = readFileSync(join(origen, archivo), "utf8").replace(/(['"])@capacitor\/core\1/g, "'../capacitor-core.js'");
  writeFileSync(join(destino, archivo), codigo);
}
console.log(`Plugin vendorizado en ${destino}`);
