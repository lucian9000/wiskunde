const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadQuiz(storage = new Map()) {
  const html = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
  const elements = new Map();
  const element = () => ({ style: {}, classList: { add() {}, remove() {} }, textContent: '', innerHTML: '', children: [], replaceChildren() { this.children = []; }, appendChild(c) { this.children.push(c); }, getContext() { return { clearRect() {} }; } });
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
  return { context, elements, timers, storage, run: code => vm.runInContext(code, context) };
}

test('every sum in the photo appears once, with correct and distinct answer options', () => {
  const { run } = loadQuiz();
  const questions = JSON.parse(run('JSON.stringify(allQuestions.filter(q => ["Vermenigvuldiging", "Deling"].includes(q.cat)))'));
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

test('20-question session and final review shows the chosen and correct answers', () => {
  const { run, elements, timers } = loadQuiz();
  run('startNewQuiz()');
  assert.equal(run('quizSet.length'), 20);
  const missed = JSON.parse(run('JSON.stringify(quizSet[0])'));
  const wrongIndex = (missed.ans + 1) % 4;
  for (let i = 0; i < 20; i++) {
    run(`selectAnswer(${i === 0 ? wrongIndex : 'quizSet[currentQIdx].ans'}, document.createElement('button'))`);
    // Duplicate taps must not count as another answer.
    run('selectAnswer(0, document.createElement("button"))');
    assert.equal(timers.length, 0);
    run("nextQuestion()");
  }
  assert.equal(elements.get('vicScore').textContent, '19 / 20');
  const review = elements.get('wrongAnswersReview');
  assert.equal(review.style.display, 'block');
  assert.ok(review.innerHTML.includes(missed.displayQ || missed.q));
  assert.ok(review.innerHTML.includes(`Joune: ${missed.opts[wrongIndex]}`));
  assert.ok(review.innerHTML.includes(`Regte Antwoord: ${missed.opts[missed.ans]}`));
  assert.equal(run('getHistory()[0].total'), 20);
  run('startNewQuiz()');
  assert.equal(run('currentQIdx'), 0);
  assert.equal(run('quizSet.filter(q => q.userChoice !== null).length'), 0);
});

test('perfect and zero scores both finish correctly', () => {
  const { run, elements } = loadQuiz();
  for (const perfect of [true, false]) {
    run(`startNewQuiz(); quizSet.forEach(q => q.userChoice = ${perfect ? 'q.ans' : '(q.ans + 1) % 4'}); finishQuiz();`);
    assert.equal(elements.get('vicScore').textContent, `${perfect ? 20 : 0} / 20`);
    assert.equal(elements.get('wrongAnswersReview').style.display, perfect ? 'none' : 'block');
  }
});


test('mixed rounds balance all four subjects; focused rounds contain only the selected subject', () => {
  const { run } = loadQuiz();
  run('startNewQuiz()');
  for (const subject of ['vorms', 'maal', 'deel', 'tyd']) {
    assert.equal(run(`quizSet.filter(q => q.subject === '${subject}').length`), 5);
  }
  for (const subject of ['vorms', 'maal', 'deel', 'tyd']) {
    run(`document.getElementById('subjectSelect').value = '${subject}'; startNewQuiz()`);
    assert.equal(run('quizSet.length'), 20);
    assert.equal(run(`quizSet.every(q => q.subject === '${subject}')`), true);
    assert.equal(run('new Set(quizSet.map(q => q.id)).size'), 20);
  }
});

test('cycles cover each subject before repeating and never duplicate within a round', () => {
  for (const subject of ['vorms', 'maal', 'deel', 'tyd']) {
    const { run } = loadQuiz();
    const count = run(`allQuestions.filter(q => q.subject === '${subject}').length`);
    let seen = new Set();
    for (let round = 0; round < 12; round++) {
      const ids = JSON.parse(run(`JSON.stringify(drawQuestions('${subject}', 20).map(q => q.id))`));
      assert.equal(new Set(ids).size, 20);
      for (const id of ids) {
        if (seen.size === count) seen = new Set();
        assert.ok(!seen.has(id), `${subject}: repeated before cycle complete`);
        seen.add(id);
      }
    }
  }
});

test('rotation persists across reloads and is shared between mixed and focused modes', () => {
  const first = loadQuiz();
  first.run('startNewQuiz()');
  const ids = JSON.parse(first.run('JSON.stringify(quizSet.map(q => q.id))'));
  const next = loadQuiz(first.storage);
  next.run("document.getElementById('subjectSelect').value = 'maal'; startNewQuiz()");
  assert.equal(next.run(`quizSet.some(q => ${JSON.stringify(ids)}.includes(q.id))`), false);
});

test('all questions have stable unique IDs, four distinct options and a valid answer', () => {
  const { run } = loadQuiz();
  const qs = JSON.parse(run('JSON.stringify(allQuestions)'));
  assert.equal(new Set(qs.map(q => q.id)).size, qs.length);
  assert.equal(new Set(qs.map(q => q.q)).size, qs.length);
  for (const q of qs) {
    assert.equal(new Set(q.opts).size, 4, q.q);
    assert.ok(Number.isInteger(q.ans) && q.ans >= 0 && q.ans < 4, q.q);
    assert.ok(typeof q.vis === 'string' && q.vis.length > 0, q.q);
  }
});

test('all photographed 3D properties are covered with the school-sheet answers', () => {
  const { run } = loadQuiz();
  const qs = JSON.parse(run('JSON.stringify(allQuestions)'));
  const shapes = {
    'driehoekige piramide':[4,6,4], 'vierkantige piramide':[5,8,5],
    'kubus':[8,12,6], 'silinder':[0,2,3], 'sfeer':[0,0,1], 'keël':[1,1,2],
    'reghoekige prisma':[8,12,6], 'driehoekige prisma':[6,9,5]
  };
  for (const [shape, counts] of Object.entries(shapes)) {
    ['hoeke','rande','vlakke'].forEach((prop,i) => {
      const q = qs.find(q => q.q.startsWith(`Hoeveel ${prop} het 'n ${shape}`));
      assert.ok(q, `${shape} ${prop}`);
      const value = q.opts[q.ans].toLowerCase();
      assert.equal(value.startsWith('geen') ? 0 : parseInt(value), counts[i]);
    });
  }
});

test('next cannot skip an unanswered question or advance a freshly started round', () => {
  const { run, timers } = loadQuiz();
  run('startNewQuiz(); selectAnswer(0, document.createElement("button")); startNewQuiz()');
  run('nextQuestion()');
  assert.equal(run('currentQIdx'), 0);
});

test('invalid saved rotation and unavailable storage do not stop a quiz', () => {
  for (const value of ['not-json', 'null', '[]', '{"maal":["missing","missing"]}']) {
    const storage = new Map([['wiskunde_rotation_v1', value]]);
    const { run } = loadQuiz(storage);
    run("document.getElementById('subjectSelect').value = 'maal'; startNewQuiz()");
    assert.equal(run('quizSet.length'), 20);
    assert.equal(run('new Set(quizSet.map(q => q.id)).size'), 20);
  }
  const { run } = loadQuiz();
  run('localStorage.getItem = () => { throw Error("blocked"); }; localStorage.setItem = () => { throw Error("blocked"); }; startNewQuiz()');
  assert.equal(run('quizSet.length'), 20);
});


test('time facts, source-day events and elapsed intervals from the photos are retained', () => {
  const { run } = loadQuiz();
  const qs = JSON.parse(run('JSON.stringify(allQuestions)'));
  const facts = [
    ['Hoeveel minute is daar in 1 uur?', '60 minute'],
    ['Hoeveel sekondes is daar in 1 minuut?', '60 sekondes'],
    ['Hoeveel ure is daar in 1 dag EN nag saam?', '24 ure'],
    ['Volgens jou leerblad se model: hoeveel ure is die daggedeelte?', '12 ure'],
    ['Volgens jou leerblad se model: hoeveel ure is die naggedeelte?', '12 ure'],
    ['Hoeveel seisoene kry ons in 1 jaar?', '4 seisoene'],
    ['Hoeveel maande is daar in 1 jaar?', '12 maande'],
    ['Hoeveel dae is daar in 1 jaar (gewoonlik)?', '365 dae'],
    ['Hoeveel dae is daar in 1 volle week?', '7 dae'],
    ['Hoeveel dae is daar in 1 skoolweek (Maandag tot Vrydag)?', '5 dae'],
    ['Hoeveel ure is dit van 7 uur die oggend tot 12 uur die middag?', '5 ure'],
    ['Hoeveel ure is dit van 2 uur die middag tot 4 uur in die middag?', '2 ure'],
    ['Hoeveel ure is dit van 2 uur die middag tot 8 uur die aand?', '6 ure'],
    ['Op jou leerblad: hoe laat het die seun opgestaan?', '7 uur'],
    ['Op jou leerblad: hoe laat was pouse?', '12 uur'],
    ['Op jou leerblad: hoe laat het die seun huis toe gegaan?', '2 uur'],
    ['Op jou leerblad: hoe laat het hulle huiswerk gedoen?', '4 uur'],
    ['Op jou leerblad: hoe laat het die seun gaan slaap?', '8 uur']
  ];
  for (const [prompt, answer] of facts) {
    const q = qs.find(q => q.q === prompt);
    assert.ok(q, prompt);
    assert.equal(q.opts[q.ans], answer, prompt);
  }
});

test('2D corners, sides and side types cover the five pictured shapes', () => {
  const { run } = loadQuiz();
  const qs = JSON.parse(run('JSON.stringify(allQuestions)'));
  for (const [shape, corners, sides, curved] of [
    ['sirkel',0,1,true], ['ovaal',0,1,true], ['driehoek',3,3,false],
    ['vierkant',4,4,false], ['reghoek',4,4,false]
  ]) {
    for (const [prop, expected] of [['hoeke',corners], ['sye',sides]]) {
      const q = qs.find(q => q.q === `Hoeveel ${prop} het 'n ${shape}?`);
      assert.ok(q);
      const answer = q.opts[q.ans];
      assert.equal(answer.toLowerCase() === 'geen' ? 0 : Number(answer), expected);
    }
    const q = qs.find(q => q.q === `Watter soort sye het 'n ${shape}?`);
    assert.equal(q.opts[q.ans], curved ? 'Geboë sye' : 'Reguit sye');
  }
});

test('all 48 clocks have numbered faces, correct hands and Afrikaans time answers', () => {
  const { run } = loadQuiz();
  const qs = JSON.parse(run('JSON.stringify(allQuestions.filter(q => q.displayQ))'));
  assert.equal(qs.length, 48);
  for (let h = 1; h <= 12; h++) for (const m of [0,15,30,45]) {
    const q = qs.find(q => q.q.endsWith(`(${h}:${String(m).padStart(2,'0')})`));
    const answer = m === 0 ? `${h} uur` : m === 15 ? `Kwart oor ${h}` : m === 30 ? `Half ${h % 12 + 1}` : `Kwart voor ${h % 12 + 1}`;
    assert.equal(q.opts[q.ans], answer);
    assert.equal((q.vis.match(/<text /g) || []).length, 12);
    assert.ok(q.vis.includes(`rotate(${m * 6} 50 50)`));
    assert.ok(q.vis.includes(`rotate(${h % 12 * 30 + m / 2} 50 50)`));
    assert.ok(!q.displayQ.includes(':'));
  }
});

test('saved results from the previous quiz survive and new results record the subject', () => {
  const key = 'wiskunde_avontuur_scores_v4_visueel';
  const storage = new Map([[key, JSON.stringify([{score:129,total:130,pct:99,date:'2026-11-02T12:00:00Z'}])]]);
  const { run } = loadQuiz(storage);
  run("document.getElementById('subjectSelect').value = 'deel'; startNewQuiz(); finishQuiz()");
  assert.equal(run('getHistory().length'), 2);
  assert.equal(run('getHistory()[0].total'), 130);
  assert.equal(run('getHistory()[1].total'), 20);
  assert.equal(run('getHistory()[1].subject'), 'deel');
});


test('first answer is permanent and feedback immediately reveals the correct answer', () => {
  for (const correct of [true, false]) {
    const { run, elements, timers } = loadQuiz();
    run('startNewQuiz()');
    const answer = run('quizSet[0].opts[quizSet[0].ans]');
    const selected = run(correct ? 'quizSet[0].ans' : '(quizSet[0].ans + 1) % 4');
    run(`selectAnswer(${selected}, document.getElementById('choicesGrid').children[${selected}])`);
    assert.equal(run('currentQIdx'), 0);
    assert.equal(timers.length, 0);
    assert.equal(run('quizSet[0].userChoice'), selected);
    assert.ok(elements.get('answerFeedback').textContent.includes(correct ? 'Korrek!' : 'Verkeerd.'));
    assert.ok(elements.get('answerFeedback').textContent.includes(answer));
    assert.ok(elements.get('choicesGrid').children.every(btn => btn.disabled));
    run('selectAnswer((quizSet[0].userChoice + 1) % 4, document.createElement("button"))');
    assert.equal(run('quizSet[0].userChoice'), selected);
    run('nextQuestion(); nextQuestion()');
    assert.equal(run('currentQIdx'), 1);
    assert.equal(elements.get('answerFeedback').style.display, 'none');
    assert.ok(elements.get('choicesGrid').children.every(btn => !btn.disabled));
  }
});


test('every question has a bundled Afrikaans recording', () => {
  const { run } = loadQuiz();
  const files = JSON.parse(run('JSON.stringify(allQuestions.map(q => AFRIKAANS_AUDIO[spokenQuestion(q)]))'));
  for (const file of files) {
    assert.match(file, /^[a-f0-9]{20}\.mp3$/);
    assert.ok(fs.statSync(require('node:path').join(__dirname, '../audio/af', file)).size > 1000);
  }
});

test('read-aloud plays the bundled audio and stops it when the question changes', async () => {
  const { run, context } = loadQuiz();
  const players = [];
  context.Audio = class {
    constructor(url) { this.url=url; this.paused=false; players.push(this); }
    play() { return Promise.resolve(); }
    pause() { this.paused=true; }
  };
  run('startNewQuiz()');
  await run("document.getElementById('readAloudBtn').onclick()");
  assert.match(players[0].url, /^audio\/af\/[a-f0-9]{20}\.mp3$/);
  run('renderQuestion()');
  assert.equal(players[0].paused, true);
});

test('failed audio never falls back to an English voice', async () => {
  const { run, context, elements } = loadQuiz();
  context.Audio = class { pause() {} play() { return Promise.reject(Error('network')); } };
  let used = null;
  context.window.speechSynthesis = {cancel(){},getVoices(){return [{lang:'en-ZA',name:'English'}];},speak(u){used=u;}};
  context.SpeechSynthesisUtterance = class { constructor(text){this.text=text;} };
  run('startNewQuiz()');
  await run("document.getElementById('readAloudBtn').onclick()");
  assert.equal(used,null);
  assert.match(elements.get('readAloudStatus').textContent,/Afrikaanse/);
  context.window.speechSynthesis.getVoices = () => [{lang:'en-US'}, {lang:'af-ZA',name:'Afrikaans'}];
  await run("document.getElementById('readAloudBtn').onclick()");
  assert.equal(used.voice.lang,'af-ZA');
});
