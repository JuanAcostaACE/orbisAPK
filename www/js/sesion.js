// Token de acceso de la app móvil. Reglas:
// - Nunca en la URL, en logs, en localStorage ni en sessionStorage.
// - Android (Capacitor nativo): almacenamiento seguro nativo (plugin SecureStorage, cifrado con Keystore).
// - Navegador (desarrollo y pruebas): solo en memoria del módulo. Al recargar se pierde y hay que iniciar sesión de nuevo.
// La copia en memoria es la única que usan las peticiones (tokenActual), así que nunca hace falta leer el almacenamiento en cada llamada.

const CLAVE = "orbis.token.acceso";

let tokenEnMemoria = null;
let almacenNativo = null;

export function esNativa() {
  try {
    return window.Capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

// El plugin se importa solo en la app nativa: en el navegador no se descarga.
async function almacen() {
  if (!almacenNativo) {
    const modulo = await import("../vendor/secure-storage/index.js");
    // Se envuelve: el proxy del plugin tiene un método "then" que el "await" intentaría llamar.
    almacenNativo = { plugin: modulo.SecureStorage };
  }
  return almacenNativo;
}

// Token para la cabecera Authorization (null si no hay sesión).
export function tokenActual() {
  return tokenEnMemoria;
}

// Al arrancar: en nativo recupera el token guardado. En navegador no hay nada que recuperar.
export async function cargarToken() {
  if (!esNativa()) return tokenEnMemoria;
  try {
    tokenEnMemoria = (await (await almacen()).plugin.getItem(CLAVE)) ?? null;
  } catch {
    tokenEnMemoria = null;
  }
  return tokenEnMemoria;
}

// Lanza si el almacenamiento nativo falla: no se da por iniciada una sesión que no se ha guardado.
export async function guardarToken(token) {
  if (esNativa()) {
    await (await almacen()).plugin.setItem(CLAVE, token);
  }
  tokenEnMemoria = token;
}

// Borra el token de memoria y del almacenamiento nativo. Si el borrado nativo falla, el token
// ya no se usa en esta sesión y el backend lo tiene revocado tras el logout.
export async function borrarToken() {
  tokenEnMemoria = null;
  if (!esNativa()) return;
  try {
    await (await almacen()).plugin.removeItem(CLAVE);
  } catch {
    // Sin acción adicional: ver el comentario anterior.
  }
}
