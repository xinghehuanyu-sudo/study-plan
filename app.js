const STORAGE_KEY = 'learning_tool_backup';
const DATA_VERSION = 2;
const REVIEW_OFFSETS = [1, 3, 6, 10, 14];
const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

function uid(prefix) {
  const value = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${value}`;
}

const defaultCategories = [
  { id: uid('category'), name: '数学', color: '#d86b4b', opacity: 0.86 },
  { id: uid('category'), name: '英语', color: '#4f8a6e', opacity: 0.86 },
  { id: uid('category'), name: '专业课', color: '#5578b8', opacity: 0.86 }
];

const defaultSettings = {
  startHour: 0,
  hourHeight: 56,
  minuteInterval: 5,
  hiddenHours: '',
  reviewColor: '#8a62ad',
  reviewOpacity: 0.84,
  planRatio: 0.5,
  defaultPlanColor: '#d09a55',
  defaultRecordColor: '#4f8aa8',
  defaultEventOpacity: 0.86,
  defaultTextSize: 13,
  defaultTextColor: '#20231f',
  defaultTextOpacity: 0.92
};

const state = {
  currentDate: startOfDay(new Date()),
  settings: clone(defaultSettings),
  categories: clone(defaultCategories),
  events: [],
  reviews: [],
  reviewFilter: 'today',
  history: [],
  future: [],
  editingEventId: null,
  selection: null,
  selectedEventId: null,
  hoveredEventId: null,
  focus: null,
  pendingFocus: null,
  focusTicker: null
};

const ids = [
  'currentDateLabel', 'reviewBadge', 'timelineScroll', 'timelineCanvas', 'reviewList', 'contextMenu', 'importInput',
  'selectionBar', 'selectionHint', 'selectionZoneBtn', 'eventModal', 'settingsModal', 'focusDetailModal',
  'eventModalTitle', 'eventHalfZone', 'eventTaskType', 'eventCategory', 'eventColor', 'eventOpacity',
  'eventTextContent', 'eventTextSize', 'eventTextColor', 'eventTextOpacity', 'eventStartHour', 'eventStartMinute',
  'eventEndHour', 'eventEndMinute', 'eventTimeSummary', 'settingStartHour', 'settingHourHeight', 'settingPlanRatio',
  'settingMinuteInterval', 'settingHiddenHours', 'settingReviewColor', 'settingReviewOpacity', 'categoryTable',
  'focusSubjects', 'focusTimerType', 'focusDurationWrap', 'focusDuration', 'focusClock', 'focusSubjectLabel',
  'focusStatus', 'stopFocusBtn', 'focusSummary', 'focusDetailText'
];
const dom = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
const canvas = dom.timelineCanvas;
const ctx = canvas.getContext('2d');
let currentLayout = null;

loadBackup();
bindEvents();
syncSettingsToUI();
refreshCategoryUI();
renderAll();

function bindEvents() {
  document.getElementById('addEventBtn').addEventListener('click', () => beginSelection('plan'));
  document.getElementById('cancelSelectionBtn').addEventListener('click', cancelSelection);
  dom.selectionZoneBtn.addEventListener('click', () => beginSelection(state.selection?.zone === 'record' ? 'plan' : 'record'));
  document.getElementById('settingsBtn').addEventListener('click', openSettingsModal);
  document.getElementById('exportImageBtn').addEventListener('click', exportImage);
  document.getElementById('exportDataBtn').addEventListener('click', exportData);
  document.getElementById('importDataBtn').addEventListener('click', () => dom.importInput.click());
  document.getElementById('clearEventsBtn').addEventListener('click', clearEvents);
  document.getElementById('undoBtn').addEventListener('click', undo);
  document.getElementById('redoBtn').addEventListener('click', redo);
  document.getElementById('prevDayBtn').addEventListener('click', () => shiftDate(-1));
  document.getElementById('nextDayBtn').addEventListener('click', () => shiftDate(1));
  document.getElementById('saveEventBtn').addEventListener('click', saveEventFromModal);
  document.getElementById('addCategoryBtn').addEventListener('click', addCategory);
  document.getElementById('stopFocusBtn').addEventListener('click', () => finishFocus(false));
  document.getElementById('saveFocusBtn').addEventListener('click', saveFocusRecord);
  document.getElementById('discardFocusBtn').addEventListener('click', discardFocusRecord);
  dom.focusTimerType.addEventListener('change', () => {
    dom.focusDurationWrap.classList.toggle('hidden', dom.focusTimerType.value !== 'countdown');
  });
  dom.importInput.addEventListener('change', importData);
  document.querySelectorAll('.filter-btn').forEach((button) => button.addEventListener('click', () => setReviewFilter(button.dataset.filter)));
  document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => closeModal(button.dataset.close)));

  [dom.settingStartHour, dom.settingHourHeight, dom.settingPlanRatio, dom.settingHiddenHours, dom.settingReviewColor, dom.settingReviewOpacity]
    .forEach((input) => input.addEventListener('input', updateSettingsFromUI));
  dom.settingMinuteInterval.addEventListener('change', updateSettingsFromUI);
  dom.eventTaskType.addEventListener('change', syncEventAppearance);
  dom.eventCategory.addEventListener('change', syncEventAppearance);
  [dom.eventStartHour, dom.eventStartMinute, dom.eventEndHour, dom.eventEndMinute]
    .forEach((input) => input.addEventListener('input', updateTimeSummary));

  canvas.addEventListener('click', onCanvasClick);
  canvas.addEventListener('dblclick', onCanvasDoubleClick);
  canvas.addEventListener('mousemove', onCanvasMove);
  canvas.addEventListener('mouseleave', () => {
    state.hoveredEventId = null;
    if (state.selection) state.selection.hoverSlot = null;
    renderTimeline();
  });
  canvas.addEventListener('contextmenu', onCanvasContextMenu);
  window.addEventListener('resize', renderTimeline);
  window.addEventListener('keydown', onKeydown);
  document.addEventListener('click', (event) => {
    if (!dom.contextMenu.contains(event.target)) hideContextMenu();
  });
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function pad(value) { return String(value).padStart(2, '0'); }
function startOfDay(date) { const next = new Date(date); next.setHours(0, 0, 0, 0); return next; }
function addDays(date, amount) { const next = new Date(date); next.setDate(next.getDate() + amount); return next; }
function formatDateKey(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
function currentDateKey() { return formatDateKey(state.currentDate); }
function formatDateLabel(date) { return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 · 星期${WEEKDAY_NAMES[date.getDay()]}`; }
function formatStamp(date) { return `${formatDateKey(date)}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`; }
function minuteToSlot(hour, minute) { return hour * 60 + minute; }
function slotParts(slot) { const value = clamp(Math.round(slot), 0, 1439); return { hour: Math.floor(value / 60), minute: value % 60 }; }
function slotLabel(slot) { const value = slotParts(slot); return `${pad(value.hour)}:${pad(value.minute)}`; }
function escapeHtml(text) { return String(text ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'); }
function parseDateKey(key) { const parts = String(key).split('-').map(Number); return new Date(parts[0], parts[1] - 1, parts[2]); }

function parseHiddenHours(text) {
  return String(text || '').split(',').map((item) => item.trim()).filter(Boolean).map((item) => item.split('-').map(Number))
    .filter(([start, end]) => Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end <= 24 && start < end);
}

function visibleHours() {
  const hidden = parseHiddenHours(state.settings.hiddenHours);
  const values = [];
  for (let offset = 0; offset < 24; offset += 1) {
    const hour = (state.settings.startHour + offset) % 24;
    if (!hidden.some(([start, end]) => hour >= start && hour < end)) values.push(hour);
  }
  return values;
}

function isRangeVisible(startSlot, endSlot) {
  const hours = visibleHours();
  for (let slot = startSlot; slot < endSlot; slot += 1) {
    if (!hours.includes(slotParts(slot).hour)) return false;
  }
  return true;
}

function snapSlot(slot) {
  const interval = Number(state.settings.minuteInterval) || 5;
  return clamp(Math.round(slot / interval) * interval, 0, 1439);
}

function createLayout(width, hourHeight, top = 0) {
  const hours = visibleHours();
  const ratio = clamp(Number(state.settings.planRatio) || .5, .3, .7);
  return { hours, width, hourHeight, top, height: top + hours.length * hourHeight, planWidth: Math.round(width * ratio) };
}

function resizeCanvas() {
  const width = Math.max(560, dom.timelineScroll.clientWidth || 900);
  currentLayout = createLayout(width, state.settings.hourHeight, 0);
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(currentLayout.width * dpr);
  canvas.height = Math.round(currentLayout.height * dpr);
  canvas.style.height = `${currentLayout.height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return currentLayout;
}

function slotY(slot, layout) {
  const parts = slotParts(slot);
  const index = layout.hours.indexOf(parts.hour);
  if (index < 0) return null;
  return layout.top + index * layout.hourHeight + parts.minute / 60 * layout.hourHeight;
}

function eventSegments(event, layout) {
  const segments = [];
  const zoneLeft = event.halfZone === 'record' ? layout.planWidth : 0;
  const zoneRight = event.halfZone === 'record' ? layout.width : layout.planWidth;
  const left = zoneLeft + 18;
  const usableWidth = Math.max(40, zoneRight - zoneLeft - 36);
  layout.hours.forEach((hour, hourIndex) => {
    const hourStart = hour * 60;
    const hourEnd = hourStart + 60;
    const start = Math.max(event.startSlot, hourStart);
    const end = Math.min(event.endSlot, hourEnd);
    if (end <= start) return;
    const startMinute = start - hourStart;
    const endMinute = end - hourStart;
    const rawX1 = left + startMinute / 60 * usableWidth;
    const rawX2 = left + endMinute / 60 * usableWidth;
    const minWidth = 12;
    const x1 = rawX1;
    const x2 = Math.min(zoneRight - 10, Math.max(rawX2, rawX1 + minWidth));
    segments.push({ x1, x2, y: layout.top + hourIndex * layout.hourHeight + layout.hourHeight / 2, first: start === event.startSlot, last: end === event.endSlot });
  });
  return segments;
}

function eventStyle(event) {
  if (event.taskType === 'review') return { color: state.settings.reviewColor, opacity: state.settings.reviewOpacity };
  const category = state.categories.find((item) => item.id === event.categoryId);
  return { color: event.color || category?.color || (event.halfZone === 'record' ? state.settings.defaultRecordColor : state.settings.defaultPlanColor), opacity: event.opacity ?? category?.opacity ?? .86 };
}

function hexToRgb(hex) {
  const safe = /^#[0-9a-f]{6}$/i.test(hex || '') ? hex.slice(1) : '6b746d';
  const value = Number.parseInt(safe, 16);
  return { r: value >> 16, g: value >> 8 & 255, b: value & 255 };
}

function rgba(hex, alpha) { const rgb = hexToRgb(hex); return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`; }
function currentEvents() { return state.events.filter((event) => event.date === currentDateKey()); }

function drawTimeline(context, layout, options = {}) {
  const exportMode = Boolean(options.exportMode);
  context.save();
  context.fillStyle = '#ffffff';
  context.fillRect(0, layout.top, layout.width, layout.height - layout.top);
  context.font = '12px "Segoe UI", "Microsoft YaHei", sans-serif';

  layout.hours.forEach((hour, index) => {
    const y = layout.top + index * layout.hourHeight;
    if (index % 2) {
      context.fillStyle = '#fcfcfa';
      context.fillRect(0, y, layout.width, layout.hourHeight);
    }
    context.strokeStyle = '#ecebe6';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(0, y + .5);
    context.lineTo(layout.width, y + .5);
    context.stroke();
  });
  context.strokeStyle = '#d6d7d1';
  context.beginPath();
  context.moveTo(layout.planWidth + .5, layout.top);
  context.lineTo(layout.planWidth + .5, layout.height);
  context.stroke();

  currentEvents().forEach((event) => drawEvent(context, layout, event, exportMode));

  if (!exportMode && state.selection) drawSelectionPoints(context, layout);

  layout.hours.forEach((hour, index) => {
    const centerY = layout.top + index * layout.hourHeight + layout.hourHeight / 2;
    context.fillStyle = '#fff';
    context.fillRect(layout.planWidth - 15, centerY - 10, 30, 20);
    context.fillStyle = hourColor(hour);
    context.font = `700 ${exportMode ? 13 : 12}px "Segoe UI", sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(String(hour), layout.planWidth, centerY);
  });
  context.restore();
}

function hourColor(hour) {
  if (hour < 6) return '#60799b';
  if (hour < 12) return '#4d8063';
  if (hour < 18) return '#b06f35';
  return '#765c91';
}

function drawSelectionPoints(context, layout) {
  const selection = state.selection;
  const hoverParts = Number.isFinite(selection.hoverSlot) ? slotParts(selection.hoverSlot) : null;
  const hoursToShow = new Set();
  if (hoverParts) hoursToShow.add(hoverParts.hour);
  if (Number.isFinite(selection.startSlot)) hoursToShow.add(slotParts(selection.startSlot).hour);
  const zoneLeft = selection.zone === 'record' ? layout.planWidth : 0;
  const zoneRight = selection.zone === 'record' ? layout.width : layout.planWidth;
  const left = zoneLeft + 18;
  const width = zoneRight - zoneLeft - 36;
  const interval = Math.max(1, Number(state.settings.minuteInterval) || 5);

  hoursToShow.forEach((hour) => {
    const hourIndex = layout.hours.indexOf(hour);
    if (hourIndex < 0) return;
    const y = layout.top + hourIndex * layout.hourHeight + layout.hourHeight / 2;
    for (let minute = 0; minute < 60; minute += interval) {
      const slot = hour * 60 + minute;
      if (Number.isFinite(selection.startSlot) && slot <= selection.startSlot) continue;
      const x = left + minute / 60 * width;
      context.beginPath();
      context.fillStyle = slot === selection.hoverSlot ? '#2f6b4f' : 'rgba(47,107,79,.28)';
      context.arc(x, y, slot === selection.hoverSlot ? 4 : 2, 0, Math.PI * 2);
      context.fill();
    }
  });

  if (Number.isFinite(selection.startSlot)) {
    const parts = slotParts(selection.startSlot);
    const index = layout.hours.indexOf(parts.hour);
    if (index >= 0) {
      const x = left + parts.minute / 60 * width;
      const y = layout.top + index * layout.hourHeight + layout.hourHeight / 2;
      context.save();
      context.beginPath(); context.fillStyle = '#f3a83b'; context.strokeStyle = '#fff'; context.lineWidth = 5; context.arc(x, y, 8, 0, Math.PI * 2); context.stroke(); context.fill();
      if (selection.hoverSlot !== selection.startSlot) drawSelectionLabel(context, x, y, `起点 ${slotLabel(selection.startSlot)}`, zoneLeft, zoneRight, '#a96508');
      context.restore();
    }
  }

  if (Number.isFinite(selection.hoverSlot)) {
    const parts = slotParts(selection.hoverSlot);
    const index = layout.hours.indexOf(parts.hour);
    if (index >= 0) {
      const x = left + parts.minute / 60 * width;
      const y = layout.top + index * layout.hourHeight + layout.hourHeight / 2;
      context.save();
      context.strokeStyle = 'rgba(255,255,255,.96)'; context.lineWidth = 4; context.lineCap = 'round';
      context.beginPath(); context.moveTo(x - 10, y); context.lineTo(x + 10, y); context.moveTo(x, y - 10); context.lineTo(x, y + 10); context.stroke();
      context.strokeStyle = '#356957'; context.lineWidth = 1.5;
      context.beginPath(); context.moveTo(x - 10, y); context.lineTo(x + 10, y); context.moveTo(x, y - 10); context.lineTo(x, y + 10); context.stroke();
      context.beginPath(); context.fillStyle = '#fff'; context.strokeStyle = '#356957'; context.lineWidth = 2; context.arc(x, y, 6, 0, Math.PI * 2); context.fill(); context.stroke();
      context.beginPath(); context.fillStyle = '#356957'; context.arc(x, y, 2, 0, Math.PI * 2); context.fill();
      const label = selection.hoverSlot === selection.startSlot ? `起点 ${slotLabel(selection.hoverSlot)}` : slotLabel(selection.hoverSlot);
      drawSelectionLabel(context, x, y, label, zoneLeft, zoneRight, '#356957');
      context.restore();
    }
  }
}

function drawSelectionLabel(context, x, y, text, zoneLeft, zoneRight, color) {
  context.font = '700 12px "Segoe UI", "Microsoft YaHei", sans-serif';
  const width = context.measureText(text).width + 18;
  const labelX = clamp(x - width / 2, zoneLeft + 6, zoneRight - width - 6);
  const labelY = y < 38 ? y + 17 : y - 34;
  context.fillStyle = color;
  roundRect(context, labelX, labelY, width, 24, 8); context.fill();
  context.fillStyle = '#fff'; context.textAlign = 'center'; context.textBaseline = 'middle';
  context.fillText(text, labelX + width / 2, labelY + 12);
}

function drawEvent(context, layout, event, exportMode) {
  const segments = eventSegments(event, layout);
  if (!segments.length) return;
  const style = eventStyle(event);
  const active = !exportMode && (state.selectedEventId === event.id || state.hoveredEventId === event.id);
  const color = rgba(style.color, style.opacity);

  segments.forEach((segment) => {
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = active ? 7 : 5;
    context.lineCap = 'round';
    if (event.conflict) context.setLineDash([4, 3]);
    context.beginPath();
    context.moveTo(segment.x1, segment.y);
    context.lineTo(segment.x2, segment.y);
    context.stroke();
    context.setLineDash([]);
    if (segment.first) { context.beginPath(); context.arc(segment.x1, segment.y, active ? 5 : 4, 0, Math.PI * 2); context.fill(); }
    if (segment.last) {
      context.beginPath(); context.moveTo(segment.x2 + 1, segment.y); context.lineTo(segment.x2 - 7, segment.y - 5); context.lineTo(segment.x2 - 7, segment.y + 5); context.closePath(); context.fill();
    }
  });

  const first = segments[0];
  const category = event.textContent || event.categoryName || '事件';
  const label = `${slotLabel(event.startSlot)}–${slotLabel(event.endSlot)}  ${category}`;
  const zoneLeft = event.halfZone === 'record' ? layout.planWidth : 0;
  const zoneRight = event.halfZone === 'record' ? layout.width : layout.planWidth;
  const maxWidth = Math.max(70, zoneRight - zoneLeft - 42);
  context.font = `${exportMode ? 13 : clamp(event.textSize || 12, 10, 15)}px "Segoe UI", "Microsoft YaHei", sans-serif`;
  const fitted = fitText(context, label, maxWidth);
  const labelWidth = context.measureText(fitted).width + 12;
  let labelX = clamp((first.x1 + first.x2) / 2 - labelWidth / 2, zoneLeft + 8, zoneRight - labelWidth - 8);
  const labelY = first.y - 23;
  context.fillStyle = 'rgba(255,255,255,.96)';
  roundRect(context, labelX, labelY, labelWidth, 19, 6); context.fill();
  context.fillStyle = event.textColor || '#20231f';
  context.globalAlpha = event.textOpacity ?? .92;
  context.textAlign = 'center'; context.textBaseline = 'middle';
  context.fillText(fitted, labelX + labelWidth / 2, labelY + 9.5);
  context.globalAlpha = 1;
}

function fitText(context, text, maxWidth) {
  if (context.measureText(text).width <= maxWidth) return text;
  let value = text;
  while (value.length > 2 && context.measureText(`${value}…`).width > maxWidth) value = value.slice(0, -1);
  return `${value}…`;
}

function roundRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath(); context.moveTo(x + r, y); context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r); context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r); context.closePath();
}

function renderTimeline() { const layout = resizeCanvas(); ctx.clearRect(0, 0, layout.width, layout.height); drawTimeline(ctx, layout); canvas.classList.toggle('selecting', Boolean(state.selection)); }
function renderAll() { dom.currentDateLabel.textContent = formatDateLabel(state.currentDate); renderSelectionBar(); renderTimeline(); renderReviews(); renderFocusSubjects(); renderFocus(); }

function pointerInfo(event) {
  const layout = currentLayout || resizeCanvas();
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * layout.width / rect.width;
  const y = (event.clientY - rect.top) * layout.height / rect.height;
  const index = clamp(Math.floor((y - layout.top) / layout.hourHeight), 0, layout.hours.length - 1);
  const zone = x < layout.planWidth ? 'plan' : 'record';
  const zoneLeft = zone === 'record' ? layout.planWidth : 0;
  const zoneRight = zone === 'record' ? layout.width : layout.planWidth;
  const usableWidth = Math.max(40, zoneRight - zoneLeft - 36);
  const localX = clamp(x - zoneLeft - 18, 0, usableWidth);
  const minute = Math.round(localX / usableWidth * 60);
  return { x, y, zone, slot: snapSlot(layout.hours[index] * 60 + minute) };
}

function hitTest(event) {
  const point = pointerInfo(event);
  return [...currentEvents()].reverse().find((item) => eventSegments(item, currentLayout).some((segment) => point.x >= segment.x1 - 8 && point.x <= segment.x2 + 8 && Math.abs(point.y - segment.y) <= 12)) || null;
}

function beginSelection(zone = 'plan') {
  closeModal('eventModal');
  state.selection = { zone, startSlot: null, hoverSlot: null };
  state.selectedEventId = null;
  renderSelectionBar();
  renderTimeline();
}

function cancelSelection() { state.selection = null; renderSelectionBar(); renderTimeline(); }

function renderSelectionBar() {
  const selection = state.selection;
  dom.selectionBar.classList.toggle('hidden', !selection);
  if (!selection) return;
  const zoneName = selection.zone === 'plan' ? '计划区' : '记录区';
  dom.selectionHint.textContent = Number.isFinite(selection.startSlot) ? `开始 ${slotLabel(selection.startSlot)}，请在${zoneName}选择结束时间` : `请在${zoneName}选择开始时间`;
  dom.selectionZoneBtn.textContent = selection.zone === 'plan' ? '切换到记录区' : '切换到计划区';
}

function onCanvasClick(event) {
  if (state.selection) {
    const point = pointerInfo(event);
    if (point.zone !== state.selection.zone) {
      window.alert(`当前正在${state.selection.zone === 'plan' ? '计划区' : '记录区'}选点，请在对应半区点击。`);
      return;
    }
    if (!Number.isFinite(state.selection.startSlot)) {
      state.selection.startSlot = point.slot;
      state.selection.hoverSlot = point.slot;
      renderSelectionBar(); renderTimeline();
      return;
    }
    if (point.slot <= state.selection.startSlot) {
      window.alert('结束时间需要晚于开始时间。');
      return;
    }
    const preset = { halfZone: state.selection.zone, startSlot: state.selection.startSlot, endSlot: point.slot };
    state.selection = null;
    renderSelectionBar();
    openEventModal(null, preset);
    return;
  }
  const hit = hitTest(event);
  state.selectedEventId = hit?.id || null;
  renderTimeline();
}

function onCanvasDoubleClick(event) { if (!state.selection) { const hit = hitTest(event); if (hit) openEventModal(hit); } }
function onCanvasMove(event) {
  if (state.selection) { const point = pointerInfo(event); state.selection.hoverSlot = point.zone === state.selection.zone ? point.slot : null; renderTimeline(); return; }
  const hit = hitTest(event); const next = hit?.id || null;
  if (next !== state.hoveredEventId) { state.hoveredEventId = next; renderTimeline(); }
}

function onCanvasContextMenu(event) {
  event.preventDefault();
  if (state.selection) return;
  const hit = hitTest(event);
  if (!hit) return;
  dom.contextMenu.innerHTML = `<button data-action="edit">编辑事件</button><button class="danger" data-action="delete">删除事件</button>`;
  dom.contextMenu.style.left = `${event.clientX}px`; dom.contextMenu.style.top = `${event.clientY}px`; dom.contextMenu.classList.remove('hidden');
  dom.contextMenu.querySelector('[data-action="edit"]').onclick = () => { hideContextMenu(); openEventModal(hit); };
  dom.contextMenu.querySelector('[data-action="delete"]').onclick = () => { hideContextMenu(); deleteEvent(hit.id); };
}

function hideContextMenu() { dom.contextMenu.classList.add('hidden'); dom.contextMenu.innerHTML = ''; }

function openModal(id) { const modal = document.getElementById(id); modal.classList.remove('hidden'); modal.setAttribute('aria-hidden', 'false'); }
function closeModal(id) { const modal = document.getElementById(id); if (!modal) return; modal.classList.add('hidden'); modal.setAttribute('aria-hidden', 'true'); }

function openEventModal(event = null, preset = null) {
  state.editingEventId = event?.id || null;
  dom.eventModalTitle.textContent = event ? '编辑事件' : '添加事件';
  const zone = event?.halfZone || preset?.halfZone || 'plan';
  const startSlot = event?.startSlot ?? preset?.startSlot ?? minuteToSlot(8, 0);
  const endSlot = event?.endSlot ?? preset?.endSlot ?? minuteToSlot(9, 0);
  dom.eventHalfZone.value = zone;
  dom.eventTaskType.value = event?.taskType || 'learn';
  dom.eventTextContent.value = event?.textContent || '';
  dom.eventTextSize.value = event?.textSize || state.settings.defaultTextSize;
  dom.eventTextColor.value = event?.textColor || state.settings.defaultTextColor;
  dom.eventTextOpacity.value = event?.textOpacity ?? state.settings.defaultTextOpacity;
  const start = slotParts(startSlot); const end = slotParts(endSlot);
  dom.eventStartHour.value = start.hour; dom.eventStartMinute.value = start.minute;
  dom.eventEndHour.value = end.hour; dom.eventEndMinute.value = end.minute;
  syncCategoryOptions(event?.categoryId);
  dom.eventColor.value = event?.color || state.categories.find((item) => item.id === dom.eventCategory.value)?.color || state.settings.defaultPlanColor;
  dom.eventOpacity.value = event?.opacity ?? state.settings.defaultEventOpacity;
  syncEventAppearance(Boolean(event || preset));
  updateTimeSummary();
  openModal('eventModal');
  setTimeout(() => dom.eventTextContent.focus(), 0);
}

function readModalTime() {
  const values = [dom.eventStartHour, dom.eventStartMinute, dom.eventEndHour, dom.eventEndMinute].map((input) => Number(input.value));
  if (values.some((value) => !Number.isFinite(value))) return null;
  return { startSlot: minuteToSlot(clamp(values[0], 0, 23), clamp(values[1], 0, 59)), endSlot: minuteToSlot(clamp(values[2], 0, 23), clamp(values[3], 0, 59)) };
}

function updateTimeSummary() { const range = readModalTime(); dom.eventTimeSummary.textContent = range ? `${slotLabel(range.startSlot)} – ${slotLabel(range.endSlot)}` : '尚未选择时间'; }

function syncCategoryOptions(selectedId) {
  dom.eventCategory.innerHTML = state.categories.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('');
  dom.eventCategory.value = selectedId && state.categories.some((item) => item.id === selectedId) ? selectedId : state.categories[0]?.id || '';
}

function syncEventAppearance(preserve = false) {
  const category = state.categories.find((item) => item.id === dom.eventCategory.value);
  if (!state.editingEventId && dom.eventTaskType.value === 'learn' && !preserve) dom.eventHalfZone.value = 'plan';
  if (!state.editingEventId && dom.eventTaskType.value === 'review' && !preserve) dom.eventHalfZone.value = 'record';
  if (preserve) return;
  dom.eventColor.value = dom.eventTaskType.value === 'review' ? state.settings.reviewColor : category?.color || state.settings.defaultPlanColor;
  dom.eventOpacity.value = dom.eventTaskType.value === 'review' ? state.settings.reviewOpacity : category?.opacity ?? .86;
}

function saveEventFromModal() {
  const range = readModalTime();
  if (!range || range.endSlot <= range.startSlot) { window.alert('请选择有效的起止时间。'); return; }
  if (!isRangeVisible(range.startSlot, range.endSlot)) { window.alert('事件不能跨越隐藏时段。'); return; }
  const category = state.categories.find((item) => item.id === dom.eventCategory.value);
  const next = {
    id: state.editingEventId || uid('event'), date: currentDateKey(), halfZone: dom.eventHalfZone.value,
    taskType: dom.eventTaskType.value, categoryId: category?.id || null, categoryName: category?.name || '',
    startSlot: range.startSlot, endSlot: range.endSlot, color: dom.eventColor.value,
    opacity: Number(dom.eventOpacity.value), textContent: dom.eventTextContent.value.trim(),
    textSize: clamp(Number(dom.eventTextSize.value) || 13, 10, 24), textColor: dom.eventTextColor.value,
    textOpacity: clamp(Number(dom.eventTextOpacity.value) || .92, .1, 1), conflict: false
  };
  const conflict = state.events.some((item) => item.id !== next.id && item.date === next.date && item.halfZone === next.halfZone && item.startSlot < next.endSlot && next.startSlot < item.endSlot);
  if (conflict && !window.confirm('该时段与已有事件重叠，仍要保存吗？')) return;
  pushHistory();
  if (state.editingEventId) {
    const index = state.events.findIndex((item) => item.id === state.editingEventId);
    if (index >= 0) state.events[index] = next;
    state.reviews = state.reviews.filter((item) => item.sourceEventId !== next.id);
  } else state.events.push(next);
  maybeGenerateReviews(next);
  validateConflicts(); saveBackup(); closeModal('eventModal'); state.editingEventId = null; renderAll();
}

function maybeGenerateReviews(event) {
  if (event.halfZone !== 'record' || event.taskType !== 'learn') return;
  REVIEW_OFFSETS.forEach((offset, index) => state.reviews.push({ id: uid('review'), sourceEventId: event.id, reviewDate: formatDateKey(addDays(state.currentDate, offset)), reviewNumber: index + 1, textContent: event.textContent || `${event.categoryName || '学习任务'}复习`, completed: false }));
}

function validateConflicts() {
  state.events.forEach((event) => { event.conflict = false; });
  state.events.forEach((event, index) => state.events.slice(index + 1).forEach((other) => {
    if (event.date === other.date && event.halfZone === other.halfZone && event.startSlot < other.endSlot && other.startSlot < event.endSlot) { event.conflict = true; other.conflict = true; }
  }));
}

function deleteEvent(id) {
  const event = state.events.find((item) => item.id === id);
  if (!event || !window.confirm('确认删除这个事件？')) return;
  pushHistory(); state.events = state.events.filter((item) => item.id !== id); state.reviews = state.reviews.filter((item) => item.sourceEventId !== id); validateConflicts(); saveBackup(); renderAll();
}

function clearEvents() {
  if (!state.events.length || !window.confirm('确认清空全部事件与复习条目？')) return;
  pushHistory(); state.events = []; state.reviews = []; saveBackup(); renderAll();
}

function renderReviews() {
  const list = getFilteredReviews();
  dom.reviewBadge.textContent = state.reviews.filter((item) => item.reviewDate === currentDateKey() && !item.completed).length;
  if (!list.length) { dom.reviewList.innerHTML = '<div class="review-empty">当前没有待复习任务</div>'; return; }
  dom.reviewList.innerHTML = list.map((item) => `<div class="review-item ${item.completed ? 'done' : ''}"><div><div class="review-date">${item.reviewDate} · 第 ${item.reviewNumber} 次</div><div class="review-desc">${escapeHtml(item.textContent)}</div></div><div class="review-actions"><button class="tool-btn ${item.completed ? '' : 'primary'}" data-review-id="${item.id}">${item.completed ? '已完成' : '完成'}</button></div></div>`).join('');
  dom.reviewList.querySelectorAll('[data-review-id]').forEach((button) => button.addEventListener('click', () => {
    const item = state.reviews.find((review) => review.id === button.dataset.reviewId); if (!item) return; pushHistory(); item.completed = !item.completed; saveBackup(); renderReviews();
  }));
}

function getFilteredReviews() {
  const today = state.currentDate; const todayKey = currentDateKey();
  return state.reviews.filter((item) => {
    if (state.reviewFilter === 'all') return true;
    if (item.completed) return false;
    if (state.reviewFilter === 'today') return item.reviewDate === todayKey;
    const date = parseDateKey(item.reviewDate);
    if (state.reviewFilter === 'week') { const monday = addDays(today, -((today.getDay() + 6) % 7)); return date >= monday && date < addDays(monday, 7); }
    return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
  }).sort((a, b) => a.reviewDate.localeCompare(b.reviewDate) || a.reviewNumber - b.reviewNumber);
}

function setReviewFilter(filter) { state.reviewFilter = filter; document.querySelectorAll('.filter-btn').forEach((button) => button.classList.toggle('active', button.dataset.filter === filter)); renderReviews(); }

function renderFocusSubjects() {
  dom.focusSubjects.innerHTML = state.categories.map((item) => `<button class="subject-btn" style="--subject-color:${item.color}" data-subject-id="${item.id}" ${state.focus ? 'disabled' : ''}>${escapeHtml(item.name)}</button>`).join('');
  dom.focusSubjects.querySelectorAll('[data-subject-id]').forEach((button) => button.addEventListener('click', () => startFocus(button.dataset.subjectId)));
}

function startFocus(categoryId) {
  if (state.focus) return;
  const category = state.categories.find((item) => item.id === categoryId); if (!category) return;
  const type = dom.focusTimerType.value;
  state.focus = { categoryId, categoryName: category.name, color: category.color, type, durationSeconds: type === 'countdown' ? Number(dom.focusDuration.value) * 60 : 0, startedAt: Date.now() };
  state.focusTicker = window.setInterval(tickFocus, 250); renderFocusSubjects(); renderFocus();
}

function tickFocus() {
  if (!state.focus) return;
  if (state.focus.type === 'countdown' && Date.now() - state.focus.startedAt >= state.focus.durationSeconds * 1000) { finishFocus(true); return; }
  renderFocus();
}

function renderFocus() {
  if (!state.focus) {
    dom.focusClock.textContent = '00:00:00'; dom.focusSubjectLabel.textContent = '选择一个学科即可开始'; dom.focusStatus.textContent = '未开始';
    dom.focusStatus.classList.remove('running'); dom.stopFocusBtn.classList.add('hidden'); return;
  }
  const elapsed = Math.max(0, Math.floor((Date.now() - state.focus.startedAt) / 1000));
  const shown = state.focus.type === 'countdown' ? Math.max(0, state.focus.durationSeconds - elapsed) : elapsed;
  dom.focusClock.textContent = formatDuration(shown); dom.focusSubjectLabel.textContent = `${state.focus.categoryName} · ${state.focus.type === 'countdown' ? '倒计时' : '正计时'}`;
  dom.focusStatus.textContent = '专注中'; dom.focusStatus.classList.add('running'); dom.stopFocusBtn.classList.remove('hidden');
}

function formatDuration(seconds) { const safe = Math.max(0, Math.floor(seconds)); return `${pad(Math.floor(safe / 3600))}:${pad(Math.floor(safe % 3600 / 60))}:${pad(safe % 60)}`; }

function finishFocus(automatic) {
  if (!state.focus) return;
  window.clearInterval(state.focusTicker); state.focusTicker = null;
  state.pendingFocus = { ...state.focus, endedAt: Date.now() }; state.focus = null; renderFocusSubjects(); renderFocus();
  if (automatic) window.alert('倒计时结束，辛苦了！请补充本次学习详情。');
  const elapsed = Math.max(1, Math.floor((state.pendingFocus.endedAt - state.pendingFocus.startedAt) / 1000));
  dom.focusSummary.textContent = `${state.pendingFocus.categoryName} · ${formatDuration(elapsed)}`; dom.focusDetailText.value = ''; openModal('focusDetailModal');
}

function saveFocusRecord() {
  const focus = state.pendingFocus; if (!focus) return;
  const start = new Date(focus.startedAt); const end = new Date(focus.endedAt);
  let startSlot = start.getHours() * 60 + start.getMinutes();
  let endSlot = end.getHours() * 60 + end.getMinutes() + (end.getSeconds() > 0 ? 1 : 0);
  if (formatDateKey(start) !== formatDateKey(end)) endSlot = 1439;
  endSlot = clamp(Math.max(startSlot + 1, endSlot), 1, 1439);
  const category = state.categories.find((item) => item.id === focus.categoryId);
  const record = { id: uid('event'), date: formatDateKey(start), halfZone: 'record', taskType: 'custom', categoryId: focus.categoryId, categoryName: focus.categoryName, startSlot, endSlot, color: focus.color, opacity: category?.opacity ?? .86, textContent: dom.focusDetailText.value.trim() || `${focus.categoryName}专注`, textSize: 13, textColor: '#20231f', textOpacity: .92, conflict: false };
  pushHistory(); state.events.push(record); state.currentDate = startOfDay(start); state.pendingFocus = null; validateConflicts(); saveBackup(); closeModal('focusDetailModal'); renderAll();
}

function discardFocusRecord() { state.pendingFocus = null; closeModal('focusDetailModal'); }

function openSettingsModal() { syncSettingsToUI(); refreshCategoryTable(); openModal('settingsModal'); }
function syncSettingsToUI() {
  dom.settingStartHour.value = state.settings.startHour; dom.settingHourHeight.value = state.settings.hourHeight;
  dom.settingPlanRatio.value = Math.round(state.settings.planRatio * 100); dom.settingMinuteInterval.value = state.settings.minuteInterval;
  dom.settingHiddenHours.value = state.settings.hiddenHours || ''; dom.settingReviewColor.value = state.settings.reviewColor; dom.settingReviewOpacity.value = state.settings.reviewOpacity;
}

function updateSettingsFromUI() {
  state.settings.startHour = clamp(Number(dom.settingStartHour.value), 0, 23); state.settings.hourHeight = clamp(Number(dom.settingHourHeight.value), 38, 100);
  state.settings.planRatio = clamp(Number(dom.settingPlanRatio.value), 30, 70) / 100; state.settings.minuteInterval = Number(dom.settingMinuteInterval.value) || 5;
  state.settings.hiddenHours = dom.settingHiddenHours.value; state.settings.reviewColor = dom.settingReviewColor.value; state.settings.reviewOpacity = Number(dom.settingReviewOpacity.value);
  saveBackup(); renderTimeline();
}

function refreshCategoryUI() { syncCategoryOptions(); refreshCategoryTable(); renderFocusSubjects(); }
function refreshCategoryTable() {
  dom.categoryTable.innerHTML = state.categories.map((item) => `<div class="category-row" data-category-id="${item.id}"><input class="cat-name" value="${escapeHtml(item.name)}" aria-label="学科名称"><input class="cat-color" type="color" value="${item.color}" aria-label="学科颜色"><input class="cat-opacity" type="range" min="0.2" max="1" step="0.05" value="${item.opacity}" aria-label="透明度"><button class="tool-btn cat-delete">删除</button></div>`).join('');
  dom.categoryTable.querySelectorAll('.category-row').forEach((row) => {
    row.querySelectorAll('input').forEach((input) => input.addEventListener('input', () => updateCategory(row)));
    row.querySelector('.cat-delete').addEventListener('click', () => deleteCategory(row.dataset.categoryId));
  });
}

function updateCategory(row) {
  const category = state.categories.find((item) => item.id === row.dataset.categoryId); if (!category) return;
  category.name = row.querySelector('.cat-name').value.trim() || '未命名'; category.color = row.querySelector('.cat-color').value; category.opacity = Number(row.querySelector('.cat-opacity').value);
  syncCategoryOptions(category.id); renderFocusSubjects(); saveBackup(); renderTimeline();
}

function addCategory() { pushHistory(); state.categories.push({ id: uid('category'), name: '新学科', color: '#6b7a72', opacity: .86 }); refreshCategoryUI(); saveBackup(); }
function deleteCategory(id) { const category = state.categories.find((item) => item.id === id); if (!category || state.categories.length <= 1) { window.alert('至少保留一个学科。'); return; } if (!window.confirm(`删除学科“${category.name}”？`)) return; pushHistory(); state.categories = state.categories.filter((item) => item.id !== id); refreshCategoryUI(); saveBackup(); }

function snapshot() { return { currentDate: state.currentDate.toISOString(), settings: clone(state.settings), categories: clone(state.categories), events: clone(state.events), reviews: clone(state.reviews) }; }
function restore(data) { state.currentDate = startOfDay(new Date(data.currentDate)); state.settings = { ...clone(defaultSettings), ...clone(data.settings) }; state.categories = clone(data.categories); state.events = clone(data.events); state.reviews = clone(data.reviews); validateConflicts(); syncSettingsToUI(); refreshCategoryUI(); saveBackup(); renderAll(); }
function pushHistory() { state.history.push(snapshot()); if (state.history.length > 50) state.history.shift(); state.future = []; }
function undo() { if (!state.history.length) return; state.future.push(snapshot()); restore(state.history.pop()); }
function redo() { if (!state.future.length) return; state.history.push(snapshot()); restore(state.future.pop()); }

function shiftDate(amount) { state.currentDate = addDays(state.currentDate, amount); state.selectedEventId = null; cancelSelection(); saveBackup(); renderAll(); }

function saveBackup() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: DATA_VERSION, currentDate: state.currentDate.toISOString(), settings: state.settings, categories: state.categories, events: state.events, reviews: state.reviews })); } catch (_) { /* Storage can be unavailable for local files. */ }
}

function loadBackup() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY); if (!raw) return;
    const data = JSON.parse(raw); state.settings = { ...clone(defaultSettings), ...(data.settings || {}) };
    state.categories = Array.isArray(data.categories) && data.categories.length ? data.categories : clone(defaultCategories);
    state.events = Array.isArray(data.events) ? data.events.map((item) => ({ ...item, date: normalizeDate(item.date) })) : [];
    state.reviews = Array.isArray(data.reviews) ? data.reviews.map((item) => ({ ...item, reviewDate: normalizeDate(item.reviewDate) })) : [];
    if (data.currentDate) state.currentDate = startOfDay(new Date(data.currentDate)); validateConflicts();
  } catch (_) { state.settings = clone(defaultSettings); state.categories = clone(defaultCategories); state.events = []; state.reviews = []; }
}

function normalizeDate(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : formatDateKey(date); }

function exportData() {
  const data = { version: DATA_VERSION, exportedAt: new Date().toISOString(), currentDate: state.currentDate.toISOString(), settings: state.settings, categories: state.categories, events: state.events, reviews: state.reviews };
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `学习日志_${formatStamp(new Date())}.json`);
}

function importData() {
  const file = dom.importInput.files?.[0]; if (!file) return;
  const reader = new FileReader(); reader.onload = () => {
    try { const data = JSON.parse(String(reader.result)); if (!window.confirm('导入会覆盖当前数据，是否继续？')) return; pushHistory(); restore({ currentDate: data.currentDate || new Date().toISOString(), settings: data.settings || defaultSettings, categories: data.categories?.length ? data.categories : defaultCategories, events: data.events || [], reviews: data.reviews || [] }); }
    catch (_) { window.alert('导入失败：文件格式无效。'); }
  }; reader.readAsText(file); dom.importInput.value = '';
}

function exportImage() {
  const width = 1400; const hourHeight = 58; const header = 86; const layout = createLayout(width, hourHeight, header);
  const output = document.createElement('canvas'); output.width = width; output.height = layout.height; const outputContext = output.getContext('2d');
  outputContext.fillStyle = '#fff'; outputContext.fillRect(0, 0, output.width, output.height);
  outputContext.fillStyle = '#20231f'; outputContext.font = '700 25px "Segoe UI", "Microsoft YaHei", sans-serif'; outputContext.textAlign = 'left'; outputContext.textBaseline = 'alphabetic';
  outputContext.fillText('学习日志时间轴', 30, 34); outputContext.fillStyle = '#74786f'; outputContext.font = '14px "Segoe UI", "Microsoft YaHei", sans-serif'; outputContext.fillText(formatDateLabel(state.currentDate), 30, 59);
  outputContext.textAlign = 'center'; outputContext.font = '700 13px "Segoe UI", "Microsoft YaHei", sans-serif'; outputContext.fillText('计划区', layout.planWidth / 2, 76); outputContext.fillText('记录区', layout.planWidth + (layout.width - layout.planWidth) / 2, 76);
  drawTimeline(outputContext, layout, { exportMode: true });
  const anchor = document.createElement('a');
  anchor.href = output.toDataURL('image/png');
  anchor.download = `学习时间轴_${currentDateKey()}.png`;
  anchor.click();
}

function downloadBlob(blob, fileName) { const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = fileName; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }

function onKeydown(event) {
  if (event.key === 'Escape') { cancelSelection(); hideContextMenu(); ['eventModal', 'settingsModal', 'focusDetailModal'].forEach(closeModal); }
  if (event.ctrlKey && event.key.toLowerCase() === 'z') { event.preventDefault(); undo(); }
  if (event.ctrlKey && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
}
