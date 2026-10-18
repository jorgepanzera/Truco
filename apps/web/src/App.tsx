import { textos } from "./textos.js";

export function App() {
  return (
    <main className="pantalla">
      <section className="presentacion" aria-labelledby="titulo">
        <p className="estado">{textos.estado}</p>
        <h1 id="titulo">{textos.titulo}</h1>
        <p className="descripcion">{textos.descripcion}</p>
      </section>
    </main>
  );
}
