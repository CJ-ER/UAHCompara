import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';

export const sql = neon(process.env.DATABASE_URL || process.env.POSTGRES_URL);

export async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS professor_scores (
      degree_id TEXT NOT NULL,
      professor_name TEXT NOT NULL,
      votes INTEGER NOT NULL DEFAULT 0,
      wins INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (degree_id, professor_name)
    )
  `;
}

export function json(response, body, status = 200, headers = {}) {
  const result = response.status(status).setHeader('Cache-Control', 'no-store');
  Object.entries(headers).forEach(([name, value]) => result.setHeader(name, value));
  return result.json(body);
}

export function adminSignature(value) {
  return crypto.createHmac('sha256', process.env.ADMIN_PASSWORD || '').update(value).digest('hex');
}

export function isAdmin(request) {
  const cookie = request.headers.cookie || '';
  const session = cookie.split('; ').find((part) => part.startsWith('uah_admin_session='))?.split('=')[1] || '';
  if (!process.env.ADMIN_PASSWORD || !session.includes('.')) return false;
  const [issued, signature] = session.split('.');
  return /^\d+$/.test(issued) && Date.now() / 1000 - Number(issued) < 86400 && signature === adminSignature(issued);
}

export const departments = {
  Informática: ['computadores', 'sistemas-informacion', 'informatica', 'mates-computacion'],
  Industriales: ['electronica-automatica', 'tecnologias-industriales'],
  Telecomunicación: ['electronica-comunicaciones', 'sistemas-telecomunicacion', 'tecnologias-telecomunicacion', 'telematica']
};