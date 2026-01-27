## OS-level security checklist

- **UFW**: `ufw allow 22/tcp`, `ufw allow 80/tcp`, `ufw allow 443/tcp`, and restrict SSH by IP if possible.
- **Fail2ban**: enable sshd and nginx jails with reasonable retry limits.
- **DDoS/WAF**: use Cloudflare proxy/WAF for real volumetric protection.
- **Log rotation**: ensure `/var/log/nginx/*.log` and PM2 logs are rotated (e.g., `logrotate` + `pm2-logrotate`).

## Frontend deployment notes

- Rebuild the frontend whenever `VITE_API_URL` changes: `npm run build` in `frontend/`.
