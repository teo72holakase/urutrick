import { crearMazo, barajar, compararCartas } from "./Deck.js";

const PUNTOS_TRUCO = { truco: 2, retruco: 3, vale4: 4 };
const NIVELES_TRUCO = ["truco", "retruco", "vale4"];
const PUNTOS_ENVIDO = { envido: 2, "real-envido": 3, "falta-envido": null };
const PUNTOS_FLOR = { flor: 3, contraflor: 6, "contraflor-al-resto": null };

export class GameEngine {
  constructor(lobby) {
    this.lobby = lobby;
    this.puntajeLimite = lobby.puntajeLimite || 30;
    this.puntos = { A: 0, B: 0 };
    this.manoIndex = 0;
    this.historialManos = [];
    this.reset();
  }

  jugadoresOrdenados() { return this.lobby.jugadores; }

  reset() {
    const mazo = barajar(crearMazo());
    const jugadores = this.jugadoresOrdenados();
    this.manos = {};
    this.cartasJugadas = [];
    this.bazas = [];
    this.detalleManoActual = []; // [{equipo, puntos, motivo}] para el historial
    jugadores.forEach((j, i) => { this.manos[j.id] = mazo.slice(i * 3, i * 3 + 3); });
    this.muestra = mazo[jugadores.length * 3] || mazo[0];
    this.turnoIndex = this.manoIndex;
    this.bazaPendiente = false;
    this.estadoCanto = null;
    this.trucoNivel = 0;
    this.trucoPalabra = this.equipoDe(jugadores[this.manoIndex].id); // quién puede cantar/subir el truco
    this.envidoResuelto = false;
    this.florResuelta = false;
    this.manoTerminada = false;
    this.ganadorMano = null;
  }

  jugadorActual() { return this.jugadoresOrdenados()[this.turnoIndex]; }
  siguienteTurno() { const n = this.jugadoresOrdenados().length; this.turnoIndex = (this.turnoIndex + 1) % n; }
  equipoDe(jugadorId) { return this.lobby.jugadores.find((j) => j.id === jugadorId)?.equipo ?? null; }
  rivalDe(equipo) { return equipo === "A" ? "B" : "A"; }

  registrarPuntos(equipo, puntos, motivo) {
    this.puntos[equipo] += puntos;
    this.detalleManoActual.push({ equipo, puntos, motivo });
  }

  cerrarMano(ganador) {
    this.manoTerminada = true;
    this.ganadorMano = ganador;
    const detalleGanador = this.detalleManoActual.filter((d) => d.equipo === ganador);
    const puntos = detalleGanador.reduce((s, d) => s + d.puntos, 0);
    this.historialManos.push({ numero: this.historialManos.length + 1, ganador, puntos, detalle: detalleGanador });
  }

  // --- Jugar carta ---
  jugarCarta(jugadorId, cartaId) {
    if (this.jugadorActual().id !== jugadorId) throw new Error("No es tu turno");
    if (this.estadoCanto && !this.estadoCanto.respondido) throw new Error("Hay un canto pendiente");
    if (this.bazaPendiente) throw new Error("Esperando que se resuelva la baza");
    const mano = this.manos[jugadorId];
    const idx = mano.findIndex((c) => c.id === cartaId);
    if (idx === -1) throw new Error("No tenés esa carta");
    const [carta] = mano.splice(idx, 1);
    this.cartasJugadas.push({ jugadorId, carta });
    this.siguienteTurno();
    // No resolvemos la baza al instante: la dejamos "pendiente" para que las cartas
    // jugadas se vean un momento en el centro de la mesa antes de recogerse.
    if (this.cartasJugadas.length === this.jugadoresOrdenados().length) this.bazaPendiente = true;
    return carta;
  }

  // Se llama desde el servidor, con un pequeño delay, una vez que ya se
  // emitió el estado con las cartas jugadas visibles para todos.
  resolverBazaPendienteSiCorresponde() {
    if (!this.bazaPendiente) return false;
    this.bazaPendiente = false;
    this.resolverBaza();
    return true;
  }

  jugarCartaAleatoria(jugadorId) {
    const mano = this.manos[jugadorId];
    if (!mano.length) return null;
    const carta = mano[Math.floor(Math.random() * mano.length)];
    return this.jugarCarta(jugadorId, carta.id);
  }

  irseAlMazo(jugadorId) {
    if (this.manoTerminada) throw new Error("La mano ya terminó");
    if (this.bazaPendiente) throw new Error("Esperando que se resuelva la baza");
    const equipo = this.equipoDe(jugadorId);
    const rival = this.rivalDe(equipo);
    const puntos = this.trucoNivel > 0 ? PUNTOS_TRUCO[NIVELES_TRUCO[this.trucoNivel - 1]] : 1;
    this.registrarPuntos(rival, puntos, `${this.trucoNivel > 0 ? NIVELES_TRUCO[this.trucoNivel - 1] : "mano"} (se fueron al mazo)`);
    this.estadoCanto = null;
    this.cerrarMano(rival);
  }

  resolverBaza() {
    let mejor = this.cartasJugadas[0];
    for (const jugada of this.cartasJugadas.slice(1)) {
      if (compararCartas(jugada.carta, mejor.carta) > 0) mejor = jugada;
    }
    const empatados = this.cartasJugadas.filter((j) => compararCartas(j.carta, mejor.carta) === 0);
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
    const a = contarEquipo("A"), b = contarEquipo("B");
    let ganador = null;
    if (a >= 2) ganador = "A";
    else if (b >= 2) ganador = "B";
    else if (this.bazas.length === 3) ganador = a > b ? "A" : b > a ? "B" : this.bazas[0].equipoGanador;
    if (ganador) {
      const motivo = this.trucoNivel > 0 ? NIVELES_TRUCO[this.trucoNivel - 1] : "mano";
      const puntos = this.trucoNivel > 0 ? PUNTOS_TRUCO[motivo] : 1;
      this.registrarPuntos(ganador, puntos, motivo);
      this.cerrarMano(ganador);
    }
  }

  // --- Truco: respeta la "palabra" (quién puede cantar/subir) ---
  cantarTruco(jugadorId) {
    if (this.estadoCanto && !this.estadoCanto.respondido) throw new Error("Hay un canto pendiente");
    if (this.bazaPendiente) throw new Error("Esperando que se resuelva la baza");
    if (this.trucoNivel >= 3) throw new Error("Ya está en vale4");
    const equipo = this.equipoDe(jugadorId);
    if (equipo !== this.trucoPalabra) throw new Error("No tenés la palabra para cantar truco");
    this.trucoNivel += 1;
    const equipoRival = this.rivalDe(equipo);
    this.estadoCanto = { tipo: "truco", nivel: NIVELES_TRUCO[this.trucoNivel - 1], equipoQueCanto: equipo, equipoQueResponde: equipoRival, respondido: false };
    return this.estadoCanto;
  }

  responderTruco(jugadorId, quiero) {
    if (!this.estadoCanto || this.estadoCanto.tipo !== "truco") throw new Error("No hay truco pendiente");
    if (this.equipoDe(jugadorId) === this.estadoCanto.equipoQueCanto) throw new Error("No podés responder tu propio canto");
    const equipoRival = this.rivalDe(this.estadoCanto.equipoQueCanto);
    this.estadoCanto.respondido = true;
    if (!quiero) {
      const nivel = NIVELES_TRUCO[this.trucoNivel - 1];
      const puntosPrevios = this.trucoNivel <= 1 ? 1 : PUNTOS_TRUCO[NIVELES_TRUCO[this.trucoNivel - 2]];
      this.registrarPuntos(equipoRival, puntosPrevios, `${nivel} no querido`);
      this.estadoCanto = null;
      this.cerrarMano(equipoRival);
      return { quiero };
    }
    this.trucoPalabra = equipoRival; // ahora puede subir el equipo que acaba de decir "quiero"
    this.estadoCanto = null;
    return { quiero };
  }

  // --- Envido: solo antes de que se juegue la primera carta de la mano ---
  algunTieneFlorSinResolver() {
    if (this.florResuelta || this.bazas.length > 0) return false;
    return this.jugadoresOrdenados().some((j) => this.tieneFlor(j.id));
  }

  envidoDisponible() {
    // Se puede cantar durante toda la primera ronda (primera baza), sin importar
    // cuántas cartas ya se jugaron en ella. Deja de estar disponible recién en
    // la 2da ronda (this.bazas.length > 0), si ya se resolvió (jugado o con
    // flor de por medio) o si hay una flor sin resolver todavía.
    return !this.envidoResuelto && this.bazas.length === 0 && !this.bazaPendiente && !this.algunTieneFlorSinResolver();
  }

  cantarEnvido(jugadorId, tipo) {
    if (!this.envidoDisponible()) throw new Error("Ya no se puede cantar envido en esta mano");
    const equipo = this.equipoDe(jugadorId);
    const equipoRival = this.rivalDe(equipo);
    this.estadoCanto = { tipo: "envido", nivel: tipo, equipoQueCanto: equipo, equipoQueResponde: equipoRival, respondido: false };
    return this.estadoCanto;
  }

  calcularEnvidoJugador(jugadorId) {
    const cartas = [...this.manos[jugadorId], ...this.cartasJugadas.filter((c) => c.jugadorId === jugadorId).map((c) => c.carta)];
    const porPalo = {};
    cartas.forEach((c) => { porPalo[c.palo] = porPalo[c.palo] || []; porPalo[c.palo].push(c.valorEnvido); });
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
      this.registrarPuntos(equipoCanto, 1, `${this.estadoCanto.nivel} no querido`);
      this.estadoCanto = null;
      return { quiero, ganador: null };
    }
    let mejorA = -1, mejorB = -1;
    for (const j of this.jugadoresOrdenados()) {
      const val = this.calcularEnvidoJugador(j.id);
      if (j.equipo === "A") mejorA = Math.max(mejorA, val); else mejorB = Math.max(mejorB, val);
    }
    const ganador = mejorA >= mejorB ? "A" : "B";
    let puntos;
    if (this.estadoCanto.nivel === "falta-envido") puntos = this.puntajeLimite - this.puntos[ganador];
    else puntos = PUNTOS_ENVIDO[this.estadoCanto.nivel] ?? 2;
    this.registrarPuntos(ganador, puntos, this.estadoCanto.nivel.replace("-", " "));
    this.estadoCanto = null;
    return { quiero, ganador, mejorA, mejorB };
  }

  // --- Flor ---
  tieneFlor(jugadorId) {
    const cartas = this.manos[jugadorId];
    if (cartas.length < 3) return false;
    return cartas.every((c) => c.palo === cartas[0].palo);
  }

  calcularFlorJugador(jugadorId) {
    return 20 + this.manos[jugadorId].reduce((s, c) => s + c.valorEnvido, 0);
  }

  cantarFlor(jugadorId, tipo = "flor") {
    if (this.florResuelta) throw new Error("La flor ya se jugó esta mano");
    if (this.bazas.length > 0) throw new Error("La flor solo se canta antes de la primera baza");
    if (this.bazaPendiente) throw new Error("Esperando que se resuelva la baza");
    if (!this.tieneFlor(jugadorId)) throw new Error("No tenés flor");
    const equipo = this.equipoDe(jugadorId);
    const equipoRival = this.rivalDe(equipo);
    this.estadoCanto = { tipo: "flor", nivel: tipo, equipoQueCanto: equipo, equipoQueResponde: equipoRival, respondido: false };
    this.envidoResuelto = true;
    return this.estadoCanto;
  }

  responderFlor(jugadorId, quiero) {
    if (!this.estadoCanto || this.estadoCanto.tipo !== "flor") throw new Error("No hay flor pendiente");
    if (this.equipoDe(jugadorId) === this.estadoCanto.equipoQueCanto) throw new Error("No podés responder tu propio canto");
    const equipoCanto = this.estadoCanto.equipoQueCanto;
    this.estadoCanto.respondido = true;
    this.florResuelta = true;
    if (!quiero) {
      this.registrarPuntos(equipoCanto, PUNTOS_FLOR.flor, "flor no querida");
      this.estadoCanto = null;
      return { quiero, ganador: null };
    }
    let mejorA = -1, mejorB = -1;
    for (const j of this.jugadoresOrdenados()) {
      if (!this.tieneFlor(j.id)) continue;
      const val = this.calcularFlorJugador(j.id);
      if (j.equipo === "A") mejorA = Math.max(mejorA, val); else mejorB = Math.max(mejorB, val);
    }
    const ganador = mejorA >= mejorB ? "A" : "B";
    let puntos;
    if (this.estadoCanto.nivel === "contraflor-al-resto") puntos = this.puntajeLimite - this.puntos[ganador];
    else puntos = PUNTOS_FLOR[this.estadoCanto.nivel] ?? 3;
    this.registrarPuntos(ganador, puntos, this.estadoCanto.nivel.replace(/-/g, " "));
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
      bazaPendiente: !!this.bazaPendiente,
      puntos: this.puntos,
      trucoNivel: this.trucoNivel,
      trucoPalabra: this.trucoPalabra,
      estadoCanto: this.estadoCanto,
      manoTerminada: this.manoTerminada,
      ganadorMano: this.ganadorMano,
      historialManos: this.historialManos,
      envidoDisponible: !esEspectador && this.envidoDisponible(),
      tengoFlor: !esEspectador && this.bazas.length === 0 && !this.bazaPendiente && !this.florResuelta && this.tieneFlor(paraJugadorId),
      manos: Object.fromEntries(
        jugadores.map((j) => {
          const mostrar = esEspectador || j.id === paraJugadorId || (verCartasCompanero && j.equipo === equipoPropio);
          const restantes = this.manos[j.id];
          const yaJugadas = 3 - restantes.length;
          const slots = [];
          for (let i = 0; i < yaJugadas; i++) slots.push({ jugada: true });
          for (const c of restantes) slots.push(mostrar ? c : null);
          return [j.id, slots];
        })
      ),
    };
  }
}