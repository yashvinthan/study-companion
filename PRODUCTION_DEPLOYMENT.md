# Production Deployment Guide

This guide will help you deploy the AI Study Companion to production with real AI, Hindsight memory, and PostgreSQL.

## 🎯 Prerequisites

Before deploying, ensure you have:

- **Docker** and **Docker Compose** installed
- **Production domain** with HTTPS enabled
- **API Keys** from at least one AI provider (OpenAI, Anthropic, or Groq)
- **PostgreSQL database** (local or cloud-hosted like Supabase, Neon, or AWS RDS)
- **Minimum 2GB RAM** and **20GB disk space**

---

## 🚀 Quick Start (Docker Compose)

### 1. Clone and Configure

```bash
# Clone the repository
git clone <your-repo-url>
cd study-companion

# Copy environment template
cp .env.example .env

# Edit .env with your production values
nano .env
```

### 2. Set Required Environment Variables

Edit `.env` and set these **REQUIRED** values:

```bash
# Application
NODE_ENV=production
APP_BASE_URL=https://your-domain.com

# Database
POSTGRES_PASSWORD=<generate-strong-password>
POSTGRES_URL=postgres://studycompanion:<your-password>@postgres:5432/study_companion

# AI Provider (choose one)
AI_PROVIDER=openai  # or 'anthropic' or 'groq'
OPENAI_API_KEY=sk-...  # Your OpenAI API key

# Hindsight Memory
HINDSIGHT_API_KEY=<generate-random-api-key>
HINDSIGHT_API_LLM_PROVIDER=openai
HINDSIGHT_API_LLM_API_KEY=<same-as-openai-api-key-or-separate>
```

### 3. Generate Secure Secrets

```bash
# Generate PostgreSQL password
openssl rand -base64 32

# Generate Hindsight API key
openssl rand -hex 32

# Generate OpenClaw webhook secret (optional)
openssl rand -hex 32
```

### 4. Deploy with Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check health
curl http://localhost:3000/api/health
```

The application will be available at `http://localhost:3000`.

---

## 🌐 Production Deployment Options

### Option A: Docker Compose (Recommended for VPS)

Best for: **DigitalOcean, Linode, AWS EC2, Azure VM**

```bash
# Start production services
docker-compose up -d

# Set up reverse proxy (nginx)
sudo nano /etc/nginx/sites-available/study-companion

# Add SSL with Let's Encrypt
sudo certbot --nginx -d your-domain.com
```

### Option B: Kubernetes

Best for: **AWS EKS, Google GKE, Azure AKS**

```bash
# Create secrets
kubectl create secret generic study-companion-secrets \
  --from-literal=postgres-password=<your-password> \
  --from-literal=openai-api-key=<your-key> \
  --from-literal=hindsight-api-key=<your-key>

# Apply manifests
kubectl apply -f k8s/
```

### Option C: Platform as a Service

Best for: **Railway, Render, Fly.io, Heroku**

1. **Connect your Git repository**
2. **Set environment variables** in the platform dashboard
3. **Add PostgreSQL addon** (or use external database)
4. **Deploy Hindsight** as a separate service
5. **Deploy the app**

---

## 🔑 AI Provider Setup

### OpenAI (Recommended for Production)

```bash
AI_PROVIDER=openai
OPENAI_API_KEY=sk-proj-...  # Get from https://platform.openai.com/api-keys
OPENAI_MODEL=gpt-4o-mini  # or 'gpt-4o' for better quality
```

**Recommended for:**
- Production applications
- High-quality responses
- Cost-effective with gpt-4o-mini

### Anthropic Claude (Best Quality)

```bash
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...  # Get from https://console.anthropic.com/
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

**Recommended for:**
- Best reasoning quality
- Complex educational content
- Higher cost, best results

### Groq (Fastest, Free Tier)

```bash
AI_PROVIDER=groq
GROQ_API_KEY=gsk_...  # Get from https://console.groq.com/
GROQ_MODEL=openai/gpt-oss-20b
```

**Recommended for:**
- Fast inference
- Development/testing
- Free tier available

---

## 💾 Database Configuration

### Option 1: Docker Compose PostgreSQL (Included)

```bash
# Already configured in docker-compose.yml
POSTGRES_URL=postgres://studycompanion:<password>@postgres:5432/study_companion
```

### Option 2: Managed PostgreSQL (Recommended for Production)

**Supabase:**
```bash
POSTGRES_URL=postgresql://postgres:<password>@db.<project>.supabase.co:5432/postgres
```

**Neon:**
```bash
POSTGRES_URL=postgresql://<user>:<password>@<endpoint>.neon.tech/neondb
```

**AWS RDS:**
```bash
POSTGRES_URL=postgresql://<user>:<password>@<instance>.rds.amazonaws.com:5432/study_companion
```

---

## 🧠 Hindsight Memory Setup

### Option 1: Docker Compose (Included)

Hindsight runs as a service in docker-compose.yml:

```yaml
hindsight:
  image: ghcr.io/vectorize-io/hindsight:latest
  environment:
    HINDSIGHT_API_LLM_PROVIDER: openai
    HINDSIGHT_API_LLM_API_KEY: ${OPENAI_API_KEY}
```

### Option 2: Separate Hindsight Instance

Deploy Hindsight separately and point to it:

```bash
HINDSIGHT_BASE_URL=https://hindsight.your-domain.com
HINDSIGHT_API_KEY=<your-secure-key>
```

---

## 🔒 Security Checklist

- [ ] Use **HTTPS** in production (APP_BASE_URL must be https://)
- [ ] Generate **strong passwords** for PostgreSQL (min 32 characters)
- [ ] Use **real API keys** (no placeholder values)
- [ ] Enable **rate limiting** (already configured in code)
- [ ] Set **NODE_ENV=production**
- [ ] Configure **CORS** properly (already configured)
- [ ] Use **secret management** (AWS Secrets Manager, Azure Key Vault, etc.)
- [ ] Enable **health checks** (`/api/health`)
- [ ] Set up **monitoring** (see Monitoring section)

---

## 📊 Monitoring & Observability

### Health Check Endpoint

```bash
curl https://your-domain.com/api/health

# Response:
{
  "status": "healthy",
  "timestamp": "2026-03-21T10:30:00Z",
  "uptime": 123456,
  "services": {
    "database": { "status": "up", "latency": 5 },
    "hindsight": { "status": "up", "latency": 12 }
  }
}
```

### Logging

Logs are structured JSON for easy parsing:

```bash
# View application logs
docker-compose logs -f app

# Filter errors only
docker-compose logs app | grep '"level":"ERROR"'
```

### Metrics (Optional)

Set up metrics collection:

```bash
METRICS_ENABLED=true
```

### Error Tracking (Optional)

Integrate Sentry for error tracking:

```bash
SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project>
```

---

## 🔄 Continuous Deployment

### GitHub Actions Example

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build and push Docker image
        run: |
          docker build -t study-companion:latest .
          docker push study-companion:latest

      - name: Deploy to server
        run: |
          ssh user@server 'cd /app && docker-compose pull && docker-compose up -d'
```

---

## 🧪 Testing Production Setup

### 1. Health Check

```bash
curl https://your-domain.com/api/health
```

### 2. Chat API Test

```bash
curl -X POST https://your-domain.com/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"/help"}]}'
```

### 3. Database Connection

```bash
docker-compose exec app node -e "
  const { pool } = require('./src/lib/postgres');
  pool.query('SELECT NOW()').then(r => console.log(r.rows[0]));
"
```

---

## 🚨 Troubleshooting

### App won't start

```bash
# Check logs
docker-compose logs app

# Verify environment variables
docker-compose exec app env | grep -E "POSTGRES|OPENAI|HINDSIGHT"

# Test database connection
docker-compose exec postgres psql -U studycompanion -d study_companion
```

### Hindsight connection fails

```bash
# Check Hindsight is running
docker-compose ps hindsight

# Check Hindsight logs
docker-compose logs hindsight

# Verify API key
docker-compose exec app curl http://hindsight:8888/health
```

### AI provider errors

```bash
# Verify API key is valid
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Check rate limits
docker-compose logs app | grep "rate limit"
```

---

## 📈 Scaling Considerations

### Horizontal Scaling

- Deploy multiple app instances behind a load balancer
- Use managed PostgreSQL with connection pooling
- Deploy Hindsight as a separate, scalable service

### Vertical Scaling

- Increase container resources in docker-compose.yml
- Optimize database with indexes
- Use caching for frequently accessed data

### Cost Optimization

- Use gpt-4o-mini instead of gpt-4o (10x cheaper)
- Enable Groq for non-critical operations (free tier)
- Implement request caching
- Set up monitoring for API usage

---

## 🎓 Google OAuth Setup (Optional)

If enabling Google OAuth authentication:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `https://your-domain.com/api/auth/google/callback`
6. Set environment variables:

```bash
GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<your-client-secret>
```

---

## 📞 Support & Resources

- **Health Check:** `/api/health`
- **Documentation:** `/docs`
- **GitHub Issues:** https://github.com/your-repo/issues
- **OpenAI Docs:** https://platform.openai.com/docs
- **Hindsight Docs:** https://vectorize.io/hindsight

---

## ✅ Post-Deployment Checklist

- [ ] Health check returns "healthy"
- [ ] Chat API responds correctly
- [ ] Database schema is migrated
- [ ] Hindsight memory is working
- [ ] AI provider is responding
- [ ] HTTPS is enabled
- [ ] Monitoring is set up
- [ ] Backups are configured
- [ ] Rate limiting is active
- [ ] Error tracking is working

**You're ready for production! 🚀**
