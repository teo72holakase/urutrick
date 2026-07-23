import { crearMazo, barajar, compararCartas, esPieza, numeroPiezaEfectivo, valorPiezaTantos } from "./Deck.js";

const PUNTOS_TRUCO = { truco: 2, retruco: 3, vale4: 4 };
const NIVELES_TRUCO = ["truco", "retruco", "vale4"];
const VALOR_ENVIDO_CANTO = { envido: 2, "real-envido": 3 };
const PUNTOS_FLOR = { flor: 3, contraflor: 6, "contraflor-al-resto": null };
const TEXTO_TRUCO = { truco: "Truco", retruco: "Retruco", vale4: "Vale 4" };
const TEXTO_ENVIDO = { envido: "Envido", "envido-envido": "5 Envido", "real-envido": "Real Envido", "falta-envido": "Falta Envido" };
const TEXTO_FLOR = { flor: "Flor", contraflor: "Contraflor", "contraflor-al-resto": "Contra flor al resto" };

export class GameEngine {
  constructor(lobby) {
    this.lobby = lobby;
    this.puntajeLimite = lobby.puntajeLimite || 30;
    this.puntos = { A: 0, B: 0 };
    this.manoIndex = 0;
    this.historialManos = [];
    this.revelacionSeq = 0;
    this.accionSeq = 0;
    this.avisoSeq = 0;
    this.reset();
  }

  jugadoresOrdenados() { return this.lobby.jugadores; }

  reset() {
    const mazo = barajar(crearMazo());
    const jugadores = this.jugadoresOrdenados();
    this.manos = {};
    this.cartasJugadas = [];
    this.bazas = [];
    this.detalleManoActual = [];
    jugadores.forEach((j, i) => { this.manos[j.id] = mazo.slice(i * 3, i * 3 + 3); });
    this.muestra = mazo[jugadores.length * 3] || mazo[0];
    this.turnoIndex = this.manoIndex;
    this.bazaPendiente = false;
    this.estadoCanto = null;
    this.trucoNivel = 0;
    this.trucoPalabra = this.equipoDe(jugadores[this.manoIndex].id);
    this.trucoCantanteId = jugadores[this.manoIndex].id;
    this.trucoRespondeId = null;
    this.trucoPuedeEscalarAhora = false;
    this.envidoResuelto = false;
    this.florResuelta = false;
    this.revelacionEnvido = null;
    this.florCanto = null;
    this.trucoPendienteGuardado = null;
    this.accionReciente = null;
    this.avisoTop = null;
    this.manoTerminada = false;
    this.ganadorMano = null;
  }

  registrarAccion(jugadorId, texto) {
    this.accionReciente = { id: ++this.accionSeq, jugadorId, texto };
  }

  avisar(texto) {
    this.avisoTop = { id: ++this.avisoSeq, texto };
  }

  nombreDeJugador(jugadorId) {
    return this.lobby.jugadores.find((j) => j.id === jugadorId)?.nombre || "";
  }

  nombreDeEquipo(equipo) {
    if (this.lobby.modo === "1v1") {
      return this.lobby.jugadores.find((j) => j.equipo === equipo)?.nombre || `Equipo ${equipo}`;
    }
    return `Equipo ${equipo}`;
  }

  haJugadoCarta(jugadorId) {
    return this.cartasJugadas.some((c) => c.jugadorId === jugadorId)
      || this.bazas.some((b) => (b.jugadas || []).some((j) => j.jugadorId === jugadorId));
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
    const detalle = this.detalleManoActual.slice();
    const puntos = detalle.filter((d) => d.equipo === ganador).reduce((s, d) => s + d.puntos, 0);
    this.historialManos.push({ numero: this.historialManos.length + 1, ganador, puntos, detalle });
  }

  jugarCarta(jugadorId, cartaId) {
    if (this.manoTerminada) throw new Error("La mano ya terminó");
    if (this.revelacionEnvido) throw new Error("Fase de envido en curso");
    if (this.florCanto) throw new Error("Hay una flor pendiente");
    if (this.jugadorActual().id !== jugadorId) throw new Error("No es tu turno");
    if (this.estadoCanto && !this.estadoCanto.respondido) throw new Error("Hay un canto pendiente");
    if (this.bazaPendiente) throw new Error("Esperando que se resuelva la baza");
    const mano = this.manos[jugadorId];
    const idx = mano.findIndex((c) => c.id === cartaId);
    if (idx === -1) throw new Error("No tenés esa carta");
    const [carta] = mano.splice(idx, 1);
    this.cartasJugadas.push({ jugadorId, carta });
    this.siguienteTurno();
    if (this.cartasJugadas.length === this.jugadoresOrdenados().length) this.bazaPendiente = true;
    return carta;
  }

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
    // VALIDACIÓN: Solo si es tu turno
    if (this.jugadorActual().id !== jugadorId) throw new Error("No es tu turno para irte al mazo");
    if (this.revelacionEnvido) throw new Error("Fase de envido en curso");
    if (this.florCanto) throw new Error("Hay una flor pendiente");
    if (this.manoTerminada) throw new Error("La mano ya terminó");
    if (this.bazaPendiente) throw new Error("Esperando que se resuelva la baza");
    const equipo = this.equipoDe(jugadorId);
    const rival = this.rivalDe(equipo);
    const puntos = this.trucoNivel > 0 ? PUNTOS_TRUCO[NIVELES_TRUCO[this.trucoNivel - 1]] : 1;
    this.registrarAccion(jugadorId, "Me voy al mazo");
    this.registrarPuntos(rival, puntos, `${this.trucoNivel > 0 ? NIVELES_TRUCO[this.trucoNivel - 1] : "mano"} (se fueron al mazo)`);
    this.estadoCanto = null;
    this.cerrarMano(rival);
  }

    resolverBaza() {
    let mejor = this.cartasJugadas[0];
    for (const jugada of this.cartasJugadas.slice(1)) {
      if (compararCartas(jugada.carta, mejor.carta, this.muestra) > 0) mejor = jugada;
    }
    const empatados = this.cartasJugadas.filter((j) => compararCartas(j.carta, mejor.carta, this.muestra) === 0);
    const parda = empatados.length > 1;
    const equipoGanador = parda ? "parda" : this.equipoDe(mejor.jugadorId);
    
    this.bazas.push({
      equipoGanador,
      ganadorId: parda ? null : mejor.jugadorId,
      jugadas: this.cartasJugadas.map((j) => ({ jugadorId: j.jugadorId, carta: j.carta })),
    });
    this.cartasJugadas = [];

    if (this.bazas.length >= 2) this.evaluarFinDeMano();
    
    if (!this.manoTerminada) {
      const ganadorIdx = this.jugadoresOrdenados().findIndex((j) => j.id === mejor.jugadorId);
      this.turnoIndex = equipoGanador === "parda" ? this.manoIndex : ganadorIdx;
    }
  }

      evaluarFinDeMano() {
    const b1 = this.bazas[0];
    const b2 = this.bazas[1];
    const b3 = this.bazas[2];
    let ganador = null;

    // CASO 1: Dos bazas ganadas por el mismo equipo → gana ese equipo
    if (b1?.equipoGanador !== "parda" && b2?.equipoGanador === b1.equipoGanador) {
      ganador = b1.equipoGanador;
    }
    if (b1?.equipoGanador !== "parda" && b3?.equipoGanador === b1.equipoGanador) {
      ganador = b1.equipoGanador;
    }
    if (b2?.equipoGanador !== "parda" && b3?.equipoGanador === b2.equipoGanador) {
      ganador = b2.equipoGanador;
    }

    // CASO 2: Parda + Alguien gana → gana el de la segunda
    if (!ganador && b1?.equipoGanador === "parda" && b2?.equipoGanador !== "parda") {
      ganador = b2.equipoGanador;
    }

    // CASO 3: Alguien gana + Parda → gana el de la primera
    if (!ganador && b1?.equipoGanador !== "parda" && b2?.equipoGanador === "parda") {
      ganador = b1.equipoGanador;
    }

    // CASO 4: Parda + Parda → gana el equipo de la mano
    if (!ganador && b1?.equipoGanador === "parda" && b2?.equipoGanador === "parda") {
      ganador = this.equipoDe(this.jugadoresOrdenados()[this.manoIndex].id);
    }

    // CASO 5: Gana A + Gana B + Parda → gana el de la primera
    if (!ganador && this.bazas.length === 3) {
      if (b1.equipoGanador !== "parda" && b2.equipoGanador !== "parda" && b3.equipoGanador === "parda") {
        ganador = b1.equipoGanador;
      }
    }

    // CASO 6: Gana A + Gana B + Gana C (3 bazas distintas, nunca pasa en 1v1 pero por si acaso)
    if (!ganador && this.bazas.length === 3) {
      if (b1.equipoGanador !== "parda" && b2.equipoGanador !== "parda" && b3.equipoGanador !== "parda") {
        // Quien tenga más bazas, o la primera si empate
        const a = [b1, b2, b3].filter(b => b.equipoGanador === "A").length;
        const b = [b1, b2, b3].filter(b => b.equipoGanador === "B").length;
        ganador = a > b ? "A" : b > a ? "B" : b1.equipoGanador;
      }
    }

    if (ganador) {
      const motivo = this.trucoNivel > 0 ? NIVELES_TRUCO[this.trucoNivel - 1] : "mano";
      const puntos = this.trucoNivel > 0 ? PUNTOS_TRUCO[motivo] : 1;
      this.registrarPuntos(ganador, puntos, motivo);
      this.cerrarMano(ganador);
    }
  }

  // --- TRUCO: Solo el jugador con el turno puede cantar ---
  cantarTruco(jugadorId) {
    if (this.revelacionEnvido) throw new Error("Fase de envido en curso");
    if (this.florCanto) throw new Error("Hay una flor pendiente");
    if (this.estadoCanto && !this.estadoCanto.respondido) throw new Error("Hay un canto pendiente");
    if (this.bazaPendiente) throw new Error("Esperando que se resuelva la baza");
    if (this.trucoNivel >= 3) throw new Error("Ya está en vale4");
    
    const jugador = this.jugadoresOrdenados().find(j => j.id === jugadorId);
    if (!jugador) throw new Error("Jugador no encontrado");
    
    // REGLA: Solo el jugador que tiene el turno puede cantar truco
    const actual = this.jugadorActual();
    if (!actual || actual.id !== jugadorId) {
      throw new Error("No es tu turno para cantar truco");
    }
    
    const equipo = this.equipoDe(jugadorId);
    const equipoRival = this.rivalDe(equipo);
    
    // Si ya hay truco cantado (retruco/vale4), el equipo debe tener la palabra
    if (this.trucoNivel > 0) {
      if (equipo !== this.trucoPalabra) {
        throw new Error("No tenés la palabra para revirar el truco");
      }
    }
    
    this.trucoNivel += 1;
    
    const jugadores = this.jugadoresOrdenados();
    const callerIdx = jugadores.findIndex((j) => j.id === jugadorId);
    const responderIdx = (callerIdx + 1) % jugadores.length;
    this.trucoRespondeId = jugadores[responderIdx].id;
    const nextCantanteIdx = (responderIdx + 1) % jugadores.length;
    this.trucoCantanteId = jugadores[nextCantanteIdx].id;
    
    this.trucoPalabra = equipoRival;
    
    this.estadoCanto = { 
      tipo: "truco", 
      nivel: NIVELES_TRUCO[this.trucoNivel - 1], 
      equipoQueCanto: equipo, 
      equipoQueResponde: equipoRival, 
      respondido: false 
    };
    this.registrarAccion(jugadorId, TEXTO_TRUCO[NIVELES_TRUCO[this.trucoNivel - 1]]);
    return this.estadoCanto;
  }

  responderTruco(jugadorId, quiero) {
    if (!this.estadoCanto || this.estadoCanto.tipo !== "truco") throw new Error("No hay truco pendiente");
    if (this.equipoDe(jugadorId) === this.estadoCanto.equipoQueCanto) throw new Error("No podés responder tu propio canto");
    if (this.lobby.modo !== "1v1" && this.trucoRespondeId && jugadorId !== this.trucoRespondeId) {
      throw new Error("No te corresponde responder este truco");
    }
    const equipoQueCanto = this.estadoCanto.equipoQueCanto;
    const equipoQueResponde = this.rivalDe(equipoQueCanto);
    this.estadoCanto.respondido = true;
    this.registrarAccion(jugadorId, quiero ? "Quiero" : "No quiero");
    if (!quiero) {
      const nivel = NIVELES_TRUCO[this.trucoNivel - 1];
      const puntosPrevios = this.trucoNivel <= 1 ? 1 : PUNTOS_TRUCO[NIVELES_TRUCO[this.trucoNivel - 2]];
      this.registrarPuntos(equipoQueCanto, puntosPrevios, `${nivel} no querido`);
      this.estadoCanto = null;
      this.trucoRespondeId = null;
      this.cerrarMano(equipoQueCanto);
      return { quiero };
    }
    this.trucoPalabra = equipoQueResponde;
    if (this.lobby.modo !== "1v1") {
      this.trucoCantanteId = jugadorId;
      this.trucoPuedeEscalarAhora = true;
    }
    this.trucoRespondeId = null;
    this.estadoCanto = null;
    return { quiero };
  }

  algunTieneFlorSinResolver() {
    if (this.florResuelta || this.bazas.length > 0) return false;
    return this.jugadoresOrdenados().some((j) => this.tieneFlor(j.id));
  }

  envidoDisponible(jugadorId) {
    // VALIDACIÓN: Solo se puede cantar envido si es tu turno
    if (this.jugadorActual().id !== jugadorId) return false;
    if (this.envidoResuelto || this.bazas.length !== 0 || this.bazaPendiente || this.revelacionEnvido) return false;
    if (this.algunTieneFlorSinResolver()) return false;
    if (jugadorId && this.haJugadoCarta(jugadorId)) return false;
    return true;
  }

  siguientesEnvidoValidos(cadena) {
    if (!cadena || cadena.length === 0) return ["envido", "real-envido", "falta-envido"];
    const ultimo = cadena[cadena.length - 1];
    if (ultimo === "falta-envido") return [];
    const tieneReal = cadena.includes("real-envido");
    const cantEnvidos = cadena.filter((c) => c === "envido").length;
    const opciones = [];
    if (ultimo === "envido" && cantEnvidos < 2) opciones.push("envido");
    if (!tieneReal) opciones.push("real-envido");
    opciones.push("falta-envido");
    return opciones;
  }

  cantarEnvido(jugadorId, tipo) {
    if (this.florCanto) throw new Error("Hay una flor pendiente");
    const equipo = this.equipoDe(jugadorId);
    const ec = this.estadoCanto;
    if (ec && ec.tipo === "envido" && !ec.respondido) {
      if (equipo !== ec.equipoQueResponde) throw new Error("No es tu turno de responder el envido");
      if (!this.siguientesEnvidoValidos(ec.cadena).includes(tipo)) throw new Error("No podés cantar ese envido ahora");
      ec.acumuladoNoQuerido = ec.acumuladoQuerido || 1;
      if (tipo === "falta-envido") ec.esFalta = true;
      else ec.acumuladoQuerido += VALOR_ENVIDO_CANTO[tipo];
      ec.cadena.push(tipo);
      ec.nivel = tipo;
      ec.equipoQueCanto = equipo;
      ec.equipoQueResponde = this.rivalDe(equipo);
      ec.siguientes = this.siguientesEnvidoValidos(ec.cadena);
      this.registrarAccion(jugadorId, TEXTO_ENVIDO[tipo]);
      return ec;
    }
    if (this.haJugadoCarta(jugadorId)) throw new Error("No podés cantar envido: ya jugaste una carta en la ronda");
    if (!this.envidoDisponible(jugadorId)) throw new Error("Ya no se puede cantar envido en esta mano");
    if (ec && ec.tipo === "truco" && !ec.respondido) {
      this.trucoPendienteGuardado = ec;
      this.avisar("El envido va primero");
    }
    const cadena = tipo === "envido-envido" ? ["envido", "envido"] : [tipo];
    const acumulado = tipo === "falta-envido" ? 0 : tipo === "envido-envido" ? VALOR_ENVIDO_CANTO.envido * 2 : VALOR_ENVIDO_CANTO[tipo];
    this.estadoCanto = {
      tipo: "envido",
      nivel: tipo,
      cadena,
      equipoQueCanto: equipo,
      equipoQueResponde: this.rivalDe(equipo),
      acumuladoQuerido: acumulado,
      acumuladoNoQuerido: 1,
      esFalta: tipo === "falta-envido",
      siguientes: this.siguientesEnvidoValidos(cadena),
      respondido: false,
    };
    this.registrarAccion(jugadorId, TEXTO_ENVIDO[tipo]);
    return this.estadoCanto;
  }

  resolverGanadorEnvido() {
    const jugadores = this.jugadoresOrdenados();
    const n = jugadores.length;
    let mejorVal = -1, ganador = null, mejorA = -1, mejorB = -1;
    for (let k = 0; k < n; k++) {
      const j = jugadores[(this.manoIndex + k) % n];
      const val = this.calcularEnvidoJugador(j.id);
      if (j.equipo === "A") mejorA = Math.max(mejorA, val); else mejorB = Math.max(mejorB, val);
      if (val > mejorVal) { mejorVal = val; ganador = j.equipo; }
    }
    if (mejorA === mejorB && mejorA === mejorVal) {
      ganador = this.equipoDe(jugadores[this.manoIndex].id);
    }
    return { ganador, mejorA, mejorB };
  }

  aporteCarta(carta) {
    const nEf = numeroPiezaEfectivo(carta, this.muestra);
    return nEf != null ? nEf : carta.valorEnvido;
  }

  calcularTantos(cartas, usarTodas) {
    const piezas = cartas.filter((c) => esPieza(c, this.muestra));
    if (piezas.length === 0) {
      if (usarTodas) return 20 + cartas.reduce((s, c) => s + c.valorEnvido, 0);
      const porPalo = {};
      cartas.forEach((c) => { (porPalo[c.palo] = porPalo[c.palo] || []).push(c.valorEnvido); });
      let mejor = Math.max(...cartas.map((c) => c.valorEnvido));
      for (const palo in porPalo) {
        if (porPalo[palo].length >= 2) {
          const [x, y] = porPalo[palo].sort((a, b) => b - a);
          mejor = Math.max(mejor, x + y + 20);
        }
      }
      return mejor;
    }
    const mejorPieza = piezas.reduce((a, b) => (valorPiezaTantos(a, this.muestra) >= valorPiezaTantos(b, this.muestra) ? a : b));
    const resto = cartas.filter((c) => c !== mejorPieza);
    const base = valorPiezaTantos(mejorPieza, this.muestra);
    if (usarTodas) return base + resto.reduce((s, c) => s + this.aporteCarta(c), 0);
    return base + (resto.length ? Math.max(...resto.map((c) => this.aporteCarta(c))) : 0);
  }

  calcularEnvidoJugador(jugadorId) {
    const cartas = [...this.manos[jugadorId], ...this.cartasJugadas.filter((c) => c.jugadorId === jugadorId).map((c) => c.carta)];
    return this.calcularTantos(cartas, false);
  }

  responderEnvido(jugadorId, quiero) {
    const ec = this.estadoCanto;
    if (!ec || ec.tipo !== "envido") throw new Error("No hay envido pendiente");
    if (this.equipoDe(jugadorId) === ec.equipoQueCanto) throw new Error("No podés responder tu propio canto");
    ec.respondido = true;
    this.envidoResuelto = true;
    this.registrarAccion(jugadorId, quiero ? "Quiero" : "No quiero");
    if (!quiero) {
      this.registrarPuntos(ec.equipoQueCanto, ec.acumuladoNoQuerido, `${ec.nivel.replace(/-/g, " ")} no querido`);
      this.estadoCanto = null;
      if (this.trucoPendienteGuardado) { this.estadoCanto = this.trucoPendienteGuardado; this.trucoPendienteGuardado = null; }
      return { quiero, ganador: null };
    }
    const { ganador, mejorA, mejorB } = this.resolverGanadorEnvido();
    let puntos;
    if (ec.esFalta) puntos = Math.max(1, this.puntajeLimite - this.puntos[ganador]);
    else puntos = ec.acumuladoQuerido;
    this.registrarPuntos(ganador, puntos, ec.nivel.replace(/-/g, " "));
    this.estadoCanto = null;
    this.revelacionEnvido = { id: ++this.revelacionSeq, orden: this.secuenciaCantoEnvido(), ganador, puntos };
    return { quiero, ganador, mejorA, mejorB };
  }

  secuenciaCantoEnvido() {
    const jugadores = this.jugadoresOrdenados();
    const n = jugadores.length;
    const orden = [];
    let maxDicho = -1;
    let equipoLider = null;
    for (let k = 0; k < n; k++) {
      const j = jugadores[(this.manoIndex + k) % n];
      const val = this.calcularEnvidoJugador(j.id);
      if (equipoLider && j.equipo === equipoLider) continue;
      if (val > maxDicho) {
        orden.push({ jugadorId: j.id, equipo: j.equipo, texto: String(val), puntos: val });
        maxDicho = val;
        equipoLider = j.equipo;
      } else {
        orden.push({ jugadorId: j.id, equipo: j.equipo, texto: "Son buenas", puntos: null });
      }
    }
    return orden;
  }

  finalizarRevelacionEnvido() {
    this.revelacionEnvido = null;
    if (this.trucoPendienteGuardado) {
      this.estadoCanto = this.trucoPendienteGuardado;
      this.trucoPendienteGuardado = null;
    }
  }

  tieneFlor(jugadorId) {
    const cartas = this.manos[jugadorId];
    if (!cartas || cartas.length < 3) return false;
    const piezas = cartas.filter((c) => esPieza(c, this.muestra));
    const resto = cartas.filter((c) => !esPieza(c, this.muestra));
    if (piezas.length >= 2) return true;
    if (piezas.length === 1) return resto[0].palo === resto[1].palo;
    return cartas.every((c) => c.palo === cartas[0].palo);
  }

  equiposConFlor() {
    const equipos = new Set();
    for (const j of this.jugadoresOrdenados()) {
      if (this.tieneFlor(j.id)) equipos.add(this.equipoDe(j.id));
    }
    return [...equipos];
  }

  calcularFlorJugador(jugadorId) {
    return this.calcularTantos(this.manos[jugadorId], true);
  }

  resolverGanadorFlor() {
    const jugadores = this.jugadoresOrdenados();
    const n = jugadores.length;
    let mejorVal = -1, ganador = null, mejorA = -1, mejorB = -1;
    for (let k = 0; k < n; k++) {
      const j = jugadores[(this.manoIndex + k) % n];
      if (!this.tieneFlor(j.id)) continue;
      const val = this.calcularFlorJugador(j.id);
      if (j.equipo === "A") mejorA = Math.max(mejorA, val); else mejorB = Math.max(mejorB, val);
      if (val > mejorVal) { mejorVal = val; ganador = j.equipo; }
    }
    return { ganador, mejorA, mejorB };
  }

  resolverFlorContienda(nivel = "flor") {
    const { ganador } = this.resolverGanadorFlor();
    let puntos;
    if (nivel === "contraflor-al-resto") puntos = Math.max(1, this.puntajeLimite - this.puntos[ganador]);
    else puntos = PUNTOS_FLOR[nivel] ?? PUNTOS_FLOR.flor;
    this.registrarPuntos(ganador, puntos, nivel.replace(/-/g, " "));
    this.florResuelta = true;
    this.florCanto = null;
    this.estadoCanto = null;
    this.avisar(`${this.nombreDeEquipo(ganador)} ganó la flor (+${puntos})`);
    return { resuelto: true, ganador, puntos };
  }

  cantarFlor(jugadorId, tipo = "flor") {
    if (this.florResuelta) throw new Error("La flor ya se jugó esta mano");
    if (this.bazas.length > 0) throw new Error("La flor solo se canta antes de la primera baza");
    if (this.bazaPendiente) throw new Error("Esperando que se resuelva la baza");
    const equipo = this.equipoDe(jugadorId);
    const equipoRival = this.rivalDe(equipo);

    if (this.florCanto && this.florCanto.fase === "opcion") {
      if (equipo !== this.florCanto.primerEquipo) throw new Error("No es tu opción de flor");
      if (tipo === "contraflor-al-resto") {
        this.registrarAccion(jugadorId, TEXTO_FLOR["contraflor-al-resto"]);
        this.florCanto.fase = "contraflor";
        this.estadoCanto = { tipo: "flor", nivel: "contraflor-al-resto", equipoQueCanto: equipo, equipoQueResponde: equipoRival, respondido: false };
        return this.estadoCanto;
      }
      this.registrarAccion(jugadorId, "Con flor quiero");
      return this.resolverFlorContienda("flor");
    }

    if (this.florCanto && this.florCanto.fase === "esperando-rival") {
      if (equipo !== this.rivalDe(this.florCanto.primerEquipo)) throw new Error("No es tu turno de flor");
      if (!this.tieneFlor(jugadorId)) throw new Error("No tenés flor");
      this.registrarAccion(jugadorId, TEXTO_FLOR.flor);
      this.florCanto.equipos.push(equipo);
      this.florCanto.fase = "opcion";
      return this.florCanto;
    }

    if (!this.tieneFlor(jugadorId)) throw new Error("No tenés flor");
    this.envidoResuelto = true;
    this.registrarAccion(jugadorId, TEXTO_FLOR.flor);

    const rivalTieneFlor = this.equiposConFlor().includes(equipoRival);
    if (!rivalTieneFlor) {
      this.registrarPuntos(equipo, PUNTOS_FLOR.flor, "flor");
      this.florResuelta = true;
      this.estadoCanto = null;
      this.avisar(`+${PUNTOS_FLOR.flor} de flor para ${this.nombreDeEquipo(equipo)}`);
      return { resuelto: true, ganador: equipo, puntos: PUNTOS_FLOR.flor };
    }

    this.florCanto = { primerEquipo: equipo, equipos: [equipo], fase: "esperando-rival" };
    return this.florCanto;
  }

  responderFlor(jugadorId, quiero) {
    const ec = this.estadoCanto;
    if (!ec || ec.tipo !== "flor") throw new Error("No hay flor pendiente");
    if (this.equipoDe(jugadorId) === ec.equipoQueCanto) throw new Error("No podés responder tu propio canto");
    ec.respondido = true;
    this.registrarAccion(jugadorId, quiero ? "Quiero" : "No quiero");
    this.estadoCanto = null;
    if (!quiero) {
      this.registrarPuntos(ec.equipoQueCanto, PUNTOS_FLOR.flor, `${ec.nivel.replace(/-/g, " ")} no querida`);
      this.florResuelta = true;
      this.florCanto = null;
      this.avisar(`${this.nombreDeEquipo(ec.equipoQueCanto)} ganó la flor (+${PUNTOS_FLOR.flor})`);
      return { quiero, ganador: ec.equipoQueCanto };
    }
    const res = this.resolverFlorContienda(ec.nivel);
    return { quiero, ganador: res.ganador };
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
      bazas: this.bazas.map((b) => ({
        equipoGanador: b.equipoGanador,
        ganadorId: b.ganadorId ?? null,
        jugadas: b.jugadas ?? [],
      })),
      bazaPendiente: !!this.bazaPendiente,
      puntos: this.puntos,
      trucoNivel: this.trucoNivel,
      trucoPalabra: this.trucoPalabra,
      trucoCantanteId: this.trucoCantanteId,
      trucoRespondeId: this.trucoRespondeId,
      trucoPuedeEscalarAhora: this.trucoPuedeEscalarAhora,
      estadoCanto: this.estadoCanto,
      revelacionEnvido: this.revelacionEnvido,
      accionReciente: this.accionReciente,
      avisoTop: this.avisoTop,
      manoTerminada: this.manoTerminada,
      ganadorMano: this.ganadorMano,
      historialManos: this.historialManos,
      envidoDisponible: !esEspectador && this.envidoDisponible(paraJugadorId),
      tengoFlor: !esEspectador && this.bazas.length === 0 && !this.bazaPendiente && !this.florResuelta && this.tieneFlor(paraJugadorId),
      florInicial: !esEspectador && !this.florCanto && !this.florResuelta && this.bazas.length === 0 && !this.bazaPendiente
        && this.tieneFlor(paraJugadorId),
      florDeclarar: !esEspectador && !!this.florCanto && this.florCanto.fase === "esperando-rival"
        && this.equipoDe(paraJugadorId) === this.rivalDe(this.florCanto.primerEquipo) && this.tieneFlor(paraJugadorId),
      florOpcion: !esEspectador && !!this.florCanto && this.florCanto.fase === "opcion"
        && this.equipoDe(paraJugadorId) === this.florCanto.primerEquipo,
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