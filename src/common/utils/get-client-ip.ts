import { Request } from 'express';

/**
 * Extrae la IP real del cliente detrás de Cloudflare + Nginx.
 * Prioridad: CF-Connecting-IP > X-Forwarded-For (primer valor) > req.ip
 */
export function getClientIp(req: Request): string {
  const cfIp = req.headers['cf-connecting-ip'];
  if (cfIp) return Array.isArray(cfIp) ? cfIp[0] : cfIp;

  const xff = req.headers['x-forwarded-for'];
  if (xff) {
    const first = (Array.isArray(xff) ? xff[0] : xff).split(',')[0].trim();
    if (first) return first;
  }

  return req.ip ?? '0.0.0.0';
}
