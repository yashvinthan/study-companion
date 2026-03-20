import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export function createOpaqueToken(size = 32) {
  return randomBytes(size).toString('hex');
}

export function sha256Hex(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for');

  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
  }

  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

export function assertTrustedOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const url = new URL(request.url);
  const expectedOrigin = `${url.protocol}//${url.host}`;

  if (origin) {
    if (origin !== expectedOrigin) {
      throw new Error('Cross-origin requests are not allowed for this endpoint.');
    }
    return;
  }

  if (referer) {
    if (new URL(referer).origin !== expectedOrigin) {
      throw new Error('Cross-origin requests are not allowed for this endpoint.');
    }
    return;
  }

  throw new Error('Request origin could not be verified.');
}

export function getSessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires,
    priority: 'high' as const,
  };
}

export function getOAuthCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires,
    priority: 'high' as const,
  };
}
