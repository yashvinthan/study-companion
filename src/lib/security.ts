import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { assertAppBaseUrl } from '@/lib/config';

export const ERROR_CORS_NOT_ALLOWED = 'Cross-origin requests are not allowed for this endpoint.';
export const ERROR_ORIGIN_UNVERIFIED = 'Request origin could not be verified.';

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

function isTrustedRequestUrl(candidate: string | null, expectedUrl: URL) {
  if (!candidate || candidate === 'null') {
    return false;
  }

  try {
    const candidateUrl = new URL(candidate);
    return candidateUrl.host === expectedUrl.host && candidateUrl.protocol === expectedUrl.protocol;
  } catch {
    return false;
  }
}

export function assertTrustedOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const fetchSite = request.headers.get('sec-fetch-site');
  const expectedUrl = new URL(assertAppBaseUrl());
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get('x-forwarded-host')?.trim();
  const requestHost = forwardedHost || request.headers.get('host')?.trim() || requestUrl.host;
  const requestProtocol = request.headers.get('x-forwarded-proto')?.trim() || requestUrl.protocol.replace(':', '');
  const runtimeUrl = new URL(`${requestProtocol}://${requestHost}`);

  if (
    isTrustedRequestUrl(origin, expectedUrl) ||
    isTrustedRequestUrl(referer, expectedUrl) ||
    isTrustedRequestUrl(origin, runtimeUrl) ||
    isTrustedRequestUrl(referer, runtimeUrl)
  ) {
    return;
  }

  // Some browsers send `Origin: null` on document form posts, so fall back to fetch metadata.
  if (fetchSite === 'same-origin') {
    return;
  }

  if (!origin && !referer && !fetchSite && process.env.NODE_ENV !== 'production') {
    return;
  }

  if (!origin && !referer && !fetchSite) {
    throw new Error(ERROR_ORIGIN_UNVERIFIED);
  }

  throw new Error(ERROR_CORS_NOT_ALLOWED);
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
