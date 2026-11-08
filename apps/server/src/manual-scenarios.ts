import { crearServidor } from "./server.js";

const escenario = process.argv[2];
if (escenario !== "envido-aceptado" && escenario !== "envido-rechazado")
  throw new Error("Escenario desconocido. Usá: envido-aceptado o envido-rechazado.");

const eleccionesSinFlor = [
  33, 25, 7, 11, 17, 22, 25, 0, 1, 28, 3, 16, 9, 12, 21, 3, 17, 17, 15, 4, 13, 4, 3, 6,
  1, 11, 7, 0, 1, 6, 7, 6, 1, 6, 5, 0, 1, 2, 1,
];
let indice = 0;
const servidor = crearServidor({
  aleatoriedad: { enteroInclusivo: () => eleccionesSinFlor[indice++] ?? 0 },
  politicaAutomatica: {
    decidir: ({ accionesLegales }) =>
      accionesLegales.find((accion) =>
        accion.tipo === (escenario === "envido-rechazado" ? "no-quiero-envido" : "quiero-envido"),
      ) ??
      accionesLegales.find((accion) => accion.tipo === "jugar-carta") ??
      null,
  },
});
servidor.listen(3000, "127.0.0.1", () =>
  console.log(`Escenario manual ${escenario} en http://127.0.0.1:3000`),
);
