const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadQuiz() {
  const html = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
  const elements = new Map();
  const element = () => ({ style: {}, classList: { add() {}, remove() {} }, textContent: '', innerHTML: '', children: [], appendChild(c) { this.children.push(c); }, getContext() { return { clearRect() {} }; } });
  const storage = new Map();
  const timers = [];
  const context = vm.createContext({
    document: { getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); }, querySelectorAll() { return []; }, createElement: element },
    window: { AudioContext: class { state = 'running'; }, addEventListener() {}, innerWidth: 390, innerHeight: 844 },
    localStorage: { getItem(k) { return storage.get(k); }, setItem(k,v) { storage.set(k,v); } },
    setTimeout(fn) { timers.push(fn); }, requestAnimationFrame() {}, console
  });
  vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], context);
  // Effects are unrelated to arithmetic; keep answer timing under test control.
  vm.runInContext('playSound = () => {}; launchBalloons = () => {}; triggerShatterCelebration = () => showView("victory");', context);
  return { context, elements, timers, run: code => vm.runInContext(code, context) };
}

test('every sum in the photo appears once, with correct and distinct answer options', () => {
  const { run } = loadQuiz();
  const questions = JSON.parse(run('JSON.stringify(allQuestions)'));
  assert.equal(questions.length, 130);
  const expected = new Map();
  for (const table of [2,3,4,5,10]) for (let n = 0; n <= 12; n++) {
    expected.set(`${n} × ${table} = ?`, n * table);
    expected.set(`${n * table} ÷ ${table} = ?`, n);
  }
  for (const q of questions) {
    assert.ok(expected.has(q.q), `Unexpected or repeated sum: ${q.q}`);
    assert.equal(Number(q.opts[q.ans]), expected.get(q.q), q.q);
    assert.equal(new Set(q.opts).size, 4);
    assert.ok(q.opts.every(o => Number.isInteger(Number(o)) && Number(o) >= 0));
    expected.delete(q.q);
  }
  assert.equal(expected.size, 0);
});

test('full session includes every sum and final review shows the chosen and correct answers', () => {
  const { run, elements, timers } = loadQuiz();
  run('startNewQuiz()');
  assert.equal(run('quizSet.length'), 130);
  const missed = JSON.parse(run('JSON.stringify(quizSet[0])'));
  const wrongIndex = (missed.ans + 1) % 4;
  for (let i = 0; i < 130; i++) {
    run(`selectAnswer(${i === 0 ? wrongIndex : 'quizSet[currentQIdx].ans'}, document.createElement('button'))`);
    // Duplicate taps must not count as another answer.
    run('selectAnswer(0, document.createElement("button"))');
    assert.equal(timers.length, 1);
    timers.shift()();
  }
  assert.equal(elements.get('vicScore').textContent, '129 / 130');
  const review = elements.get('wrongAnswersReview');
  assert.equal(review.style.display, 'block');
  assert.ok(review.innerHTML.includes(missed.q));
  assert.ok(review.innerHTML.includes(`Joune: ${missed.opts[wrongIndex]}`));
  assert.ok(review.innerHTML.includes(`Regte Antwoord: ${missed.opts[missed.ans]}`));
  assert.equal(run('getHistory()[0].total'), 130);
  run('startNewQuiz()');
  assert.equal(run('currentQIdx'), 0);
  assert.equal(run('quizSet.filter(q => q.userChoice !== null).length'), 0);
});

test('perfect and zero scores both finish correctly', () => {
  const { run, elements } = loadQuiz();
  for (const perfect of [true, false]) {
    run(`startNewQuiz(); quizSet.forEach(q => q.userChoice = ${perfect ? 'q.ans' : '(q.ans + 1) % 4'}); finishQuiz();`);
    assert.equal(elements.get('vicScore').textContent, `${perfect ? 130 : 0} / 130`);
    assert.equal(elements.get('wrongAnswersReview').style.display, perfect ? 'none' : 'block');
  }
});
