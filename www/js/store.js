// Estado local de la app. Solo guarda metadatos: nunca bytes de imagen ni contraseñas.
// Todo acceso a localStorage va en try/catch: si el almacenamiento no está disponible, la app sigue.
import { LIMITE_CAPTURAS_LOCALES } from "./config.js";

const CLAVE = "orbis.estado.v1";

const POR_DEFECTO = Object.freeze({
  // "ninguno" | "conectado" | "demo"
  modo: "ninguno",
  correo: null,
  nombre: null,
  velocidadVoz: 1,
  lecturaAutomatica: true,
  capturas: [],
});

export function cargar() {
  try {
    const bruto = localStorage.getItem(CLAVE);
    return bruto ? { ...POR_DEFECTO, ...JSON.parse(bruto) } : { ...POR_DEFECTO };
  } catch {
    return { ...POR_DEFECTO };
  }
}

export function guardar(estado) {
  const limpio = { ...estado, capturas: (estado.capturas ?? []).slice(0, LIMITE_CAPTURAS_LOCALES) };
  try {
    localStorage.setItem(CLAVE, JSON.stringify(limpio));
  } catch {
    // Sin almacenamiento: la sesión dura solo mientras la app está abierta.
  }
  return limpio;
}

export function actualizar(cambios) {
  return guardar({ ...cargar(), ...cambios });
}

export function cerrarSesion() {
  return actualizar({ modo: "ninguno", correo: null, nombre: null });
}
