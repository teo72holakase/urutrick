import { crearMazo, barajar, compararCartas } from "./Deck.js";

const PUNTOS_TRUCO = { truco: 2, retruco: 3, vale4: 4 };
const PUNTOS_ENVIDO = { envido: 2, "real-envido": 3, "falta-envido": null }; // falta-envido = puntos que faltan

export class GameEngine {
  constructor(lobby) {
    this.lobby = lobby; // { id, modo: '1v1'|'2v2'|'3v3', jugadores: [{id,nombre,equipo}], verCartasCompanero }
    this.puntajeLimite = 30;
    this.puntos = { A: 0, B: 0 };
    this.manoIndex = 0; // índice del jugador mano
    this.reset();
  }

  jugadoresOrdenados() {
    return this.lobby.jugadores; // orden fijo de asiento
  }

  reset() {
    const mazo = barajar(crearMazo());
    const jugadores = this.jugadoresOrdenados();
    this.manos = {}; // id jugador -> cartas restantes
    this.cartasJugadas = []; // [{jugadorId, carta}] de la baza actual
    this.bazas = []; // historial de bazas ganadas: [{ganadorEquipo}]
    jugadores.forEach((j, i) => {
      this.manos[j.id] = mazo.slice(i * 3, i * 3 + 3);
    });
    this.turnoIndex = this.manoIndex;
    this.estadoCanto = null; // {tipo: 'truco'|'envido', nivel, equipoQueCanto, respondido}
    this.trucoNivel = 0; // 0=nada,1=truco,2=retruco,3=vale4
    this.trucoGanadoPor = null;
    this.envidoResuelto = false;
    this.manoTerminada = false;
    this.ganadorMano = null;
  }

  jugadorActual() {
    return this.jugadoresOrdenados()[this.turnoIndex];
  }

  siguienteTurno() {
    const n = this.jugadoresOrdenados().length;
    this.turnoIndex = (this.turnoIndex + 1) % n;
  }

  // --- Jugar carta ---
  jugarCarta(jugadorId, cartaId) {
    if (this.jugadorActual().id !== jugadorId) throw new Error("No es tu turno");
    if (this.estadoCanto && !this.estadoCanto.respondido) throw new Error("Hay un canto pendiente");
    const mano = this.manos[jugadorId];
    const idx = mano.findIndex((c) => c.id === cartaId);
    if (idx === -1) throw new Error("No tenés esa carta");
    const [carta] = mano.splice(idx, 1);
    this.cartasJugadas.push({ jugadorId, carta });
    this.siguienteTurno();

    const jugadores = this.jugadoresOrdenados();
    if (this.cartasJugadas.length === jugadores.length) {
      this.resolverBaza();
    }
    return carta;
  }

  jugarCartaAleatoria(jugadorId) {
    const mano = this.manos[jugadorId];
    if (!mano.length) return null;
    const carta = mano[Math.floor(Math.random() * mano.length)];
    return this.jugarCarta(jugadorId, carta.id);
  }

  equipoDe(jugadorId) {
    return this.lobby.jugadores.find((j) => j.id === jugadorId).equipo;
  }

  resolverBaza() {
    let mejor = this.cartasJugadas[0];
    for (const jugada of this.cartasJugadas.slice(1)) {
      if (compararCartas(jugada.carta, mejor.carta) > 0) mejor = jugada;
    }
    const empatados = this.cartasJugadas.filter(
      (j) => compararCartas(j.carta, mejor.carta) === 0
    );
    const equipoGanador = empatados.length > 1 ? "parda" : this.equipoDe(mejor.jugadorId);
    this.bazas.push({ equipoGanador });
    this.cartasJugadas = [];

    if (this.bazas.length >= 2) this.evaluarFinDeMano();
    if (!this.manoTerminada) {
      const ganadorIdx = this.jugadoresOrdenados().findIndex((j) => j.id === mejor.jugadorId);
      this.turnoIndex = equipoGanador === "parda" ? this.manoIndex : ganadorIdx;
    }
  }

  evaluarFinDeMano() {
    const contarEquipo = (eq) => this.bazas.filter((b) => b.equipoGanador === eq).length;
    const a = contarEquipo("A");
    const b = contarEquipo("B");
    let ganador = null;
    if (a >= 2) ganador = "A";
    else if (b >= 2) ganador = "B";
    else if (this.bazas.length === 3) {
      ganador = a > b ? "A" : b > a ? "B" : this.bazas[0].equipoGanador; // desempate por 1ra baza
    }
    if (ganador) {
      this.manoTerminada = true;
      this.ganadorMano = ganador;
      const puntos = this.trucoNivel > 0 ? PUNTOS_TRUCO[["truco", "retruco", "vale4"][this.trucoNivel - 1]] : 1;
      this.puntos[ganador] += puntos;
    }
  }

  // --- Truco ---
  cantarTruco(jugadorId) {
    const equipo = this.equipoDe(jugadorId);
    const niveles = ["truco", "retruco", "vale4"];
    if (this.trucoNivel >= 3) throw new Error("Ya está en vale4");
    this.trucoNivel += 1;
    this.estadoCanto = { tipo: "truco", nivel: niveles[this.trucoNivel - 1], equipoQueCanto: equipo, respondido: false };
    return this.estadoCanto;
  }

  responderTruco(jugadorId, quiero) {
    if (!this.estadoCanto || this.estadoCanto.tipo !== "truco") throw new Error("No hay truco pendiente");
    this.estadoCanto.respondido = true;
    if (!quiero) {
      const equipoRival = this.equipoDe(jugadorId) === "A" ? "B" : "A";
      const puntosPrevios = this.trucoNivel <= 1 ? 1 : PUNTOS_TRUCO[["truco", "retruco", "vale4"][this.trucoNivel - 2]];
      this.puntos[equipoRival] += puntosPrevios;
      this.manoTerminada = true;
      this.ganadorMano = equipoRival;
    }
    this.estadoCanto = null;
    return { quiero };
  }

  // --- Envido (simplificado: envido / real-envido / falta-envido) ---
  cantarEnvido(jugadorId, tipo) {
    if (this.envidoResuelto) throw new Error("El envido ya se jugó esta mano");
    if (this.bazas.length > 0) throw new Error("El envido solo se canta antes de la primera baza");
    const equipo = this.equipoDe(jugadorId);
    this.estadoCanto = { tipo: "envido", nivel: tipo, equipoQueCanto: equipo, respondido: false };
    return this.estadoCanto;
  }

  calcularEnvidoJugador(jugadorId) {
    const cartas = [...this.manos[jugadorId], ...this.cartasJugadas.filter(c=>c.jugadorId===jugadorId).map(c=>c.carta)];
    const porPalo = {};
    cartas.forEach((c) => {
      porPalo[c.palo] = porPalo[c.palo] || [];
      porPalo[c.palo].push(c.valorEnvido);
    });
    let mejor = Math.max(...cartas.map((c) => c.valorEnvido));
    for (const palo in porPalo) {
      if (porPalo[palo].length >= 2) {
        const [x, y] = porPalo[palo].sort((a, b) => b - a);
        mejor = Math.max(mejor, x + y + 20);
      }
    }
    return mejor;
  }

  responderEnvido(jugadorId, quiero) {
    if (!this.estadoCanto || this.estadoCanto.tipo !== "envido") throw new Error("No hay envido pendiente");
    const equipoCanto = this.estadoCanto.equipoQueCanto;
    this.estadoCanto.respondido = true;
    this.envidoResuelto = true;
    if (!quiero) {
      this.puntos[equipoCanto] += 1;
      this.estadoCanto = null;
      return { quiero, ganador: null };
    }
    // calcular mejor envido por equipo
    let mejorA = -1, mejorB = -1;
    for (const j of this.jugadoresOrdenados()) {
      const val = this.calcularEnvidoJugador(j.id);
      if (j.equipo === "A") mejorA = Math.max(mejorA, val);
      else mejorB = Math.max(mejorB, val);
    }
    const ganador = mejorA >= mejorB ? "A" : "B";
    let puntos;
    if (this.estadoCanto.nivel === "falta-envido") {
      const faltanA = this.puntajeLimite - this.puntos.A;
      const faltanB = this.puntajeLimite - this.puntos.B;
      puntos = ganador === "A" ? faltanA : faltanB;
    } else {
      puntos = PUNTOS_ENVIDO[this.estadoCanto.nivel] ?? 2;
    }
    this.puntos[ganador] += puntos;
    this.estadoCanto = null;
    return { quiero, ganador, mejorA, mejorB };
  }

  finDePartida() {
    if (this.puntos.A >= this.puntajeLimite) return "A";
    if (this.puntos.B >= this.puntajeLimite) return "B";
    return null;
  }

  siguienteMano() {
    const n = this.jugadoresOrdenados().length;
    this.manoIndex = (this.manoIndex + 1) % n;
    this.reset();
  }

  estadoPublico(paraJugadorId) {
    const jugadores = this.lobby.jugadores;
    const verCartasCompanero = this.lobby.verCartasCompanero;
    const equipoPropio = this.equipoDe(paraJugadorId);
    return {
      manoIndex: this.manoIndex,
      turno: this.jugadorActual().id,
      cartasJugadas: this.cartasJugadas,
      puntos: this.puntos,
      trucoNivel: this.trucoNivel,
      estadoCanto: this.estadoCanto,
      manoTerminada: this.manoTerminada,
      ganadorMano: this.ganadorMano,
      manos: Object.fromEntries(
        jugadores.map((j) => {
          const mostrar = j.id === paraJugadorId || (verCartasCompanero && j.equipo === equipoPropio);
          return [j.id, mostrar ? this.manos[j.id] : this.manos[j.id].map(() => null)];
        })
      ),
    };
  }
}
