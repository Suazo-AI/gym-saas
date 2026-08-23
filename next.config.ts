import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next 16.3 escribe un bloque propio dentro de AGENTS.md en cada `next dev`.
  // Aca AGENTS.md no es un archivo cualquiera: es el que gobierna las reglas del
  // producto, la arquitectura, la seguridad y el alcance del MVP, y se lee como
  // estado del sistema. Un generador que le agrega texto en cada arranque lo
  // vuelve mitad escrito a mano y mitad autogenerado, ensucia el arbol de
  // trabajo despues de cada `npm run dev`, y rompe la regla del repositorio de
  // no mezclar contenido manual con contenido de una herramienta.
  //
  // El consejo que agrega no se pierde: vive en node_modules/next/dist/docs/.
  agentRules: false,
};

export default nextConfig;
