// Hash de contraseñas con scrypt (nativo de Node, sin dependencias nuevas).
// Mismo algoritmo aquí y en PalafoxPos, porque este proyecto crea/edita las
// contraseñas y el otro las verifica al hacer login — ambos leen y escriben
// la misma tabla "usuarios" en la base de datos compartida.
import crypto from 'crypto';

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string' || !stored.includes(':')) return false;
  const [salt, hashHex] = stored.split(':');
  try {
    const hashBuffer = Buffer.from(hashHex, 'hex');
    const testHash = crypto.scryptSync(password, salt, 64);
    if (hashBuffer.length !== testHash.length) return false;
    return crypto.timingSafeEqual(hashBuffer, testHash);
  } catch {
    return false;
  }
}
