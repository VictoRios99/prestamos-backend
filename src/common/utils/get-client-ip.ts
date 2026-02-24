import { Request } from 'express';

/**
 * Extrae la IP real del cliente detrás de Cloudflare + Nginx.
 * CF-Connecting-IP es la fuente definitiva (siempre la IP real del visitante).
 * Solo se usa X-Forwarded-For (primer valor) como fallback si no hay CF header.
 * Limpia prefijos ::ffff: de IPv4-mapped IPv6.
 */
export function getClientIp(req: Request): string {
  // 1. CF-Connecting-IP — siempre la IP real del visitante
  const cfIp = req.headers['cf-connecting-ip'];
  if (cfIp) return clean(Array.isArray(cfIp) ? cfIp[0] : cfIp);

  // 2. X-Forwarded-For — solo el PRIMER valor (IP del cliente)
  const xff = req.headers['x-forwarded-for'];
  if (xff) {
    const first = (Array.isArray(xff) ? xff[0] : xff).split(',')[0].trim();
    if (first) return clean(first);
  }

  // 3. req.ip directo
  return clean(req.ip ?? '0.0.0.0');
}

/** Limpia ::ffff: prefix de IPv4-mapped IPv6 */
function clean(ip: string): string {
  const mapped = ip.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  return mapped ? mapped[1] : ip;
}
