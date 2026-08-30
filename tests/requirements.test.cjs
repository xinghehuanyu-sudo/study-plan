const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let harnessSequence = 0;

// Isolated in-memory DOM/storage: these tests never read a user's browser data.
function harness(storage = new Map(), initialTime = '2026-08-27T09:00:00') {
  let now = new Date(initialTime).getTime(), seq = 0;
  const harnessId=++harnessSequence;
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size, 'duplicate HTML ids');
  const drawCalls = [], alerts = [], createdNodes = [], transforms = [], canvasStack = [], intervals = new Map(); let intervalSeq = 0;
  const canvas = new Proxy({ font: '10px sans-serif', globalAlpha: 1,
    measureText: text => ({ width: Array.from(String(text)).length * 7 }),
    fillText(text, x, y) { drawCalls.push({ text: String(text), x, y, font: this.font, globalAlpha: this.globalAlpha, fillStyle: this.fillStyle }); },
    setTransform(...args) { transforms.push(args); },
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
    documentElement: makeNode('root'), body: makeNode('body'), createElement: tag => { const node=makeNode('new');node.tagName=tag.toUpperCase();createdNodes.push(node);return node; } };
  const window = { ...eventTarget(), matchMedia: () => ({ matches: false }), devicePixelRatio: 1, alert: message => alerts.push(message), confirm: () => true };
  nodes.get('focusTaskType').value = 'learn'; nodes.get('focusTimerType').value = 'countup'; nodes.get('focusDuration').value = '25';
  class FakeDate extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const context = vm.createContext({ document, Date: FakeDate, crypto: { randomUUID: () => `${harnessId}-${++seq}` },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    window,
    navigator: {}, location: { protocol: 'http:' }, setInterval: (handler, ms) => { const id = ++intervalSeq; intervals.set(id, { handler, ms }); return id; }, clearInterval: id => intervals.delete(id), setTimeout: () => 1, clearTimeout() {}, console });
  vm.runInContext(source, context, { filename: 'app.js' });
  for (const [id, node] of vm.runInContext('Object.entries(dom)', context)) assert.ok(node, `missing DOM id: ${id}`);
  return { storage, nodes, drawCalls, alerts, createdNodes, transforms, click: id => nodes.get(id).click(), emitWindow: (type,event) => window.emit(type,event), emitDocument: (type,event) => document.emit(type,event), fireInterval: ms => { const timer = [...intervals.values()].find(timer => timer.ms === ms); assert.ok(timer, `missing ${ms}ms timer`); timer.handler(); }, run: code => vm.runInContext(code, context), advance: ms => { now += ms; }, setTime: text => { now = new Date(text).getTime(); }, json: code => JSON.parse(vm.runInContext(`JSON.stringify(${code})`, context)) };
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

test('063 long timeline labels stay on one fixed-height row and expose their full text for tooltip', () => {
  const h=harness();h.run("state.events=[{id:'a',date:currentDateKey(),halfZone:'record',startSlot:600,endSlot:640,eventName:'长'.repeat(100),materialLocation:'资料P1'}]");
  assert.equal(h.run("layoutEventLabel(ctx,state.events[0],createLayout(900,56)).truncated"),true);
  assert.equal(h.run("layoutEventLabel(ctx,state.events[0],createLayout(900,56)).fullText.endsWith('资料P1')"),true);
  assert.match(h.run("layoutEventLabel(ctx,state.events[0],createLayout(900,56)).parts.map(p=>p.text).join('')"),/…$/);
  assert.equal(h.run('createLayout(500,56).rowHeights[10]'),56);
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

test('R5 editing preserves millisecond data while 062 detail display rounds to whole seconds', () => {
  const h = harness(new Map(), '2026-08-27T09:00:05.125');
  h.run('startFocus(state.categories[0].id)'); h.advance(20125); h.run('pauseFocus()');
  const before = h.json('[state.events[0].startSlot,state.events[0].endSlot,state.events[0].focusSeconds]');
  saveEditedEvent(h, 'state.events[0]', { eventName: '短时段更名' });
  assert.deepEqual(h.json('[state.events[0].startSlot,state.events[0].endSlot,state.events[0].focusSeconds]'), before);
  assert.equal(h.run('state.events[0].eventName'), '短时段更名');
  h.run('openEventDetail(state.events[0].id)');
  assert.match(h.nodes.get('eventDetailBody').innerHTML, /09:00:05–09:00:25/);
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

function submitDialog(h, value) { h.nodes.get('inputDialogValue').value=value; h.nodes.get('inputDialogForm').emit('submit'); }

test('browser QA: subject creation uses an inline form, validates blank/duplicate names and supports undo', () => {
  const h=harness();h.run('addCategory()');submitDialog(h,'   ');
  assert.equal(h.run('state.categories.length'),3);assert.match(h.nodes.get('inputDialogError').textContent,/填写/);
  submitDialog(h,'数学');assert.match(h.nodes.get('inputDialogError').textContent,/重复/);
  submitDialog(h,'验收科目');assert.equal(h.run('state.categories.length'),4);assert.equal(h.run('state.inputDialog'),null);
  h.run('undo()');assert.equal(h.run('state.categories.length'),3);h.run('redo()');assert.equal(h.run('state.categories.length'),4);
  assert.doesNotMatch(source,/window\.prompt\(/);
});

test('browser QA: inline second/third-level creation supports cancel and hierarchy paths', () => {
  const h=harness();h.run('addSubjectLevel(state.categories[0].id)');submitDialog(h,'高数');
  h.run('addSubjectLevel(state.categories[0].id,state.categories[0].children[0].id)');submitDialog(h,'偏导');
  assert.ok(h.json('subjectPathOptions()').some(item=>item.label==='数学 / 高数 / 偏导'));
  h.run('addSubjectLevel(state.categories[0].id);closeModal("inputDialogModal")');submitDialog(h,'不应保存');
  assert.equal(h.run('state.categories[0].children.length'),1);
});

test('browser QA: inline rescheduling rejects invalid/earlier dates and shifts only pending batches', () => {
  const h=harness();seedReviewSource(h);h.run('state.reviews[0].completed=true;delayReview(state.reviews[1].id)');
  const before=h.json('state.reviews');submitDialog(h,'2026-02-30');assert.deepEqual(h.json('state.reviews'),before);
  submitDialog(h,'2026-08-29');assert.match(h.nodes.get('inputDialogError').textContent,/提前/);assert.deepEqual(h.json('state.reviews'),before);
  submitDialog(h,'2026-09-01');assert.deepEqual(h.json('state.reviews.map(r=>r.reviewDate)'),['2026-08-28','2026-09-01','2026-09-05','2026-09-12','2026-09-28']);
  h.run('undo()');assert.deepEqual(h.json('state.reviews'),before);
});

test('browser QA: Escape closes the top dialog before the fullscreen review list', () => {
  const h=harness();h.run('dom.reviewCard.classList.add("fullscreen");openModal("reviewDetailModal");openInputDialog({title:"日期",label:"日期",onSubmit(){}})');
  h.emitWindow('keydown',{key:'Escape'});assert.equal(h.run('state.inputDialog'),null);assert.deepEqual(h.json('state.modalStack'),['reviewDetailModal']);
  h.emitWindow('keydown',{key:'Escape'});assert.deepEqual(h.json('state.modalStack'),[]);assert.equal(h.run('dom.reviewCard.classList.contains("fullscreen")'),true);
  const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
  assert.ok(Number(/\.modal \{[^}]*z-index:\s*(\d+)/.exec(css)[1])>Number(/\.review-card\.fullscreen \{[^}]*z-index:\s*(\d+)/.exec(css)[1]));
});

test('browser QA: Tab and Shift+Tab move within the active overlay without reaching background controls', () => {
  const h=harness();h.run(`var first={disabled:false,tabIndex:0,getClientRects:()=>[{}],focus(){document.activeElement=this;}},second={...first};
    dom.immersionOverlay.querySelectorAll=()=>[first,second];dom.immersionOverlay.classList.remove('hidden');document.activeElement=first;`);
  h.emitWindow('keydown',{key:'Tab',shiftKey:false});assert.equal(h.run('document.activeElement===second'),true);
  h.emitWindow('keydown',{key:'Tab',shiftKey:false});assert.equal(h.run('document.activeElement===first'),true);
  h.emitWindow('keydown',{key:'Tab',shiftKey:true});assert.equal(h.run('document.activeElement===second'),true);
});

test('browser QA: monthly cells contain scrolling records and long subject filter labels do not shrink', () => {
  const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
  assert.match(css,/\.calendar-day \{[^}]*display: flex;[^}]*overflow: hidden;/);
  assert.match(css,/\.calendar-day-events \{[^}]*min-height: 0;[^}]*overflow: auto;/);
  assert.match(css,/\.subject-filter \{[^}]*flex: 0 0 auto;[^}]*white-space: nowrap;/);
});

test('browser QA: one leftover entry per task, resolution/restoration propagates and survives another segment', () => {
  const h=harness();h.run("startFocus(state.categories[0].id);state.focus.immersiveFields.leftover='第6页';");h.advance(10000);h.run('pauseFocus();resumeFocusTask(state.focusTasks[0].id)');h.advance(10000);h.run('pauseFocus()');
  assert.equal(h.run('leftoverEntries().length'),1);h.run('toggleLeftover(state.events[1].id)');
  assert.equal(h.run('state.events.every(e=>e.leftoverCompletedAt)'),true);
  const restored=harness(h.storage);restored.run('resumeFocusTask(state.focusTasks[0].id)');restored.advance(10000);restored.run('pauseFocus()');
  assert.equal(restored.run('state.events.every(e=>e.leftoverCompletedAt)'),true);restored.run('toggleLeftover(state.events[2].id,false)');
  assert.equal(restored.run('state.events.some(e=>e.leftoverCompletedAt)'),false);
  restored.run('undo()');assert.equal(restored.run('state.events.every(e=>e.leftoverCompletedAt)'),true);
});

test('browser QA: inherited review leftovers share the source, unrelated same text stays separate', () => {
  const h=harness();seedReviewSource(h);h.run("state.events[0].leftover='第6页';startReview(state.reviews[0].id)");h.advance(10000);h.run('pauseFocus()');
  assert.equal(h.run('leftoverEntries().length'),1);h.run('toggleLeftover(state.events[1].id,true)');assert.equal(h.run('state.reviews.every(r=>r.leftoverResolved)'),true);
  h.run("state.events.push({...state.events[0],id:'unrelated',focusTaskId:null,sourceEventId:null});");assert.equal(h.run('leftoverEntries().length'),2);
});

test('browser QA: changing leftover content reopens the task and completing a handling task resolves its source group', () => {
  const h=harness();h.run("startFocus(state.categories[0].id);state.focus.immersiveFields.leftover='第6页'");h.advance(10000);h.run('pauseFocus();toggleLeftover(state.events[0].id,true)');
  saveEditedEvent(h,'state.events[0]',{eventLeftover:'第7页'});assert.equal(h.run('Boolean(state.events[0].leftoverCompletedAt||state.focusTasks[0].leftoverCompletedAt)'),false);
  h.run('completeFocusTask(state.focusTasks[0]);startLeftoverEvent(state.events[0].id)');h.advance(10000);h.run('pauseFocus();completeFocusTask(state.focusTasks[1])');
  assert.equal(h.run('leftoverEntries().length'),1);assert.equal(h.run('state.events.every(e=>e.leftoverCompletedAt)'),true);
});

test('browser QA: daily report exposes a preview and a named PNG download instead of silent export', () => {
  const h=harness();h.run('exportImage()');
  assert.equal(h.run('state.modalStack.at(-1)'), 'reportModal');
  assert.match(h.nodes.get('dailyReportPreview').src,/^data:image\/png/);
  assert.equal(h.nodes.get('dailyReportDownload').href,h.nodes.get('dailyReportPreview').src);
  assert.equal(h.nodes.get('dailyReportDownload').download,'学习日报_2026-08-27.png');
});

test('049 layout selector applies, persists, restores and resets three columns', () => {
  const h=harness();h.nodes.get('layoutMode').value='columns';h.nodes.get('layoutMode').emit('change');
  assert.equal(h.run('dom.mainLayout.classList.contains("three-columns")'),true);
  const fresh=harness(h.storage);assert.equal(fresh.nodes.get('layoutMode').value,'columns');
  fresh.run('resetLayout()');assert.equal(fresh.run('dom.mainLayout.classList.contains("three-columns")'),false);
  assert.doesNotMatch(html,/>FOCUS<|>REVIEW<|每日复习清单/);
});

test('050 swapped immersion survives reload without changing saved note fields', () => {
  const h=harness();h.run("startFocus(state.categories[0].id);state.focus.immersiveFields.notes='保留笔记';");h.click('immersionSwapBtn');
  assert.equal(h.run('dom.immersionContent.classList.contains("swapped")'),true);
  const fresh=harness(h.storage);fresh.run('enterImmersion()');assert.equal(fresh.run('dom.immersionContent.classList.contains("swapped")'),true);
  assert.equal(fresh.run('state.focus.immersiveFields.notes'),'保留笔记');
  fresh.advance(60000);fresh.run('renderFocus()');assert.match(fresh.nodes.get('immersionTotal').textContent,/00:01:00/);
});

test('051 video defaults only for a fresh learning task, existing action and review semantics survive', () => {
  const h=harness();h.run('startFocus(state.categories[0].id)');assert.equal(h.nodes.get('immersionActionType').value,'video');
  h.nodes.get('immersionActionType').value='practice';h.nodes.get('immersionActionType').emit('change');h.advance(10000);h.run('pauseFocus();resumeFocusTask(state.focusTasks[0].id)');
  assert.equal(h.nodes.get('immersionActionType').value,'practice');
  const fresh=harness(h.storage);assert.equal(fresh.run('state.focus.immersiveFields.actionType'),'practice');
  assert.deepEqual([...html.match(/id="immersionActionType">([\s\S]*?)<\/select>/)[1].matchAll(/value="([^"]+)"/g)].map(m=>m[1]),['video','practice','memorize','reading','review']);
  const review=harness();review.run("dom.focusTaskType.value='review';startFocus(state.categories[0].id)");assert.equal(review.nodes.get('immersionActionType').value,'review');
});

test('052 PiP requests compact size, renders exactly three rows and its pause saves the task', async () => {
  const h=harness();h.run(`var pipNodes=new Map(['pipClock','pipSubject','pipBack','pipPause','pipStop'].map(id=>[id,{}]));
    var pip={closed:false,document:{head:{},body:{},getElementById:id=>pipNodes.get(id)},close(){this.closed=true;},focus(){},addEventListener(){}};
    window.documentPictureInPicture={requestWindow:async options=>{window.requestedPip=options;return pip;}};
    startFocus(state.categories[0].id);state.focus.categoryName='数学 / 高数 / 积分';`);
  await h.run('openFocusPictureInPicture()');
  assert.deepEqual(h.json('window.requestedPip'),{width:200,height:150,disallowReturnToOpener:true,preferInitialWindowPlacement:true});
  assert.equal(h.run("pipNodes.get('pipSubject').textContent"),'数学 / 高数');
  assert.doesNotMatch(h.run('pip.document.body.innerHTML'),/pipMode/);
  assert.equal((h.run('pip.document.body.innerHTML').match(/title=/g)||[]).length,3);
  h.advance(20000);h.run("pipNodes.get('pipPause').onclick()");assert.equal(h.run('pip.closed'),true);assert.equal(h.run('state.focusTasks[0].totalSeconds'),20);
});

test('052 unsupported or rejected PiP leaves the active timer usable', async () => {
  const h=harness();h.run('startFocus(state.categories[0].id)');assert.equal(h.nodes.get('immersionPipBtn').hidden,true);
  h.run("window.documentPictureInPicture={requestWindow:async()=>{throw Error('unavailable');}}");await h.run('openFocusPictureInPicture()');
  assert.ok(h.run('state.focus'));assert.match(h.alerts.at(-1),/小窗打开失败/);assert.equal(h.run('dom.immersionOverlay.classList.contains("hidden")'),false);
});

test('053 month headings omit zero durations, use ten heat levels and keep task text readable', () => {
  const h=harness();assert.deepEqual(h.json('[0,1,3599,3600,7200,32400,35999,36000,72000].map(calendarHeatLevel)'),[0,1,1,1,2,9,9,10,10]);
  assert.equal(h.run('new Set(Array.from({length:10},(_,i)=>calendarHeatColor((i+1)*3600))).size'),10);
  h.run("state.events=[{id:'month',date:currentDateKey(),halfZone:'record',focusSeconds:36000,eventName:'深色任务',categoryId:state.categories[0].id}];renderCalendar()");
  const markup=h.nodes.get('monthCalendar').innerHTML;assert.match(markup,/calendar-day-heading[\s\S]*data-heat-level="10"/);assert.equal((markup.match(/calendar-day-duration/g)||[]).length,1);
  assert.match(fs.readFileSync(path.join(root,'styles.css'),'utf8'),/\.calendar-event, \.calendar-event-label \{ color: #333;/);
});

test('054 stacked focus expands intrinsically and paused tasks are not truncated from markup', () => {
  const h=harness();for(let i=0;i<5;i++){h.run('startFocus(state.categories[0].id)');h.advance(10000);h.run('pauseFocus()');}
  assert.equal((h.nodes.get('unfinishedTaskList').innerHTML.match(/data-task-resume=/g)||[]).length,5);
  const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');assert.match(css,/grid-template-rows: max-content 4px minmax\(160px, 1fr\)/);assert.match(css,/grid-template-rows: max-content minmax\(130px,1fr\)/);
});

test('055 statistics always open on today and selected range drives totals', () => {
  const h=harness();h.run("state.events=[{id:'now',date:dateKey(new Date()),halfZone:'record',categoryId:state.categories[0].id,focusSeconds:3600},{id:'old',date:'2026-08-26',halfZone:'record',categoryId:state.categories[0].id,focusSeconds:7200}];dom.statsRange.value='month';openStats()");
  assert.equal(h.nodes.get('statsRange').value,'day');assert.equal(h.nodes.get('statTotalTime').textContent,'1h 0m');
  h.nodes.get('statsRange').value='month';h.nodes.get('statsRange').emit('change');assert.equal(h.nodes.get('statTotalTime').textContent,'3h 0m');
  h.run('closeModal("statsModal");openStats()');assert.equal(h.nodes.get('statsRange').value,'day');
});

test('055 learning/review totals, percentages and tooltip agree and exclude plans', () => {
  const h=harness();h.run("state.events=[{id:'learn',date:dateKey(new Date()),halfZone:'record',taskType:'learn',categoryId:state.categories[0].id,focusSeconds:2700},{id:'review',date:dateKey(new Date()),halfZone:'record',taskType:'review',categoryId:state.categories[0].id,focusSeconds:900},{id:'plan',date:dateKey(new Date()),halfZone:'plan',taskType:'learn',categoryId:state.categories[0].id,focusSeconds:7200}];openStats()");
  assert.deepEqual(h.json('learningReviewTotals(focusEvents())'),{learn:2700,review:900});
  assert.match(h.nodes.get('statTodaySplit').innerHTML,/学习 <b>45m<\/b> · 75%/);assert.match(h.nodes.get('statTodaySplit').innerHTML,/复习 <b>15m<\/b> · 25%/);
  assert.match(h.nodes.get('distributionDetails').innerHTML,/学习 45m，复习 15m/);assert.match(h.nodes.get('distributionDetails').innerHTML,/distribution-review/);
  h.run("state.events=[];renderStats()");assert.doesNotMatch(h.nodes.get('statTodaySplit').innerHTML,/NaN|Infinity/);assert.equal((h.nodes.get('statTodaySplit').innerHTML.match(/0%/g)||[]).length,2);
});

test('055 each monthly/day chart point is labelled with an actual duration, including zero', () => {
  const h=harness();h.drawCalls.length=0;h.run("drawMonthlyChart([{date:'2026-08-27',focusSeconds:5400}])");
  assert.equal(h.drawCalls.filter(call=>call.text==='1h 30m').length,1);assert.equal(h.drawCalls.filter(call=>call.text==='0m').length,30);
  h.drawCalls.length=0;h.run("drawYearlyChart([{date:'2026-08-27',focusSeconds:7200}])");assert.equal(h.drawCalls.filter(call=>call.text==='2h 0m').length,1);assert.equal(h.drawCalls.filter(call=>call.text==='0m').length,11);
  assert.ok(parseInt(h.nodes.get('monthlyChart').style.minWidth)>1000);
});

function seedStatsHierarchy(h){h.run("state.categories=[{id:'root',name:'数学',color:'#336644',children:[{id:'a',name:'高数',children:[{id:'a1',name:'积分'}]},{id:'b',name:'线代'}]},{id:'other',name:'英语',children:[]}];state.statsSubjects=new Set();");}
test('056 selecting and clearing a root cascades to every descendant while retaining other roots', () => {
  const h=harness();seedStatsHierarchy(h);h.run("setStatsSubjectSelected('root',true);setStatsSubjectSelected('other',true)");assert.deepEqual(h.json('[...state.statsSubjects].sort()'),['a','a1','b','other','root']);
  h.run("setStatsSubjectSelected('root',false)");assert.deepEqual(h.json('[...state.statsSubjects]'),['other']);
});

test('056 deselecting a child makes ancestors partial without matching the excluded child via root', () => {
  const h=harness();seedStatsHierarchy(h);h.run("setStatsSubjectSelected('root',true);setStatsSubjectSelected('a1',false)");
  assert.deepEqual(h.json('[...state.statsSubjects]'),['b']);assert.deepEqual(h.json('statsSubjectSelection(state.categories[0])'),{checked:false,partial:true});
  h.run("state.events=[{date:dateKey(new Date()),halfZone:'record',categoryId:'root',subjectPath:['root','a','a1'],focusSeconds:7200},{date:dateKey(new Date()),halfZone:'record',categoryId:'root',subjectPath:['root','b'],focusSeconds:600}];dom.statsRange.value='day';renderStats()");
  assert.equal(h.nodes.get('statTotalTime').textContent,'10m');h.run("setStatsSubjectSelected('a1',true)");assert.equal(h.run('statsSubjectSelection(state.categories[0]).checked'),true);
});

test('056 hierarchy expansion does not alter selection and children are nested under their parent', () => {
  const h=harness();seedStatsHierarchy(h);h.run("setStatsSubjectSelected('root',true);renderStatsFilters()");assert.match(h.nodes.get('statsSubjectFilters').innerHTML,/stats-subject-children hidden/);
  const selection=h.json('[...state.statsSubjects]');h.run("state.statsExpanded.add('root');renderStatsFilters()");assert.deepEqual(h.json('[...state.statsSubjects]'),selection);assert.match(h.nodes.get('statsSubjectFilters').innerHTML,/data-stats-expand="root" aria-expanded="true"/);
});

test('057 report doubles pixel dimensions and draws fully opaque dark text without altering timeline appearance', () => {
  const h=harness();h.run("state.events=[{id:'text',date:currentDateKey(),halfZone:'record',startSlot:600,endSlot:630,eventName:'清晰文字',textOpacity:.1}]");h.drawCalls.length=0;h.transforms.length=0;h.run('exportImage()');
  const output=h.createdNodes.find(node=>node.tagName==='CANVAS');assert.equal(output.width,2800);assert.equal(output.height,h.run('(createLayout(1400,54,360).height+24)*2'));
  assert.deepEqual(h.transforms[0],[2,0,0,2,0,0]);const glyphs=h.drawCalls.filter(call=>['清','晰','文','字'].includes(call.text));assert.equal(glyphs.map(call=>call.text).join(''),'清晰文字');assert.ok(glyphs.every(call=>call.globalAlpha===1&&call.fillStyle==='#333'));
  assert.equal(h.run('state.events[0].textOpacity'),.1);
});

test('058 review groups retain collapse state across filter changes and escape subject text', () => {
  const h=harness();seedReviewSource(h);h.run("state.categories[0].name='<数学>';state.reviews[0].reviewDate=currentDateKey();state.reviewGroupOpen.set(state.categories[0].id,false);renderReviews()");
  const markup=h.nodes.get('reviewList').innerHTML;assert.match(markup,/&lt;数学&gt;/);assert.doesNotMatch(markup.split('</details>')[0],/<details[^>]*\sopen/);
  h.run("setReviewFilter('all');setReviewFilter('today')");assert.doesNotMatch(h.nodes.get('reviewList').innerHTML.split('</details>')[0],/<details[^>]*\sopen/);
});

test('059 today completed group uses completion date, is last/default collapsed, and restore returns to pending', () => {
  const h=harness();seedReviewSource(h);h.run("state.reviews[0].reviewDate='2026-09-01';toggleReview(state.reviews[0].id);renderReviews()");
  const markup=h.nodes.get('reviewList').innerHTML;assert.match(markup,/data-review-group="completed:2026-08-27"/);assert.doesNotMatch(markup,/<details[^>]*\sopen/);assert.match(markup,/review-item done/);assert.match(markup,/>恢复<\/button>/);
  h.run('toggleReview(state.reviews[0].id)');assert.equal(h.run('state.reviews[0].completed'),false);assert.equal(h.run('state.reviews[0].reviewDate'), '2026-08-27');
  assert.equal(h.run('filteredReviews().length'),1);assert.match(h.nodes.get('reviewList').innerHTML,/data-review-group="completed:2026-08-27"[^>]*>[\s\S]*0 项/);
});

test('059 historical completion stays out of today and a counted review is not duplicated', () => {
  const h=harness();seedReviewSource(h);h.run("state.reviews[0].completed=true;state.reviews[0].completedAt='2026-08-26T10:00:00';state.reviews[0].reviewDate=currentDateKey();renderReviews()");assert.equal(h.run('filteredReviews().length'),0);
  h.run("state.reviews[0].completedAt='2026-08-27T10:00:00';renderReviews()");assert.equal((h.nodes.get('reviewList').innerHTML.match(/data-review-complete=/g)||[]).length,1);
});

test('recheck: manual pause and stop after countdown expiry cap the final segment at its deadline', () => {
  for(const action of ['pauseFocus()', 'finishFocus(false)']){
    const h=harness(new Map(),'2026-08-27T23:59:30');h.run("dom.focusTimerType.value='countdown';dom.focusDuration.value='1';startFocus(state.categories[0].id)");h.advance(10000);h.run('pauseFocus()');h.advance(600000);h.run('resumeFocusTask(state.focusTasks[0].id)');h.advance(300000);h.run(action);
    assert.equal(h.run('state.focusTasks[0].totalSeconds'),60);assert.equal(h.run('state.events.reduce((sum,e)=>sum+e.focusSeconds,0)'),60);assert.equal(h.run('state.events.at(-1).focusSeconds'),50);
  }
});

test('recheck: unchanged paused-task controls survive timer ticks instead of losing DOM focus', () => {
  const h=harness();h.run('startFocus(state.categories[0].id)');h.advance(1000);h.run('pauseFocus();startFocus(state.categories[1].id)');
  let writes=0;const list=h.nodes.get('unfinishedTaskList'),descriptor=Object.getOwnPropertyDescriptor(list,'innerHTML');Object.defineProperty(list,'innerHTML',{get:descriptor.get,set(value){writes++;descriptor.set.call(this,value);}});
  h.advance(1000);h.run('tickFocus();tickFocus()');assert.equal(writes,0);
  h.run("state.focusTasks[0].fields.eventName='更新标题';renderUnfinishedTasks()");assert.equal(writes,1);assert.match(list.innerHTML,/更新标题/);
});

test('recheck: a late PiP response cannot attach to a paused or replaced focus session', async () => {
  const h=harness();h.run("var resolvePip;var latePip={closed:false,close(){this.closed=true;}};window.documentPictureInPicture={requestWindow:()=>new Promise(resolve=>resolvePip=resolve)};startFocus(state.categories[0].id)");
  const pending=h.run('openFocusPictureInPicture()');h.run('pauseFocus();startFocus(state.categories[1].id);resolvePip(latePip)');await pending;
  assert.equal(h.run('latePip.closed'),true);assert.equal(h.run('state.pipWindow'),null);assert.ok(h.run('state.focus'));assert.equal(h.run('dom.immersionOverlay.classList.contains("hidden")'),false);
});

test('recheck: clear events closes an already-open focus window', () => {
  const h=harness();h.run("startFocus(state.categories[0].id);pauseFocus();startFocus(state.categories[1].id);var oldPip={closed:false,close(){this.closed=true;}};state.pipWindow=oldPip;clearEvents()");assert.equal(h.run('oldPip.closed'),true);assert.equal(h.run('state.pipWindow'),null);
});

test('recheck: chart backing dimensions refresh when a visible statistics dialog is resized', () => {
  const h=harness();h.run('openStats()');h.nodes.get('distributionChart').getBoundingClientRect=()=>({width:520,height:220});h.emitWindow('resize');assert.equal(h.nodes.get('distributionChart').width,520);
  h.nodes.get('distributionChart').getBoundingClientRect=()=>({width:280,height:220});h.emitWindow('resize');assert.equal(h.nodes.get('distributionChart').width,280);
});

test('recheck: three-column resizing changes its column width without corrupting stacked preference', () => {
  const h=harness();h.run("state.settings.layoutMode='columns';state.layoutEditing=true;window.matchMedia=()=>({matches:true});dom.focusCard.getBoundingClientRect=()=>({width:300});var side={getBoundingClientRect:()=>({top:0})};document.querySelector=selector=>selector==='.side-panel'?side:null;beginLayoutResize({preventDefault(){},currentTarget:dom.sideResizeHandle,clientX:500},'side')");
  h.emitWindow('pointermove',{clientX:450,clientY:100});h.emitWindow('pointerup');assert.equal(h.run('state.settings.focusColumnWidth'),350);assert.equal(h.run('state.settings.sideWidth'),330);assert.equal(harness(h.storage).run('state.settings.focusColumnWidth'),350);
});

test('recheck: deleted-subject history stays in default statistics and can be filtered explicitly', () => {
  const h=harness();h.run("state.events=[{id:'deleted',categoryId:'gone',categoryName:'旧学科',subjectPath:['gone','old-child'],date:dateKey(new Date()),halfZone:'record',focusSeconds:3600},{id:'known',categoryId:state.categories[0].id,date:dateKey(new Date()),halfZone:'record',focusSeconds:1800}];openStats()");
  assert.equal(h.nodes.get('statTotalTime').textContent,'1h 30m');assert.match(h.nodes.get('statsSubjectFilters').innerHTML,/未分类 \/ 已删除学科/);
  h.run('setStatsSubjectSelected(ORPHAN_STATS_ID,false);renderStats()');assert.equal(h.nodes.get('statTotalTime').textContent,'30m');assert.equal(h.run('state.events.length'),2);
});

test('060 merges independent learning events into one completed task and regenerates one review schedule', () => {
  const h=harness();h.run(`state.events=[
    {id:'later',date:'2026-08-29',halfZone:'record',taskType:'learn',categoryId:state.categories[0].id,categoryName:'数学',subjectPath:[state.categories[0].id],eventName:'第二段',materialLocation:'P11-P20',textContent:'摘要二',notes:'笔记二',actionTypes:['reading'],startSlot:600,endSlot:620},
    {id:'first',date:'2026-08-28',halfZone:'record',taskType:'learn',categoryId:state.categories[0].id,categoryName:'数学',subjectPath:[state.categories[0].id],eventName:'第一段',materialLocation:'P1-P10',textContent:'摘要一',notes:'笔记一',actionTypes:['video','practice'],startSlot:540,endSlot:570}
  ];generateReviews(state.events[0]);generateReviews(state.events[1]);state.mergeSelection=new Set(['later','first']);mergeSelectedEvents('统一章节')`);
  assert.equal(h.run('state.focusTasks.length'),1);assert.equal(h.run('state.focusTasks[0].status'),'completed');assert.equal(h.run('state.focusTasks[0].totalSeconds'),3000);
  assert.equal(h.run("state.events.every(event=>event.focusTaskId===state.focusTasks[0].id&&event.eventName==='统一章节')"),true);
  assert.equal(h.run("state.events[0].materialLocation"),'P1-P10；P11-P20');assert.equal(h.run('state.reviews.length'),5);
  assert.deepEqual(h.json('state.events[0].actionTypes'),['video','practice','reading']);
  assert.equal(h.run('new Set(state.reviews.map(review=>review.sourceEventId)).size'),1);assert.equal(h.run('state.reviews[0].sourceEventId'),'first');assert.equal(h.run('state.reviews[0].reviewDate'),'2026-08-30');
  h.run('undo()');assert.equal(h.run('state.focusTasks.length'),0);assert.equal(h.run('state.reviews.length'),10);assert.deepEqual(h.json("state.events.find(event=>event.id==='first').actionTypes"),['video','practice']);assert.equal(h.run('state.mergeMode'),false);assert.equal(h.run('state.mergeSelection.size'),0);
  h.run('redo()');assert.equal(h.run('state.focusTasks.length'),1);assert.equal(h.run('state.reviews.length'),5);assert.deepEqual(h.json('state.events[0].actionTypes'),['video','practice','reading']);
});

test('060 refuses a partial merge of an existing multi-segment task', () => {
  const h=harness();h.run("startFocus(state.categories[0].id)");h.advance(60000);h.run('pauseFocus();resumeFocusTask(state.focusTasks[0].id)');h.advance(60000);h.run("pauseFocus();state.events.push({id:'manual',date:currentDateKey(),halfZone:'record',taskType:'learn',categoryId:state.categories[0].id,categoryName:'数学',subjectPath:[state.categories[0].id],eventName:'独立',startSlot:700,endSlot:710});state.mergeSelection=new Set([state.events[0].id,'manual'])");
  assert.equal(h.run("mergeSelectedEvents('不应合并')"),false);assert.equal(h.run('state.focusTasks.length'),1);assert.equal(h.run('state.events[0].focusTaskId===state.events[1].focusTaskId'),true);assert.match(h.alerts.at(-1),/全部时段/);
});

test('061 completed event can return to unfinished without losing content and can complete again', () => {
  const h=harness();h.run("state.events=[{id:'source',date:currentDateKey(),halfZone:'record',taskType:'learn',categoryId:state.categories[0].id,categoryName:'数学',subjectPath:[state.categories[0].id],eventName:'误完成章节',materialLocation:'P3',textContent:'保留摘要',notes:'保留笔记',leftover:'保留遗留',actionTypes:['video','practice'],startSlot:480,endSlot:510}];generateReviews(state.events[0]);reopenCompletedEvent('source')");
  assert.equal(h.run('state.reviews.length'),0);assert.equal(h.run('state.focusTasks[0].status'),'paused');assert.equal(h.run("state.events[0].eventName+'|'+state.events[0].materialLocation+'|'+state.events[0].textContent+'|'+state.events[0].notes+'|'+state.events[0].leftover"),'误完成章节|P3|保留摘要|保留笔记|保留遗留');
  assert.deepEqual(h.json('state.events[0].actionTypes'),['video','practice']);h.run('resumeFocusTask(state.focusTasks[0].id)');h.advance(1000);h.run('pauseFocus()');assert.deepEqual(h.json('state.events[0].actionTypes'),['video','practice']);
  h.run('completeFocusTask(state.focusTasks[0])');assert.equal(h.run('state.focusTasks[0].status'),'completed');assert.equal(h.run('state.reviews.length'),5);
});

test('061 manual learning records without review schedules still expose completion rollback', () => {
  const h=harness();h.run("state.categories[0].reviewEnabled=false;state.events=[{id:'manual',date:currentDateKey(),halfZone:'record',taskType:'learn',categoryId:state.categories[0].id,categoryName:'数学',subjectPath:[state.categories[0].id],eventName:'无复习事件',startSlot:480,endSlot:490}];openEventDetail('manual')");
  assert.equal(h.nodes.get('eventDetailReopenBtn').classList.contains('hidden'),false);assert.equal(h.run("reopenCompletedEvent('manual')"),true);assert.equal(h.run('state.focusTasks[0].status'),'paused');assert.equal(h.run('state.reviews.length'),0);
});

test('062 event detail has one identity block, ordered fields, total duration and whole-second times', () => {
  const h=harness();h.run("state.events=[{id:'detail',date:currentDateKey(),halfZone:'record',taskType:'learn',categoryId:state.categories[0].id,categoryName:'数学',subjectPath:[state.categories[0].id],eventName:'唯一标题',materialLocation:'唯一资料',textContent:'摘要',notes:'笔记',leftover:'遗留',mastery:'partial',startSlot:480.01,endSlot:510.02}];generateReviews(state.events[0]);openEventDetail('detail')");const detail=h.nodes.get('eventDetailBody').innerHTML;
  assert.equal((detail.match(/唯一标题/g)||[]).length,1);assert.equal((detail.match(/唯一资料/g)||[]).length,1);
  assert.ok(detail.indexOf('唯一标题')<detail.indexOf('学习摘要与掌握程度'));assert.ok(detail.indexOf('学习摘要与掌握程度')<detail.indexOf('学习笔记'));assert.ok(detail.indexOf('学习笔记')<detail.indexOf('遗留内容'));assert.ok(detail.indexOf('遗留内容')<detail.indexOf('总时长'));assert.ok(detail.indexOf('总时长')<detail.indexOf('复习排期'));
  assert.match(detail,/08:00:01–08:30:01/);assert.match(detail,/总时长 00:30:01/);assert.doesNotMatch(detail,/08:00:00\.6|08:30:01\.2/);
});

test('062 subsecond durations round to the nearest displayed second', () => {
  const h=harness();h.run("state.events=[{id:'tiny',date:currentDateKey(),halfZone:'record',taskType:'learn',categoryId:state.categories[0].id,categoryName:'数学',subjectPath:[state.categories[0].id],eventName:'极短记录',startSlot:480,endSlot:480.01,focusSeconds:.6}];openEventDetail('tiny')");
  assert.match(h.nodes.get('eventDetailBody').innerHTML,/总时长 00:00:01/);assert.match(h.nodes.get('eventDetailBody').innerHTML,/· 00:00:01/);
});

test('064 context menu flips above near the viewport bottom and clamps its right edge', () => {
  const h=harness();h.nodes.get('contextMenu').getBoundingClientRect=()=>({width:145,height:140});
  assert.deepEqual(h.json("(()=>{window.innerWidth=500;window.innerHeight=600;return positionContextMenu(480,590)})()"),{left:347,top:442});
  assert.deepEqual(h.json('positionContextMenu(20,20)'),{left:20,top:28});
});

test('recheck: Escape, restore and render clear stale merge selections', () => {
  const h=harness();h.run("state.events=[{id:'a',date:currentDateKey(),halfZone:'record',taskType:'learn',categoryId:state.categories[0].id,startSlot:0,endSlot:1}];state.mergeMode=true;state.mergeSelection=new Set(['a','missing']);renderMergeBar()");assert.equal(h.run('state.mergeSelection.size'),1);
  h.emitWindow('keydown',{key:'Escape'});assert.equal(h.run('state.mergeMode'),false);assert.equal(h.run('state.mergeSelection.size'),0);
  h.run("pushHistory();state.events=[];state.mergeMode=true;state.mergeSelection=new Set(['a']);undo()");assert.equal(h.run('state.mergeMode'),false);assert.equal(h.run('state.mergeSelection.size'),0);assert.equal(h.run('state.events.length'),1);
});

test('recheck: tooltip placement uses its measured size and stays in a small viewport', () => {
  const h=harness();h.nodes.get('timelineTooltip').getBoundingClientRect=()=>({width:200,height:100});
  assert.deepEqual(h.json("(()=>{window.innerWidth=300;window.innerHeight=200;return showTimelineTooltip(290,190,'完整内容')})()"),{left:92,top:78});
  assert.match(fs.readFileSync(path.join(root,'styles.css'),'utf8'),/\.context-menu \{[^}]*max-height: calc\(100vh - 16px\);[^}]*overflow-y: auto/);
});

function serviceWorkerHarness(){
  const listeners={},removed=[],writes=[],stored=new Map(),background=[];
  const shell={kind:'shell'},error={kind:'network-error'};stored.set('./index.html',shell);
  const cache={match:async request=>stored.get(typeof request==='string'?request:request.url),put:async(request,response)=>writes.push([request,response]),addAll:async()=>{}};
  const context=vm.createContext({URL,Response:{error:()=>error},self:{location:{origin:'http://localhost',href:'http://localhost/sw.js'},addEventListener:(name,handler)=>listeners[name]=handler,clients:{claim(){}},skipWaiting(){}},caches:{keys:async()=>['other-app-cache','learning-journal-v1',vm.runInContext('CACHE_NAME',context)],delete:async key=>removed.push(key),open:async()=>cache},fetch:async()=>{throw Error('offline');}});
  vm.runInContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),context);
  return{listeners,removed,writes,stored,shell,error,context,background,async fetch(path,mode='cors'){let result;listeners.fetch({request:{url:'http://localhost/'+path,method:'GET',mode},respondWith:value=>result=value,waitUntil:value=>background.push(value)});const response=await result;await Promise.all(background);return response;}};
}

test('recheck: service worker activation only retires learning-journal caches', async () => {
  const h=serviceWorkerHarness();let complete;h.listeners.activate({waitUntil:value=>complete=value});await complete;assert.deepEqual(h.removed,['learning-journal-v1']);
});

test('recheck: offline navigation gets the app shell but a missing script does not get HTML', async () => {
  const h=serviceWorkerHarness();assert.equal(await h.fetch('missing.js'),h.error);assert.equal(await h.fetch('','navigate'),h.shell);
});

test('recheck: HTTP errors cannot poison the offline cache and successful shell updates are awaited', async () => {
  const h=serviceWorkerHarness();vm.runInContext("fetch=async()=>({ok:false,clone(){return this;}})",h.context);await h.fetch('index.html');assert.equal(h.writes.length,0);
  vm.runInContext("fetch=async()=>({ok:true,clone(){return this;}})",h.context);await h.fetch('index.html');assert.equal(h.writes.length,1);assert.equal(h.background.length,1);
});

test('recheck: concurrent PiP opens request one window and setup failures release it', async () => {
  const h=harness();h.run("var requests=0,resolvePip;window.documentPictureInPicture={requestWindow:()=>{requests++;return new Promise(resolve=>resolvePip=resolve)}};startFocus(state.categories[0].id)");const pending=h.run('openFocusPictureInPicture()');await h.run('openFocusPictureInPicture()');assert.equal(h.run('requests'),1);
  h.run('var badPip={closed:false,close(){this.closed=true;}};resolvePip(badPip)');await pending;assert.equal(h.run('badPip.closed'),true);assert.equal(h.run('state.pipWindow'),null);assert.equal(h.run('state.pipRequest'),null);assert.ok(h.run('state.focus'));
});
