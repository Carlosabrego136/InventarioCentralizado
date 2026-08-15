import { createSessionCookie } from '../../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'Falta la contraseña' });

  if (process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD) {
    res.setHeader('Set-Cookie', createSessionCookie({ role: 'admin' }));
    return res.status(200).json({ ok: true });
  }

  return res.status(401).json({ error: 'Contraseña incorrecta' });
}
