# Truco Uruguayo Online

Stack: **Frontend React/Vite (Vercel)** · **Backend Node/Socket.IO (Render)** · **Auth/DB (Appwrite)**

## Estructura
```
truco-uruguayo/
  frontend/   -> Vercel
  backend/    -> Render
```

## 1. Subir a GitHub
```bash
cd truco-uruguayo
git init
git add .
git commit -m "Truco uruguayo inicial"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/truco-uruguayo.git
git push -u origin main
```
Como el repo tiene frontend/ y backend/ juntos, en Render y Vercel vas a configurar el "Root Directory" de cada uno.

## 2. Configurar Appwrite (Auth + DB)
1. Entrá a https://cloud.appwrite.io (o tu instancia self-hosted) y creá un proyecto nuevo, ej. "truco-uruguayo".
2. Copiá el **Project ID** y el **Endpoint** (normalmente `https://cloud.appwrite.io/v1`).
3. En **Auth > Settings**, habilitá el método "Email/Password".
4. En **Auth > Settings > Platforms**, agregá una plataforma Web con el dominio:
   - `http://localhost:5173` (para desarrollo)
   - `https://tu-app.vercel.app` (para producción, lo agregás después del deploy)
5. Creá una **Database** llamada `truco` y anotá su **Database ID**. Adentro creá 2 colecciones:
   - **historial** (atributos: `lobbyId` string, `modo` string, `jugadores` string[] array, `equipoGanador` string, `puntosA` integer, `puntosB` integer, `fecha` string)
   - **ranking** (atributos: `userId` string, `nombre` string, `victorias` integer, `derrotas` integer)
   - En Permissions de ambas colecciones, dale acceso solo a "Server" (el backend escribe con su API Key).
6. En **Settings > API Keys**, creá una key con scopes `databases.read` y `databases.write`. Es para el backend únicamente, nunca la pongas en el frontend.

## 3. Backend en Render
1. En https://render.com → **New > Web Service**, conectá tu repo de GitHub.
2. Root Directory: `backend`
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Variables de entorno (Environment):
   - `CORS_ORIGIN` = `https://tu-app.vercel.app` (lo actualizás después de crear el frontend)
   - `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, `APPWRITE_API_KEY`, `APPWRITE_DATABASE_ID`
   - `APPWRITE_HISTORIAL_COLLECTION_ID` = `historial`, `APPWRITE_RANKING_COLLECTION_ID` = `ranking`
   - Si dejás estas variables vacías, el juego funciona igual: simplemente no guarda historial/ranking.
6. Deploy. Anotá la URL pública, ej: `https://truco-backend.onrender.com`

> Nota: el plan free de Render duerme el servicio tras inactividad, lo que puede dar un primer socket.connect() lento. Para producción real conviene un plan pago o un ping keep-alive.

## 4. Frontend en Vercel
1. En https://vercel.com → **Add New > Project**, conectá el repo.
2. Root Directory: `frontend`
3. Framework Preset: Vite
4. Variables de entorno:
   - `VITE_APPWRITE_ENDPOINT` = `https://cloud.appwrite.io/v1`
   - `VITE_APPWRITE_PROJECT_ID` = (el de tu proyecto Appwrite)
   - `VITE_BACKEND_URL` = `https://truco-backend.onrender.com` (la URL de Render del paso 3)
5. Deploy. Anotá la URL, ej: `https://truco-uruguayo.vercel.app`
6. Volvé a Render y actualizá `CORS_ORIGIN` con esa URL. Volvé a Appwrite y agregá esa URL como Platform.

## 5. Probar en local
Backend:
```bash
cd backend
cp .env.example .env   # completar CORS_ORIGIN=http://localhost:5173
npm install
npm run dev
```
Frontend:
```bash
cd frontend
cp .env.example .env   # completar VITE_BACKEND_URL=http://localhost:10000
npm install
npm run dev
```

## Qué incluye
- Registro/login solo con usuario + contraseña (Appwrite Auth por debajo, sin pedir email al jugador).
- Crear/unirse a lobbies 1v1, 2v2, 3v3 con contraseña opcional y opción "ver cartas del compañero".
- Sincronización en tiempo real: reparto, turnos, truco (truco/retruco/vale4), envido/real envido/falta envido y **Flor/Contraflor**.
- Temporizador de turno con auto-jugada / auto "no quiero" al vencerse.
- Reconexión tras refresh: la identidad del jugador es su Appwrite user ID (no el socket.id), así que si recargás la página volvés a tu mesa automáticamente.
- Historial de partidas y ranking (victorias/derrotas) guardado en Appwrite Database al terminar cada partida.
- Tema claro/oscuro con fondo de madera, selector de diseño de carta, ícono de "mano".
- Animaciones de reparto y de jugada de carta.
- Popup de reglas con tabs (Cartas / 1v1 / 2v2 / 3v3 / Cantos).

## Próximos pasos sugeridos
- Si un jugador se desconecta y nunca vuelve, su asiento queda reservado (no hay timeout de expulsión todavía).
- Pantalla de ranking/historial visible en el frontend (hoy solo se guarda en la DB).
- Sonidos y más diseños de baraja.

Cuando quieras que cambie algo puntual, decime el archivo o la función y lo edito directo sin repetir todo el proyecto.
