import { ensureSchema, json, sql } from './_db.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') return json(response, { error: 'Method not allowed' }, 405);
  const { degree, winner, loser, final: isFinal } = request.body || {};
  if (!degree || !winner || !loser) return json(response, { error: 'Invalid match' }, 400);
  try {
    await ensureSchema();
    await sql`INSERT INTO professor_scores (degree_id, professor_name) VALUES (${degree}, ${winner}) ON CONFLICT DO NOTHING`;
    await sql`INSERT INTO professor_scores (degree_id, professor_name) VALUES (${degree}, ${loser}) ON CONFLICT DO NOTHING`;
    await sql`UPDATE professor_scores SET votes = votes + 1, wins = wins + ${isFinal ? 1 : 0} WHERE degree_id = ${degree} AND professor_name = ${winner}`;
    const result = await sql`SELECT professor_name, votes, wins FROM professor_scores WHERE degree_id = ${degree} AND professor_name = ${winner}`;
    return json(response, { ok: true, score: result.rows[0] });
  } catch (error) {
    console.error('Could not save match', error);
    return json(response, { error: 'Could not save match' }, 500);
  }
}