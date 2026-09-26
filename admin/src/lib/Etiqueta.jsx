import { COLORES_ETIQUETA } from "./datos.js";

// Etiqueta de chat: punto de color + nombre (el texto siempre en color de tinta, el color solo en el punto)
export default function Etiqueta({ etiqueta, activa = true, onClick, chica }) {
  const color = COLORES_ETIQUETA[(etiqueta.color || 1) - 1];
  const Tag = onClick ? "button" : "span";
  return (
    <Tag type={onClick ? "button" : undefined} className={"etiqueta-chat" + (activa ? " activa" : "") + (chica ? " chica" : "")}
      style={{ "--c": color }} onClick={onClick} aria-pressed={onClick ? activa : undefined}>
      <span className="punto-color" aria-hidden="true" />{etiqueta.nombre}
    </Tag>
  );
}
