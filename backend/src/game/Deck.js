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

export function compararCartas(cartaA, cartaB) {
  const ia = jerarquiaIndex(cartaA.id);
  const ib = jerarquiaIndex(cartaB.id);
  if (ia < ib) return 1;  // A gana
  if (ia > ib) return -1; // B gana
  return 0; // empate (parda)
}

export { PALOS, NUMEROS, JERARQUIA };
