// Baraja española de 40 cartas (sin 8 ni 9) y jerarquía del Truco uruguayo
const PALOS = ["espada", "basto", "oro", "copa"];
const NUMEROS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

// Jerarquía de mayor a menor (truco uruguayo, con "piezas")
const JERARQUIA = [
  "1-espada",  // Ancho de espada (matacas)
  "1-basto",   // Ancho de basto
  "7-espada",  // Siete de espada
  "7-oro",     // Siete de oro
  "3-espada", "3-basto", "3-oro", "3-copa",
  "2-espada", "2-basto", "2-oro", "2-copa",
  "1-oro", "1-copa", // anchos falsos
  "12-espada", "12-basto", "12-oro", "12-copa",
  "11-espada", "11-basto", "11-oro", "11-copa",
  "10-espada", "10-basto", "10-oro", "10-copa",
  "7-basto", "7-copa",
  "6-espada", "6-basto", "6-oro", "6-copa",
  "5-espada", "5-basto", "5-oro", "5-copa",
  "4-espada", "4-basto", "4-oro", "4-copa",
];

// Valor de envido por número (10,11,12 valen 0)
function valorEnvido(numero) {
  if (numero >= 10) return 0;
  return numero;
}

// --- Piezas (truco uruguayo con muestra) ---
// Las "piezas" son cartas del palo de la muestra: 2, 4, 5, 11 y 10. Son las cartas
// más fuertes del juego (por encima del ancho de espada) y valen fijo en los tantos.
// Si la muestra ES una pieza, el 12 (rey) del palo la reemplaza y toma su valor y
// jerarquía (regla de la sustitución / "el pelado").
const NUM_PIEZAS = [2, 4, 5, 11, 10]; // de mayor a menor jerarquía
const VALOR_PIEZA = { 2: 30, 4: 29, 5: 28, 11: 27, 10: 27 }; // valor en tantos

export function esPieza(carta, muestra) {
  return numeroPiezaEfectivo(carta, muestra) != null;
}

// Número de pieza "efectivo": para las piezas normales es su propio número; para el
// 12 sustituto es el número de la pieza que salió como muestra. Null si no es pieza.
export function numeroPiezaEfectivo(carta, muestra) {
  if (!carta || !muestra || carta.palo !== muestra.palo) return null;
  if (NUM_PIEZAS.includes(carta.numero) && carta.numero !== muestra.numero) return carta.numero;
  if (carta.numero === 12 && NUM_PIEZAS.includes(muestra.numero)) return muestra.numero;
  return null;
}

// Valor fijo de la pieza para el conteo de tantos (30/29/28/27/27), o null.
export function valorPiezaTantos(carta, muestra) {
  const n = numeroPiezaEfectivo(carta, muestra);
  return n == null ? null : VALOR_PIEZA[n];
}

export function crearMazo() {
  const mazo = [];
  for (const palo of PALOS) {
    for (const numero of NUMEROS) {
      mazo.push({ id: `${numero}-${palo}`, numero, palo, valorEnvido: valorEnvido(numero) });
    }
  }
  return mazo;
}

export function barajar(mazo) {
  const arr = [...mazo];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function jerarquiaIndex(cartaId) {
  return JERARQUIA.indexOf(cartaId); // menor index = carta más fuerte
}

// Fuerza de una carta para ganar la baza. Mayor = más fuerte. Las piezas del palo
// de la muestra van por encima de toda la jerarquía tradicional (2 > 4 > 5 > 11 > 10).
export function fuerzaCarta(carta, muestra) {
  const nEf = numeroPiezaEfectivo(carta, muestra);
  if (nEf != null) return 1000 - NUM_PIEZAS.indexOf(nEf); // 1000..996
  const idx = jerarquiaIndex(carta.id);
  if (idx === -1) return -1000;
  return 100 - idx; // debajo de las piezas, pero respeta el orden tradicional
}

export function compararCartas(cartaA, cartaB, muestra) {
  const fa = fuerzaCarta(cartaA, muestra);
  const fb = fuerzaCarta(cartaB, muestra);
  if (fa > fb) return 1;  // A gana
  if (fa < fb) return -1; // B gana
  return 0; // empate (parda)
}

export { PALOS, NUMEROS, JERARQUIA };
