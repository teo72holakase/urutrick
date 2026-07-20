# Changelog – urutrick fixes (Jul 2026)

## Archivos modificados
| Archivo | Ruta en el proyecto |
|---|---|
| `GameEngine.js` | `backend/src/game/` |
| `handlers.js` | `backend/src/socket/` |
| `GameTable.jsx` | `frontend/src/components/Game/` |
| `global.css` | `frontend/src/styles/` |

---

## Fix 1 — Lógica de bazas con pardas (`GameEngine.js › evaluarFinDeMano`)

**Problema:** El engine esperaba siempre las 3 bazas para decidir, incluso en casos que se resuelven antes.

**Reglas aplicadas:**
- Parda en 1ra + alguien gana la 2da → gana el de la 2da **de inmediato** (sin jugar 3ra).
- Alguien gana la 1ra + parda en 2da → gana el de la 1ra **de inmediato**.
- 1 cada equipo + 3ra parda → gana el equipo **de la mano**.
- 3 pardas consecutivas → gana el equipo de la mano.

---

## Fix 2 — Empate de envido gana la mano (`GameEngine.js › resolverGanadorEnvido`)

**Problema:** En ciertos escenarios de empate de puntaje máximo entre equipos, el ganador podía quedar mal asignado.

**Fix:** El recorrido ya empieza desde `manoIndex`, por lo que el primer jugador en alcanzar el máximo siempre es el más cercano a la mano. Se agregó una guardia explícita: si `mejorA === mejorB === mejorVal`, se fuerza `ganador = equipo de la mano`, cerrando cualquier edge case.

---

## Fix 3 — Truco en equipos: control por jugador específico (`GameEngine.js`, `handlers.js`, `GameTable.jsx`)

**Problema:** Cualquier jugador del equipo con `trucoPalabra` podía cantar/revirar truco, y cualquier jugador del equipo rival podía responder.

**Reglas aplicadas y cómo se implementaron:**

- **Solo el jugador del turno puede cantar truco** (primer canto, `trucoNivel === 0`). Si intentan otro miembro del equipo, el backend lanza error.
- **Para el retruco/vale4:** el jugador que dijo "quiero y sube" es el único que puede revirar. Se rastrea con `trucoCantanteId`.
- **Solo el de la derecha responde:** al cantar truco se calcula `trucoRespondeId = jugadores[(callerIdx + 1) % n]`. Solo ese jugador puede responder. Si el timer expira, el backend usa ese mismo ID para el "no quiero" automático.
- **Cadena de truco:** `trucoCantanteId` avanza un lugar a la derecha con cada escalada → A1 canta → B1 responde/revira → A2 responde/revira → B2 responde.
- **Después de la cadena:** `turnoIndex` nunca cambió durante el truco (cartas no jugadas), así que el turno vuelve automáticamente al jugador que lo pidió primero.

---

## Fix 4 — Timer de 10 segundos para responder cantos (`handlers.js`, `GameTable.jsx`)

**Problema:** El tiempo para responder quiero/no quiero era el mismo que para jugar carta (20s).

**Fix:**
- Backend (`handlers.js`): `armarTimerJugada` detecta si hay un canto pendiente (`estadoCanto && !respondido`) y usa `TIEMPOS.responderCanto` (10s) en vez de `TIEMPOS.jugarCarta` (20s).
- Frontend (`GameTable.jsx`): el `TurnTimer` del marcador se activa también para el jugador que debe responder, mostrando 10s con su `resetKey` propia.

---

## Fix 5 — Cartas centradas en 2v2/3v3 (`global.css`)

**Problema:** Al quedar 1 o 2 cartas en la mano en modos de equipo, las cartas no se centraban respecto al nombre del jugador.

**Fix:** Se agregó `width: 100%` a `.fila-cartas` y se ajustó `align-items: flex-end`, garantizando que el `justify-content: center` funcione correctamente al achicarse la mano.

---

## Fix 6 — Reemplazar 👉 por resaltado del nombre (`GameTable.jsx`, `global.css`)

**Problema:** El indicador de turno era el emoji 👉 al lado del nombre.

**Fix:** Se eliminó `<span className="icono-turno">👉</span>` y se agregó la clase `nombre-en-turno` al `div.nombre-jugador` cuando es el turno de ese jugador. La clase CSS pinta el fondo del nombre en amarillo cálido (`#f7c948`) con borde dorado, fuerte contraste y legible sobre el paño oscuro.
