import fs from 'node:fs';
import path from 'node:path';
import { ensureSchema, isAdmin, json, sql } from '../_db.js';

const DEPARTMENTS = [
  'Departamento de Automática',
  'Departamento de Ciencias de la Computación',
  'Departamento de Electrónica',
  'Departamento de Física y Matemáticas',
  'Departamento de Teoría de la Señal y Comunicaciones',
  'Departamento de Economía y Dirección de Empresas',
  'Departamento de Química e Ingeniería Química'
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
          profRoleMap[p.name] = new Set();
        }
        if (p.role) profRoleMap[p.name].add(p.role);
      }
    }
  } catch (err) {
    console.error('Could not load catalog in scores handler:', err);
  }
  return profRoleMap;
}

function classifyDept(rolesSet = new Set()) {
  const text = Array.from(rolesSet).join(' · ').toLowerCase();

  // 1. Química e Ingeniería Química
  if (/\b(química|químicas|medioambientales|medio ambiente|desarrollo industrial sostenible)\b/i.test(text)) {
    return 'Departamento de Química e Ingeniería Química';
  }
  // 2. Física y Matemáticas
  if (/\b(física|fluidos|termodinámica|materia|matemática|matemáticas|álgebra|cálculo|estadística|ecuaciones|geometría|análisis matemático|probabilidad|físicos)\b/i.test(text)) {
    return 'Departamento de Física y Matemáticas';
  }
  // 3. Economía y Dirección de Empresas
  if (/\b(economía|empresa|empresarial|negocios|inversión|organización industrial|desarrollo de talento|comercio electrónico)\b/i.test(text)) {
    return 'Departamento de Economía y Dirección de Empresas';
  }
  // 4. Electrónica
  if (/\b(electrónica|circuitos|circuitos de comunicación|microelectrónica|instrumentación|sensor|sensores|tecnología electrónica)\b/i.test(text)) {
    return 'Departamento de Electrónica';
  }
  // 5. Teoría de la Señal y Comunicaciones
  if (/\b(redes|telemática|comunicaciones|radio|antenas|antena|transmisión|señal|señales|servicios telemáticos|laboratorio de redes|radiocomunicación|alta frecuencia|móviles|ópticas|fotónicas|fotónica|conmutación)\b/i.test(text)) {
    return 'Departamento de Teoría de la Señal y Comunicaciones';
  }
  // 6. Automática
  if (/\b(control|automática|automatización|robótica|robotizados|sistemas operativos|visión artificial|sistemas digitales|sistemas empotrados|arquitectura|estructura de computadores|percepción|tiempo real|máquinas eléctricas|tecnología eléctrica|eléctricas|mecanismos|mecánicos|mecánica|expresión gráfica|diseño mecánico)\b/i.test(text)) {
    return 'Departamento de Automática';
  }
  // 7. Ciencias de la Computación (por defecto para programación, IA, software, bases de datos)
  return 'Departamento de Ciencias de la Computación';
}

export default async function handler(request, response) {
  if (request.method !== 'GET') return json(response, { error: 'Method not allowed' }, 405);
  if (!isAdmin(request)) return json(response, { error: 'Unauthorized' }, 401);
  await ensureSchema();

  const roleMap = getProfRoleMap();
  const result = await sql`SELECT degree_id, professor_name, votes, wins FROM professor_scores`;
  const deptScores = Object.fromEntries(DEPARTMENTS.map((d) => [d, {}]));

  for (const row of result) {
    const rolesSet = roleMap[row.professor_name] || new Set();
    const dept = classifyDept(rolesSet);
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