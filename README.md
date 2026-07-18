<p align="center">
  <img src="./urutrick-banner.png" alt="UruTrick" width="100%" />
</p>

<p align="center">
  Truco uruguayo online, en tiempo real, para jugar 1v1, 2v2 o 3v3.
</p>

<p align="center">
  <b>React + Vite</b> · <b>Node + Socket.IO</b> · <b>Appwrite</b>
</p>

---

## ✨ Qué incluye

- 🔐 Registro/login solo con usuario y contraseña
- 🃏 Mesas 1v1, 2v2 y 3v3, con contraseña opcional y opción de ver las cartas del compañero
- ⚡ Sincronización en tiempo real: reparto, turnos, truco/retruco/vale4, envido/real envido/falta envido y flor/contraflor
- ⏱️ Temporizador de turno, con auto-jugada al vencerse
- 🔄 Reconexión automática tras refrescar la página
- 📊 Historial de partidas y ranking guardados en Appwrite
- 🌗 Tema claro/oscuro y animaciones de reparto y jugada

## 📁 Estructura

```
urutrick/
  frontend/   → Vercel (React + Vite)
  backend/    → Render (Node + Socket.IO)
```

## 🚀 Correr en local

**Backend**
```bash
cd backend
cp .env.example .env   # CORS_ORIGIN=http://localhost:5173
npm install
npm run dev
```

**Frontend**
```bash
cd frontend
cp .env.example .env   # VITE_BACKEND_URL=http://localhost:10000
npm install
npm run dev
```

## ☁️ Deploy

<details>
<summary><b>1. Appwrite (Auth + DB)</b></summary>

1. Creá un proyecto en [Appwrite Cloud](https://cloud.appwrite.io) (o tu instancia self-hosted) y copiá el **Project ID** y el **Endpoint**.
2. En **Auth → Settings**, habilitá el método "Email/Password".
3. En **Auth → Settings → Platforms**, agregá una plataforma Web con `http://localhost:5173` y, luego del deploy, tu dominio de producción.
4. Creá una **Database** (ej. `truco`) con dos colecciones:
   - `historial`: `lobbyId` (string), `modo` (string), `jugadores` (string[]), `equipoGanador` (string), `puntosA` (integer), `puntosB` (integer), `fecha` (string)
   - `ranking`: `userId` (string), `nombre` (string), `victorias` (integer), `derrotas` (integer)
   - Permisos: acceso solo para "Server" en ambas.
5. En **Settings → API Keys**, creá una key con scopes `databases.read` y `databases.write` (solo para el backend, nunca en el frontend).

</details>

<details>
<summary><b>2. Backend en Render</b></summary>

1. **New → Web Service**, conectá el repo con Root Directory `backend`.
2. Build Command: `npm install` · Start Command: `npm start`
3. Variables de entorno: `CORS_ORIGIN`, `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, `APPWRITE_API_KEY`, `APPWRITE_DATABASE_ID`, `APPWRITE_HISTORIAL_COLLECTION_ID=historial`, `APPWRITE_RANKING_COLLECTION_ID=ranking`
4. Si dejás las variables de Appwrite vacías, el juego funciona igual, solo que sin guardar historial/ranking.

> El plan free de Render duerme el servicio tras inactividad, lo que puede hacer lento el primer `connect()`. Para producción conviene un plan pago o un ping keep-alive.

</details>

<details>
<summary><b>3. Frontend en Vercel</b></summary>

1. **Add New → Project**, conectá el repo con Root Directory `frontend` y Framework Preset `Vite`.
2. Variables de entorno: `VITE_APPWRITE_ENDPOINT`, `VITE_APPWRITE_PROJECT_ID`, `VITE_BACKEND_URL` (la URL de Render).
3. Deploy, y luego volvé a actualizar `CORS_ORIGIN` en Render y las Platforms en Appwrite con la URL final de Vercel.

</details>

## 🔭 Próximos pasos

- Timeout de expulsión para jugadores desconectados que no vuelven
- Pantalla de ranking/historial en el frontend (hoy solo vive en la DB)
- Sonidos y más diseños de baraja
