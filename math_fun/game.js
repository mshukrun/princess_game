const DURATION = 60;
const $ = (id) => document.getElementById(id);

const state = { score: 0, streak: 0, correct: 0, total: 0, time: DURATION, answer: 0, level: 2, timer: null };

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function makeQuestion(level) {
  const ops = ['+', '−', '×', '÷'].slice(0, level === 1 ? 2 : level === 2 ? 3 : 4);
  const op = ops[rand(0, ops.length - 1)];
  const max = level === 1 ? 20 : level === 2 ? 50 : 100;
  let a, b, answer;
  switch (op) {
    case '+': a = rand(1, max); b = rand(1, max); answer = a + b; break;
    case '−': a = rand(1, max); b = rand(1, a); answer = a - b; break;
    case '×': {
      const m = level === 3 ? 15 : 12;
      a = rand(2, m); b = rand(2, m); answer = a * b; break;
    }
    case '÷': b = rand(2, 12); answer = rand(2, 12); a = b * answer; break;
  }
  return { text: `${a} ${op} ${b}`, answer };
}

function nextQuestion() {
  const q = makeQuestion(state.level);
  state.answer = q.answer;
  $('question').textContent = q.text + ' = ?';
  $('answer').value = '';
  $('answer').focus();
}

function show(id) {
  ['start-screen', 'game-screen', 'end-screen'].forEach((s) => ($(s).hidden = s !== id));
}

function getBest() {
  try { return Number(localStorage.getItem('mathQuizBest')) || 0; } catch { return 0; }
}
function setBest(v) {
  try { localStorage.setItem('mathQuizBest', v); } catch { /* ignore */ }
}

function startGame() {
  Object.assign(state, { score: 0, streak: 0, correct: 0, total: 0, time: DURATION,
    level: Number($('difficulty').value) });
  $('score').textContent = 0;
  $('streak').textContent = 0;
  $('time').textContent = DURATION;
  $('feedback').textContent = '';
  const fill = $('timebar-fill');
  fill.style.transition = 'none';
  fill.style.width = '100%';
  void fill.offsetWidth;
  fill.style.transition = '';
  show('game-screen');
  nextQuestion();
  clearInterval(state.timer);
  state.timer = setInterval(tick, 1000);
  fill.style.width = ((DURATION - 1) / DURATION * 100) + '%';
}

function tick() {
  state.time--;
  $('time').textContent = state.time;
  $('timebar-fill').style.width = (Math.max(state.time - 1, 0) / DURATION * 100) + '%';
  if (state.time <= 0) endGame();
}

function endGame() {
  clearInterval(state.timer);
  $('final-score').textContent = state.score;
  $('final-correct').textContent = state.correct;
  $('final-total').textContent = state.total;
  const isBest = state.score > getBest();
  if (isBest) setBest(state.score);
  $('new-best').hidden = !isBest;
  $('best').textContent = getBest();
  show('end-screen');
}

function submitAnswer(e) {
  e.preventDefault();
  if (state.time <= 0) return;
  const value = Number($('answer').value);
  const fb = $('feedback');
  state.total++;
  if (value === state.answer) {
    state.correct++;
    state.streak++;
    state.score += 10 + Math.min(state.streak - 1, 10) * 2; // streak bonus
    fb.textContent = 'Correct! ✔';
    fb.className = 'feedback ok';
  } else {
    state.streak = 0;
    fb.textContent = `Oops — it was ${state.answer}`;
    fb.className = 'feedback bad';
  }
  $('score').textContent = state.score;
  $('streak').textContent = state.streak;
  nextQuestion();
}

$('best').textContent = getBest();
$('start-btn').addEventListener('click', startGame);
$('restart-btn').addEventListener('click', () => show('start-screen'));
$('answer-form').addEventListener('submit', submitAnswer);
