# Front_react

## Frontend React - Fabrica Dona Velez

Aplicacion React con Vite, Tailwind CSS y `lucide-react`.

### Desarrollo local

1. Copia `.env.example` como `.env.local`.
2. Ajusta `VITE_API_BASE_URL` con la URL del backend FastAPI, sin agregar `/api`.
3. Ejecuta `npm install` y luego `npm run dev`.

### Produccion / Coolify

Configura `VITE_API_BASE_URL` como variable de entorno de build en Coolify y vuelve a construir la imagen. Vite inyecta las variables `VITE_*` durante el build; no uses secretos en este frontend.

El frontend ya agrega `/api` en sus rutas, por lo que la variable debe apuntar solo al origen del backend.

### Docker / Coolify

El proyecto incluye un `Dockerfile` multi-etapa y `docker-compose.yml`. La imagen compila React con Node y sirve el resultado con Nginx.

Para construir localmente:

```bash
docker build --build-arg VITE_API_BASE_URL=https://api.example.com -t front-react .
docker run --rm -p 8080:80 front-react
```

Para usar Compose, define `VITE_API_BASE_URL` en el entorno de Coolify o en un archivo local no versionado y ejecuta:

```bash
docker compose up --build
```

En Coolify selecciona Dockerfile como metodo de build, usa el puerto interno `80` y configura `VITE_API_BASE_URL` como variable disponible durante el build.
