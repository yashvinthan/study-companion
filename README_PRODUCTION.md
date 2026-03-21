# AI Study Companion - Production-Ready Fullstack Application

🎓 **Production-grade AI-powered study companion with real Hindsight memory, multiple AI providers, and enterprise-ready infrastructure.**

## ✅ Production Features

### **100% REAL - NO DEMO OR DUMMY DATA**

- ✅ **Real AI Providers**: OpenAI, Anthropic Claude, or Groq
- ✅ **Real Hindsight Memory**: Persistent long-term memory with vector search
- ✅ **Real PostgreSQL Database**: Production-ready with connection pooling
- ✅ **Real-time Streaming**: AI responses stream in real-time
- ✅ **Production Docker**: Multi-stage builds, health checks, security hardening
- ✅ **Health Monitoring**: `/api/health` endpoint for load balancers
- ✅ **Structured Logging**: JSON logs with configurable log levels
- ✅ **Rate Limiting**: Built-in protection against abuse
- ✅ **Security**: HTTPS required, CORS configured, secrets validated

## 🚀 Quick Start (Production)

### 1. Prerequisites

- Docker & Docker Compose
- Production domain with HTTPS
- API key from OpenAI, Anthropic, or Groq
- 2GB RAM minimum, 20GB disk space

### 2. Deploy in 3 Steps

```bash
# 1. Clone and configure
git clone <your-repo-url>
cd study-companion
cp .env.production.example .env

# 2. Edit .env with your real credentials
nano .env  # Set OPENAI_API_KEY, POSTGRES_PASSWORD, etc.

# 3. Launch
docker-compose up -d
```

### 3. Verify

```bash
# Check health
curl http://localhost:3000/api/health

# Test API
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"/help"}]}'
```

**You're live! 🎉**

## 🏗️ Architecture

```
┌─────────────────┐
│   Next.js App   │ ← Production-ready React frontend
│   (Port 3000)   │ ← Streaming AI responses
└────────┬────────┘
         │
         ├─────→ ┌──────────────┐
         │       │   PostgreSQL  │ ← Real database with persistent storage
         │       │   (Port 5432) │ ← User data, quiz history, schedules
         │       └──────────────┘
         │
         ├─────→ ┌──────────────┐
         │       │   Hindsight   │ ← Real long-term memory
         │       │   (Port 8888) │ ← Vector search, RAG, reflections
         │       └──────────────┘
         │
         └─────→ ┌──────────────┐
                 │  AI Provider  │ ← OpenAI / Anthropic / Groq
                 │   (API)       │ ← Real LLM inference
                 └──────────────┘
```

## 🤖 AI Provider Options

### OpenAI (Recommended)

```bash
AI_PROVIDER=openai
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o-mini  # Cost-effective
```

**Best for**: Production apps, cost-effectiveness, reliability

### Anthropic Claude (Highest Quality)

```bash
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

**Best for**: Complex reasoning, best quality, educational content

### Groq (Fastest)

```bash
AI_PROVIDER=groq
GROQ_API_KEY=gsk_...
GROQ_MODEL=openai/gpt-oss-20b
```

**Best for**: Fast inference, free tier, development/testing

## 📊 What's Inside

### Core Features

- **Quiz Generation**: AI-generated questions with personalized difficulty
- **Mistake Tracking**: Automatic weak area identification
- **Study Planning**: AI-optimized study schedules (1-90 days)
- **Memory Retention**: Hindsight remembers everything across sessions
- **Real-time Chat**: Streaming AI responses with context awareness
- **PDF/Image Upload**: Extract text from study materials
- **Exam Tracking**: Schedule reminders for upcoming exams
- **Session Logging**: Track study time and confidence levels

### Technical Stack

- **Frontend**: Next.js 16, React 19, TailwindCSS 4
- **Backend**: Next.js API Routes, TypeScript
- **Database**: PostgreSQL 16
- **Memory**: Hindsight AI (vector database + LLM)
- **AI**: OpenAI / Anthropic / Groq
- **Deployment**: Docker, Docker Compose
- **Monitoring**: Health checks, structured logging

## 📝 Documentation

| Document | Purpose |
|----------|---------|
| [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md) | Complete deployment guide |
| [SECRETS_MANAGEMENT.md](SECRETS_MANAGEMENT.md) | Security best practices |
| [.env.production.example](.env.production.example) | Production environment template |

## 🔐 Security

- HTTPS required in production
- API keys validated (no placeholders)
- Rate limiting (40 requests/5min per user)
- CORS configured
- SQL injection protection (parameterized queries)
- XSS protection (React escaping)
- Docker security (non-root user, read-only filesystem)
- Health checks for monitoring

## 📈 Monitoring

### Health Check

```bash
curl https://your-domain.com/api/health

# Response:
{
  "status": "healthy",
  "uptime": 123456,
  "services": {
    "database": {"status": "up", "latency": 5},
    "hindsight": {"status": "up", "latency": 12}
  }
}
```

### Logs

```bash
# Structured JSON logs
docker-compose logs -f app

# Filter by level
docker-compose logs app | grep '"level":"ERROR"'
```

## 🌍 Deployment Platforms

| Platform | Guide | Difficulty |
|----------|-------|------------|
| **Docker Compose** | [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md#option-a-docker-compose-recommended-for-vps) | ⭐ Easy |
| **AWS** | Use ECS + RDS + Secrets Manager | ⭐⭐ Medium |
| **Azure** | Use Container Instances + PostgreSQL + Key Vault | ⭐⭐ Medium |
| **Google Cloud** | Use Cloud Run + Cloud SQL | ⭐⭐ Medium |
| **Railway** | Connect Git repo + Add PostgreSQL | ⭐ Easy |
| **Render** | Docker deploy + PostgreSQL addon | ⭐ Easy |
| **Fly.io** | `fly launch` + PostgreSQL | ⭐⭐ Medium |

## 💰 Cost Estimate

### Minimal Production Setup

```
OpenAI API (gpt-4o-mini): ~$5-20/month (1000-5000 users)
VPS (2GB RAM):            ~$10-20/month (DigitalOcean/Linode)
PostgreSQL (managed):     ~$15/month (Supabase/Neon)
Domain + SSL:             ~$12/year (Let's Encrypt free)
───────────────────────────────────────────────────────
Total:                    ~$30-55/month
```

### Free Tier Option

```
Groq API:                 FREE (limited rate)
PostgreSQL (Supabase):    FREE tier (500MB)
Hindsight (self-hosted):  FREE (Docker container)
Railway/Render:           FREE tier available
───────────────────────────────────────────────────────
Total:                    $0/month (with limitations)
```

## 🧪 Testing

```bash
# Run build
docker-compose build

# Start services
docker-compose up -d

# Check logs
docker-compose logs -f

# Run health check
curl http://localhost:3000/api/health

# Test chat
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"/quiz Physics"}]}'
```

## 📞 Support

- **Health Endpoint**: `/api/health`
- **Documentation**: See guides above
- **Issues**: GitHub Issues
- **Security**: security@your-domain.com

## 📄 License

MIT License - See LICENSE file

---

**Built for production. Ready to scale. No demo data. 100% real.** 🚀
