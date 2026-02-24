import * as http from 'http';

const cache = new Map<string, { location: string; expires: number }>();

/**
 * Resuelve una IP a "Ciudad, Region" usando ip-api.com (gratis, sin key).
 * Cache de 1 hora por IP para no saturar la API (45 req/min).
 * Timeout de 2s para no bloquear el log.
 */
export async function geolocateIp(ip: string): Promise<string> {
  if (!ip || ip === '0.0.0.0' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip === '::1') {
    return 'Red local';
  }

  const cached = cache.get(ip);
  if (cached && cached.expires > Date.now()) return cached.location;

  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(''), 2000);

    http.get(`http://ip-api.com/json/${ip}?fields=status,city,regionName,country&lang=es`, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        clearTimeout(timeout);
        try {
          const json = JSON.parse(data);
          if (json.status === 'success' && json.city) {
            const location = `${json.city}, ${json.regionName}`;
            cache.set(ip, { location, expires: Date.now() + 3600000 });
            resolve(location);
          } else {
            resolve('');
          }
        } catch {
          resolve('');
        }
      });
    }).on('error', () => {
      clearTimeout(timeout);
      resolve('');
    });
  });
}
