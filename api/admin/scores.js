import { departments, ensureSchema, isAdmin, json, sql } from '../_db.js';

export default async function handler(request, response) {
  if (request.method !== 'GET') return json(response, { error: 'Method not allowed' }, 405);
  if (!isAdmin(request)) return json(response, { error: 'Unauthorized' }, 401);
  await ensureSchema();
  const result = await sql`SELECT degree_id, professor_name, votes, wins FROM professor_scores ORDER BY degree_id, wins DESC, votes DESC, professor_name`;
  const byDegree = result.rows.reduce((groups, row) => ({
    ...groups,
    [row.degree_id]: [...(groups[row.degree_id] || []), row]
  }), {});
  const grouped = Object.fromEntries(Object.entries(departments).map(([department, degrees]) => [
    department,
    degrees.map((degree) => ({ degree, scores: byDegree[degree] || [] }))
  ]));
  return json(response, { departments: grouped });
}