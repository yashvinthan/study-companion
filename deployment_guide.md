# Production Deployment Guide (Docker LXC)

Since you are hosting the AI Study Companion in a Linux Container (LXC) running Docker, here is the exact production deployment process to follow. Your [Dockerfile](file:///c:/Users/yashv/dev/Hackathon%20Problem%20Statements/hackwithbangalore-20/study-companion/Dockerfile) and [docker-compose.yml](file:///c:/Users/yashv/dev/Hackathon%20Problem%20Statements/hackwithbangalore-20/study-companion/docker-compose.yml) are already hardened and optimized for production.

## 1. LXC Prerequisites (Proxmox / generic LXC)
If you are running Docker inside an LXC, **you must enable nesting** for Docker to work properly.
- In Proxmox, edit the LXC settings: Options -> Features -> Check "Nesting".
- Ensure Docker and Docker Compose (v2) are installed inside the LXC.

## 2. Transfer Code to Server
Clone your private GitHub repository or `rsync` your code to the LXC server:
```bash
git clone <your-private-repo-url> study-companion
cd study-companion
```

## 3. Configure the Production Environment
Create a [.env](file:///c:/Users/yashv/dev/Hackathon%20Problem%20Statements/hackwithbangalore-20/study-companion/.env) file at the root of your project folder. Do **not** use default or development keys in production.
```bash
nano .env
```

Add your secure credentials:
```env
APP_PORT=3000
APP_BASE_URL=https://your-production-domain.com

# Database (Make sure the password is very strong)
POSTGRES_USER=studycompanion
POSTGRES_PASSWORD=your_super_secure_password
POSTGRES_DB=study_companion

# AI & Memory
GROQ_API_KEY=your_production_groq_key
GROQ_MODEL=openai/gpt-oss-20b
HINDSIGHT_API_KEY=your_hindsight_secure_key
HINDSIGHT_BANK_PREFIX=study-companion-prod

# Auth & Webhooks (If applicable)
OPENCLAW_WEBHOOK_SECRET=your_long_random_secret_string
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

## 4. Build and Deploy
Run Docker Compose in detached mode. This will build the multi-stage Next.js standalone container, spin up PostgreSQL, and start the Hindsight LLM memory container.
```bash
docker compose build --no-cache
docker compose up -d
```

## 5. Verify Health
Check that all containers are running and healthy. The containers have built-in health checks (`pg_isready` for Postgres, Node `fetch` for the Next app).
```bash
docker compose ps
docker compose logs -f
```

## 6. Reverse Proxy & SSL (Crucial)
Because the app binds to port `3000` over HTTP, you **must** place a reverse proxy in front of it to handle HTTPS/SSL.
### Option A: Cloudflare Tunnels (Easiest & Most Secure for LXC)
Instead of opening ports on your router/firewall, install `cloudflared` inside your LXC and point the tunnel to `http://localhost:3000`. This provides instantaneous SSL and DDoS protection.

### Option B: Nginx or Caddy
If you have a public IP, install Nginx or Caddy on the LXC to proxy requests to port 3000 and handle Let's Encrypt certificates automatically.

> [!WARNING]
> Do not expose port 5432 (Postgres) or 8888 (Hindsight) to the public internet. They are secured internally within the Docker bridge network. The only port you should proxy to the outside world is port 3000.
