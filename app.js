const STORAGE_KEY = 'learning_tool_backup';
const DATA_VERSION = 8;
const ACTION_TYPE_LABELS = { video: '视频', reading: '阅读', practice: '习题', memorize: '背诵', review: '复习' };
const MASTERY_LABELS = { unknown: '尚未判断', weak: '薄弱', partial: '部分掌握', mastered: '已掌握' };
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const QUOTES = [
  '今天专注的一小时，会成为明天从容的一部分。',
  '把注意力放回此刻，答案会在行动中出现。',
  '不必一次走很远，只要这一段路走得认真。',
  '稳定地完成，比偶尔的完美更有力量。',
  '保持耐心，复杂的知识也会慢慢长出脉络。'
];

function uid(prefix) {
  const value = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${value}`;
}

function newSubject(name, color) {
  return {
    id: uid('subject'), name, color, opacity: .86, createdAt: new Date().toISOString(),
    textSize: 13, textOpacity: .92, bold: false, italic: false, reviewEnabled: true, children: []
  };
}

const defaultCategories = [
  newSubject('数学', '#d86b4b'),
  newSubject('英语', '#4f8a6e'),
  newSubject('专业课', '#5578b8')
];

const defaultSettings = {
  startHour: 0, hourHeight: 56, minuteInterval: 5, hiddenHours: '',
  reviewColor: '#8a62ad', reviewOpacity: .84, reviewPreset: 'common', reviewIntervals: [1, 3, 7, 14, 30],
  planRatio: .5, defaultSelectionZone: 'record', showDots: true, dotSize: 1.7, dotOpacity: .2,
  eventPlacement: 'bottom', dividerDrag: true, defaultPlanColor: '#d09a55', defaultRecordColor: '#4f8aa8',
  defaultEventOpacity: .86, defaultTextSize: 13, defaultTextColor: '#20231f', defaultTextOpacity: .92,
  shortcut: 'Ctrl+Enter', sideWidth: 330, focusHeight: 285,
  immersionTheme: 'plain', immersionOpacity: .72, showCountdown: false, countdownName: '距离考试',
  countdownDate: '', showQuote: true
  , arrowWidth: 1.75, arrowSize: 6, compactToolbar: false,
  countdownSize: 30, countdownPosition: 'below', immersionBackground: '',
  soundEnabled: true, soundType: 'cheer', soundDuration: 1.5, soundVolume: .65, notificationsEnabled: false
};

const state = {
  currentDate: startOfDay(new Date()), settings: clone(defaultSettings), categories: clone(defaultCategories),
  events: [], reviews: [], reviewFilter: 'today', history: [], future: [],
  editingEventId: null, selection: null, selectedEventId: null, selectedReviewId: null, hoveredEventId: null,
  layoutEditing: false, dividerDragging: false, focus: null, pendingFocus: null, focusTicker: null,
  pendingPlanReminderId: null, planReminderTicker: null,
  calendarMonth: startOfMonth(new Date()), selectedSubjectId: null, statsSubjects: new Set(),
  selectedDetailEventId: null, flashcardIndex: 0, flashcardRevealed: false, flashcardSubject: 'all',
  installPrompt: null, canvasClickTimer: null, audioContext: null,
  statVisibility: { summary: true, today: true, distribution: true, monthly: true, yearly: true }
};

const dom = {};
[
  'mainLayout','timelineScroll','timelineCanvas','currentDateLabel','reviewBadge','currentDateButton','reviewList','reviewListSummary',
  'toolbarMenuBtn','toolbarMenu','layoutEditBar','addEventBtn','editLayoutBtn','finishLayoutBtn','resetLayoutBtn',
  'sideResizeHandle','focusReviewHandle','contextMenu','importInput','eventModal','settingsModal','calendarModal',
  'statsModal','subjectsModal','planReminderModal','reviewDetailModal','focusDetailModal','eventDetailModal','flashcardsModal','leftoverModal','planReminderSubject','planReminderTime',
  'planReminderTitle','planReminderActions','planReminderLocation','planReminderIgnoreBtn','planReminderSnoozeBtn','planReminderStartBtn',
  'reviewDetailTitle','reviewDetailBasic','reviewDetailLearning',
  'reviewDetailHistory','reviewDetailStartBtn','eventModalTitle','eventHalfZone','eventTaskType','eventCategory',
  'eventSubcategory','eventTopic','eventColor','eventOpacity','eventKnowledgePoint','eventMaterialLocation','eventMastery',
  'eventTextContent','eventNotes','eventLeftover','eventImportant','eventTextSize','eventTextColor',
  'eventTextOpacity','eventStartHour','eventStartMinute','eventEndHour','eventEndMinute','eventTimeSummary',
  'settingStartHour','settingHourHeight','settingPlanRatio','settingDefaultZone','settingMinuteInterval',
  'settingEventPlacement','settingDotSize','settingDotOpacity','settingArrowWidth','settingArrowSize','settingCompactToolbar','settingShowDots','settingDividerDrag',
  'settingHiddenHours','settingReviewPreset','settingReviewIntervals','settingReviewColor','settingReviewOpacity',
  'settingShortcut','settingCountdownName','settingCountdownDate','settingImmersionTheme','settingImmersionOpacity','settingCountdownSize','settingCountdownPosition','settingImmersionBackground','settingLocalBackground','localBackgroundStatus',
  'settingShowCountdown','settingShowQuote','settingSoundType','settingSoundDuration','settingSoundVolume','settingSoundEnabled','settingNotificationsEnabled','monthCalendar','calendarTitle','statsSubjectFilters','statsRange',
  'statTotalCount','statTotalTime','statDailyAverage','statTodayCount','statTodayTime','distributionChart',
  'monthlyChart','yearlyChart','subjectsList','subjectDetail','focusSubjects','focusTaskType','focusTimerType','focusDurationWrap',
  'focusDuration','focusCustomDurationWrap','focusCustomDuration','focusClock','focusSubjectLabel','focusLiveNote','focusStatus',
  'stopFocusBtn','enterImmersionBtn','focusDetailTitle','focusSummary','focusStartLabel','focusEndLabel','focusDetailLabel',
  'focusStartPoint','focusEndPoint','focusResultMastery','focusDetailText','immersionOverlay','immersionBackdrop','immersionContent',
  'immersionMode','immersionClock','immersionSubject','immersionReviewCard','immersionLiveNote','immersionCountdown','immersionQuote',
  'eventDetailTitle','eventDetailBody','eventDetailEditBtn','eventDetailStartBtn','flashcardsSubjectFilter','flashcardProgress','flashcardStage','flashcardSource','flashcardQuestion','flashcardAnswer','flashcardPrevBtn','flashcardNextBtn','flashcardRevealBtn','flashcardSourceBtn','leftoverList','installAppBtn'
].forEach((id) => { dom[id] = document.getElementById(id); });

const canvas = dom.timelineCanvas;
const ctx = canvas.getContext('2d');
let layout = null;

loadBackup();
carryOverReviews();
bindEvents();
syncSettingsToUI();
applyLayoutSettings();
refreshCategoryUI();
renderAll();

function bindEvents() {
  dom.toolbarMenuBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    const open = dom.toolbarMenu.classList.toggle('hidden') === false;
    dom.toolbarMenuBtn.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', (event) => {
    if (!dom.toolbarMenu.contains(event.target) && event.target !== dom.toolbarMenuBtn) closeToolbarMenu();
    if (!dom.contextMenu.contains(event.target)) hideContextMenu();
  });
  document.getElementById('settingsBtn').addEventListener('click', () => { closeToolbarMenu(); openSettings(); });
  document.getElementById('exportImageBtn').addEventListener('click', exportImage);
  document.getElementById('exportDataBtn').addEventListener('click', exportData);
  document.getElementById('importDataBtn').addEventListener('click', () => dom.importInput.click());
  document.getElementById('undoBtn').addEventListener('click', undo);
  document.getElementById('redoBtn').addEventListener('click', redo);
  document.getElementById('clearEventsBtn').addEventListener('click', clearEvents);
  document.getElementById('subjectsBtn').addEventListener('click', openSubjects);
  document.getElementById('statsBtn').addEventListener('click', openStats);
  document.getElementById('flashcardsBtn').addEventListener('click', openFlashcards);
  document.getElementById('leftoverBtn').addEventListener('click', openLeftoverPool);
  document.getElementById('compactTimelinePresetBtn').addEventListener('click', applyCompactTimelinePreset);
  document.getElementById('testSoundBtn').addEventListener('click', playReminderSound);
  document.getElementById('enableNotificationsBtn').addEventListener('click', requestNotifications);
  document.getElementById('clearLocalBackgroundBtn').addEventListener('click', clearImmersionBackground);
  dom.settingLocalBackground.addEventListener('change', importImmersionBackground);
  dom.installAppBtn.addEventListener('click', installApp);
  dom.addEventBtn.addEventListener('click', toggleSelection);
  dom.editLayoutBtn.addEventListener('click', toggleLayoutEditing);
  dom.finishLayoutBtn.addEventListener('click', () => setLayoutEditing(false));
  dom.resetLayoutBtn.addEventListener('click', resetLayout);
  document.getElementById('prevDayBtn').addEventListener('click', () => shiftDate(-1));
  document.getElementById('nextDayBtn').addEventListener('click', () => shiftDate(1));
  dom.currentDateButton.addEventListener('click', openCalendar);
  document.getElementById('calendarPrevBtn').addEventListener('click', () => { state.calendarMonth = addMonths(state.calendarMonth, -1); renderCalendar(); });
  document.getElementById('calendarNextBtn').addEventListener('click', () => { state.calendarMonth = addMonths(state.calendarMonth, 1); renderCalendar(); });
  document.getElementById('saveEventBtn').addEventListener('click', saveEvent);
  document.getElementById('addCategoryBtn').addEventListener('click', addCategory);
  document.getElementById('saveFocusBtn').addEventListener('click', saveFocusRecord);
  document.getElementById('discardFocusBtn').addEventListener('click', discardFocusRecord);
  dom.planReminderStartBtn.addEventListener('click', () => startPlanEvent(state.pendingPlanReminderId));
  dom.planReminderSnoozeBtn.addEventListener('click', snoozePlanReminder);
  dom.planReminderIgnoreBtn.addEventListener('click', ignorePlanReminder);
  dom.reviewDetailStartBtn.addEventListener('click', () => { const id=state.selectedReviewId,startPoint=document.getElementById('reviewStartPointInput')?.value.trim()||'';closeModal('reviewDetailModal');if(id)startReview(id,startPoint); });
  dom.eventDetailEditBtn.addEventListener('click', editSelectedDetailEvent);
  dom.eventDetailStartBtn.addEventListener('click', startSelectedDetailEvent);
  dom.flashcardsSubjectFilter.addEventListener('change', () => { state.flashcardSubject=dom.flashcardsSubjectFilter.value;state.flashcardIndex=0;state.flashcardRevealed=false;renderFlashcards(); });
  dom.flashcardStage.addEventListener('click', toggleFlashcardAnswer);
  dom.flashcardRevealBtn.addEventListener('click', toggleFlashcardAnswer);
  dom.flashcardPrevBtn.addEventListener('click', () => shiftFlashcard(-1));
  dom.flashcardNextBtn.addEventListener('click', () => shiftFlashcard(1));
  dom.flashcardSourceBtn.addEventListener('click', openFlashcardSource);
  dom.stopFocusBtn.addEventListener('click', () => finishFocus(false));
  document.getElementById('immersionStopBtn').addEventListener('click', () => finishFocus(false));
  dom.enterImmersionBtn.addEventListener('click', enterImmersion);
  document.getElementById('exitImmersionBtn').addEventListener('click', exitImmersion);
  dom.focusTimerType.addEventListener('change', updateFocusDurationUI);
  dom.focusDuration.addEventListener('change', updateFocusDurationUI);
  dom.focusLiveNote.addEventListener('input', () => updateFocusLiveNote(dom.focusLiveNote.value));
  dom.immersionLiveNote.addEventListener('input', () => updateFocusLiveNote(dom.immersionLiveNote.value));
  dom.importInput.addEventListener('change', importData);
  document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => closeModal(button.dataset.close)));
  document.querySelectorAll('.filter-btn').forEach((button) => button.addEventListener('click', () => setReviewFilter(button.dataset.filter)));
  document.querySelectorAll('[data-toggle-stat]').forEach((button) => button.addEventListener('click', () => toggleStat(button.dataset.toggleStat)));
  dom.statsRange.addEventListener('change', renderStats);

  dom.eventCategory.addEventListener('change', () => { syncSubcategoryOptions(); syncEventAppearance(); });
  dom.eventSubcategory.addEventListener('change', () => { syncTopicOptions(); syncEventAppearance(); });
  dom.eventTopic.addEventListener('change', syncEventAppearance);
  dom.eventTaskType.addEventListener('change', syncEventAppearance);
  [dom.eventStartHour,dom.eventStartMinute,dom.eventEndHour,dom.eventEndMinute].forEach((input) => input.addEventListener('input', updateTimeSummary));

  const settingInputs = [
    dom.settingStartHour,dom.settingHourHeight,dom.settingPlanRatio,dom.settingDefaultZone,dom.settingMinuteInterval,
    dom.settingEventPlacement,dom.settingDotSize,dom.settingDotOpacity,dom.settingArrowWidth,dom.settingArrowSize,dom.settingCompactToolbar,dom.settingShowDots,dom.settingDividerDrag,
    dom.settingHiddenHours,dom.settingReviewIntervals,dom.settingReviewColor,dom.settingReviewOpacity,dom.settingShortcut,
    dom.settingCountdownName,dom.settingCountdownDate,dom.settingImmersionTheme,dom.settingImmersionOpacity,dom.settingCountdownSize,dom.settingCountdownPosition,dom.settingImmersionBackground,
    dom.settingShowCountdown,dom.settingShowQuote,dom.settingSoundType,dom.settingSoundDuration,dom.settingSoundVolume,dom.settingSoundEnabled,dom.settingNotificationsEnabled
  ];
  settingInputs.forEach((input) => input.addEventListener(input.type === 'text' || input.type === 'range' ? 'input' : 'change', updateSettings));
  dom.settingReviewPreset.addEventListener('change', applyReviewPreset);

  canvas.addEventListener('click', onCanvasClick);
  canvas.addEventListener('dblclick', onCanvasDoubleClick);
  canvas.addEventListener('mousemove', onCanvasMove);
  canvas.addEventListener('mouseleave', () => {
    state.hoveredEventId = null;
    if (state.selection) state.selection.hoverSlot = null;
    renderTimeline();
  });
  canvas.addEventListener('contextmenu', onCanvasContextMenu);
  canvas.addEventListener('pointerdown', onCanvasPointerDown);
  dom.sideResizeHandle.addEventListener('pointerdown', (event) => beginLayoutResize(event, 'side'));
  dom.focusReviewHandle.addEventListener('pointerdown', (event) => beginLayoutResize(event, 'focus'));
  window.addEventListener('resize', renderTimeline);
  window.addEventListener('keydown', onKeydown);
  window.addEventListener('focus', checkPlanReminders);
  document.addEventListener('visibilitychange', () => { if(!document.hidden)checkPlanReminders(); });
  document.addEventListener('pointerdown', unlockAudio, {once:true});
  window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault();state.installPrompt=event;dom.installAppBtn.classList.remove('hidden'); });
  window.addEventListener('appinstalled', () => { state.installPrompt=null;dom.installAppBtn.classList.add('hidden'); });
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function pad(value) { return String(value).padStart(2, '0'); }
function startOfDay(date) { const next = new Date(date); next.setHours(0,0,0,0); return next; }
function startOfMonth(date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
function addDays(date, amount) { const next = new Date(date); next.setDate(next.getDate() + amount); return next; }
function addMonths(date, amount) { return new Date(date.getFullYear(), date.getMonth() + amount, 1); }
function dateKey(date) { return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`; }
function currentDateKey() { return dateKey(state.currentDate); }
function dateLabel(date) { return `${date.getMonth()+1}月${date.getDate()}日 · 周${WEEKDAYS[date.getDay()]}`; }
function parseDate(key) { const [y,m,d] = String(key).split('-').map(Number); return new Date(y,m-1,d); }
function daysBetween(a,b) { return Math.round((startOfDay(b)-startOfDay(a))/86400000); }
function minuteToSlot(hour, minute) { return hour*60+minute; }
function slotParts(slot) { const value=clamp(Math.round(slot),0,1439); return {hour:Math.floor(value/60),minute:value%60}; }
function slotLabel(slot) { const p=slotParts(slot); return `${pad(p.hour)}:${pad(p.minute)}`; }
function durationLabel(seconds) { const mins=Math.round(seconds/60); if(mins<60)return `${mins}m`; return `${Math.floor(mins/60)}h ${mins%60}m`; }
function clockLabel(seconds) { const v=Math.max(0,Math.floor(seconds)); return `${pad(Math.floor(v/3600))}:${pad(Math.floor(v%3600/60))}:${pad(v%60)}`; }
function escapeHtml(text) { return String(text??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;'); }
function normalizeDate(value) { const date=new Date(value); return Number.isNaN(date.getTime())?value:dateKey(date); }
function setToolLabel(button,label,glyph){const text=button.querySelector('.tool-label');if(text)text.textContent=label;else button.textContent=label;if(glyph){const icon=button.querySelector('.tool-glyph');if(icon)icon.textContent=glyph;}}

function parseHiddenHours(text) {
  return String(text||'').split(',').map((item)=>item.trim()).filter(Boolean).map((item)=>item.split('-').map(Number))
    .filter(([start,end])=>Number.isInteger(start)&&Number.isInteger(end)&&start>=0&&end<=24&&start<end);
}
function visibleHours() {
  const hidden=parseHiddenHours(state.settings.hiddenHours); const result=[];
  for(let i=0;i<24;i+=1){const hour=(state.settings.startHour+i)%24;if(!hidden.some(([a,b])=>hour>=a&&hour<b))result.push(hour);}
  return result;
}
function isRangeVisible(start,end) {
  const hours=visibleHours(); for(let slot=start;slot<end;slot+=1){if(!hours.includes(slotParts(slot).hour))return false;} return true;
}
function snapSlot(slot) { const interval=Number(state.settings.minuteInterval)||5; return clamp(Math.round(slot/interval)*interval,0,1439); }

function createLayout(width,hourHeight,top=0) {
  const hours=visibleHours(); const planWidth=Math.round(width*clamp(state.settings.planRatio,.25,.75));
  return {width,hourHeight,top,hours,planWidth,height:top+hours.length*hourHeight};
}
function resizeCanvas() {
  const mobileViewport=window.matchMedia('(max-width: 720px)').matches;
  const width=Math.max(mobileViewport?320:430,dom.timelineScroll.clientWidth||800); layout=createLayout(width,state.settings.hourHeight,0);
  const dpr=window.devicePixelRatio||1; canvas.width=Math.round(width*dpr); canvas.height=Math.round(layout.height*dpr);
  canvas.style.height=`${layout.height}px`; ctx.setTransform(dpr,0,0,dpr,0,0); return layout;
}
function eventY(hourIndex,targetLayout) {
  return targetLayout.top+hourIndex*targetLayout.hourHeight+(state.settings.eventPlacement==='bottom'?targetLayout.hourHeight-9:targetLayout.hourHeight/2);
}
function eventSegments(event,targetLayout) {
  const segments=[]; const zoneLeft=event.halfZone==='record'?targetLayout.planWidth:0;
  const zoneRight=event.halfZone==='record'?targetLayout.width:targetLayout.planWidth; const left=zoneLeft+18; const usable=Math.max(40,zoneRight-zoneLeft-36);
  targetLayout.hours.forEach((hour,index)=>{
    const hs=hour*60,he=hs+60,start=Math.max(event.startSlot,hs),end=Math.min(event.endSlot,he); if(end<=start)return;
    const raw1=left+(start-hs)/60*usable,raw2=left+(end-hs)/60*usable;
    segments.push({x1:raw1,x2:Math.min(zoneRight-8,Math.max(raw2,raw1+12)),y:eventY(index,targetLayout),first:start===event.startSlot,last:end===event.endSlot});
  }); return segments;
}
function subjectById(id) { return state.categories.find((item)=>item.id===id); }
function selectedSubjectNodes() {
  const root=subjectById(dom.eventCategory.value); const second=root?.children?.find((item)=>item.id===dom.eventSubcategory.value);
  const third=second?.children?.find((item)=>item.id===dom.eventTopic.value); return [root,second,third].filter(Boolean);
}
function eventStyle(event) {
  const subject=subjectById(event.categoryId); return{color:event.color||subject?.color||(event.halfZone==='record'?state.settings.defaultRecordColor:state.settings.defaultPlanColor),opacity:event.opacity??subject?.opacity??.86};
}
function hexRgb(hex){const safe=/^#[0-9a-f]{6}$/i.test(hex||'')?hex.slice(1):'6b746d';const v=parseInt(safe,16);return{r:v>>16,g:v>>8&255,b:v&255};}
function rgba(hex,a){const c=hexRgb(hex);return `rgba(${c.r},${c.g},${c.b},${a})`;}
function currentEvents(){return state.events.filter((event)=>event.date===currentDateKey());}

function drawTimeline(context,targetLayout,{exportMode=false}={}) {
  context.save(); context.fillStyle='#fff'; context.fillRect(0,targetLayout.top,targetLayout.width,targetLayout.height-targetLayout.top);
  if(state.settings.showDots)drawMinuteDots(context,targetLayout,exportMode);
  currentEvents().forEach((event)=>drawEvent(context,targetLayout,event,exportMode));
  if(state.selection&&!exportMode)drawSelection(context,targetLayout);
  context.strokeStyle=state.layoutEditing||state.dividerDragging?'#2f6b4f':'#d2d5cf';context.lineWidth=state.layoutEditing||state.dividerDragging?2:1;
  context.beginPath();context.moveTo(targetLayout.planWidth+.5,targetLayout.top);context.lineTo(targetLayout.planWidth+.5,targetLayout.height);context.stroke();
  targetLayout.hours.forEach((hour,index)=>{
    const y=eventY(index,targetLayout);context.fillStyle='#fff';context.fillRect(targetLayout.planWidth-14,y-9,28,18);
    context.fillStyle=hourColor(hour);context.font='800 14px "Segoe UI"';context.textAlign='center';context.textBaseline='middle';context.fillText(String(hour),targetLayout.planWidth,y);
  });
  context.restore();
}
function hourColor(hour){if(hour<6)return'#60799b';if(hour<12)return'#4d8063';if(hour<18)return'#b06f35';return'#765c91';}
function drawMinuteDots(context,targetLayout,exportMode=false) {
  const opacity=exportMode?Math.max(.28,state.settings.dotOpacity):state.settings.dotOpacity;
  context.save();context.fillStyle=`rgba(69,78,70,${opacity})`;
  targetLayout.hours.forEach((hour,index)=>{
    const y=eventY(index,targetLayout);
    [[0,targetLayout.planWidth],[targetLayout.planWidth,targetLayout.width]].forEach(([zoneLeft,zoneRight])=>{
      const left=zoneLeft+18,width=zoneRight-zoneLeft-36;for(let minute=10;minute<60;minute+=10){context.beginPath();context.arc(left+minute/60*width,y,state.settings.dotSize,0,Math.PI*2);context.fill();}
    });
  });context.restore();
}
function drawEvent(context,targetLayout,event,exportMode) {
  const segments=eventSegments(event,targetLayout);if(!segments.length)return;const style=eventStyle(event);
  const active=!exportMode&&(state.selectedEventId===event.id||state.hoveredEventId===event.id);const subject=subjectById(event.categoryId);
  const isReview=event.taskType==='review';
  const arrowWidth=clamp(Number(state.settings.arrowWidth)||1.75,1,5),arrowSize=clamp(Number(state.settings.arrowSize)||6,3,12);
  context.save();context.strokeStyle=rgba(style.color,style.opacity);context.fillStyle=rgba(style.color,style.opacity);context.lineWidth=active?arrowWidth+1.5:arrowWidth;context.lineCap='round';
  segments.forEach((seg)=>{if(isReview)context.setLineDash([6,4]);context.beginPath();context.moveTo(seg.x1,seg.y);context.lineTo(seg.x2,seg.y);context.stroke();context.setLineDash([]);
    if(seg.first){context.beginPath();context.arc(seg.x1,seg.y,active?3.5:2.5,0,Math.PI*2);isReview?context.stroke():context.fill();}
    if(seg.last){context.beginPath();context.moveTo(seg.x2,seg.y);context.lineTo(seg.x2-arrowSize,seg.y-arrowSize*.62);context.moveTo(seg.x2,seg.y);context.lineTo(seg.x2-arrowSize,seg.y+arrowSize*.62);context.stroke();}
  });
  const point=event.knowledgePoint||event.textContent||event.categoryName||'事件',subjectName=(event.categoryName||'').split('/').at(-1);
  const actions=(event.actionTypes||[]).map((type)=>ACTION_TYPE_LABELS[type]).filter(Boolean).join('+');
  const planStatus=event.halfZone==='plan'?(event.planCompletedAt?'✓ ':event.planStartedAt?'▶ ':''):'';
  const first=segments[0],label=`${planStatus}${event.important?'★ ':''}${subjectName?subjectName+' · ':''}${point}${actions?' · '+actions:''}`;
  const zoneLeft=event.halfZone==='record'?targetLayout.planWidth:0,zoneRight=event.halfZone==='record'?targetLayout.width:targetLayout.planWidth;
  context.font=`${subject?.italic?'italic ':''}${subject?.bold?'700 ':'400 '}${clamp(subject?.textSize||event.textSize||12,10,15)}px "Segoe UI","Microsoft YaHei"`;
  const fitted=fitText(context,label,Math.max(70,zoneRight-zoneLeft-42)),w=context.measureText(fitted).width+10;
  const x=clamp((first.x1+first.x2)/2-w/2,zoneLeft+7,zoneRight-w-7),y=first.y-23;
  context.fillStyle='rgba(255,255,255,.94)';roundRect(context,x,y,w,18,6);context.fill();
  context.fillStyle=event.textColor||'#20231f';context.globalAlpha=subject?.textOpacity??event.textOpacity??.92;context.textAlign='center';context.textBaseline='middle';context.fillText(fitted,x+w/2,y+9);
  context.restore();
}
function fitText(context,text,max){if(context.measureText(text).width<=max)return text;let value=text;while(value.length>2&&context.measureText(value+'…').width>max)value=value.slice(0,-1);return value+'…';}
function roundRect(context,x,y,w,h,r){r=Math.min(r,w/2,h/2);context.beginPath();context.moveTo(x+r,y);context.arcTo(x+w,y,x+w,y+h,r);context.arcTo(x+w,y+h,x,y+h,r);context.arcTo(x,y+h,x,y,r);context.arcTo(x,y,x+w,y,r);context.closePath();}

function drawSelection(context,targetLayout) {
  const s=state.selection,zoneLeft=s.zone==='record'?targetLayout.planWidth:0,zoneRight=s.zone==='record'?targetLayout.width:targetLayout.planWidth,left=zoneLeft+18,width=zoneRight-zoneLeft-36;
  const hours=new Set();if(Number.isFinite(s.hoverSlot))hours.add(slotParts(s.hoverSlot).hour);if(Number.isFinite(s.startSlot))hours.add(slotParts(s.startSlot).hour);
  hours.forEach((hour)=>{const index=targetLayout.hours.indexOf(hour);if(index<0)return;const y=eventY(index,targetLayout);
    for(let minute=0;minute<60;minute+=Math.max(1,state.settings.minuteInterval)){const slot=hour*60+minute;if(Number.isFinite(s.startSlot)&&slot<=s.startSlot)continue;context.beginPath();context.fillStyle=slot===s.hoverSlot?'#356957':'rgba(47,107,79,.24)';context.arc(left+minute/60*width,y,slot===s.hoverSlot?3.5:1.5,0,Math.PI*2);context.fill();}
  });
  if(Number.isFinite(s.startSlot))drawSelectMarker(context,targetLayout,s.startSlot,left,width,zoneLeft,zoneRight,'#a96508',s.hoverSlot!==s.startSlot?`起点 ${slotLabel(s.startSlot)}`:null);
  if(Number.isFinite(s.hoverSlot))drawSelectMarker(context,targetLayout,s.hoverSlot,left,width,zoneLeft,zoneRight,'#356957',s.hoverSlot===s.startSlot?`起点 ${slotLabel(s.hoverSlot)}`:slotLabel(s.hoverSlot));
}
function drawSelectMarker(context,targetLayout,slot,left,width,zoneLeft,zoneRight,color,label) {
  const p=slotParts(slot),index=targetLayout.hours.indexOf(p.hour);if(index<0)return;const x=left+p.minute/60*width,y=eventY(index,targetLayout);
  context.save();context.beginPath();context.fillStyle='#fff';context.strokeStyle=color;context.lineWidth=2;context.arc(x,y,6,0,Math.PI*2);context.fill();context.stroke();context.beginPath();context.fillStyle=color;context.arc(x,y,2,0,Math.PI*2);context.fill();
  if(label){context.font='700 11px "Segoe UI"';const w=context.measureText(label).width+16,lx=clamp(x-w/2,zoneLeft+5,zoneRight-w-5),ly=y<34?y+15:y-31;context.fillStyle=color;roundRect(context,lx,ly,w,22,7);context.fill();context.fillStyle='#fff';context.textAlign='center';context.textBaseline='middle';context.fillText(label,lx+w/2,ly+11);}context.restore();
}
function renderTimeline(){const target=resizeCanvas();ctx.clearRect(0,0,target.width,target.height);drawTimeline(ctx,target);canvas.classList.toggle('selecting',Boolean(state.selection));}

function pointerInfo(event) {
  const target=layout||resizeCanvas(),rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left)*target.width/rect.width,y=(event.clientY-rect.top)*target.height/rect.height;
  const index=clamp(Math.floor((y-target.top)/target.hourHeight),0,target.hours.length-1),zone=x<target.planWidth?'plan':'record';
  const zl=zone==='record'?target.planWidth:0,zr=zone==='record'?target.width:target.planWidth,usable=Math.max(40,zr-zl-36),minute=Math.round(clamp(x-zl-18,0,usable)/usable*60);
  return{x,y,zone,slot:snapSlot(target.hours[index]*60+minute)};
}
function hitTest(event){const p=pointerInfo(event);return[...currentEvents()].reverse().find((item)=>eventSegments(item,layout).some((s)=>p.x>=s.x1-7&&p.x<=s.x2+7&&Math.abs(p.y-s.y)<=11))||null;}

function toggleSelection() {
  if(state.selection){cancelSelection();return;}
  closeAllModals();state.selection={zone:state.settings.defaultSelectionZone,startSlot:null,hoverSlot:null};state.selectedEventId=null;
  setToolLabel(dom.addEventBtn,'取消选点','×');dom.addEventBtn.title='取消选点';dom.addEventBtn.classList.add('danger');renderTimeline();
}
function cancelSelection(){state.selection=null;setToolLabel(dom.addEventBtn,'选时间','＋');dom.addEventBtn.title='在时间轴选时间';dom.addEventBtn.classList.remove('danger');renderTimeline();}
function onCanvasMove(event) {
  if(state.selection){const p=pointerInfo(event);if(!Number.isFinite(state.selection.startSlot))state.selection.zone=p.zone;state.selection.hoverSlot=p.zone===state.selection.zone?p.slot:null;renderTimeline();return;}
  const hit=hitTest(event),id=hit?.id||null;if(id!==state.hoveredEventId){state.hoveredEventId=id;renderTimeline();}
}
function onCanvasClick(event) {
  if(!state.selection){const hit=hitTest(event);state.selectedEventId=hit?.id||null;renderTimeline();clearTimeout(state.canvasClickTimer);if(hit)state.canvasClickTimer=setTimeout(()=>openEventDetail(hit.id),190);return;}
  const p=pointerInfo(event);
  if(!Number.isFinite(state.selection.startSlot)){state.selection.zone=p.zone;state.selection.startSlot=p.slot;state.selection.hoverSlot=p.slot;renderTimeline();return;}
  if(p.zone!==state.selection.zone){state.selection.zone=p.zone;state.selection.startSlot=p.slot;state.selection.hoverSlot=p.slot;renderTimeline();return;}
  if(p.slot<=state.selection.startSlot){window.alert('结束时间需要晚于开始时间。');return;}
  const preset={halfZone:p.zone,startSlot:state.selection.startSlot,endSlot:p.slot};cancelSelection();openEventModal(null,preset);
}
function onCanvasDoubleClick(event){if(!state.selection){clearTimeout(state.canvasClickTimer);const hit=hitTest(event);if(hit)openEventModal(hit);}}
function onCanvasContextMenu(event){event.preventDefault();if(state.selection)return;const hit=hitTest(event);if(!hit)return;
  dom.contextMenu.innerHTML=`${hit.halfZone==='plan'?'<button class="primary" data-action="start">▶ 开始学习</button>':''}<button data-action="detail">查看学习详情</button><button data-action="edit">编辑事件</button><button class="danger" data-action="delete">删除事件</button>`;dom.contextMenu.style.left=`${event.clientX}px`;dom.contextMenu.style.top=`${event.clientY}px`;dom.contextMenu.classList.remove('hidden');
  const startButton=dom.contextMenu.querySelector('[data-action="start"]');if(startButton)startButton.onclick=()=>{hideContextMenu();startPlanEvent(hit.id);};
  dom.contextMenu.querySelector('[data-action="detail"]').onclick=()=>{hideContextMenu();openEventDetail(hit.id);};
  dom.contextMenu.querySelector('[data-action="edit"]').onclick=()=>{hideContextMenu();openEventModal(hit);};dom.contextMenu.querySelector('[data-action="delete"]').onclick=()=>{hideContextMenu();deleteEvent(hit.id);};
}
function hideContextMenu(){dom.contextMenu.classList.add('hidden');dom.contextMenu.innerHTML='';}

function onCanvasPointerDown(event) {
  if((state.layoutEditing||state.settings.dividerDrag)&&Math.abs(pointerInfo(event).x-layout.planWidth)<=9){
    event.preventDefault();state.dividerDragging=true;const move=(e)=>{const p=pointerInfo(e);state.settings.planRatio=clamp(p.x/layout.width,.25,.75);dom.settingPlanRatio.value=Math.round(state.settings.planRatio*100);renderTimeline();};
    const up=()=>{state.dividerDragging=false;saveBackup();window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);renderTimeline();};
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);
  }
}
function toggleLayoutEditing(){setLayoutEditing(!state.layoutEditing);}
function setLayoutEditing(value){state.layoutEditing=value;document.body.classList.toggle('layout-editing',value);dom.layoutEditBar.classList.toggle('hidden',!value);setToolLabel(dom.editLayoutBtn,value?'完成':'布局',value?'✓':'⤢');dom.editLayoutBtn.title=value?'完成布局':'编辑布局';renderTimeline();}
function beginLayoutResize(event,type) {
  if(!state.layoutEditing)return;event.preventDefault();const handle=event.currentTarget;handle.classList.add('dragging');
  const move=(e)=>{if(type==='side'){const rect=dom.mainLayout.getBoundingClientRect();state.settings.sideWidth=clamp(rect.right-e.clientX,260,560);}else{const rect=document.querySelector('.side-panel').getBoundingClientRect();state.settings.focusHeight=clamp(e.clientY-rect.top-70,180,500);}applyLayoutSettings();renderTimeline();};
  const up=()=>{handle.classList.remove('dragging');saveBackup();window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);};
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);
}
function applyLayoutSettings(){document.documentElement.style.setProperty('--side-width',`${state.settings.sideWidth}px`);document.documentElement.style.setProperty('--focus-height',`${state.settings.focusHeight}px`);document.body.classList.toggle('compact-toolbar',Boolean(state.settings.compactToolbar));}
function resetLayout(){state.settings.sideWidth=330;state.settings.focusHeight=285;state.settings.planRatio=.5;applyLayoutSettings();syncSettingsToUI();saveBackup();renderTimeline();}

function openModal(id){const el=document.getElementById(id);el.classList.remove('hidden');el.setAttribute('aria-hidden','false');}
function closeModal(id){const el=document.getElementById(id);if(!el)return;el.classList.add('hidden');el.setAttribute('aria-hidden','true');}
function closeAllModals(){document.querySelectorAll('.modal').forEach((el)=>{el.classList.add('hidden');el.setAttribute('aria-hidden','true');});}
function closeToolbarMenu(){dom.toolbarMenu.classList.add('hidden');dom.toolbarMenuBtn.setAttribute('aria-expanded','false');}

function syncCategoryOptions(selectedId) {
  dom.eventCategory.innerHTML=state.categories.map((s)=>`<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  dom.eventCategory.value=selectedId&&subjectById(selectedId)?selectedId:state.categories[0]?.id||'';syncSubcategoryOptions();syncTopicOptions();
}
function syncSubcategoryOptions(selectedId) {
  const root=subjectById(dom.eventCategory.value),items=root?.children||[];
  dom.eventSubcategory.innerHTML='<option value="">不继续选择</option>'+items.map((s)=>`<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  if(selectedId&&items.some((s)=>s.id===selectedId))dom.eventSubcategory.value=selectedId;syncTopicOptions();
}
function syncTopicOptions(selectedId) {
  const root=subjectById(dom.eventCategory.value),second=root?.children?.find((s)=>s.id===dom.eventSubcategory.value),items=second?.children||[];
  dom.eventTopic.innerHTML='<option value="">不继续选择</option>'+items.map((s)=>`<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  if(selectedId&&items.some((s)=>s.id===selectedId))dom.eventTopic.value=selectedId;
}
function openEventModal(event=null,preset=null) {
  state.editingEventId=event?.id||null;dom.eventModalTitle.textContent=event?'编辑事件':'添加事件';
  dom.eventHalfZone.value=event?.halfZone||preset?.halfZone||state.settings.defaultSelectionZone;dom.eventTaskType.value=event?.taskType||'learn';dom.eventTextContent.value=event?.textContent||'';
  dom.eventNotes.value=event?.notes||'';
  dom.eventKnowledgePoint.value=event?.knowledgePoint||event?.textContent||'';dom.eventMaterialLocation.value=event?.materialLocation||'';dom.eventMastery.value=event?.mastery||'unknown';
  dom.eventLeftover.value=event?.leftover||'';dom.eventImportant.checked=Boolean(event?.important);
  document.querySelectorAll('.event-action-type').forEach((input)=>{input.checked=(event?.actionTypes||[]).includes(input.value);});
  const path=event?.subjectPath||[];syncCategoryOptions(event?.categoryId||path[0]);if(path[1])syncSubcategoryOptions(path[1]);if(path[2])syncTopicOptions(path[2]);
  const subject=subjectById(dom.eventCategory.value);dom.eventColor.value=event?.color||subject?.color||state.settings.defaultPlanColor;dom.eventOpacity.value=event?.opacity??subject?.opacity??.86;
  dom.eventTextSize.value=event?.textSize||subject?.textSize||state.settings.defaultTextSize;dom.eventTextColor.value=event?.textColor||state.settings.defaultTextColor;dom.eventTextOpacity.value=event?.textOpacity??subject?.textOpacity??.92;
  const start=slotParts(event?.startSlot??preset?.startSlot??480),end=slotParts(event?.endSlot??preset?.endSlot??540);
  dom.eventStartHour.value=start.hour;dom.eventStartMinute.value=start.minute;dom.eventEndHour.value=end.hour;dom.eventEndMinute.value=end.minute;updateTimeSummary();openModal('eventModal');setTimeout(()=>dom.eventTextContent.focus(),0);
}
function selectedActionTypes(){return [...document.querySelectorAll('.event-action-type:checked')].map((input)=>input.value);}
function defaultFlashcards(event){
  const point=(event.knowledgePoint||event.textContent||'').trim(),answer=(event.textContent||event.notes||event.materialLocation||'').trim(),cards=[];
  if(point&&answer)cards.push({id:uid('card'),question:`不看资料，概括“${point}”的核心内容。`,answer});
  if(point&&event.leftover)cards.push({id:uid('card'),question:`“${point}”还有什么遗留问题？`,answer:event.leftover});
  if(point&&event.materialLocation)cards.push({id:uid('card'),question:`复习“${point}”时应定位到哪里？`,answer:event.materialLocation});
  return cards.slice(0,3);
}
function normalizeFlashcards(cards,event){const list=Array.isArray(cards)?cards.filter((card)=>card&&(card.question||card.answer)).map((card)=>({id:card.id||uid('card'),question:String(card.question||''),answer:String(card.answer||'')})):[];return list.length?list:defaultFlashcards(event);}
function readEventTime(){const v=[dom.eventStartHour,dom.eventStartMinute,dom.eventEndHour,dom.eventEndMinute].map((el)=>Number(el.value));if(v.some((n)=>!Number.isFinite(n)))return null;return{startSlot:minuteToSlot(clamp(v[0],0,23),clamp(v[1],0,59)),endSlot:minuteToSlot(clamp(v[2],0,23),clamp(v[3],0,59))};}
function updateTimeSummary(){const r=readEventTime();dom.eventTimeSummary.textContent=r?`${slotLabel(r.startSlot)} – ${slotLabel(r.endSlot)}`:'尚未选择时间';}
function syncEventAppearance(){const nodes=selectedSubjectNodes(),root=nodes[0];if(!root)return;if(dom.eventTaskType.value==='review'){dom.eventColor.value=state.settings.reviewColor;dom.eventOpacity.value=state.settings.reviewOpacity;}else{dom.eventColor.value=root.color;dom.eventOpacity.value=root.opacity;}dom.eventTextSize.value=root.textSize;dom.eventTextOpacity.value=root.textOpacity;}
function saveEvent() {
  const range=readEventTime();if(!range||range.endSlot<=range.startSlot){window.alert('请选择有效的起止时间。');return;}if(!isRangeVisible(range.startSlot,range.endSlot)){window.alert('事件不能跨越隐藏时段。');return;}
  const previous=state.events.find((event)=>event.id===state.editingEventId),nodes=selectedSubjectNodes(),root=nodes[0],next={...(previous||{}),id:state.editingEventId||uid('event'),date:currentDateKey(),halfZone:dom.eventHalfZone.value,taskType:dom.eventTaskType.value,
    categoryId:root?.id||null,categoryName:nodes.map((n)=>n.name).join('/'),subjectPath:nodes.map((n)=>n.id),startSlot:range.startSlot,endSlot:range.endSlot,color:dom.eventColor.value,
    opacity:Number(dom.eventOpacity.value),actionTypes:selectedActionTypes(),knowledgePoint:dom.eventKnowledgePoint.value.trim(),materialLocation:dom.eventMaterialLocation.value.trim(),mastery:dom.eventMastery.value,
    textContent:dom.eventTextContent.value.trim(),notes:dom.eventNotes.value.trim(),leftover:dom.eventLeftover.value.trim(),important:dom.eventImportant.checked,textSize:clamp(Number(dom.eventTextSize.value)||13,10,24),textColor:dom.eventTextColor.value,textOpacity:clamp(Number(dom.eventTextOpacity.value)||.92,.1,1),conflict:false};
  if(previous?.leftover!==next.leftover)delete next.leftoverCompletedAt;next.flashcards=normalizeFlashcards(previous?.flashcards,next);
  pushHistory();if(state.editingEventId){const i=state.events.findIndex((e)=>e.id===state.editingEventId);if(i>=0)state.events[i]=next;}else state.events.push(next);
  const deepest=nodes.at(-1),reviewEnabled=next.halfZone==='record'&&next.taskType==='learn'&&deepest?.reviewEnabled!==false;syncGeneratedReviews(next,reviewEnabled);
  validateConflicts();saveBackup();closeModal('eventModal');state.editingEventId=null;renderAll();checkPlanReminders();
}
function reviewSnapshot(event){return{categoryId:event.categoryId,categoryName:event.categoryName,actionTypes:[...(event.actionTypes||[])],knowledgePoint:event.knowledgePoint||event.textContent||'',materialLocation:event.materialLocation||'',mastery:event.mastery||'unknown',leftover:event.leftover||'',important:Boolean(event.important),textContent:event.textContent||event.knowledgePoint||event.categoryName||'学习任务'};}
function generateReviews(event){state.settings.reviewIntervals.forEach((offset,index)=>state.reviews.push({id:uid('review'),sourceEventId:event.id,reviewDate:dateKey(addDays(parseDate(event.date),offset)),reviewNumber:index+1,intervalDays:offset,...reviewSnapshot(event),completed:false,abandoned:false}));}
function syncGeneratedReviews(event,enabled){const existing=state.reviews.filter((review)=>review.sourceEventId===event.id);if(!enabled){state.reviews=state.reviews.filter((review)=>review.sourceEventId!==event.id);return;}if(!existing.length){generateReviews(event);return;}const snapshot=reviewSnapshot(event);existing.forEach((review)=>Object.assign(review,snapshot));}
function validateConflicts(){state.events.forEach((e)=>e.conflict=false);state.events.forEach((e,i)=>state.events.slice(i+1).forEach((o)=>{if(e.date===o.date&&e.halfZone===o.halfZone&&e.startSlot<o.endSlot&&o.startSlot<e.endSlot){e.conflict=true;o.conflict=true;}}));}
function deleteEvent(id){if(!window.confirm('确认删除这个事件？'))return;pushHistory();state.events=state.events.filter((e)=>e.id!==id);state.reviews=state.reviews.filter((r)=>r.sourceEventId!==id);if(state.pendingPlanReminderId===id)closePlanReminder();validateConflicts();saveBackup();renderAll();}

function effectiveLeftover(review,source=reviewSource(review)){return source?.leftoverCompletedAt?'':(review?.leftover||source?.leftover||'');}
function reviewStatusText(review){if(review.completed)return'✓ 已完成';if(review.abandoned)return'× 已放弃';if(review.originalReviewDate&&review.reviewDate!==review.originalReviewDate)return`↪ 从 ${review.originalReviewDate} 顺延`;return'○ 待复习';}
function openEventDetail(id){const event=state.events.find((item)=>item.id===id);if(!event)return;state.selectedDetailEventId=id;renderEventDetail();openModal('eventDetailModal');}
function renderEventDetail(){
  const event=state.events.find((item)=>item.id===state.selectedDetailEventId);if(!event){closeModal('eventDetailModal');return;}event.flashcards=normalizeFlashcards(event.flashcards,event);const subject=subjectById(event.categoryId),reviews=state.reviews.filter((review)=>review.sourceEventId===event.id).sort((a,b)=>a.reviewNumber-b.reviewNumber),cards=event.flashcards||[],actions=(event.actionTypes||[]).map((type)=>ACTION_TYPE_LABELS[type]).filter(Boolean),leftover=event.leftover||'',resolved=Boolean(event.leftoverCompletedAt);
  dom.eventDetailTitle.textContent=event.knowledgePoint||event.textContent||event.categoryName||'事件详情';
  const schedule=reviews.length?reviews.map((review)=>`<button class="review-schedule-row ${review.completed?'completed':''} ${review.abandoned?'abandoned':''}" data-detail-review="${review.id}"><b>D${reviewIntervalDays(review,event)}</b><span>${review.reviewDate} · 第 ${review.reviewNumber} 次</span><span class="status">${reviewStatusText(review)}</span></button>`).join(''):'<p class="settings-note">这个事件没有生成复习排期。</p>';
  const cardRows=cards.map((card,index)=>`<div class="detail-flashcard" data-card-index="${index}"><input class="detail-card-question" maxlength="180" value="${escapeHtml(card.question)}" placeholder="问题"><input class="detail-card-answer" maxlength="500" value="${escapeHtml(card.answer)}" placeholder="答案"><button data-delete-card="${index}" aria-label="删除闪卡">×</button></div>`).join('');
  dom.eventDetailBody.innerHTML=`<section class="event-detail-hero" style="--event-color:${subject?.color||event.color||'#527a64'}"><span>${escapeHtml(event.categoryName||subject?.name||'未分类')} · ${event.date} · ${slotLabel(event.startSlot)}–${slotLabel(event.endSlot)}</span><h4>${escapeHtml(event.knowledgePoint||event.textContent||'学习事件')}</h4><p>${escapeHtml([actions.join(' / '),event.materialLocation].filter(Boolean).join(' · ')||'未补充学习动作与资料定位')}</p></section>
    <section class="event-detail-section"><h4>复习排期 <span>${reviews.length} 次</span></h4><div class="review-schedule-list">${schedule}</div></section>
    <section class="event-detail-section"><h4>学习信息</h4><div class="event-detail-facts"><div><span>掌握程度</span><b>${MASTERY_LABELS[event.mastery]||'尚未判断'}</b></div><div><span>重点</span><b>${event.important?'★ 是':'否'}</b></div><div><span>资料定位</span><b>${escapeHtml(event.materialLocation||'未填写')}</b></div><div><span>学习摘要</span><b>${escapeHtml(event.textContent||'未填写')}</b></div></div></section>
    <section class="event-detail-section wide"><h4>闪卡 <span>主动回忆后再看答案</span></h4><div class="detail-card-list">${cardRows||'<p class="settings-note">暂无闪卡，可手动添加。</p>'}</div><div class="detail-section-actions"><button id="detailAddCardBtn" class="tool-btn">＋ 添加闪卡</button><button id="detailSaveLearningBtn" class="tool-btn primary">保存笔记与闪卡</button></div></section>
    <section class="event-detail-section"><h4>学习笔记</h4><textarea id="detailLearningNotes" class="learning-notes" maxlength="1200" placeholder="记录自己的理解、推导和易错点">${escapeHtml(event.notes||'')}</textarea></section>
    <section class="event-detail-section"><h4>遗留内容</h4>${leftover?`<div class="detail-leftover ${resolved?'resolved':''}">${escapeHtml(leftover)}</div><div class="detail-section-actions"><button id="detailLeftoverToggleBtn" class="tool-btn">${resolved?'恢复待处理':'标记已解决'}</button>${resolved?'':`<button id="detailLeftoverStartBtn" class="tool-btn primary">开始处理</button>`}</div>`:'<p class="settings-note">没有遗留内容。</p>'}</section>`;
  dom.eventDetailBody.querySelectorAll('[data-detail-review]').forEach((button)=>button.onclick=()=>{closeModal('eventDetailModal');openReviewDetail(button.dataset.detailReview);});
  dom.eventDetailBody.querySelectorAll('[data-delete-card]').forEach((button)=>button.onclick=()=>deleteDetailFlashcard(Number(button.dataset.deleteCard)));
  document.getElementById('detailAddCardBtn').onclick=addDetailFlashcard;document.getElementById('detailSaveLearningBtn').onclick=saveEventLearningDetails;
  const leftoverToggle=document.getElementById('detailLeftoverToggleBtn'),leftoverStart=document.getElementById('detailLeftoverStartBtn');if(leftoverToggle)leftoverToggle.onclick=()=>toggleLeftover(event.id);if(leftoverStart)leftoverStart.onclick=()=>startLeftoverEvent(event.id);
  const pending=reviews.find((review)=>!review.completed&&!review.abandoned&&review.reviewDate<=dateKey(new Date()));dom.eventDetailStartBtn.disabled=event.planCompletedAt&&event.halfZone==='plan'&&!pending;dom.eventDetailStartBtn.textContent=pending?'开始到期复习':event.halfZone==='plan'?(event.planCompletedAt?'计划已完成':'开始学习'):'再次学习';
}
function saveEventLearningDetails(){const event=state.events.find((item)=>item.id===state.selectedDetailEventId);if(!event)return;pushHistory();event.notes=document.getElementById('detailLearningNotes')?.value.trim()||'';event.flashcards=[...dom.eventDetailBody.querySelectorAll('.detail-flashcard')].map((row,index)=>({id:event.flashcards?.[index]?.id||uid('card'),question:row.querySelector('.detail-card-question').value.trim(),answer:row.querySelector('.detail-card-answer').value.trim()})).filter((card)=>card.question||card.answer);saveBackup();renderEventDetail();}
function addDetailFlashcard(){const event=state.events.find((item)=>item.id===state.selectedDetailEventId);if(!event)return;saveEventLearningDetails();event.flashcards.push({id:uid('card'),question:'',answer:''});saveBackup();renderEventDetail();setTimeout(()=>dom.eventDetailBody.querySelector('.detail-flashcard:last-child input')?.focus(),0);}
function deleteDetailFlashcard(index){const event=state.events.find((item)=>item.id===state.selectedDetailEventId);if(!event)return;pushHistory();event.flashcards.splice(index,1);saveBackup();renderEventDetail();}
function editSelectedDetailEvent(){const event=state.events.find((item)=>item.id===state.selectedDetailEventId);if(!event)return;closeModal('eventDetailModal');openEventModal(event);}
function startSelectedDetailEvent(){const event=state.events.find((item)=>item.id===state.selectedDetailEventId);if(!event)return;const review=state.reviews.find((item)=>item.sourceEventId===event.id&&!item.completed&&!item.abandoned&&item.reviewDate<=dateKey(new Date()));closeModal('eventDetailModal');if(review){startReview(review.id);return;}if(event.halfZone==='plan'){startPlanEvent(event.id);return;}startSourceEvent(event,'learn');}

function flashcardItems(){return state.events.flatMap((event)=>normalizeFlashcards(event.flashcards,event).map((card)=>({card,event}))).filter((item)=>state.flashcardSubject==='all'||item.event.categoryId===state.flashcardSubject);}
function openFlashcards(){dom.flashcardsSubjectFilter.innerHTML='<option value="all">全部学科</option>'+state.categories.map((subject)=>`<option value="${subject.id}">${escapeHtml(subject.name)}</option>`).join('');dom.flashcardsSubjectFilter.value=state.flashcardSubject;state.flashcardIndex=0;state.flashcardRevealed=false;renderFlashcards();openModal('flashcardsModal');}
function renderFlashcards(){const items=flashcardItems(),count=items.length;if(count)state.flashcardIndex=(state.flashcardIndex+count)%count;else state.flashcardIndex=0;const item=items[state.flashcardIndex];dom.flashcardProgress.textContent=count?`${state.flashcardIndex+1} / ${count}`:'0 / 0';dom.flashcardStage.classList.toggle('revealed',Boolean(item&&state.flashcardRevealed));dom.flashcardSource.textContent=item?`${item.event.categoryName||'未分类'} · ${item.event.date}`:'';dom.flashcardQuestion.textContent=item?.card.question||'暂无闪卡';dom.flashcardAnswer.textContent=item?.card.answer||'保存含知识点的学习事件后，会自动生成闪卡。';dom.flashcardRevealBtn.textContent=state.flashcardRevealed?'隐藏答案':'显示答案';[dom.flashcardPrevBtn,dom.flashcardNextBtn,dom.flashcardRevealBtn,dom.flashcardSourceBtn].forEach((button)=>button.disabled=!item);}
function toggleFlashcardAnswer(){if(!flashcardItems().length)return;state.flashcardRevealed=!state.flashcardRevealed;renderFlashcards();}
function shiftFlashcard(amount){if(!flashcardItems().length)return;state.flashcardIndex+=amount;state.flashcardRevealed=false;renderFlashcards();}
function openFlashcardSource(){const item=flashcardItems()[state.flashcardIndex];if(!item)return;closeModal('flashcardsModal');openEventDetail(item.event.id);}

function openLeftoverPool(){renderLeftoverPool();openModal('leftoverModal');}
function renderLeftoverPool(){const events=state.events.filter((event)=>event.leftover).sort((a,b)=>Number(Boolean(a.leftoverCompletedAt))-Number(Boolean(b.leftoverCompletedAt))||b.date.localeCompare(a.date));if(!events.length){dom.leftoverList.innerHTML='<div class="review-empty">目前没有遗留内容</div>';return;}dom.leftoverList.innerHTML=events.map((event)=>{const subject=subjectById(event.categoryId),resolved=Boolean(event.leftoverCompletedAt);return`<article class="leftover-item ${resolved?'resolved':''}" style="--leftover-color:${subject?.color||event.color||'#6b7a72'}"><div></div><div><h4>${escapeHtml(event.knowledgePoint||event.textContent||event.categoryName||'学习事件')}</h4><p>${escapeHtml(event.leftover)}</p><small>${escapeHtml(event.categoryName||'未分类')} · ${event.date}${resolved?` · 已于 ${normalizeDate(event.leftoverCompletedAt)} 清理`:''}</small></div><div class="leftover-actions">${resolved?'':`<button class="tool-btn primary" data-leftover-start="${event.id}">开始处理</button>`}<button class="tool-btn" data-leftover-view="${event.id}">详情</button><button class="tool-btn" data-leftover-toggle="${event.id}">${resolved?'恢复':'完成'}</button></div></article>`;}).join('');dom.leftoverList.querySelectorAll('[data-leftover-start]').forEach((button)=>button.onclick=()=>startLeftoverEvent(button.dataset.leftoverStart));dom.leftoverList.querySelectorAll('[data-leftover-view]').forEach((button)=>button.onclick=()=>{closeModal('leftoverModal');openEventDetail(button.dataset.leftoverView);});dom.leftoverList.querySelectorAll('[data-leftover-toggle]').forEach((button)=>button.onclick=()=>toggleLeftover(button.dataset.leftoverToggle));}
function toggleLeftover(id,completed){const event=state.events.find((item)=>item.id===id);if(!event)return;pushHistory();const resolve=completed??!event.leftoverCompletedAt;if(resolve)event.leftoverCompletedAt=new Date().toISOString();else delete event.leftoverCompletedAt;state.reviews.filter((review)=>review.sourceEventId===event.id).forEach((review)=>review.leftoverResolved=resolve);saveBackup();if(!dom.leftoverModal.classList.contains('hidden'))renderLeftoverPool();if(!dom.eventDetailModal.classList.contains('hidden'))renderEventDetail();renderReviews();}
function startLeftoverEvent(id){const event=state.events.find((item)=>item.id===id);if(!event)return;closeModal('leftoverModal');closeModal('eventDetailModal');startSourceEvent(event,'learn',{leftoverEventId:event.id,suppressReviews:true});}
function startSourceEvent(event,taskType='learn',extra={}){if(state.focus){window.alert('已有正在进行的计时，请先结束当前任务。');return;}const subject=subjectById(event.categoryId);state.focus={categoryId:event.categoryId,categoryName:event.categoryName||subject?.name||'学习任务',color:subject?.color||event.color||state.settings.defaultRecordColor,type:'countup',taskType,durationSeconds:0,startedAt:Date.now(),sourceEventId:event.id,planStartPoint:event.materialLocation||'',...extra};state.focusTicker=setInterval(tickFocus,250);renderFocusSubjects();renderFocus();enterImmersion();}

function carryOverReviews(){const today=dateKey(new Date());let changed=false;state.reviews.forEach((review)=>{if(!review.completed&&!review.abandoned&&review.reviewDate<today){review.originalReviewDate=review.originalReviewDate||review.reviewDate;review.reviewDate=today;review.carriedOverCount=(Number(review.carriedOverCount)||0)+1;review.carriedAt=new Date().toISOString();changed=true;}});if(changed)saveBackup();}

function closePlanReminder(){closeModal('planReminderModal');state.pendingPlanReminderId=null;document.title='学习日志时间轴';}
function showPlanReminder(event){
  const subject=subjectById(event.categoryId),actions=(event.actionTypes||[]).map((type)=>ACTION_TYPE_LABELS[type]).filter(Boolean);state.pendingPlanReminderId=event.id;dom.planReminderModal.style.setProperty('--plan-color',subject?.color||event.color||'#2f6b4f');dom.planReminderSubject.textContent=event.categoryName||subject?.name||'学习计划';dom.planReminderTime.textContent=`${slotLabel(event.startSlot)} - ${slotLabel(event.endSlot)}`;dom.planReminderTitle.textContent=event.knowledgePoint||event.textContent||'学习任务';dom.planReminderActions.innerHTML=actions.map((action)=>`<span>${escapeHtml(action)}</span>`).join('');dom.planReminderLocation.textContent=event.materialLocation?`资料定位 · ${event.materialLocation}`:(event.textContent||'准备开始本次计划');document.title=`⏰ ${dom.planReminderTitle.textContent}`;openModal('planReminderModal');playReminderSound();showSystemNotification('计划时间到了',`${event.categoryName||'学习计划'} · ${dom.planReminderTitle.textContent}`);dom.planReminderStartBtn.focus();
}
function checkPlanReminders(){
  if(state.focus||state.pendingFocus)return;if(state.pendingPlanReminderId&&!dom.planReminderModal.classList.contains('hidden'))return;if(state.pendingPlanReminderId)state.pendingPlanReminderId=null;const now=new Date(),key=dateKey(now),minute=now.getHours()*60+now.getMinutes(),timestamp=Date.now();
  const due=state.events.filter((event)=>event.halfZone==='plan'&&event.date===key&&!event.planCompletedAt&&!event.reminderIgnoredAt&&(!event.reminderSnoozeUntil||Number(event.reminderSnoozeUntil)<=timestamp)&&minute>=event.startSlot&&minute<event.endSlot).sort((a,b)=>a.startSlot-b.startSlot)[0];if(due)showPlanReminder(due);
}
function snoozePlanReminder(){const event=state.events.find((item)=>item.id===state.pendingPlanReminderId);if(event){event.reminderSnoozeUntil=Date.now()+10*60*1000;saveBackup();}closePlanReminder();}
function ignorePlanReminder(){const event=state.events.find((item)=>item.id===state.pendingPlanReminderId);if(event){event.reminderIgnoredAt=new Date().toISOString();saveBackup();}closePlanReminder();renderTimeline();}
function startPlanEvent(id){
  const event=state.events.find((item)=>item.id===id&&item.halfZone==='plan');if(!event)return;if(state.focus){window.alert('已有正在进行的计时，请先结束当前任务。');return;}const subject=subjectById(event.categoryId);pushHistory();event.planStartedAt=new Date().toISOString();delete event.reminderSnoozeUntil;delete event.reminderIgnoredAt;closePlanReminder();state.focus={categoryId:event.categoryId,categoryName:event.categoryName||subject?.name||'学习计划',color:subject?.color||event.color||state.settings.defaultPlanColor,type:'countup',taskType:event.taskType==='review'?'review':'learn',durationSeconds:0,startedAt:Date.now(),sourceEventId:event.id,planEventId:event.id,planStartPoint:event.materialLocation||'',liveNotes:event.notes||''};state.focusTicker=setInterval(tickFocus,250);saveBackup();renderTimeline();renderFocusSubjects();renderFocus();enterImmersion();
}

function renderDate(){const key=currentDateKey();dom.currentDateLabel.textContent=dateLabel(state.currentDate);dom.reviewBadge.textContent=state.reviews.filter((r)=>r.reviewDate<=key&&!r.completed&&!r.abandoned).length;}
function shiftDate(amount){state.currentDate=addDays(state.currentDate,amount);state.selectedEventId=null;if(state.selection)cancelSelection();saveBackup();renderAll();}
function setReviewFilter(filter){state.reviewFilter=filter;document.querySelectorAll('.filter-btn').forEach((b)=>b.classList.toggle('active',b.dataset.filter===filter));renderReviews();}
function filteredReviews() {
  const key=currentDateKey();return state.reviews.filter((r)=>{if(state.reviewFilter==='all')return true;if(r.completed||r.abandoned)return false;if(state.reviewFilter==='overdue')return (r.originalReviewDate||r.reviewDate)<key;return r.reviewDate===key;
  }).sort((a,b)=>a.reviewDate.localeCompare(b.reviewDate)||masteryPriority(a.mastery)-masteryPriority(b.mastery)||a.reviewNumber-b.reviewNumber);
}
function masteryPriority(value){return{weak:0,unknown:1,partial:2,mastered:3}[value]??1;}
function reviewSource(review){return state.events.find((event)=>event.id===review.sourceEventId);}
function reviewIntervalDays(review,source=reviewSource(review)){const explicit=Number(review.intervalDays);if(Number.isFinite(explicit)&&explicit>=0)return explicit;if(source?.date&&review.reviewDate)return Math.max(0,daysBetween(parseDate(source.date),parseDate(review.reviewDate)));return review.reviewNumber||1;}
function reviewIntervalLabel(review,source){return `D${reviewIntervalDays(review,source)}`;}
function suggestedReviewStart(review,source=reviewSource(review)){const previous=state.reviews.filter((item)=>item.sourceEventId===review.sourceEventId&&item.completed&&item.reviewNumber<review.reviewNumber&&item.resultEndPoint).sort((a,b)=>b.reviewNumber-a.reviewNumber)[0];return previous?.resultEndPoint||review.resultEndPoint||review.materialLocation||source?.materialLocation||'';}
function reviewSuggestion(review,source){
  const mastery=review.mastery||source?.mastery||'unknown',actions=review.actionTypes?.length?review.actionTypes:(source?.actionTypes||[]);let suggestion={weak:'先定位原资料重新梳理，再合上资料复述一次。',partial:'先主动回忆关键步骤，再用一道题或一次复述检验。',mastered:'快速回忆核心结论，抽查一个易错点即可。',unknown:'先不看资料回忆核心内容，再对照检查遗漏。'}[mastery];
  if(actions.includes('practice'))suggestion+=' 优先重做一道代表题或错题。';else if(actions.includes('memorize'))suggestion+=' 尝试完整背诵，再标出卡顿处。';else if(actions.includes('video'))suggestion+=' 用自己的话复述视频主线。';else if(actions.includes('reading'))suggestion+=' 合上资料列出章节提纲。';
  if(effectiveLeftover(review,source))suggestion+=' 先处理遗留项。';return suggestion;
}
function reviewCard(review){
  const source=reviewSource(review),point=review.knowledgePoint||source?.knowledgePoint||review.textContent||'复习任务',material=review.materialLocation||source?.materialLocation||'',mastery=review.mastery||source?.mastery||'unknown',leftover=effectiveLeftover(review,source),actions=review.actionTypes?.length?review.actionTypes:(source?.actionTypes||[]),actionTags=actions.map((type)=>ACTION_TYPE_LABELS[type]).filter(Boolean),wasCarried=Boolean(review.originalReviewDate&&review.originalReviewDate<review.reviewDate),status=review.completed?'已完成':review.abandoned?'已放弃':wasCarried?`由 ${review.originalReviewDate} 顺延`:review.reviewDate<currentDateKey()?'已过期':'';
  return `<article class="review-item ${review.completed?'done':''} ${review.abandoned?'abandoned':''}"><div class="review-topline"><span class="review-meta">${reviewIntervalLabel(review,source)} · 第 ${review.reviewNumber} 次 · ${review.reviewDate}${status?' · '+status:''}</span>${review.important||source?.important?'<span class="review-important">★ 重点</span>':''}</div><button class="review-title-button" data-review-detail="${review.id}">${escapeHtml(point)}</button><div class="review-tags">${actionTags.map((tag)=>`<span>${escapeHtml(tag)}</span>`).join('')}<span class="mastery-badge mastery-${mastery}">${MASTERY_LABELS[mastery]||'尚未判断'}</span></div>${material?`<div class="review-location">${escapeHtml(material)}</div>`:''}${review.textContent?`<div class="review-summary">${escapeHtml(review.textContent)}</div>`:''}${leftover?`<div class="review-leftover"><b>遗留</b><span>${escapeHtml(leftover)}</span></div>`:''}<div class="review-suggestion"><b>建议</b><span>${escapeHtml(reviewSuggestion(review,source))}</span></div><div class="review-actions"><button class="tool-btn primary" data-review-start="${review.id}" ${review.completed||review.abandoned?'disabled':''}>开始复习</button><button class="tool-btn" data-review-detail="${review.id}">查看详情</button><button class="tool-btn" data-review-complete="${review.id}">${review.completed?'恢复':'直接完成'}</button>${state.reviewFilter==='overdue'&&!wasCarried?`<button class="tool-btn" data-review-today="${review.id}">移到当天</button>`:''}<button class="tool-btn" data-review-delay="${review.id}">推迟</button><button class="tool-btn" data-review-abandon="${review.id}">${review.abandoned?'恢复':'放弃本次'}</button></div></article>`;
}
function renderReviews() {
  renderDate();const list=filteredReviews(),pending=list.filter((r)=>!r.completed&&!r.abandoned),weak=pending.filter((r)=>r.mastery==='weak').length,leftovers=pending.filter((r)=>r.leftover||state.events.find((event)=>event.id===r.sourceEventId)?.leftover).length;if(dom.reviewListSummary)dom.reviewListSummary.textContent=`${pending.length} 项${weak?` · ${weak} 薄弱`:''}${leftovers?` · ${leftovers} 遗留`:''}`;
  if(!list.length){const empty={today:'这一天没有待复习任务',overdue:'没有过期复习任务',all:'尚未生成复习任务'}[state.reviewFilter]||'当前没有待复习任务';dom.reviewList.innerHTML=`<div class="review-empty">${empty}</div>`;return;}
  const groups=new Map();list.forEach((review)=>{const source=state.events.find((event)=>event.id===review.sourceEventId),subject=subjectById(review.categoryId||source?.categoryId),key=subject?.id||review.categoryId||'other';if(!groups.has(key))groups.set(key,{name:subject?.name||(review.categoryName||source?.categoryName||'未分类').split('/')[0],color:subject?.color||'#6b7a72',items:[]});groups.get(key).items.push(review);});
  dom.reviewList.innerHTML=[...groups.values()].map((group)=>`<section class="review-group" style="--review-group-color:${group.color}"><div class="review-group-heading"><span class="review-group-name">${escapeHtml(group.name)}</span><span>${group.items.length} 项</span></div><div class="review-group-items">${group.items.map(reviewCard).join('')}</div></section>`).join('');
  dom.reviewList.querySelectorAll('[data-review-detail]').forEach((b)=>b.onclick=()=>openReviewDetail(b.dataset.reviewDetail));
  dom.reviewList.querySelectorAll('[data-review-start]').forEach((b)=>b.onclick=()=>startReview(b.dataset.reviewStart));
  dom.reviewList.querySelectorAll('[data-review-complete]').forEach((b)=>b.onclick=()=>toggleReview(b.dataset.reviewComplete));
  dom.reviewList.querySelectorAll('[data-review-today]').forEach((b)=>b.onclick=()=>moveReviewToToday(b.dataset.reviewToday));
  dom.reviewList.querySelectorAll('[data-review-delay]').forEach((b)=>b.onclick=()=>delayReview(b.dataset.reviewDelay));
  dom.reviewList.querySelectorAll('[data-review-abandon]').forEach((b)=>b.onclick=()=>abandonReview(b.dataset.reviewAbandon));
}
function reviewHistoryRow(review,currentId){
  const source=reviewSource(review),isOverdue=!review.completed&&!review.abandoned&&(review.originalReviewDate||review.reviewDate)<currentDateKey(),status=review.completed?'completed':review.abandoned?'abandoned':isOverdue?'overdue':'pending',icon={completed:'✓',abandoned:'×',overdue:'!',pending:'○'}[status],label={completed:'已完成',abandoned:'已放弃',overdue:'已顺延',pending:'待复习'}[status],result=review.resultSummary||(review.completed?'已标记完成':review.abandoned?'本次已放弃':'尚未记录复习结果'),duration=review.resultSeconds?` · ${durationLabel(review.resultSeconds)}`:'';
  return `<div class="review-history-item ${status} ${review.id===currentId?'current':''}"><span class="review-history-icon">${icon}</span><div><strong>第 ${review.reviewNumber} 次 · ${reviewIntervalLabel(review,source)}</strong><span>${review.reviewDate} · ${label}${duration}</span><p>${escapeHtml(result)}</p></div></div>`;
}
function openReviewDetail(id){state.selectedReviewId=id;renderReviewDetail();openModal('reviewDetailModal');}
function renderReviewDetail(){
  const review=state.reviews.find((item)=>item.id===state.selectedReviewId),source=reviewSource(review||{});if(!review||!source){closeModal('reviewDetailModal');return;}
  const subject=subjectById(source.categoryId),point=review.knowledgePoint||source.knowledgePoint||review.textContent||'复习任务',material=review.materialLocation||source.materialLocation||'未填写',mastery=review.mastery||source.mastery||'unknown',leftover=effectiveLeftover(review,source),actions=review.actionTypes?.length?review.actionTypes:(source.actionTypes||[]),history=state.reviews.filter((item)=>item.sourceEventId===review.sourceEventId).sort((a,b)=>a.reviewNumber-b.reviewNumber),cards=normalizeFlashcards(source.flashcards,source);
  dom.reviewDetailTitle.textContent=point;dom.reviewDetailBasic.innerHTML=`<div class="review-detail-hero" style="--detail-color:${subject?.color||source.color||'#6b7a72'}"><span>${escapeHtml(source.categoryName||subject?.name||'未分类')}</span><strong>${reviewIntervalLabel(review,source)} · 第 ${review.reviewNumber} 次复习</strong></div><div class="review-detail-facts"><div><span>安排日期</span><b>${review.reviewDate}</b></div><div><span>掌握程度</span><b>${MASTERY_LABELS[mastery]||'尚未判断'}</b></div><div><span>学习动作</span><b>${escapeHtml(actions.map((type)=>ACTION_TYPE_LABELS[type]).filter(Boolean).join(' / ')||'未标记')}</b></div><div><span>重点</span><b>${review.important||source.important?'是':'否'}</b></div></div><label class="review-start-point"><span>本次从哪里开始</span><input id="reviewStartPointInput" type="text" maxlength="100" value="${escapeHtml(suggestedReviewStart(review,source))}" placeholder="例如：讲义 P69" /></label>`;
  dom.reviewDetailLearning.innerHTML=`<div class="review-learning-title">${escapeHtml(point)}</div><dl><div><dt>资料定位</dt><dd>${escapeHtml(material)}</dd></div><div><dt>原始记录</dt><dd>${escapeHtml(review.textContent||source.textContent||'未填写')}</dd></div><div><dt>学习笔记</dt><dd>${escapeHtml(source.notes||'未填写')}</dd></div><div><dt>遗留内容</dt><dd class="${leftover?'has-leftover':''}">${escapeHtml(leftover||'无 / 已解决')}</dd></div><div><dt>闪卡提示</dt><dd>${escapeHtml(cards.map((card)=>card.question).join('；')||'暂无闪卡')}</dd></div><div><dt>本次建议</dt><dd>${escapeHtml(reviewSuggestion(review,source))}</dd></div></dl>`;
  dom.reviewDetailHistory.innerHTML=history.map((item)=>reviewHistoryRow(item,review.id)).join('');dom.reviewDetailStartBtn.disabled=review.completed||review.abandoned;dom.reviewDetailStartBtn.textContent=review.completed?'本次已完成':review.abandoned?'本次已放弃':'开始本次复习';
}
function startReview(id,startPoint=''){
  if(state.focus){window.alert('已有正在进行的计时，请先结束当前任务。');return;}
  const review=state.reviews.find((item)=>item.id===id),source=state.events.find((event)=>event.id===review?.sourceEventId);if(!review||!source)return;
  const subject=subjectById(source.categoryId);state.focus={categoryId:source.categoryId,categoryName:source.categoryName||subject?.name||'复习',color:subject?.color||source.color||state.settings.reviewColor,type:'countup',taskType:'review',durationSeconds:0,startedAt:Date.now(),reviewId:review.id,sourceEventId:source.id,reviewStartPoint:startPoint||suggestedReviewStart(review,source)};
  state.selectedReviewId=review.id;closeModal('reviewDetailModal');state.focusTicker=setInterval(tickFocus,250);renderFocusSubjects();renderFocus();enterImmersion();
}
function toggleReview(id){const r=state.reviews.find((x)=>x.id===id);if(!r)return;pushHistory();r.completed=!r.completed;r.abandoned=false;if(r.completed){r.completedAt=new Date().toISOString();r.resultSummary=r.resultSummary||'手动标记完成';}else{delete r.completedAt;if(r.resultSummary==='手动标记完成')delete r.resultSummary;}saveBackup();renderReviews();}
function abandonReview(id){const r=state.reviews.find((x)=>x.id===id);if(!r)return;pushHistory();r.abandoned=!r.abandoned;r.completed=false;if(r.abandoned)r.abandonedAt=new Date().toISOString();else delete r.abandonedAt;saveBackup();renderReviews();}
function moveReviewToToday(id){const r=state.reviews.find((x)=>x.id===id);if(!r)return;pushHistory();r.originalReviewDate=r.originalReviewDate||r.reviewDate;r.reviewDate=currentDateKey();r.completed=false;r.abandoned=false;saveBackup();renderReviews();}
function delayReview(id) {
  const r=state.reviews.find((x)=>x.id===id);if(!r)return;const value=window.prompt('推迟到哪一天？请输入 YYYY-MM-DD',dateKey(addDays(parseDate(r.reviewDate),1)));if(!value)return;
  const target=parseDate(value);if(Number.isNaN(target.getTime())){window.alert('日期格式无效。');return;}const delta=daysBetween(parseDate(r.reviewDate),target);if(delta<0&&!window.confirm('目标日期早于当前安排，仍要调整吗？'))return;
  pushHistory();state.reviews.filter((x)=>x.sourceEventId===r.sourceEventId&&x.reviewNumber>=r.reviewNumber).forEach((x)=>x.reviewDate=dateKey(addDays(parseDate(x.reviewDate),delta)));saveBackup();renderReviews();
}

function openCalendar(){state.calendarMonth=startOfMonth(state.currentDate);renderCalendar();openModal('calendarModal');}
function renderCalendar() {
  const month=state.calendarMonth,year=month.getFullYear(),m=month.getMonth(),firstWeekday=(month.getDay()+6)%7,days=new Date(year,m+1,0).getDate();
  dom.calendarTitle.textContent=`${year} 年 ${m+1} 月`;const cells=['一','二','三','四','五','六','日'].map((d)=>`<div class="calendar-weekday">周${d}</div>`);
  for(let i=0;i<42;i+=1){const day=i-firstWeekday+1,date=new Date(year,m,day),key=dateKey(date),outside=date.getMonth()!==m;
    const records=state.events.filter((e)=>e.date===key&&e.halfZone==='record'),minutes=records.reduce((sum,e)=>sum+e.endSlot-e.startSlot,0),reviews=state.reviews.filter((r)=>r.reviewDate===key&&!r.completed&&!r.abandoned).length;
    cells.push(`<button class="calendar-day ${outside?'outside':''} ${key===dateKey(new Date())?'today':''}" data-calendar-date="${key}"><span class="calendar-day-number">${date.getDate()}</span><div class="calendar-day-summary">${minutes?durationLabel(minutes*60):''}${reviews?` · ${reviews}待复习`:''}</div>${records.slice(0,3).map((e)=>`<div class="calendar-event" style="--calendar-event-color:${subjectById(e.categoryId)?.color||e.color||'#aeb5ae'}">${escapeHtml(e.knowledgePoint||e.textContent||e.categoryName)}</div>`).join('')}</button>`);
  }dom.monthCalendar.innerHTML=cells.join('');dom.monthCalendar.querySelectorAll('[data-calendar-date]').forEach((b)=>b.onclick=()=>{state.currentDate=startOfDay(parseDate(b.dataset.calendarDate));closeModal('calendarModal');saveBackup();renderAll();});
}

function openSettings(){syncSettingsToUI();openModal('settingsModal');}
function syncSettingsToUI() {
  const s=state.settings;
  dom.settingStartHour.value=s.startHour;dom.settingHourHeight.value=s.hourHeight;dom.settingPlanRatio.value=Math.round(s.planRatio*100);
  dom.settingDefaultZone.value=s.defaultSelectionZone;dom.settingMinuteInterval.value=s.minuteInterval;dom.settingEventPlacement.value=s.eventPlacement;
  dom.settingDotSize.value=s.dotSize;dom.settingDotOpacity.value=s.dotOpacity;dom.settingArrowWidth.value=s.arrowWidth;dom.settingArrowSize.value=s.arrowSize;dom.settingCompactToolbar.checked=s.compactToolbar;dom.settingShowDots.checked=s.showDots;dom.settingDividerDrag.checked=s.dividerDrag;
  dom.settingHiddenHours.value=s.hiddenHours||'';dom.settingReviewPreset.value=s.reviewPreset;dom.settingReviewIntervals.value=s.reviewIntervals.join(',');
  dom.settingReviewColor.value=s.reviewColor;dom.settingReviewOpacity.value=s.reviewOpacity;dom.settingShortcut.value=s.shortcut;
  dom.settingCountdownName.value=s.countdownName||'';dom.settingCountdownDate.value=s.countdownDate||'';dom.settingImmersionTheme.value=s.immersionTheme;
  dom.settingImmersionOpacity.value=s.immersionOpacity;dom.settingCountdownSize.value=s.countdownSize;dom.settingCountdownPosition.value=s.countdownPosition;dom.settingImmersionBackground.value=s.immersionBackground?.startsWith('data:')?'':(s.immersionBackground||'');dom.localBackgroundStatus.textContent=s.immersionBackground?(s.immersionBackground.startsWith('data:')?'已保存本地图片':'已设置网络图片'):'尚未设置图片';dom.settingShowCountdown.checked=s.showCountdown;dom.settingShowQuote.checked=s.showQuote;
  dom.settingSoundType.value=s.soundType;dom.settingSoundDuration.value=s.soundDuration;dom.settingSoundVolume.value=s.soundVolume;dom.settingSoundEnabled.checked=s.soundEnabled;dom.settingNotificationsEnabled.checked=s.notificationsEnabled;
}
function updateSettings() {
  const s=state.settings;
  s.startHour=clamp(Number(dom.settingStartHour.value),0,23);s.hourHeight=clamp(Number(dom.settingHourHeight.value),38,100);s.planRatio=clamp(Number(dom.settingPlanRatio.value),25,75)/100;
  s.defaultSelectionZone=dom.settingDefaultZone.value;s.minuteInterval=Number(dom.settingMinuteInterval.value)||5;s.eventPlacement=dom.settingEventPlacement.value;
  s.dotSize=Number(dom.settingDotSize.value);s.dotOpacity=Number(dom.settingDotOpacity.value);s.arrowWidth=Number(dom.settingArrowWidth.value);s.arrowSize=Number(dom.settingArrowSize.value);s.compactToolbar=dom.settingCompactToolbar.checked;s.showDots=dom.settingShowDots.checked;s.dividerDrag=dom.settingDividerDrag.checked;
  s.hiddenHours=dom.settingHiddenHours.value;s.reviewIntervals=parseIntervals(dom.settingReviewIntervals.value);s.reviewColor=dom.settingReviewColor.value;s.reviewOpacity=Number(dom.settingReviewOpacity.value);
  s.shortcut=dom.settingShortcut.value.trim()||'Ctrl+Enter';s.countdownName=dom.settingCountdownName.value.trim();s.countdownDate=dom.settingCountdownDate.value;
  s.immersionTheme=dom.settingImmersionTheme.value;s.immersionOpacity=Number(dom.settingImmersionOpacity.value);s.countdownSize=Number(dom.settingCountdownSize.value);s.countdownPosition=dom.settingCountdownPosition.value;if(dom.settingImmersionBackground.value.trim())s.immersionBackground=dom.settingImmersionBackground.value.trim();s.showCountdown=dom.settingShowCountdown.checked;s.showQuote=dom.settingShowQuote.checked;
  s.soundType=dom.settingSoundType.value;s.soundDuration=clamp(Number(dom.settingSoundDuration.value)||1.5,.5,10);s.soundVolume=clamp(Number(dom.settingSoundVolume.value),0,1);s.soundEnabled=dom.settingSoundEnabled.checked;s.notificationsEnabled=dom.settingNotificationsEnabled.checked;
  saveBackup();applyLayoutSettings();renderTimeline();applyImmersionSettings();
}
function parseIntervals(value){const items=String(value).split(',').map(Number).filter((n)=>Number.isInteger(n)&&n>0&&n<=3650);return [...new Set(items)].sort((a,b)=>a-b).slice(0,20).length?[...new Set(items)].sort((a,b)=>a-b).slice(0,20):[1,3,7,14,30];}
function applyReviewPreset() {
  const preset=dom.settingReviewPreset.value;state.settings.reviewPreset=preset;
  if(preset==='common')dom.settingReviewIntervals.value='1,3,7,14,30';
  if(preset==='ebbinghaus')dom.settingReviewIntervals.value='1,2,4,7,15,30';
  updateSettings();
}
function applyCompactTimelinePreset(){state.settings.hiddenHours='0-7,22-24';state.settings.startHour=7;state.settings.hourHeight=38;syncSettingsToUI();saveBackup();renderTimeline();}
function importImmersionBackground(){const file=dom.settingLocalBackground.files?.[0];if(!file)return;if(file.size>4*1024*1024){window.alert('图片请控制在 4MB 以内，以免浏览器本地存储空间不足。');dom.settingLocalBackground.value='';return;}const reader=new FileReader();reader.onload=()=>{state.settings.immersionBackground=String(reader.result);state.settings.immersionTheme='custom';saveBackup();syncSettingsToUI();applyImmersionSettings();};reader.readAsDataURL(file);dom.settingLocalBackground.value='';}
function clearImmersionBackground(){state.settings.immersionBackground='';if(state.settings.immersionTheme==='custom')state.settings.immersionTheme='plain';saveBackup();syncSettingsToUI();applyImmersionSettings();}
function unlockAudio(){try{state.audioContext=state.audioContext||new (window.AudioContext||window.webkitAudioContext)();if(state.audioContext.state==='suspended')state.audioContext.resume();}catch(_){}}
function playReminderSound(){if(!state.settings.soundEnabled)return;unlockAudio();const audio=state.audioContext;if(!audio)return;const now=audio.currentTime,volume=clamp(Number(state.settings.soundVolume),0,1),duration=clamp(Number(state.settings.soundDuration)||1.5,.5,10),type=state.settings.soundType||'cheer',patterns={cheer:[523,659,784,1047,784,1047],chime:[659,880,1047],bell:[784,784,988]}[type]||[523,659,784];const step=Math.max(.12,duration/patterns.length);patterns.forEach((frequency,index)=>{const start=now+index*step,osc=audio.createOscillator(),gain=audio.createGain();osc.type=type==='bell'?'sine':type==='chime'?'triangle':'square';osc.frequency.setValueAtTime(frequency,start);gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(volume*.15,start+.025);gain.gain.exponentialRampToValueAtTime(.0001,Math.min(now+duration,start+step*.92));osc.connect(gain);gain.connect(audio.destination);osc.start(start);osc.stop(Math.min(now+duration+.03,start+step));});}
async function requestNotifications(){if(!('Notification'in window)){window.alert('当前浏览器不支持系统通知。');return;}const permission=await Notification.requestPermission();state.settings.notificationsEnabled=permission==='granted';dom.settingNotificationsEnabled.checked=state.settings.notificationsEnabled;saveBackup();if(permission==='granted')showSystemNotification('通知已启用','计划开始与倒计时结束时会收到系统提醒。',true);else window.alert('通知未获授权，可在浏览器网站权限中重新开启。');}
function showSystemNotification(title,body,force=false){if(!('Notification'in window)||Notification.permission!=='granted'||(!force&&!state.settings.notificationsEnabled))return;try{new Notification(title,{body,icon:'icon.svg',tag:`learning-tool-${title}`});}catch(_){}}
async function installApp(){const prompt=state.installPrompt;if(!prompt){window.alert(location.protocol==='file:'?'请先通过本地服务器或 HTTPS 打开网页，再用 Edge 的“应用 → 安装此站点”安装。':'当前浏览器尚未提供安装入口，可使用浏览器菜单中的“安装此应用”。');return;}await prompt.prompt();state.installPrompt=null;dom.installAppBtn.classList.add('hidden');}
function clearEvents(){if(!state.events.length||!window.confirm('确认清空全部事件与复习任务？'))return;pushHistory();state.events=[];state.reviews=[];closePlanReminder();saveBackup();closeModal('settingsModal');renderAll();}

function focusEvents(){return state.events.filter((e)=>e.taskType==='focus'||Number.isFinite(e.focusSeconds));}
function focusSeconds(event){return Number(event.focusSeconds)||Math.max(60,(event.endSlot-event.startSlot)*60);}
function openStats() {
  state.statsSubjects=new Set(flattenSubjectOptions().map((s)=>s.id));renderStatsFilters();openModal('statsModal');renderStats();
}
function flattenSubjectOptions() {
  const result=[];state.categories.forEach((root)=>{result.push({id:root.id,name:root.name,color:root.color,depth:0});(root.children||[]).forEach((second)=>{result.push({id:second.id,name:`${root.name} / ${second.name}`,color:root.color,depth:1});(second.children||[]).forEach((third)=>result.push({id:third.id,name:`${root.name} / ${second.name} / ${third.name}`,color:root.color,depth:2}));});});return result;
}
function renderStatsFilters() {
  dom.statsSubjectFilters.innerHTML=flattenSubjectOptions().map((s)=>`<label class="subject-filter depth-${s.depth}"><input type="checkbox" value="${s.id}" ${state.statsSubjects.has(s.id)?'checked':''}/><span class="subject-dot" style="--subject-color:${s.color}"></span>${escapeHtml(s.name)}</label>`).join('');
  dom.statsSubjectFilters.querySelectorAll('input').forEach((input)=>input.onchange=()=>{if(input.checked)state.statsSubjects.add(input.value);else state.statsSubjects.delete(input.value);renderStats();});
}
function renderStats() {
  const all=focusEvents().filter((e)=>(e.subjectPath?.length?e.subjectPath:[e.categoryId]).some((id)=>state.statsSubjects.has(id))),todayKey=dateKey(new Date()),today=all.filter((e)=>e.date===todayKey);
  const totalSeconds=all.reduce((sum,e)=>sum+focusSeconds(e),0),activeDays=new Set(all.map((e)=>e.date)).size||1;
  dom.statTotalCount.textContent=all.length;dom.statTotalTime.textContent=durationLabel(totalSeconds);dom.statDailyAverage.textContent=durationLabel(totalSeconds/activeDays);
  dom.statTodayCount.textContent=today.length;dom.statTodayTime.textContent=durationLabel(today.reduce((sum,e)=>sum+focusSeconds(e),0));
  drawDistributionChart(filterStatsRange(all,dom.statsRange.value));drawMonthlyChart(all);drawYearlyChart(all);
  Object.entries(state.statVisibility).forEach(([key,visible])=>document.querySelector(`[data-stat-section="${key}"]`)?.classList.toggle('stat-hidden',!visible));
}
function filterStatsRange(events,range) {
  const today=startOfDay(new Date());
  if(range==='day')return events.filter((e)=>e.date===dateKey(today));
  if(range==='week'){const monday=addDays(today,-((today.getDay()+6)%7));return events.filter((e)=>{const d=parseDate(e.date);return d>=monday&&d<addDays(monday,7);});}
  if(range==='month')return events.filter((e)=>{const d=parseDate(e.date);return d.getFullYear()===today.getFullYear()&&d.getMonth()===today.getMonth();});
  return events.filter((e)=>parseDate(e.date).getFullYear()===today.getFullYear());
}
function toggleStat(key){state.statVisibility[key]=!state.statVisibility[key];renderStats();}
function prepareChart(canvasEl) {
  const dpr=window.devicePixelRatio||1,rect=canvasEl.getBoundingClientRect(),width=Math.max(320,rect.width||canvasEl.width),height=Math.max(180,rect.height||canvasEl.height);
  canvasEl.width=Math.round(width*dpr);canvasEl.height=Math.round(height*dpr);const c=canvasEl.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,width,height);return{c,width,height};
}
function drawDistributionChart(events) {
  const {c,width,height}=prepareChart(dom.distributionChart),totals=state.categories.map((s)=>({s,value:events.filter((e)=>e.categoryId===s.id).reduce((sum,e)=>sum+focusSeconds(e),0)})).filter((x)=>x.value>0);
  if(!totals.length){drawEmptyChart(c,width,height);return;}const max=Math.max(...totals.map((x)=>x.value));c.font='11px "Segoe UI"';
  totals.forEach((item,i)=>{const y=28+i*Math.min(36,(height-40)/totals.length),barWidth=(width-150)*item.value/max;c.fillStyle='#737a73';c.fillText(item.s.name,12,y+7);c.fillStyle=rgba(item.s.color,.82);roundRect(c,86,y-5,barWidth,17,6);c.fill();c.fillStyle='#555';c.fillText(durationLabel(item.value),94+barWidth,y+7);});
}
function drawMonthlyChart(events) {
  const now=new Date(),days=new Date(now.getFullYear(),now.getMonth()+1,0).getDate(),values=Array.from({length:days},(_,i)=>events.filter((e)=>e.date===dateKey(new Date(now.getFullYear(),now.getMonth(),i+1))).reduce((s,e)=>s+focusSeconds(e)/60,0));
  drawLineChart(dom.monthlyChart,values,values.map((_,i)=>String(i+1)),5);
}
function drawYearlyChart(events) {
  const year=new Date().getFullYear(),values=Array.from({length:12},(_,i)=>events.filter((e)=>parseDate(e.date).getFullYear()===year&&parseDate(e.date).getMonth()===i).reduce((s,e)=>s+focusSeconds(e)/3600,0));
  drawLineChart(dom.yearlyChart,values,values.map((_,i)=>`${i+1}月`),1);
}
function drawLineChart(canvasEl,values,labels,labelEvery) {
  const {c,width,height}=prepareChart(canvasEl),padX=34,padY=24,w=width-padX-12,h=height-padY-30,max=Math.max(1,...values);
  c.strokeStyle='#e4e7e2';c.lineWidth=1;for(let i=0;i<=4;i++){const y=padY+h*i/4;c.beginPath();c.moveTo(padX,y);c.lineTo(width-10,y);c.stroke();}
  c.strokeStyle='#2f6b4f';c.lineWidth=2;c.beginPath();values.forEach((value,i)=>{const x=padX+(values.length===1?0:i/(values.length-1))*w,y=padY+h-value/max*h;if(i)c.lineTo(x,y);else c.moveTo(x,y);});c.stroke();
  c.fillStyle='#2f6b4f';values.forEach((value,i)=>{const x=padX+(values.length===1?0:i/(values.length-1))*w,y=padY+h-value/max*h;c.beginPath();c.arc(x,y,2.5,0,Math.PI*2);c.fill();});
  c.fillStyle='#838982';c.font='9px "Segoe UI"';c.textAlign='center';labels.forEach((label,i)=>{if(i%labelEvery===0){const x=padX+(labels.length===1?0:i/(labels.length-1))*w;c.fillText(label,x,height-8);}});
}
function drawEmptyChart(c,width,height){c.fillStyle='#9aa09a';c.font='12px "Segoe UI"';c.textAlign='center';c.fillText('暂无专注记录',width/2,height/2);}

function refreshCategoryUI(){migrateCategories();syncCategoryOptions();renderFocusSubjects();if(!state.selectedSubjectId)state.selectedSubjectId=state.categories[0]?.id||null;}
function migrateCategories() {
  state.categories=state.categories.map((item)=>({...newSubject(item.name||'未命名',item.color||'#6b7a72'),...item,children:(item.children||[]).map((child)=>({...child,id:child.id||uid('level2'),reviewEnabled:child.reviewEnabled!==false,children:(child.children||[]).map((topic)=>({...topic,id:topic.id||uid('level3'),reviewEnabled:topic.reviewEnabled!==false}))}))}));
}
function openSubjects(){refreshCategoryUI();renderSubjects();openModal('subjectsModal');}
function renderSubjects() {
  dom.subjectsList.innerHTML=state.categories.map((s)=>`<button class="subject-list-item ${s.id===state.selectedSubjectId?'active':''}" data-subject-id="${s.id}"><span class="subject-dot" style="--subject-color:${s.color}"></span>${escapeHtml(s.name)}</button>`).join('');
  dom.subjectsList.querySelectorAll('[data-subject-id]').forEach((b)=>b.onclick=()=>{state.selectedSubjectId=b.dataset.subjectId;renderSubjects();});
  renderSubjectDetail();
}
function renderSubjectDetail() {
  const s=subjectById(state.selectedSubjectId);if(!s){dom.subjectDetail.innerHTML='<div class="review-empty">请添加学科</div>';return;}
  const events=state.events.filter((e)=>e.categoryId===s.id&&e.halfZone==='record'),focus=events.filter((e)=>e.taskType==='focus'||e.focusSeconds),today=new Date(),monthDays=new Date(today.getFullYear(),today.getMonth()+1,0).getDate();
  const durations=new Map();focus.forEach((e)=>durations.set(e.date,(durations.get(e.date)||0)+focusSeconds(e)));const streak=calculateStreak([...durations.keys()]),maxStreak=calculateMaxStreak([...durations.keys()]);
  const mini=Array.from({length:monthDays},(_,i)=>{const key=dateKey(new Date(today.getFullYear(),today.getMonth(),i+1)),seconds=durations.get(key)||0,alpha=seconds?clamp(.2+seconds/7200,.25,1):0;return`<div class="mini-day-cell"><div class="mini-day" style="${seconds?`border-color:${s.color};background:${rgba(s.color,alpha)};color:#fff`:''}">${i+1}</div><small>${seconds?durationLabel(seconds):'　'}</small></div>`;}).join('');
  const hierarchy=(s.children||[]).map((l2)=>`<div class="hierarchy-row" data-level2="${l2.id}"><input class="level2-name" value="${escapeHtml(l2.name)}"><button class="tool-btn" data-add-level3="${l2.id}">+ 三级</button><label><input class="level2-review" type="checkbox" ${l2.reviewEnabled!==false?'checked':''}>复习</label><button class="tool-btn" data-delete-level2="${l2.id}">删</button></div>${(l2.children||[]).map((l3)=>`<div class="hierarchy-row level3" data-level2="${l2.id}" data-level3="${l3.id}"><span>↳</span><input class="level3-name" value="${escapeHtml(l3.name)}"><label><input class="level3-review" type="checkbox" ${l3.reviewEnabled!==false?'checked':''}>复习</label><button class="tool-btn" data-delete-level3="${l3.id}">删</button></div>`).join('')}`).join('');
  const heat=buildYearHeatmap(s,focus),records=events.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,80).map((e)=>`<button class="subject-record" data-subject-event="${e.id}"><strong>${e.date} · ${slotLabel(e.startSlot)}–${slotLabel(e.endSlot)}</strong><br>${escapeHtml(e.knowledgePoint||e.textContent||e.categoryName)}</button>`).join('')||'<div class="review-empty">暂无记录</div>';
  dom.subjectDetail.innerHTML=`<div class="subject-detail-grid">
    <section class="subject-section wide"><div class="section-heading"><h4>基本设置</h4><button id="deleteSubjectBtn" class="tool-btn danger">删除学科</button></div><div class="subject-style-grid">
      <label>名称<input id="subjectNameInput" value="${escapeHtml(s.name)}"></label><label>颜色<input id="subjectColorInput" type="color" value="${s.color}"></label><label>文字大小<input id="subjectTextSize" type="number" min="10" max="24" value="${s.textSize}"></label>
      <label>文字透明度<input id="subjectTextOpacity" type="range" min=".1" max="1" step=".05" value="${s.textOpacity}"></label><label><input id="subjectBold" type="checkbox" ${s.bold?'checked':''}> 默认加粗</label><label><input id="subjectItalic" type="checkbox" ${s.italic?'checked':''}> 默认斜体</label>
      <label><input id="subjectReviewEnabled" type="checkbox" ${s.reviewEnabled!==false?'checked':''}> 默认生成复习任务</label></div></section>
    <section class="subject-section"><h4>本月专注日历</h4><div class="mini-calendar">${mini}</div></section>
    <section class="subject-section"><h4>打卡统计</h4><div class="subject-metrics"><div class="subject-metric"><strong>${streak}</strong><span>当前连续</span></div><div class="subject-metric"><strong>${maxStreak}</strong><span>最高连续</span></div><div class="subject-metric"><strong>${durationLabel([...durations.values()].reduce((a,b)=>a+b,0))}</strong><span>累计专注</span></div></div><p class="settings-note">创建于 ${new Date(s.createdAt).toLocaleDateString()}</p></section>
    <section class="subject-section wide"><div class="section-heading"><h4>二级 / 三级科目</h4><button id="addLevel2Btn" class="tool-btn">添加二级科目</button></div>${hierarchy||'<p class="settings-note">尚未添加子科目</p>'}</section>
    <section class="subject-section wide"><h4>年度专注热力图</h4><div class="year-heatmap">${heat}</div></section>
    <section class="subject-section wide"><h4>记录事件</h4><div class="subject-records">${records}</div></section>
  </div>`;
  bindSubjectDetailEvents(s);
}
function bindSubjectDetailEvents(subject) {
  const update=()=>{subject.name=document.getElementById('subjectNameInput').value.trim()||'未命名';subject.color=document.getElementById('subjectColorInput').value;subject.textSize=Number(document.getElementById('subjectTextSize').value);subject.textOpacity=Number(document.getElementById('subjectTextOpacity').value);subject.bold=document.getElementById('subjectBold').checked;subject.italic=document.getElementById('subjectItalic').checked;subject.reviewEnabled=document.getElementById('subjectReviewEnabled').checked;saveBackup();renderFocusSubjects();renderTimeline();};
  ['subjectNameInput','subjectColorInput','subjectTextSize','subjectTextOpacity','subjectBold','subjectItalic','subjectReviewEnabled'].forEach((id)=>document.getElementById(id).addEventListener('input',update));
  document.getElementById('deleteSubjectBtn').onclick=()=>deleteCategory(subject.id);
  document.getElementById('addLevel2Btn').onclick=()=>{const name=window.prompt('二级科目名称');if(!name)return;subject.children.push({id:uid('level2'),name,reviewEnabled:true,children:[]});saveBackup();renderSubjects();};
  dom.subjectDetail.querySelectorAll('[data-subject-event]').forEach((button)=>button.onclick=()=>{closeModal('subjectsModal');openEventDetail(button.dataset.subjectEvent);});
  dom.subjectDetail.querySelectorAll('[data-level2]').forEach((row)=>row.querySelectorAll('input').forEach((input)=>input.oninput=()=>updateHierarchyRow(subject,row)));
  dom.subjectDetail.querySelectorAll('[data-add-level3]').forEach((button)=>button.onclick=()=>{const level=subject.children.find((x)=>x.id===button.dataset.addLevel3),name=window.prompt('三级科目名称');if(!level||!name)return;level.children.push({id:uid('level3'),name,reviewEnabled:true});saveBackup();renderSubjects();});
  dom.subjectDetail.querySelectorAll('[data-delete-level2]').forEach((button)=>button.onclick=()=>{subject.children=subject.children.filter((x)=>x.id!==button.dataset.deleteLevel2);saveBackup();renderSubjects();});
  dom.subjectDetail.querySelectorAll('[data-delete-level3]').forEach((button)=>button.onclick=()=>{subject.children.forEach((x)=>x.children=x.children.filter((t)=>t.id!==button.dataset.deleteLevel3));saveBackup();renderSubjects();});
}
function updateHierarchyRow(subject,row){const l2=subject.children.find((x)=>x.id===row.dataset.level2);if(!l2)return;if(row.dataset.level3){const l3=l2.children.find((x)=>x.id===row.dataset.level3);l3.name=row.querySelector('.level3-name').value.trim()||'未命名';l3.reviewEnabled=row.querySelector('.level3-review').checked;}else{l2.name=row.querySelector('.level2-name').value.trim()||'未命名';l2.reviewEnabled=row.querySelector('.level2-review').checked;}saveBackup();}
function addCategory(){const name=window.prompt('学科名称','新学科');if(!name)return;pushHistory();const s=newSubject(name,'#6b7a72');state.categories.push(s);state.selectedSubjectId=s.id;saveBackup();refreshCategoryUI();renderSubjects();}
function deleteCategory(id){const s=subjectById(id);if(!s||state.categories.length<=1){window.alert('至少保留一个学科。');return;}if(!window.confirm(`删除学科“${s.name}”？已有记录会保留。`))return;pushHistory();state.categories=state.categories.filter((x)=>x.id!==id);state.selectedSubjectId=state.categories[0]?.id||null;saveBackup();refreshCategoryUI();renderSubjects();}
function buildYearHeatmap(subject,events){const year=new Date().getFullYear(),map=new Map();events.forEach((e)=>map.set(e.date,(map.get(e.date)||0)+focusSeconds(e)));let html='';for(let m=0;m<12;m++){let days='';for(let d=1;d<=31;d++){const date=new Date(year,m,d);if(date.getMonth()!==m){days+='<span></span>';continue;}const seconds=map.get(dateKey(date))||0,alpha=seconds?clamp(.15+seconds/7200,.18,1):0;days+=`<span class="heat-dot" title="${m+1}月${d}日 ${durationLabel(seconds)}" style="${seconds?`background:${rgba(subject.color,alpha)}`:''}"></span>`;}html+=`<div class="heat-month"><strong>${m+1}月</strong><div class="heat-month-days">${days}</div></div>`;}return html;}
function calculateStreak(keys){const set=new Set(keys),today=startOfDay(new Date());let count=0,date=today;if(!set.has(dateKey(date)))date=addDays(date,-1);while(set.has(dateKey(date))){count+=1;date=addDays(date,-1);}return count;}
function calculateMaxStreak(keys){const sorted=[...new Set(keys)].sort();let max=0,current=0,prev=null;sorted.forEach((key)=>{const d=parseDate(key);current=prev&&daysBetween(prev,d)===1?current+1:1;max=Math.max(max,current);prev=d;});return max;}

function renderFocusSubjects(){dom.focusSubjects.innerHTML=state.categories.map((s)=>`<button class="subject-btn" style="--subject-color:${s.color}" data-focus-subject="${s.id}" ${state.focus?'disabled':''}>${escapeHtml(s.name)}</button>`).join('');dom.focusSubjects.querySelectorAll('[data-focus-subject]').forEach((b)=>b.onclick=()=>startFocus(b.dataset.focusSubject));}
function updateFocusDurationUI(){const countdown=dom.focusTimerType.value==='countdown';dom.focusDurationWrap.classList.toggle('hidden',!countdown);dom.focusCustomDurationWrap.classList.toggle('hidden',!countdown||dom.focusDuration.value!=='custom');}
function startFocus(categoryId) {
  if(state.focus)return;const s=subjectById(categoryId);if(!s)return;const type=dom.focusTimerType.value,duration=type==='countdown'?(dom.focusDuration.value==='custom'?clamp(Number(dom.focusCustomDuration.value)||1,1,600):Number(dom.focusDuration.value))*60:0;
  state.focus={categoryId,categoryName:s.name,color:s.color,type,taskType:dom.focusTaskType.value,durationSeconds:duration,startedAt:Date.now()};state.focusTicker=setInterval(tickFocus,250);renderFocusSubjects();renderFocus();enterImmersion();
}
function tickFocus(){if(!state.focus)return;if(state.focus.type==='countdown'&&Date.now()-state.focus.startedAt>=state.focus.durationSeconds*1000){finishFocus(true);return;}renderFocus();}
function renderFocus() {
  if(!state.focus){dom.focusClock.textContent='00:00:00';dom.focusSubjectLabel.textContent='选择一个学科即可开始';dom.focusLiveNote.classList.add('hidden');dom.focusLiveNote.value='';dom.immersionLiveNote.value='';dom.focusStatus.textContent='未开始';dom.focusStatus.classList.remove('running');dom.stopFocusBtn.classList.add('hidden');dom.enterImmersionBtn.classList.add('hidden');dom.immersionReviewCard.classList.add('hidden');dom.immersionContent.classList.remove('review-session');return;}
  const elapsed=Math.max(0,Math.floor((Date.now()-state.focus.startedAt)/1000)),shown=state.focus.type==='countdown'?Math.max(0,state.focus.durationSeconds-elapsed):elapsed;
  dom.focusClock.textContent=clockLabel(shown);dom.focusSubjectLabel.textContent=`${state.focus.categoryName} · ${state.focus.taskType==='review'?'复习':'学习'} · ${state.focus.type==='countdown'?'倒计时':'正计时'}`;dom.focusStatus.textContent='专注中';dom.focusStatus.classList.add('running');dom.stopFocusBtn.classList.remove('hidden');dom.enterImmersionBtn.classList.remove('hidden');
  dom.focusLiveNote.classList.remove('hidden');if(document.activeElement!==dom.focusLiveNote)dom.focusLiveNote.value=state.focus.liveNotes||'';if(document.activeElement!==dom.immersionLiveNote)dom.immersionLiveNote.value=state.focus.liveNotes||'';
  dom.immersionClock.textContent=clockLabel(shown);dom.immersionSubject.textContent=state.focus.categoryName;dom.immersionMode.textContent=`${state.focus.taskType==='review'?'复习':'学习'} · ${state.focus.type==='countdown'?'倒计时':'正计时'}`;renderImmersionReviewContext();renderImmersionExtras();
}
function updateFocusLiveNote(value){if(!state.focus)return;state.focus.liveNotes=value;if(document.activeElement!==dom.focusLiveNote)dom.focusLiveNote.value=value;if(document.activeElement!==dom.immersionLiveNote)dom.immersionLiveNote.value=value;}
function renderImmersionReviewContext(){
  const review=state.focus?.reviewId?state.reviews.find((item)=>item.id===state.focus.reviewId):null,source=reviewSource(review||{}),plan=state.focus?.planEventId?state.events.find((item)=>item.id===state.focus.planEventId):null;if(!review&&!plan){dom.immersionReviewCard.classList.add('hidden');dom.immersionContent.classList.remove('review-session');delete dom.immersionReviewCard.dataset.contextId;return;}
  dom.immersionContent.classList.add('review-session');dom.immersionReviewCard.classList.remove('hidden');const contextId=review?`review_${review.id}`:`plan_${plan.id}`;if(dom.immersionReviewCard.dataset.contextId===contextId)return;dom.immersionReviewCard.dataset.contextId=contextId;
  if(plan){const point=plan.knowledgePoint||plan.textContent||'学习任务',actions=(plan.actionTypes||[]).map((type)=>ACTION_TYPE_LABELS[type]).filter(Boolean),material=plan.materialLocation||'',leftover=plan.leftover||'';dom.immersionReviewCard.innerHTML=`<div class="immersion-review-top"><span>学习计划 · ${slotLabel(plan.startSlot)} - ${slotLabel(plan.endSlot)}</span><span>计时已开始</span></div><h3>${escapeHtml(point)}</h3><div class="immersion-review-tags">${actions.map((item)=>`<span>${escapeHtml(item)}</span>`).join('')}${material?`<span>${escapeHtml(material)}</span>`:''}</div>${leftover?`<div class="immersion-review-leftover"><b>计划遗留</b>${escapeHtml(leftover)}</div>`:''}<div class="immersion-review-advice"><b>计划说明</b>${escapeHtml(plan.textContent||'专注完成当前计划，结束后补充学习结果。')}</div>`;return;}
  const point=review.knowledgePoint||source.knowledgePoint||review.textContent||'复习任务',material=review.materialLocation||source.materialLocation||'',mastery=review.mastery||source.mastery||'unknown',leftover=review.leftover||source.leftover||'',history=state.reviews.filter((item)=>item.sourceEventId===review.sourceEventId),finished=history.filter((item)=>item.completed).length;
  dom.immersionReviewCard.innerHTML=`<div class="immersion-review-top"><span>${reviewIntervalLabel(review,source)} · 第 ${review.reviewNumber} 次</span><span>${finished}/${history.length} 已完成</span></div><h3>${escapeHtml(point)}</h3><div class="immersion-review-tags"><span>${MASTERY_LABELS[mastery]||'尚未判断'}</span>${material?`<span>${escapeHtml(material)}</span>`:''}</div>${leftover?`<div class="immersion-review-leftover"><b>遗留</b>${escapeHtml(leftover)}</div>`:''}<div class="immersion-review-advice"><b>本次复习建议</b>${escapeHtml(reviewSuggestion(review,source))}</div>`;
}
function applyImmersionSettings(){const s=state.settings;dom.immersionBackdrop.className=`immersion-backdrop theme-${s.immersionTheme}`;dom.immersionBackdrop.style.setProperty('--immersion-opacity',s.immersionOpacity);dom.immersionOverlay.style.setProperty('--immersion-opacity',s.immersionOpacity);dom.immersionBackdrop.style.backgroundImage=s.immersionTheme==='custom'&&s.immersionBackground?`url("${String(s.immersionBackground).replaceAll('\\','\\\\').replaceAll('"','\\"')}")`:'';dom.immersionCountdown.style.setProperty('--countdown-size',`${clamp(Number(s.countdownSize)||30,18,64)}px`);dom.immersionCountdown.classList.remove('position-top','position-bottom');if(s.countdownPosition==='top')dom.immersionCountdown.classList.add('position-top');if(s.countdownPosition==='bottom')dom.immersionCountdown.classList.add('position-bottom');renderImmersionExtras();}
function renderImmersionExtras() {
  const s=state.settings;if(s.showCountdown&&s.countdownDate){const days=Math.ceil((parseDate(s.countdownDate)-startOfDay(new Date()))/86400000);dom.immersionCountdown.textContent=`${s.countdownName||'倒数日'} · ${days>=0?days+' 天':Math.abs(days)+' 天前'}`;dom.immersionCountdown.classList.remove('hidden');}else dom.immersionCountdown.classList.add('hidden');
  if(s.showQuote){if(!dom.immersionQuote.textContent)dom.immersionQuote.textContent=QUOTES[Math.floor(Math.random()*QUOTES.length)];dom.immersionQuote.classList.remove('hidden');}else dom.immersionQuote.classList.add('hidden');
}
function enterImmersion(){if(!state.focus)return;applyImmersionSettings();dom.immersionOverlay.classList.remove('hidden');}
function exitImmersion(){dom.immersionOverlay.classList.add('hidden');}
function finishFocus(automatic) {
  if(!state.focus)return;clearInterval(state.focusTicker);state.focusTicker=null;state.pendingFocus={...state.focus,endedAt:Date.now()};state.focus=null;exitImmersion();renderFocusSubjects();renderFocus();
  if(automatic){playReminderSound();showSystemNotification('专注倒计时结束','辛苦了，请补充本次学习详情。');window.alert('倒计时结束，辛苦了！请补充本次学习详情。');}const seconds=Math.max(1,Math.floor((state.pendingFocus.endedAt-state.pendingFocus.startedAt)/1000)),source=state.events.find((event)=>event.id===state.pendingFocus.sourceEventId),isReview=state.pendingFocus.taskType==='review';dom.focusDetailTitle.textContent=isReview?'完成本次复习':state.pendingFocus.planEventId?'完成计划学习':'完成本次专注';dom.focusSummary.textContent=`${state.pendingFocus.categoryName} · ${isReview?'复习':'学习'} · ${clockLabel(seconds)}`;dom.focusStartLabel.textContent=isReview?'本次从哪里开始':'从哪里开始';dom.focusEndLabel.textContent=isReview?'复习到哪里':'学到哪里';dom.focusDetailLabel.textContent=isReview?'复习结果':'学习详情';dom.focusDetailText.placeholder=isReview?'记录回忆是否顺畅、仍然薄弱的部分和下一次要注意什么':'记录掌握的知识点、遇到的问题或下一步计划';dom.focusStartPoint.value=state.pendingFocus.reviewStartPoint||state.pendingFocus.planStartPoint||source?.materialLocation||'';dom.focusEndPoint.value='';dom.focusResultMastery.value=source?.mastery||'unknown';dom.focusDetailText.value=state.pendingFocus.liveNotes||'';openModal('focusDetailModal');
}
function saveFocusRecord() {
  const f=state.pendingFocus;if(!f)return;const start=new Date(f.startedAt),end=new Date(f.endedAt),startSlot=start.getHours()*60+start.getMinutes();let endSlot=end.getHours()*60+end.getMinutes()+(end.getSeconds()?1:0);if(dateKey(start)!==dateKey(end))endSlot=1439;endSlot=clamp(Math.max(startSlot+1,endSlot),1,1439);
  const s=subjectById(f.categoryId),source=state.events.find((event)=>event.id===f.sourceEventId),seconds=Math.max(1,Math.floor((f.endedAt-f.startedAt)/1000)),taskType=f.taskType||'learn',startPoint=dom.focusStartPoint.value.trim(),endPoint=dom.focusEndPoint.value.trim(),detail=dom.focusDetailText.value.trim(),resultMastery=dom.focusResultMastery.value||'unknown',progress=[startPoint,endPoint].filter(Boolean).join(' → ');
  const record={id:uid('event'),date:dateKey(start),halfZone:'record',taskType,categoryId:f.categoryId,categoryName:f.categoryName,subjectPath:source?.subjectPath||[f.categoryId],startSlot,endSlot,color:f.color,opacity:s?.opacity??.86,actionTypes:source?.actionTypes?.length?[...source.actionTypes]:[taskType==='review'?'review':'reading'],knowledgePoint:source?.knowledgePoint||detail||`${f.categoryName}${taskType==='review'?'复习':'学习'}`,materialLocation:progress,mastery:resultMastery,leftover:f.leftoverEventId?'':(source?.leftover||''),important:Boolean(source?.important),textContent:detail||`${f.categoryName}${taskType==='review'?'复习':'专注'}`,notes:detail,flashcards:source?.flashcards?clone(source.flashcards):[],textSize:s?.textSize||13,textColor:'#20231f',textOpacity:s?.textOpacity??.92,focusSeconds:seconds,sourceReviewId:f.reviewId||null,sourceEventId:f.sourceEventId||null,sourcePlanEventId:f.planEventId||null,conflict:false};record.flashcards=normalizeFlashcards(record.flashcards,record);
  pushHistory();state.events.push(record);if(f.reviewId){const review=state.reviews.find((item)=>item.id===f.reviewId);if(review){review.completed=true;review.abandoned=false;review.completedAt=new Date().toISOString();review.generatedEventId=record.id;review.resultSeconds=seconds;review.resultSummary=detail||'完成本次复习';review.resultStartPoint=startPoint;review.resultEndPoint=endPoint;review.resultMastery=resultMastery;review.materialLocation=progress||review.materialLocation;state.reviews.filter((item)=>item.sourceEventId===review.sourceEventId&&item.reviewNumber>=review.reviewNumber).forEach((item)=>item.mastery=resultMastery);if(source)source.mastery=resultMastery;}}else if(taskType==='learn'&&!f.suppressReviews&&s?.reviewEnabled!==false)generateReviews(record);if(f.planEventId&&source){source.planCompletedAt=new Date().toISOString();source.generatedEventId=record.id;source.mastery=resultMastery;}if(f.leftoverEventId){const leftoverSource=state.events.find((event)=>event.id===f.leftoverEventId);if(leftoverSource){leftoverSource.leftoverCompletedAt=new Date().toISOString();state.reviews.filter((review)=>review.sourceEventId===leftoverSource.id).forEach((review)=>review.leftoverResolved=true);}}state.currentDate=startOfDay(start);state.pendingFocus=null;validateConflicts();saveBackup();closeModal('focusDetailModal');renderAll();
}
function discardFocusRecord(){const f=state.pendingFocus,plan=f?.planEventId?state.events.find((item)=>item.id===f.planEventId):null;if(plan){delete plan.planStartedAt;plan.reminderSnoozeUntil=Date.now()+10*60*1000;saveBackup();renderTimeline();}state.pendingFocus=null;closeModal('focusDetailModal');}

function snapshot(){return{currentDate:state.currentDate.toISOString(),settings:clone(state.settings),categories:clone(state.categories),events:clone(state.events),reviews:clone(state.reviews)};}
function normalizeReviewData(review){const number=Math.max(1,Number(review.reviewNumber)||1),stored=Number(review.intervalDays),preset=Number(state.settings.reviewIntervals[number-1]);return{...review,reviewNumber:number,intervalDays:Number.isFinite(stored)?stored:Number.isFinite(preset)?preset:number,reviewDate:normalizeDate(review.reviewDate)};}
function normalizeEventData(event){const normalized={...event,date:normalizeDate(event.date),notes:event.notes||''};normalized.flashcards=normalizeFlashcards(event.flashcards,normalized);return normalized;}
function restore(data){state.currentDate=startOfDay(new Date(data.currentDate));state.settings={...clone(defaultSettings),...clone(data.settings)};state.categories=clone(data.categories);state.events=clone(data.events).map(normalizeEventData);state.reviews=clone(data.reviews).map(normalizeReviewData);closePlanReminder();validateConflicts();migrateCategories();carryOverReviews();syncSettingsToUI();applyLayoutSettings();refreshCategoryUI();saveBackup();renderAll();checkPlanReminders();}
function pushHistory(){state.history.push(snapshot());if(state.history.length>50)state.history.shift();state.future=[];}
function undo(){if(!state.history.length)return;state.future.push(snapshot());restore(state.history.pop());}
function redo(){if(!state.future.length)return;state.history.push(snapshot());restore(state.future.pop());}
function saveBackup(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify({version:DATA_VERSION,currentDate:state.currentDate.toISOString(),settings:state.settings,categories:state.categories,events:state.events,reviews:state.reviews}));}catch(_){}}
function loadBackup(){try{const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return;const data=JSON.parse(raw);state.settings={...clone(defaultSettings),...(data.settings||{})};if(!Array.isArray(state.settings.reviewIntervals))state.settings.reviewIntervals=parseIntervals(state.settings.reviewIntervals||'1,3,7,14,30');state.categories=Array.isArray(data.categories)&&data.categories.length?data.categories:clone(defaultCategories);state.events=Array.isArray(data.events)?data.events.map(normalizeEventData):[];state.reviews=Array.isArray(data.reviews)?data.reviews.map(normalizeReviewData):[];if(data.currentDate)state.currentDate=startOfDay(new Date(data.currentDate));migrateCategories();validateConflicts();}catch(_){state.settings=clone(defaultSettings);state.categories=clone(defaultCategories);state.events=[];state.reviews=[];}}

function exportData(){const data={version:DATA_VERSION,exportedAt:new Date().toISOString(),currentDate:state.currentDate.toISOString(),settings:state.settings,categories:state.categories,events:state.events,reviews:state.reviews};downloadBlob(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),`学习日志_${dateKey(new Date())}.json`);}
function importData(){const file=dom.importInput.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const data=JSON.parse(String(reader.result));if(!window.confirm('导入会覆盖当前数据，是否继续？'))return;pushHistory();restore({currentDate:data.currentDate||new Date().toISOString(),settings:data.settings||defaultSettings,categories:data.categories?.length?data.categories:defaultCategories,events:data.events||[],reviews:data.reviews||[]});}catch(_){window.alert('导入失败：文件格式无效。');}};reader.readAsText(file);dom.importInput.value='';}
function exportImage(){
  const width=1400,header=360,target=createLayout(width,54,header),output=document.createElement('canvas');output.width=width;output.height=target.height+24;const c=output.getContext('2d'),records=currentEvents().filter((event)=>event.halfZone==='record'),totalMinutes=records.reduce((sum,event)=>sum+Math.max(1,event.endSlot-event.startSlot),0),pending=state.reviews.filter((review)=>review.reviewDate===currentDateKey()&&!review.completed&&!review.abandoned).length;
  c.fillStyle='#fff';c.fillRect(0,0,output.width,output.height);c.fillStyle='#20231f';c.font='800 34px "Segoe UI","Microsoft YaHei"';c.fillText('今日学习日报',42,54);c.fillStyle='#74786f';c.font='15px "Segoe UI"';c.fillText(`${state.currentDate.getFullYear()}年${dateLabel(state.currentDate)}`,43,82);
  const metrics=[['学习总时长',durationLabel(totalMinutes*60)],['记录事件',`${records.length} 项`],['待复习',`${pending} 项`]];metrics.forEach(([label,value],index)=>{const x=42+index*225;c.fillStyle='#f5f5f0';roundRect(c,x,112,205,96,16);c.fill();c.fillStyle='#74786f';c.font='12px "Segoe UI"';c.fillText(label,x+18,141);c.fillStyle='#20231f';c.font='800 26px "Segoe UI"';c.fillText(value,x+18,181);});
  const distribution=new Map();records.forEach((event)=>{const subject=subjectById(event.categoryId),key=subject?.id||'other',item=distribution.get(key)||{name:subject?.name||'未分类',color:subject?.color||event.color||'#88928b',minutes:0};item.minutes+=Math.max(1,event.endSlot-event.startSlot);distribution.set(key,item);});const items=[...distribution.values()],sum=items.reduce((value,item)=>value+item.minutes,0),cx=930,cy=161,radius=82;c.lineWidth=28;let angle=-Math.PI/2;if(sum){items.forEach((item)=>{const next=angle+item.minutes/sum*Math.PI*2;c.strokeStyle=item.color;c.beginPath();c.arc(cx,cy,radius,angle,next);c.stroke();angle=next;});}else{c.strokeStyle='#e5e7e2';c.beginPath();c.arc(cx,cy,radius,0,Math.PI*2);c.stroke();}c.fillStyle='#20231f';c.textAlign='center';c.font='800 21px "Segoe UI"';c.fillText(durationLabel(totalMinutes*60),cx,158);c.fillStyle='#74786f';c.font='11px "Segoe UI"';c.fillText('记录区总时长',cx,178);c.textAlign='left';items.slice(0,6).forEach((item,index)=>{const x=1060,y=125+index*27;c.fillStyle=item.color;c.beginPath();c.arc(x,y-4,5,0,Math.PI*2);c.fill();c.fillStyle='#3d443f';c.font='12px "Segoe UI"';c.fillText(`${item.name}  ${Math.round(item.minutes/sum*100)}%`,x+13,y);});
  c.fillStyle='#20231f';c.font='800 17px "Segoe UI"';c.fillText('学习时间轴',42,287);c.fillStyle='#74786f';c.font='11px "Segoe UI"';c.fillText('箭头颜色代表学科；虚线代表复习任务',42,309);c.textAlign='center';c.font='800 12px "Segoe UI"';c.fillText('计划区',target.planWidth/2,348);c.fillText('记录区',target.planWidth+(target.width-target.planWidth)/2,348);drawTimeline(c,target,{exportMode:true});const a=document.createElement('a');a.href=output.toDataURL('image/png');a.download=`学习日报_${currentDateKey()}.png`;a.click();
}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

function matchesShortcut(event,shortcut) {
  const parts=String(shortcut||'Ctrl+Enter').toLowerCase().split('+').map((x)=>x.trim()),key=parts.at(-1);
  return event.key.toLowerCase()===key&&event.ctrlKey===parts.includes('ctrl')&&event.altKey===parts.includes('alt')&&event.shiftKey===parts.includes('shift')&&event.metaKey===parts.includes('meta');
}
function onKeydown(event) {
  const typing=['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName);
  if(!typing&&matchesShortcut(event,state.settings.shortcut)){event.preventDefault();toggleSelection();return;}
  if(event.key==='Escape'){if(!dom.planReminderModal.classList.contains('hidden')){snoozePlanReminder();return;}if(!dom.immersionOverlay.classList.contains('hidden')){exitImmersion();return;}cancelSelection();hideContextMenu();closeToolbarMenu();closeAllModals();}
  if(!typing&&event.ctrlKey&&event.key.toLowerCase()==='z'){event.preventDefault();undo();}
  if(!typing&&event.ctrlKey&&event.key.toLowerCase()==='y'){event.preventDefault();redo();}
}
function renderAll(){renderDate();renderTimeline();renderReviews();renderFocusSubjects();renderFocus();}

updateFocusDurationUI();
checkPlanReminders();
state.planReminderTicker=setInterval(checkPlanReminders,15000);
if('serviceWorker'in navigator&&/^https?:$/.test(location.protocol))navigator.serviceWorker.register('./sw.js').catch(()=>{});
