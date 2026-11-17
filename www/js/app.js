// Arranque y enrutador. Rutas por hash: funcionan igual en navegador y dentro de Capacitor.
import { cargar, actualizar, cerrarSesion } from "./store.js";
import { auth, ErrorApi } from "./api.js";
import { anunciar, anunciarTitulo, enfocarTitulo, estadoConexion } from "./a11y.js";
import { renderLogin, renderRegistro } from "./pantallas/acceso.js";
import { renderInicio } from "./pantallas/inicio.js";
import { renderResultado } from "./pantallas/resultado.js";
import { renderHistorial } from "./pantallas/historial.js";
import { renderBaston } from "./pantallas/baston.js";
import { renderAuxiliar } from "./pantallas/auxiliar.js";
import { renderAjustes } from "./pantallas/ajustes.js";

const PUBLICAS = new Set(["login", "registro"]);

const RUTAS = {
  login: { titulo: "Iniciar sesión", render: renderLogin },
  registro: { titulo: "Crear cuenta", render: renderRegistro },
  inicio: { titulo: "Inicio", render: renderInicio },
  resultado: { titulo: "Resultado", render: renderResultado },
  historial: { titulo: "Historial", render: renderHistorial },
  baston: { titulo: "Bastón", render: renderBaston },
  auxiliar: { titulo: "Auxiliar", render: renderAuxiliar },
  ajustes: { titulo: "Configuración", render: renderAjustes },
};

const raiz = document.getElementById("contenido");
const barra = document.getElementById("barra");
let limpiezas = [];
let generacion = 0; // evita pintar una pantalla antigua si el usuario navega deprisa

function leerRuta() {
  const partes = (location.hash || "#/").replace(/^#\/?/, "").split("/");
  return { nombre: partes[0] || "inicio", arg: partes.slice(1).join("/") };
}

function ir(hash) {
  if (location.hash === hash) {
    navegar();
  } else {
    location.hash = hash;
  }
}

function alSalir(fn) {
  limpiezas.push(fn);
}

function limpiarPantalla() {
  limpiezas.forEach((fn) => {
    try {
      fn();
    } catch {
      // Una limpieza fallida no debe impedir cambiar de pantalla.
    }
  });
  limpiezas = [];
}

function actualizarNavegacion(estado, nombre) {
  const visible = estado.modo !== "ninguno";
  barra.hidden = !visible;
  barra.querySelectorAll("a").forEach((a) => {
    if (a.dataset.ruta === nombre) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

function textoConexion(estado) {
  if (estado.modo === "conectado") return "Conectado";
  if (estado.modo === "demo") return "Demostración";
  return "Sin sesión";
}

async function navegar() {
  const mi = ++generacion;
  limpiarPantalla();
  let estado = cargar();
  const { nombre, arg } = leerRuta();

  if (estado.modo === "ninguno" && !PUBLICAS.has(nombre)) {
    location.hash = "#/login";
    return;
  }
  if (estado.modo !== "ninguno" && (nombre === "login" || nombre === "registro")) {
    location.hash = "#/inicio";
    return;
  }

  const ruta = RUTAS[nombre] ?? RUTAS.inicio;
  document.title = `${ruta.titulo} · ORBIS`;
  actualizarNavegacion(estado, nombre);
  estadoConexion(textoConexion(estado));

  const contexto = { ir, alSalir, estado };
  ruta.render(raiz, contexto, arg);
  if (mi !== generacion) return;
  enfocarTitulo(raiz);
  anunciarTitulo(ruta.titulo);
}

// Al arrancar, un modo "conectado" se verifica contra el backend. Una sesión caducada vuelve al acceso.
async function restaurarSesion() {
  const estado = cargar();
  if (estado.modo !== "conectado") return;
  try {
    const yo = await auth.me();
    actualizar({ correo: yo?.correo ?? estado.correo });
  } catch (e) {
    if (e instanceof ErrorApi && e.codigo === "SESION_EXPIRADA") {
      cerrarSesion();
      anunciar("Tu sesión ha caducado. Inicia sesión de nuevo.", { urgente: true });
    }
    // Sin red no se cierra la sesión: la app puede mostrar datos locales.
  }
}

window.addEventListener("hashchange", navegar);

restaurarSesion().finally(() => {
  if (!location.hash) location.hash = "#/inicio";
  navegar();
});
