import { crearMazo, barajar, compararCartas } from "./Deck.js";

const PUNTOS_TRUCO = { truco: 2, retruco: 3, vale4: 4 };
const PUNTOS_ENVIDO = { envido: 2, "real-envido": 3, "falta-envido": null }; // falta-envido = puntos que faltan
const PUNTOS_FLOR = { flor: 3, contraflor: 6, "contraflor-al-resto": null };

export class GameEngine {
  constructor(lobby) {
    this.lobby = lobby; // { id, modo: '1v1'|'2v2'|'3v3', jugadores: [{id,nombre,equipo}], verCartasCompanero }
    this.puntajeLimite = lobby.puntajeLimite || 30;
    this.puntos = { A: 0, B: 0 };
    this.manoIndex = 0; // índice del jugador mano
    this.historialManos = []; // [{numero, ganador, puntos, motivo}] — persiste entre manos, no se resetea
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
    this.muestra = mazo[jugadores.length * 3] || mazo[0];
    this.turnoIndex = this.manoIndex;
    this.estadoCanto = null; // {tipo: 'truco'|'envido', nivel, equipoQueCanto, respondido}
    this.trucoNivel = 0; // 0=nada,1=truco,2=retruco,3=vale4
    this.trucoGanadoPor = null;
    this.envidoResuelto = false;
    this.florResuelta = false;
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
    return this.lobby.jugadores.find((j) => j.id === jugadorId)?.equipo ?? null;
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
      this.historialManos.push({ numero: this.historialManos.length + 1, ganador, puntos, motivo: "bazas" });
    }
  }

  // --- Truco ---
  cantarTruco(jugadorId) {
    if (this.estadoCanto && !this.estadoCanto.respondido) throw new Error("Hay un canto pendiente");
    const equipo = this.equipoDe(jugadorId);
    const niveles = ["truco", "retruco", "vale4"];
    if (this.trucoNivel >= 3) throw new Error("Ya está en vale4");
    this.trucoNivel += 1;
    const equipoRival = equipo === "A" ? "B" : "A";
    this.estadoCanto = { tipo: "truco", nivel: niveles[this.trucoNivel - 1], equipoQueCanto: equipo, equipoQueResponde: equipoRival, respondido: false };
    return this.estadoCanto;
  }

  responderTruco(jugadorId, quiero) {
    if (!this.estadoCanto || this.estadoCanto.tipo !== "truco") throw new Error("No hay truco pendiente");
    if (this.equipoDe(jugadorId) === this.estadoCanto.equipoQueCanto) throw new Error("No podés responder tu propio canto");
    this.estadoCanto.respondido = true;
    if (!quiero) {
      const equipoRival = this.equipoDe(jugadorId) === "A" ? "B" : "A";
      const puntosPrevios = this.trucoNivel <= 1 ? 1 : PUNTOS_TRUCO[["truco", "retruco", "vale4"][this.trucoNivel - 2]];
      this.puntos[equipoRival] += puntosPrevios;
      this.manoTerminada = true;
      this.ganadorMano = equipoRival;
      this.historialManos.push({ numero: this.historialManos.length + 1, ganador: equipoRival, puntos: puntosPrevios, motivo: "no-quiero" });
    }
    this.estadoCanto = null;
    return { quiero };
  }

  // --- Envido (simplificado: envido / real-envido / falta-envido) ---
  algunTieneFlorSinResolver() {
    if (this.florResuelta || this.bazas.length > 0) return false;
    return this.jugadoresOrdenados().some((j) => this.tieneFlor(j.id));
  }

  cantarEnvido(jugadorId, tipo) {
    if (this.envidoResuelto) throw new Error("El envido ya se jugó esta mano");
    if (this.bazas.length > 0) throw new Error("El envido solo se canta antes de la primera baza");
    if (this.algunTieneFlorSinResolver()) throw new Error("Hay flor en la mesa: hay que cantarla antes que el envido");
    const equipo = this.equipoDe(jugadorId);
    const equipoRival = equipo === "A" ? "B" : "A";
    this.estadoCanto = { tipo: "envido", nivel: tipo, equipoQueCanto: equipo, equipoQueResponde: equipoRival, respondido: false };
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
    if (this.equipoDe(jugadorId) === this.estadoCanto.equipoQueCanto) throw new Error("No podés responder tu propio canto");
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

  // --- Flor (3 cartas del mismo palo) ---
  tieneFlor(jugadorId) {
    const cartas = this.manos[jugadorId];
    if (cartas.length < 3) return false;
    return cartas.every((c) => c.palo === cartas[0].palo);
  }

  calcularFlorJugador(jugadorId) {
    const cartas = this.manos[jugadorId];
    return 20 + cartas.reduce((sum, c) => sum + c.valorEnvido, 0);
  }

  cantarFlor(jugadorId, tipo = "flor") {
    if (this.florResuelta) throw new Error("La flor ya se jugó esta mano");
    if (this.bazas.length > 0) throw new Error("La flor solo se canta antes de la primera baza");
    if (!this.tieneFlor(jugadorId)) throw new Error("No tenés flor");
    const equipo = this.equipoDe(jugadorId);
    const equipoRival = equipo === "A" ? "B" : "A";
    this.estadoCanto = { tipo: "flor", nivel: tipo, equipoQueCanto: equipo, equipoQueResponde: equipoRival, respondido: false };
    this.envidoResuelto = true; // cantar flor anula el envido de esa mano
    return this.estadoCanto;
  }

  responderFlor(jugadorId, quiero) {
    if (!this.estadoCanto || this.estadoCanto.tipo !== "flor") throw new Error("No hay flor pendiente");
    if (this.equipoDe(jugadorId) === this.estadoCanto.equipoQueCanto) throw new Error("No podés responder tu propio canto");
    const equipoCanto = this.estadoCanto.equipoQueCanto;
    this.estadoCanto.respondido = true;
    this.florResuelta = true;
    if (!quiero) {
      const nivelPrevio = this.estadoCanto.nivel === "flor" ? null : "flor";
      this.puntos[equipoCanto] += nivelPrevio ? PUNTOS_FLOR.flor : PUNTOS_FLOR.flor;
      this.estadoCanto = null;
      return { quiero, ganador: null };
    }
    let mejorA = -1, mejorB = -1, huboA = false, huboB = false;
    for (const j of this.jugadoresOrdenados()) {
      if (!this.tieneFlor(j.id)) continue;
      const val = this.calcularFlorJugador(j.id);
      if (j.equipo === "A") { mejorA = Math.max(mejorA, val); huboA = true; }
      else { mejorB = Math.max(mejorB, val); huboB = true; }
    }
    const ganador = mejorA >= mejorB ? "A" : "B";
    let puntos;
    if (this.estadoCanto.nivel === "contraflor-al-resto") {
      puntos = this.puntajeLimite - this.puntos[ganador];
    } else {
      puntos = PUNTOS_FLOR[this.estadoCanto.nivel] ?? 3;
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

  estadoPublico(paraJugadorId, esEspectador = false) {
    const jugadores = this.lobby.jugadores;
    const verCartasCompanero = this.lobby.verCartasCompanero;
    const equipoPropio = this.equipoDe(paraJugadorId);
    return {
      manoIndex: this.manoIndex,
      turno: this.jugadorActual().id,
      muestra: this.muestra,
      cartasJugadas: this.cartasJugadas,
      puntos: this.puntos,
      trucoNivel: this.trucoNivel,
      estadoCanto: this.estadoCanto,
      manoTerminada: this.manoTerminada,
      ganadorMano: this.ganadorMano,
      historialManos: this.historialManos,
      envidoBloqueado: this.envidoResuelto || this.algunTieneFlorSinResolver(),
      tengoFlor: !esEspectador && this.bazas.length === 0 && !this.florResuelta && this.tieneFlor(paraJugadorId),
      manos: Object.fromEntries(
        jugadores.map((j) => {
          const mostrar = esEspectador || j.id === paraJugadorId || (verCartasCompanero && j.equipo === equipoPropio);
          const restantes = this.manos[j.id];
          const yaJugadas = 3 - restantes.length; // slots ya jugados en esta mano
          const slots = [];
          for (let i = 0; i < yaJugadas; i++) slots.push({ jugada: true }); // hueco, no ocupa lugar visual
          for (const c of restantes) slots.push(mostrar ? c : null);
          return [j.id, slots];
        })
      ),
    };
  }
}