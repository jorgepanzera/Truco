import type { Carta as CartaModelo } from "@truco/shared";

const archivoPalo = { oro: "coins", copa: "cups", espada: "swords", basto: "clubs" } as const;
const nombreValor = { 10: "Sota", 11: "Caballo", 12: "Rey" } as const;

function nombreDeCarta(carta: CartaModelo): string {
  return `${nombreValor[carta.valor as 10 | 11 | 12] ?? carta.valor} de ${carta.palo}`;
}

function recursoDeCarta(carta: CartaModelo): string {
  const valor = String(carta.valor).padStart(2, "0");
  return new URL(
    `./assets/cartas-espanolas/card_${archivoPalo[carta.palo]}_${valor}.svg`,
    import.meta.url,
  ).href;
}

const dorso = new URL("./assets/cartas-espanolas/card_back.svg", import.meta.url).href;

export function Carta({
  carta,
  onSeleccionar,
  deshabilitada = false,
}: Readonly<{
  carta: CartaModelo;
  onSeleccionar?: (carta: CartaModelo) => void;
  deshabilitada?: boolean;
}>) {
  const contenido = (
    <img className="carta__ilustracion" src={recursoDeCarta(carta)} alt={nombreDeCarta(carta)} />
  );
  if (onSeleccionar)
    return (
      <button
        className="carta carta--jugable"
        type="button"
        disabled={deshabilitada}
        onClick={() => onSeleccionar(carta)}
        aria-label={`Jugar ${nombreDeCarta(carta)}`}
      >
        {contenido}
      </button>
    );
  return <article className="carta">{contenido}</article>;
}

export function DorsoCarta() {
  return (
    <div className="carta carta--dorso">
      <img className="carta__ilustracion" src={dorso} alt="Carta de la máquina oculta" />
    </div>
  );
}
