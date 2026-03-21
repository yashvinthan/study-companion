import { getPostgresUrl } from '@/lib/config';
import { memoryStore } from '@/lib/memory/MemoryStore';
import { getPool } from '@/lib/postgres';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  services: {
    database: ServiceHealth;
    hindsight: ServiceHealth;
  };
  version: string;
}

interface ServiceHealth {
  status: 'up' | 'down' | 'unknown';
  latency?: number;
  error?: string;
}

async function checkDatabaseHealth(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    getPostgresUrl(); // Verify config first
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      return {
        status: 'up',
        latency: Date.now() - start,
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Database health check failed', error);
    return {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkHindsightHealth(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const connection = await memoryStore.getConnectionStatus('health-check');
    return {
      status: connection.ok ? 'up' : 'down',
      latency: Date.now() - start,
      error: connection.ok ? undefined : connection.message,
    };
  } catch (error) {
    logger.error('Hindsight health check failed', error);
    return {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function GET() {
  const start = Date.now();

  try {
    const [database, hindsight] = await Promise.all([
      checkDatabaseHealth(),
      checkHindsightHealth(),
    ]);

    const allHealthy = database.status === 'up' && hindsight.status === 'up';
    const anyDown = database.status === 'down' || hindsight.status === 'down';

    const health: HealthStatus = {
      status: anyDown ? 'unhealthy' : allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database,
        hindsight,
      },
      version: process.env.npm_package_version || '0.1.0',
    };

    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

    logger.logRequest({
      method: 'GET',
      path: '/api/health',
      duration: Date.now() - start,
      status: statusCode,
    });

    return Response.json(health, { status: statusCode });
  } catch (error) {
    logger.error('Health check failed', error);

    return Response.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Health check failed',
      },
      { status: 503 }
    );
  }
}
