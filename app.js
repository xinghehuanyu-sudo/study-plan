const STORAGE_KEY = 'learning_tool_backup';
const DATA_VERSION = 1;
const REVIEW_OFFSETS = [1, 3, 6, 10, 14];
const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

const defaultCategories = [
  { id: crypto.randomUUID(), name: '数学', color: '#FF5733', opacity: 0.8 },
  { id: crypto.randomUUID(), name: '英语', color: '#33FF57', opacity: 0.8 },
  { id: crypto.randomUUID(), name: '专业课', color: '#3357FF', opacity: 0.8 }
];

const defaultSettings = {
  startHour: 0,
  hourHeight: 40,
  minuteInterval: 5,
  hiddenHours: '',
  dotSizes: { small: 2, medium: 4, large: 6 },
  dotOpacities: { small: 0.2, medium: 0.5, large: 0.8 },
  reviewColor: '#9C27B0',
  reviewOpacity: 0.8,
  planRatio: 0.5,
  defaultPlanColor: '#DA9B58',
  defaultRecordColor: '#5AA9E6',
  defaultEventOpacity: 0.8,
  defaultTextSize: 16,
  defaultTextColor: '#1F1F1F',
  defaultTextOpacity: 0.85
};

const state = {
  version: DATA_VERSION,
  currentDate: startOfDay(new Date()),
  settings: clone(defaultSettings),
  categories: clone(defaultCategories),
  events: [],
  reviews: [],
  history: [],
  historyIndex: -1,
  reviewFilter: 'today',
  activeModal: null,
  editingEventId: null,
  selectionMode: null,
  selectionAnchorSlot: null,
  selectionEndSlot: null,
  hoveredEventId: null,
  selectedEventId: null,
  blinkOn: true,
  rafId: 0
};

const dom = {
  currentDateLabel: document.getElementById('currentDateLabel'),
  reviewBadge: document.getElementById('reviewBadge'),
  timelineScroll: document.getElementById('timelineScroll'),
  timelineCanvas: document.getElementById('timelineCanvas'),
  reviewList: document.getElementById('reviewList'),
  contextMenu: document.getElementById('contextMenu'),
  hoverDeleteBtn: document.getElementById('hoverDeleteBtn'),
  importInput: document.getElementById('importInput'),
  eventModal: document.getElementById('eventModal'),
  settingsModal: document.getElementById('settingsModal'),
  eventModalTitle: document.getElementById('eventModalTitle'),
  eventHalfZone: document.getElementById('eventHalfZone'),
  eventTaskType: document.getElementById('eventTaskType'),
  eventCategory: document.getElementById('eventCategory'),
  eventColor: document.getElementById('eventColor'),
  eventOpacity: document.getElementById('eventOpacity'),
  eventTextContent: document.getElementById('eventTextContent'),
  eventTextSize: document.getElementById('eventTextSize'),
  eventTextColor: document.getElementById('eventTextColor'),
  eventTextOpacity: document.getElementById('eventTextOpacity'),
  eventStartHour: document.getElementById('eventStartHour'),
  eventStartMinute: document.getElementById('eventStartMinute'),
  eventEndHour: document.getElementById('eventEndHour'),
  eventEndMinute: document.getElementById('eventEndMinute'),
  timePickHint: document.getElementById('timePickHint'),
  eventTimeSummary: document.getElementById('eventTimeSummary'),
  saveEventBtn: document.getElementById('saveEventBtn'),
  settingStartHour: document.getElementById('settingStartHour'),
  settingHourHeight: document.getElementById('settingHourHeight'),
  settingPlanRatio: document.getElementById('settingPlanRatio'),
  settingMinuteInterval: document.getElementById('settingMinuteInterval'),
  settingHiddenHours: document.getElementById('settingHiddenHours'),
  settingReviewColor: document.getElementById('settingReviewColor'),
  settingReviewOpacity: document.getElementById('settingReviewOpacity'),
  categoryTable: document.getElementById('categoryTable'),
  addCategoryBtn: document.getElementById('addCategoryBtn')
};

const canvas = dom.timelineCanvas;
const ctx = canvas.getContext('2d');
let lastLayout = null;

loadBackup();
bindEvents();
syncSettingsToUI();
refreshCategoryUI();
renderAll();
requestAnimationFrame(loop);

function bindEvents() {
  document.getElementById('addEventBtn').addEventListener('click', () => openEventModal());
  document.getElementById('settingsBtn').addEventListener('click', openSettingsModal);
  document.getElementById('exportDataBtn').addEventListener('click', exportData);
  document.getElementById('importDataBtn').addEventListener('click', () => dom.importInput.click());
  document.getElementById('exportImageBtn').addEventListener('click', exportImage);
  document.getElementById('clearEventsBtn').addEventListener('click', clearEvents);
  document.getElementById('undoBtn').addEventListener('click', undo);
  document.getElementById('redoBtn').addEventListener('click', redo);
  document.getElementById('prevDayBtn').addEventListener('click', () => shiftDate(-1));
  document.getElementById('nextDayBtn').addEventListener('click', () => shiftDate(1));
  document.querySelectorAll('.filter-btn').forEach((button) => {
    button.addEventListener('click', () => setReviewFilter(button.dataset.filter));
  });
  document.querySelectorAll('[data-close]').forEach((button) => {
    button.addEventListener('click', () => closeModal(button.dataset.close));
  });
  dom.saveEventBtn.addEventListener('click', saveEventFromModal);
  dom.addCategoryBtn.addEventListener('click', addCategory);
  dom.importInput.addEventListener('change', handleImportFile);
  dom.settingStartHour.addEventListener('input', updateSettingsFromUI);
  dom.settingHourHeight.addEventListener('input', updateSettingsFromUI);
  dom.settingPlanRatio.addEventListener('input', updateSettingsFromUI);
  dom.settingMinuteInterval.addEventListener('change', updateSettingsFromUI);
  dom.settingHiddenHours.addEventListener('input', updateSettingsFromUI);
  dom.settingReviewColor.addEventListener('input', updateSettingsFromUI);
  dom.settingReviewOpacity.addEventListener('input', updateSettingsFromUI);
  dom.eventTaskType.addEventListener('change', syncEventInputsByType);
  dom.eventCategory.addEventListener('change', syncEventInputsByCategory);
  dom.eventStartHour.addEventListener('input', updateTimeSummary);
  dom.eventStartMinute.addEventListener('input', updateTimeSummary);
  dom.eventEndHour.addEventListener('input', updateTimeSummary);
  dom.eventEndMinute.addEventListener('input', updateTimeSummary);
  canvas.addEventListener('click', onCanvasClick);
  canvas.addEventListener('dblclick', onCanvasDblClick);
  canvas.addEventListener('mousemove', onCanvasMove);
  canvas.addEventListener('mouseleave', clearHoverState);
  canvas.addEventListener('contextmenu', onCanvasContextMenu);
  window.addEventListener('keydown', onKeydown);
  window.addEventListener('resize', scheduleRender);
  document.addEventListener('click', (event) => {
    if (!dom.contextMenu.contains(event.target)) {
      hideContextMenu();
    }
    if (!dom.hoverDeleteBtn.contains(event.target)) {
      hideHoverDelete();
    }
  });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function startOfDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(date, amount) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function formatDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function normalizeDateKey(dateKey) {
  if (!dateKey) {
    return dateKey;
  }
  const parsed = new Date(dateKey);
  if (Number.isNaN(parsed.getTime())) {
    return dateKey;
  }
  return formatDateKey(parsed);
}

function formatDateLabel(date) {
  return `${date.getFullYear()}年${pad(date.getMonth() + 1)}月${pad(date.getDate())}日 星期${WEEKDAY_NAMES[date.getDay()]}`;
}

function formatShortDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatExportStamp(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function currentDateKey() {
  return formatDateKey(state.currentDate);
}

function generateId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function parseHiddenHours(text) {
  const ranges = [];
  String(text || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((rangeText) => {
      const [startText, endText] = rangeText.split('-').map((item) => item.trim());
      const start = Number(startText);
      const end = Number(endText);
      if (Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end <= 24 && start < end) {
        ranges.push([start, end]);
      }
    });
  return ranges;
}

function isHourHidden(hour, hiddenRanges = parseHiddenHours(state.settings.hiddenHours)) {
  return hiddenRanges.some(([start, end]) => hour >= start && hour < end);
}

function visibleHours() {
  const hiddenRanges = parseHiddenHours(state.settings.hiddenHours);
  const hours = [];
  for (let offset = 0; offset < 24; offset += 1) {
    const hour = (state.settings.startHour + offset) % 24;
    if (!isHourHidden(hour, hiddenRanges)) {
      hours.push(hour);
    }
  }
  return hours;
}

function minuteToSlot(hour, minute) {
  return hour * 60 + minute;
}

function slotToMinute(slot) {
  const value = clamp(Math.round(slot), 0, 1439);
  return { hour: Math.floor(value / 60), minute: value % 60 };
}

function slotToLabel(slot) {
  const { hour, minute } = slotToMinute(slot);
  return `${pad(hour)}:${pad(minute)}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function snapSlot(slot) {
  const interval = state.settings.minuteInterval;
  const rounded = clamp(Math.round(slot), 0, 1439);
  const remainder = rounded % interval;
  const lower = rounded - remainder;
  const upper = Math.min(1439, lower + interval);
  return clamp(remainder < interval / 2 ? lower : upper, 0, 1439);
}

function slotToY(slot) {
  const { hour, minute } = slotToMinute(slot);
  const hours = visibleHours();
  const index = hours.indexOf(hour);
  if (index < 0) {
    return null;
  }
  return index * state.settings.hourHeight + (minute / 60) * state.settings.hourHeight;
}

function yToSlot(y) {
  const hours = visibleHours();
  if (!hours.length) {
    return null;
  }
  const index = clamp(Math.floor(y / state.settings.hourHeight), 0, hours.length - 1);
  const localY = y - index * state.settings.hourHeight;
  const minute = clamp(Math.round((localY / state.settings.hourHeight) * 60), 0, 59);
  return snapSlot(minuteToSlot(hours[index], minute));
}

function isSlotVisible(slot) {
  const { hour } = slotToMinute(slot);
  return !isHourHidden(hour);
}

function isSlotInteractive(slot) {
  const { hour, minute } = slotToMinute(slot);
  return minute % 5 === 0 && minute % state.settings.minuteInterval === 0 && !isHourHidden(hour);
}

function getTimelineLayout() {
  const hours = visibleHours();
  const width = dom.timelineScroll.clientWidth || 800;
  const height = Math.max(1, hours.length * state.settings.hourHeight);
  const ratio = clamp(Number(state.settings.planRatio) || 0.5, 0.2, 0.8);
  const planWidth = clamp(Math.round(width * ratio), 140, Math.max(140, width - 140));
  canvas.width = Math.floor(width * devicePixelRatio);
  canvas.height = Math.floor(height * devicePixelRatio);
  canvas.style.height = `${height}px`;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  lastLayout = { hours, width, height, planWidth };
  return lastLayout;
}

function getEventStyle(event) {
  if (event.taskType === 'review') {
    return { color: state.settings.reviewColor, opacity: state.settings.reviewOpacity };
  }
  const category = state.categories.find((item) => item.id === event.categoryId);
  if (category) {
    return { color: event.color || category.color, opacity: event.opacity ?? category.opacity };
  }
  return {
    color: event.color || (event.halfZone === 'record' ? state.settings.defaultRecordColor : state.settings.defaultPlanColor),
    opacity: event.opacity ?? state.settings.defaultEventOpacity
  };
}

function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  const full = normalized.length === 3 ? normalized.split('').map((char) => char + char).join('') : normalized;
  const value = Number.parseInt(full, 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function eventBox(event, layout = getTimelineLayout()) {
  const top = slotToY(event.startSlot);
  const bottom = slotToY(event.endSlot);
  if (top == null || bottom == null) {
    return null;
  }
  
  // 计算事件基本信息
  const startMinuteInfo = slotToMinute(event.startSlot);
  const endMinuteInfo = slotToMinute(event.endSlot);
  const startHour = startMinuteInfo.hour;
  const startMinute = startMinuteInfo.minute;
  const endHour = endMinuteInfo.hour;
  const endMinute = endMinuteInfo.minute;
  
  // 计算跨越的小时数
  const hourSpan = endHour - startHour + 1;
  
  // 计算整体边界框（用于交互检测）
  const zoneWidth = event.halfZone === 'plan' ? layout.planWidth : layout.width - layout.planWidth;
  const padding = 16;
  const x = event.halfZone === 'plan' ? padding : layout.planWidth + padding;
  const y = top;
  const width = zoneWidth - padding * 2;
  const height = Math.max(12, bottom - top);
  
  // 计算分钟宽度
  const minuteWidth = width / 60;
  
  return {
    // 整体边界框（用于交互检测）
    x: x,
    y: y,
    width: width,
    height: height,
    
    // 事件时间信息
    startHour: startHour,
    startMinute: startMinute,
    endHour: endHour,
    endMinute: endMinute,
    hourSpan: hourSpan,
    
    // 布局参数
    minuteWidth: minuteWidth,
    halfWidth: zoneWidth,
    padding: padding
  };
}
    endMinute: endMinute

function currentEvents() {
  return state.events.filter((event) => event.date === currentDateKey());
}

function loadBackup() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return;
    }
    const data = JSON.parse(stored);
    state.settings = { ...clone(defaultSettings), ...(data.settings || {}) };
    state.categories = Array.isArray(data.categories) && data.categories.length ? data.categories : clone(defaultCategories);
    state.events = Array.isArray(data.events) ? data.events.map((event) => ({ ...event, date: normalizeDateKey(event.date) })) : [];
    state.reviews = Array.isArray(data.reviews) ? data.reviews.map((review) => ({ ...review, reviewDate: normalizeDateKey(review.reviewDate) })) : [];
    if (data.currentDate) {
      state.currentDate = startOfDay(new Date(data.currentDate));
    }
    validateConflicts();
  } catch (error) {
    state.settings = clone(defaultSettings);
    state.categories = clone(defaultCategories);
    state.events = [];
    state.reviews = [];
  }
}

function saveBackup() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: DATA_VERSION,
      currentDate: state.currentDate.toISOString(),
      settings: state.settings,
      categories: state.categories,
      events: state.events,
      reviews: state.reviews
    }));
  } catch (error) {
    // ignore cache failures
  }
}

function pushHistory() {
  const snapshot = {
    currentDate: state.currentDate.toISOString(),
    settings: clone(state.settings),
    categories: clone(state.categories),
    events: clone(state.events),
    reviews: clone(state.reviews)
  };
  state.history = state.history.slice(0, state.historyIndex + 1);
  state.history.push(snapshot);
  if (state.history.length > 50) {
    state.history.shift();
  }
  state.historyIndex = state.history.length - 1;
}

function restoreSnapshot(snapshot) {
  state.currentDate = startOfDay(new Date(snapshot.currentDate));
  state.settings = clone(snapshot.settings);
  state.categories = clone(snapshot.categories);
  state.events = clone(snapshot.events);
  state.reviews = clone(snapshot.reviews);
  state.selectionMode = null;
  state.selectionAnchorSlot = null;
  state.selectionEndSlot = null;
  state.selectedEventId = null;
  state.hoveredEventId = null;
  syncSettingsToUI();
  refreshCategoryUI();
  validateConflicts();
  saveBackup();
  renderAll();
}

function undo() {
  if (state.historyIndex < 0) {
    return;
  }
  const snapshot = state.history[state.historyIndex];
  state.historyIndex -= 1;
  restoreSnapshot(snapshot);
}

function redo() {
  if (state.historyIndex + 1 >= state.history.length) {
    return;
  }
  state.historyIndex += 1;
  restoreSnapshot(state.history[state.historyIndex]);
}

function formatEventDescription(event) {
  const text = event.textContent ? event.textContent : (event.categoryName || '事件');
  return `${slotToLabel(event.startSlot)} - ${slotToLabel(event.endSlot)} ${text}`;
}

function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
  document.getElementById(id).setAttribute('aria-hidden', 'false');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
  document.getElementById(id).setAttribute('aria-hidden', 'true');
  state.activeModal = null;
  state.selectionMode = null;
  hideContextMenu();
  hideHoverDelete();
  renderAll();
}

function openEventModal(event = null) {
  state.activeModal = 'event';
  state.editingEventId = event?.id || null;
  state.selectionMode = null;
  state.selectionAnchorSlot = event?.startSlot ?? null;
  state.selectionEndSlot = event?.endSlot ?? null;
  dom.eventModalTitle.textContent = event ? '编辑事件' : '添加事件';
  dom.eventHalfZone.value = event?.halfZone || 'plan';
  dom.eventTaskType.value = event?.taskType || 'learn';
  dom.eventTextContent.value = event?.textContent || '';
  dom.eventTextSize.value = String(event?.textSize || state.settings.defaultTextSize);
  dom.eventTextColor.value = event?.textColor || state.settings.defaultTextColor;
  dom.eventTextOpacity.value = String(event?.textOpacity ?? state.settings.defaultTextOpacity);
  const categoryId = event?.categoryId || state.categories[0]?.id || '';
  dom.eventCategory.value = categoryId;
  dom.eventColor.value = event?.color || state.categories[0]?.color || state.settings.defaultRecordColor;
  dom.eventOpacity.value = String(event?.opacity ?? state.settings.defaultEventOpacity);
  syncEventTimeInputs(event);
  updateTimeSummary();
  openModal('eventModal');
  syncEventCategoryOptions();
  syncEventInputsByCategory();
  syncEventInputsByType();
}

function openSettingsModal() {
  state.activeModal = 'settings';
  syncSettingsToUI();
  refreshCategoryTable();
  openModal('settingsModal');
}

function syncEventCategoryOptions() {
  dom.eventCategory.innerHTML = state.categories.map((category) => `<option value="${category.id}">${escapeHtml(category.name)}</option>`).join('');
  dom.eventCategory.value = dom.eventCategory.value || state.categories[0]?.id || '';
}

function refreshCategoryUI() {
  syncEventCategoryOptions();
  refreshCategoryTable();
}

function refreshCategoryTable() {
  dom.categoryTable.innerHTML = state.categories.map((category) => `
    <div class="category-row" data-category-id="${category.id}">
      <input type="text" class="cat-name" value="${escapeAttr(category.name)}" />
      <input type="color" class="cat-color" value="${category.color}" />
      <input type="range" class="cat-opacity" min="0.1" max="1" step="0.05" value="${category.opacity}" />
      <button class="tool-btn danger cat-delete">删除</button>
    </div>
  `).join('');
  dom.categoryTable.querySelectorAll('.category-row').forEach((row) => {
    row.querySelector('.cat-name').addEventListener('input', onCategoryEdit);
    row.querySelector('.cat-color').addEventListener('input', onCategoryEdit);
    row.querySelector('.cat-opacity').addEventListener('input', onCategoryEdit);
    row.querySelector('.cat-delete').addEventListener('click', () => deleteCategory(row.dataset.categoryId));
  });
}

function onCategoryEdit(event) {
  const row = event.target.closest('.category-row');
  const category = state.categories.find((item) => item.id === row.dataset.categoryId);
  if (!category) {
    return;
  }
  category.name = row.querySelector('.cat-name').value.trim() || '未命名';
  category.color = row.querySelector('.cat-color').value;
  category.opacity = Number(row.querySelector('.cat-opacity').value);
  syncEventCategoryOptions();
  saveBackup();
  scheduleRender();
}

function addCategory() {
  pushHistory();
  state.categories.push({ id: generateId('category'), name: '新类别', color: '#888888', opacity: 0.8 });
  refreshCategoryTable();
  syncEventCategoryOptions();
  saveBackup();
}

function deleteCategory(categoryId) {
  const category = state.categories.find((item) => item.id === categoryId);
  if (!category) {
    return;
  }
  if (!window.confirm(`确认删除类别「${category.name}」？已有事件不受影响。`)) {
    return;
  }
  pushHistory();
  state.categories = state.categories.filter((item) => item.id !== categoryId);
  refreshCategoryTable();
  syncEventCategoryOptions();
  saveBackup();
}

function syncSettingsToUI() {
  dom.settingStartHour.value = String(state.settings.startHour);
  dom.settingHourHeight.value = String(state.settings.hourHeight);
  dom.settingPlanRatio.value = String(Math.round((state.settings.planRatio ?? 0.5) * 100));
  dom.settingMinuteInterval.value = String(state.settings.minuteInterval);
  dom.settingHiddenHours.value = state.settings.hiddenHours || '';
  dom.settingReviewColor.value = state.settings.reviewColor;
  dom.settingReviewOpacity.value = String(state.settings.reviewOpacity);
}

function updateSettingsFromUI() {
  const nextInterval = Number(dom.settingMinuteInterval.value);
  if (nextInterval !== state.settings.minuteInterval) {
    window.alert('时间点间隔已修改，系统将重新计算时间槽并检查冲突。');
  }
  state.settings.startHour = clamp(Number(dom.settingStartHour.value), 0, 23);
  state.settings.hourHeight = clamp(Number(dom.settingHourHeight.value), 20, 200);
  state.settings.planRatio = clamp(Number(dom.settingPlanRatio.value), 20, 80) / 100;
  state.settings.minuteInterval = nextInterval;
  state.settings.hiddenHours = dom.settingHiddenHours.value;
  state.settings.reviewColor = dom.settingReviewColor.value;
  state.settings.reviewOpacity = Number(dom.settingReviewOpacity.value);
  validateConflicts();
  saveBackup();
  scheduleRender();
}

function validateConflicts() {
  state.events.forEach((event) => {
    event.conflict = false;
  });
  const groups = new Map();
  state.events.forEach((event) => {
    const key = `${event.date}_${event.halfZone}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(event);
  });
  groups.forEach((events) => {
    events.sort((a, b) => a.startSlot - b.startSlot);
    for (let i = 0; i < events.length; i += 1) {
      for (let j = i + 1; j < events.length; j += 1) {
        if (events[i].startSlot < events[j].endSlot && events[j].startSlot < events[i].endSlot) {
          events[i].conflict = true;
          events[j].conflict = true;
        }
      }
    }
  });
}

function syncEventTimeInputs(event = null) {
  const startSlot = Number.isFinite(event?.startSlot) ? event.startSlot : minuteToSlot(8, 0);
  const endSlot = Number.isFinite(event?.endSlot) ? event.endSlot : minuteToSlot(9, 0);
  const start = slotToMinute(startSlot);
  const end = slotToMinute(endSlot);
  dom.eventStartHour.value = String(start.hour);
  dom.eventStartMinute.value = String(start.minute);
  dom.eventEndHour.value = String(end.hour);
  dom.eventEndMinute.value = String(end.minute);
}

function readEventTimeInputs() {
  const values = [dom.eventStartHour.value, dom.eventStartMinute.value, dom.eventEndHour.value, dom.eventEndMinute.value];
  if (values.some((value) => String(value).trim() === '')) {
    return null;
  }
  const startHour = clamp(Number(dom.eventStartHour.value), 0, 23);
  const startMinute = clamp(Number(dom.eventStartMinute.value), 0, 59);
  const endHour = clamp(Number(dom.eventEndHour.value), 0, 23);
  const endMinute = clamp(Number(dom.eventEndMinute.value), 0, 59);
  return {
    startSlot: minuteToSlot(startHour, startMinute),
    endSlot: minuteToSlot(endHour, endMinute)
  };
}

function updateTimeSummary() {
  const timeRange = readEventTimeInputs();
  if (!timeRange) {
    dom.eventTimeSummary.textContent = '尚未选择时间';
    return;
  }
  const { startSlot, endSlot } = timeRange;
  if (Number.isFinite(startSlot) && Number.isFinite(endSlot)) {
    dom.eventTimeSummary.textContent = `${slotToLabel(startSlot)} - ${slotToLabel(endSlot)}`;
    return;
  }
  dom.eventTimeSummary.textContent = '尚未选择时间';
}

function buildEventFromModal() {
  const timeRange = readEventTimeInputs();
  if (!timeRange) {
    window.alert('请输入有效的起止时间。');
    return null;
  }
  const { startSlot, endSlot } = timeRange;
  if (!Number.isFinite(startSlot) || !Number.isFinite(endSlot) || endSlot <= startSlot) {
    window.alert('请输入有效的起止时间。');
    return null;
  }
  if (!isValidEventTimeRange(startSlot, endSlot)) {
    window.alert('事件时间不能落在隐藏时段内，也不能跨越隐藏时段。');
    return null;
  }
  const category = state.categories.find((item) => item.id === dom.eventCategory.value);
  const taskType = dom.eventTaskType.value;
  const event = {
    id: state.editingEventId || generateId('event'),
    date: currentDateKey(),
    halfZone: dom.eventHalfZone.value,
    taskType,
    categoryId: category?.id || null,
    categoryName: category?.name || '',
    startSlot,
    endSlot,
    color: taskType === 'review' ? state.settings.reviewColor : (dom.eventColor.value || category?.color || '#888888'),
    opacity: taskType === 'review' ? state.settings.reviewOpacity : Number(dom.eventOpacity.value),
    hasText: Boolean(dom.eventTextContent.value.trim()),
    textContent: dom.eventTextContent.value.trim(),
    textSize: clamp(Number(dom.eventTextSize.value), 10, 32),
    textColor: dom.eventTextColor.value,
    textOpacity: clamp(Number(dom.eventTextOpacity.value), 0.1, 1),
    conflict: false
  };
  const hasConflict = state.events.some((item) => item.id !== event.id && item.date === event.date && item.halfZone === event.halfZone && item.startSlot < event.endSlot && event.startSlot < item.endSlot);
  if (hasConflict) {
    window.alert('同一日期同一半区内存在时间冲突，无法保存。');
    return null;
  }
  return event;
}

function isValidEventTimeRange(startSlot, endSlot) {
  for (let slot = startSlot; slot < endSlot; slot += 1) {
    if (!isSlotVisible(slot)) {
      return false;
    }
  }
  return true;
}

function saveEventFromModal() {
  const event = buildEventFromModal();
  if (!event) {
    return;
  }
  pushHistory();
  if (state.editingEventId) {
    const index = state.events.findIndex((item) => item.id === state.editingEventId);
    if (index >= 0) {
      state.events[index] = { ...state.events[index], ...event };
    }
    state.reviews = state.reviews.filter((item) => item.sourceEventId !== state.editingEventId);
    maybeGenerateReviews(event);
  } else {
    state.events.push(event);
    maybeGenerateReviews(event);
  }
  validateConflicts();
  saveBackup();
  closeModal('eventModal');
}

function maybeGenerateReviews(event) {
  if (event.halfZone !== 'record' || event.taskType !== 'learn') {
    return;
  }
  REVIEW_OFFSETS.forEach((offset, index) => {
    state.reviews.push({
      id: generateId('review'),
      sourceEventId: event.id,
      reviewDate: formatDateKey(addDays(state.currentDate, offset)),
      reviewNumber: index + 1,
      textContent: event.textContent || `${event.categoryName || '学习任务'} 第${index + 1}次复习`,
      completed: false
    });
  });
}

function onCanvasClick(event) {
  if (state.activeModal === 'event') {
    return;
  }
  const hit = hitTestEvent(event.clientX, event.clientY);
  if (hit) {
    state.selectedEventId = hit.id;
    scheduleRender();
  }
}

function onCanvasDblClick(event) {
  if (state.activeModal === 'event') {
    return;
  }
  const hit = hitTestEvent(event.clientX, event.clientY);
  if (hit) {
    state.selectedEventId = hit.id;
    openEventModal(hit);
    scheduleRender();
  }
}

function onCanvasMove(event) {
  if (state.activeModal === 'event') {
    return;
  }
  const hit = hitTestEvent(event.clientX, event.clientY);
  state.hoveredEventId = hit?.id || null;
  if (hit) {
    showHoverDelete(hit, event.clientX, event.clientY);
  } else {
    hideHoverDelete();
  }
  scheduleRender();
}

function clearHoverState() {
  state.hoveredEventId = null;
  hideHoverDelete();
  scheduleRender();
}

function onCanvasContextMenu(event) {
  if (state.activeModal === 'event') {
    return;
  }
  const hit = hitTestEvent(event.clientX, event.clientY);
  if (!hit) {
    return;
  }
  event.preventDefault();
  showContextMenu(event.clientX, event.clientY, hit);
}

function getSlotFromPointer(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  if (x < 0 || x > rect.width) {
    return null;
  }
  const y = clientY - rect.top;
  return yToSlot(y);
}

function hitTestEvent(clientX, clientY) {
  const layout = lastLayout || getTimelineLayout();
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const hourHeight = state.settings.hourHeight;
  const margin = Math.max(4, Math.round(hourHeight * 0.2));
  
  return [...currentEvents()].reverse().find((event) => {
    const box = eventBox(event, layout);
    if (!box) return false;
    
    const minuteWidth = box.minuteWidth;
    const visibleHours = layout.hours;
    
    const startHourIndex = visibleHours.indexOf(box.startHour);
    // 结束时间为整点时，箭头检测范围落在上一行
    const endAtBoundary = box.endMinute === 0;
    const loopEndHour = endAtBoundary ? (box.endHour === 0 ? 23 : box.endHour - 1) : box.endHour;
    const drawEndMinute = endAtBoundary ? 60 : box.endMinute;
    const endHourIndex = visibleHours.indexOf(loopEndHour);
    
    if (startHourIndex === -1 || endHourIndex === -1) {
      return false;
    }
    
    const boxX = event.halfZone === 'plan' ? 16 : layout.planWidth + 16;
    
    // 逐小时行检测：判定范围 = 箭头所在的时间区域（整行高 × 箭头X范围）
    for (let hour = box.startHour; hour <= loopEndHour; hour++) {
      const hourIndex = visibleHours.indexOf(hour);
      if (hourIndex === -1) continue;
      
      // Y 范围：整行高度，随行高变化
      const rowTop = hourIndex * hourHeight;
      const rowBottom = rowTop + hourHeight;
      
      if (y < rowTop || y >= rowBottom) continue;
      
      // X 范围：该小时内箭头的实际绘制区域
      const hourStartMinute = (hour === box.startHour) ? box.startMinute : 0;
      const hourEndMinute = (hour === loopEndHour) ? drawEndMinute : 59;
      
      const hourStartX = boxX + hourStartMinute * minuteWidth;
      const hourEndX = boxX + hourEndMinute * minuteWidth;
      
      const minArrowLength = 20;
      const actualLength = hourEndX - hourStartX;
      let hitMinX, hitMaxX;
      
      if (actualLength < minArrowLength) {
        const centerX = (hourStartX + hourEndX) / 2;
        hitMinX = centerX - minArrowLength / 2 - margin;
        hitMaxX = centerX + minArrowLength / 2 + margin;
      } else {
        hitMinX = hourStartX - margin;
        hitMaxX = hourEndX + margin;
      }
      
      if (x >= hitMinX && x <= hitMaxX) {
        return true;
      }
    }
    
    return false;
  }) || null;
}

function showHoverDelete(event, clientX, clientY) {
  const box = eventBox(event);
  if (!box) {
    hideHoverDelete();
    return;
  }
  dom.hoverDeleteBtn.classList.remove('hidden');
  dom.hoverDeleteBtn.style.left = `${clientX + 6}px`;
  dom.hoverDeleteBtn.style.top = `${clientY - 10}px`;
  dom.hoverDeleteBtn.onclick = () => deleteEvent(event.id);
}

function hideHoverDelete() {
  dom.hoverDeleteBtn.classList.add('hidden');
  dom.hoverDeleteBtn.onclick = null;
}

function showContextMenu(clientX, clientY, event) {
  dom.contextMenu.innerHTML = `
    <button data-action="edit-start">修改起始时间</button>
    <button data-action="edit-end">修改结束时间</button>
    <button data-action="delete">删除</button>
  `;
  dom.contextMenu.style.left = `${clientX}px`;
  dom.contextMenu.style.top = `${clientY}px`;
  dom.contextMenu.classList.remove('hidden');
  dom.contextMenu.querySelector('[data-action="edit-start"]').onclick = () => {
    openEventModal(event);
    focusEventTimeInput('start');
    hideContextMenu();
  };
  dom.contextMenu.querySelector('[data-action="edit-end"]').onclick = () => {
    openEventModal(event);
    focusEventTimeInput('end');
    hideContextMenu();
  };
  dom.contextMenu.querySelector('[data-action="delete"]').onclick = () => {
    deleteEvent(event.id);
    hideContextMenu();
  };
}

function hideContextMenu() {
  dom.contextMenu.classList.add('hidden');
  dom.contextMenu.innerHTML = '';
}

function focusEventTimeInput(which) {
  const target = which === 'end' ? dom.eventEndHour : dom.eventStartHour;
  target.focus();
  if (typeof target.select === 'function') {
    target.select();
  }
}

function deleteEvent(eventId) {
  const target = state.events.find((item) => item.id === eventId);
  if (!target) {
    return;
  }
  if (!window.confirm('确认删除该事件？')) {
    return;
  }
  pushHistory();
  state.events = state.events.filter((item) => item.id !== eventId);
  state.reviews = state.reviews.filter((item) => item.sourceEventId !== eventId);
  saveBackup();
  renderAll();
}

function clearEvents() {
  if (!window.confirm('确认清空所有事件与复习条目？')) {
    return;
  }
  pushHistory();
  state.events = [];
  state.reviews = [];
  saveBackup();
  renderAll();
}

function deleteCategory(categoryId) {
  const category = state.categories.find((item) => item.id === categoryId);
  if (!category) {
    return;
  }
  if (!window.confirm(`确认删除类别「${category.name}」？已有事件不受影响。`)) {
    return;
  }
  pushHistory();
  state.categories = state.categories.filter((item) => item.id !== categoryId);
  refreshCategoryTable();
  syncEventCategoryOptions();
  saveBackup();
}

function addCategory() {
  pushHistory();
  state.categories.push({ id: generateId('category'), name: '新类别', color: '#888888', opacity: 0.8 });
  refreshCategoryTable();
  syncEventCategoryOptions();
  saveBackup();
}

function shiftDate(amount) {
  state.currentDate = addDays(state.currentDate, amount);
  renderAll();
}

function setReviewFilter(filter) {
  state.reviewFilter = filter;
  document.querySelectorAll('.filter-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.filter === filter);
  });
  renderAll();
}

function getReviewFilterRange() {
  if (state.reviewFilter === 'all') {
    return null;
  }
  const start = startOfDay(state.currentDate);
  if (state.reviewFilter === 'today') {
    return { start, end: addDays(start, 1) };
  }
  if (state.reviewFilter === 'week') {
    const diff = (start.getDay() + 6) % 7;
    const weekStart = addDays(start, -diff);
    return { start: weekStart, end: addDays(weekStart, 7) };
  }
  const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
  return { start: monthStart, end: new Date(start.getFullYear(), start.getMonth() + 1, 1) };
}

function getFilteredReviews() {
  // filter reviews according to current filter mode
  return state.reviews
    .filter((review) => state.reviewFilter === 'all' || !review.completed)
    .filter((review) => {
      if (state.reviewFilter === 'all') {
        return true;
      }
      if (state.reviewFilter === 'today') {
        return review.reviewDate === currentDateKey();
      }
      if (state.reviewFilter === 'week') {
        const start = startOfDay(state.currentDate);
        const diff = (start.getDay() + 6) % 7;
        const weekStart = addDays(start, -diff);
        const rd = startOfDay(new Date(review.reviewDate));
        return rd >= weekStart && rd < addDays(weekStart, 7);
      }
      if (state.reviewFilter === 'month') {
        const start = startOfDay(state.currentDate);
        const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
        const rd = startOfDay(new Date(review.reviewDate));
        return rd >= monthStart && rd < new Date(start.getFullYear(), start.getMonth() + 1, 1);
      }
      return true;
    })
    .sort((left, right) => left.reviewDate.localeCompare(right.reviewDate) || left.reviewNumber - right.reviewNumber);
}

function renderReviewList() {
  const reviews = getFilteredReviews();
  if (!reviews.length) {
    dom.reviewList.innerHTML = '<div class="review-empty">暂无复习条目</div>';
    return;
  }
  dom.reviewList.innerHTML = reviews.map((review) => `
    <div class="review-item ${review.completed ? 'done' : ''}" data-review-id="${review.id}">
      <div class="review-meta">
        <div class="review-date">${review.reviewDate} 第${review.reviewNumber}次复习</div>
        <div class="review-desc">${escapeHtml(review.textContent)}</div>
      </div>
      <div class="review-actions">
        <button class="tool-btn ${review.completed ? '' : 'primary'}" data-review-complete="${review.id}">${review.completed ? '已完成' : '标记完成'}</button>
      </div>
    </div>
  `).join('');
  dom.reviewList.querySelectorAll('[data-review-complete]').forEach((button) => {
    button.addEventListener('click', () => toggleReviewComplete(button.dataset.reviewComplete));
  });
}

function updateReviewBadge() {
  const count = state.reviews.filter((review) => review.reviewDate === currentDateKey() && !review.completed).length;
  dom.reviewBadge.textContent = String(count);
}

function toggleReviewComplete(reviewId) {
  const review = state.reviews.find((item) => item.id === reviewId);
  if (!review) {
    return;
  }
  pushHistory();
  review.completed = !review.completed;
  saveBackup();
  renderAll();
}

function drawBackground(layout) {
  const hourHeight = state.settings.hourHeight;
  
  // 交替的小时行背景色
  layout.hours.forEach((hour, index) => {
    const y = index * hourHeight;
    const isOddHour = hour % 2 === 1;
    
    // 计划区背景（左半部分）
    ctx.fillStyle = isOddHour ? 'rgba(255,248,225,0.3)' : 'rgba(255,252,240,0.2)';
    ctx.fillRect(0, y, layout.planWidth, hourHeight);
    
    // 记录区背景（右半部分）
    ctx.fillStyle = isOddHour ? 'rgba(225,240,255,0.3)' : 'rgba(240,248,255,0.2)';
    ctx.fillRect(layout.planWidth, y, layout.width - layout.planWidth, hourHeight);
  });
}

function drawHourGrid(layout) {
  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.05)';
  ctx.lineWidth = 1;
  const hourHeight = state.settings.hourHeight;
  
  // 绘制小时行网格
  layout.hours.forEach((hour, index) => {
    const y = index * hourHeight;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(layout.width, y);
    ctx.stroke();
  });
  
  // 在每个小时行内绘制分钟刻度线
  layout.hours.forEach((hour, index) => {
    const hourY = index * hourHeight + hourHeight / 2;
    // 左右半区各自按自身宽度计算刻度间距，随占比调整而伸缩
    const planMinuteWidth = (layout.planWidth - 64) / 60;
    const recordMinuteWidth = (layout.width - layout.planWidth - 64) / 60;
    
    for (let minute = 0; minute <= 60; minute += 1) {
      const planX = 32 + minute * planMinuteWidth;
      const recordX = layout.planWidth + 32 + minute * recordMinuteWidth;
      const lineY = hourY - 3;
      const lineHeight = 6;
      
      if (minute % 5 === 0) {
        // 5分钟刻度线（较粗）
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(planX, lineY - lineHeight);
        ctx.lineTo(planX, lineY + lineHeight);
        ctx.stroke();
        
        // 右侧半区
        ctx.beginPath();
        ctx.moveTo(recordX, lineY - lineHeight);
        ctx.lineTo(recordX, lineY + lineHeight);
        ctx.stroke();
      } else {
        // 分钟刻度线（较细）
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(planX, lineY - lineHeight / 2);
        ctx.lineTo(planX, lineY + lineHeight / 2);
        ctx.stroke();
        
        // 右侧半区
        ctx.beginPath();
        ctx.moveTo(recordX, lineY - lineHeight / 2);
        ctx.lineTo(recordX, lineY + lineHeight / 2);
        ctx.stroke();
      }
    }
  });
  
  ctx.restore();
}

function getHourLabelColor(hour) {
  const palette = [
    '#d94f4f',
    '#e0702f',
    '#d79b17',
    '#4f9d69',
    '#2f8ccf',
    '#6b6bd6'
  ];
  return palette[hour % palette.length];
}

function dotStyle(kind) {
  return { size: state.settings.dotSizes[kind], opacity: state.settings.dotOpacities[kind] };
}

function drawMinuteDots(layout) {
  const hourHeight = state.settings.hourHeight;
  // 分钟宽度，左右半区各自按自身宽度计算，随占比调整而伸缩
  const planMinuteWidth = (layout.planWidth - 64) / 60;
  const recordMinuteWidth = (layout.width - layout.planWidth - 64) / 60;
  
  layout.hours.forEach((hour, index) => {
    const hourY = index * hourHeight + hourHeight / 2; // 小时行中心位置
    
    // 在每个小时行上横向绘制分钟刻度
    for (let minute = 0; minute < 60; minute += state.settings.minuteInterval) {
      const slot = minuteToSlot(hour, minute);
      const kind = minute % 15 === 0 ? 'large' : minute % 5 === 0 ? 'medium' : 'small';
      const style = dotStyle(kind);
      const interactive = isSlotInteractive(slot);
      const allowed = !state.selectionMode || state.selectionMode !== 'end' || !Number.isFinite(state.selectionAnchorSlot) || slot > state.selectionAnchorSlot;
      const isSelectedChoice = state.selectionMode && interactive && allowed;
      
      // 计算分钟点的X位置（在小时行内横向排列）
      // 左右半区各自按自身宽度缩放
      const planX = 32 + minute * planMinuteWidth;
      const recordX = layout.planWidth + 32 + minute * recordMinuteWidth;
      
      // 在左右两个半区都绘制分钟点
      const xOffsets = [planX, recordX];
      
      xOffsets.forEach((x, i) => {
        ctx.beginPath();
        if (!interactive || !allowed) {
          ctx.fillStyle = 'rgba(136,136,136,0.1)';
        } else if (isSelectedChoice) {
          ctx.fillStyle = 'rgba(53,160,74,0.85)';
        } else {
          ctx.fillStyle = rgba('#888888', style.opacity);
        }
        const radius = isSelectedChoice ? style.size + 2 : style.size;
        
        // 在小时行中心绘制分钟点
        ctx.arc(x, hourY, radius, 0, Math.PI * 2);
        ctx.fill();
        
        // 为5分钟间隔添加标签
        if (minute % 5 === 0 && minute !== 0) {
          ctx.save();
          ctx.font = '10px "Segoe UI", sans-serif';
          ctx.fillStyle = 'rgba(100,100,100,0.7)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(`${minute}`, x, hourY + radius + 2);
          ctx.restore();
        }
      });
    }
  });
}

function drawEvents(layout) {
  currentEvents().forEach((event) => {
    const box = eventBox(event, layout);
    if (!box) {
      return;
    }
    const style = getEventStyle(event);
    ctx.save();
    
    // 设置箭头样式
    const arrowColor = event.conflict ? 'rgba(230,80,80,0.85)' : rgba(style.color, style.opacity);
    const arrowFillColor = event.conflict ? 'rgba(230,80,80,0.7)' : rgba(style.color, style.opacity * 0.9);
    const arrowLineWidth = 6;
    const arrowHeadSize = 12;
    
    ctx.strokeStyle = arrowColor;
    ctx.fillStyle = arrowFillColor;
    ctx.lineWidth = arrowLineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // 计算事件跨越的小时数
    const startHour = box.startHour;
    const endHour = box.endHour;
    const startMinute = box.startMinute;
    const endMinute = box.endMinute;
    
    const hourHeight = state.settings.hourHeight;
    const zoneWidth = event.halfZone === 'plan' ? layout.planWidth : layout.width - layout.planWidth;
    const minuteWidth = (zoneWidth - 32) / 60; // 分钟宽度
    
    // 获取可见小时列表
    const visibleHours = layout.hours;
    
    // 结束时间为整点时，箭头留在上一行（整点所在行不画箭头）
    const endAtBoundary = endMinute === 0;
    const loopEndHour = endAtBoundary ? (endHour === 0 ? 23 : endHour - 1) : endHour;
    const drawEndMinute = endAtBoundary ? 60 : endMinute;
    
    // 遍历事件跨越的每个小时
    for (let hour = startHour; hour <= loopEndHour; hour++) {
      // 检查这个小时是否可见
      const hourIndex = visibleHours.indexOf(hour);
      if (hourIndex === -1) continue; // 小时不可见，跳过
      
      const hourY = hourIndex * hourHeight + hourHeight / 2;
      const boxX = event.halfZone === 'plan' ? 16 : layout.planWidth + 16;
      
      // 计算这个小时内的开始分钟
      let hourStartMinute = 0;
      if (hour === startHour) {
        hourStartMinute = startMinute;
      }
      
      // 计算这个小时内的结束分钟
      let hourEndMinute = 59;
      if (hour === loopEndHour) {
        hourEndMinute = drawEndMinute;
      }
      
      // 计算这个小时内的箭头位置
      const hourStartX = boxX + hourStartMinute * minuteWidth;
      const hourEndX = boxX + hourEndMinute * minuteWidth;
      
      // 确保箭头有最小长度
      const minArrowLength = 20;
      const actualLength = hourEndX - hourStartX;
      
      let drawStartX = hourStartX;
      let drawEndX = hourEndX;
      
      if (actualLength < minArrowLength) {
        // 如果箭头太短，居中显示
        const centerX = (hourStartX + hourEndX) / 2;
        drawStartX = centerX - minArrowLength / 2;
        drawEndX = centerX + minArrowLength / 2;
        
        // 绘制短箭头线
        ctx.beginPath();
        ctx.moveTo(drawStartX, hourY);
        ctx.lineTo(drawEndX, hourY);
        ctx.stroke();
      } else {
        // 绘制正常箭头线
        ctx.beginPath();
        ctx.moveTo(drawStartX, hourY);
        ctx.lineTo(drawEndX, hourY);
        ctx.stroke();
      }
      
      // 如果是最后一个小时，绘制箭头头部
      if (hour === loopEndHour) {
        ctx.beginPath();
        ctx.moveTo(drawEndX, hourY);
        ctx.lineTo(drawEndX - arrowHeadSize, hourY - arrowHeadSize / 2);
        ctx.lineTo(drawEndX - arrowHeadSize, hourY + arrowHeadSize / 2);
        ctx.closePath();
        ctx.fill();
      }
      
      // 如果是第一个小时，绘制起点圆点
      if (hour === startHour) {
        ctx.beginPath();
        ctx.arc(drawStartX, hourY, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // 注意：移除了垂直连接线的绘制，箭头全部横向表示
    }
    
    // 如果事件有冲突，添加特殊样式
    if (event.conflict) {
      ctx.strokeStyle = 'rgba(230,80,80,0.75)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      
      // 计算冲突边框的位置
      const startHourIndex = visibleHours.indexOf(startHour);
      const endHourIndex = visibleHours.indexOf(loopEndHour) !== -1 ? visibleHours.indexOf(loopEndHour) : visibleHours.indexOf(endHour);
      
      if (startHourIndex !== -1 && endHourIndex !== -1) {
        const startY = startHourIndex * hourHeight + hourHeight / 2;
        const endY = endHourIndex * hourHeight + hourHeight / 2;
        const boxX = event.halfZone === 'plan' ? 16 : layout.planWidth + 16;
        const startX = boxX + startMinute * minuteWidth;
        const endX = boxX + drawEndMinute * minuteWidth;
        
        const padding = 8;
        ctx.beginPath();
        ctx.moveTo(startX - padding, startY - padding);
        ctx.lineTo(endX + arrowHeadSize, startY - padding);
        ctx.lineTo(endX + arrowHeadSize, endY + padding);
        ctx.lineTo(startX - padding, endY + padding);
        ctx.closePath();
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    
    // 选中状态高亮
    if (state.selectedEventId === event.id) {
      // 增强所有箭头线段
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = arrowLineWidth + 2;
      
      for (let hour = startHour; hour <= loopEndHour; hour++) {
        const hourIndex = visibleHours.indexOf(hour);
        if (hourIndex === -1) continue;
        
        const boxX = event.halfZone === 'plan' ? 16 : layout.planWidth + 16;
        
        let hourStartMinute = (hour === startHour) ? startMinute : 0;
        let hourEndMinute = (hour === loopEndHour) ? drawEndMinute : 59;
        
        // 该段竖直中点：段内时间范围（起止分钟）的中间位置
        const segmentMidMinute = (hourStartMinute + hourEndMinute + 1) / 2;
        const hourY = hourIndex * hourHeight + (segmentMidMinute / 60) * hourHeight;
        
        const hourStartX = boxX + hourStartMinute * minuteWidth;
        const hourEndX = boxX + hourEndMinute * minuteWidth;
        
        // 处理短箭头的情况
        const minArrowLength = 20;
        const actualLength = hourEndX - hourStartX;
        let drawStartX = hourStartX;
        let drawEndX = hourEndX;
        
        if (actualLength < minArrowLength) {
          const centerX = (hourStartX + hourEndX) / 2;
          drawStartX = centerX - minArrowLength / 2;
          drawEndX = centerX + minArrowLength / 2;
        }
        
        // 增强水平箭头线
        ctx.beginPath();
        ctx.moveTo(drawStartX, hourY);
        ctx.lineTo(drawEndX, hourY);
        ctx.stroke();
      }
      
      // 增强箭头头部
      const endHourIndex = visibleHours.indexOf(loopEndHour) !== -1 ? visibleHours.indexOf(loopEndHour) : visibleHours.indexOf(endHour);
      if (endHourIndex !== -1) {
        // 段竖直中点与主箭头一致
        const endSegStart = (loopEndHour === startHour) ? startMinute : 0;
        const endSegMid = (endSegStart + drawEndMinute + 1) / 2;
        const endY = endHourIndex * hourHeight + (endSegMid / 60) * hourHeight;
        const boxX = event.halfZone === 'plan' ? 16 : layout.planWidth + 16;
        
        const hourEndX = boxX + drawEndMinute * minuteWidth;
        const hourStartX = (loopEndHour === startHour) ? boxX + startMinute * minuteWidth : boxX;
        
        // 处理短箭头的情况
        const minArrowLength = 20;
        const actualLength = hourEndX - hourStartX;
        let drawEndX = hourEndX;
        
        if (actualLength < minArrowLength) {
          const centerX = (hourStartX + hourEndX) / 2;
          drawEndX = centerX + minArrowLength / 2;
        }
        
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.moveTo(drawEndX, endY);
        ctx.lineTo(drawEndX - arrowHeadSize, endY - arrowHeadSize / 2);
        ctx.lineTo(drawEndX - arrowHeadSize, endY + arrowHeadSize / 2);
        ctx.closePath();
        ctx.fill();
      }
      
      // 增强起点圆点
      const startHourIndex = visibleHours.indexOf(startHour);
      if (startHourIndex !== -1) {
        // 段竖直中点与主箭头一致
        const startSegEnd = (startHour === loopEndHour) ? drawEndMinute : 59;
        const startSegMid = (startMinute + startSegEnd + 1) / 2;
        const startY = startHourIndex * hourHeight + (startSegMid / 60) * hourHeight;
        const boxX = event.halfZone === 'plan' ? 16 : layout.planWidth + 16;
        const startX = boxX + startMinute * minuteWidth;
        
        const hourStartX = startX;
        const hourEndX = (startHour === loopEndHour) ? boxX + drawEndMinute * minuteWidth : boxX + 59 * minuteWidth;
        
        // 处理短箭头的情况
        const minArrowLength = 20;
        const actualLength = hourEndX - hourStartX;
        let drawStartX = hourStartX;
        
        if (actualLength < minArrowLength) {
          const centerX = (hourStartX + hourEndX) / 2;
          drawStartX = centerX - minArrowLength / 2;
        }
        
        ctx.beginPath();
        ctx.arc(drawStartX, startY, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  });
}

function drawEventTexts(layout) {
  currentEvents().forEach((event) => {
    const box = eventBox(event, layout);
    if (!box) {
      return;
    }
    const timeText = `${slotToLabel(event.startSlot)} - ${slotToLabel(event.endSlot)}`;
    const description = event.textContent || event.categoryName || '';
    
    ctx.save();
    
    // 获取可见小时列表
    const visibleHours = layout.hours;
    const hourHeight = state.settings.hourHeight;
    const minuteWidth = box.minuteWidth;
    
    // 计算事件的中点位置（用于文本显示）
    const startHourIndex = visibleHours.indexOf(box.startHour);
    // 结束时间为整点时，结束标签显示在上一行行尾
    const endAtBoundary = box.endMinute === 0;
    const loopEndHour = endAtBoundary ? (box.endHour === 0 ? 23 : box.endHour - 1) : box.endHour;
    const drawEndMinute = endAtBoundary ? 60 : box.endMinute;
    const endHourIndex = visibleHours.indexOf(loopEndHour);
    
    if (startHourIndex === -1 || endHourIndex === -1) {
      ctx.restore();
      return;
    }
    
    // 计算文本显示位置（在第一个小时行上方）
    const firstHourY = startHourIndex * hourHeight + hourHeight / 2;
    const boxX = event.halfZone === 'plan' ? 16 : layout.planWidth + 16;
    const startX = boxX + box.startMinute * minuteWidth;
    const endX = boxX + drawEndMinute * minuteWidth;
    
    // 计算整体中点
    const midX = (startX + endX) / 2;
    
    // 时间文本显示在第一个小时行上方
    ctx.font = `bold ${Math.max(11, (event.textSize || 16) - 2)}px "Segoe UI", sans-serif`;
    const timeWidth = ctx.measureText(timeText).width + 14;
    const timeHeight = 22;
    
    const timeLabelX = midX - timeWidth / 2;
    const timeLabelY = firstHourY - 40;
    
    // 时间标签背景
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    roundedRect(ctx, timeLabelX, timeLabelY, timeWidth, timeHeight, 10);
    ctx.fill();
    
    // 时间文本
    ctx.fillStyle = rgba('#1f1f1f', 0.92);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(timeText, timeLabelX + timeWidth / 2, timeLabelY + timeHeight / 2);
    
    // 事件描述显示在时间标签下方
    if (description) {
      ctx.fillStyle = rgba(event.textColor || '#1f1f1f', event.textOpacity ?? 0.85);
      ctx.font = `${event.textSize || 14}px "Segoe UI", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      
      const descY = timeLabelY + timeHeight + 5;
      const maxWidth = Math.max(150, Math.abs(endX - startX));
      const textWidth = ctx.measureText(description).width;
      
      if (textWidth <= maxWidth) {
        ctx.fillText(description, midX, descY);
      } else {
        // 文本太长时截断
        let truncated = description;
        while (truncated.length > 0 && ctx.measureText(truncated + '...').width > maxWidth) {
          truncated = truncated.slice(0, -1);
        }
        if (truncated.length > 0) {
          ctx.fillText(truncated + '...', midX, descY);
        }
      }
    }
    
    // 在起点显示开始时间标签
    ctx.save();
    ctx.font = 'bold 11px "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const startTimeText = `${pad(box.startHour)}:${box.startMinute.toString().padStart(2, '0')}`;
    const startTimeWidth = ctx.measureText(startTimeText).width + 10;
    
    // 开始时间背景
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundedRect(ctx, startX - startTimeWidth / 2, firstHourY - 25, startTimeWidth, 18, 5);
    ctx.fill();
    
    // 开始时间文本
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillText(startTimeText, startX, firstHourY - 16);
    ctx.restore();
    
    // 在终点显示结束时间标签
    ctx.save();
    ctx.font = 'bold 11px "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const lastHourY = endHourIndex * hourHeight + hourHeight / 2;
    const endTimeText = `${pad(box.endHour)}:${box.endMinute.toString().padStart(2, '0')}`;
    const endTimeWidth = ctx.measureText(endTimeText).width + 10;
    
    // 结束时间背景
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundedRect(ctx, endX - endTimeWidth / 2, lastHourY - 25, endTimeWidth, 18, 5);
    ctx.fill();
    
    // 结束时间文本
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillText(endTimeText, endX, lastHourY - 16);
    ctx.restore();
    
    // 如果事件跨越多个小时，在中间小时显示连接指示
    if (box.hourSpan > 1) {
      ctx.save();
      ctx.font = '10px "Segoe UI", sans-serif';
      ctx.fillStyle = 'rgba(100,100,100,0.7)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // 在中间的每个小时行右侧显示连接点
      for (let hour = box.startHour + 1; hour < loopEndHour; hour++) {
        const hourIndex = visibleHours.indexOf(hour);
        if (hourIndex !== -1) {
      // 该段竖直中点：段内时间范围（起止分钟）的中间位置
      // 整小时段(0-59)中点为30即行中心；非整小时段按自身时间中点微调
      const segmentMidMinute = (hourStartMinute + hourEndMinute + 1) / 2;
      const hourY = hourIndex * hourHeight + (segmentMidMinute / 60) * hourHeight;
          const rightEdge = event.halfZone === 'plan' ? layout.planWidth - 10 : layout.width - 10;
          
          ctx.fillText('↕', rightEdge, hourY);
        }
      }
      ctx.restore();
    }
    
    ctx.restore();
  });
}

function drawAxis(layout) {
  ctx.save();
  const hourHeight = state.settings.hourHeight;
  
  // 绘制小时分隔线和标签
  layout.hours.forEach((hour, index) => {
    const y = index * hourHeight;
    const centerY = y + hourHeight / 2;
    
    // 绘制小时分隔线
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(layout.width, y);
    ctx.stroke();
    
    // 在中间分隔线处显示小时标签（仅一组，两个半区共用）
    ctx.save();
    ctx.font = 'bold 16px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.fillStyle = getHourLabelColor(hour);
    
    ctx.strokeText(`${pad(hour)}:00`, layout.planWidth, centerY);
    ctx.fillText(`${pad(hour)}:00`, layout.planWidth, centerY);
    ctx.restore();
  });
  
  // 绘制中央分隔线
  ctx.strokeStyle = '#3f3f3f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(layout.planWidth, 0);
  ctx.lineTo(layout.planWidth, layout.height);
  ctx.stroke();
  
  // 在顶部显示分钟刻度标签
  ctx.save();
  ctx.font = '12px "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgba(80,80,80,0.8)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  
  // 左右半区各自按自身宽度计算分钟刻度间距，随占比调整而伸缩
  const planMinuteWidth = (layout.planWidth - 64) / 60;
  const recordMinuteWidth = (layout.width - layout.planWidth - 64) / 60;
  for (let minute = 0; minute <= 60; minute += 5) {
    // 左侧半区分钟标签
    ctx.fillText(`${minute}`, 32 + minute * planMinuteWidth, 20);
    
    // 右侧半区分钟标签
    ctx.fillText(`${minute}`, layout.planWidth + 32 + minute * recordMinuteWidth, 20);
  }
  
  // 添加分钟刻度说明
  ctx.font = 'bold 10px "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgba(120,120,120,0.9)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('分钟刻度 →', layout.planWidth / 2, 5);
  ctx.fillText('分钟刻度 →', layout.planWidth + (layout.width - layout.planWidth) / 2, 5);
  
  ctx.restore();
  
  ctx.restore();
}

function roundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function wrapText(context, text, centerX, centerY, maxWidth, lineHeight) {
  const chars = String(text).split('');
  const lines = [];
  let line = '';
  chars.forEach((char) => {
    const candidate = line + char;
    if (context.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = char;
    } else {
      line = candidate;
    }
  });
  if (line) {
    lines.push(line);
  }
  const startY = centerY - ((lines.length - 1) * lineHeight) / 2;
  lines.slice(0, 3).forEach((lineText, index) => {
    context.fillText(lineText, centerX, startY + index * lineHeight);
  });
}

function renderTimeline() {
  const layout = getTimelineLayout();
  ctx.clearRect(0, 0, layout.width, layout.height);
  drawBackground(layout);
  drawHourGrid(layout);
  drawMinuteDots(layout);
  drawEvents(layout);
  drawEventTexts(layout);
  drawAxis(layout);
  canvas.style.cursor = state.selectionMode ? 'crosshair' : 'default';
}

function renderDateBar() {
  dom.currentDateLabel.textContent = formatDateLabel(state.currentDate);
}

function renderReviewList() {
  const reviews = getFilteredReviews();
  if (!reviews.length) {
    dom.reviewList.innerHTML = '<div class="review-empty">暂无复习条目</div>';
    updateReviewBadge();
    return;
  }
  dom.reviewList.innerHTML = reviews.map((review) => `
    <div class="review-item ${review.completed ? 'done' : ''}" data-review-id="${review.id}">
      <div class="review-meta">
        <div class="review-date">${review.reviewDate} 第${review.reviewNumber}次复习</div>
        <div class="review-desc">${escapeHtml(review.textContent)}</div>
      </div>
      <div class="review-actions">
        <button class="tool-btn ${review.completed ? '' : 'primary'}" data-review-complete="${review.id}">${review.completed ? '已完成' : '标记完成'}</button>
      </div>
    </div>
  `).join('');
  dom.reviewList.querySelectorAll('[data-review-complete]').forEach((button) => {
    button.addEventListener('click', () => toggleReviewComplete(button.dataset.reviewComplete));
  });
  updateReviewBadge();
}

function getFilterRange() {
  const start = startOfDay(state.currentDate);
  if (state.reviewFilter === 'today') {
    return { start };
  }
  if (state.reviewFilter === 'week') {
    const diff = (start.getDay() + 6) % 7;
    const weekStart = addDays(start, -diff);
    return { start: weekStart };
  }
  if (state.reviewFilter === 'month') {
    const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
    return { start: monthStart };
  }
  return null;
}

function getFilteredReviews() {
  // unified filtering: 'today' matches only today's reviews
  return state.reviews
    .filter((review) => state.reviewFilter === 'all' || !review.completed)
    .filter((review) => {
      if (state.reviewFilter === 'all') {
        return true;
      }
      if (state.reviewFilter === 'today') {
        return review.reviewDate === currentDateKey();
      }
      if (state.reviewFilter === 'week') {
        const start = startOfDay(state.currentDate);
        const diff = (start.getDay() + 6) % 7;
        const weekStart = addDays(start, -diff);
        const rd = startOfDay(new Date(review.reviewDate));
        return rd >= weekStart && rd < addDays(weekStart, 7);
      }
      if (state.reviewFilter === 'month') {
        const start = startOfDay(state.currentDate);
        const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
        const rd = startOfDay(new Date(review.reviewDate));
        return rd >= monthStart && rd < new Date(start.getFullYear(), start.getMonth() + 1, 1);
      }
      return true;
    })
    .sort((left, right) => left.reviewDate.localeCompare(right.reviewDate) || left.reviewNumber - right.reviewNumber);
}

function updateReviewBadge() {
  dom.reviewBadge.textContent = String(state.reviews.filter((review) => review.reviewDate === currentDateKey() && !review.completed).length);
}

function renderAll() {
  renderDateBar();
  renderReviewList();
  renderTimeline();
  updateReviewBadge();
}

function scheduleRender() {
  if (state.rafId) {
    cancelAnimationFrame(state.rafId);
  }
  state.rafId = requestAnimationFrame(renderAll);
}

function loop(timestamp) {
  state.blinkOn = Math.floor(timestamp / 500) % 2 === 0;
  renderTimeline();
  requestAnimationFrame(loop);
}

function exportData() {
  const payload = {
    version: DATA_VERSION,
    settings: state.settings,
    categories: state.categories,
    events: state.events,
    reviews: state.reviews,
    currentDate: state.currentDate.toISOString(),
    exportedAt: new Date().toISOString()
  };
  downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), `学习日志数据_${formatExportStamp(new Date())}.json`);
}

function exportImage() {
  renderTimeline();
  downloadBlob(dataURLToBlob(canvas.toDataURL('image/png')), `时间轴_${formatShortDate(new Date())}.png`);
}

function dataURLToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(',');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: (header.match(/:(.*?);/) || [null, 'image/png'])[1] });
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function handleImportFile() {
  const file = dom.importInput.files?.[0];
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    if (!window.confirm('导入将覆盖当前全部数据，是否继续？')) {
      return;
    }
    try {
      const data = JSON.parse(String(reader.result));
      pushHistory();
      state.settings = { ...clone(defaultSettings), ...(data.settings || {}) };
      state.categories = Array.isArray(data.categories) && data.categories.length ? data.categories : clone(defaultCategories);
      state.events = Array.isArray(data.events) ? data.events.map((event) => ({ ...event, date: normalizeDateKey(event.date) })) : [];
      state.reviews = Array.isArray(data.reviews) ? data.reviews.map((review) => ({ ...review, reviewDate: normalizeDateKey(review.reviewDate) })) : [];
      if (data.currentDate) {
        state.currentDate = startOfDay(new Date(data.currentDate));
      }
      validateConflicts();
      syncSettingsToUI();
      refreshCategoryUI();
      saveBackup();
      renderAll();
    } catch (error) {
      window.alert('导入失败：文件格式无效。');
    }
  };
  reader.readAsText(file);
  dom.importInput.value = '';
}

function deleteEvent(eventId) {
  const target = state.events.find((item) => item.id === eventId);
  if (!target) {
    return;
  }
  if (!window.confirm('确认删除该事件？')) {
    return;
  }
  pushHistory();
  state.events = state.events.filter((item) => item.id !== eventId);
  state.reviews = state.reviews.filter((item) => item.sourceEventId !== eventId);
  saveBackup();
  renderAll();
}

function clearEvents() {
  if (!window.confirm('确认清空所有事件与复习条目？')) {
    return;
  }
  pushHistory();
  state.events = [];
  state.reviews = [];
  saveBackup();
  renderAll();
}

function onKeydown(event) {
  if (event.ctrlKey && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    undo();
    return;
  }
  if (event.ctrlKey && event.key.toLowerCase() === 'y') {
    event.preventDefault();
    redo();
    return;
  }
  if (event.key === 'Escape') {
    state.selectionMode = null;
    state.selectionAnchorSlot = null;
    state.selectionEndSlot = null;
    hideContextMenu();
    hideHoverDelete();
    if (state.activeModal === 'event') {
      closeModal('eventModal');
    }
    if (state.activeModal === 'settings') {
      closeModal('settingsModal');
    }
  }
}

function undo() {
  if (state.historyIndex < 0) {
    return;
  }
  const snapshot = state.history[state.historyIndex];
  state.historyIndex -= 1;
  restoreSnapshot(snapshot);
}

function redo() {
  if (state.historyIndex + 1 >= state.history.length) {
    return;
  }
  state.historyIndex += 1;
  restoreSnapshot(state.history[state.historyIndex]);
}

function restoreSnapshot(snapshot) {
  state.currentDate = startOfDay(new Date(snapshot.currentDate));
  state.settings = clone(snapshot.settings);
  state.categories = clone(snapshot.categories);
  state.events = clone(snapshot.events);
  state.reviews = clone(snapshot.reviews);
  state.selectionMode = null;
  state.selectionAnchorSlot = null;
  state.selectionEndSlot = null;
  state.selectedEventId = null;
  state.hoveredEventId = null;
  syncSettingsToUI();
  refreshCategoryUI();
  validateConflicts();
  saveBackup();
  renderAll();
}

function showHoverDelete(event, clientX, clientY) {
  const box = eventBox(event);
  if (!box) {
    hideHoverDelete();
    return;
  }
  dom.hoverDeleteBtn.classList.remove('hidden');
  dom.hoverDeleteBtn.style.left = `${clientX + 6}px`;
  dom.hoverDeleteBtn.style.top = `${clientY - 10}px`;
  dom.hoverDeleteBtn.onclick = () => deleteEvent(event.id);
}

function hideHoverDelete() {
  dom.hoverDeleteBtn.classList.add('hidden');
  dom.hoverDeleteBtn.onclick = null;
}

function showContextMenu(clientX, clientY, event) {
  dom.contextMenu.innerHTML = `
    <button data-action="edit-start">修改起始时间</button>
    <button data-action="edit-end">修改结束时间</button>
    <button data-action="delete">删除</button>
  `;
  dom.contextMenu.style.left = `${clientX}px`;
  dom.contextMenu.style.top = `${clientY}px`;
  dom.contextMenu.classList.remove('hidden');
  dom.contextMenu.querySelector('[data-action="edit-start"]').onclick = () => {
    openEventModal(event);
    focusEventTimeInput('start');
    hideContextMenu();
  };
  dom.contextMenu.querySelector('[data-action="edit-end"]').onclick = () => {
    openEventModal(event);
    focusEventTimeInput('end');
    hideContextMenu();
  };
  dom.contextMenu.querySelector('[data-action="delete"]').onclick = () => {
    deleteEvent(event.id);
    hideContextMenu();
  };
}

function hideContextMenu() {
  dom.contextMenu.classList.add('hidden');
  dom.contextMenu.innerHTML = '';
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttr(text) {
  return escapeHtml(text).replaceAll('\n', ' ');
}

function syncEventInputsByType() {
  // 添加事件时按任务类型自动选择半区：学习→计划区(左)，复习→记录区(右)；编辑时不覆盖用户已选半区
  if (!state.editingEventId) {
    if (dom.eventTaskType.value === 'learn') {
      dom.eventHalfZone.value = 'plan';
    } else if (dom.eventTaskType.value === 'review') {
      dom.eventHalfZone.value = 'record';
    }
  }
  if (dom.eventTaskType.value === 'review') {
    dom.eventColor.value = state.settings.reviewColor;
    dom.eventOpacity.value = String(state.settings.reviewOpacity);
    return;
  }
  syncEventInputsByCategory();
}

function syncEventInputsByCategory() {
  const category = state.categories.find((item) => item.id === dom.eventCategory.value);
  if (!category || dom.eventTaskType.value === 'review') {
    return;
  }
  dom.eventColor.value = category.color;
  dom.eventOpacity.value = String(category.opacity);
}

function onCategoryEdit(event) {
  const row = event.target.closest('.category-row');
  const category = state.categories.find((item) => item.id === row.dataset.categoryId);
  if (!category) {
    return;
  }
  category.name = row.querySelector('.cat-name').value.trim() || '未命名';
  category.color = row.querySelector('.cat-color').value;
  category.opacity = Number(row.querySelector('.cat-opacity').value);
  syncEventCategoryOptions();
  saveBackup();
}

function syncEventCategoryOptions() {
  dom.eventCategory.innerHTML = state.categories.map((category) => `<option value="${category.id}">${escapeHtml(category.name)}</option>`).join('');
  dom.eventCategory.value = dom.eventCategory.value || state.categories[0]?.id || '';
}
