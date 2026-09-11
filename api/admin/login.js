import { adminSignature, json } from '../_db.js';

export default function handler(request, response) {
  if (request.method !== 'POST') return json(response, { error: 'Method not allowed' }, 405);
  const password = process.env.ADMIN_PASSWORD || '0000';
  if (!password || request.body?.password !== password) return json(response, { error: 'Unauthorized' }, 401);
  const issued = String(Math.floor(Date.now() / 1000));
  response.setHeader('Set-Cookie', `uah_admin_session=${issued}.${adminSignature(issued)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400`);
  return json(response, { ok: true });
}