const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// Isolated in-memory DOM/storage: these tests never read a user's browser data.
function harness(storage = new Map(), initialTime = '2026-08-27T09:00:00') {
  let now = new Date(initialTime).getTime(), seq = 0;
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size, 'duplicate HTML ids');
  const drawCalls = [], alerts = [], canvasStack = [], intervals = new Map(); let intervalSeq = 0;
  const canvas = new Proxy({ font: '10px sans-serif', globalAlpha: 1,
    measureText: text => ({ width: Array.from(String(text)).length * 7 }),
    fillText(text, x, y) { drawCalls.push({ text: String(text), x, y, font: this.font, globalAlpha: this.globalAlpha }); },
    save() { canvasStack.push({ font: this.font, globalAlpha: this.globalAlpha }); },
    restore() { Object.assign(this, canvasStack.pop() || {}); }
  }, { get: (obj, key) => obj[key] ?? (() => {}) });
  const eventTarget = () => ({ listeners: new Map(),
    addEventListener(type, handler) { const list = this.listeners.get(type) || []; list.push(handler); this.listeners.set(type, list); },
    removeEventListener(type, handler) { this.listeners.set(type, (this.listeners.get(type) || []).filter(item => item !== handler)); },
    emit(type, event = {}) { const payload = { target: this, currentTarget: this, preventDefault() {}, stopPropagation() {}, ...event }; for (const handler of this.listeners.get(type) || []) handler(payload); this['on' + type]?.(payload); }
  });
  let nodes;
  const makeNode = id => {
    const classes = new Set(); let markup = '';
    return { ...eventTarget(), id, value: '', checked: false, tagName: 'INPUT', textContent: '', dataset: {}, style: { setProperty(key, value) { this[key] = value; } },
      get innerHTML() { return markup; },
      set innerHTML(value) { markup = String(value); if (nodes) for (const match of markup.matchAll(/<([a-z][\w-]*)\b([^>]*\bid="([^"]+)"[^>]*)>/gi)) { const node = makeNode(match[3]); node.tagName = match[1].toUpperCase(); node.value = /\bvalue="([^"]*)"/.exec(match[2])?.[1] || ''; nodes.set(match[3], node); } },
      classList: { add: (...items) => items.forEach(x => classes.add(x)), remove: (...items) => items.forEach(x => classes.delete(x)), contains: x => classes.has(x), toggle(x, force) { const on = force ?? !classes.has(x); on ? classes.add(x) : classes.delete(x); return on; } },
      setAttribute() {}, querySelectorAll: () => [], querySelector: () => null, contains: () => false,
      focus() {}, click() { if (!this.disabled) this.emit('click'); }, setCustomValidity() {}, reportValidity() {}, getContext: () => canvas, toDataURL: () => 'data:image/png;base64,',
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 900, height: 600 }), clientWidth: 900 };
  };
  nodes = new Map(ids.map(id => [id, makeNode(id)]));
  for (const match of html.matchAll(/<([a-z][\w-]*)\b([^>]*\bid="([^"]+)"[^>]*)>/gi)) {
    const node = nodes.get(match[3]); node.tagName = match[1].toUpperCase();
    node.value = /\bvalue="([^"]*)"/.exec(match[2])?.[1] || '';
    node.classList.add(...(/\bclass="([^"]*)"/.exec(match[2])?.[1] || '').split(/\s+/).filter(Boolean));
  }
  const document = { ...eventTarget(), getElementById: id => nodes.get(id) || null,
    querySelectorAll: () => [], querySelector: () => null, activeElement: null, hidden: false,
    documentElement: makeNode('root'), body: makeNode('body'), createElement: () => makeNode('new') };
  const window = { ...eventTarget(), matchMedia: () => ({ matches: false }), devicePixelRatio: 1, alert: message => alerts.push(message), confirm: () => true };
  nodes.get('focusTaskType').value = 'learn'; nodes.get('focusTimerType').value = 'countup'; nodes.get('focusDuration').value = '25';
  class FakeDate extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const context = vm.createContext({ document, Date: FakeDate, crypto: { randomUUID: () => String(++seq) },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    window,
    navigator: {}, location: { protocol: 'http:' }, setInterval: (handler, ms) => { const id = ++intervalSeq; intervals.set(id, { handler, ms }); return id; }, clearInterval: id => intervals.delete(id), setTimeout: () => 1, clearTimeout() {}, console });
  vm.runInContext(source, context, { filename: 'app.js' });
  for (const [id, node] of vm.runInContext('Object.entries(dom)', context)) assert.ok(node, `missing DOM id: ${id}`);
  return { storage, nodes, drawCalls, alerts, click: id => nodes.get(id).click(), emitWindow: type => window.emit(type), emitDocument: type => document.emit(type), fireInterval: ms => { const timer = [...intervals.values()].find(timer => timer.ms === ms); assert.ok(timer, `missing ${ms}ms timer`); timer.handler(); }, run: code => vm.runInContext(code, context), advance: ms => { now += ms; }, setTime: text => { now = new Date(text).getTime(); }, json: code => JSON.parse(vm.runInContext(`JSON.stringify(${code})`, context)) };
}

function saveEditedEvent(h, eventExpression, values) {
  h.run(`openEventModal(${eventExpression})`);
  for (const [id, value] of Object.entries(values)) {
    const node = h.nodes.get(id); node.value = value;
    node.emit(id === 'eventSubjectPath' || node.tagName === 'SELECT' ? 'change' : 'input');
  }
  h.click('saveEventBtn');
}

function seedReviewSource(h) {
  h.run("state.events.push({id:'source',date:currentDateKey(),halfZone:'record',taskType:'learn',categoryId:state.categories[0].id,categoryName:state.categories[0].name,subjectPath:[state.categories[0].id],eventName:'原章节',materialLocation:'P1',startSlot:480,endSlot:540});generateReviews(state.events[0]);");
}

test('startup, DOM wiring, flashcard removal and new event fields', () => {
  const h = harness();
  assert.equal(h.run('state.focusTasks.length'), 0);
  assert.doesNotMatch(html, /flashcard|知识点名称/i);
  assert.doesNotMatch(source, /function\s+\w*flashcard|normalizeFlashcards/i);
  assert.match(html, /id="todayBtn"/);
  assert.match(html, /id="immersionPauseBtn"/);
});

test('learning pause/resume records only active time and generates one schedule on completion', () => {
  const h = harness();
  h.run("startFocus(state.categories[0].id); state.focus.immersiveFields.eventName='大章节'; state.focus.immersiveFields.leftover='第二节';");
  h.advance(600000); h.run('pauseFocus()');
  assert.equal(h.run('state.events.length'), 1); assert.equal(h.run('state.reviews.length'), 0);
  assert.equal(h.run('state.focusTasks[0].totalSeconds'), 600);
  h.advance(3600000); h.run('resumeFocusTask(state.focusTasks[0].id)');
  h.advance(300000); h.run('pauseFocus()');
  assert.equal(h.run('state.events.length'), 2); assert.equal(h.run('state.focusTasks[0].totalSeconds'), 900);
  h.setTime('2026-08-29T10:00:00'); h.run('completeFocusTask(state.focusTasks[0]); completeFocusTask(state.focusTasks[0]);');
  assert.equal(h.run('state.reviews.length'), 5); assert.equal(h.run('state.reviews[0].reviewDate'), '2026-08-30');
  assert.equal(h.run('new Set(state.reviews.map(r=>r.sourceEventId)).size'), 1);
  assert.equal(h.run('state.events.reduce((s,e)=>s+e.focusSeconds,0)'), 900);
  assert.equal(h.run('state.events[0].eventName'), '大章节');
});

test('scheduled review stays pending when paused, resumes the same task and settles once', () => {
  const h = harness();
  h.run("state.events.push({id:'source',date:'2026-08-20',categoryId:state.categories[0].id,categoryName:'数学',eventName:'积分',materialLocation:'P1',subjectPath:[state.categories[0].id],halfZone:'record',taskType:'learn',startSlot:0,endSlot:60});generateReviews(state.events[0]);startReview(state.reviews[0].id);");
  h.advance(120000); h.run('pauseFocus()');
  assert.equal(h.run('state.reviews[0].completed'), false); assert.equal(h.run('state.reviews.length'), 5);
  h.advance(600000); h.run('startReview(state.reviews[0].id)'); h.advance(180000); h.run('pauseFocus();completeFocusTask(state.focusTasks[0]);');
  assert.equal(h.run('state.focusTasks.length'), 1); assert.equal(h.run('state.reviews[0].resultSeconds'), 300);
  assert.equal(h.run('state.reviews[0].completed'), true); assert.equal(h.run('state.reviews[1].completed'), false);
});

test('abandon clears unfinished status, retains segment history and does not generate reviews', () => {
  const h = harness(); h.run('startFocus(state.categories[0].id)'); h.advance(10000); h.run('pauseFocus();abandonFocusTask(state.focusTasks[0].id)');
  assert.equal(h.run('state.focusTasks[0].status'), 'abandoned');assert.equal(h.run('state.events.length'), 1);assert.equal(h.run('state.reviews.length'), 0);
});

test('paused tasks and old flashcard data survive save/reload unchanged', () => {
  const h = harness();
  h.run("state.events.push({id:'legacy',date:'2026-08-20',halfZone:'record',categoryId:state.categories[0].id,startSlot:0,endSlot:60,knowledgePoint:'旧名称',flashcards:[{id:'card',question:'旧问题',answer:'旧答案'}]});startFocus(state.categories[0].id);");
  h.advance(30000);h.run('pauseFocus()');
  const fresh = harness(h.storage);
  assert.equal(fresh.run('state.focus'), null);assert.equal(fresh.run('state.focusTasks[0].status'), 'paused');
  assert.deepEqual(fresh.json('state.events[0].flashcards'), [{id:'card',question:'旧问题',answer:'旧答案'}]);
  assert.equal(fresh.run('state.events[0].eventName'), '旧名称'); assert.equal(fresh.run('state.events[0].textContent'), '');
});

test('active task reload restores elapsed time and stale separate key cannot resurrect a pause', () => {
  const h=harness();h.run('startFocus(state.categories[0].id)');const active=h.storage.get('learning_tool_active_focus');
  const fresh=harness(h.storage,'2026-08-27T09:05:00');assert.ok(fresh.run('state.focus'));fresh.run('pauseFocus()');
  assert.equal(fresh.run('state.focusTasks[0].totalSeconds'),300);
  h.storage.set('learning_tool_active_focus',active);const again=harness(h.storage,'2026-08-27T10:00:00');
  assert.equal(again.run('state.focus'),null);assert.equal(again.run('state.events.length'),1);
});

test('cross-midnight segment is split by date without double counting', () => {
  const h=harness(new Map(),'2026-08-27T23:55:00');h.run('startFocus(state.categories[0].id)');h.advance(600000);h.run('pauseFocus()');
  assert.deepEqual(h.json('state.events.map(e=>[e.date,e.startSlot,e.endSlot,e.focusSeconds])'),[['2026-08-27',1435,1440,300],['2026-08-28',0,5,300]]);
  assert.equal(h.run('state.focusTasks[0].totalSeconds'),600);
});

test('late countdown check caps active duration and asks for completion instead of completing automatically', () => {
  const h=harness();h.run("dom.focusTimerType.value='countdown';dom.focusDuration.value='1';startFocus(state.categories[0].id)");h.advance(3600000);h.run('tickFocus()');
  assert.equal(h.run('state.focusTasks[0].totalSeconds'),60);assert.equal(h.run('state.focusTasks[0].status'),'paused');assert.equal(h.run('state.reviews.length'),0);assert.ok(h.run('state.pendingFocus'));
  h.run('discardFocusRecord();resumeFocusTask(state.focusTasks[0].id)');assert.equal(h.run('state.focus.type'),'countup');
});

test('completion form keeps summary blank and can save unfinished chapters', () => {
  const h=harness();h.run("startFocus(state.categories[0].id);state.focus.immersiveFields.eventName='标题';");h.advance(20000);h.run('finishFocus(false)');
  assert.equal(h.nodes.get('focusResultSummary').value,'');h.nodes.get('focusResultLeftover').value='待做第三节';h.run('discardFocusRecord()');
  assert.equal(h.run('state.focusTasks[0].status'),'paused');assert.equal(h.run('state.events[0].leftover'),'待做第三节');assert.equal(h.run('state.events[0].textContent'),'');assert.equal(h.run('state.reviews.length'),0);
});

test('review card uses current event name/material, mastery colors and no suggestion/leftover/summary', () => {
  const h=harness();const card=h.run("state.events.push({id:'s',eventName:'新标题',materialLocation:'P23',textContent:'隐藏摘要',leftover:'隐藏遗留',actionTypes:['reading']});reviewCard({id:'r',sourceEventId:'s',reviewDate:'2026-08-27',reviewNumber:1,eventName:'旧标题',knowledgePoint:'旧知识',mastery:'weak'})");
  assert.match(card,/<strong>新标题<\/strong><span class="review-material">P23/);assert.match(card,/mastery-weak/);assert.doesNotMatch(card,/旧标题|旧知识|隐藏摘要|隐藏遗留|建议/);
});

test('timeline chooses the longest free arrow row and only folds for same-hour neighbors', () => {
  const h=harness();h.run("state.events=[{id:'a',date:currentDateKey(),halfZone:'record',startSlot:595,endSlot:640,eventName:'跨小时章节',materialLocation:'P1-P20'}];");
  assert.equal(h.run('eventLabelPlacement(state.events[0],createLayout(900,56)).segment.hour'),10);
  h.run("state.events.push({id:'b',date:currentDateKey(),halfZone:'record',startSlot:590,endSlot:595,eventName:'前一小时'})");
  assert.equal(h.run('eventLabelPlacement(state.events[0],createLayout(900,56)).hasFollowing'),false);
  h.run("state.events.push({id:'c',date:currentDateKey(),halfZone:'record',startSlot:645,endSlot:660,eventName:'同小时后项'})");
  assert.equal(h.run('eventLabelPlacement(state.events[0],createLayout(900,56)).hasFollowing'),true);
  assert.equal(h.run('eventLabelPlacement(state.events[0],createLayout(900,56)).x'),h.run('eventSegments(state.events[0],createLayout(900,56))[1].x1'));
});

test('without following event, long title and adjacent material wrap completely', () => {
  const h=harness();h.run("state.events=[{id:'a',date:currentDateKey(),halfZone:'record',startSlot:600,endSlot:640,eventName:'长'.repeat(100),materialLocation:'资料P1'}]");
  const text=h.run("layoutEventLabel(ctx,state.events[0],createLayout(900,56)).parts.map(p=>p.text).join('')");assert.equal(text,'长'.repeat(100)+' 资料P1');
  assert.ok(h.run('createLayout(500,56).rowHeights[10]')>56);
});

test('completed child subject with reviews disabled generates none', () => {
  const h=harness();h.run("state.categories[0].children=[{id:'child',name:'子学科',reviewEnabled:false}];startFocus(state.categories[0].id);state.focusTasks[0].subjectPath=[state.categories[0].id,'child'];");h.advance(10000);h.run('pauseFocus();completeFocusTask(state.focusTasks[0])');assert.equal(h.run('state.reviews.length'),0);
});

test('overdue review batches move by the same delta', () => {
  const h=harness();h.run("state.reviews=[{id:'r1',sourceEventId:'s',reviewNumber:1,reviewDate:'2026-08-25'},{id:'r2',sourceEventId:'s',reviewNumber:2,reviewDate:'2026-08-28'},{id:'r3',sourceEventId:'s',reviewNumber:3,reviewDate:'2026-09-01'}];carryOverReviews()");
  assert.deepEqual(h.json('state.reviews.map(r=>r.reviewDate)'),['2026-08-27','2026-08-30','2026-09-03']);
});

test('closing completion dialog leaves the task resumable', () => {
  const h=harness();h.run('startFocus(state.categories[0].id)');h.advance(10000);h.run('finishFocus(false)');
  assert.match(h.nodes.get('unfinishedTaskList').innerHTML,/disabled/);
  h.run("closeModal('focusDetailModal')");
  assert.doesNotMatch(h.nodes.get('unfinishedTaskList').innerHTML,/disabled/);
  h.run('resumeFocusTask(state.focusTasks[0].id)');assert.ok(h.run('state.focus'));
});

test('starting a paused plan reuses its task and completion marks the original plan', () => {
  const h=harness();h.run("state.events.push({id:'plan',date:currentDateKey(),halfZone:'plan',taskType:'learn',categoryId:state.categories[0].id,categoryName:'数学',eventName:'章节计划',materialLocation:'P9',textContent:'旧摘要',startSlot:540,endSlot:600});startPlanEvent('plan')");
  assert.equal(h.run('state.focus.immersiveFields.summary'),'');h.advance(10000);h.run('pauseFocus()');
  assert.equal(h.run('state.events[0].planCompletedAt'),undefined);assert.equal(h.run('state.reviews.length'),0);
  h.advance(10000);h.run("startPlanEvent('plan')");h.advance(10000);h.run('pauseFocus();completeFocusTask(state.focusTasks[0])');
  assert.equal(h.run('state.focusTasks.length'),1);assert.ok(h.run('state.events[0].planCompletedAt'));assert.equal(h.run('state.reviews.length'),5);
});

test('direct completion of a paused review clears unfinished status and keeps cumulative duration', () => {
  const h=harness();h.run("state.events.push({id:'s',date:currentDateKey(),halfZone:'record',taskType:'learn',categoryId:state.categories[0].id,categoryName:'数学',eventName:'测试',startSlot:0,endSlot:10});generateReviews(state.events[0]);startReview(state.reviews[0].id)");h.advance(20000);h.run('pauseFocus();toggleReview(state.reviews[0].id)');
  assert.equal(h.run('state.focusTasks[0].status'),'completed');assert.equal(h.run('state.reviews[0].resultSeconds'),20);assert.equal(h.run('state.reviews.length'),5);
});

test('undo/redo keeps task status and time segments consistent', () => {
  const h=harness();h.run('startFocus(state.categories[0].id)');h.advance(60000);h.run('pauseFocus()');
  h.run('undo()');assert.ok(h.run('state.focus'));assert.equal(h.run('state.events.length'),0);
  h.run('redo()');assert.equal(h.run('state.focus'),null);assert.equal(h.run('state.events.length'),1);assert.equal(h.run('state.focusTasks[0].status'),'paused');
});

test('editing an unfinished segment does not generate reviews or alter historical flashcard data', () => {
  const h=harness();h.run('startFocus(state.categories[0].id)');h.advance(60000);h.run('pauseFocus()');
  h.run("state.events[0].flashcards=[{id:'old',question:'保留'}];openEventModal(state.events[0]);dom.eventSubjectPath.value=state.categories[0].name;dom.eventName.value='修改后的章节';dom.eventStartHour.value=9;dom.eventStartMinute.value=0;dom.eventEndHour.value=9;dom.eventEndMinute.value=1;saveEvent()");
  assert.equal(h.run('state.reviews.length'),0);assert.equal(h.run('state.focusTasks[0].fields.eventName'),'修改后的章节');assert.deepEqual(h.json('state.events[0].flashcards'),[{id:'old',question:'保留'}]);
});

test('yearly dots and input sizing match updated requirements', () => {
  const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
  assert.match(css,/\.heat-dot\s*\{[^}]*width: 20px; height: 20px;[^}]*background: #fff/);
  assert.match(css,/\.immersion-input-grid input, [^{]+\{[^}]*font-size: 16px;[^}]*opacity: 1/);
  assert.doesNotMatch(css,/flashcard/i);
  assert.match(css,/\.focus-card:not\(\.collapsed\)\s*\{ overflow: auto/);
});

test('R1 historical edits keep the original date and unknown data through undo and reload', () => {
  const h = harness();
  h.run("state.events.push({id:'history',date:'2026-08-20',halfZone:'record',taskType:'learn',categoryId:state.categories[0].id,categoryName:'数学',subjectPath:[state.categories[0].id],eventName:'原名称',startSlot:540,endSlot:600,flashcards:[{legacy:'保留'}],customData:{untouched:true}})");
  saveEditedEvent(h, 'state.events[0]', { eventName: '历史更名' });
  assert.equal(h.run('state.events[0].date'), '2026-08-20');
  assert.equal(h.run('currentDateKey()'), '2026-08-27');
  h.run('undo()'); assert.equal(h.run('state.events[0].eventName'), '原名称');
  h.run('redo()'); const restored = harness(h.storage);
  assert.equal(restored.run('state.events[0].date'), '2026-08-20');
  assert.equal(restored.run('state.events[0].eventName'), '历史更名');
  assert.deepEqual(restored.json('state.events[0].flashcards'), [{ legacy: '保留' }]);
  assert.deepEqual(restored.json('state.events[0].customData'), { untouched: true });
});

test('R2 manually saved third-level records enter parent statistics and the actual heatmap', () => {
  const h = harness();
  h.run("state.categories[0].children=[{id:'child',name:'二级',reviewEnabled:true,children:[{id:'topic',name:'三级',reviewEnabled:true}]}];openEventModal(null,{halfZone:'record',startSlot:540,endSlot:600})");
  h.nodes.get('eventSubjectPath').value = '数学 / 二级 / 三级'; h.nodes.get('eventSubjectPath').emit('change');
  h.nodes.get('eventName').value = '手工学习'; h.click('saveEventBtn');
  assert.deepEqual(h.json('state.events[0].subjectPath'), [h.run('state.categories[0].id'), 'child', 'topic']);
  assert.equal(h.run('state.events[0].focusSeconds'), undefined);
  h.run("state.events.push({...state.events[0],id:'plan',halfZone:'plan',focusSeconds:7200});dom.statsRange.value='month';");
  for (const selection of ['[state.categories[0].id]', "['child']", "[state.categories[0].id,'child','topic']"]) {
    h.run(`state.statsSubjects=new Set(${selection});renderStats()`);
    assert.equal(String(h.nodes.get('statTotalCount').textContent), '1');
    assert.equal(h.nodes.get('statTotalTime').textContent, '1h 0m');
  }
  h.run('state.selectedSubjectId=state.categories[0].id;renderSubjectDetail()');
  const detail = h.nodes.get('subjectDetail').innerHTML;
  assert.match(detail, /title="8月27日 1h 0m" style="background:rgba/);
  assert.match(detail, /title="8月28日 0m" style=""/);
});

test('R3 edited segment time recomputes the task and survives subsequent resumes and undo', () => {
  const h = harness(); h.run('startFocus(state.categories[0].id)'); h.advance(120000); h.run('pauseFocus()');
  h.advance(600000); h.run('resumeFocusTask(state.focusTasks[0].id)'); h.advance(180000); h.run('pauseFocus()');
  saveEditedEvent(h, 'state.events[0]', { eventEndHour: 9, eventEndMinute: 4, eventEndSecond: 0 });
  assert.equal(h.run('state.events[0].focusSeconds'), 240);
  assert.equal(h.run('state.focusTasks[0].totalSeconds'), 420);
  h.run('undo()'); assert.equal(h.run('state.focusTasks[0].totalSeconds'), 300);
  h.run('redo()'); h.advance(600000); h.run('resumeFocusTask(state.focusTasks[0].id)'); h.advance(60000); h.run('pauseFocus()');
  assert.equal(h.run('state.focusTasks[0].totalSeconds'), 480);
  assert.equal(harness(h.storage).run('state.focusTasks[0].totalSeconds'), 480);
});

test('R4 subject edits apply to every task segment, resumed segments and review eligibility', () => {
  const h = harness(); h.run('state.categories[1].reviewEnabled=false;startFocus(state.categories[0].id)');
  h.advance(60000); h.run('pauseFocus();resumeFocusTask(state.focusTasks[0].id)'); h.advance(60000); h.run('pauseFocus()');
  saveEditedEvent(h, 'state.events[0]', { eventSubjectPath: '英语', eventName: '英语章节' });
  assert.equal(h.run('state.focusTasks[0].categoryName'), '英语');
  assert.equal(h.run("state.events.every(e=>e.categoryName==='英语'&&e.subjectPath[0]===state.categories[1].id)"), true);
  h.run('resumeFocusTask(state.focusTasks[0].id)'); h.advance(60000); h.run('pauseFocus();completeFocusTask(state.focusTasks[0])');
  assert.equal(h.run('state.events[2].categoryName'), '英语'); assert.equal(h.run('state.reviews.length'), 0);
});

test('R5 editing a subminute record preserves milliseconds, duration and precise detail text', () => {
  const h = harness(new Map(), '2026-08-27T09:00:05.125');
  h.run('startFocus(state.categories[0].id)'); h.advance(20125); h.run('pauseFocus()');
  const before = h.json('[state.events[0].startSlot,state.events[0].endSlot,state.events[0].focusSeconds]');
  saveEditedEvent(h, 'state.events[0]', { eventName: '短时段更名' });
  assert.deepEqual(h.json('[state.events[0].startSlot,state.events[0].endSlot,state.events[0].focusSeconds]'), before);
  assert.equal(h.run('state.events[0].eventName'), '短时段更名');
  h.run('openEventDetail(state.events[0].id)');
  assert.match(h.nodes.get('eventDetailBody').innerHTML, /09:00:05\.125–09:00:25\.25/);
  assert.equal(h.alerts.length, 0);
});

test('R5 editing midnight endpoints preserves 24:00 and the previous calendar day', () => {
  const h = harness(new Map(), '2026-08-27T23:59:00');
  h.run('startFocus(state.categories[0].id)'); h.advance(65000); h.run('pauseFocus();openEventModal(state.events[0])');
  assert.equal(Number(h.nodes.get('eventEndHour').value), 24);
  h.nodes.get('eventName').value = '午夜分段'; h.click('saveEventBtn');
  assert.deepEqual(h.json('[state.events[0].date,state.events[0].startSlot,state.events[0].endSlot,state.events[0].focusSeconds]'), ['2026-08-27',1439,1440,60]);
  assert.equal(h.run('state.focusTasks[0].totalSeconds'), 65); assert.equal(h.alerts.length, 0);
});

test('R5 seconds obey hidden-hour boundaries and reject times after 24:00', () => {
  const h = harness();
  h.run("state.settings.hiddenHours='9-10'"); assert.equal(h.run('isRangeVisible(539.75,540)'), true);
  assert.equal(h.run('isRangeVisible(539.25,540.25)'), false);
  h.run("state.settings.hiddenHours='8-9'"); assert.equal(h.run('isRangeVisible(539.75,540)'), false);
  h.run("state.settings.hiddenHours='';openEventModal(null,{halfZone:'record',startSlot:1439,endSlot:1440});dom.eventEndSecond.value=1");
  assert.equal(h.run('readEventTime()'), null); h.click('saveEventBtn'); assert.equal(h.run('state.events.length'), 0);
});

test('R5 unchanged recorded time can be renamed even when that hour is now hidden', () => {
  const h = harness(); h.run('startFocus(state.categories[0].id)'); h.advance(20000); h.run("pauseFocus();state.settings.hiddenHours='9-10'");
  saveEditedEvent(h, 'state.events[0]', { eventName: '隐藏时段仅改名' });
  assert.equal(h.run('state.events[0].eventName'), '隐藏时段仅改名'); assert.equal(h.run('state.events[0].focusSeconds'), 20);
});

test('R6 actual daily-report drawing sums precise durations before rounding and colors shares correctly', () => {
  const h = harness();
  h.run("state.events=[[0,540,540.5,30],[0,541,541.5,30],[1,550,552,120]].map(([subject,start,end,seconds],i)=>({id:'segment'+i,date:currentDateKey(),halfZone:'record',taskType:'learn',categoryId:state.categories[subject].id,eventName:'段'+i,startSlot:start,endSlot:end,focusSeconds:seconds}));");
  h.drawCalls.length = 0; h.click('exportImageBtn');
  assert.ok(h.drawCalls.some(call => call.x === 60 && call.y === 181 && call.text === '3m'));
  assert.ok(h.drawCalls.some(call => call.x === 930 && call.y === 158 && call.text === '3m'));
  assert.ok(h.drawCalls.some(call => call.text === '数学  33%'));
  assert.ok(h.drawCalls.some(call => call.text === '英语  67%'));
});

test('R6 calendar event labels also show short segments without a one-minute minimum', () => {
  const h = harness(); h.run('startFocus(state.categories[0].id)'); h.advance(1000); h.run('pauseFocus();renderCalendar()');
  assert.match(h.nodes.get('monthCalendar').innerHTML, /calendar-event-duration">1s</);
});

function overnightReviews() {
  const h = harness(new Map(), '2026-08-27T23:59:00');
  h.run("state.reviews=[{id:'r1',sourceEventId:'s',reviewNumber:1,reviewDate:'2026-08-27',completed:false},{id:'r2',sourceEventId:'s',reviewNumber:2,reviewDate:'2026-08-29',completed:false}];saveBackup()");
  h.setTime('2026-08-28T00:01:00'); return h;
}

test('R7 the actual Today button carries overdue batches without reloading', () => {
  const h = overnightReviews(); h.click('todayBtn');
  assert.deepEqual(h.json('state.reviews.map(r=>r.reviewDate)'), ['2026-08-28','2026-08-30']);
  assert.equal(h.run('currentDateKey()'), '2026-08-28'); assert.equal(String(h.nodes.get('reviewBadge').textContent), '1');
  assert.equal(h.run('filteredReviews().length'), 1); h.click('todayBtn');
  assert.deepEqual(JSON.parse(h.storage.get('learning_tool_backup')).reviews.map(r => r.reviewDate), ['2026-08-28','2026-08-30']);
});

test('R7 idle window resume callbacks carry batches once without changing a historical view', () => {
  const h = overnightReviews(); h.emitWindow('focus'); h.emitWindow('pageshow'); h.emitDocument('visibilitychange');
  assert.equal(h.run('state.focus'), null);
  assert.deepEqual(h.json('state.reviews.map(r=>r.reviewDate)'), ['2026-08-28','2026-08-30']);
  assert.equal(h.run('state.reviews[0].carriedOverCount'), 1); assert.equal(h.run('currentDateKey()'), '2026-08-27');
});

test('R7 the registered foreground timer also handles midnight rollover', () => {
  const h = overnightReviews(); h.fireInterval(15000); h.fireInterval(15000);
  assert.deepEqual(h.json('state.reviews.map(r=>r.reviewDate)'), ['2026-08-28','2026-08-30']);
  assert.equal(h.run('state.reviews[0].carriedOverCount'), 1);
});

test('R8 deleting a source clears paused dependencies but preserves their records and undo history', () => {
  const h = harness(); seedReviewSource(h); h.run('startReview(state.reviews[0].id)'); h.advance(60000); h.run('pauseFocus()');
  h.run("state.events[1].flashcards=[{old:'复习历史'}];state.focusTasks[0].customData={keep:true};openTaskCompletion(state.focusTasks[0].id);deleteEvent('source')");
  assert.equal(h.run('state.focusTasks[0].status'), 'abandoned'); assert.equal(h.run('state.reviews.length'), 0);
  assert.equal(h.run('state.pendingFocus'), null); assert.equal(h.run('state.events.length'), 1);
  assert.deepEqual(h.json('state.events[0].flashcards'), [{old:'复习历史'}]);
  h.run('undo()'); assert.equal(h.run('state.focusTasks[0].status'), 'paused'); assert.equal(h.run('state.reviews.length'), 5);
  h.run('redo()'); const restored = harness(h.storage);
  assert.equal(restored.run('state.focusTasks[0].status'), 'abandoned');
  assert.deepEqual(restored.json('state.focusTasks[0].customData'), {keep:true});
});

test('R8 deleting or editing a source of an active review is rejected without mutation', () => {
  const h = harness(); seedReviewSource(h); h.run('startReview(state.reviews[0].id)'); h.advance(20000);
  const before = h.json('[snapshot(),state.history.length]');
  h.run("deleteEvent('source');openEventModal(state.events[0])");
  assert.deepEqual(h.json('[snapshot(),state.history.length]'), before); assert.equal(h.alerts.length, 2);
});

test('R8 disabling reviews on a manual source also clears its paused dependencies', () => {
  const h = harness(); seedReviewSource(h); h.run('startReview(state.reviews[0].id)'); h.advance(60000); h.run('pauseFocus();state.categories[1].reviewEnabled=false');
  saveEditedEvent(h, 'state.events[0]', { eventSubjectPath: '英语' });
  assert.equal(h.run('state.reviews.length'), 0); assert.equal(h.run('state.focusTasks[0].status'), 'abandoned');
  assert.equal(h.run('state.events[1].focusSeconds'), 60);
});

test('R4 editing a learning source updates paused review identity without overwriting its progress', () => {
  const h = harness(); h.run("startFocus(state.categories[0].id);state.focus.immersiveFields.eventName='旧名称';state.focus.immersiveFields.materialLocation='P1';");
  h.advance(60000); h.run("pauseFocus();completeFocusTask(state.focusTasks[0]);startReview(state.reviews[0].id,'P5');state.focus.immersiveFields.notes='本轮笔记';state.focus.immersiveFields.summary='本轮摘要';");
  h.advance(60000); h.run('pauseFocus()');
  saveEditedEvent(h, 'state.events[0]', { eventSubjectPath: '英语', eventName: '新名称', eventMaterialLocation: 'P1-P20' });
  assert.deepEqual(h.json('[state.focusTasks[1].categoryName,state.focusTasks[1].fields.eventName,state.focusTasks[1].fields.materialLocation,state.focusTasks[1].fields.notes]'), ['英语','新名称','P5','本轮笔记']);
  h.run('resumeFocusTask(state.focusTasks[1].id)'); h.advance(30000); h.run('pauseFocus();completeFocusTask(state.focusTasks[1])');
  assert.equal(h.run('state.events[0].eventName'), '新名称'); assert.equal(h.run('state.events[0].materialLocation'), 'P1-P20');
  assert.equal(h.run('state.reviews[0].resultStartPoint'), 'P5'); assert.equal(h.run('state.reviews[0].resultSummary'), '本轮摘要');
  assert.equal(h.run('state.events.at(-1).categoryName'), '英语');
});

test('R3 finished review duration follows edits to its settled task only', () => {
  const h = harness(); seedReviewSource(h); h.run('startReview(state.reviews[0].id)'); h.advance(60000); h.run('pauseFocus();completeFocusTask(state.focusTasks[0])');
  saveEditedEvent(h, 'state.events[1]', { eventEndMinute: 2 });
  assert.equal(h.run('state.reviews[0].resultSeconds'), 120);
  h.run('toggleReview(state.reviews[0].id);startReview(state.reviews[0].id)'); h.advance(30000); h.run('pauseFocus();completeFocusTask(state.focusTasks[1])');
  saveEditedEvent(h, 'state.events[1]', { eventEndMinute: 3 });
  assert.equal(h.run('state.focusTasks[0].totalSeconds'), 180); assert.equal(h.run('state.reviews[0].resultSeconds'), 30);
  assert.equal(h.run('state.reviews[0].completedTaskId'), h.run('state.focusTasks[1].id'));
});

test('R3 deleting a finished review segment updates legacy settlement without losing the remaining history', () => {
  const h = harness(); seedReviewSource(h); h.run('startReview(state.reviews[0].id)'); h.advance(60000); h.run('pauseFocus();resumeFocusTask(state.focusTasks[0].id)'); h.advance(30000); h.run('pauseFocus();completeFocusTask(state.focusTasks[0]);delete state.reviews[0].completedTaskId;deleteEvent(state.events[2].id)');
  assert.equal(h.run('state.reviews[0].resultSeconds'), 60); assert.equal(h.run('state.focusTasks[0].totalSeconds'), 60);
  assert.equal(h.run('state.reviews[0].completed'), true); assert.equal(h.run('state.reviews[0].generatedEventId'), h.run('state.events[1].id'));
});

test('R3 active tasks cannot change old segment times or categories until paused', () => {
  const h = harness(); h.run("dom.focusTimerType.value='countdown';startFocus(state.categories[0].id)"); h.advance(60000); h.run('pauseFocus();openEventModal(state.events[0]);resumeFocusTask(state.focusTasks[0].id)'); h.advance(30000);
  const before = h.json('[snapshot(),state.history.length]'); h.nodes.get('eventEndMinute').value = 20; h.click('saveEventBtn');
  assert.deepEqual(h.json('[snapshot(),state.history.length]'), before); assert.match(h.alerts.at(-1), /暂停/);
});

test('R9 event appearance survives real save, drawing, subject bold changes and reload', () => {
  const h = harness(); h.run("state.categories[0].textSize=12;state.categories[0].bold=false;openEventModal(null,{halfZone:'record',startSlot:540,endSlot:600})");
  for (const [id,value] of Object.entries({eventName:'例',eventTextSize:24,eventTextOpacity:.37,eventColor:'#123456',eventOpacity:.42})) h.nodes.get(id).value=value;
  h.click('saveEventBtn');
  assert.deepEqual(h.json('[state.events[0].textSize,state.events[0].textOpacity,state.events[0].color,state.events[0].opacity]'), [24,.37,'#123456',.42]);
  h.drawCalls.length=0;h.run('renderTimeline()');
  let glyph=h.drawCalls.find(call=>call.text==='例');assert.match(glyph.font,/400 24px/);assert.equal(glyph.globalAlpha,.37);
  h.run('state.categories[0].bold=true;saveBackup()');h.drawCalls.length=0;h.run('renderTimeline()');
  glyph=h.drawCalls.find(call=>call.text==='例');assert.match(glyph.font,/700 24px/);
  const restored=harness(h.storage);saveEditedEvent(restored,'state.events[0]',{eventName:'改'});
  assert.deepEqual(restored.json('[state.events[0].textSize,state.events[0].textOpacity]'),[24,.37]);
});

test('R10 install metadata no longer advertises removed flashcards', () => {
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
  assert.doesNotMatch(manifest.description,/闪卡|flashcard/i);assert.match(manifest.description,/暂停接续/);
});

test('compact view and countdown font settings persist and can be restored', () => {
  const h=harness();h.run("state.settings.startHour=3;state.settings.hourHeight=64;state.settings.hiddenHours='0-3';applyCompactTimelinePreset()");
  const restored=harness(h.storage);assert.equal(restored.run('state.settings.compactTimeline'),true);restored.run('applyCompactTimelinePreset()');
  assert.deepEqual(restored.json('[state.settings.startHour,state.settings.hourHeight,state.settings.hiddenHours]'),[3,64,'0-3']);
  restored.nodes.get('settingCountdownSize').value=48;restored.nodes.get('settingCountdownSize').emit('change');
  assert.equal(restored.nodes.get('immersionCountdown').style['--countdown-size'],'48px');
  const again=harness(restored.storage);again.run('startFocus(state.categories[0].id)');
  assert.equal(again.nodes.get('immersionCountdown').style['--countdown-size'],'48px');
});

test('source save is rejected if its review started after the editor was opened', () => {
  const h=harness();seedReviewSource(h);h.run('openEventModal(state.events[0]);startReview(state.reviews[0].id)');h.advance(10000);
  const before=h.json('[snapshot(),state.history.length]');h.nodes.get('eventTaskType').value='review';h.click('saveEventBtn');
  assert.deepEqual(h.json('[snapshot(),state.history.length]'),before);assert.match(h.alerts.at(-1),/暂停/);
});

test('reloading configuration applies the new font when immersion opens', () => {
  const h=harness();h.run('saveBackup()');const saved=JSON.parse(h.storage.get('learning_tool_backup'));
  saved.settings.countdownSize=48;h.storage.set('learning_tool_backup',JSON.stringify(saved));
  h.run('reloadConfiguration();startFocus(state.categories[0].id)');
  assert.equal(h.nodes.get('immersionCountdown').style['--countdown-size'],'48px');
});

test('HTML, service worker and cached local assets use one consistent resource version', () => {
  const version=/app\.js\?v=(\d+)/.exec(html)[1];
  const worker=fs.readFileSync(path.join(root,'sw.js'),'utf8');
  const cache=vm.runInNewContext(worker+';({name:CACHE_NAME,assets:APP_SHELL})',{self:{addEventListener(){}}});
  assert.equal(cache.name,`learning-journal-v${version}`);
  assert.ok(html.includes(`styles.css?v=${version}`));assert.ok(source.includes(`./sw.js?v=${version}`));
  for(const asset of cache.assets){assert.ok(fs.existsSync(path.join(root,asset.split('?')[0])));if(/\.(js|css)\?/.test(asset))assert.ok(asset.endsWith(`?v=${version}`));}
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
  assert.ok(fs.existsSync(path.join(root,manifest.start_url)));for(const icon of manifest.icons)assert.ok(fs.existsSync(path.join(root,icon.src)));
});
