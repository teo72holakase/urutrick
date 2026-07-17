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
5. (Opcional, para más adelante) Creá una Database "truco" con una colección "perfiles" si querés guardar estadísticas, avatar, etc. El MVP actual solo usa el Auth de Appwrite; no hace falta DB para arrancar.
6. No hace falta API Key en el backend salvo que luego quieras validar sesiones server-side (dejé el .env preparado para eso).

## 3. Backend en Render
1. En https://render.com → **New > Web Service**, conectá tu repo de GitHub.
2. Root Directory: `backend`
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Variables de entorno (Environment):
   - `CORS_ORIGIN` = `https://tu-app.vercel.app` (lo actualizás después de crear el frontend)
   - `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID` (opcional por ahora)
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

## Qué incluye este MVP
- Registro/login con Appwrite (email + contraseña).
- Crear/unirse a lobbies 1v1, 2v2, 3v3 con contraseña opcional y opción "ver cartas del compañero".
- Sincronización de partida en tiempo real (Socket.IO): reparto, turnos, jugar cartas, truco (truco/retruco/vale4), envido/real envido/falta envido.
- Temporizador de turno: si no jugás a tiempo, tira una carta al azar; si hay un canto pendiente, responde "No quiero" automático.
- Tema claro/oscuro, selector de diseño de carta, ícono de "mano".
- Popup de reglas con tabs (Cartas / 1v1 / 2v2 / 3v3 / Cantos).

## Próximos pasos sugeridos (para pedir en el chat)
- Flor (falta implementar el canto completo).
- Reconexión tras refresh (persistir sesión de partida por usuario, hoy el id de jugador es el socket.id).
- Guardar historial y ranking en Appwrite Database.
- Animaciones de reparto/jugada.

Cuando quieras que cambie algo puntual, decime el archivo o la función y lo edito directo sin repetir todo el proyecto.
