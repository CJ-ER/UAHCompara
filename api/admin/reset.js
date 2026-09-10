import { ensureSchema, isAdmin, json, sql } from '../_db.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') return json(response, { error: 'Method not allowed' }, 405);
  if (!isAdmin(request)) return json(response, { error: 'Unauthorized' }, 401);
  await ensureSchema();
  await sql`DELETE FROM professor_scores`;
  return json(response, { ok: true });
}