import { Request } from 'express';

/**
 * Extrae la IPv4 real del cliente detrás de Cloudflare + Nginx.
 * Si solo hay IPv6, la devuelve tal cual.
 * Prioridad: CF-Connecting-IP > X-Forwarded-For > req.ip
 * Detecta IPv4-mapped IPv6 (::ffff:x.x.x.x) y extrae la IPv4.
 */
export function getClientIp(req: Request): string {
  const candidates: string[] = [];

  const cfIp = req.headers['cf-connecting-ip'];
  if (cfIp) candidates.push(Array.isArray(cfIp) ? cfIp[0] : cfIp);

  const xff = req.headers['x-forwarded-for'];
  if (xff) {
    const parts = (Array.isArray(xff) ? xff[0] : xff).split(',');
    for (const p of parts) {
      const trimmed = p.trim();
      if (trimmed) candidates.push(trimmed);
    }
  }

  if (req.ip) candidates.push(req.ip);

  // Prefer IPv4 over IPv6
  for (const ip of candidates) {
    const clean = extractIPv4(ip);
    if (clean) return clean;
  }

  // No IPv4 found, return first candidate as-is
  return candidates[0] || '0.0.0.0';
}

function extractIPv4(ip: string): string | null {
  // IPv4-mapped IPv6: ::ffff:192.168.1.1
  const mapped = ip.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  if (mapped) return mapped[1];

  // Pure IPv4
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) return ip;

  return null;
}
