// Sección del bastón: estado real, vinculación y errores. No simula una conexión física.
import { cargar } from "../store.js";
import { anunciar } from "../a11y.js";
import { el, insignia, boton, fila, mensajeError } from "../componentes.js";
import { dispositivos, ErrorApi } from "../api.js";
import { estadoBaston } from "../adaptadores.js";

function deletrear(codigo) {
  // Se lee letra a letra para que el lector de pantalla no lo pronuncie como palabra.
  return codigo.split("").join(" ");
}

export function renderBaston(raiz) {
  const estado = cargar();
  const baston = estadoBaston(estado.modo);
  const zonaCodigo = el("div", { "aria-live": "polite" });

  const generar = boton("Generar código de vinculación", {
    etiqueta: "Generar código de vinculación para registrar un bastón",
    deshabilitado: estado.modo !== "conectado",
  });
  generar.addEventListener("click", async () => {
    generar.disabled = true;
    try {
      const r = await dispositivos.codigoVinculacion();
      zonaCodigo.replaceChildren(
        el("div", { className: "tarjeta" }, [
          el("p", { className: "etiqueta", texto: "Código de un solo uso" }),
          el("p", { className: "codigo", "aria-label": `Código: ${deletrear(r.codigo)}`, texto: r.codigo }),
          el("p", { texto: `Caduca a las ${new Date(r.expiraEn).toLocaleTimeString("es-ES", { timeStyle: "short" })}. Introdúcelo en el bastón antes de que caduque.` }),
        ]),
      );
      anunciar(`Código generado: ${deletrear(r.codigo)}`);
    } catch (e) {
      zonaCodigo.replaceChildren(mensajeError("No se pudo generar el código", e instanceof ErrorApi ? e.message : "Inténtalo de nuevo."));
    } finally {
      generar.disabled = estado.modo !== "conectado";
    }
  });

  raiz.replaceChildren(
    el("h1", { texto: "Bastón" }),
    el("section", { className: "tarjeta", "aria-labelledby": "t-estado" }, [
      el("p", { className: "etiqueta", id: "t-estado", texto: "Estado del dispositivo" }),
      el("p", {}, [insignia(baston.conectado ? "Conectado" : "No conectado", baston.conectado ? "ok" : "neutra")]),
      el("dl", {}, [
        fila("Identificador", "Sin datos"),
        fila("Última comunicación", "Sin datos"),
        fila("Asociado a tu cuenta", "No"),
      ]),
      el("p", { texto: baston.mensaje }),
    ]),
    el("section", { "aria-labelledby": "t-vincular" }, [
      el("h2", { id: "t-vincular", texto: "Vincular un bastón" }),
      el("p", { texto: "Genera un código y escríbelo en el bastón. El código sirve una sola vez." }),
      generar,
      zonaCodigo,
    ]),
    el("section", { "aria-labelledby": "t-errores" }, [
      el("h2", { id: "t-errores", texto: "Si algo falla" }),
      el("ul", { className: "lista" }, [
        el("li", { texto: "Si el bastón no aparece, comprueba que el teléfono tiene datos móviles o Wi-Fi." }),
        el("li", { texto: "Si el código caduca, genera uno nuevo." }),
        el("li", { texto: "Si el bastón se desconecta, ORBIS lo mostrará aquí y no enviará nada hasta que vuelva a conectarse." }),
      ]),
    ]),
  );
}
