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

const state = { screen: 'home', degree: null, champion: null, opponent: null, round: 1, maxRounds: 6 };
const app = document.querySelector('#app');
const eloStorageKey = 'uah-compara-elo-v1';
const votesStorageKey = 'uah-compara-votes-v1';
const winsStorageKey = 'uah-compara-wins-v1';

function getProfessorsFor(degree) {
  return officialCatalog[degree.id].professors.map((professor) => ({ ...professor, group: degree.group }));
}

function getEloRatings() {
  try {
    return JSON.parse(localStorage.getItem(eloStorageKey)) || {};
  } catch {
    return {};
  }
}

function getElo(professor) {
  const ratings = getEloRatings();
  return ratings[state.degree.id]?.[professor.name] || 1500;
}

function getVoteRatings() {
  try {
    return JSON.parse(localStorage.getItem(votesStorageKey)) || {};
  } catch {
    return {};
  }
}

function getWinRatings() {
  try {
    return JSON.parse(localStorage.getItem(winsStorageKey)) || {};
  } catch {
    return {};
  }
}

function saveMatch(winner, loser, isFinal) {
  const ratings = getEloRatings();
  const votes = getVoteRatings();
  const degreeRatings = ratings[state.degree.id] || {};
  const winnerElo = degreeRatings[winner.name] || 1500;
  const loserElo = degreeRatings[loser.name] || 1500;
  const expectedWinner = 1 / (1 + 10 ** ((loserElo - winnerElo) / 400));
  const change = Math.round(32 * (1 - expectedWinner));
  degreeRatings[winner.name] = winnerElo + change;
  degreeRatings[loser.name] = loserElo - change;
  ratings[state.degree.id] = degreeRatings;
  localStorage.setItem(eloStorageKey, JSON.stringify(ratings));
  const degreeVotes = votes[state.degree.id] || {};
  degreeVotes[winner.name] = (degreeVotes[winner.name] || 0) + 1;
  votes[state.degree.id] = degreeVotes;
  localStorage.setItem(votesStorageKey, JSON.stringify(votes));
  if (isFinal) {
    const wins = getWinRatings();
    const degreeWins = wins[state.degree.id] || {};
    degreeWins[winner.name] = (degreeWins[winner.name] || 0) + 1;
    wins[state.degree.id] = degreeWins;
    localStorage.setItem(winsStorageKey, JSON.stringify(wins));
  }
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
  const votes = getVoteRatings()[state.degree.id] || {};
  const wins = getWinRatings()[state.degree.id] || {};
  const leaderboard = getProfessorsFor(state.degree)
    .map((professor) => ({ ...professor, votes: votes[professor.name] || 0, wins: wins[professor.name] || 0 }))
    .sort((first, second) => second.wins - first.wins || second.votes - first.votes || first.name.localeCompare(second.name))
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

function startDegree(degreeId) {
  state.degree = degrees.find((degree) => degree.id === degreeId);
  const pool = getProfessorsFor(state.degree);
  state.champion = weightedPick(pool);
  state.opponent = weightedPick(pool.filter((professor) => professor.name !== state.champion.name));
  state.round = 1;
  renderBattle();
}

app.addEventListener('click', (event) => {
  const degreeButton = event.target.closest('[data-degree]');
  if (degreeButton) { startDegree(degreeButton.dataset.degree); return; }

  const choiceButton = event.target.closest('[data-choice]');
  if (choiceButton) {
    const chosen = [state.champion, state.opponent].find((professor) => professor.name === choiceButton.dataset.choice);
    const rejected = [state.champion, state.opponent].find((professor) => professor.name !== chosen.name);
    saveMatch(chosen, rejected, state.round >= state.maxRounds);
    state.champion = chosen;
    if (state.round >= state.maxRounds) { renderResult(); return; }
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
