import { json, sql } from './_db.js';

export default async function handler(request, response) {
  try {
    if (request.method !== 'POST') return json(response, { error: 'Method not allowed' }, 405);
    const { degree, winner, loser, final: isFinal } = request.body || {};
    if (!degree || !winner || !loser) return json(response, { error: 'Invalid match' }, 400);
    await sql.query(
      'INSERT INTO professor_scores (degree_id, professor_name) VALUES ($1, $2) ON CONFLICT (degree_id, professor_name) DO NOTHING',
      [degree, winner]
    );
    await sql.query(
      'INSERT INTO professor_scores (degree_id, professor_name) VALUES ($1, $2) ON CONFLICT (degree_id, professor_name) DO NOTHING',
      [degree, loser]
    );
    await sql.query(
      'UPDATE professor_scores SET votes = votes + 1, wins = wins + $1 WHERE degree_id = $2 AND professor_name = $3',
      [isFinal ? 1 : 0, degree, winner]
    );
    const result = await sql.query(
      'SELECT professor_name, votes, wins FROM professor_scores WHERE degree_id = $1 AND professor_name = $2',
      [degree, winner]
    );
    return json(response, { ok: true, score: result.rows[0] });
  } catch (error) {
    console.error('Could not save match', error);
    return json(response, { error: 'Could not save match', detail: String(error?.message || error) }, 500);
  }
}