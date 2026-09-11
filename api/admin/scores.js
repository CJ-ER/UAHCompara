import { ensureSchema, isAdmin, json, sql } from '../_db.js';

const departmentMap = {
  computadores: 'Informática',
  'sistemas-informacion': 'Informática',
  informatica: 'Informática',
  'mates-computacion': 'Informática',
  'electronica-automatica': 'Industriales',
  'tecnologias-industriales': 'Industriales',
  'electronica-comunicaciones': 'Telecomunicación',
  'sistemas-telecomunicacion': 'Telecomunicación',
  'tecnologias-telecomunicacion': 'Telecomunicación',
  telematica: 'Telecomunicación'
};

export default async function handler(request, response) {
  if (request.method !== 'GET') return json(response, { error: 'Method not allowed' }, 405);
  if (!isAdmin(request)) return json(response, { error: 'Unauthorized' }, 401);
  await ensureSchema();
  const result = await sql`SELECT degree_id, professor_name, votes, wins FROM professor_scores`;
  const deptScores = {
    Informática: {},
    Industriales: {},
    Telecomunicación: {}
  };

  for (const row of result) {
    const dept = departmentMap[row.degree_id] || 'Informática';
    if (!deptScores[dept][row.professor_name]) {
      deptScores[dept][row.professor_name] = { professor_name: row.professor_name, votes: 0, wins: 0 };
    }
    deptScores[dept][row.professor_name].votes += Number(row.votes);
    deptScores[dept][row.professor_name].wins += Number(row.wins);
  }

  const grouped = Object.fromEntries(
    Object.entries(deptScores).map(([dept, profs]) => [
      dept,
      Object.values(profs).sort((a, b) => b.wins - a.wins || b.votes - a.votes || a.professor_name.localeCompare(b.professor_name))
    ])
  );

  return json(response, { departments: grouped });
}