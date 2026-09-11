import fs from 'node:fs';
import path from 'node:path';
import { ensureSchema, isAdmin, json, sql } from '../_db.js';

const DEPARTMENTS = [
  'Automática',
  'Ciencias de la Computación',
  'Electrónica',
  'Física y Matemáticas',
  'Teoría de la Señal y Comunicaciones',
  'Economía y Organización de Empresas'
];

let profRoleMap = null;

function getProfRoleMap() {
  if (profRoleMap) return profRoleMap;
  profRoleMap = {};
  try {
    const catalogPath = path.join(process.cwd(), 'catalog.js');
    const content = fs.readFileSync(catalogPath, 'utf8');
    const jsonStr = content.slice(content.indexOf('{'), content.lastIndexOf('}') + 1);
    const catalog = JSON.parse(jsonStr);
    for (const degreeData of Object.values(catalog)) {
      for (const p of degreeData.professors || []) {
        if (!profRoleMap[p.name]) {
          profRoleMap[p.name] = p.role || '';
        }
      }
    }
  } catch (err) {
    console.error('Could not load catalog in scores handler:', err);
  }
  return profRoleMap;
}

function classifyDept(role = '') {
  const r = role.toLowerCase();
  if (/\b(matemática|matemáticas|física|álgebra|cálculo|estadística|ecuaciones|geometría)\b/i.test(r)) {
    return 'Física y Matemáticas';
  }
  if (/\b(electrónica|circuito|circuitos|microelectrónica|instrumentación|sensor|sensores)\b/i.test(r)) {
    return 'Electrónica';
  }
  if (/\b(redes|comunicaci|telemática|señal|radio|antenas|antena|transmisión|telecomunicaci|ondas|fotónica)\b/i.test(r)) {
    return 'Teoría de la Señal y Comunicaciones';
  }
  if (/\b(control|automática|robótica|sistemas operativos|visión artificial|sistemas digitales|sistemas empotrados|arquitectura|autómatas)\b/i.test(r)) {
    return 'Automática';
  }
  if (/\b(economía|empresa|gestión de proyectos|organización|derecho|talento)\b/i.test(r)) {
    return 'Economía y Organización de Empresas';
  }
  return 'Ciencias de la Computación';
}

export default async function handler(request, response) {
  if (request.method !== 'GET') return json(response, { error: 'Method not allowed' }, 405);
  if (!isAdmin(request)) return json(response, { error: 'Unauthorized' }, 401);
  await ensureSchema();

  const roleMap = getProfRoleMap();
  const result = await sql`SELECT degree_id, professor_name, votes, wins FROM professor_scores`;
  const deptScores = Object.fromEntries(DEPARTMENTS.map((d) => [d, {}]));

  for (const row of result) {
    const role = roleMap[row.professor_name] || '';
    const dept = classifyDept(role);
    if (!deptScores[dept]) deptScores[dept] = {};
    if (!deptScores[dept][row.professor_name]) {
      deptScores[dept][row.professor_name] = { professor_name: row.professor_name, votes: 0, wins: 0 };
    }
    deptScores[dept][row.professor_name].votes += Number(row.votes);
    deptScores[dept][row.professor_name].wins += Number(row.wins);
  }

  const grouped = Object.fromEntries(
    DEPARTMENTS.map((dept) => [
      dept,
      Object.values(deptScores[dept] || {}).sort((a, b) => b.wins - a.wins || b.votes - a.votes || a.professor_name.localeCompare(b.professor_name))
    ])
  );

  return json(response, { departments: grouped });
}