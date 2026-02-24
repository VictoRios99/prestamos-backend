import * as https from 'https';

const cache = new Map<string, { address: string; expires: number }>();

/** Redondea a 4 decimales (~11m de precision) para cachear. */
function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

/**
 * Reverse geocode con Nominatim (OpenStreetMap).
 * Gratis, sin API key. Rate limit: 1 req/s (el cache lo mitiga).
 * Cache en memoria 24h por coordenada redondeada.
 * Timeout 3s, retorna '' en cualquier error.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const key = cacheKey(lat, lng);
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.address;

  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(''), 3000);

    const url =
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}` +
      `&zoom=18&addressdetails=1&accept-language=es`;

    const req = https.get(
      url,
      { headers: { 'User-Agent': 'FinancieraVidaa/1.0 (prestamos-app)' } },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          clearTimeout(timeout);
          try {
            const json = JSON.parse(data);
            if (json.display_name) {
              const address = json.display_name;
              cache.set(key, { address, expires: Date.now() + 86400000 }); // 24h
              resolve(address);
            } else {
              resolve('');
            }
          } catch {
            resolve('');
          }
        });
      },
    );

    req.on('error', () => {
      clearTimeout(timeout);
      resolve('');
    });
  });
}
