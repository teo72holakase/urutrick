import { crearMazo, barajar, compararCartas, esPieza, numeroPiezaEfectivo, valorPiezaTantos } from "./Deck.js";

const PUNTOS_TRUCO = { truco: 2, retruco: 3, vale4: 4 };
const NIVELES_TRUCO = ["truco", "retruco", "vale4"];
const VALOR_ENVIDO_CANTO = { envido: 2, "real-envido": 3 };
const PUNTOS_FLOR = { flor: 3, contraflor: 6, "contraflor-al-resto": null };

export class GameEngine {
  constructor(lobby) {
    this.lobby = lobby;
    this.puntajeLimite = lobby.puntajeLimite || 30;
    this.puntos = { A: 0, B: 0 };
    this.manoIndex = 0;
    this.historialManos = [];
    this.revelacionSeq = 0;
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
    this.revelacionEnvido = null; // sub-estado FASE_ENVIDO: canto de tantos en curso
    this.manoTerminada = false;
    this.ganadorMano = null;
  }

  // Un jugador "ya jugó" si tiene una carta en la baza en curso o en una resuelta.
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
    const detalleGanador = this.detalleManoActual.filter((d) => d.equipo === ganador);
    const puntos = detalleGanador.reduce((s, d) => s + d.puntos, 0);
    this.historialManos.push({ numero: this.historialManos.length + 1, ganador, puntos, detalle: detalleGanador });
  }

  // --- Jugar carta ---
  jugarCarta(jugadorId, cartaId) {
    if (this.revelacionEnvido) throw new Error("Fase de envido en curso");
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
    if (this.revelacionEnvido) throw new Error("Fase de envido en curso");
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
      if (compararCartas(jugada.carta, mejor.carta, this.muestra) > 0) mejor = jugada;
    }
    const empatados = this.cartasJugadas.filter((j) => compararCartas(j.carta, mejor.carta, this.muestra) === 0);
    const parda = empatados.length > 1;
    const equipoGanador = parda ? "parda" : this.equipoDe(mejor.jugadorId);
    // Guardamos las cartas de la baza y quién ganó, para poder mostrar el historial
    // de bazas jugadas (carta ganadora encima de la perdedora) en el cliente.
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
    if (this.revelacionEnvido) throw new Error("Fase de envido en curso");
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

  envidoDisponible(jugadorId) {
    // Se puede cantar durante la primera ronda (primera baza) SOLO si quien canta
    // no jugó todavía ninguna carta. Deja de estar disponible en la 2da ronda
    // (this.bazas.length > 0), si ya se resolvió, si hay revelación en curso o si
    // hay una flor sin resolver todavía.
    if (this.envidoResuelto || this.bazas.length !== 0 || this.bazaPendiente || this.revelacionEnvido) return false;
    if (this.algunTieneFlorSinResolver()) return false;
    if (jugadorId && this.haJugadoCarta(jugadorId)) return false;
    return true;
  }

  // Qué cantos de envido se pueden encadenar a partir de la cadena actual.
  // Escalada: Envido → Envido (una sola vez más) → Real Envido → Falta Envido.
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

  // Sirve tanto para el primer canto como para las subidas (revirar). Si ya hay un
  // envido pendiente, este canto se trata como una escalada: NO se resuelve, queda
  // pendiente para que responda el otro equipo (ahí aparece Quiero/No quiero/subir).
  cantarEnvido(jugadorId, tipo) {
    const equipo = this.equipoDe(jugadorId);
    const ec = this.estadoCanto;
    if (ec && ec.tipo === "envido" && !ec.respondido) {
      if (equipo !== ec.equipoQueResponde) throw new Error("No es tu turno de responder el envido");
      if (!this.siguientesEnvidoValidos(ec.cadena).includes(tipo)) throw new Error("No podés cantar ese envido ahora");
      ec.acumuladoNoQuerido = ec.acumuladoQuerido || 1; // rechazar ahora paga lo ya acumulado
      if (tipo === "falta-envido") ec.esFalta = true;
      else ec.acumuladoQuerido += VALOR_ENVIDO_CANTO[tipo];
      ec.cadena.push(tipo);
      ec.nivel = tipo;
      ec.equipoQueCanto = equipo;
      ec.equipoQueResponde = this.rivalDe(equipo);
      ec.siguientes = this.siguientesEnvidoValidos(ec.cadena);
      return ec;
    }
    if (this.haJugadoCarta(jugadorId)) throw new Error("No podés cantar envido: ya jugaste una carta en la ronda");
    if (!this.envidoDisponible(jugadorId)) throw new Error("Ya no se puede cantar envido en esta mano");
    const cadena = [tipo];
    this.estadoCanto = {
      tipo: "envido",
      nivel: tipo,
      cadena,
      equipoQueCanto: equipo,
      equipoQueResponde: this.rivalDe(equipo),
      acumuladoQuerido: tipo === "falta-envido" ? 0 : VALOR_ENVIDO_CANTO[tipo],
      acumuladoNoQuerido: 1,
      esFalta: tipo === "falta-envido",
      siguientes: this.siguientesEnvidoValidos(cadena),
      respondido: false,
    };
    return this.estadoCanto;
  }

  // Gana el envido el puntaje más alto; en caso de empate gana el equipo del
  // jugador "mano" (o el más cercano a la mano). Se recorre en orden de mano.
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
    return { ganador, mejorA, mejorB };
  }

  // Aporte de una carta como "acompañante" del conteo: si es pieza, su cartón
  // (número efectivo); si es común, su valor de envido (10,11,12 = 0).
  aporteCarta(carta) {
    const nEf = numeroPiezaEfectivo(carta, this.muestra);
    return nEf != null ? nEf : carta.valorEnvido;
  }

  // Conteo de tantos. Con piezas se rompe el +20: se toma el valor fijo de la pieza
  // mayor y se le suman los aportes de las otras cartas (una para el envido, las dos
  // restantes para la flor). Sin piezas, envido tradicional / flor = 20 + suma.
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
    if (!quiero) {
      this.registrarPuntos(ec.equipoQueCanto, ec.acumuladoNoQuerido, `${ec.nivel.replace(/-/g, " ")} no querido`);
      this.estadoCanto = null;
      return { quiero, ganador: null };
    }
    const { ganador, mejorA, mejorB } = this.resolverGanadorEnvido();
    let puntos;
    if (ec.esFalta) puntos = Math.max(1, this.puntajeLimite - this.puntos[ganador]);
    else puntos = ec.acumuladoQuerido;
    this.registrarPuntos(ganador, puntos, ec.nivel.replace(/-/g, " "));
    this.estadoCanto = null;
    // FASE_ENVIDO: se entra en la revelación (canto de tantos secuencial) que
    // bloquea el juego hasta que el servidor la cierra.
    this.revelacionEnvido = { id: ++this.revelacionSeq, orden: this.secuenciaCantoEnvido(), ganador, puntos };
    return { quiero, ganador, mejorA, mejorB };
  }

  // Orden en que los jugadores "cantan" sus tantos, empezando por el mano y
  // girando alrededor de la mesa. Cada jugador dice su número si supera al mayor
  // dicho hasta el momento; si no puede superarlo dice "Son buenas" (sin revelar
  // su número); y si un compañero suyo ya va ganando, ni habla.
  secuenciaCantoEnvido() {
    const jugadores = this.jugadoresOrdenados();
    const n = jugadores.length;
    const orden = [];
    let maxDicho = -1;
    let equipoLider = null;
    for (let k = 0; k < n; k++) {
      const j = jugadores[(this.manoIndex + k) % n];
      const val = this.calcularEnvidoJugador(j.id);
      if (equipoLider && j.equipo === equipoLider) continue; // compañero del líder: calla
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
  }

  // --- Flor ---
  // Hay flor si las 3 cartas forman "mismo palo" usando las piezas (palo de la
  // muestra) como comodín. Cubre: 3 del mismo palo · 1 pieza + 2 del mismo palo ·
  // 2 piezas + 1 cualquiera · 3 piezas.
  tieneFlor(jugadorId) {
    const cartas = this.manos[jugadorId];
    if (!cartas || cartas.length < 3) return false;
    const piezas = cartas.filter((c) => esPieza(c, this.muestra));
    const resto = cartas.filter((c) => !esPieza(c, this.muestra));
    if (piezas.length >= 2) return true;                 // 2 piezas + 1 cualquiera
    if (piezas.length === 1) return resto[0].palo === resto[1].palo; // 1 pieza + 2 del mismo palo
    return cartas.every((c) => c.palo === cartas[0].palo); // sin piezas: 3 del mismo palo
  }

  // Equipos (distintos) que tienen al menos un jugador con flor.
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

  // Gana la flor la más alta; empate → equipo del jugador mano (orden de mano).
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

  cantarFlor(jugadorId, tipo = "flor") {
    if (this.florResuelta) throw new Error("La flor ya se jugó esta mano");
    if (this.bazas.length > 0) throw new Error("La flor solo se canta antes de la primera baza");
    if (this.bazaPendiente) throw new Error("Esperando que se resuelva la baza");
    if (!this.tieneFlor(jugadorId)) throw new Error("No tenés flor");
    const equipo = this.equipoDe(jugadorId);
    const equipoRival = this.rivalDe(equipo);
    this.envidoResuelto = true; // la flor "mata" al envido

    // Si el otro equipo NO tiene flor: son 3 puntos automáticos para el equipo con
    // flor (aunque tenga dos jugadores con flor, siguen siendo 3 en total).
    const rivalTieneFlor = this.equiposConFlor().includes(equipoRival);
    if (!rivalTieneFlor) {
      this.registrarPuntos(equipo, PUNTOS_FLOR.flor, "flor");
      this.florResuelta = true;
      this.estadoCanto = null;
      return { resuelto: true, ganador: equipo, puntos: PUNTOS_FLOR.flor };
    }

    // Ambos equipos tienen flor: se juega la contienda (envido de flor / contraflor)
    // para definir quién se lleva los puntos.
    this.estadoCanto = { tipo: "flor", nivel: tipo, equipoQueCanto: equipo, equipoQueResponde: equipoRival, respondido: false };
    return this.estadoCanto;
  }

  responderFlor(jugadorId, quiero) {
    const ec = this.estadoCanto;
    if (!ec || ec.tipo !== "flor") throw new Error("No hay flor pendiente");
    if (this.equipoDe(jugadorId) === ec.equipoQueCanto) throw new Error("No podés responder tu propio canto");
    ec.respondido = true;
    this.florResuelta = true;
    if (!quiero) {
      // No se juega la contienda: el que cantó se lleva los 3 de su flor.
      this.registrarPuntos(ec.equipoQueCanto, PUNTOS_FLOR.flor, `${ec.nivel.replace(/-/g, " ")} no querida`);
      this.estadoCanto = null;
      return { quiero, ganador: null };
    }
    const { ganador, mejorA, mejorB } = this.resolverGanadorFlor();
    let puntos;
    if (ec.nivel === "contraflor-al-resto") puntos = Math.max(1, this.puntajeLimite - this.puntos[ganador]);
    else puntos = PUNTOS_FLOR[ec.nivel] ?? PUNTOS_FLOR.flor;
    this.registrarPuntos(ganador, puntos, ec.nivel.replace(/-/g, " "));
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
      bazas: this.bazas.map((b) => ({
        equipoGanador: b.equipoGanador,
        ganadorId: b.ganadorId ?? null,
        jugadas: b.jugadas ?? [],
      })),
      bazaPendiente: !!this.bazaPendiente,
      puntos: this.puntos,
      trucoNivel: this.trucoNivel,
      trucoPalabra: this.trucoPalabra,
      estadoCanto: this.estadoCanto,
      revelacionEnvido: this.revelacionEnvido,
      manoTerminada: this.manoTerminada,
      ganadorMano: this.ganadorMano,
      historialManos: this.historialManos,
      envidoDisponible: !esEspectador && this.envidoDisponible(paraJugadorId),
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