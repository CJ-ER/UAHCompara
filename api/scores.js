import { ensureSchema, json, sql } from './_db.js';

export default async function handler(request, response) {
  if (request.method !== 'GET') return json(response, { error: 'Method not allowed' }, 405);
  await ensureSchema();
  const degree = String(request.query?.degree || '');
  const result = await sql`SELECT professor_name, votes, wins FROM professor_scores WHERE degree_id = ${degree} ORDER BY wins DESC, votes DESC, professor_name`;
  return json(response, { scores: result });
}