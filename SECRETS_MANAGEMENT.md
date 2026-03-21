# Production Secrets Management Guide

This guide covers best practices for managing sensitive credentials in production.

## 🔑 Secrets Overview

The application requires these secrets:

| Secret | Purpose | Required | Example |
|--------|---------|----------|---------|
| `POSTGRES_PASSWORD` | Database access | ✅ Yes | `openssl rand -base64 32` |
| `POSTGRES_URL` | Database connection | ✅ Yes | `postgres://user:pass@host:5432/db` |
| `OPENAI_API_KEY` | AI provider | ✅ Yes (if using OpenAI) | `sk-proj-...` |
| `ANTHROPIC_API_KEY` | AI provider | ✅ Yes (if using Anthropic) | `sk-ant-...` |
| `GROQ_API_KEY` | AI provider | ✅ Yes (if using Groq) | `gsk_...` |
| `HINDSIGHT_API_KEY` | Memory service auth | ✅ Yes | `openssl rand -hex 32` |
| `GOOGLE_CLIENT_SECRET` | OAuth authentication | ⚠️ Optional | From Google Cloud Console |
| `OPENCLAW_WEBHOOK_SECRET` | Webhook verification | ⚠️ Optional | `openssl rand -hex 32` |

---

## 🚨 Security Principles

### ❌ NEVER Do This

```bash
# Don't commit secrets to Git
API_KEY=sk-proj-abc123  # ❌ NO!

# Don't use placeholder values in production
HINDSIGHT_API_KEY=your_api_key_here  # ❌ NO!

# Don't log secrets
console.log('API Key:', process.env.OPENAI_API_KEY)  # ❌ NO!

# Don't share .env files
git add .env  # ❌ NO!
```

### ✅ ALWAYS Do This

```bash
# Use .env.example for templates (no real secrets)
# Use .env for local development (git-ignored)
# Use secret management for production
# Rotate secrets regularly
# Use minimum required permissions
```

---

## 🔐 Generating Secure Secrets

### PostgreSQL Password

```bash
# Generate a 32-character password
openssl rand -base64 32

# Or use a password manager
```

### Hindsight API Key

```bash
# Generate a 64-character hex key
openssl rand -hex 32

# Example output:
# 8f7d9c2b4e6a1f3d5c8b7a9e2d4f6c8b1a3e5d7f9c2b4e6a8d1f3c5b7a9e2d4f
```

### OpenClaw Webhook Secret

```bash
# Generate a random secret
openssl rand -hex 32
```

---

## 🏢 Production Secret Management

### Option 1: Environment Variables (Basic)

Best for: **Small deployments, VPS**

```bash
# Set in your .env file (not committed)
OPENAI_API_KEY=sk-proj-...
POSTGRES_PASSWORD=<strong-password>

# Or set directly in Docker Compose
docker-compose up -d
```

**Pros:**
- Simple setup
- No additional tooling

**Cons:**
- Secrets visible in process list
- No rotation automation
- No audit trail

---

### Option 2: Docker Secrets (Docker Swarm)

Best for: **Docker Swarm clusters**

```bash
# Create secrets
echo "sk-proj-..." | docker secret create openai_api_key -
echo "<password>" | docker secret create postgres_password -

# Use in docker-compose.yml
version: '3.9'
services:
  app:
    secrets:
      - openai_api_key
      - postgres_password
    environment:
      OPENAI_API_KEY_FILE: /run/secrets/openai_api_key

secrets:
  openai_api_key:
    external: true
  postgres_password:
    external: true
```

**Pros:**
- Encrypted at rest
- Secure distribution
- Built into Docker

**Cons:**
- Requires Docker Swarm
- Manual rotation

---

### Option 3: AWS Secrets Manager

Best for: **AWS deployments**

#### Setup:

```bash
# Install AWS CLI
aws configure

# Store secrets
aws secretsmanager create-secret \
  --name study-companion/openai-api-key \
  --secret-string "sk-proj-..."

aws secretsmanager create-secret \
  --name study-companion/postgres-password \
  --secret-string "<strong-password>"
```

#### Retrieve in Code:

```typescript
// src/lib/secrets.ts
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: 'us-east-1' });

export async function getSecret(secretName: string): Promise<string> {
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretName })
  );
  return response.SecretString || '';
}

// Usage
const apiKey = await getSecret('study-companion/openai-api-key');
```

**Pros:**
- Automatic rotation
- Audit trail
- Fine-grained access control
- Encryption at rest

**Cons:**
- AWS-specific
- Additional cost ($0.40/secret/month)

---

### Option 4: Azure Key Vault

Best for: **Azure deployments**

```bash
# Create Key Vault
az keyvault create \
  --name study-companion-vault \
  --resource-group my-resource-group \
  --location eastus

# Store secrets
az keyvault secret set \
  --vault-name study-companion-vault \
  --name openai-api-key \
  --value "sk-proj-..."

# Grant access to your app
az keyvault set-policy \
  --name study-companion-vault \
  --object-id <app-identity> \
  --secret-permissions get list
```

**Pros:**
- Azure-native integration
- RBAC support
- Automatic rotation
- Audit logging

**Cons:**
- Azure-specific
- Additional cost

---

### Option 5: HashiCorp Vault

Best for: **Multi-cloud, hybrid deployments**

```bash
# Start Vault server
vault server -dev

# Store secrets
vault kv put secret/study-companion \
  openai_api_key=sk-proj-... \
  postgres_password=<password>

# Retrieve secrets
vault kv get -field=openai_api_key secret/study-companion
```

**Pros:**
- Cloud-agnostic
- Dynamic secrets
- Lease management
- Audit trail

**Cons:**
- Self-hosted complexity
- Additional infrastructure

---

### Option 6: Kubernetes Secrets

Best for: **Kubernetes deployments**

```bash
# Create secret
kubectl create secret generic study-companion-secrets \
  --from-literal=openai-api-key=sk-proj-... \
  --from-literal=postgres-password=<password>

# Use in deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: study-companion
spec:
  template:
    spec:
      containers:
      - name: app
        env:
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: study-companion-secrets
              key: openai-api-key
```

**Pros:**
- Native Kubernetes integration
- Namespace isolation
- Base64 encoded

**Cons:**
- Not encrypted by default (use sealed-secrets)
- Manual rotation

---

## 🔄 Secret Rotation

### OpenAI API Keys

1. Create new API key in OpenAI dashboard
2. Update secret in your secret manager
3. Restart application
4. Verify new key works
5. Delete old key from OpenAI

### Database Passwords

```bash
# 1. Create new password
NEW_PASSWORD=$(openssl rand -base64 32)

# 2. Update PostgreSQL user
psql -c "ALTER USER studycompanion PASSWORD '$NEW_PASSWORD';"

# 3. Update secret in environment
# 4. Restart application with new password
# 5. Verify connection works
```

### Hindsight API Key

Since this is internal, rotation is simpler:

```bash
# 1. Generate new key
NEW_KEY=$(openssl rand -hex 32)

# 2. Update HINDSIGHT_API_KEY
# 3. Restart both app and Hindsight
```

---

## 📋 Secret Rotation Schedule

| Secret | Rotation Frequency | Method |
|--------|-------------------|--------|
| `OPENAI_API_KEY` | 90 days | Manual via dashboard |
| `POSTGRES_PASSWORD` | 90 days | Automated with Vault |
| `HINDSIGHT_API_KEY` | 180 days | Manual regeneration |
| `GOOGLE_CLIENT_SECRET` | 365 days | Manual via Google Console |
| `OPENCLAW_WEBHOOK_SECRET` | 180 days | Manual regeneration |

---

## 🛡️ Security Best Practices

### 1. Principle of Least Privilege

```bash
# Give app only permissions it needs
# Read-only access to secrets
# No admin permissions
```

### 2. Audit Logging

```bash
# Enable audit logs for secret access
# Monitor for unauthorized access
# Alert on unusual patterns
```

### 3. Network Segmentation

```bash
# Keep secrets in private network
# Use VPC/private endpoints
# No public internet access to secret stores
```

### 4. Encryption

```bash
# Secrets encrypted at rest
# TLS for secrets in transit
# Use HSM for key management
```

### 5. Secret Scanning

```bash
# Use tools like:
# - GitHub Secret Scanning
# - GitGuardian
# - TruffleHog

# Example: TruffleHog scan
docker run --rm -v $(pwd):/repo trufflesecurity/trufflehog:latest \
  filesystem /repo
```

---

## 🔍 Detecting Leaked Secrets

### GitHub Secret Scanning

GitHub automatically scans for leaked secrets. If detected:

1. Immediately rotate the compromised secret
2. Revoke the leaked key
3. Audit access logs
4. Investigate how it was leaked

### Manual Checks

```bash
# Check Git history for secrets
git log -p | grep -i "api_key\|password\|secret"

# Check for common patterns
grep -r "sk-proj-\|sk-ant-\|gsk_" .

# Use automated tools
npm install -g git-secrets
git secrets --scan
```

---

## 🚀 Quick Reference

### Development (.env.local)

```bash
# Use test/dev API keys
OPENAI_API_KEY=sk-proj-test...
POSTGRES_PASSWORD=dev_password_123
```

### Staging (.env.staging)

```bash
# Use separate staging keys
OPENAI_API_KEY=sk-proj-staging...
POSTGRES_PASSWORD=<staging-password>
```

### Production (Secret Manager)

```bash
# NEVER use .env in production
# ALWAYS use secret manager
# ALWAYS rotate regularly
```

---

## ✅ Security Checklist

- [ ] No secrets in Git repository
- [ ] .env is in .gitignore
- [ ] Production uses secret manager
- [ ] Secrets are rotated regularly
- [ ] Audit logging is enabled
- [ ] Least privilege access
- [ ] TLS/encryption enabled
- [ ] Secret scanning configured
- [ ] Incident response plan exists
- [ ] Team trained on security

---

## 📞 Emergency Response

### If a Secret is Leaked:

1. **Immediately rotate** the compromised secret
2. **Revoke** the old secret from provider
3. **Audit** access logs for unauthorized use
4. **Notify** security team
5. **Document** the incident
6. **Update** security procedures

### Contact:

- **Security team:** security@your-company.com
- **On-call:** +1-xxx-xxx-xxxx

---

**Remember: Security is not a feature, it's a requirement! 🔒**
