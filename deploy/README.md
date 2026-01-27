# Deployment notes (VPS + Nginx + PM2)

1. **Frontend build**
   - Set `frontend/.env` with `VITE_API_URL=https://your-domain.example/api`.
   - Build: `cd frontend && npm run build`.
   - Copy `frontend/dist` to `/var/www/print-form/dist`.

2. **Backend build**
   - Set `backend/.env` from `backend/.env.example` with real secrets.
   - Build: `cd backend && npm run build`.
   - Migrate: `npx prisma migrate deploy`.
   - Start: `pm2 start deploy/ecosystem.config.js`.

3. **Nginx**
   - Use `deploy/nginx.conf` as a template and reload Nginx after updates.
