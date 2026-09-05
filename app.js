const STORAGE_KEY = 'learning_tool_backup';
const ACTIVE_FOCUS_KEY = 'learning_tool_active_focus';
const DATA_VERSION = 11;
const ACTION_TYPE_LABELS = { new: '新知', apply: '运用', memorize: '记诵' };
const ACTION_TYPE_ICONS = { new: '✦', apply: '✎', memorize: '◇' };
const ACTION_TYPE_MIGRATION = { new: 'new', apply: 'apply', memorize: 'memorize', video: 'new', practice: 'apply' };
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
  reviewPreset: 'common', reviewIntervals: [1, 3, 7, 14, 30],
  planRatio: .5, defaultSelectionZone: 'record', showDots: true, dotSize: 1.7, dotOpacity: .2,
  eventPlacement: 'bottom', dividerDrag: true, defaultPlanColor: '#d09a55', defaultRecordColor: '#4f8aa8',
  defaultEventOpacity: .86, defaultTextSize: 13, defaultTextColor: '#20231f', defaultTextOpacity: .92,
  shortcut: 'Ctrl+Enter', sideWidth: 330, dateHeight: 62, focusHeight: 180, focusColumnWidth: 320, layoutMode: 'stacked', immersionSwapped: false,
  immersionTheme: 'plain', immersionOpacity: .72, showCountdown: false, countdownName: '距离考试',
  countdownDate: '', showQuote: true
  , arrowWidth: 1.75, arrowSize: 6, compactToolbar: false,
  reviewArrowWidth: 2, reviewArrowSize: 7, reviewArrowDash: 'medium',
  compactTimeline: false, compactTimelinePrevious: null, focusCollapsed: false,
  countdownSize: 30, countdownPosition: 'below', immersionBackground: '',
  soundEnabled: true, soundType: 'cheer', soundDuration: 1.5, soundVolume: .65, notificationsEnabled: false
};

const state = {
  currentDate: startOfDay(new Date()), settings: clone(defaultSettings), categories: clone(defaultCategories),
  events: [], reviews: [], focusTasks: [], reviewFilter: 'today', history: [], future: [],
  editingEventId: null, editingEventTime: null, selection: null, selectedEventId: null, selectedReviewId: null, hoveredEventId: null,
  inputDialog: null, modalStack: [], modalReturnFocus: new Map(),
  layoutEditing: false, dividerDragging: false, focus: null, pendingFocus: null, focusTicker: null,
  pendingPlanReminderId: null, planReminderTicker: null, reviewDayKey: null,
  calendarMonth: startOfMonth(new Date()), selectedSubjectId: null, statsSubjects: new Set(), statsAnchor: startOfDay(new Date()),
  selectedDetailEventId: null, reviewGroupOpen: new Map(), statsExpanded: new Set(), mergeMode: false, mergeSelection: new Set(),
  installPrompt: null, canvasClickTimer: null, audioContext: null, pipWindow: null, pipRequest: null, unfinishedMarkup: null,
  statVisibility: { summary: true, today: true, distribution: true, monthly: true, yearly: true }
};

const dom = {};
[
  'mainLayout','timelineScroll','timelineCanvas','currentDateLabel','reviewBadge','currentDateButton','reviewList','reviewListSummary','reviewCard','reviewFullscreenBtn',
  'toolbarMenuBtn','toolbarMenu','layoutEditBar','layoutMode','addEventBtn','mergeEventsBtn','eventMergeBar','eventMergeCount','eventMergeName','eventMergeStrategy','confirmEventMergeBtn','cancelEventMergeBtn','editLayoutBtn','finishLayoutBtn','resetLayoutBtn',
  'sideResizeHandle','focusReviewHandle','contextMenu','importInput','eventModal','settingsModal','calendarModal',
  'statsModal','subjectsModal','planReminderModal','reviewDetailModal','focusDetailModal','eventDetailModal','leftoverModal','planReminderSubject','planReminderTime',
  'planReminderTitle','planReminderActions','planReminderLocation','planReminderIgnoreBtn','planReminderSnoozeBtn','planReminderStartBtn',
  'reviewDetailTitle','reviewDetailBasic','reviewDetailLearning',
  'reviewDetailHistory','reviewDetailStartBtn','eventModalTitle','eventHalfZone','eventTaskType','eventName','eventSubjectPath','eventSubjectOptions','eventCategory',
  'eventSubcategory','eventTopic','eventColor','eventOpacity','eventMaterialLocation','eventProgress','eventMastery',
  'eventTextContent','eventNotes','eventLeftover','eventImportant','eventTextSize','eventTextColor',
  'eventTextOpacity','eventStartHour','eventStartMinute','eventStartSecond','eventEndHour','eventEndMinute','eventEndSecond','eventTimeSummary','eventTaskEditNotice',
  'settingStartHour','settingHourHeight','settingPlanRatio','settingDefaultZone','settingMinuteInterval',
  'settingEventPlacement','settingDotSize','settingDotOpacity','settingArrowWidth','settingArrowSize','settingCompactToolbar','settingShowDots','settingDividerDrag',
  'settingHiddenHours','settingReviewPreset','settingReviewIntervals','settingReviewArrowWidth','settingReviewArrowSize','settingReviewArrowDash',
  'settingShortcut','settingCountdownName','settingCountdownDate','settingImmersionTheme','settingImmersionOpacity','settingCountdownSize','settingCountdownPosition','settingImmersionBackground','settingLocalBackground','localBackgroundStatus',
  'settingShowCountdown','settingShowQuote','settingSoundType','settingSoundDuration','settingSoundVolume','settingSoundEnabled','settingNotificationsEnabled','monthCalendar','calendarTitle','statsSubjectFilters','statsRange','statsCustomRange','statsCustomFrom','statsCustomTo','statsChartType','statsPrevPeriod','statsNextPeriod','statsPeriodLabel',
  'statTotalCount','statTotalTime','statDailyAverage','statTodayCount','statTodayTime','statTodaySplit','statDayTitle','distributionChart','distributionDetails',
  'monthlyChart','yearlyChart','statMonthTitle','statYearTitle','subjectsList','subjectDetail','focusCard','focusCollapseBtn','focusBody','focusSubjects','focusTaskType','focusTimerType','focusDurationWrap',
  'focusDuration','focusCustomDurationWrap','focusCustomDuration','focusClock','focusSubjectLabel','focusLiveNote','focusStatus',
  'stopFocusBtn','pauseFocusBtn','unfinishedTaskPanel','unfinishedTaskList','focusResultName','focusResultSummary','focusResultLeftover','focusCompletionStatus','enterImmersionBtn','focusDetailTitle','focusSummary','focusStartLabel','focusEndLabel','focusDetailLabel',
  'focusStartPoint','focusEndPoint','focusResultMastery','focusDetailText','immersionOverlay','immersionBackdrop','immersionContent',
  'immersionMode','immersionClock','immersionSubject','immersionTotal','immersionSwapBtn','immersionReviewCard','immersionInputCard','immersionLiveNote','immersionMaterialLocation','immersionProgress','immersionEventName','immersionSummary','immersionLeftover','immersionActionPicker','immersionActionNew','immersionActionApply','immersionActionMemorize','immersionActionType','immersionMastery','immersionCountdown','immersionQuote','immersionPipBtn',
  'eventDetailTitle','eventDetailBody','eventDetailEditBtn','eventDetailReopenBtn','eventDetailStartBtn','timelineTooltip','leftoverList','installAppBtn','reloadConfigBtn','reloadConfigFeedback','compactTimelinePresetBtn',
  'inputDialogModal','inputDialogForm','inputDialogTitle','inputDialogLabel','inputDialogDescription','inputDialogValue','inputDialogEarlierWrap','inputDialogEarlier','inputDialogError','dailyReportPreview','dailyReportDownload','reportPrevDay','reportNextDay','reportDateLabel'
].forEach((id) => { dom[id] = document.getElementById(id); });

const canvas = dom.timelineCanvas;
const ctx = canvas.getContext('2d');
let layout = null;

loadBackup();
carryOverReviews();
restoreActiveFocus();
bindEvents();
syncSettingsToUI();
applyLayoutSettings();
refreshCategoryUI();
renderAll();
if(state.focus){state.focusTicker=setInterval(tickFocus,250);handleAppResume();}

function bindEvents() {
  dom.layoutMode.addEventListener('change',()=>{state.settings.layoutMode=dom.layoutMode.value==='columns'?'columns':'stacked';applyLayoutSettings();saveBackup();renderTimeline();});
  dom.immersionSwapBtn.addEventListener('click',()=>{state.settings.immersionSwapped=!state.settings.immersionSwapped;applyImmersionSettings();saveBackup();});
  dom.toolbarMenuBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    const open = dom.toolbarMenu.classList.toggle('hidden') === false;
    dom.toolbarMenuBtn.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('toolbar-menu-open', open);
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
  document.getElementById('leftoverBtn').addEventListener('click', openLeftoverPool);
  dom.compactTimelinePresetBtn.addEventListener('click', applyCompactTimelinePreset);
  dom.reloadConfigBtn.addEventListener('click', reloadConfiguration);
  document.getElementById('testSoundBtn').addEventListener('click', playReminderSound);
  document.getElementById('enableNotificationsBtn').addEventListener('click', requestNotifications);
  document.getElementById('clearLocalBackgroundBtn').addEventListener('click', clearImmersionBackground);
  dom.settingLocalBackground.addEventListener('change', importImmersionBackground);
  dom.installAppBtn.addEventListener('click', installApp);
  dom.addEventBtn.addEventListener('click', toggleSelection);
  dom.mergeEventsBtn.addEventListener('click', toggleMergeMode);
  dom.cancelEventMergeBtn.addEventListener('click', cancelMergeMode);
  dom.confirmEventMergeBtn.addEventListener('click', submitEventMerge);
  dom.editLayoutBtn.addEventListener('click', toggleLayoutEditing);
  dom.finishLayoutBtn.addEventListener('click', () => setLayoutEditing(false));
  dom.resetLayoutBtn.addEventListener('click', resetLayout);
  document.getElementById('prevDayBtn').addEventListener('click', () => shiftDate(-1));
  document.getElementById('nextDayBtn').addEventListener('click', () => shiftDate(1));
  document.getElementById('todayBtn').addEventListener('click', () => {carryOverReviews();state.currentDate=startOfDay(new Date());state.selectedEventId=null;cancelSelection();saveBackup();renderAll();});
  dom.currentDateButton.addEventListener('click', openCalendar);
  document.getElementById('calendarPrevBtn').addEventListener('click', () => { state.calendarMonth = addMonths(state.calendarMonth, -1); renderCalendar(); });
  document.getElementById('calendarNextBtn').addEventListener('click', () => { state.calendarMonth = addMonths(state.calendarMonth, 1); renderCalendar(); });
  document.getElementById('saveEventBtn').addEventListener('click', saveEvent);
  document.getElementById('addCategoryBtn').addEventListener('click', addCategory);
  dom.inputDialogForm.addEventListener('submit', submitInputDialog);
  document.getElementById('saveFocusBtn').addEventListener('click', saveFocusRecord);
  document.getElementById('discardFocusBtn').addEventListener('click', discardFocusRecord);
  dom.planReminderStartBtn.addEventListener('click', () => startPlanEvent(state.pendingPlanReminderId));
  dom.planReminderSnoozeBtn.addEventListener('click', snoozePlanReminder);
  dom.planReminderIgnoreBtn.addEventListener('click', ignorePlanReminder);
  dom.reviewDetailStartBtn.addEventListener('click', () => { const id=state.selectedReviewId,startPoint=document.getElementById('reviewStartPointInput')?.value.trim()||'';closeModal('reviewDetailModal');if(id)startReview(id,startPoint); });
  dom.eventDetailEditBtn.addEventListener('click', editSelectedDetailEvent);
  dom.eventDetailReopenBtn.addEventListener('click', () => reopenCompletedEvent(state.selectedDetailEventId));
  dom.eventDetailStartBtn.addEventListener('click', startSelectedDetailEvent);
  dom.stopFocusBtn.addEventListener('click', () => finishFocus(false));
  dom.pauseFocusBtn.addEventListener('click', () => pauseFocus());
  document.getElementById('immersionPauseBtn').addEventListener('click', () => pauseFocus());
  document.getElementById('immersionStopBtn').addEventListener('click', () => finishFocus(false));
  dom.enterImmersionBtn.addEventListener('click', enterImmersion);
  document.getElementById('exitImmersionBtn').addEventListener('click', exitImmersion);
  dom.immersionPipBtn.addEventListener('click', openFocusPictureInPicture);
  dom.focusCollapseBtn.addEventListener('click', toggleFocusCollapsed);
  dom.reviewFullscreenBtn.addEventListener('click', toggleReviewFullscreen);
  dom.focusTimerType.addEventListener('change', updateFocusDurationUI);
  dom.focusDuration.addEventListener('change', updateFocusDurationUI);
  dom.focusLiveNote.addEventListener('input', () => updateFocusLiveNote(dom.focusLiveNote.value));
  dom.immersionLiveNote.addEventListener('input', () => updateFocusLiveNote(dom.immersionLiveNote.value));
  [dom.immersionMaterialLocation,dom.immersionProgress,dom.immersionEventName,dom.immersionSummary,dom.immersionLeftover,dom.immersionActionType,dom.immersionMastery].forEach((input)=>input.addEventListener(input.tagName==='SELECT'?'change':'input',updateFocusImmersionFields));
  [[dom.immersionActionNew,'new'],[dom.immersionActionApply,'apply'],[dom.immersionActionMemorize,'memorize']].forEach(([button,action])=>button.addEventListener('click',()=>setImmersionAction(action)));
  dom.importInput.addEventListener('change', importData);
  document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => closeModal(button.dataset.close)));
  document.querySelectorAll('.filter-btn').forEach((button) => button.addEventListener('click', () => setReviewFilter(button.dataset.filter)));
  document.querySelectorAll('[data-toggle-stat]').forEach((button) => button.addEventListener('click', () => toggleStat(button.dataset.toggleStat)));
  dom.statsRange.addEventListener('change', () => { updateStatsRangeUI();renderStats(); });
  dom.statsCustomFrom.addEventListener('change', renderStats);
  dom.statsCustomTo.addEventListener('change', renderStats);
  dom.statsChartType.addEventListener('change', renderStats);
  dom.statsPrevPeriod.addEventListener('click',()=>shiftStatsPeriod(-1));
  dom.statsNextPeriod.addEventListener('click',()=>shiftStatsPeriod(1));
  dom.reportPrevDay.addEventListener('click',()=>shiftReportDate(-1));
  dom.reportNextDay.addEventListener('click',()=>shiftReportDate(1));

  dom.eventCategory.addEventListener('change', () => { syncSubcategoryOptions(); syncEventAppearance(); });
  dom.eventSubcategory.addEventListener('change', () => { syncTopicOptions(); syncEventAppearance(); });
  dom.eventTopic.addEventListener('change', syncEventAppearance);
  dom.eventTaskType.addEventListener('change', syncEventAppearance);
  dom.eventSubjectPath.addEventListener('change', applySubjectPicker);
  dom.eventSubjectPath.addEventListener('blur', applySubjectPicker);
  [dom.eventStartHour,dom.eventStartMinute,dom.eventStartSecond,dom.eventEndHour,dom.eventEndMinute,dom.eventEndSecond].forEach((input) => input.addEventListener('input', updateTimeSummary));

  const settingInputs = [
    dom.settingStartHour,dom.settingHourHeight,dom.settingPlanRatio,dom.settingDefaultZone,dom.settingMinuteInterval,
    dom.settingEventPlacement,dom.settingDotSize,dom.settingDotOpacity,dom.settingArrowWidth,dom.settingArrowSize,dom.settingCompactToolbar,dom.settingShowDots,dom.settingDividerDrag,
    dom.settingHiddenHours,dom.settingReviewIntervals,dom.settingReviewArrowWidth,dom.settingReviewArrowSize,dom.settingReviewArrowDash,dom.settingShortcut,
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
    dom.timelineTooltip.classList.add('hidden');
    if (state.selection) state.selection.hoverSlot = null;
    renderTimeline();
  });
  canvas.addEventListener('contextmenu', onCanvasContextMenu);
  canvas.addEventListener('pointerdown', onCanvasPointerDown);
  dom.sideResizeHandle.addEventListener('pointerdown', (event) => beginLayoutResize(event, 'side'));
  dom.focusReviewHandle.addEventListener('pointerdown', (event) => beginLayoutResize(event, 'focus'));
  window.addEventListener('resize', () => {renderTimeline();if(!dom.statsModal.classList.contains('hidden'))renderStats();});
  window.addEventListener('keydown', onKeydown);
  window.addEventListener('focus', handleAppResume);
  window.addEventListener('pageshow', handleAppResume);
  document.addEventListener('visibilitychange', () => { if(!document.hidden)handleAppResume(); });
  document.addEventListener('pointerdown', unlockAudio, {once:true});
  window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault();state.installPrompt=event;dom.installAppBtn.classList.remove('hidden'); });
  window.addEventListener('appinstalled', () => { state.installPrompt=null;dom.installAppBtn.classList.add('hidden');requestLandscapeOrientation(); });
  document.addEventListener('fullscreenchange', requestLandscapeOrientation);
  requestLandscapeOrientation();
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function normalizeActionType(value){return ACTION_TYPE_MIGRATION[value]||null;}
function normalizeActionTypes(values,defaultToNew=true){const result=[...new Set((Array.isArray(values)?values:[values]).map(normalizeActionType).filter(Boolean))];return result.length?[result[0]]:(defaultToNew?['new']:[]);}
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
function slotLabel(slot) { if(slot>=1440)return '24:00';const p=slotParts(slot); return `${pad(p.hour)}:${pad(p.minute)}`; }
function eventTimeParts(slot){const ms=Math.round(clamp(Number(slot)||0,0,1440)*60000);return{hour:Math.floor(ms/3600000),minute:Math.floor(ms%3600000/60000),second:(ms%60000)/1000};}
function eventTimeLabel(slot){const p=eventTimeParts(slot),second=p.second<10?`0${p.second}`:String(p.second);return `${pad(p.hour)}:${pad(p.minute)}${p.second?':'+second:''}`;}
function eventTimeSecondLabel(slot){const seconds=Math.round(clamp(Number(slot)||0,0,1440)*60),hour=Math.floor(seconds/3600),minute=Math.floor(seconds%3600/60),second=seconds%60;return `${pad(hour)}:${pad(minute)}:${pad(second)}`;}
function durationLabel(seconds) { const value=Math.max(0,Number(seconds)||0);if(value>0&&value<60)return `${Math.max(1,Math.round(value))}s`;const mins=Math.round(value/60); if(mins<60)return `${mins}m`; return `${Math.floor(mins/60)}h ${mins%60}m`; }
function clockLabel(seconds) { const v=Math.max(0,Math.floor(seconds)); return `${pad(Math.floor(v/3600))}:${pad(Math.floor(v%3600/60))}:${pad(v%60)}`; }
function roundedClockLabel(seconds) { return clockLabel(Math.round(Math.max(0,Number(seconds)||0))); }
function escapeHtml(text) { return String(text??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;'); }
function normalizeDate(value) { const date=new Date(value); return Number.isNaN(date.getTime())?value:dateKey(date); }
function setToolLabel(button,label,glyph){const text=button.querySelector('.tool-label');if(text)text.textContent=label;else button.textContent=label;if(glyph){const icon=button.querySelector('.tool-glyph');if(icon)icon.textContent=glyph;}}

async function requestLandscapeOrientation() {
  const mobileLike=window.matchMedia('(max-width: 1024px) and (pointer: coarse)').matches;
  const appLike=window.matchMedia('(display-mode: standalone)').matches||Boolean(document.fullscreenElement);
  if(!mobileLike||!appLike||!screen.orientation?.lock)return false;
  try { await screen.orientation.lock('landscape'); return true; } catch { return false; }
}

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
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>1440||end<=start)return false;
  const hours=new Set(visibleHours());for(let hour=Math.floor(start/60);hour<Math.ceil(end/60);hour++){if(!hours.has(hour))return false;}return true;
}
function snapSlot(slot) { const interval=Number(state.settings.minuteInterval)||5; return clamp(Math.round(slot/interval)*interval,0,1439); }

function createLayout(width,hourHeight,top=0) {
  const hours=visibleHours(),planWidth=Math.round(width*clamp(state.settings.planRatio,.25,.75));
  const result={width,hourHeight,top,hours,planWidth,rowHeights:hours.map(()=>hourHeight),rowOffsets:hours.map((_,i)=>i*hourHeight)};
  let offset=0;result.rowOffsets=result.rowHeights.map(height=>{const start=offset;offset+=height;return start;});result.height=top+offset;return result;
}

function resizeCanvas() {
  const mobileViewport=window.matchMedia('(max-width: 720px)').matches;
  const width=Math.max(mobileViewport?320:430,dom.timelineScroll.clientWidth||800); layout=createLayout(width,state.settings.hourHeight,0);
  const dpr=window.devicePixelRatio||1; canvas.width=Math.round(width*dpr); canvas.height=Math.round(layout.height*dpr);
  canvas.style.height=`${layout.height}px`; ctx.setTransform(dpr,0,0,dpr,0,0); return layout;
}
function eventY(hourIndex,targetLayout) {
  const height=targetLayout.rowHeights?.[hourIndex]||targetLayout.hourHeight,offset=targetLayout.rowOffsets?.[hourIndex]??hourIndex*targetLayout.hourHeight;
  return targetLayout.top+offset+(state.settings.eventPlacement==='bottom'?height-9:height/2);
}

function eventSegments(event,targetLayout) {
  const segments=[]; const zoneLeft=event.halfZone==='record'?targetLayout.planWidth:0;
  const zoneRight=event.halfZone==='record'?targetLayout.width:targetLayout.planWidth; const left=zoneLeft+18; const usable=Math.max(40,zoneRight-zoneLeft-36);
  targetLayout.hours.forEach((hour,index)=>{
    const hs=hour*60,he=hs+60,start=Math.max(event.startSlot,hs),end=Math.min(event.endSlot,he); if(end<=start)return;
    const raw1=left+(start-hs)/60*usable,raw2=left+(end-hs)/60*usable;
    segments.push({hour,index,x1:raw1,x2:Math.min(zoneRight-8,Math.max(raw2,raw1+12)),y:eventY(index,targetLayout),first:start===event.startSlot,last:end===event.endSlot});
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
function eventLabelPlacement(event,targetLayout) {
  const segments=eventSegments(event,targetLayout),zoneRight=event.halfZone==='record'?targetLayout.width:targetLayout.planWidth;
  const neighbors=currentEvents().filter(item=>item.id!==event.id&&item.halfZone===event.halfZone).flatMap(item=>eventSegments(item,targetLayout).map(segment=>({...segment,id:item.id})));
  return segments.map(segment=>{
    const next=neighbors.filter(other=>other.hour===segment.hour&&(other.x1>segment.x1+.1||(Math.abs(other.x1-segment.x1)<=.1&&String(other.id)>String(event.id)))).sort((a,b)=>a.x1-b.x1)[0];
    const right=next?Math.min(zoneRight-8,next.x1-7):zoneRight-8;
    return {segment,x:segment.x1,width:Math.max(0,right-segment.x1),hasFollowing:Boolean(next),freeArrow:Math.max(0,Math.min(segment.x2,right)-segment.x1)};
  }).sort((a,b)=>b.freeArrow-a.freeArrow||b.width-a.width||a.segment.index-b.segment.index)[0]||null;
}
function layoutEventLabel(context,event,targetLayout) {
  const placement=eventLabelPlacement(event,targetLayout);if(!placement)return null;
  const subject=subjectById(event.categoryId),fontSize=clamp(event.textSize||subject?.textSize||state.settings.defaultTextSize,10,24),smallSize=Math.max(9,fontSize-2),lineHeight=fontSize+5;
  const prefix=[event.taskStatus==='paused'?'Ⅱ':event.halfZone==='plan'?(event.planCompletedAt?'✓':''): '',event.important?'★':'',(event.categoryName||'').split('/')[1]||'',...normalizeActionTypes(event.actionTypes).map(type=>ACTION_TYPE_ICONS[type]).filter(Boolean)].filter(Boolean).join(' ');
  const runs=[{text:prefix?prefix+' ':'',font:`600 ${smallSize}px "Segoe UI","Microsoft YaHei"`,color:'#607067'},{text:eventTitle(event),font:`${(event.italic??subject?.italic)?'italic ':''}${(event.bold??subject?.bold)?700:400} ${fontSize}px "Segoe UI","Microsoft YaHei"`,color:event.textColor||'#20231f'},{text:event.materialLocation?' '+event.materialLocation:'',font:`400 ${smallSize}px "Segoe UI","Microsoft YaHei"`,color:'#526259'}];
  const glyphs=runs.flatMap(run=>Array.from(run.text).map(char=>({...run,text:char}))),parts=[];let x=0,truncated=false;
  context.save();
  for(let i=0;i<glyphs.length;i++){
    const glyph=glyphs[i];context.font=glyph.font;const width=context.measureText(glyph.text).width;
    const ellipsis=context.measureText('…').width;
    if(x+width+(i<glyphs.length-1?ellipsis:0)>placement.width){truncated=i<glyphs.length;if(placement.width>=ellipsis)parts.push({...glyph,text:'…',x:Math.min(x,placement.width-ellipsis),line:0});break;}
    if(placement.width<1)break;
    parts.push({...glyph,x,line:0});x+=width;
  }
  context.restore();
  return {...placement,parts,lineHeight,height:lineHeight,fontSize,truncated,fullText:runs.map(run=>run.text).join('')};
}
function drawEvent(context,targetLayout,event,exportMode) {
  const segments=eventSegments(event,targetLayout);if(!segments.length)return;const style=eventStyle(event);
  const active=!exportMode&&(state.selectedEventId===event.id||state.hoveredEventId===event.id||state.mergeSelection.has(event.id)),subject=subjectById(event.categoryId),isReview=event.taskType==='review';
  const arrowWidth=isReview?clamp(Number(state.settings.reviewArrowWidth)||2,1,6):clamp(Number(state.settings.arrowWidth)||1.75,1,5),arrowSize=isReview?clamp(Number(state.settings.reviewArrowSize)||7,3,14):clamp(Number(state.settings.arrowSize)||6,3,12),reviewDash={short:[3,3],medium:[6,4],long:[10,5],solid:[]}[state.settings.reviewArrowDash]||[6,4];
  context.save();context.strokeStyle=rgba(style.color,style.opacity);context.fillStyle=rgba(style.color,style.opacity);context.lineWidth=active?arrowWidth+1.5:arrowWidth;context.lineCap='round';
  segments.forEach(seg=>{if(isReview)context.setLineDash(reviewDash);context.beginPath();context.moveTo(seg.x1,seg.y);context.lineTo(seg.x2,seg.y);context.stroke();context.setLineDash([]);
    if(seg.first){context.beginPath();context.arc(seg.x1,seg.y,active?3.5:2.5,0,Math.PI*2);isReview?context.stroke():context.fill();}
    if(seg.last){context.beginPath();context.moveTo(seg.x2,seg.y);context.lineTo(seg.x2-arrowSize,seg.y-arrowSize*.62);context.moveTo(seg.x2,seg.y);context.lineTo(seg.x2-arrowSize,seg.y+arrowSize*.62);context.stroke();}
  });
  const label=layoutEventLabel(context,event,targetLayout);
  if(label&&label.width>0){
    const y=label.segment.y-label.height-5;
    context.fillStyle='rgba(255,255,255,.95)';context.fillRect(label.x,y,label.width,label.height);
    context.beginPath();context.rect(label.x,y,label.width,label.height);context.clip();
    context.globalAlpha=exportMode?1:(event.textOpacity??subject?.textOpacity??.92);context.textAlign='left';context.textBaseline='middle';
    label.parts.forEach(part=>{context.font=part.font;context.fillStyle=exportMode?'#333':part.color;context.fillText(part.text,label.x+part.x,y+part.line*label.lineHeight+label.lineHeight/2);});
  }
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
  const localY=y-target.top,found=target.rowOffsets.findIndex((offset,i)=>localY<offset+target.rowHeights[i]),index=found<0?target.hours.length-1:found,zone=x<target.planWidth?'plan':'record';
  const zl=zone==='record'?target.planWidth:0,zr=zone==='record'?target.width:target.planWidth,usable=Math.max(40,zr-zl-36),minute=Math.round(clamp(x-zl-18,0,usable)/usable*60);
  return{x,y,zone,slot:snapSlot(target.hours[index]*60+minute)};
}
function hitTest(event){
  const p=pointerInfo(event);
  return [...currentEvents()].reverse().find(item=>{
    if(eventSegments(item,layout).some(s=>p.x>=s.x1-7&&p.x<=s.x2+7&&Math.abs(p.y-s.y)<=11))return true;
    const label=layoutEventLabel(ctx,item,layout);return label&&p.x>=label.x&&p.x<=label.x+label.width&&p.y>=label.segment.y-label.height-5&&p.y<label.segment.y-5;
  })||null;
}

function toggleSelection() {
  if(state.selection){cancelSelection();return;}
  cancelMergeMode();closeAllModals();state.selection={zone:state.settings.defaultSelectionZone,startSlot:null,hoverSlot:null};state.selectedEventId=null;
  setToolLabel(dom.addEventBtn,'取消选点','×');dom.addEventBtn.title='取消选点';dom.addEventBtn.classList.add('danger');renderTimeline();
}
function cancelSelection(){state.selection=null;setToolLabel(dom.addEventBtn,'选时间','＋');dom.addEventBtn.title='在时间轴选时间';dom.addEventBtn.classList.remove('danger');renderTimeline();}
function onCanvasMove(event) {
  if(state.selection){const p=pointerInfo(event);if(!Number.isFinite(state.selection.startSlot))state.selection.zone=p.zone;state.selection.hoverSlot=p.zone===state.selection.zone?p.slot:null;renderTimeline();return;}
  const hit=hitTest(event),id=hit?.id||null;if(id!==state.hoveredEventId){state.hoveredEventId=id;renderTimeline();}
  const label=hit?layoutEventLabel(ctx,hit,layout):null;
  if(label?.truncated)showTimelineTooltip(event.clientX,event.clientY,label.fullText.trim());else dom.timelineTooltip.classList.add('hidden');
}
function onCanvasClick(event) {
  if(state.mergeMode){const hit=hitTest(event);if(!hit)return;if(hit.halfZone!=='record'||(hit.taskType||'learn')!=='learn'){window.alert('只能合并时间轴记录区的学习事件。');return;}toggleMergeEventSelection(hit);renderMergeBar();renderTimeline();return;}
  if(!state.selection){const hit=hitTest(event);state.selectedEventId=hit?.id||null;renderTimeline();clearTimeout(state.canvasClickTimer);if(hit)state.canvasClickTimer=setTimeout(()=>openEventDetail(hit.id),190);return;}
  const p=pointerInfo(event);
  if(!Number.isFinite(state.selection.startSlot)){state.selection.zone=p.zone;state.selection.startSlot=p.slot;state.selection.hoverSlot=p.slot;renderTimeline();return;}
  if(p.zone!==state.selection.zone){state.selection.zone=p.zone;state.selection.startSlot=p.slot;state.selection.hoverSlot=p.slot;renderTimeline();return;}
  if(p.slot<=state.selection.startSlot){window.alert('结束时间需要晚于开始时间。');return;}
  const preset={halfZone:p.zone,startSlot:state.selection.startSlot,endSlot:p.slot};cancelSelection();openEventModal(null,preset);
}
function onCanvasDoubleClick(event){if(!state.selection&&!state.mergeMode){clearTimeout(state.canvasClickTimer);const hit=hitTest(event);if(hit)openEventModal(hit);}}
function positionContextMenu(clientX,clientY){const rect=dom.contextMenu.getBoundingClientRect(),vw=Number(window.innerWidth)||1024,vh=Number(window.innerHeight)||768,gap=8,left=clamp(clientX,8,Math.max(8,vw-rect.width-8)),below=clientY+gap,top=below+rect.height<=vh-8?below:Math.max(8,clientY-rect.height-gap);dom.contextMenu.style.left=`${left}px`;dom.contextMenu.style.top=`${top}px`;return{left,top};}
function onCanvasContextMenu(event){event.preventDefault();if(state.selection||state.mergeMode)return;const hit=hitTest(event);if(!hit)return;
  dom.contextMenu.innerHTML=`${hit.halfZone==='plan'?'<button class="primary" data-action="start">▶ 开始学习</button>':''}<button data-action="detail">查看学习详情</button><button data-action="edit">编辑事件</button><button class="danger" data-action="delete">删除事件</button>`;dom.contextMenu.style.left=`${event.clientX}px`;dom.contextMenu.style.top=`${event.clientY}px`;dom.contextMenu.classList.remove('hidden');
  positionContextMenu(event.clientX,event.clientY);
  const startButton=dom.contextMenu.querySelector('[data-action="start"]');if(startButton)startButton.onclick=()=>{hideContextMenu();startPlanEvent(hit.id);};
  dom.contextMenu.querySelector('[data-action="detail"]').onclick=()=>{hideContextMenu();openEventDetail(hit.id);};
  dom.contextMenu.querySelector('[data-action="edit"]').onclick=()=>{hideContextMenu();openEventModal(hit);};dom.contextMenu.querySelector('[data-action="delete"]').onclick=()=>{hideContextMenu();deleteEvent(hit.id);};
}
function hideContextMenu(){dom.contextMenu.classList.add('hidden');dom.contextMenu.innerHTML='';}
function showTimelineTooltip(clientX,clientY,text){const vw=Number(window.innerWidth)||1024,vh=Number(window.innerHeight)||768,gap=12;dom.timelineTooltip.textContent=text;dom.timelineTooltip.style.left='8px';dom.timelineTooltip.style.top='8px';dom.timelineTooltip.classList.remove('hidden');const rect=dom.timelineTooltip.getBoundingClientRect(),left=clamp(clientX+gap,8,Math.max(8,vw-rect.width-8)),below=clientY+gap,top=below+rect.height<=vh-8?below:Math.max(8,clientY-rect.height-gap);dom.timelineTooltip.style.left=`${left}px`;dom.timelineTooltip.style.top=`${top}px`;return{left,top};}

function renderMergeBar(){
  const existing=new Set(state.events.map(event=>event.id));state.mergeSelection=new Set([...state.mergeSelection].filter(id=>existing.has(id)));const count=state.mergeSelection.size;dom.eventMergeBar.classList.toggle('hidden',!state.mergeMode);dom.eventMergeCount.textContent=`已选择 ${count} 条`;dom.confirmEventMergeBtn.disabled=count<2;
  dom.mergeEventsBtn.classList.toggle('active',state.mergeMode);setToolLabel(dom.mergeEventsBtn,state.mergeMode?'选择中':'合并',state.mergeMode?'✓':'并');
}
function toggleMergeMode(){
  if(state.mergeMode){cancelMergeMode();return;}
  cancelSelection();closeAllModals();state.mergeMode=true;state.mergeSelection.clear();state.selectedEventId=null;dom.eventMergeName.value='';dom.eventMergeStrategy.value='least-progress';renderMergeBar();renderTimeline();
}
function cancelMergeMode(){state.mergeMode=false;state.mergeSelection.clear();dom.eventMergeName.value='';renderMergeBar();dom.timelineTooltip.classList.add('hidden');renderTimeline();}
function uniqueJoined(values,separator){return [...new Set(values.map(value=>String(value||'').trim()).filter(Boolean))].join(separator);}
function eventEndTimestamp(event){const date=parseDate(event.date),seconds=Math.round(Number(event.endSlot||0)*60);date.setHours(0,0,0,0);date.setSeconds(seconds);return date.getTime();}
function relatedMergeEvents(event){return event.focusTaskId?state.events.filter(item=>item.focusTaskId===event.focusTaskId&&item.halfZone==='record'&&(item.taskType||'learn')==='learn'):[event];}
function toggleMergeEventSelection(event){const related=relatedMergeEvents(event),remove=related.every(item=>state.mergeSelection.has(item.id));related.forEach(item=>remove?state.mergeSelection.delete(item.id):state.mergeSelection.add(item.id));}
function mergeReviewSourceId(event){return taskById(event.focusTaskId)?.reviewSourceEventId||event.id;}
function selectMergeBaseline(selected){
  const candidates=[],seen=new Set();selected.forEach((event,order)=>{const sourceId=mergeReviewSourceId(event);if(seen.has(sourceId))return;seen.add(sourceId);const reviews=state.reviews.filter(review=>review.sourceEventId===sourceId),completed=reviews.filter(review=>review.completed&&!review.abandoned),related=relatedMergeEvents(event);candidates.push({sourceId,completedCount:completed.length,lastCompletedDate:completed.map(review=>review.completedAt||review.reviewDate).sort().at(-1)||null,taskDate:related.map(item=>item.completedDate||item.date).sort().at(-1)||event.date,order});});
  return candidates.sort((a,b)=>a.completedCount-b.completedCount||b.taskDate.localeCompare(a.taskDate)||a.order-b.order)[0]||{completedCount:0,lastCompletedDate:null};
}
function rebuildMergedReviews(task,source,baseline,strategy){
  if(!source||!task.reviewSourceEventId)return;removeReviewsForSource(source.id,'events-merged-regenerated');
  if(strategy==='restart'||!baseline.completedCount){generateReviews(source);return;}
  const completedCount=Math.min(baseline.completedCount,state.settings.reviewIntervals.length),lastIndex=Math.max(0,completedCount-1),base=parseDate(normalizeDate(baseline.lastCompletedDate||source.completedDate||source.date));
  state.settings.reviewIntervals.forEach((offset,index)=>{if(index<completedCount)return;const delta=Math.max(1,offset-state.settings.reviewIntervals[lastIndex]);state.reviews.push({id:uid('review'),sourceEventId:source.id,reviewDate:dateKey(addDays(base,delta)),reviewNumber:index+1,intervalDays:offset,...reviewSnapshot(source),completed:false,abandoned:false,regeneratedFromReviewCount:completedCount});});
}
function mergeSelectedEvents(name='',strategy=dom.eventMergeStrategy?.value||'least-progress'){
  const selected=[...state.mergeSelection].map(id=>state.events.find(event=>event.id===id)).filter(Boolean).sort((a,b)=>a.date.localeCompare(b.date)||a.startSlot-b.startSlot||a.endSlot-b.endSlot);
  if(selected.length<2){window.alert('请至少选择两条学习事件。');return false;}
  if(selected.some(event=>event.halfZone!=='record'||(event.taskType||'learn')!=='learn')){window.alert('只能合并记录区的学习事件。');return false;}
  if(new Set(selected.map(event=>(event.subjectPath||[event.categoryId]).join('/'))).size>1){window.alert('请选择同一学科层级下的事件进行合并。');return false;}
  if(selected.some(eventHasRunningDependency)){window.alert('请先暂停选中事件及其关联复习。');return false;}
  const selectedIds=new Set(selected.map(event=>event.id)),oldTasks=[...new Set(selected.map(event=>taskById(event.focusTaskId)).filter(Boolean))];
  if(oldTasks.some(task=>state.events.some(event=>event.focusTaskId===task.id&&!selectedIds.has(event.id)))){window.alert('多段任务必须选中它的全部时段后再合并。');return false;}
  const baseline=selectMergeBaseline(selected),first=selected[0],last=selected.at(-1),subject=subjectById(first.categoryId),mergedName=String(name||'').trim()||eventTitle(first),sources=new Set(selected.map(event=>event.id));
  oldTasks.forEach(task=>{if(task.reviewSourceEventId)sources.add(task.reviewSourceEventId);});
  pushHistory();sources.forEach(sourceId=>removeReviewsForSource(sourceId,'events-merged'));
  oldTasks.forEach(task=>{task.status='abandoned';task.abandonedAt=new Date().toISOString();task.abandonReason='events-merged';task.segmentEventIds=[];task.totalSeconds=0;});
  const actionTypes=normalizeActionTypes(selected.flatMap(event=>event.actionTypes||[])),fields={eventName:mergedName,materialLocation:uniqueJoined(selected.map(event=>event.materialLocation),'；'),progress:[...selected].reverse().find(event=>event.progress)?.progress||'',summary:uniqueJoined(selected.map(event=>event.textContent),'\n'),notes:uniqueJoined(selected.map(event=>event.notes),'\n\n'),leftover:uniqueJoined(selected.map(event=>event.leftover),'\n'),mastery:[...selected].reverse().find(event=>event.mastery&&event.mastery!=='unknown')?.mastery||first.mastery||'unknown',actionType:actionTypes[0],actionTypes};
  const task={id:uid('task'),status:'paused',taskType:'learn',categoryId:first.categoryId,categoryName:first.categoryName,subjectPath:[...(first.subjectPath||[first.categoryId])],color:first.color||subject?.color||state.settings.defaultRecordColor,type:'countup',durationSeconds:0,sourceEventId:null,reviewId:null,planEventId:null,leftoverEventId:null,suppressReviews:false,createdAt:new Date(Math.min(...selected.map(event=>eventEndTimestamp(event)))).toISOString(),totalSeconds:selected.reduce((sum,event)=>sum+focusSeconds(event),0),segmentEventIds:selected.map(event=>event.id),fields,mergedSourceEventIds:selected.map(event=>event.id)};
  state.focusTasks.push(task);selected.forEach(event=>{event.focusTaskId=task.id;delete event.sourceEventId;delete event.sourceReviewId;delete event.sourcePlanEventId;});syncTaskRecords(task);
  const completedAt=Math.max(...selected.map(event=>eventEndTimestamp(event)));completeFocusTask(task,completedAt);
  if(task.reviewSourceEventId){const generatedSourceId=task.reviewSourceEventId;if(generatedSourceId!==first.id)removeReviewsForSource(generatedSourceId,'events-merged-regenerated');task.reviewSourceEventId=first.id;rebuildMergedReviews(task,first,baseline,strategy);}
  validateConflicts();state.selectedDetailEventId=first.id;state.mergeMode=false;state.mergeSelection.clear();dom.eventMergeName.value='';saveBackup();renderAll();renderMergeBar();openEventDetail(first.id);return true;
}
function submitEventMerge(){mergeSelectedEvents(dom.eventMergeName.value,dom.eventMergeStrategy.value);}

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
  if(!state.layoutEditing)return;event.preventDefault();const handle=event.currentTarget,startX=event.clientX,focusWidth=dom.focusCard.getBoundingClientRect().width;handle.classList.add('dragging');
  const move=(e)=>{const rect=document.querySelector('.side-panel').getBoundingClientRect();if(type==='side'&&state.settings.layoutMode==='columns'&&window.matchMedia('(min-width: 1000px)').matches){state.settings.focusColumnWidth=clamp(focusWidth+startX-e.clientX,245,560);}else if(type==='side'){const mainRect=dom.mainLayout.getBoundingClientRect();state.settings.sideWidth=clamp(mainRect.right-e.clientX,260,560);}else{state.settings.focusHeight=clamp(e.clientY-rect.top-4,180,600);}applyLayoutSettings();renderTimeline();};
  const up=()=>{handle.classList.remove('dragging');saveBackup();window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);};
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);
}
function applyLayoutSettings(){document.documentElement.style.setProperty('--focus-column-width',`${clamp(Number(state.settings.focusColumnWidth)||320,245,560)}px`);dom.layoutMode.value=state.settings.layoutMode||'stacked';dom.mainLayout.classList.toggle('three-columns',state.settings.layoutMode==='columns');document.documentElement.style.setProperty('--side-width',`${state.settings.sideWidth}px`);document.documentElement.style.setProperty('--date-height',`${state.settings.dateHeight||62}px`);document.documentElement.style.setProperty('--focus-height',`${state.settings.focusCollapsed?54:state.settings.focusHeight}px`);document.body.classList.toggle('compact-toolbar',Boolean(state.settings.compactToolbar));dom.focusCard.classList.toggle('collapsed',Boolean(state.settings.focusCollapsed));dom.focusCollapseBtn.textContent=state.settings.focusCollapsed?'◌':'◉';dom.focusCollapseBtn.setAttribute('aria-label',state.settings.focusCollapsed?'展开专注计时':'收纳专注计时');}
function toggleFocusCollapsed(){state.settings.focusCollapsed=!state.settings.focusCollapsed;applyLayoutSettings();saveBackup();renderTimeline();}
function resetLayout(){state.settings.focusColumnWidth=320;state.settings.layoutMode='stacked';state.settings.sideWidth=330;state.settings.dateHeight=62;state.settings.focusHeight=180;state.settings.planRatio=.5;state.settings.focusCollapsed=false;applyLayoutSettings();syncSettingsToUI();saveBackup();renderTimeline();}

function overlayFocusables(el){return [...el.querySelectorAll('button, input:not([type="hidden"]), select, textarea, summary, a[href], [tabindex]')].filter(node=>!node.disabled&&node.tabIndex>=0&&node.getClientRects().length);}
function openModal(id){const el=document.getElementById(id);if(!el)return;state.modalReturnFocus.set(id,document.activeElement);state.modalStack=state.modalStack.filter(item=>item!==id);state.modalStack.push(id);el.classList.remove('hidden');el.setAttribute('aria-hidden','false');el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');overlayFocusables(el)[0]?.focus();}
function closeModal(id){if(id==='focusDetailModal'){state.pendingFocus=null;renderUnfinishedTasks();}if(id==='inputDialogModal')state.inputDialog=null;const el=document.getElementById(id);if(!el)return;const wasTop=state.modalStack.at(-1)===id;state.modalStack=state.modalStack.filter(item=>item!==id);el.classList.add('hidden');el.setAttribute('aria-hidden','true');const previous=state.modalReturnFocus.get(id);state.modalReturnFocus.delete(id);if(wasTop&&previous?.isConnected&&previous.getClientRects().length)previous.focus();}
function closeAllModals(){[...state.modalStack].reverse().forEach(closeModal);state.pendingFocus=null;state.inputDialog=null;document.querySelectorAll('.modal').forEach((el)=>{el.classList.add('hidden');el.setAttribute('aria-hidden','true');});renderUnfinishedTasks();}
function openInputDialog({title,label,value='',type='text',description='',allowEarlier=false,onSubmit}){
  state.inputDialog={onSubmit};dom.inputDialogTitle.textContent=title;dom.inputDialogLabel.textContent=label;dom.inputDialogDescription.textContent=description;
  dom.inputDialogValue.type=type;dom.inputDialogValue.value=value;dom.inputDialogError.textContent='';dom.inputDialogEarlier.checked=false;dom.inputDialogEarlierWrap.classList.toggle('hidden',!allowEarlier);
  openModal('inputDialogModal');dom.inputDialogValue.focus();
}
function submitInputDialog(event){
  event.preventDefault();const dialog=state.inputDialog;if(!dialog)return;const value=dom.inputDialogValue.value.trim();
  const error=value?dialog.onSubmit(value):'请填写有效内容。';if(error){dom.inputDialogError.textContent=error;dom.inputDialogValue.focus();return;}closeModal('inputDialogModal');
}
function trapOverlayTab(event){
  if(event.key!=='Tab')return false;
  const overlay=state.modalStack.length?document.getElementById(state.modalStack.at(-1)):!dom.immersionOverlay.classList.contains('hidden')?dom.immersionOverlay:dom.reviewCard.classList.contains('fullscreen')?dom.reviewCard:null;
  if(!overlay)return false;const items=overlayFocusables(overlay);if(!items.length)return false;const index=items.indexOf(document.activeElement),next=index<0?(event.shiftKey?items.length-1:0):(index+(event.shiftKey?-1:1)+items.length)%items.length;
  event.preventDefault();items[next].focus();return true;
}
function closeToolbarMenu(){dom.toolbarMenu.classList.add('hidden');dom.toolbarMenuBtn.setAttribute('aria-expanded','false');document.body.classList.remove('toolbar-menu-open');}

function syncCategoryOptions(selectedId) {
  dom.eventCategory.innerHTML=state.categories.map((s)=>`<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  dom.eventCategory.value=selectedId&&subjectById(selectedId)?selectedId:state.categories[0]?.id||'';syncSubcategoryOptions();syncTopicOptions();refreshSubjectPathOptions();
}
function syncSubcategoryOptions(selectedId) {
  const root=subjectById(dom.eventCategory.value),items=root?.children||[];
  dom.eventSubcategory.innerHTML='<option value="">不继续选择</option>'+items.map((s)=>`<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  dom.eventSubcategory.value=selectedId&&items.some((s)=>s.id===selectedId)?selectedId:'';syncTopicOptions();
}
function syncTopicOptions(selectedId) {
  const root=subjectById(dom.eventCategory.value),second=root?.children?.find((s)=>s.id===dom.eventSubcategory.value),items=second?.children||[];
  dom.eventTopic.innerHTML='<option value="">不继续选择</option>'+items.map((s)=>`<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  dom.eventTopic.value=selectedId&&items.some((s)=>s.id===selectedId)?selectedId:'';
}
function subjectPathOptions(){const options=[];state.categories.forEach((root)=>{options.push({label:root.name,ids:[root.id]});(root.children||[]).forEach((second)=>{options.push({label:`${root.name} / ${second.name}`,ids:[root.id,second.id]});(second.children||[]).forEach((third)=>options.push({label:`${root.name} / ${second.name} / ${third.name}`,ids:[root.id,second.id,third.id]}));});});return options;}
function refreshSubjectPathOptions(){dom.eventSubjectOptions.innerHTML=subjectPathOptions().map((option)=>`<option value="${escapeHtml(option.label)}"></option>`).join('');}
function syncSubjectPicker(){dom.eventSubjectPath.value=selectedSubjectNodes().map((node)=>node.name).join(' / ');dom.eventSubjectPath.setCustomValidity('');}
function applySubjectPicker(){const value=dom.eventSubjectPath.value.trim(),option=subjectPathOptions().find((item)=>item.label===value);if(!option){dom.eventSubjectPath.setCustomValidity('请从学科路径候选项中选择');return false;}const changed=selectedSubjectNodes().map(node=>node.id).join('/')!==option.ids.join('/');dom.eventCategory.value=option.ids[0];syncSubcategoryOptions(option.ids[1]);if(option.ids[2])syncTopicOptions(option.ids[2]);syncSubjectPicker();if(changed)syncEventAppearance();return true;}
function eventHasRunningDependency(event){
  if(!event)return false;const task=taskById(event.focusTaskId),sourceIds=new Set([event.id,task?.reviewSourceEventId].filter(Boolean));
  return task?.status==='running'||Boolean(state.focus&&(sourceIds.has(state.focus.sourceEventId)||state.reviews.some(review=>review.id===state.focus.reviewId&&sourceIds.has(review.sourceEventId))));
}
function openEventModal(event=null,preset=null) {
  const task=taskById(event?.focusTaskId);if(eventHasRunningDependency(event)){window.alert('请先暂停这个任务及其关联复习，再编辑记录。');return;}
  state.editingEventId=event?.id||null;dom.eventModalTitle.textContent=event?'编辑事件':'添加事件';
  dom.eventHalfZone.value=event?.halfZone||preset?.halfZone||state.settings.defaultSelectionZone;dom.eventTaskType.value=event?.taskType==='focus'?'learn':event?.taskType||'learn';dom.eventName.value=event?eventTitle(event):'';dom.eventTextContent.value=event?.textContent||'';
  dom.eventHalfZone.disabled=Boolean(task);dom.eventTaskType.disabled=Boolean(task);dom.eventTaskEditNotice.classList.toggle('hidden',!task);
  dom.eventNotes.value=event?.notes||'';
  dom.eventMaterialLocation.value=event?.materialLocation||'';dom.eventProgress.value=event?.progress||'';dom.eventMastery.value=event?.mastery||'unknown';
  dom.eventLeftover.value=event?.leftover||'';dom.eventImportant.checked=Boolean(event?.important);
  const selectedAction=normalizeActionTypes(event?.actionTypes)[0];document.querySelectorAll('.event-action-type').forEach((input)=>{input.checked=input.value===selectedAction;});
  const path=event?.subjectPath||[];syncCategoryOptions(event?.categoryId||path[0]);if(path[1])syncSubcategoryOptions(path[1]);if(path[2])syncTopicOptions(path[2]);syncSubjectPicker();
  const subject=subjectById(dom.eventCategory.value);dom.eventColor.value=event?.color||subject?.color||state.settings.defaultPlanColor;dom.eventOpacity.value=event?.opacity??subject?.opacity??.86;
  dom.eventTextSize.value=event?.textSize||subject?.textSize||state.settings.defaultTextSize;dom.eventTextColor.value=event?.textColor||state.settings.defaultTextColor;dom.eventTextOpacity.value=event?.textOpacity??subject?.textOpacity??.92;
  const startSlot=event?.startSlot??preset?.startSlot??480,endSlot=event?.endSlot??preset?.endSlot??540,start=eventTimeParts(startSlot),end=eventTimeParts(endSlot);
  state.editingEventTime=event?{start:{...start,slot:startSlot},end:{...end,slot:endSlot}}:null;
  dom.eventStartHour.value=start.hour;dom.eventStartMinute.value=start.minute;dom.eventStartSecond.value=start.second;dom.eventEndHour.value=end.hour;dom.eventEndMinute.value=end.minute;dom.eventEndSecond.value=end.second;updateTimeSummary();openModal('eventModal');setTimeout(()=>dom.eventName.focus(),0);
}
function selectedActionTypes(){return normalizeActionTypes([...document.querySelectorAll('.event-action-type:checked')].map((input)=>input.value));}




function readEventTime(){
  const read=(prefix,maxHour,original)=>{const inputs=[dom[prefix+'Hour'],dom[prefix+'Minute'],dom[prefix+'Second']];if(inputs.some(input=>String(input.value).trim()===''))return null;const [hour,minute,second]=inputs.map(input=>Number(input.value));if(!Number.isInteger(hour)||hour<0||hour>maxHour||!Number.isInteger(minute)||minute<0||minute>59||!Number.isFinite(second)||second<0||second>=60||(hour===24&&(minute!==0||second!==0)))return null;if(original&&hour===original.hour&&minute===original.minute&&second===original.second)return original.slot;return hour*60+minute+second/60;};
  const startSlot=read('eventStart',23,state.editingEventTime?.start),endSlot=read('eventEnd',24,state.editingEventTime?.end);return startSlot===null||endSlot===null?null:{startSlot,endSlot};
}
function updateTimeSummary(){const r=readEventTime();dom.eventTimeSummary.textContent=r?`${eventTimeLabel(r.startSlot)} – ${eventTimeLabel(r.endSlot)}`:'请选择有效时间（结束可为 24:00:00）';}
function syncEventAppearance(){const nodes=selectedSubjectNodes(),root=nodes[0];if(!root)return;dom.eventColor.value=root.color;dom.eventOpacity.value=root.opacity;dom.eventTextSize.value=root.textSize;dom.eventTextOpacity.value=root.textOpacity;}
function saveEvent() {
  const previous=state.events.find(event=>event.id===state.editingEventId),task=taskById(previous?.focusTaskId);
  if(eventHasRunningDependency(previous)){window.alert('请先暂停这个任务及其关联复习，再编辑记录。');return;}
  const range=readEventTime();if(!range||range.endSlot<=range.startSlot){window.alert('请选择有效的起止时间。');return;}
  const timeChanged=!previous||range.startSlot!==previous.startSlot||range.endSlot!==previous.endSlot;
  if(timeChanged&&!isRangeVisible(range.startSlot,range.endSlot)){window.alert('事件不能跨越隐藏时段。');return;}if(!applySubjectPicker()){dom.eventSubjectPath.reportValidity();return;}
  const nodes=selectedSubjectNodes(),root=nodes[0],next={...(previous||{}),id:state.editingEventId||uid('event'),date:previous?.date||currentDateKey(),halfZone:task?previous.halfZone:dom.eventHalfZone.value,taskType:task?task.taskType:dom.eventTaskType.value,
    categoryId:root?.id||null,categoryName:nodes.map((n)=>n.name).join('/'),subjectPath:nodes.map((n)=>n.id),startSlot:range.startSlot,endSlot:range.endSlot,color:dom.eventColor.value,
    opacity:Number(dom.eventOpacity.value),eventName:dom.eventName.value.trim()||'学习事件',actionTypes:selectedActionTypes().slice(0,1),materialLocation:dom.eventMaterialLocation.value.trim(),progress:dom.eventProgress.value.trim(),mastery:dom.eventMastery.value,
    textContent:dom.eventTextContent.value.trim(),notes:dom.eventNotes.value.trim(),leftover:dom.eventLeftover.value.trim(),important:dom.eventImportant.checked,textSize:clamp(Number(dom.eventTextSize.value)||13,10,24),textColor:dom.eventTextColor.value,textOpacity:clamp(Number(dom.eventTextOpacity.value)||.92,.1,1),conflict:false};
  if(previous?.leftover!==next.leftover)delete next.leftoverCompletedAt;
  if(timeChanged&&(task||Number.isFinite(previous?.focusSeconds)))next.focusSeconds=Math.max(0,Math.round((range.endSlot-range.startSlot)*60000)/1000);
  pushHistory();if(state.editingEventId){const i=state.events.findIndex((e)=>e.id===state.editingEventId);if(i>=0)state.events[i]=next;}else state.events.push(next);
  if(task){
    if(previous?.leftover!==next.leftover)delete task.leftoverCompletedAt;
    Object.assign(task,{categoryId:next.categoryId,categoryName:next.categoryName,subjectPath:[...next.subjectPath],color:next.color});
    task.fields={...task.fields,eventName:next.eventName,materialLocation:next.materialLocation,progress:next.progress,summary:next.textContent,notes:next.notes,leftover:next.leftover,mastery:next.mastery,actionType:next.actionTypes[0]||'new',actionTypes:next.actionTypes.length?next.actionTypes:['new']};
    recomputeTaskDuration(task);syncTaskRecords(task);
  }else if(!next.focusTaskId){const deepest=nodes.at(-1),reviewEnabled=next.halfZone==='record'&&next.taskType==='learn'&&deepest?.reviewEnabled!==false;syncGeneratedReviews(next,reviewEnabled);}
  validateConflicts();saveBackup();closeModal('eventModal');state.editingEventId=null;state.editingEventTime=null;renderAll();checkPlanReminders();
}
function eventTitle(event){return event?.eventName||event?.knowledgePoint||event?.textContent||event?.categoryName||'学习事件';}
function reviewSnapshot(event){return{categoryId:event.categoryId,categoryName:event.categoryName,eventName:eventTitle(event),actionTypes:normalizeActionTypes(event.actionTypes),materialLocation:event.materialLocation||'',mastery:event.mastery||'unknown',leftover:event.leftover||'',important:Boolean(event.important),textContent:event.textContent||''};}

function generateReviews(event){
  if(state.reviews.some(review=>review.sourceEventId===event.id))return;
  const baseDate=event.completedDate||event.date;
  state.settings.reviewIntervals.forEach((offset,index)=>state.reviews.push({id:uid('review'),sourceEventId:event.id,reviewDate:dateKey(addDays(parseDate(baseDate),offset)),reviewNumber:index+1,intervalDays:offset,...reviewSnapshot(event),completed:false,abandoned:false}));
}

function syncGeneratedReviews(event,enabled){const existing=state.reviews.filter((review)=>review.sourceEventId===event.id);if(!enabled){removeReviewsForSource(event.id,'review-disabled');return;}if(!existing.length){generateReviews(event);return;}const snapshot=reviewSnapshot(event);existing.forEach((review)=>Object.assign(review,snapshot));syncPausedReviewSource(event);}
function syncPausedReviewSource(source){
  const ids=new Set(state.reviews.filter(review=>review.sourceEventId===source.id).map(review=>review.id));
  state.focusTasks.filter(task=>task.status==='paused'&&ids.has(task.reviewId)).forEach(task=>{
    Object.assign(task,{categoryId:source.categoryId,categoryName:source.categoryName,subjectPath:[...(source.subjectPath||[source.categoryId])],color:source.color||subjectById(source.categoryId)?.color,preserveSourceMaterial:true});
    task.fields.eventName=eventTitle(source);syncTaskRecords(task);
  });
}
function removeReviewsForSource(sourceId,reason='source-deleted'){
  const ids=new Set(state.reviews.filter(review=>review.sourceEventId===sourceId).map(review=>review.id));
  state.reviews=state.reviews.filter(review=>!ids.has(review.id));
  state.focusTasks.filter(task=>ids.has(task.reviewId)&&task.status==='paused').forEach(task=>{
    task.status='abandoned';task.abandonedAt=new Date().toISOString();task.abandonReason=reason;syncTaskRecords(task);
    if(state.pendingFocus?.taskId===task.id)closeModal('focusDetailModal');
  });
}
function validateConflicts(){state.events.forEach((e)=>e.conflict=false);state.events.forEach((e,i)=>state.events.slice(i+1).forEach((o)=>{if(e.date===o.date&&e.halfZone===o.halfZone&&e.startSlot<o.endSlot&&o.startSlot<e.endSlot){e.conflict=true;o.conflict=true;}}));}
function deleteEvent(id){
  const event=state.events.find(item=>item.id===id),task=taskById(event?.focusTaskId);
  if(!event)return;
  if(eventHasRunningDependency(event)){window.alert('请先暂停这个任务及其关联复习，再删除记录。');return;}
  if(!window.confirm('确认删除这个事件？'))return;
  pushHistory();state.events=state.events.filter(e=>e.id!==id);removeReviewsForSource(id);
  if(task){recomputeTaskDuration(task);if(!task.segmentEventIds.length&&task.status==='paused')task.status='abandoned';if(task.reviewSourceEventId===id)task.reviewSourceEventId=null;syncTaskRecords(task);if(task.status==='abandoned'&&state.pendingFocus?.taskId===task.id)closeModal('focusDetailModal');}
  if(state.pendingPlanReminderId===id)closePlanReminder();validateConflicts();saveBackup();renderAll();
}

function effectiveLeftover(review,source=reviewSource(review)){return source?.leftoverCompletedAt?'':(review?.leftover||source?.leftover||'');}
function reviewStatusText(review){if(review.completed)return'✓ 已完成';if(review.abandoned)return'× 已放弃';if(review.originalReviewDate&&review.reviewDate!==review.originalReviewDate)return`↪ 从 ${review.originalReviewDate} 顺延`;return'○ 待复习';}
function openEventDetail(id){const event=state.events.find((item)=>item.id===id);if(!event)return;state.selectedDetailEventId=id;renderEventDetail();openModal('eventDetailModal');}
function renderEventDetail(){
  const event=state.events.find(item=>item.id===state.selectedDetailEventId);if(!event){closeModal('eventDetailModal');return;}
  const task=taskById(event.focusTaskId),subject=subjectById(event.categoryId),reviewSourceId=task?.reviewSourceEventId||event.id;
  const reviews=state.reviews.filter(review=>review.sourceEventId===reviewSourceId).sort((a,b)=>a.reviewNumber-b.reviewNumber);
  const actions=normalizeActionTypes(event.actionTypes).map(type=>ACTION_TYPE_LABELS[type]).filter(Boolean),leftover=event.leftover||'',resolved=Boolean(event.leftoverCompletedAt);
  dom.eventDetailTitle.textContent='事件详情';
  const schedule=reviews.length?reviews.map(review=>`<button class="review-schedule-row ${review.completed?'completed':''} ${review.abandoned?'abandoned':''}" data-detail-review="${review.id}"><b>D${reviewIntervalDays(review,event)}</b><span>${review.reviewDate} · 第 ${review.reviewNumber} 次</span><span class="status">${reviewStatusText(review)}</span></button>`).join(''):'<p class="settings-note">未完成的学习任务不会生成复习排期。</p>';
  const segments=(task?state.events.filter(item=>item.focusTaskId===task.id):[event]).sort((a,b)=>a.date.localeCompare(b.date)||a.startSlot-b.startSlot),totalSeconds=task?.totalSeconds??focusSeconds(event),status=task?taskStatusLabel(task.status):'已完成';
  dom.eventDetailBody.innerHTML=`<section class="event-detail-hero" style="--event-color:${subject?.color||event.color||'#527a64'}"><span>${escapeHtml(event.categoryName||'未分类')}</span><h4>${escapeHtml(eventTitle(event))}</h4><p>${escapeHtml(event.materialLocation||'未填写资料定位')}</p>${actions.length?`<small>${escapeHtml(actions.join(' / '))}</small>`:''}</section>
    <section class="event-detail-section wide"><h4>学习摘要与掌握程度</h4><div class="event-detail-facts"><div><span>学习摘要</span><b>${escapeHtml(event.textContent||'未填写')}</b></div><div><span>掌握程度</span><b>${MASTERY_LABELS[event.mastery]||'尚未判断'}</b></div>${event.progress?`<div><span>学习进度</span><b>${escapeHtml(event.progress)}</b></div>`:''}</div></section>
    <section class="event-detail-section"><h4>学习笔记</h4><textarea id="detailLearningNotes" class="learning-notes" maxlength="1200" placeholder="自己的理解、推导和易错点">${escapeHtml(event.notes||'')}</textarea><button id="detailSaveLearningBtn" class="tool-btn primary">保存笔记</button></section>
    <section class="event-detail-section"><h4>遗留内容</h4>${leftover?`<div class="detail-leftover ${resolved?'resolved':''}">${escapeHtml(leftover)}</div><div class="detail-section-actions"><button id="detailLeftoverToggleBtn" class="tool-btn">${resolved?'恢复待处理':'标记已解决'}</button>${resolved?'':`<button id="detailLeftoverStartBtn" class="tool-btn primary">开始处理</button>`}</div>`:'<p class="settings-note">没有遗留内容。</p>'}</section>
    <section class="event-detail-section wide"><h4>${status} · 总时长 ${roundedClockLabel(totalSeconds)} · ${segments.length} 段</h4><ul class="task-segments">${segments.map(segment=>`<li>${segment.date} ${eventTimeSecondLabel(segment.startSlot)}–${eventTimeSecondLabel(segment.endSlot)} · ${roundedClockLabel(focusSeconds(segment))}</li>`).join('')}</ul></section>
    <section class="event-detail-section wide review-schedule-final"><h4>复习排期 <span>${reviews.length} 次</span></h4><div class="review-schedule-list">${schedule}</div></section>`;
  dom.eventDetailBody.querySelectorAll('[data-detail-review]').forEach(button=>button.onclick=()=>{closeModal('eventDetailModal');openReviewDetail(button.dataset.detailReview);});
  document.getElementById('detailSaveLearningBtn').onclick=saveEventLearningDetails;
  const toggle=document.getElementById('detailLeftoverToggleBtn'),start=document.getElementById('detailLeftoverStartBtn');
  if(toggle)toggle.onclick=()=>toggleLeftover(event.id);if(start)start.onclick=()=>startLeftoverEvent(event.id);
  const pending=reviews.find(review=>!review.completed&&!review.abandoned&&review.reviewDate<=dateKey(new Date()));
  const canReopen=event.halfZone==='record'&&(event.taskType||'learn')==='learn'&&(task?task.status==='completed':true);dom.eventDetailReopenBtn.classList.toggle('hidden',!canReopen);dom.eventDetailReopenBtn.disabled=Boolean(eventHasRunningDependency(event));
  dom.eventDetailStartBtn.disabled=Boolean(task?.status==='running'||(event.planCompletedAt&&event.halfZone==='plan'&&!pending));
  dom.eventDetailStartBtn.textContent=task?.status==='paused'?'继续未完成任务':task?.status==='running'?'正在计时':pending?'开始到期复习':'开始学习';
}

function saveEventLearningDetails(){const event=state.events.find(item=>item.id===state.selectedDetailEventId);if(!event)return;pushHistory();event.notes=document.getElementById('detailLearningNotes')?.value.trim()||'';const task=taskById(event.focusTaskId);if(task){task.fields.notes=event.notes;syncTaskRecords(task);}saveBackup();renderEventDetail();}

function taskFieldsFromEvent(event){const actionTypes=normalizeActionTypes(event.actionTypes);return{eventName:eventTitle(event),materialLocation:event.materialLocation||'',progress:event.progress||'',summary:event.textContent||'',notes:event.notes||'',leftover:event.leftover||'',mastery:event.mastery||'unknown',actionType:actionTypes[0],actionTypes};}
function reopenCompletedEvent(id){
  const event=state.events.find(item=>item.id===id);if(!event||event.halfZone!=='record'||(event.taskType||'learn')!=='learn')return false;
  if(eventHasRunningDependency(event)){window.alert('请先暂停这个任务及其关联复习。');return false;}
  let task=taskById(event.focusTaskId);if(task&&task.status!=='completed')return false;
  if(!window.confirm('将这个已完成事件回退为未完成？关联复习排期会同步撤销。'))return false;
  pushHistory();const sourceId=task?.reviewSourceEventId||event.id;removeReviewsForSource(sourceId,'completion-reopened');
  if(!task){const subject=subjectById(event.categoryId);task={id:uid('task'),status:'paused',taskType:'learn',categoryId:event.categoryId,categoryName:event.categoryName,subjectPath:[...(event.subjectPath||[event.categoryId])],color:event.color||subject?.color||state.settings.defaultRecordColor,type:'countup',durationSeconds:0,sourceEventId:null,reviewId:null,planEventId:event.sourcePlanEventId||null,leftoverEventId:null,suppressReviews:false,createdAt:new Date(eventEndTimestamp(event)).toISOString(),totalSeconds:focusSeconds(event),segmentEventIds:[event.id],fields:taskFieldsFromEvent(event)};state.focusTasks.push(task);event.focusTaskId=task.id;}
  task.status='paused';delete task.completedAt;delete task.reviewSourceEventId;delete task.abandonedAt;delete task.abandonReason;recomputeTaskDuration(task);state.events.filter(item=>item.focusTaskId===task.id).forEach(item=>delete item.completedDate);syncTaskRecords(task);
  if(task.planEventId){const plan=state.events.find(item=>item.id===task.planEventId);if(plan){delete plan.planCompletedAt;if(task.segmentEventIds.includes(plan.generatedEventId))delete plan.generatedEventId;}}
  saveBackup();renderAll();renderEventDetail();return true;
}

function editSelectedDetailEvent(){const event=state.events.find((item)=>item.id===state.selectedDetailEventId);if(!event)return;closeModal('eventDetailModal');openEventModal(event);}
function startSelectedDetailEvent(){
  const event=state.events.find(item=>item.id===state.selectedDetailEventId);if(!event)return;
  closeModal('eventDetailModal');const task=taskById(event.focusTaskId);
  if(task?.status==='paused'){resumeFocusTask(task.id);return;}
  const review=state.reviews.find(item=>item.sourceEventId===(task?.reviewSourceEventId||event.id)&&!item.completed&&!item.abandoned&&item.reviewDate<=dateKey(new Date()));
  if(review){startReview(review.id);return;}if(event.halfZone==='plan'){startPlanEvent(event.id);return;}startSourceEvent(event,'learn');
}

function openLeftoverPool(){renderLeftoverPool();openModal('leftoverModal');}
function leftoverOwner(event){
  const seen=new Set();let current=event;
  while(current&&!seen.has(current.id)){
    seen.add(current.id);const task=taskById(current.focusTaskId),sourceId=task?.leftoverEventId||task?.sourceEventId||current.sourceEventId||task?.planEventId;
    const source=state.events.find(item=>item.id===sourceId&&item.leftover&&item.leftover===current.leftover);
    if(source&&!seen.has(source.id)){current=source;continue;}
    return state.events.find(item=>current.focusTaskId&&item.focusTaskId===current.focusTaskId&&item.leftover===current.leftover)||current;
  }return current||event;
}
function leftoverEntries(){return [...new Map(state.events.filter(event=>event.leftover).map(event=>{const owner=leftoverOwner(event);return[owner.id,owner];})).values()];}
function setLeftoverResolved(event,resolve,timestamp=new Date().toISOString()){
  const owner=leftoverOwner(event),members=state.events.filter(item=>item.leftover&&leftoverOwner(item).id===owner.id),ids=new Set(members.map(item=>item.id));
  members.forEach(item=>{if(resolve)item.leftoverCompletedAt=timestamp;else delete item.leftoverCompletedAt;const task=taskById(item.focusTaskId);if(task){if(resolve)task.leftoverCompletedAt=timestamp;else delete task.leftoverCompletedAt;}});
  state.reviews.filter(review=>ids.has(review.sourceEventId)).forEach(review=>review.leftoverResolved=resolve);
}
function renderLeftoverPool(){const events=leftoverEntries().sort((a,b)=>Number(Boolean(a.leftoverCompletedAt))-Number(Boolean(b.leftoverCompletedAt))||b.date.localeCompare(a.date));if(!events.length){dom.leftoverList.innerHTML='<div class="review-empty">目前没有遗留内容</div>';return;}dom.leftoverList.innerHTML=events.map((event)=>{const subject=subjectById(event.categoryId),resolved=Boolean(event.leftoverCompletedAt);return`<article class="leftover-item ${resolved?'resolved':''}" style="--leftover-color:${subject?.color||event.color||'#6b7a72'}"><div></div><div><h4>${escapeHtml(eventTitle(event))}</h4><p>${escapeHtml(event.leftover)}</p><small>${escapeHtml(event.categoryName||'未分类')} · ${event.date}${resolved?` · 已于 ${normalizeDate(event.leftoverCompletedAt)} 清理`:''}</small></div><div class="leftover-actions">${resolved?'':`<button class="tool-btn primary" data-leftover-start="${event.id}">开始处理</button>`}<button class="tool-btn" data-leftover-view="${event.id}">详情</button><button class="tool-btn" data-leftover-toggle="${event.id}">${resolved?'恢复':'完成'}</button></div></article>`;}).join('');dom.leftoverList.querySelectorAll('[data-leftover-start]').forEach((button)=>button.onclick=()=>startLeftoverEvent(button.dataset.leftoverStart));dom.leftoverList.querySelectorAll('[data-leftover-view]').forEach((button)=>button.onclick=()=>{closeModal('leftoverModal');openEventDetail(button.dataset.leftoverView);});dom.leftoverList.querySelectorAll('[data-leftover-toggle]').forEach((button)=>button.onclick=()=>toggleLeftover(button.dataset.leftoverToggle));}
function toggleLeftover(id,completed){const event=state.events.find((item)=>item.id===id);if(!event)return;pushHistory();setLeftoverResolved(event,completed??!leftoverOwner(event).leftoverCompletedAt);saveBackup();if(!dom.leftoverModal.classList.contains('hidden'))renderLeftoverPool();if(!dom.eventDetailModal.classList.contains('hidden'))renderEventDetail();renderReviews();}
function startLeftoverEvent(id){const event=state.events.find((item)=>item.id===id);if(!event)return;closeModal('leftoverModal');closeModal('eventDetailModal');startSourceEvent(event,'learn',{leftoverEventId:event.id,suppressReviews:true});}
function startSourceEvent(event,taskType='learn',extra={}){
  if(state.focus||state.pendingFocus){window.alert('请先暂停或处理当前任务。');return;}
  const paused=state.focusTasks.find(task=>task.status==='paused'&&(task.id===event.focusTaskId||(task.sourceEventId===event.id&&task.taskType===taskType&&Boolean(task.leftoverEventId)===Boolean(extra.leftoverEventId))));
  if(paused){resumeFocusTask(paused.id);return;}
  const subject=subjectById(event.categoryId);state.focus={categoryId:event.categoryId,categoryName:event.categoryName||subject?.name||'学习任务',subjectPath:event.subjectPath||[event.categoryId],color:subject?.color||event.color||state.settings.defaultRecordColor,type:'countup',taskType,durationSeconds:0,startedAt:Date.now(),sourceEventId:event.id,planStartPoint:event.materialLocation||'',...extra};beginFocusRuntime();
}

function carryOverReviews(){const today=dateKey(new Date()),groups=new Map();state.reviewDayKey=today;let changed=false;state.reviews.filter((review)=>!review.completed&&!review.abandoned).forEach((review)=>{if(!groups.has(review.sourceEventId))groups.set(review.sourceEventId,[]);groups.get(review.sourceEventId).push(review);});groups.forEach((items,sourceEventId)=>{items.sort((a,b)=>a.reviewNumber-b.reviewNumber);const firstOverdue=items.find((review)=>review.reviewDate<today);if(!firstOverdue)return;const delta=daysBetween(parseDate(firstOverdue.reviewDate),parseDate(today));state.reviews.filter((review)=>review.sourceEventId===sourceEventId&&review.reviewNumber>=firstOverdue.reviewNumber&&!review.completed&&!review.abandoned).forEach((review)=>{review.originalReviewDate=review.originalReviewDate||review.reviewDate;review.reviewDate=dateKey(addDays(parseDate(review.reviewDate),delta));review.carriedOverCount=(Number(review.carriedOverCount)||0)+1;review.carriedAt=new Date().toISOString();changed=true;});});if(changed)saveBackup();return changed;}
function refreshReviewDay(){if(state.reviewDayKey===dateKey(new Date()))return false;carryOverReviews();return true;}

function closePlanReminder(){closeModal('planReminderModal');state.pendingPlanReminderId=null;document.title='学习日志时间轴';}
function showPlanReminder(event){
  const subject=subjectById(event.categoryId),actions=normalizeActionTypes(event.actionTypes).map((type)=>ACTION_TYPE_LABELS[type]).filter(Boolean);state.pendingPlanReminderId=event.id;dom.planReminderModal.style.setProperty('--plan-color',subject?.color||event.color||'#2f6b4f');dom.planReminderSubject.textContent=event.categoryName||subject?.name||'学习计划';dom.planReminderTime.textContent=`${slotLabel(event.startSlot)} - ${slotLabel(event.endSlot)}`;dom.planReminderTitle.textContent=eventTitle(event);dom.planReminderActions.innerHTML=actions.map((action)=>`<span>${escapeHtml(action)}</span>`).join('');dom.planReminderLocation.textContent=event.materialLocation?`资料定位 · ${event.materialLocation}`:(event.textContent||'准备开始本次计划');document.title=`⏰ ${dom.planReminderTitle.textContent}`;openModal('planReminderModal');playReminderSound();showSystemNotification('计划时间到了',`${event.categoryName||'学习计划'} · ${dom.planReminderTitle.textContent}`);dom.planReminderStartBtn.focus();
}
function checkPlanReminders(){
  if(refreshReviewDay())renderReviews();
  if(state.focus||state.pendingFocus)return;if(state.pendingPlanReminderId&&!dom.planReminderModal.classList.contains('hidden'))return;if(state.pendingPlanReminderId)state.pendingPlanReminderId=null;const now=new Date(),key=dateKey(now),minute=now.getHours()*60+now.getMinutes(),timestamp=Date.now();
  const due=state.events.filter((event)=>event.halfZone==='plan'&&event.date===key&&!state.focusTasks.some(task=>task.planEventId===event.id&&['paused','running'].includes(task.status))&&!event.planCompletedAt&&!event.reminderIgnoredAt&&(!event.reminderSnoozeUntil||Number(event.reminderSnoozeUntil)<=timestamp)&&minute>=event.startSlot&&minute<event.endSlot).sort((a,b)=>a.startSlot-b.startSlot)[0];if(due)showPlanReminder(due);
}
function snoozePlanReminder(){const event=state.events.find((item)=>item.id===state.pendingPlanReminderId);if(event){event.reminderSnoozeUntil=Date.now()+10*60*1000;saveBackup();}closePlanReminder();}
function ignorePlanReminder(){const event=state.events.find((item)=>item.id===state.pendingPlanReminderId);if(event){event.reminderIgnoredAt=new Date().toISOString();saveBackup();}closePlanReminder();renderTimeline();}
function startPlanEvent(id){
  const event=state.events.find(item=>item.id===id&&item.halfZone==='plan');if(!event||event.planCompletedAt)return;
  if(state.focus||state.pendingFocus){window.alert('请先暂停或处理当前任务。');return;}
  const paused=state.focusTasks.find(task=>task.planEventId===id&&task.status==='paused');closePlanReminder();if(paused){resumeFocusTask(paused.id);return;}
  pushHistory();event.planStartedAt=new Date().toISOString();delete event.reminderSnoozeUntil;delete event.reminderIgnoredAt;saveBackup();
  startSourceEvent(event,event.taskType==='review'?'review':'learn',{planEventId:event.id});renderTimeline();
}

function renderDate(){const key=currentDateKey();dom.currentDateLabel.textContent=dateLabel(state.currentDate);dom.reviewBadge.textContent=state.reviews.filter((r)=>r.reviewDate<=key&&!r.completed&&!r.abandoned).length;}
function shiftDate(amount){refreshReviewDay();state.currentDate=addDays(state.currentDate,amount);state.selectedEventId=null;if(state.selection)cancelSelection();saveBackup();renderAll();}
function setReviewFilter(filter){refreshReviewDay();state.reviewFilter=filter;document.querySelectorAll('.filter-btn').forEach((b)=>b.classList.toggle('active',b.dataset.filter===filter));renderReviews();}
function toggleReviewFullscreen(){const expanded=dom.reviewCard.classList.toggle('fullscreen');dom.reviewFullscreenBtn.textContent=expanded?'×':'⛶';dom.reviewFullscreenBtn.setAttribute('aria-label',expanded?'退出复习清单全屏':'全屏查看复习清单');document.body.classList.toggle('review-fullscreen-open',expanded);}
function filteredReviews() {
  const key=currentDateKey(),date=parseDate(key),weekStart=addDays(date,-((date.getDay()+6)%7)),weekEnd=addDays(weekStart,6),weekStartKey=dateKey(weekStart),weekEndKey=dateKey(weekEnd);return state.reviews.filter((r)=>{if(state.reviewFilter==='all')return true;if(r.completed)return state.reviewFilter==='today'&&reviewCompletedDate(r)===key;if(r.abandoned)return false;if(state.reviewFilter==='week')return r.reviewDate>=weekStartKey&&r.reviewDate<=weekEndKey;return r.reviewDate===key;
  }).sort((a,b)=>a.reviewDate.localeCompare(b.reviewDate)||masteryPriority(a.mastery)-masteryPriority(b.mastery)||a.reviewNumber-b.reviewNumber);
}
function masteryPriority(value){return{weak:0,unknown:1,partial:2,mastered:3}[value]??1;}
function reviewSource(review){return state.events.find((event)=>event.id===review.sourceEventId);}
function reviewIntervalDays(review,source=reviewSource(review)){const explicit=Number(review.intervalDays);if(Number.isFinite(explicit)&&explicit>=0)return explicit;if(source?.date&&review.reviewDate)return Math.max(0,daysBetween(parseDate(source.date),parseDate(review.reviewDate)));return review.reviewNumber||1;}
function reviewIntervalLabel(review,source){return `D${reviewIntervalDays(review,source)}`;}
function suggestedReviewStart(review,source=reviewSource(review)){const previous=state.reviews.filter((item)=>item.sourceEventId===review.sourceEventId&&item.completed&&item.reviewNumber<review.reviewNumber&&item.resultEndPoint).sort((a,b)=>b.reviewNumber-a.reviewNumber)[0];return previous?.resultEndPoint||review.resultEndPoint||review.materialLocation||source?.materialLocation||'';}


function reviewCard(review){
  const source=reviewSource(review),name=eventTitle(source||review),material=source?.materialLocation??review.materialLocation??'',mastery=review.mastery||source?.mastery||'unknown';
  const actions=normalizeActionTypes(source?.actionTypes||review.actionTypes),task=state.focusTasks.find(item=>item.reviewId===review.id&&['paused','running'].includes(item.status));
  const status=review.completed?'已完成':review.abandoned?'已放弃':task?taskStatusLabel(task.status):review.originalReviewDate&&review.originalReviewDate<review.reviewDate?`由 ${review.originalReviewDate} 顺延`:'';
  return `<article class="review-item ${review.completed?'done':''} ${review.abandoned?'abandoned':''}"><div class="review-topline"><span class="review-meta">${reviewIntervalLabel(review,source)} · 第 ${review.reviewNumber} 次 · ${review.reviewDate}${status?' · '+status:''}</span>${review.important||source?.important?'<span class="review-important">★ 重点</span>':''}</div><button class="review-title-button" data-review-detail="${review.id}"><strong>${escapeHtml(name)}</strong>${material?`<span class="review-material">${escapeHtml(material)}</span>`:''}</button><div class="review-tags">${actions.map(type=>`<span>${escapeHtml(ACTION_TYPE_LABELS[type]||type)}</span>`).join('')}<span class="mastery-badge mastery-${MASTERY_LABELS[mastery]?mastery:'unknown'}">${MASTERY_LABELS[mastery]||'尚未判断'}</span></div><div class="review-actions"><button class="tool-btn primary" data-review-start="${review.id}" ${review.completed||review.abandoned||task?.status==='running'?'disabled':''}>${task?.status==='paused'?'继续复习':task?.status==='running'?'复习中':'开始复习'}</button><button class="tool-btn" data-review-detail="${review.id}">查看详情</button><button class="tool-btn" data-review-complete="${review.id}">${review.completed?'恢复':'直接完成'}</button><button class="tool-btn" data-review-delay="${review.id}">推迟</button><button class="tool-btn" data-review-abandon="${review.id}">${review.abandoned?'恢复':'放弃本次'}</button></div></article>`;
}

function reviewCompletedDate(review){return review.completedAt?normalizeDate(review.completedAt):review.reviewDate;}
function renderReviews() {
  renderDate();const list=filteredReviews(),pending=list.filter(r=>!r.completed&&!r.abandoned),weak=pending.filter(r=>r.mastery==='weak').length;
  dom.reviewListSummary.textContent=`${pending.length} 项${weak?` · ${weak} 薄弱`:''}`;
  const completed=state.reviewFilter==='today'?list.filter(r=>r.completed):[],groups=new Map();
  list.filter(r=>state.reviewFilter!=='today'||!r.completed).forEach(review=>{
    const source=reviewSource(review),subject=subjectById(review.categoryId||source?.categoryId),key=subject?.id||review.categoryId||source?.categoryId||'other';
    if(!groups.has(key))groups.set(key,{name:subject?.name||(review.categoryName||source?.categoryName||'未分类').split('/')[0],color:subject?.color||'#6b7a72',items:[]});
    groups.get(key).items.push(review);
  });
  const groupMarkup=(key,name,color,items,defaultOpen=true)=>{
    const open=state.reviewGroupOpen.get(key)??defaultOpen;
    return `<details class="review-group" data-review-group="${escapeHtml(key)}" style="--review-group-color:${color}" ${open?'open':''}><summary class="review-group-heading"><span class="review-group-name">${escapeHtml(name)}</span><span>${items.length} 项</span></summary><div class="review-group-items">${items.map(reviewCard).join('')}</div></details>`;
  };
  const empty={today:'这一天没有待复习任务',week:'本周没有待复习任务',all:'尚未生成复习任务'}[state.reviewFilter];
  dom.reviewList.innerHTML=([...groups].map(([key,group])=>groupMarkup(key,group.name,group.color,group.items)).join('')||`<div class="review-empty">${empty}</div>`)+(state.reviewFilter==='today'?groupMarkup('completed:'+currentDateKey(),'已完成','#69756d',completed,false):'');
  dom.reviewList.querySelectorAll('[data-review-group]').forEach(el=>el.addEventListener('toggle',()=>state.reviewGroupOpen.set(el.dataset.reviewGroup,el.open)));
  const actions={'detail':openReviewDetail,'start':startReview,'complete':toggleReview,'today':moveReviewToToday,'delay':delayReview,'abandon':abandonReview};
  Object.entries(actions).forEach(([action,handler])=>dom.reviewList.querySelectorAll('[data-review-'+action+']').forEach(button=>button.onclick=()=>handler(button.dataset['review'+action[0].toUpperCase()+action.slice(1)])));
}

function reviewHistoryRow(review,currentId){
  const source=reviewSource(review),isOverdue=!review.completed&&!review.abandoned&&(review.originalReviewDate||review.reviewDate)<currentDateKey(),status=review.completed?'completed':review.abandoned?'abandoned':isOverdue?'overdue':'pending',icon={completed:'✓',abandoned:'×',overdue:'!',pending:'○'}[status],label={completed:'已完成',abandoned:'已放弃',overdue:'已顺延',pending:'待复习'}[status],result=review.resultSummary||(review.completed?'已标记完成':review.abandoned?'本次已放弃':'尚未记录复习结果'),duration=review.resultSeconds?` · ${durationLabel(review.resultSeconds)}`:'';
  return `<div class="review-history-item ${status} ${review.id===currentId?'current':''}"><span class="review-history-icon">${icon}</span><div><strong>第 ${review.reviewNumber} 次 · ${reviewIntervalLabel(review,source)}</strong><span>${review.reviewDate} · ${label}${duration}</span><p>${escapeHtml(result)}</p></div></div>`;
}
function openReviewDetail(id){state.selectedReviewId=id;renderReviewDetail();openModal('reviewDetailModal');}
function renderReviewDetail(){
  const review=state.reviews.find(item=>item.id===state.selectedReviewId),source=reviewSource(review||{});if(!review||!source){closeModal('reviewDetailModal');return;}
  const subject=subjectById(source.categoryId),name=eventTitle(source),material=source.materialLocation||review.materialLocation||'未填写',mastery=review.mastery||source.mastery||'unknown',actions=normalizeActionTypes(source.actionTypes||review.actionTypes);
  const history=state.reviews.filter(item=>item.sourceEventId===review.sourceEventId).sort((a,b)=>a.reviewNumber-b.reviewNumber);
  dom.reviewDetailTitle.textContent=name;
  dom.reviewDetailBasic.innerHTML=`<div class="review-detail-hero" style="--detail-color:${subject?.color||source.color||'#6b7a72'}"><span>${escapeHtml(source.categoryName||'未分类')}</span><strong>${reviewIntervalLabel(review,source)} · 第 ${review.reviewNumber} 次复习</strong></div><div class="review-detail-facts"><div><span>安排日期</span><b>${review.reviewDate}</b></div><div><span>掌握程度</span><b>${MASTERY_LABELS[mastery]||'尚未判断'}</b></div><div><span>学习动作</span><b>${escapeHtml(actions.map(type=>ACTION_TYPE_LABELS[type]).filter(Boolean).join(' / ')||'未标记')}</b></div></div><label class="review-start-point"><span>本次从哪里开始</span><input id="reviewStartPointInput" type="text" maxlength="100" value="${escapeHtml(suggestedReviewStart(review,source))}" placeholder="例如：讲义 P69" /></label>`;
  dom.reviewDetailLearning.innerHTML=`<div class="review-learning-title">${escapeHtml(name)}</div><dl><div><dt>资料定位</dt><dd>${escapeHtml(material)}</dd></div><div><dt>学习摘要</dt><dd>${escapeHtml(source.textContent||'未填写')}</dd></div><div><dt>学习笔记</dt><dd>${escapeHtml(source.notes||'未填写')}</dd></div></dl>`;
  dom.reviewDetailHistory.innerHTML=history.map(item=>reviewHistoryRow(item,review.id)).join('');
  const task=state.focusTasks.find(item=>item.reviewId===review.id&&['paused','running'].includes(item.status));
  dom.reviewDetailStartBtn.disabled=review.completed||review.abandoned||task?.status==='running';
  dom.reviewDetailStartBtn.textContent=review.completed?'本次已完成':review.abandoned?'本次已放弃':task?.status==='paused'?'继续本次复习':'开始本次复习';
}

function startReview(id,startPoint=''){
  if(state.focus||state.pendingFocus){window.alert('请先暂停或处理当前任务。');return;}
  const review=state.reviews.find(item=>item.id===id),source=reviewSource(review||{});
  if(!review||!source||review.completed||review.abandoned)return;
  const paused=state.focusTasks.find(task=>task.reviewId===id&&task.status==='paused');
  if(paused){closeModal('reviewDetailModal');resumeFocusTask(paused.id);return;}
  const subject=subjectById(source.categoryId);
  state.focus={categoryId:source.categoryId,categoryName:source.categoryName||subject?.name||'复习',subjectPath:source.subjectPath||[source.categoryId],color:subject?.color||source.color||state.settings.defaultRecordColor,type:'countup',taskType:'review',durationSeconds:0,startedAt:Date.now(),reviewId:review.id,sourceEventId:source.id,reviewStartPoint:startPoint||suggestedReviewStart(review,source)};
  state.selectedReviewId=review.id;closeModal('reviewDetailModal');beginFocusRuntime();
}

function toggleReview(id){
  const r=state.reviews.find(x=>x.id===id);if(!r)return;
  if(state.focus?.reviewId===id){window.alert('请先暂停当前复习。');return;}
  const task=state.focusTasks.find(item=>item.reviewId===id&&item.status==='paused');pushHistory();
  if(!r.completed&&task){completeFocusTask(task);if(state.pendingFocus?.taskId===task.id){state.pendingFocus=null;closeModal('focusDetailModal');}}
  else{r.completed=!r.completed;r.abandoned=false;if(r.completed){r.completedAt=new Date().toISOString();r.resultSummary=r.resultSummary||'手动标记完成';}else{if(state.reviewFilter==='today'){r.originalReviewDate=r.originalReviewDate||r.reviewDate;r.reviewDate=currentDateKey();}delete r.completedAt;if(r.resultSummary==='手动标记完成')delete r.resultSummary;}}
  saveBackup();renderAll();
}

function abandonReview(id){
  const r=state.reviews.find(x=>x.id===id);if(!r)return;
  if(state.focus?.reviewId===id){window.alert('请先暂停当前复习。');return;}
  pushHistory();r.abandoned=!r.abandoned;r.completed=false;
  if(r.abandoned){r.abandonedAt=new Date().toISOString();state.focusTasks.filter(task=>task.reviewId===id&&task.status==='paused').forEach(task=>{task.status='abandoned';syncTaskRecords(task);});}else delete r.abandonedAt;
  saveBackup();renderAll();
}

function moveReviewToToday(id){const r=state.reviews.find((x)=>x.id===id);if(!r)return;pushHistory();r.originalReviewDate=r.originalReviewDate||r.reviewDate;r.reviewDate=currentDateKey();r.completed=false;r.abandoned=false;saveBackup();renderReviews();}
function delayReview(id) {
  const r=state.reviews.find((x)=>x.id===id);if(!r)return;
  openInputDialog({title:'调整复习日期',label:'目标日期',type:'date',value:dateKey(addDays(parseDate(r.reviewDate),1)),allowEarlier:true,description:'当前及后续未完成、未放弃的批次会按相同天数调整；已完成批次保持不变。',onSubmit:value=>{
    const target=parseDate(value);if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(target.getTime())||dateKey(target)!==value)return '请输入有效日期。';
    const delta=daysBetween(parseDate(r.reviewDate),target);if(delta<0&&!dom.inputDialogEarlier.checked)return '目标早于当前安排，请勾选“允许将安排提前”。';
    pushHistory();state.reviews.filter((x)=>x.sourceEventId===r.sourceEventId&&x.reviewNumber>=r.reviewNumber&&!x.completed&&!x.abandoned).forEach((x)=>{x.originalReviewDate=x.originalReviewDate||x.reviewDate;x.reviewDate=dateKey(addDays(parseDate(x.reviewDate),delta));x.delayedAt=new Date().toISOString();});saveBackup();renderReviews();
  }});
}

function openCalendar(){refreshReviewDay();state.calendarMonth=startOfMonth(state.currentDate);renderCalendar();openModal('calendarModal');}
function calendarHeatLevel(seconds){return seconds>0?clamp(Math.floor(seconds/3600),1,10):0;}
function calendarHeatColor(seconds){return ['transparent','#e0efe1','#c9e4cd','#afd7b8','#93cba1','#75bc89','#58aa72','#40965d','#2e814c','#206c3d','#125730'][calendarHeatLevel(seconds)];}
function calendarDurationLabel(seconds){const value=Math.max(0,Number(seconds)||0);if(value<60)return value?`${Math.max(1,Math.round(value))}s`:'0m';const mins=Math.floor(value/60);if(mins<60)return`${mins}m`;const hours=Math.floor(value/360)/10;return`${Number.isInteger(hours)?hours:hours.toFixed(1)}h`;}
function renderCalendar() {
  const month=state.calendarMonth,year=month.getFullYear(),m=month.getMonth(),firstWeekday=(month.getDay()+6)%7,days=new Date(year,m+1,0).getDate();
  dom.calendarTitle.textContent=`${year} 年 ${m+1} 月`;const cells=['一','二','三','四','五','六','日'].map((d)=>`<div class="calendar-weekday">周${d}</div>`);
  for(let i=0;i<42;i+=1){const day=i-firstWeekday+1,date=new Date(year,m,day),key=dateKey(date),outside=date.getMonth()!==m;
    const records=state.events.filter((e)=>e.date===key&&e.halfZone==='record'),seconds=records.reduce((sum,e)=>sum+focusSeconds(e),0),reviews=state.reviews.filter((r)=>r.reviewDate===key&&!r.completed&&!r.abandoned).length;
    cells.push(`<button class="calendar-day ${outside?'outside':''} ${key===dateKey(new Date())?'today':''}" data-calendar-date="${key}"><div class="calendar-day-heading"><span class="calendar-day-number">${date.getDate()}</span>${seconds?`<span class="calendar-day-duration" data-heat-level="${calendarHeatLevel(seconds)}" title="当日学习总时长 ${durationLabel(seconds)}" style="background:${calendarHeatColor(seconds)};color:${calendarHeatLevel(seconds)>=6?'#fff':'#203b29'}">${calendarDurationLabel(seconds)}</span>`:''}</div>${reviews?`<div class="calendar-day-summary">${reviews}待复习</div>`:''}<div class="calendar-day-events">${records.map((e)=>{const name=eventTitle(e),duration=durationLabel(focusSeconds(e));return`<div class="calendar-event" title="${escapeHtml(name)} · ${duration}" style="--calendar-event-color:${subjectById(e.categoryId)?.color||e.color||'#aeb5ae'}"><span class="calendar-event-label">${escapeHtml(name)}</span><span class="calendar-event-duration">${duration}</span></div>`;}).join('')}</div></button>`);
  }dom.monthCalendar.innerHTML=cells.join('');dom.monthCalendar.querySelectorAll('[data-calendar-date]').forEach((b)=>b.onclick=()=>{state.currentDate=startOfDay(parseDate(b.dataset.calendarDate));closeModal('calendarModal');saveBackup();renderAll();});
}

function openSettings(){syncSettingsToUI();openModal('settingsModal');}
function syncSettingsToUI() {
  const s=state.settings;
  dom.settingStartHour.value=s.startHour;dom.settingHourHeight.value=s.hourHeight;dom.settingPlanRatio.value=Math.round(s.planRatio*100);
  dom.settingDefaultZone.value=s.defaultSelectionZone;dom.settingMinuteInterval.value=s.minuteInterval;dom.settingEventPlacement.value=s.eventPlacement;
  dom.settingDotSize.value=s.dotSize;dom.settingDotOpacity.value=s.dotOpacity;dom.settingArrowWidth.value=s.arrowWidth;dom.settingArrowSize.value=s.arrowSize;dom.settingCompactToolbar.checked=s.compactToolbar;dom.settingShowDots.checked=s.showDots;dom.settingDividerDrag.checked=s.dividerDrag;
  dom.settingHiddenHours.value=s.hiddenHours||'';dom.settingReviewPreset.value=s.reviewPreset;dom.settingReviewIntervals.value=s.reviewIntervals.join(',');
  dom.settingReviewArrowWidth.value=s.reviewArrowWidth;dom.settingReviewArrowSize.value=s.reviewArrowSize;dom.settingReviewArrowDash.value=s.reviewArrowDash;dom.settingShortcut.value=s.shortcut;
  dom.settingCountdownName.value=s.countdownName||'';dom.settingCountdownDate.value=s.countdownDate||'';dom.settingImmersionTheme.value=s.immersionTheme;
  dom.settingImmersionOpacity.value=s.immersionOpacity;dom.settingCountdownSize.value=s.countdownSize;dom.settingCountdownPosition.value=s.countdownPosition;dom.settingImmersionBackground.value=s.immersionBackground?.startsWith('data:')?'':(s.immersionBackground||'');dom.localBackgroundStatus.textContent=s.immersionBackground?(s.immersionBackground.startsWith('data:')?'已保存本地图片':'已设置网络图片'):'尚未设置图片';dom.settingShowCountdown.checked=s.showCountdown;dom.settingShowQuote.checked=s.showQuote;
  dom.settingSoundType.value=s.soundType;dom.settingSoundDuration.value=s.soundDuration;dom.settingSoundVolume.value=s.soundVolume;dom.settingSoundEnabled.checked=s.soundEnabled;dom.settingNotificationsEnabled.checked=s.notificationsEnabled;syncCompactTimelineButton();
}
function updateSettings() {
  const s=state.settings;
  s.startHour=clamp(Number(dom.settingStartHour.value),0,23);s.hourHeight=clamp(Number(dom.settingHourHeight.value),38,100);s.planRatio=clamp(Number(dom.settingPlanRatio.value),25,75)/100;
  s.defaultSelectionZone=dom.settingDefaultZone.value;s.minuteInterval=Number(dom.settingMinuteInterval.value)||5;s.eventPlacement=dom.settingEventPlacement.value;
  s.dotSize=Number(dom.settingDotSize.value);s.dotOpacity=Number(dom.settingDotOpacity.value);s.arrowWidth=Number(dom.settingArrowWidth.value);s.arrowSize=Number(dom.settingArrowSize.value);s.compactToolbar=dom.settingCompactToolbar.checked;s.showDots=dom.settingShowDots.checked;s.dividerDrag=dom.settingDividerDrag.checked;
  s.hiddenHours=dom.settingHiddenHours.value;s.reviewIntervals=parseIntervals(dom.settingReviewIntervals.value);s.reviewArrowWidth=Number(dom.settingReviewArrowWidth.value);s.reviewArrowSize=Number(dom.settingReviewArrowSize.value);s.reviewArrowDash=dom.settingReviewArrowDash.value;
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
function syncCompactTimelineButton(){const active=Boolean(state.settings.compactTimeline);dom.compactTimelinePresetBtn.classList.toggle('primary',active);dom.compactTimelinePresetBtn.textContent=active?'关闭 7–22 紧凑视图':'开启 7–22 紧凑视图';dom.compactTimelinePresetBtn.setAttribute('aria-pressed',String(active));}
function applyCompactTimelinePreset(){if(!state.settings.compactTimeline){state.settings.compactTimelinePrevious={hiddenHours:state.settings.hiddenHours,startHour:state.settings.startHour,hourHeight:state.settings.hourHeight};state.settings.hiddenHours='0-7,22-24';state.settings.startHour=7;state.settings.hourHeight=38;state.settings.compactTimeline=true;}else{const previous=state.settings.compactTimelinePrevious||{};state.settings.hiddenHours=previous.hiddenHours??'';state.settings.startHour=previous.startHour??0;state.settings.hourHeight=previous.hourHeight??56;state.settings.compactTimeline=false;state.settings.compactTimelinePrevious=null;}syncSettingsToUI();saveBackup();renderTimeline();}
function reloadConfiguration(){const currentFocus=state.focus?clone(state.focus):null;loadBackup();carryOverReviews();state.focus=currentFocus;syncSettingsToUI();applyLayoutSettings();refreshCategoryUI();renderAll();dom.reloadConfigFeedback.textContent='配置已重新读取并应用';dom.reloadConfigFeedback.classList.add('success');setTimeout(()=>{dom.reloadConfigFeedback.textContent='重新读取系统设置与学科配置，不刷新页面。';dom.reloadConfigFeedback.classList.remove('success');},2200);}
function importImmersionBackground(){const file=dom.settingLocalBackground.files?.[0];if(!file)return;if(file.size>4*1024*1024){window.alert('图片请控制在 4MB 以内，以免浏览器本地存储空间不足。');dom.settingLocalBackground.value='';return;}const reader=new FileReader();reader.onload=()=>{state.settings.immersionBackground=String(reader.result);state.settings.immersionTheme='custom';saveBackup();syncSettingsToUI();applyImmersionSettings();};reader.readAsDataURL(file);dom.settingLocalBackground.value='';}
function clearImmersionBackground(){state.settings.immersionBackground='';if(state.settings.immersionTheme==='custom')state.settings.immersionTheme='plain';saveBackup();syncSettingsToUI();applyImmersionSettings();}
function unlockAudio(){try{state.audioContext=state.audioContext||new (window.AudioContext||window.webkitAudioContext)();if(state.audioContext.state==='suspended')state.audioContext.resume();}catch(_){}}
function playReminderSound(){if(!state.settings.soundEnabled)return;unlockAudio();const audio=state.audioContext;if(!audio)return;const now=audio.currentTime,volume=clamp(Number(state.settings.soundVolume),0,1),duration=clamp(Number(state.settings.soundDuration)||1.5,.5,10),type=state.settings.soundType||'cheer',patterns={cheer:[523,659,784,1047,784,1047],chime:[659,880,1047],bell:[784,784,988]}[type]||[523,659,784];const step=Math.max(.12,duration/patterns.length);patterns.forEach((frequency,index)=>{const start=now+index*step,osc=audio.createOscillator(),gain=audio.createGain();osc.type=type==='bell'?'sine':type==='chime'?'triangle':'square';osc.frequency.setValueAtTime(frequency,start);gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(volume*.15,start+.025);gain.gain.exponentialRampToValueAtTime(.0001,Math.min(now+duration,start+step*.92));osc.connect(gain);gain.connect(audio.destination);osc.start(start);osc.stop(Math.min(now+duration+.03,start+step));});}
async function requestNotifications(){if(!('Notification'in window)){window.alert('当前浏览器不支持系统通知。');return;}const permission=await Notification.requestPermission();state.settings.notificationsEnabled=permission==='granted';dom.settingNotificationsEnabled.checked=state.settings.notificationsEnabled;saveBackup();if(permission==='granted')showSystemNotification('通知已启用','计划开始与倒计时结束时会收到系统提醒。',true);else window.alert('通知未获授权，可在浏览器网站权限中重新开启。');}
async function showSystemNotification(title,body,force=false){if(!('Notification'in window)||Notification.permission!=='granted'||(!force&&!state.settings.notificationsEnabled))return;const options={body,icon:'icon.svg',badge:'icon.svg',tag:`learning-tool-${title}`,renotify:true};try{if('serviceWorker'in navigator){const registration=await navigator.serviceWorker.ready;await registration.showNotification(title,options);return;}new Notification(title,options);}catch(_){try{new Notification(title,options);}catch(__){}}}
async function installApp(){const prompt=state.installPrompt;if(!prompt){window.alert(location.protocol==='file:'?'请先通过本地服务器或 HTTPS 打开网页，再用 Edge 的“应用 → 安装此站点”安装。':'当前浏览器尚未提供安装入口，可使用浏览器菜单中的“安装此应用”。');return;}await prompt.prompt();state.installPrompt=null;dom.installAppBtn.classList.add('hidden');}
function closeFocusPictureInPicture(){state.pipRequest=null;const pip=state.pipWindow;state.pipWindow=null;if(pip&&!pip.closed)pip.close();}
function clearEvents(){if(!state.events.length||!window.confirm('确认清空全部事件与复习任务？'))return;pushHistory();state.events=[];state.reviews=[];state.focusTasks=[];state.focus=null;state.pendingFocus=null;state.mergeMode=false;state.mergeSelection.clear();clearInterval(state.focusTicker);state.focusTicker=null;saveActiveFocus();closeFocusPictureInPicture();exitImmersion();closePlanReminder();saveBackup();closeModal('settingsModal');renderAll();}

function focusEvents(){return state.events.filter(event=>event.halfZone==='record'||(!event.halfZone&&event.taskType==='focus'));}
function focusSeconds(event){if(Number.isFinite(event.focusSeconds)&&event.focusSeconds>=0)return event.focusSeconds;const seconds=(event.endSlot-event.startSlot)*60;return Number.isFinite(seconds)?Math.max(0,seconds):0;}

const ORPHAN_STATS_ID='__uncategorized__';
function statsFilterRoots(){return [...state.categories,...(focusEvents().some(event=>!subjectById(event.categoryId))?[{id:ORPHAN_STATS_ID,name:'未分类 / 已删除学科',children:[]}]:[])];}
function openStats() {
  dom.statsRange.value='day';state.statsAnchor=startOfDay(new Date());state.statsSubjects=new Set(statsFilterRoots().flatMap(subjectSubtreeIds));const today=new Date(),monthStart=new Date(today.getFullYear(),today.getMonth(),1);if(!dom.statsCustomFrom.value)dom.statsCustomFrom.value=dateKey(monthStart);if(!dom.statsCustomTo.value)dom.statsCustomTo.value=dateKey(today);renderStatsFilters();updateStatsRangeUI();openModal('statsModal');renderStats();
}
function updateStatsRangeUI(){dom.statsCustomRange.classList.toggle('hidden',dom.statsRange.value!=='custom');}
function flattenSubjectOptions() {
  const result=[];state.categories.forEach((root)=>{result.push({id:root.id,name:root.name,color:root.color,depth:0});(root.children||[]).forEach((second)=>{result.push({id:second.id,name:`${root.name} / ${second.name}`,color:root.color,depth:1});(second.children||[]).forEach((third)=>result.push({id:third.id,name:`${root.name} / ${second.name} / ${third.name}`,color:root.color,depth:2}));});});return result;
}
function subjectSubtreeIds(node){return [node.id,...(node.children||[]).flatMap(subjectSubtreeIds)];}
function statsSubjectSelection(node){const ids=subjectSubtreeIds(node),count=ids.filter(id=>state.statsSubjects.has(id)).length;return{checked:count===ids.length,partial:count>0&&count<ids.length};}
function setStatsSubjectSelected(id,checked){
  const visit=node=>{if(node.id===id){subjectSubtreeIds(node).forEach(key=>checked?state.statsSubjects.add(key):state.statsSubjects.delete(key));return true;}
    const found=(node.children||[]).some(visit);if(found){const full=(node.children||[]).every(child=>statsSubjectSelection(child).checked);if(full)state.statsSubjects.add(node.id);else state.statsSubjects.delete(node.id);}return found;};
  statsFilterRoots().some(visit);
}
function renderStatsFilters() {
  const renderNode=(node,depth=0)=>{
    const selection=statsSubjectSelection(node),children=node.children||[],open=state.statsExpanded.has(node.id);
    return `<div class="stats-subject-node depth-${depth}"><div class="stats-subject-row"><input type="checkbox" aria-label="选择${escapeHtml(node.name)}" value="${escapeHtml(node.id)}" ${selection.checked?'checked':''}><button type="button" data-stats-expand="${escapeHtml(node.id)}" aria-expanded="${open}" ${children.length?'':'disabled'}>${children.length?(open?'▾':'▸'):'·'} ${escapeHtml(node.name)}</button></div>${children.length?`<div class="stats-subject-children ${open?'':'hidden'}">${children.map(child=>renderNode(child,depth+1)).join('')}</div>`:''}</div>`;
  };
  const roots=statsFilterRoots();dom.statsSubjectFilters.innerHTML=roots.map(node=>renderNode(node)).join('');
  const nodes=new Map();const collect=node=>{nodes.set(node.id,node);(node.children||[]).forEach(collect);};roots.forEach(collect);
  dom.statsSubjectFilters.querySelectorAll('input').forEach(input=>{input.indeterminate=statsSubjectSelection(nodes.get(input.value)).partial;input.onchange=()=>{const id=input.value;setStatsSubjectSelected(id,input.checked);renderStatsFilters();renderStats();[...dom.statsSubjectFilters.querySelectorAll('input')].find(el=>el.value===id)?.focus();};});
  dom.statsSubjectFilters.querySelectorAll('[data-stats-expand]').forEach(button=>button.onclick=()=>{const id=button.dataset.statsExpand;state.statsExpanded.has(id)?state.statsExpanded.delete(id):state.statsExpanded.add(id);renderStatsFilters();[...dom.statsSubjectFilters.querySelectorAll('[data-stats-expand]')].find(el=>el.dataset.statsExpand===id)?.focus();});
}
function learningReviewTotals(events){return events.reduce((totals,event)=>{totals[event.taskType==='review'?'review':'learn']+=focusSeconds(event);return totals;},{learn:0,review:0});}

function statsPeriodText(){const anchor=state.statsAnchor||startOfDay(new Date()),range=dom.statsRange.value;if(range==='day')return `${anchor.getFullYear()}-${pad(anchor.getMonth()+1)}-${pad(anchor.getDate())}`;if(range==='week'){const start=addDays(anchor,-((anchor.getDay()+6)%7)),end=addDays(start,6);return `${pad(start.getMonth()+1)}.${pad(start.getDate())}–${pad(end.getMonth()+1)}.${pad(end.getDate())}`;}if(range==='month')return `${anchor.getFullYear()} 年 ${anchor.getMonth()+1} 月`;if(range==='year')return `${anchor.getFullYear()} 年`;return `${dom.statsCustomFrom.value||'起始'} – ${dom.statsCustomTo.value||'今日'}`;}
function shiftStatsPeriod(amount){const range=dom.statsRange.value,anchor=state.statsAnchor||startOfDay(new Date());if(range==='day')state.statsAnchor=addDays(anchor,amount);else if(range==='week')state.statsAnchor=addDays(anchor,amount*7);else if(range==='month')state.statsAnchor=addMonths(anchor,amount);else if(range==='year')state.statsAnchor=new Date(anchor.getFullYear()+amount,anchor.getMonth(),anchor.getDate());else{const from=parseDate(dom.statsCustomFrom.value),to=parseDate(dom.statsCustomTo.value),span=Math.max(1,daysBetween(from,to)+1);if(!Number.isNaN(from.getTime()))dom.statsCustomFrom.value=dateKey(addDays(from,amount*span));if(!Number.isNaN(to.getTime()))dom.statsCustomTo.value=dateKey(addDays(to,amount*span));}renderStats();}

function renderStats() {
  const all=focusEvents().filter(e=>!subjectById(e.categoryId)?state.statsSubjects.has(ORPHAN_STATS_ID):(e.subjectPath?.length?e.subjectPath:[e.categoryId]).some(id=>state.statsSubjects.has(id))),anchor=state.statsAnchor||startOfDay(new Date()),anchorKey=dateKey(anchor),today=all.filter((e)=>e.date===anchorKey);
  const ranged=filterStatsRange(all,dom.statsRange.value),totalSeconds=ranged.reduce((sum,e)=>sum+focusSeconds(e),0),activeDays=new Set(ranged.map((e)=>e.date)).size||1;
  dom.statsPeriodLabel.textContent=statsPeriodText();dom.statDayTitle.textContent=`${anchor.getMonth()+1}月${anchor.getDate()}日专注`;dom.statMonthTitle.textContent=`${anchor.getFullYear()}年${anchor.getMonth()+1}月每日专注`;dom.statYearTitle.textContent=`${anchor.getFullYear()}年每月专注`;
  dom.statTotalCount.textContent=ranged.length;dom.statTotalTime.textContent=durationLabel(totalSeconds);dom.statDailyAverage.textContent=durationLabel(totalSeconds/activeDays);
  dom.statTodayCount.textContent=today.length;dom.statTodayTime.textContent=durationLabel(today.reduce((sum,e)=>sum+focusSeconds(e),0));
  const split=learningReviewTotals(today),sum=split.learn+split.review,reviewPercent=sum?Math.round(split.review/sum*1000)/10:0,learnPercent=sum?Math.round((100-reviewPercent)*10)/10:0;dom.statTodaySplit.innerHTML=`<span>学习 <b>${durationLabel(split.learn)}</b> · ${learnPercent}%</span><span>复习 <b>${durationLabel(split.review)}</b> · ${reviewPercent}%</span>`;drawDistributionChart(filterStatsRange(all,dom.statsRange.value));drawMonthlyChart(all);drawYearlyChart(all);
  Object.entries(state.statVisibility).forEach(([key,visible])=>document.querySelector(`[data-stat-section="${key}"]`)?.classList.toggle('stat-hidden',!visible));
}
function filterStatsRange(events,range) {
  const anchor=state.statsAnchor||startOfDay(new Date());
  if(range==='day')return events.filter((e)=>e.date===dateKey(anchor));
  if(range==='week'){const monday=addDays(anchor,-((anchor.getDay()+6)%7));return events.filter((e)=>{const d=parseDate(e.date);return d>=monday&&d<addDays(monday,7);});}
  if(range==='month')return events.filter((e)=>{const d=parseDate(e.date);return d.getFullYear()===anchor.getFullYear()&&d.getMonth()===anchor.getMonth();});
  if(range==='year')return events.filter((e)=>parseDate(e.date).getFullYear()===anchor.getFullYear());
  const from=dom.statsCustomFrom.value,to=dom.statsCustomTo.value;return events.filter((e)=>(!from||e.date>=from)&&(!to||e.date<=to));
}
function toggleStat(key){state.statVisibility[key]=!state.statVisibility[key];renderStats();}
function prepareChart(canvasEl) {
  const dpr=window.devicePixelRatio||1,rect=canvasEl.getBoundingClientRect(),width=Math.max(1,rect.width||canvasEl.width||320),height=Math.max(180,rect.height||canvasEl.height);
  canvasEl.width=Math.round(width*dpr);canvasEl.height=Math.round(height*dpr);const c=canvasEl.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,width,height);return{c,width,height};
}
function subjectDurationTotals(events){
  const groups=new Map();events.forEach(event=>{const id=event.categoryId||'other',subject=subjectById(id)||{id,name:(event.categoryName||'未分类').split('/')[0],color:event.color||'#6b7a72'};if(!groups.has(id))groups.set(id,{s:subject,learn:0,review:0,value:0});const item=groups.get(id),seconds=focusSeconds(event);item[event.taskType==='review'?'review':'learn']+=seconds;item.value+=seconds;});return [...groups.values()].filter(item=>item.value>0);
}
function reviewFill(c,color){const tile=document.createElement('canvas');tile.width=8;tile.height=8;const pen=tile.getContext('2d');pen.fillStyle=rgba(color,.2);pen.fillRect(0,0,8,8);pen.strokeStyle=rgba(color,.8);pen.lineWidth=1.5;pen.beginPath();pen.moveTo(0,8);pen.lineTo(8,0);pen.stroke();return c.createPattern(tile,'repeat')||rgba(color,.35);}
function drawDistributionChart(events) {
  const totals=subjectDurationTotals(events);dom.distributionChart.style.height=`${Math.max(220,totals.length*36+40)}px`;
  const {c,width,height}=prepareChart(dom.distributionChart);
  dom.distributionChart.title='';dom.distributionChart.onmousemove=event=>{
    const rect=dom.distributionChart.getBoundingClientRect(),x=(event.clientX-rect.left)*width/rect.width,y=(event.clientY-rect.top)*height/rect.height;
    let item;
    if(dom.statsChartType.value==='pie'){
      const radius=Math.min(82,height*.36,width*.18),dx=x-Math.max(radius+22,width*.3),dy=y-height/2,distance=Math.hypot(dx,dy);
      if(distance>=radius*.48&&distance<=radius){const angle=(Math.atan2(dy,dx)+Math.PI/2+Math.PI*2)%(Math.PI*2),total=totals.reduce((sum,t)=>sum+t.value,0);let end=0;item=totals.find(t=>{end+=t.value/total*Math.PI*2;return angle<=end;});}
    }else{const max=Math.max(1,...totals.map(t=>t.value));item=totals.find((t,i)=>y>=23+i*36&&y<=40+i*36&&x>=86&&x<=86+(width-190)*t.value/max);}
    dom.distributionChart.title=item?`${item.s.name}：学习 ${durationLabel(item.learn)}，复习 ${durationLabel(item.review)}`:'';
  };dom.distributionChart.onmouseleave=()=>{dom.distributionChart.title='';};
  dom.distributionDetails.innerHTML=totals.map(item=>{const label=`${item.s.name}：学习 ${durationLabel(item.learn)}，复习 ${durationLabel(item.review)}`;return `<div class="distribution-item" style="--subject-color:${item.s.color}"><span>${escapeHtml(item.s.name)}</span><div class="distribution-track" tabindex="0" aria-label="${escapeHtml(label)}"><span class="distribution-learn" style="width:${item.learn/item.value*100}%"></span><span class="distribution-review" style="width:${item.review/item.value*100}%"></span><span class="distribution-tooltip" role="tooltip">${escapeHtml(label)}</span></div><b>${durationLabel(item.value)}</b></div>`;}).join('');
  if(!totals.length){drawEmptyChart(c,width,height);return;}
  c.textAlign='left';c.textBaseline='alphabetic';
  if(dom.statsChartType.value==='pie'){drawDistributionPie(c,width,height,totals);return;}
  const max=Math.max(...totals.map(item=>item.value));c.font='11px "Segoe UI"';
  totals.forEach((item,i)=>{const y=28+i*36,barWidth=Math.max(2,(width-190)*item.value/max),learnWidth=barWidth*item.learn/item.value;c.fillStyle='#333';c.fillText(fitText(c,item.s.name,72),12,y+7);c.fillStyle=item.s.color;c.fillRect(86,y-5,learnWidth,17);c.fillStyle=reviewFill(c,item.s.color);c.fillRect(86+learnWidth,y-5,barWidth-learnWidth,17);c.fillStyle='#333';c.fillText(durationLabel(item.value),94+barWidth,y+7);});
}
function drawDistributionPie(c,width,height,totals){
  const sum=totals.reduce((value,item)=>value+item.value,0),radius=Math.min(82,height*.36,width*.18),cx=Math.max(radius+22,width*.3),cy=height/2;let angle=-Math.PI/2;
  totals.forEach(item=>{for(const kind of ['learn','review']){if(!item[kind])continue;const next=angle+item[kind]/sum*Math.PI*2;c.fillStyle=kind==='review'?reviewFill(c,item.s.color):item.s.color;c.beginPath();c.moveTo(cx,cy);c.arc(cx,cy,radius,angle,next);c.closePath();c.fill();angle=next;}});
  c.fillStyle='#fff';c.beginPath();c.arc(cx,cy,radius*.48,0,Math.PI*2);c.fill();c.fillStyle='#333';c.textAlign='center';c.font='700 14px "Segoe UI"';c.fillText(durationLabel(sum),cx,cy+5);c.textAlign='left';c.font='11px "Segoe UI"';
  totals.forEach((item,index)=>{const x=Math.min(width-145,cx+radius+28),y=32+index*28;c.fillStyle=item.s.color;c.fillRect(x,y-10,9,9);c.fillStyle='#333';c.fillText(fitText(c,`${item.s.name} ${Math.round(item.value/sum*100)}% · ${durationLabel(item.value)}`,width-x-16),x+12,y);});
}

function drawMonthlyChart(events) {
  const now=state.statsAnchor||new Date(),days=new Date(now.getFullYear(),now.getMonth()+1,0).getDate(),values=Array.from({length:days},(_,i)=>events.filter((e)=>e.date===dateKey(new Date(now.getFullYear(),now.getMonth(),i+1))).reduce((s,e)=>s+focusSeconds(e)/60,0));
  drawLineChart(dom.monthlyChart,values,values.map((_,i)=>String(i+1)),60);
}
function drawYearlyChart(events) {
  const year=(state.statsAnchor||new Date()).getFullYear(),values=Array.from({length:12},(_,i)=>events.filter((e)=>parseDate(e.date).getFullYear()===year&&parseDate(e.date).getMonth()===i).reduce((s,e)=>s+focusSeconds(e)/3600,0));
  drawLineChart(dom.yearlyChart,values,values.map((_,i)=>`${i+1}月`),3600);
}
function compactDurationLabel(seconds){const value=Math.max(0,Number(seconds)||0);if(value<60)return value?`${Math.round(value)}s`:'0';if(value<3600)return`${Math.round(value/60)}m`;const hours=Math.round(value/360)/10;return`${Number.isInteger(hours)?hours:hours.toFixed(1)}h`;}
function drawLineChart(canvasEl,values,labels,secondsPerUnit=60) {
  canvasEl.style.minWidth='0';canvasEl.setAttribute('aria-label',values.map((value,i)=>`${labels[i]}${secondsPerUnit===60?'日':''} ${durationLabel(value*secondsPerUnit)}`).join('；'));
  const {c,width,height}=prepareChart(canvasEl),padX=42,padY=24,w=width-padX-42,h=height-padY-30,max=Math.max(1,...values);
  c.strokeStyle='#e4e7e2';c.lineWidth=1;for(let i=0;i<=4;i++){const y=padY+h*i/4;c.beginPath();c.moveTo(padX,y);c.lineTo(width-10,y);c.stroke();}
  c.strokeStyle='#2f6b4f';c.lineWidth=2;c.beginPath();values.forEach((value,i)=>{const x=padX+(values.length===1?0:i/(values.length-1))*w,y=padY+h-value/max*h;if(i)c.lineTo(x,y);else c.moveTo(x,y);});c.stroke();
  c.fillStyle='#2f6b4f';values.forEach((value,i)=>{const x=padX+(values.length===1?0:i/(values.length-1))*w,y=padY+h-value/max*h;c.beginPath();c.arc(x,y,2.5,0,Math.PI*2);c.fill();});
  c.fillStyle='#333';c.font='bold 9px "Segoe UI"';c.textAlign='center';values.forEach((value,i)=>{const x=padX+(values.length===1?0:i/(values.length-1))*w,y=padY+h-value/max*h-(i%2?7:13);c.fillText(compactDurationLabel(value*secondsPerUnit),x,y);});
  const labelEvery=Math.max(1,Math.ceil(labels.length/Math.max(6,Math.floor(w/34))));c.fillStyle='#555';c.font='9px "Segoe UI"';c.textAlign='center';labels.forEach((label,i)=>{if(i%labelEvery===0||i===labels.length-1){const x=padX+(labels.length===1?0:i/(labels.length-1))*w;c.fillText(label,x,height-8);}});
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
  const events=state.events.filter((e)=>e.categoryId===s.id&&e.halfZone==='record'),focus=events.filter(event=>focusSeconds(event)>0),today=new Date(),monthDays=new Date(today.getFullYear(),today.getMonth()+1,0).getDate();
  const durations=new Map();focus.forEach((e)=>durations.set(e.date,(durations.get(e.date)||0)+focusSeconds(e)));const streak=calculateStreak([...durations.keys()]),maxStreak=calculateMaxStreak([...durations.keys()]);
  const mini=Array.from({length:monthDays},(_,i)=>{const key=dateKey(new Date(today.getFullYear(),today.getMonth(),i+1)),seconds=durations.get(key)||0,alpha=seconds?clamp(.2+seconds/7200,.25,1):0;return`<div class="mini-day-cell"><div class="mini-day" style="${seconds?`border-color:${s.color};background:${rgba(s.color,alpha)};color:#fff`:''}">${i+1}</div><small>${seconds?durationLabel(seconds):'　'}</small></div>`;}).join('');
  const hierarchy=(s.children||[]).map((l2)=>`<div class="hierarchy-row" data-level2="${l2.id}"><input class="level2-name" value="${escapeHtml(l2.name)}"><button class="tool-btn" data-add-level3="${l2.id}">+ 三级</button><label><input class="level2-review" type="checkbox" ${l2.reviewEnabled!==false?'checked':''}>复习</label><button class="tool-btn" data-delete-level2="${l2.id}">删</button></div>${(l2.children||[]).map((l3)=>`<div class="hierarchy-row level3" data-level2="${l2.id}" data-level3="${l3.id}"><span>↳</span><input class="level3-name" value="${escapeHtml(l3.name)}"><label><input class="level3-review" type="checkbox" ${l3.reviewEnabled!==false?'checked':''}>复习</label><button class="tool-btn" data-delete-level3="${l3.id}">删</button></div>`).join('')}`).join('');
  const heat=buildYearHeatmap(s,focus),records=events.sort((a,b)=>b.date.localeCompare(a.date)).map((e)=>`<button class="subject-record" data-subject-event="${e.id}"><strong>${e.date} · ${eventTimeLabel(e.startSlot)}–${eventTimeLabel(e.endSlot)}</strong><br>${escapeHtml(eventTitle(e))}</button>`).join('')||'<div class="review-empty">暂无记录</div>';
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
  document.getElementById('addLevel2Btn').onclick=()=>addSubjectLevel(subject.id);
  dom.subjectDetail.querySelectorAll('[data-subject-event]').forEach((button)=>button.onclick=()=>{closeModal('subjectsModal');openEventDetail(button.dataset.subjectEvent);});
  dom.subjectDetail.querySelectorAll('[data-level2]').forEach((row)=>row.querySelectorAll('input').forEach((input)=>input.oninput=()=>updateHierarchyRow(subject,row)));
  dom.subjectDetail.querySelectorAll('[data-add-level3]').forEach((button)=>button.onclick=()=>addSubjectLevel(subject.id,button.dataset.addLevel3));
  dom.subjectDetail.querySelectorAll('[data-delete-level2]').forEach((button)=>button.onclick=()=>{subject.children=subject.children.filter((x)=>x.id!==button.dataset.deleteLevel2);saveBackup();renderSubjects();});
  dom.subjectDetail.querySelectorAll('[data-delete-level3]').forEach((button)=>button.onclick=()=>{subject.children.forEach((x)=>x.children=x.children.filter((t)=>t.id!==button.dataset.deleteLevel3));saveBackup();renderSubjects();});
}
function updateHierarchyRow(subject,row){const l2=subject.children.find((x)=>x.id===row.dataset.level2);if(!l2)return;if(row.dataset.level3){const l3=l2.children.find((x)=>x.id===row.dataset.level3);l3.name=row.querySelector('.level3-name').value.trim()||'未命名';l3.reviewEnabled=row.querySelector('.level3-review').checked;}else{l2.name=row.querySelector('.level2-name').value.trim()||'未命名';l2.reviewEnabled=row.querySelector('.level2-review').checked;}saveBackup();}
function addCategory(){openInputDialog({title:'添加学科',label:'学科名称',onSubmit:name=>{if(state.categories.some(item=>item.name===name))return '同级学科名称不能重复。';pushHistory();const s=newSubject(name,'#6b7a72');state.categories.push(s);state.selectedSubjectId=s.id;saveBackup();refreshCategoryUI();renderSubjects();}});}
function addSubjectLevel(subjectId,level2Id){
  const subject=subjectById(subjectId),parent=level2Id?subject?.children.find(item=>item.id===level2Id):subject;if(!parent)return;
  openInputDialog({title:level2Id?'添加三级科目':'添加二级科目',label:level2Id?'三级科目名称':'二级科目名称',onSubmit:name=>{if(parent.children.some(item=>item.name===name))return '同级科目名称不能重复。';pushHistory();parent.children.push({id:uid(level2Id?'level3':'level2'),name,reviewEnabled:true,children:[]});saveBackup();renderSubjects();refreshSubjectPathOptions();}});
}
function deleteCategory(id){const s=subjectById(id);if(!s||state.categories.length<=1){window.alert('至少保留一个学科。');return;}if(!window.confirm(`删除学科“${s.name}”？已有记录会保留。`))return;pushHistory();state.categories=state.categories.filter((x)=>x.id!==id);state.selectedSubjectId=state.categories[0]?.id||null;saveBackup();refreshCategoryUI();renderSubjects();}
function buildYearHeatmap(subject,events){const year=new Date().getFullYear(),map=new Map();events.forEach((e)=>map.set(e.date,(map.get(e.date)||0)+focusSeconds(e)));let html='';for(let m=0;m<12;m++){let days='';for(let d=1;d<=31;d++){const date=new Date(year,m,d);if(date.getMonth()!==m){days+='<span></span>';continue;}const seconds=map.get(dateKey(date))||0,alpha=seconds?clamp(.15+seconds/7200,.18,1):0;days+=`<span class="heat-dot" title="${m+1}月${d}日 ${durationLabel(seconds)}" style="${seconds?`background:${rgba(subject.color,alpha)}`:''}"></span>`;}html+=`<div class="heat-month"><strong>${m+1}月</strong><div class="heat-month-days">${days}</div></div>`;}return html;}
function calculateStreak(keys){const set=new Set(keys),today=startOfDay(new Date());let count=0,date=today;if(!set.has(dateKey(date)))date=addDays(date,-1);while(set.has(dateKey(date))){count+=1;date=addDays(date,-1);}return count;}
function calculateMaxStreak(keys){const sorted=[...new Set(keys)].sort();let max=0,current=0,prev=null;sorted.forEach((key)=>{const d=parseDate(key);current=prev&&daysBetween(prev,d)===1?current+1:1;max=Math.max(max,current);prev=d;});return max;}

function renderFocusSubjects(){dom.focusSubjects.innerHTML=state.categories.map((s)=>`<button class="subject-btn" style="--subject-color:${s.color}" data-focus-subject="${s.id}" ${state.focus?'disabled':''}>${escapeHtml(s.name)}</button>`).join('');dom.focusSubjects.querySelectorAll('[data-focus-subject]').forEach((b)=>b.onclick=()=>startFocus(b.dataset.focusSubject));}
function updateFocusDurationUI(){const countdown=dom.focusTimerType.value==='countdown';dom.focusDurationWrap.classList.toggle('hidden',!countdown);dom.focusCustomDurationWrap.classList.toggle('hidden',!countdown||dom.focusDuration.value!=='custom');}
function focusSource(focus=state.focus){return focus?.sourceEventId?state.events.find((event)=>event.id===focus.sourceEventId):null;}
function taskById(id){return state.focusTasks.find(task=>task.id===id);}
function taskStatusLabel(status){return{running:'进行中',paused:'未完成',completed:'已完成',abandoned:'已放弃'}[status]||'未完成';}
function ensureFocusImmersionFields(focus=state.focus){
  if(!focus)return null;
  const source=focusSource(focus),previous=focus.immersiveFields||taskById(focus.taskId)?.fields||{};
  const actionTypes=normalizeActionTypes(previous.actionTypes||previous.actionType||source?.actionTypes),actionType=actionTypes[0];focus.immersiveFields={eventName:previous.eventName??previous.knowledgePoint??(source?eventTitle(source):''),materialLocation:previous.materialLocation??focus.reviewStartPoint??focus.planStartPoint??source?.materialLocation??'',progress:previous.progress??source?.progress??'',summary:previous.summary??'',notes:previous.notes??focus.liveNotes??source?.notes??'',leftover:previous.leftover??source?.leftover??'',actionType,actionTypes,mastery:previous.mastery??source?.mastery??'unknown'};
  focus.liveNotes=focus.immersiveFields.notes;return focus.immersiveFields;
}
function ensureFocusTask(focus=state.focus){
  if(!focus)return null;
  let task=taskById(focus.taskId);const fields=ensureFocusImmersionFields(focus);
  if(!task){
    const source=focusSource(focus);
    task={id:focus.taskId||uid('task'),status:'running',taskType:focus.taskType||'learn',categoryId:focus.categoryId,categoryName:focus.categoryName,subjectPath:focus.subjectPath||source?.subjectPath||[focus.categoryId],color:focus.color,type:focus.type||'countup',durationSeconds:focus.durationSeconds||0,sourceEventId:focus.sourceEventId||null,reviewId:focus.reviewId||null,planEventId:focus.planEventId||null,leftoverEventId:focus.leftoverEventId||null,suppressReviews:Boolean(focus.suppressReviews),createdAt:new Date(focus.startedAt).toISOString(),totalSeconds:0,segmentEventIds:[],fields:clone(fields)};
    state.focusTasks.push(task);
  }
  focus.taskId=task.id;focus.segmentId=focus.segmentId||uid('segment');focus.elapsedBefore=Math.max(0,Number(focus.elapsedBefore)||0);
  task.status='running';task.fields=clone(fields);return task;
}
function renderUnfinishedTasks(){
  const tasks=state.focusTasks.filter(task=>task.status==='paused');dom.unfinishedTaskPanel.classList.toggle('hidden',!tasks.length);
  const markup=tasks.map(task=>`<article class="unfinished-task"><strong>${escapeHtml(task.fields.eventName||task.categoryName+'任务')}</strong><small>${task.taskType==='review'?'复习':'学习'} · ${escapeHtml(task.categoryName)} · 累计 ${clockLabel(task.totalSeconds)} · ${task.segmentEventIds.length} 段</small>${task.fields.progress?`<p>学习进度：${escapeHtml(task.fields.progress)}</p>`:''}${task.fields.leftover?`<p>待完成：${escapeHtml(task.fields.leftover)}</p>`:''}<div class="unfinished-task-actions"><button class="tool-btn primary" data-task-resume="${task.id}" ${state.focus||state.pendingFocus?'disabled':''}>继续</button><button class="tool-btn" data-task-finish="${task.id}" ${state.focus||state.pendingFocus?'disabled':''}>标记完成</button><button class="tool-btn" data-task-abandon="${task.id}">放弃</button></div></article>`).join('');
  if(state.unfinishedMarkup===markup)return;state.unfinishedMarkup=markup;dom.unfinishedTaskList.innerHTML=markup;
  dom.unfinishedTaskList.querySelectorAll('[data-task-resume]').forEach(button=>button.onclick=()=>resumeFocusTask(button.dataset.taskResume));
  dom.unfinishedTaskList.querySelectorAll('[data-task-finish]').forEach(button=>button.onclick=()=>openTaskCompletion(button.dataset.taskFinish));
  dom.unfinishedTaskList.querySelectorAll('[data-task-abandon]').forEach(button=>button.onclick=()=>abandonFocusTask(button.dataset.taskAbandon));
}
function syncTaskRecords(task){
  const fields=task.fields||{};
  const records=state.events.filter(event=>event.focusTaskId===task.id);
  if(records.some(event=>Object.hasOwn(event,'leftover')&&event.leftover!==(fields.leftover||''))){delete task.leftoverCompletedAt;records.forEach(event=>delete event.leftoverCompletedAt);}
  if(state.focus?.taskId===task.id){Object.assign(state.focus,{categoryId:task.categoryId,categoryName:task.categoryName,subjectPath:task.subjectPath,color:task.color});state.focus.immersiveFields=clone(fields);state.focus.liveNotes=fields.notes||'';saveActiveFocus();}
  state.events.filter(event=>event.focusTaskId===task.id).forEach(event=>{
    const actionTypes=normalizeActionTypes(fields.actionTypes||fields.actionType);Object.assign(event,{categoryId:task.categoryId,categoryName:task.categoryName,subjectPath:[...(task.subjectPath||[task.categoryId])],color:task.color,eventName:fields.eventName||task.categoryName+'任务',materialLocation:fields.materialLocation||'',progress:fields.progress||'',textContent:fields.summary||'',notes:fields.notes||'',leftover:fields.leftover||'',mastery:fields.mastery||'unknown',actionTypes,taskStatus:task.status});
  });
  records.forEach(event=>{const owner=leftoverOwner(event),resolved=owner.leftoverCompletedAt||(owner.focusTaskId===task.id?task.leftoverCompletedAt:null);if(resolved)event.leftoverCompletedAt=resolved;else delete event.leftoverCompletedAt;});
  if(task.reviewSourceEventId){const source=state.events.find(event=>event.id===task.reviewSourceEventId);if(source){state.reviews.filter(review=>review.sourceEventId===source.id).forEach(review=>{const mastery=review.mastery;Object.assign(review,reviewSnapshot(source));if(review.completed)review.mastery=mastery;});syncPausedReviewSource(source);}}
}
function recomputeTaskDuration(task){
  const review=state.reviews.find(item=>item.id===task.reviewId);
  // A restored/repeated review may have several historical attempts; only update its settled owner.
  const ownsResult=review?.completed&&task.status==='completed'&&(review.completedTaskId?review.completedTaskId===task.id:task.segmentEventIds.includes(review.generatedEventId));
  const records=state.events.filter(event=>event.focusTaskId===task.id);
  task.segmentEventIds=records.map(event=>event.id);task.totalSeconds=records.reduce((sum,event)=>sum+focusSeconds(event),0);
  if(ownsResult){review.completedTaskId=task.id;review.resultSeconds=task.totalSeconds;review.generatedEventId=records.at(-1)?.id||null;}
}
function pauseFocus(endedAt=Date.now()){
  if(!state.focus)return null;
  const focus=state.focus,task=ensureFocusTask(focus),fields=ensureFocusImmersionFields(focus);
  const deadline=focus.type==='countdown'?Number(focus.startedAt)+Math.max(0,focus.durationSeconds-(Number(focus.elapsedBefore)||0))*1000:Infinity;
  endedAt=Math.max(Number(focus.startedAt),Math.min(Number(endedAt),deadline));
  pushHistory();task.fields=clone(fields);
  // A segment is written once. Break time is never represented by an event.
  if(task.lastSegmentId!==focus.segmentId){
    const start=Number(focus.startedAt),end=Math.max(start,Number(endedAt));
    let cursor=start,index=0;
    do{
      const date=new Date(cursor),midnight=new Date(date.getFullYear(),date.getMonth(),date.getDate()+1).getTime(),stop=Math.min(end,midnight),seconds=Math.max(0,(stop-cursor)/1000);
      const startSlot=date.getHours()*60+date.getMinutes()+date.getSeconds()/60+date.getMilliseconds()/60000;
      const endSlot=stop===midnight?1440:startSlot+seconds/60;
      const subject=subjectById(task.categoryId),record={id:uid('event'),date:dateKey(date),halfZone:'record',taskType:task.taskType,focusTaskId:task.id,focusSegmentId:focus.segmentId+'_'+index,taskStatus:'paused',eventName:fields.eventName||task.categoryName+'任务',categoryId:task.categoryId,categoryName:task.categoryName,subjectPath:task.subjectPath,startSlot,endSlot:Math.max(startSlot+.00001,endSlot),color:task.color,opacity:subject?.opacity??.86,textSize:subject?.textSize||13,textColor:'#20231f',textOpacity:subject?.textOpacity??.92,focusSeconds:seconds,sourceReviewId:task.reviewId,sourceEventId:task.sourceEventId,sourcePlanEventId:task.planEventId,conflict:false};
      state.events.push(record);task.segmentEventIds.push(record.id);cursor=stop;index++;
    }while(cursor<end);
    task.totalSeconds=(Number(task.totalSeconds)||0)+Math.max(0,(end-start)/1000);task.lastSegmentId=focus.segmentId;task.lastPausedAt=new Date(end).toISOString();
  }
  task.status='paused';syncTaskRecords(task);clearInterval(state.focusTicker);state.focusTicker=null;state.focus=null;
  closeFocusPictureInPicture();exitImmersion();
  state.currentDate=startOfDay(new Date(endedAt));validateConflicts();saveBackup();saveActiveFocus();renderAll();return task;
}
function resumeFocusTask(id){
  const task=taskById(id);if(!task||task.status!=='paused')return;
  if(state.focus||state.pendingFocus){window.alert('请先暂停或处理当前任务。');return;}
  if(task.reviewId){const review=state.reviews.find(item=>item.id===task.reviewId);if(!review||review.completed||review.abandoned){window.alert('本次复习已结束，无法继续。');return;}}
  state.focus={taskId:task.id,categoryId:task.categoryId,categoryName:task.categoryName,subjectPath:task.subjectPath,color:task.color,type:task.type,durationSeconds:task.durationSeconds,taskType:task.taskType,startedAt:Date.now(),elapsedBefore:0,sourceEventId:task.sourceEventId,reviewId:task.reviewId,planEventId:task.planEventId,leftoverEventId:task.leftoverEventId,suppressReviews:task.suppressReviews,immersiveFields:clone(task.fields)};
  beginFocusRuntime();
}
function abandonFocusTask(id){
  const task=taskById(id);if(!task||task.status!=='paused')return;
  if(!window.confirm('放弃这个未完成任务？已保存的学习时段和历史数据会保留。'))return;
  pushHistory();task.status='abandoned';task.abandonedAt=new Date().toISOString();syncTaskRecords(task);
  if(task.reviewId){const review=state.reviews.find(item=>item.id===task.reviewId);if(review){review.abandoned=true;review.completed=false;review.abandonedAt=task.abandonedAt;}}
  if(task.planEventId){const plan=state.events.find(event=>event.id===task.planEventId);if(plan)plan.reminderIgnoredAt=task.abandonedAt;}
  if(state.pendingFocus?.taskId===id){state.pendingFocus=null;closeModal('focusDetailModal');}
  saveBackup();renderAll();
}
function openTaskCompletion(id){
  const task=taskById(id);if(!task||task.status!=='paused'||state.focus)return;
  state.pendingFocus={taskId:id};const fields=task.fields;
  dom.focusDetailTitle.textContent=task.taskType==='review'?'结束本次复习':'结束学习任务';
  dom.focusSummary.textContent=`${task.categoryName} · 累计 ${clockLabel(task.totalSeconds)} · ${task.segmentEventIds.length} 段`;
  dom.focusResultName.value=fields.eventName||'';dom.focusResultSummary.value=fields.summary||'';dom.focusResultLeftover.value=fields.leftover||'';
  dom.focusCompletionStatus.value='completed';dom.focusStartPoint.value=fields.materialLocation||'';dom.focusEndPoint.value=fields.progress||'';
  dom.focusResultMastery.value=fields.mastery||'unknown';dom.focusDetailText.value=fields.notes||'';
  dom.focusStartLabel.textContent=task.taskType==='review'?'本次起点':'资料定位';dom.focusEndLabel.textContent=task.taskType==='review'?'本次终点（选填）':'学到哪（选填）';dom.focusDetailLabel.textContent='学习笔记';
  openModal('focusDetailModal');renderUnfinishedTasks();
}
function completeFocusTask(task,completedAt=Date.now()){
  if(!task||task.status!=='paused')return false;
  task.status='completed';task.completedAt=new Date(completedAt).toISOString();syncTaskRecords(task);
  const records=state.events.filter(event=>event.focusTaskId===task.id),first=records[0],last=records.at(-1),fields=task.fields;
  records.forEach(event=>event.completedDate=dateKey(new Date(completedAt)));
  const source=state.events.find(event=>event.id===task.sourceEventId);
  if(task.reviewId){
    const review=state.reviews.find(item=>item.id===task.reviewId);
    if(review){Object.assign(review,{completed:true,abandoned:false,completedAt:task.completedAt,completedTaskId:task.id,generatedEventId:last?.id,resultSeconds:task.totalSeconds,resultSummary:fields.summary||fields.notes||'完成本次复习',resultStartPoint:task.resultStartPoint||fields.materialLocation||'',resultEndPoint:task.resultEndPoint||'',resultMastery:fields.mastery||'unknown'});
      if(source){source.mastery=fields.mastery;source.eventName=fields.eventName||eventTitle(source);if(!task.preserveSourceMaterial)source.materialLocation=fields.materialLocation||source.materialLocation;const originalTask=taskById(source.focusTaskId);if(originalTask){Object.assign(originalTask.fields,{mastery:source.mastery,eventName:source.eventName,materialLocation:source.materialLocation});syncTaskRecords(originalTask);}}
      state.reviews.filter(item=>item.sourceEventId===review.sourceEventId&&item.reviewNumber>=review.reviewNumber).forEach(item=>item.mastery=fields.mastery||'unknown');
    }
  }else if(task.taskType==='learn'&&!task.suppressReviews&&first){
    let deepest=subjectById(task.categoryId);for(const id of (task.subjectPath||[]).slice(1))deepest=deepest?.children?.find(item=>item.id===id)||deepest;
    if(deepest?.reviewEnabled!==false){task.reviewSourceEventId=first.id;generateReviews(first);}
  }
  if(task.planEventId&&source){source.planCompletedAt=task.completedAt;source.generatedEventId=last?.id;source.mastery=fields.mastery;}
  if(task.leftoverEventId){const leftoverSource=state.events.find(event=>event.id===task.leftoverEventId);if(leftoverSource)setLeftoverResolved(leftoverSource,true,task.completedAt);}
  return true;
}

function saveActiveFocus(){try{if(state.focus)localStorage.setItem(ACTIVE_FOCUS_KEY,JSON.stringify(state.focus));else localStorage.removeItem(ACTIVE_FOCUS_KEY);}catch(_){} }
function restoreActiveFocus(){
  try{
    const raw=localStorage.getItem(ACTIVE_FOCUS_KEY);const focus=state.focus||(raw?JSON.parse(raw):null);
    if(!focus||!Number.isFinite(Number(focus.startedAt))||!focus.categoryId)return;
    const task=taskById(focus.taskId);
    if(task&&task.status!=='running'){state.focus=null;localStorage.removeItem(ACTIVE_FOCUS_KEY);return;}
    state.focus=focus;ensureFocusTask(focus);saveBackup();
  }catch(_){}
}

function beginFocusRuntime({immerse=true}={}){
  if(!state.focus)return;ensureFocusTask();saveBackup();saveActiveFocus();clearInterval(state.focusTicker);state.focusTicker=setInterval(tickFocus,250);renderFocusSubjects();renderFocus();renderReviews();if(immerse)enterImmersion();
}

function handleAppResume(){checkPlanReminders();if(!state.focus)return;if(!state.focusTicker)state.focusTicker=setInterval(tickFocus,250);tickFocus();}
function startFocus(categoryId) {
  if(state.focus||state.pendingFocus)return;const s=subjectById(categoryId);if(!s)return;const type=dom.focusTimerType.value,duration=type==='countdown'?(dom.focusDuration.value==='custom'?clamp(Number(dom.focusCustomDuration.value)||1,1,600):Number(dom.focusDuration.value))*60:0;
  state.focus={categoryId,categoryName:s.name,color:s.color,type,taskType:dom.focusTaskType.value,durationSeconds:duration,startedAt:Date.now()};beginFocusRuntime();
}
function tickFocus(){
  if(!state.focus)return;const elapsed=(Number(state.focus.elapsedBefore)||0)+(Date.now()-state.focus.startedAt)/1000;
  if(state.focus.type==='countdown'&&elapsed>=state.focus.durationSeconds){finishFocus(true);return;}renderFocus();
}

function renderFocus(){
  syncFocusPictureInPictureAvailability();renderUnfinishedTasks();
  const running=Boolean(state.focus);
  dom.focusCard.classList.toggle('running',running);dom.focusClock.classList.toggle('hidden',!running);
  [dom.stopFocusBtn,dom.pauseFocusBtn,dom.enterImmersionBtn,dom.focusLiveNote].forEach(el=>el.classList.toggle('hidden',!running));
  dom.focusStatus.textContent=running?'专注中':'未开始';dom.focusStatus.classList.toggle('running',running);
  if(!running){dom.focusClock.textContent='00:00:00';dom.focusSubjectLabel.textContent='选择学科开始，或继续未完成任务';dom.focusLiveNote.value='';dom.immersionReviewCard.classList.add('hidden');dom.immersionContent.classList.remove('review-session');return;}
  const elapsed=Math.max(0,(Number(state.focus.elapsedBefore)||0)+(Date.now()-state.focus.startedAt)/1000),shown=state.focus.type==='countdown'?Math.max(0,state.focus.durationSeconds-elapsed):elapsed,task=taskById(state.focus.taskId),cumulative=(Number(task?.totalSeconds)||0)+Math.max(0,(Date.now()-state.focus.startedAt)/1000);
  dom.focusClock.textContent=clockLabel(shown);const fields=ensureFocusImmersionFields();
  dom.focusSubjectLabel.textContent=`${fields.eventName||state.focus.categoryName} · ${state.focus.taskType==='review'?'复习':'学习'} · ${state.focus.type==='countdown'?'倒计时':'累计计时'}`;
  if(document.activeElement!==dom.focusLiveNote)dom.focusLiveNote.value=fields.notes||'';syncImmersionInputs(fields);
  dom.immersionClock.textContent=clockLabel(shown);dom.immersionSubject.textContent=state.focus.categoryName;dom.immersionTotal.textContent=`本任务累计专注 ${clockLabel(cumulative)}`;
  dom.immersionMode.textContent=`${state.focus.taskType==='review'?'复习':'学习'} · ${state.focus.type==='countdown'?'倒计时':'累计专注'}`;
  renderImmersionReviewContext();renderImmersionExtras();renderPictureInPicture(shown);
}

function setImmersionAction(value,{update=true}={}){const action=normalizeActionType(value)||'new';dom.immersionActionType.value=action;[[dom.immersionActionNew,'new'],[dom.immersionActionApply,'apply'],[dom.immersionActionMemorize,'memorize']].forEach(([button,key])=>button.setAttribute('aria-checked',String(key===action)));if(update)updateFocusImmersionFields();}
function syncImmersionInputs(fields=ensureFocusImmersionFields()){if(!fields)return;[[dom.immersionMaterialLocation,'materialLocation'],[dom.immersionProgress,'progress'],[dom.immersionEventName,'eventName'],[dom.immersionSummary,'summary'],[dom.immersionLiveNote,'notes'],[dom.immersionLeftover,'leftover'],[dom.immersionMastery,'mastery']].forEach(([input,key])=>{if(document.activeElement!==input)input.value=fields[key]??'';});setImmersionAction(fields.actionType,{update:false});}

function updateFocusLiveNote(value){
  if(!state.focus)return;const fields=ensureFocusImmersionFields();fields.notes=value;state.focus.liveNotes=value;
  if(document.activeElement!==dom.focusLiveNote)dom.focusLiveNote.value=value;if(document.activeElement!==dom.immersionLiveNote)dom.immersionLiveNote.value=value;
  const task=taskById(state.focus.taskId);if(task)task.fields=clone(fields);saveBackup();saveActiveFocus();
}

function updateFocusImmersionFields(){
  if(!state.focus)return;const fields=ensureFocusImmersionFields(),actionType=normalizeActionType(dom.immersionActionType.value)||'new';Object.assign(fields,{eventName:dom.immersionEventName.value.trim(),materialLocation:dom.immersionMaterialLocation.value.trim(),progress:dom.immersionProgress.value.trim(),summary:dom.immersionSummary.value.trim(),notes:dom.immersionLiveNote.value,leftover:dom.immersionLeftover.value.trim(),actionType,actionTypes:[actionType],mastery:dom.immersionMastery.value});
  state.focus.liveNotes=fields.notes;if(document.activeElement!==dom.focusLiveNote)dom.focusLiveNote.value=fields.notes;const task=taskById(state.focus.taskId);if(task)task.fields=clone(fields);saveBackup();saveActiveFocus();
}

function renderImmersionReviewContext(){
  const review=state.reviews.find(item=>item.id===state.focus?.reviewId),plan=state.events.find(item=>item.id===state.focus?.planEventId),source=review?reviewSource(review):plan;
  if(!source){dom.immersionReviewCard.classList.add('hidden');dom.immersionContent.classList.remove('review-session');return;}
  dom.immersionReviewCard.classList.remove('hidden');dom.immersionContent.classList.add('review-session');
  dom.immersionReviewCard.innerHTML=`<div class="immersion-review-top">${review?`第 ${review.reviewNumber} 次复习 · ${reviewIntervalLabel(review,source)}`:'学习计划'} · 暂停不会标记完成</div><h3>${escapeHtml(eventTitle(source))}</h3><div class="immersion-review-tags">${normalizeActionTypes(source.actionTypes).map(type=>`<span>${escapeHtml(ACTION_TYPE_LABELS[type])}</span>`).join('')}<span>${escapeHtml(source.materialLocation||'未填写资料定位')}</span></div>`;
}

function applyImmersionSettings(){const s=state.settings;dom.immersionContent.classList.toggle('swapped',Boolean(s.immersionSwapped));dom.immersionSwapBtn.setAttribute('aria-pressed',String(Boolean(s.immersionSwapped)));dom.immersionBackdrop.className=`immersion-backdrop theme-${s.immersionTheme}`;dom.immersionBackdrop.style.setProperty('--immersion-opacity',s.immersionOpacity);dom.immersionOverlay.style.setProperty('--immersion-opacity',s.immersionOpacity);dom.immersionBackdrop.style.backgroundImage=s.immersionTheme==='custom'&&s.immersionBackground?`url("${String(s.immersionBackground).replaceAll('\\','\\\\').replaceAll('"','\\"')}")`:'';dom.immersionCountdown.style.setProperty('--countdown-size',`${clamp(Number(s.countdownSize)||30,18,64)}px`);dom.immersionCountdown.classList.remove('position-top','position-bottom');if(s.countdownPosition==='top')dom.immersionCountdown.classList.add('position-top');if(s.countdownPosition==='bottom')dom.immersionCountdown.classList.add('position-bottom');renderImmersionExtras();}
function renderImmersionExtras() {
  const s=state.settings;if(s.showCountdown&&s.countdownDate){const days=Math.ceil((parseDate(s.countdownDate)-startOfDay(new Date()))/86400000);dom.immersionCountdown.textContent=`${s.countdownName||'倒数日'} · ${days>=0?days+' 天':Math.abs(days)+' 天前'}`;dom.immersionCountdown.classList.remove('hidden');}else dom.immersionCountdown.classList.add('hidden');
  if(s.showQuote){if(!dom.immersionQuote.textContent)dom.immersionQuote.textContent=QUOTES[Math.floor(Math.random()*QUOTES.length)];dom.immersionQuote.classList.remove('hidden');}else dom.immersionQuote.classList.add('hidden');
}
function supportsFocusPictureInPicture(){const api=window.documentPictureInPicture;return Boolean(api&&typeof api.requestWindow==='function');}
function syncFocusPictureInPictureAvailability(){const supported=supportsFocusPictureInPicture();dom.immersionPipBtn.hidden=!supported;dom.immersionPipBtn.classList.toggle('hidden',!supported);dom.immersionPipBtn.setAttribute('aria-hidden',String(!supported));return supported;}
function enterImmersion(){if(!state.focus)return;applyImmersionSettings();syncFocusPictureInPictureAvailability();dom.immersionOverlay.classList.remove('hidden');}
function exitImmersion(){dom.immersionOverlay.classList.add('hidden');}
async function openFocusPictureInPicture(){
  if(!state.focus||!syncFocusPictureInPictureAvailability())return;
  if(state.pipWindow&&!state.pipWindow.closed){state.pipWindow.focus();return;}
  if(state.pipRequest)return;
  const request={focus:state.focus};state.pipRequest=request;let pip;
  try{
    pip=await window.documentPictureInPicture.requestWindow({width:200,height:150,disallowReturnToOpener:true,preferInitialWindowPlacement:true});
    if(state.focus!==request.focus||state.pipRequest!==request){pip.close();return;}
    state.pipWindow=pip;
    pip.document.head.innerHTML='<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>专注计时</title><style>*{box-sizing:border-box}body{margin:0;color:#203127;background:#f4f7f4;font-family:"Segoe UI","Microsoft YaHei",sans-serif}.pip-card{height:100vh;min-height:110px;padding:6px 8px;display:grid;grid-template-rows:1fr auto 1fr;gap:4px;text-align:center}strong{align-self:end;font-size:clamp(23px,15vw,30px);font-variant-numeric:tabular-nums;line-height:1.15}h2{margin:0;font-size:12px;line-height:1.2;overflow-wrap:anywhere}.actions{display:flex;justify-content:center;align-items:start;gap:10px}.actions button{width:36px;height:30px;padding:0;font-size:19px;border:1px solid #bacbbb;border-radius:7px;background:#fff;color:#203127}.actions .primary{color:#fff;background:#2f6b4f}</style>';pip.document.body.innerHTML='<main class="pip-card"><strong id="pipClock">00:00:00</strong><h2 id="pipSubject"></h2><div class="actions"><button id="pipBack" title="返回沉浸界面" aria-label="返回沉浸界面">↗</button><button id="pipPause" title="暂停，稍后继续" aria-label="暂停">Ⅱ</button><button id="pipStop" class="primary" title="完成 / 结束计时" aria-label="完成 / 结束计时">✓</button></div></main>';
    pip.document.getElementById('pipBack').onclick=()=>{pip.close();window.focus?.();enterImmersion();};
    pip.document.getElementById('pipPause').onclick=()=>pauseFocus();pip.document.getElementById('pipStop').onclick=()=>finishFocus(false);
    pip.addEventListener('pagehide',()=>{if(state.pipWindow===pip)state.pipWindow=null;});exitImmersion();tickFocus();
  }catch(_){
    if(pip&&!pip.closed)pip.close();if(state.pipWindow===pip)state.pipWindow=null;
    if(state.focus===request.focus)window.alert('小窗打开失败，请重试或检查浏览器支持；当前计时不受影响。');
  }finally{if(state.pipRequest===request)state.pipRequest=null;}
}
function renderPictureInPicture(shown){const pip=state.pipWindow;if(!pip||pip.closed)return;const clock=pip.document.getElementById('pipClock'),subject=pip.document.getElementById('pipSubject'),mode=pip.document.getElementById('pipMode');if(clock)clock.textContent=clockLabel(shown);if(subject){const name=(state.focus?.categoryName||'').split('/').slice(0,2).map(part=>part.trim()).join(' / ');subject.textContent=name;subject.title=state.focus?.categoryName||'';}if(mode)mode.textContent=`${state.focus?.taskType==='review'?'复习':'学习'} · ${state.focus?.type==='countdown'?'倒计时':'正计时'}`;}
function finishFocus(automatic){
  if(!state.focus)return;
  const focus=state.focus,end=automatic?Math.min(Date.now(),focus.startedAt+Math.max(0,focus.durationSeconds-(focus.elapsedBefore||0))*1000):Date.now(),task=pauseFocus(end);
  if(!task)return;openTaskCompletion(task.id);
  if(automatic){playReminderSound();showSystemNotification('专注倒计时结束','本段已保存，请选择完成或稍后继续。');}
}

function saveFocusRecord(){
  const task=taskById(state.pendingFocus?.taskId);if(!task||task.status!=='paused')return;
  pushHistory();const start=dom.focusStartPoint.value.trim(),end=dom.focusEndPoint.value.trim();
  Object.assign(task.fields,{eventName:dom.focusResultName.value.trim()||task.fields.eventName||task.categoryName+'任务',materialLocation:start,progress:end,summary:dom.focusResultSummary.value.trim(),notes:dom.focusDetailText.value.trim(),leftover:dom.focusResultLeftover.value.trim(),mastery:dom.focusResultMastery.value});
  task.resultStartPoint=start;task.resultEndPoint=end;syncTaskRecords(task);
  if(dom.focusCompletionStatus.value==='completed')completeFocusTask(task);
  state.pendingFocus=null;saveBackup();closeModal('focusDetailModal');renderAll();
}

function discardFocusRecord(){dom.focusCompletionStatus.value='paused';saveFocusRecord();}

function snapshot(){return{currentDate:state.currentDate.toISOString(),settings:clone(state.settings),categories:clone(state.categories),events:clone(state.events),reviews:clone(state.reviews),focusTasks:clone(state.focusTasks),activeFocus:state.focus?clone(state.focus):null};}

function normalizeReviewData(review){const number=Math.max(1,Number(review.reviewNumber)||1),stored=Number(review.intervalDays),preset=Number(state.settings.reviewIntervals[number-1]);return{...review,reviewNumber:number,intervalDays:Number.isFinite(stored)?stored:Number.isFinite(preset)?preset:number,reviewDate:normalizeDate(review.reviewDate),actionTypes:normalizeActionTypes(review.actionTypes)};}
function normalizeEventData(event){return{...event,date:normalizeDate(event.date),eventName:eventTitle(event),textContent:event.textContent||'',notes:event.notes||'',progress:event.progress||'',actionTypes:normalizeActionTypes(event.actionTypes)};}

function normalizeTaskData(task){
  const fields={eventName:'',materialLocation:'',progress:'',summary:'',notes:'',leftover:'',actionType:'new',mastery:'unknown',...(task.fields||{})},actionTypes=normalizeActionTypes(fields.actionTypes||fields.actionType);fields.actionType=actionTypes[0];fields.actionTypes=actionTypes;return {...task,totalSeconds:Math.max(0,Number(task.totalSeconds)||0),segmentEventIds:Array.isArray(task.segmentEventIds)?task.segmentEventIds:[],fields};
}
function restore(data){
  clearInterval(state.focusTicker);state.focusTicker=null;state.pendingFocus=null;
  state.mergeMode=false;state.mergeSelection.clear();dom.eventMergeName.value='';
  closeFocusPictureInPicture();exitImmersion();
  state.currentDate=startOfDay(new Date(data.currentDate));state.settings={...clone(defaultSettings),...clone(data.settings)};
  state.categories=clone(data.categories);state.events=clone(data.events).map(normalizeEventData);state.reviews=clone(data.reviews).map(normalizeReviewData);
  state.focusTasks=(data.focusTasks||[]).map(normalizeTaskData);state.focus=data.activeFocus?clone(data.activeFocus):null;
  state.focusTasks.forEach(task=>{if(task.status==='running'&&task.id!==state.focus?.taskId)task.status='paused';});
  closePlanReminder();validateConflicts();migrateCategories();carryOverReviews();syncSettingsToUI();applyLayoutSettings();refreshCategoryUI();saveBackup();saveActiveFocus();renderAll();if(state.focus)beginFocusRuntime({immerse:false});checkPlanReminders();
}

function pushHistory(){state.history.push(snapshot());if(state.history.length>50)state.history.shift();state.future=[];}
function undo(){if(!state.history.length)return;state.future.push(snapshot());restore(state.history.pop());}
function redo(){if(!state.future.length)return;state.history.push(snapshot());restore(state.future.pop());}
function saveBackup(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify({version:DATA_VERSION,...snapshot()}));}catch(_){}}

function loadBackup(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return;const data=JSON.parse(raw);
    state.settings={...clone(defaultSettings),...(data.settings||{})};if(!Array.isArray(state.settings.reviewIntervals))state.settings.reviewIntervals=parseIntervals(state.settings.reviewIntervals||'1,3,7,14,30');
    state.categories=Array.isArray(data.categories)&&data.categories.length?data.categories:clone(defaultCategories);
    state.events=Array.isArray(data.events)?data.events.map(normalizeEventData):[];state.reviews=Array.isArray(data.reviews)?data.reviews.map(normalizeReviewData):[];
    state.focusTasks=Array.isArray(data.focusTasks)?data.focusTasks.map(normalizeTaskData):[];state.focus=data.activeFocus||null;
    if(data.currentDate)state.currentDate=startOfDay(new Date(data.currentDate));migrateCategories();validateConflicts();
  }catch(_){state.settings=clone(defaultSettings);state.categories=clone(defaultCategories);state.events=[];state.reviews=[];state.focusTasks=[];state.focus=null;}
}

function exportData(){const data={version:DATA_VERSION,exportedAt:new Date().toISOString(),...snapshot()};downloadBlob(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),`学习日志_${dateKey(new Date())}.json`);}

function importData(){const file=dom.importInput.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const data=JSON.parse(String(reader.result));if(!window.confirm('导入会覆盖当前数据，是否继续？'))return;pushHistory();restore({currentDate:data.currentDate||new Date().toISOString(),settings:data.settings||defaultSettings,categories:data.categories?.length?data.categories:defaultCategories,events:data.events||[],reviews:data.reviews||[],focusTasks:data.focusTasks||[],activeFocus:data.activeFocus||null});}catch(_){window.alert('导入失败：文件格式无效。');}};reader.readAsText(file);dom.importInput.value='';}
function shiftReportDate(amount){refreshReviewDay();state.currentDate=addDays(state.currentDate,amount);state.selectedEventId=null;saveBackup();renderAll();exportImage(false);}
function exportImage(openPreview=true){
  if(typeof openPreview!=='boolean')openPreview=true;
  const width=1400,header=360,target=createLayout(width,54,header),output=document.createElement('canvas'),scale=2;output.width=width*scale;output.height=(target.height+24)*scale;const c=output.getContext('2d');c.setTransform(scale,0,0,scale,0,0);c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';const records=currentEvents().filter((event)=>event.halfZone==='record'),totalSeconds=records.reduce((sum,event)=>sum+focusSeconds(event),0),pending=state.reviews.filter((review)=>review.reviewDate===currentDateKey()&&!review.completed&&!review.abandoned).length;
  c.fillStyle='#fff';c.fillRect(0,0,output.width,output.height);c.fillStyle='#20231f';c.font='800 34px "Segoe UI","Microsoft YaHei"';c.fillText('学习日报',42,54);c.fillStyle='#444';c.font='15px "Segoe UI"';c.fillText(`${state.currentDate.getFullYear()}年${dateLabel(state.currentDate)}`,43,82);
  const metrics=[['学习总时长',durationLabel(totalSeconds)],['记录事件',`${records.length} 项`],['待复习',`${pending} 项`]];metrics.forEach(([label,value],index)=>{const x=42+index*225;c.fillStyle='#f5f5f0';roundRect(c,x,112,205,96,16);c.fill();c.fillStyle='#444';c.font='12px "Segoe UI"';c.fillText(label,x+18,141);c.fillStyle='#20231f';c.font='800 26px "Segoe UI"';c.fillText(value,x+18,181);});
  const distribution=new Map();records.forEach((event)=>{const subject=subjectById(event.categoryId),key=subject?.id||'other',item=distribution.get(key)||{name:subject?.name||'未分类',color:subject?.color||event.color||'#88928b',seconds:0};item.seconds+=focusSeconds(event);distribution.set(key,item);});const items=[...distribution.values()],sum=items.reduce((value,item)=>value+item.seconds,0),cx=930,cy=161,radius=82;c.lineWidth=28;let angle=-Math.PI/2;if(sum){items.forEach((item)=>{const next=angle+item.seconds/sum*Math.PI*2;c.strokeStyle=item.color;c.beginPath();c.arc(cx,cy,radius,angle,next);c.stroke();angle=next;});}else{c.strokeStyle='#e5e7e2';c.beginPath();c.arc(cx,cy,radius,0,Math.PI*2);c.stroke();}c.fillStyle='#20231f';c.textAlign='center';c.font='800 21px "Segoe UI"';c.fillText(durationLabel(totalSeconds),cx,158);c.fillStyle='#444';c.font='11px "Segoe UI"';c.fillText('记录区总时长',cx,178);c.textAlign='left';items.slice(0,6).forEach((item,index)=>{const x=1060,y=125+index*27;c.fillStyle=item.color;c.beginPath();c.arc(x,y-4,5,0,Math.PI*2);c.fill();c.fillStyle='#3d443f';c.font='12px "Segoe UI"';c.fillText(`${item.name}  ${sum?Math.round(item.seconds/sum*100):0}%`,x+13,y);});
  c.fillStyle='#20231f';c.font='800 17px "Segoe UI"';c.fillText('学习时间轴',42,287);c.fillStyle='#444';c.font='11px "Segoe UI"';c.fillText('箭头颜色代表学科；虚线代表复习任务',42,309);c.textAlign='center';c.font='800 12px "Segoe UI"';c.fillText('计划区',target.planWidth/2,348);c.fillText('记录区',target.planWidth+(target.width-target.planWidth)/2,348);drawTimeline(c,target,{exportMode:true});
  const url=output.toDataURL('image/png');dom.dailyReportPreview.src=url;dom.dailyReportDownload.href=url;dom.dailyReportDownload.download=`学习日报_${currentDateKey()}.png`;dom.reportDateLabel.textContent=`${state.currentDate.getFullYear()}-${pad(state.currentDate.getMonth()+1)}-${pad(state.currentDate.getDate())}`;if(openPreview){closeToolbarMenu();openModal('reportModal');}
}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

function matchesShortcut(event,shortcut) {
  const parts=String(shortcut||'Ctrl+Enter').toLowerCase().split('+').map((x)=>x.trim()),key=parts.at(-1);
  return event.key.toLowerCase()===key&&event.ctrlKey===parts.includes('ctrl')&&event.altKey===parts.includes('alt')&&event.shiftKey===parts.includes('shift')&&event.metaKey===parts.includes('meta');
}
function onKeydown(event) {
  if(trapOverlayTab(event))return;
  const typing=['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName);
  if(!typing&&matchesShortcut(event,state.settings.shortcut)){event.preventDefault();toggleSelection();return;}
  if(event.key==='Escape'){if(state.modalStack.length){event.preventDefault();const id=state.modalStack.at(-1);if(id==='planReminderModal')snoozePlanReminder();else closeModal(id);return;}if(!dom.immersionOverlay.classList.contains('hidden')){exitImmersion();return;}if(dom.reviewCard.classList.contains('fullscreen')){toggleReviewFullscreen();return;}if(state.mergeMode){event.preventDefault();cancelMergeMode();return;}cancelSelection();hideContextMenu();closeToolbarMenu();closeAllModals();}
  if(!typing&&event.ctrlKey&&event.key.toLowerCase()==='z'){event.preventDefault();undo();}
  if(!typing&&event.ctrlKey&&event.key.toLowerCase()==='y'){event.preventDefault();redo();}
}
function renderAll(){renderDate();renderTimeline();renderReviews();renderFocusSubjects();renderFocus();renderMergeBar();}

updateFocusDurationUI();
checkPlanReminders();
state.planReminderTicker=setInterval(checkPlanReminders,15000);
if('serviceWorker'in navigator&&/^https?:$/.test(location.protocol))navigator.serviceWorker.register('./sw.js?v=32').catch(()=>{});
