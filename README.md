# StudyTether

Production-oriented Next.js application for study planning, quiz practice, weak-area tracking, and exam scheduling.

## Stack

- Next.js App Router
- PostgreSQL for user accounts, session storage, rate limiting, and audit-style activity events
- Hindsight for persistent study memory
- Groq for quiz generation and study-plan synthesis
- Automatic chat failover: Groq -> OpenAI -> Gemini when Groq rate limit is hit

## Routes

- `/` public landing page
- `/login` sign-in and account creation
- `/app` protected student workspace
- `/api/chat` authenticated study assistant endpoint
- `/api/dashboard` authenticated dashboard data
- `/api/profile` authenticated profile and password updates
- `/api/schedule/study` authenticated study-session logging
- `/api/schedule/exam` authenticated exam scheduling
- `/api/webhook/openclaw` optional webhook, disabled unless `OPENCLAW_WEBHOOK_SECRET` is set

## Environment

Copy `.env.example` to `.env.local` and provide real credentials:

```bash
APP_BASE_URL=http://localhost:3000

HINDSIGHT_BASE_URL=http://localhost:8888
HINDSIGHT_API_KEY=localdev
HINDSIGHT_BANK_PREFIX=studytether

GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-20b

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

POSTGRES_URL=
OPENCLAW_WEBHOOK_SECRET=
```

## Local Run

```bash
npm install
npm run dev
```

## Docker

The included `docker-compose.yml` runs the app, PostgreSQL, Hindsight, and a self-hosted SearXNG web-search service:

- no pre-provisioned users
- no seeded sample data endpoints
- no public PostgreSQL port exposure
- self-hosted open-source web search over internal Docker networking
- required secrets for PostgreSQL and Groq. Hindsight runs locally without strict auth.

Example:

```bash
$env:POSTGRES_PASSWORD="replace-with-a-long-random-password"
$env:GROQ_API_KEY="..."
$env:SEARXNG_SECRET_KEY="replace-with-a-long-random-search-secret"
docker compose up --build
```

The app is exposed on `http://localhost:3000`.

## Security Controls In App Code

- bcrypt password hashing with a 12-round cost
- minimum 12-character password policy with upper/lowercase, number, and symbol
- opaque session cookies with hashed session tokens in PostgreSQL
- `__Host-` cookie prefix in production
- session invalidation on password change
- Google OAuth 2.0 Authorization Code flow with PKCE, state, and nonce validation
- per-endpoint PostgreSQL-backed rate limiting
- origin and referer validation on browser mutation endpoints
- CSP, HSTS, frame blocking, MIME sniffing protection, and no-store headers on sensitive routes
- authenticated data access bound to the signed-in user
- OpenClaw webhook disabled by default unless an explicit secret is configured

## Production Deployment Checklist

- Put the app behind HTTPS only.
- Store secrets in your platform secret manager, not in git or images.
- Use a managed PostgreSQL instance with backups, network isolation, and SSL enforcement.
- Restrict database ingress so only the app can reach it.
- Rotate `OPENCLAW_WEBHOOK_SECRET`, database credentials, and API keys regularly.
- Add platform logging, alerting, uptime checks, and error monitoring.
- Run dependency and container image scanning in CI before deployment.

## Verification

The app should be validated before deployment with:

```bash
npm run lint
npm run build
```

You should also perform live verification with real infrastructure:

1. Create a real account through `/login`.
2. Confirm login, logout, and password rotation work across multiple browser sessions.
3. Verify study sessions, exams, quizzes, and plans persist for the signed-in user only.
4. Confirm Hindsight records are written with the expected metadata envelope.
5. Confirm the OpenClaw webhook returns `401` without a valid bearer secret.
6. Confirm Google sign-in works only with the registered callback URL `${APP_BASE_URL}/api/auth/google/callback`.
