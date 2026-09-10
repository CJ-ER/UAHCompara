const degrees = [
  { id: 'computadores', name: 'Ingeniería de Computadores', group: 'Informática' },
  { id: 'sistemas-informacion', name: 'Ingeniería en Sistemas de Información', group: 'Informática' },
  { id: 'informatica', name: 'Ingeniería Informática', group: 'Informática' },
  { id: 'mates-computacion', name: 'Matemáticas y Computación', group: 'Informática' },
  { id: 'electronica-automatica', name: 'Ingeniería en Electrónica y Automática Industrial', group: 'Industriales' },
  { id: 'tecnologias-industriales', name: 'Ingeniería en Tecnologías Industriales', group: 'Industriales' },
  { id: 'electronica-comunicaciones', name: 'Ingeniería Electrónica de Comunicaciones', group: 'Telecomunicación' },
  { id: 'sistemas-telecomunicacion', name: 'Ingeniería en Sistemas de Telecomunicación', group: 'Telecomunicación' },
  { id: 'tecnologias-telecomunicacion', name: 'Ingeniería en Tecnologías de Telecomunicación', group: 'Telecomunicación' },
  { id: 'telematica', name: 'Ingeniería Telemática', group: 'Telecomunicación' }
];

const professors = [
  { name: 'Marta Sánchez', role: 'Arquitectura de computadores', group: 'Informática', image: 'https://i.pravatar.cc/600?img=47' },
  { name: 'Carlos Moreno', role: 'Sistemas operativos', group: 'Informática', image: 'https://i.pravatar.cc/600?img=12' },
  { name: 'Lucía Herrero', role: 'Bases de datos', group: 'Informática', image: 'https://i.pravatar.cc/600?img=44' },
  { name: 'Álvaro Gil', role: 'Ingeniería del software', group: 'Informática', image: 'https://i.pravatar.cc/600?img=11' },
  { name: 'Elena Martín', role: 'Matemática aplicada', group: 'Informática', image: 'https://i.pravatar.cc/600?img=32' },
  { name: 'Javier Ruiz', role: 'Programación avanzada', group: 'Informática', image: 'https://i.pravatar.cc/600?img=68' },
  { name: 'Nuria Vega', role: 'Automática y control', group: 'Industriales', image: 'https://i.pravatar.cc/600?img=49' },
  { name: 'Diego Santos', role: 'Electrónica industrial', group: 'Industriales', image: 'https://i.pravatar.cc/600?img=53' },
  { name: 'Raquel Prieto', role: 'Tecnologías de fabricación', group: 'Industriales', image: 'https://i.pravatar.cc/600?img=25' },
  { name: 'Andrés Molina', role: 'Circuitos y señales', group: 'Telecomunicación', image: 'https://i.pravatar.cc/600?img=60' },
  { name: 'Irene Campos', role: 'Redes de comunicación', group: 'Telecomunicación', image: 'https://i.pravatar.cc/600?img=5' },
  { name: 'Pablo León', role: 'Sistemas digitales', group: 'Telecomunicación', image: 'https://i.pravatar.cc/600?img=14' }
];

const state = { screen: 'home', degree: null, champion: null, opponent: null, round: 1, maxRounds: 6, scores: {} };
const app = document.querySelector('#app');
let pendingMatches = Promise.resolve();

function getProfessorsFor(degree) {
  return officialCatalog[degree.id].professors.map((professor) => ({ ...professor, group: degree.group }));
}

async function loadScores() {
  try {
    const response = await fetch(`/api/scores?degree=${encodeURIComponent(state.degree.id)}&t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load scores');
    const payload = await response.json();
    if (!Array.isArray(payload.scores)) throw new Error('Invalid scores response');
    state.scores = Object.fromEntries(payload.scores.map((score) => [score.professor_name, score]));
    return true;
  } catch {
    return false;
  }
}

function getElo(professor) {
  const score = state.scores[professor.name] || { votes: 0, wins: 0 };
  const popularity = Math.tanh((score.votes + (score.wins * 2)) / 20);
  return 1500 + (80 * popularity);
}

async function saveMatch(winner, loser, isFinal) {
  const winnerScore = state.scores[winner.name] || { professor_name: winner.name, votes: 0, wins: 0 };
  winnerScore.votes += 1;
  if (isFinal) winnerScore.wins += 1;
  state.scores[winner.name] = winnerScore;
  const request = pendingMatches.then(() => fetch('/api/matches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ degree: state.degree.id, winner: winner.name, loser: loser.name, final: isFinal })
  }));
  pendingMatches = request.catch(() => {});
  const response = await request;
  if (!response.ok) throw new Error('Could not save match');
  const payload = await response.json();
  if (payload.score) state.scores[payload.score.professor_name] = payload.score;
}

async function refreshScores() {
  const localScores = state.scores;
  await loadScores();
  const serverScores = state.scores;
  state.scores = { ...serverScores };
  Object.entries(localScores).forEach(([professorName, localScore]) => {
    const serverScore = state.scores[professorName];
    if (!serverScore || localScore.votes > serverScore.votes || localScore.wins > serverScore.wins) {
      state.scores[professorName] = {
        ...(serverScore || localScore),
        votes: Math.max(serverScore?.votes || 0, localScore.votes),
        wins: Math.max(serverScore?.wins || 0, localScore.wins)
      };
    }
  });
}

function weightedPick(pool) {
  const weights = pool.map((professor) => 10 ** ((getElo(professor) - 1500) / 500));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = Math.random() * total;
  for (let index = 0; index < pool.length; index += 1) {
    cursor -= weights[index];
    if (cursor <= 0) return pool[index];
  }
  return pool[pool.length - 1];
}

function pickOpponent() {
  const pool = getProfessorsFor(state.degree).filter((professor) => professor.name !== state.champion.name);
  return weightedPick(pool);
}

function pickReplacement(currentProfessor, otherProfessor) {
  const pool = getProfessorsFor(state.degree).filter((professor) => (
    professor.name !== currentProfessor.name && professor.name !== otherProfessor.name
  ));
  return weightedPick(pool);
}

function renderHome() {
  state.screen = 'home';
  app.innerHTML = `
    <section class="hero">
      <p class="eyebrow">La liga de la EPS</p>
      <h1>Tu grado. Tus profes. Tú decides.</h1>
      <p class="hero-copy">Elige tu grado y enfrenta a tus profesores favoritos. Tú decides quién avanza. Sin medias tintas.</p>
    </section>
    <section aria-labelledby="degrees-title">
      <div class="section-heading">
        <h2 id="degrees-title">Elige tu grado</h2>
        <span class="section-count">${degrees.length} titulaciones EPS</span>
      </div>
      <div class="degree-grid">
        ${degrees.map((degree, index) => `
          <button class="degree-card" data-degree="${degree.id}">
            <span class="degree-number">0${index + 1} · ${degree.group}</span>
            <h3>${degree.name}</h3>
            <span class="degree-arrow" aria-hidden="true">↗</span>
          </button>
        `).join('')}
      </div>
    </section>`;
}

function professorCard(professor, label) {
  return `
    <article class="professor-card">
      <div class="professor-photo-wrap" data-choice="${professor.name}" role="button" tabindex="0" aria-label="Elegir a ${professor.name}">
        <img class="professor-photo" src="${professor.image}" alt="Foto de ${professor.name}" loading="eager">
        <span class="department-tag">${professor.group}</span>
      </div>
      <div class="professor-info">
        <h2>${professor.name}</h2>
        <p class="professor-role">${professor.role}</p>
        <button class="unknown-button" type="button" data-skip="${professor.name}">No le conozco</button>
      </div>
    </article>`;
}

function renderBattle() {
  state.screen = 'battle';
  const championLabel = state.champion ? 'Se queda' : 'Elegir profesor';
  app.innerHTML = `
    <div class="battle-top">
      <button class="back-button" data-action="home">← <span>Cambiar de grado</span></button>
      <div class="battle-label"><span>Tu grado</span><strong>${state.degree.name}</strong></div>
    </div>
    <section class="battle-intro">
      <p class="eyebrow" style="justify-content:center">Ronda ${state.round} de ${state.maxRounds}</p>
      <h1>Duelo de profesores</h1>
      <p>Escoge al que quieres ver avanzar en el torneo.</p>
    </section>
    <section class="battle-arena" aria-label="Comparación de profesores">
      ${professorCard(state.champion, championLabel)}
      <div class="vs-badge">VS</div>
      ${professorCard(state.opponent, 'Elegir profesor')}
    </section>
    <div class="battle-footer"><span>El más votado sigue en pie</span><div class="progress" aria-label="Progreso del torneo"><span style="width:${(state.round / state.maxRounds) * 100}%"></span></div></div>`;
}

function renderResult() {
  state.screen = 'result';
  const leaderboard = getProfessorsFor(state.degree)
    .map((professor) => ({ ...professor, votes: state.scores[professor.name]?.votes || 0, wins: state.scores[professor.name]?.wins || 0 }))
    .sort((first, second) => second.votes - first.votes || second.wins - first.wins || first.name.localeCompare(second.name))
    .slice(0, 5);
  app.innerHTML = `
    <section class="result-view">
      <div class="result-mark">★</div>
      <p class="eyebrow" style="justify-content:center">Campeón de tu torneo</p>
      <h1><span class="winner-name">${state.champion.name}</span><br>ha sido el profe que más te ha gustado</h1>
      <p>Has completado el battle royal de <strong>${state.degree.name}</strong>. Este resultado representa tu elección en la comunidad.</p>
      <section class="leaderboard" aria-labelledby="leaderboard-title">
        <div class="leaderboard-heading"><h2 id="leaderboard-title">Los más votados</h2><span>Tu grado</span></div>
        ${leaderboard.map((professor, index) => `
          <div class="leaderboard-row">
            <span class="leaderboard-position">0${index + 1}</span>
            <img src="${professor.image}" alt="" class="leaderboard-photo">
            <strong>${professor.name}</strong>
            <span class="leaderboard-votes">${professor.wins} ${professor.wins === 1 ? 'victoria' : 'victorias'} · ${professor.votes} ${professor.votes === 1 ? 'voto' : 'votos'}</span>
          </div>
        `).join('')}
      </section>
      <div class="result-actions">
        <button class="primary-button" data-action="restart">Repetir torneo</button>
        <button class="secondary-button" data-action="home">Cambiar de grado</button>
      </div>
    </section>`;
}

async function startDegree(degreeId) {
  state.degree = degrees.find((degree) => degree.id === degreeId);
  await loadScores();
  const pool = getProfessorsFor(state.degree);
  state.champion = weightedPick(pool);
  state.opponent = weightedPick(pool.filter((professor) => professor.name !== state.champion.name));
  state.round = 1;
  renderBattle();
}

app.addEventListener('click', (event) => {
  const degreeButton = event.target.closest('[data-degree]');
  if (degreeButton) { startDegree(degreeButton.dataset.degree); return; }

  const skipButton = event.target.closest('[data-skip]');
  if (skipButton) {
    const skipped = skipButton.dataset.skip;
    if (state.champion.name === skipped) {
      state.champion = pickReplacement(state.champion, state.opponent);
    } else if (state.opponent.name === skipped) {
      state.opponent = pickReplacement(state.opponent, state.champion);
    }
    renderBattle();
    return;
  }

  const choiceButton = event.target.closest('[data-choice]');
  if (choiceButton) {
    const chosen = [state.champion, state.opponent].find((professor) => professor.name === choiceButton.dataset.choice);
    const rejected = [state.champion, state.opponent].find((professor) => professor.name !== chosen.name);
    const isFinal = state.round >= state.maxRounds;
    const savePromise = saveMatch(chosen, rejected, isFinal);
    savePromise.catch(() => {
      state.scores[chosen.name].votes -= 1;
      if (isFinal) state.scores[chosen.name].wins -= 1;
    });
    state.champion = chosen;
    if (isFinal) {
      savePromise.then(refreshScores).catch(() => {}).finally(renderResult);
      return;
    }
    state.round += 1;
    state.opponent = pickOpponent();
    renderBattle();
    return;
  }

  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'home') { state.degree = null; renderHome(); }
  if (action === 'restart' && state.degree) {
    const pool = getProfessorsFor(state.degree);
    state.champion = weightedPick(pool);
    state.opponent = weightedPick(pool.filter((professor) => professor.name !== state.champion.name));
    state.round = 1;
    renderBattle();
  }
});

app.addEventListener('keydown', (event) => {
  const choice = event.target.closest('[data-choice]');
  if (choice && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    choice.click();
  }
});

renderHome();
