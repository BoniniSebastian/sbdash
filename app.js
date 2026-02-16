/* =========================
   SB Dash (Stable iPad/Desktop)
   - Left: Google Calendar embed (agenda)
   - Center: Panels (weather/news/todo/ideas/done/pomodoro)
   - Right: Active prio
   - Bottom-right: Dial to switch view + live icon
   - Pomodoro: SVG ring drains correctly
   - Storage: localStorage
   ========================= */

/** ====== CONFIG ====== **/
const CALENDAR_EMBED_SRC = ""; 
// 1) Gå till Google Kalender -> Inställningar -> din kalender -> Integrera kalender
// 2) Kopiera iframe src (agenda/standard)
// 3) Klistra här som sträng, ex:
// const CALENDAR_EMBED_SRC = "https://calendar.google.com/calendar/embed?mode=AGENDA&...";

const NEWS_RSS_URL = "https://www.svt.se/nyheter/rss.xml"; // kan bytas
const WEATHER_LAT = 59.3293; // Stockholm
const WEATHER_LON = 18.0686;

/** ====== VIEWS ====== **/
const VIEWS = [
  { key: "weather",  title: "Väder",    sub: "Stockholm (Open-Meteo)", icon: "☀️" },
  { key: "news",     title: "Nyheter",  sub: "RSS (fallback om CORS)",  icon: "📰" },
  { key: "todo",     title: "Todo",     sub: "Att göra",               icon: "✅" },
  { key: "ideas",    title: "Ideas",    sub: "Tankar & idéer",         icon: "💡" },
  { key: "done",     title: "Done",     sub: "Avklarat",               icon: "🏁" },
  { key: "pomodoro", title: "Pomodoro", sub: "Fokusblock",             icon: "⏱️" },
];

let currentIndex = 0;

/** ====== STORAGE ====== **/
const LS = {
  todo: "sbdash.todo.v1",
  ideas: "sbdash.ideas.v1",
  done: "sbdash.done.v1",
  prio: "sbdash.prio.v1",
  pomo: "sbdash.pomo.v1",
};

function loadList(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}
function saveList(key, list) {
  localStorage.setItem(key, JSON.stringify(list));
}

let todo  = loadList(LS.todo);
let ideas = loadList(LS.ideas);
let done  = loadList(LS.done);
let prio  = loadList(LS.prio);

/** ====== DOM ====== **/
const $ = (id) => document.getElementById(id);

const todayText = $("todayText");
const viewTitle = $("viewTitle");
const viewSubtitle = $("viewSubtitle");

const panels = Array.from(document.querySelectorAll(".panel"));
const dial = $("dial");
const dialIcon = $("dialIcon");
const dialViewLabel = $("dialViewLabel");

const gcalFrame = $("gcalFrame");
const calendarPlaceholder = $("calendarPlaceholder");

/** ====== DATE ====== **/
function setDates() {
  const now = new Date();
  const weekday = now.toLocaleDateString("sv-SE", { weekday: "long" });
  const date = now.toLocaleDateString("sv-SE", { day: "2-digit", month: "long", year: "numeric" });
  todayText.textContent = `${weekday} ${date}`;
}
setDates();

/** ====== CALENDAR ====== **/
function initCalendar() {
  if (CALENDAR_EMBED_SRC && CALENDAR_EMBED_SRC.trim().length > 0) {
    gcalFrame.src = CALENDAR_EMBED_SRC.trim();
    gcalFrame.style.opacity = "1";
    calendarPlaceholder.style.display = "none";
  } else {
    gcalFrame.removeAttribute("src");
    gcalFrame.style.opacity = "0";
    calendarPlaceholder.style.display = "flex";
  }
}
initCalendar();

/** ====== VIEW SWITCHING ====== **/
function setActiveView(index) {
  const safeIndex = (index + VIEWS.length) % VIEWS.length;
  currentIndex = safeIndex;

  const v = VIEWS[currentIndex];

  // panel show/hide (no transform = no “hopps”)
  panels.forEach(p => p.classList.toggle("active", p.dataset.view === v.key));

  // header
  viewTitle.textContent = v.title;
  viewSubtitle.textContent = v.sub;

  // dial
  dialIcon.textContent = v.icon;
  dialViewLabel.textContent = v.title;
  dial.setAttribute("aria-valuenow", String(currentIndex));

  // rotate dial pointer by setting CSS transform on face
  // We rotate the entire face while pointer stays at top.
  const face = dial.querySelector(".dialFace");
  const angle = indexToAngle(currentIndex);
  face.style.transform = `rotate(${angle}deg)`;

  // lazy refresh per view
  if (v.key === "weather") loadWeather();
  if (v.key === "news") loadNews();
  if (v.key === "todo") renderTodo();
  if (v.key === "ideas") renderIdeas();
  if (v.key === "done") renderDone();
  if (v.key === "pomodoro") renderPomodoroNoteState();
}

function indexToAngle(i) {
  // 6 views -> 60° steps, centered
  const step = 360 / VIEWS.length;
  return i * step;
}

setActiveView(0);

/** ====== DIAL INTERACTION (drag + wheel + keyboard) ====== **/
let dragging = false;

function pointerToAngle(e) {
  const rect = dial.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  const x = (e.clientX ?? (e.touches && e.touches[0].clientX)) - cx;
  const y = (e.clientY ?? (e.touches && e.touches[0].clientY)) - cy;

  // angle where 0 is up
  const rad = Math.atan2(y, x);
  let deg = (rad * 180) / Math.PI;
  deg = deg + 90; // rotate so “up” is 0
  if (deg < 0) deg += 360;
  return deg;
}

function angleToIndex(deg) {
  const step = 360 / VIEWS.length;
  const i = Math.round(deg / step) % VIEWS.length;
  return i;
}

function onDialPointerDown(e) {
  dragging = true;
  dial.setPointerCapture?.(e.pointerId);
  e.preventDefault();
}
function onDialPointerMove(e) {
  if (!dragging) return;
  const deg = pointerToAngle(e);
  const idx = angleToIndex(deg);
  if (idx !== currentIndex) setActiveView(idx);
}
function onDialPointerUp(e) {
  dragging = false;
  try { dial.releasePointerCapture?.(e.pointerId); } catch {}
}

dial.addEventListener("pointerdown", onDialPointerDown);
dial.addEventListener("pointermove", onDialPointerMove);
dial.addEventListener("pointerup", onDialPointerUp);
dial.addEventListener("pointercancel", onDialPointerUp);

dial.addEventListener("wheel", (e) => {
  e.preventDefault();
  const dir = Math.sign(e.deltaY);
  setActiveView(currentIndex + (dir > 0 ? 1 : -1));
}, { passive: false });

dial.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight" || e.key === "ArrowDown") setActiveView(currentIndex + 1);
  if (e.key === "ArrowLeft" || e.key === "ArrowUp") setActiveView(currentIndex - 1);
});

/** ====== ACTIVE PRIO ====== **/
const prioInput = $("prioInput");
const addPrioBtn = $("addPrio");
const activePrioList = $("activePrioList");

function renderPrio() {
  if (!prio.length) {
    activePrioList.innerHTML = `<div class="muted">Inget i Aktiv prio ännu.</div>`;
    return;
  }

  activePrioList.innerHTML = "";
  prio.forEach((text, idx) => {
    const el = document.createElement("div");
    el.className = "rowItem";
    el.innerHTML = `
      <div class="rowLeft">
        <div class="rowText">${escapeHtml(text)}</div>
      </div>
      <div class="rowActions">
        <button class="ghostBtn" data-act="up" data-i="${idx}">↑</button>
        <button class="ghostBtn" data-act="down" data-i="${idx}">↓</button>
        <button class="dangerBtn" data-act="del" data-i="${idx}">X</button>
      </div>
    `;
    activePrioList.appendChild(el);
  });
}
renderPrio();

addPrioBtn.addEventListener("click", () => {
  const val = (prioInput.value || "").trim();
  if (!val) return;
  prio.unshift(val);
  prioInput.value = "";
  saveList(LS.prio, prio);
  renderPrio();
});

activePrioList.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const i = Number(btn.dataset.i);
  const act = btn.dataset.act;

  if (act === "del") prio.splice(i, 1);
  if (act === "up" && i > 0) [prio[i-1], prio[i]] = [prio[i], prio[i-1]];
  if (act === "down" && i < prio.length - 1) [prio[i+1], prio[i]] = [prio[i], prio[i+1]];

  saveList(LS.prio, prio);
  renderPrio();
});

/** ====== TODO / IDEAS / DONE ====== **/
const todoInput = $("todoInput");
const addTodo = $("addTodo");
const todoList = $("todoList");

const ideaInput = $("ideaInput");
const addIdea = $("addIdea");
const ideasList = $("ideasList");

const doneList = $("doneList");
const clearDone = $("clearDone");

addTodo.addEventListener("click", () => {
  const t = (todoInput.value || "").trim();
  if (!t) return;
  todo.unshift(t);
  todoInput.value = "";
  saveList(LS.todo, todo);
  renderTodo();
});

addIdea.addEventListener("click", () => {
  const t = (ideaInput.value || "").trim();
  if (!t) return;
  ideas.unshift(t);
  ideaInput.value = "";
  saveList(LS.ideas, ideas);
  renderIdeas();
});

clearDone.addEventListener("click", () => {
  done = [];
  saveList(LS.done, done);
  renderDone();
});

function renderTodo() {
  if (!todo.length) {
    todoList.innerHTML = `<div class="muted">Tomt.</div>`;
    return;
  }
  todoList.innerHTML = "";
  todo.forEach((text, idx) => {
    const el = document.createElement("div");
    el.className = "rowItem";
    el.innerHTML = `
      <div class="rowLeft">
        <div class="rowText">${escapeHtml(text)}</div>
      </div>
      <div class="rowActions">
        <button class="ghostBtn" data-act="prio" data-i="${idx}">Prio</button>
        <button class="primaryBtn" data-act="done" data-i="${idx}">Klar</button>
        <button class="dangerBtn" data-act="del" data-i="${idx}">X</button>
      </div>
    `;
    todoList.appendChild(el);
  });
}

function renderIdeas() {
  if (!ideas.length) {
    ideasList.innerHTML = `<div class="muted">Tomt.</div>`;
    return;
  }
  ideasList.innerHTML = "";
  ideas.forEach((text, idx) => {
    const el = document.createElement("div");
    el.className = "rowItem";
    el.innerHTML = `
      <div class="rowLeft">
        <div class="rowText">${escapeHtml(text)}</div>
      </div>
      <div class="rowActions">
        <button class="ghostBtn" data-act="todo" data-i="${idx}">Till Todo</button>
        <button class="dangerBtn" data-act="del" data-i="${idx}">X</button>
      </div>
    `;
    ideasList.appendChild(el);
  });
}

function renderDone() {
  if (!done.length) {
    doneList.innerHTML = `<div class="muted">Inget klart ännu.</div>`;
    return;
  }
  doneList.innerHTML = "";
  done.forEach((text, idx) => {
    const el = document.createElement("div");
    el.className = "rowItem";
    el.innerHTML = `
      <div class="rowLeft">
        <div class="rowText">${escapeHtml(text)}</div>
      </div>
      <div class="rowActions">
        <button class="ghostBtn" data-act="back" data-i="${idx}">Till Todo</button>
        <button class="dangerBtn" data-act="del" data-i="${idx}">X</button>
      </div>
    `;
    doneList.appendChild(el);
  });
}

todoList.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const i = Number(btn.dataset.i);
  const act = btn.dataset.act;

  if (act === "del") {
    todo.splice(i, 1);
  } else if (act === "done") {
    const item = todo.splice(i, 1)[0];
    done.unshift(item);
    saveList(LS.done, done);
  } else if (act === "prio") {
    const item = todo[i];
    if (item) prio.unshift(item);
    saveList(LS.prio, prio);
    renderPrio();
  }

  saveList(LS.todo, todo);
  renderTodo();
});

ideasList.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const i = Number(btn.dataset.i);
  const act = btn.dataset.act;

  if (act === "del") {
    ideas.splice(i, 1);
  } else if (act === "todo") {
    const item = ideas.splice(i, 1)[0];
    todo.unshift(item);
    saveList(LS.todo, todo);
    renderTodo();
  }

  saveList(LS.ideas, ideas);
  renderIdeas();
});

doneList.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const i = Number(btn.dataset.i);
  const act = btn.dataset.act;

  if (act === "del") {
    done.splice(i, 1);
  } else if (act === "back") {
    const item = done.splice(i, 1)[0];
    todo.unshift(item);
    saveList(LS.todo, todo);
    renderTodo();
  }

  saveList(LS.done, done);
  renderDone();
});

/** ====== WEATHER (Open-Meteo) ====== **/
const weatherCard = $("weatherCard");
const weatherHours = $("weatherHours");
const wWind = $("wWind");
const wRain = $("wRain");
$("refreshWeather").addEventListener("click", loadWeather);

let weatherLoading = false;

async function loadWeather() {
  if (weatherLoading) return;
  weatherLoading = true;

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${WEATHER_LAT}&longitude=${WEATHER_LON}` +
      `&hourly=temperature_2m,precipitation,weathercode,windspeed_10m` +
      `&current_weather=true&timezone=Europe%2FStockholm`;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Weather fetch failed");
    const data = await res.json();

    const cw = data.current_weather;
    const temp = cw?.temperature;
    const wind = cw?.windspeed;

    weatherCard.querySelector(".big").textContent =
      (typeof temp === "number") ? `${Math.round(temp)}°` : "—";

    weatherCard.querySelector(".muted").textContent =
      (cw?.time) ? `Senast: ${formatTime(cw.time)}` : "—";

    wWind.textContent = (typeof wind === "number") ? `${Math.round(wind)} m/s` : "—";

    // show next 8 hours
    const hours = data.hourly?.time || [];
    const temps = data.hourly?.temperature_2m || [];
    const rains = data.hourly?.precipitation || [];
    const winds = data.hourly?.windspeed_10m || [];

    const nowIso = cw?.time;
    let startIndex = 0;
    if (nowIso && hours.length) {
      const idx = hours.indexOf(nowIso);
      startIndex = idx >= 0 ? idx : 0;
    }

    const items = [];
    let totalRain = 0;

    for (let i = startIndex; i < Math.min(startIndex + 8, hours.length); i++) {
      totalRain += Number(rains[i] || 0);
      items.push({
        t: formatHour(hours[i]),
        temp: Math.round(temps[i]),
        rain: Number(rains[i] || 0),
        wind: Math.round(winds[i] || 0)
      });
    }

    wRain.textContent = `${totalRain.toFixed(1)} mm/8h`;

    weatherHours.innerHTML = items.map(it => `
      <div class="rowItem">
        <div class="rowLeft">
          <div class="rowText"><b>${it.t}</b> · ${it.temp}° · ${it.rain.toFixed(1)}mm · ${it.wind}m/s</div>
        </div>
      </div>
    `).join("") || `<div class="muted">Ingen data.</div>`;
  } catch (err) {
    weatherCard.querySelector(".big").textContent = "—";
    weatherCard.querySelector(".muted").textContent = "Kunde inte hämta väder.";
    weatherHours.innerHTML = `<div class="muted">Kontrollera nätverk.</div>`;
    wWind.textContent = "—";
    wRain.textContent = "—";
  } finally {
    weatherLoading = false;
  }
}

/** ====== NEWS (RSS with safe fallback) ====== **/
const newsList = $("newsList");
$("refreshNews").addEventListener("click", loadNews);

let newsLoading = false;

async function loadNews() {
  if (newsLoading) return;
  newsLoading = true;

  // Always keep UI stable
  newsList.innerHTML = `<div class="muted">Laddar…</div>`;

  try {
    // Many RSS endpoints block CORS. We try a light proxy via r.jina.ai which often works for text.
    // If it fails, we show a stable fallback list (so UI never breaks).
    const proxied = `https://r.jina.ai/http://${NEWS_RSS_URL.replace(/^https?:\/\//, "")}`;
    const res = await fetch(proxied, { cache: "no-store" });
    if (!res.ok) throw new Error("RSS blocked");
    const text = await res.text();

    // Very small/robust parse: pick first ~10 <title> excluding channel title
    const titles = extractRssTitles(text).slice(0, 10);
    if (!titles.length) throw new Error("No titles");

    newsList.innerHTML = titles.map(t => `
      <div class="rowItem">
        <div class="rowLeft">
          <div class="rowText">${escapeHtml(t)}</div>
        </div>
      </div>
    `).join("");
  } catch {
    const fallback = [
      "RSS kunde inte hämtas (CORS/proxy).",
      "Byt NEWS_RSS_URL i app.js eller använd en CORS-vänlig källa.",
      "UI hålls stabilt även när nyheter inte laddas."
    ];
    newsList.innerHTML = fallback.map(t => `
      <div class="rowItem"><div class="rowLeft"><div class="rowText">${escapeHtml(t)}</div></div></div>
    `).join("");
  } finally {
    newsLoading = false;
  }
}

/** ====== POMODORO ====== **/
const ringProgress = $("ringProgress");
const pomoTime = $("pomoTime");
const pomoMode = $("pomoMode");
const pomoHint = $("pomoHint");

const pomoStart = $("pomoStart");
const pomoPause = $("pomoPause");
const pomoReset = $("pomoReset");

const pomoWork = $("pomoWork");
const pomoShort = $("pomoShort");
const pomoLong = $("pomoLong");

const pomoNote = $("pomoNote");
const savePomoNote = $("savePomoNote");
const pomoNoteSaved = $("pomoNoteSaved");

const RADIUS = 48;
const CIRC = 2 * Math.PI * RADIUS;

ringProgress.style.strokeDasharray = `${CIRC}`;
ringProgress.style.strokeDashoffset = `0`;

let pomo = loadPomodoroState();
let pomoTimer = null;

function loadPomodoroState() {
  try {
    const raw = localStorage.getItem(LS.pomo);
    if (!raw) return defaultPomodoro();
    const s = JSON.parse(raw);
    // minimal validation
    if (!s || typeof s !== "object") return defaultPomodoro();
    return {
      mode: s.mode ?? "Work",
      totalMs: Number.isFinite(s.totalMs) ? s.totalMs : 25 * 60 * 1000,
      leftMs: Number.isFinite(s.leftMs) ? s.leftMs : 25 * 60 * 1000,
      running: !!s.running,
      endsAt: Number.isFinite(s.endsAt) ? s.endsAt : null,
      note: typeof s.note === "string" ? s.note : ""
    };
  } catch {
    return defaultPomodoro();
  }
}
function defaultPomodoro() {
  return { mode: "Work", totalMs: 25 * 60 * 1000, leftMs: 25 * 60 * 1000, running: false, endsAt: null, note: "" };
}
function savePomodoroState() {
  localStorage.setItem(LS.pomo, JSON.stringify(pomo));
}

function setPomodoroPreset(minutes, modeLabel) {
  stopPomodoroTick();
  pomo.mode = modeLabel;
  pomo.totalMs = minutes * 60 * 1000;
  pomo.leftMs = pomo.totalMs;
  pomo.running = false;
  pomo.endsAt = null;
  savePomodoroState();
  renderPomodoro();
}

pomoWork.addEventListener("click", () => setPomodoroPreset(25, "Work"));
pomoShort.addEventListener("click", () => setPomodoroPreset(5, "Short break"));
pomoLong.addEventListener("click", () => setPomodoroPreset(15, "Long break"));

pomoStart.addEventListener("click", () => {
  if (pomo.running) return;
  pomo.running = true;
  pomo.endsAt = Date.now() + pomo.leftMs;
  savePomodoroState();
  startPomodoroTick();
  renderPomodoro();
});

pomoPause.addEventListener("click", () => {
  if (!pomo.running) return;
  // capture remaining precisely
  pomo.leftMs = Math.max(0, pomo.endsAt - Date.now());
  pomo.running = false;
  pomo.endsAt = null;
  savePomodoroState();
  stopPomodoroTick();
  renderPomodoro();
});

pomoReset.addEventListener("click", () => {
  stopPomodoroTick();
  pomo.leftMs = pomo.totalMs;
  pomo.running = false;
  pomo.endsAt = null;
  savePomodoroState();
  renderPomodoro();
});

savePomoNote.addEventListener("click", () => {
  pomo.note = pomoNote.value || "";
  savePomodoroState();
  renderPomodoroNoteState(true);
});

function startPomodoroTick() {
  stopPomodoroTick();
  // tick fast but cheap; UI uses simple math
  pomoTimer = setInterval(() => {
    if (!pomo.running || !pomo.endsAt) return;
    const left = pomo.endsAt - Date.now();
    pomo.leftMs = Math.max(0, left);

    if (pomo.leftMs <= 0) {
      pomo.running = false;
      pomo.endsAt = null;
      savePomodoroState();
      stopPomodoroTick();
      pomoHint.textContent = "Klart! Reset eller välj ny preset.";
    } else {
      // keep hint stable
      pomoHint.textContent = "SVG-ringen töms när tiden går.";
    }

    renderPomodoro(false);
  }, 250);
}

function stopPomodoroTick() {
  if (pomoTimer) clearInterval(pomoTimer);
  pomoTimer = null;
}

function renderPomodoro(updateHint = true) {
  const left = pomo.running && pomo.endsAt ? Math.max(0, pomo.endsAt - Date.now()) : pomo.leftMs;
  const ratio = pomo.totalMs > 0 ? Math.max(0, Math.min(1, left / pomo.totalMs)) : 0;

  // Ring drains: 100% -> 0% means dashoffset goes from 0 -> CIRC
  const offset = CIRC * (1 - ratio);
  ringProgress.style.strokeDashoffset = `${offset}`;

  pomoTime.textContent = formatMMSS(left);
  pomoMode.textContent = pomo.mode;

  if (updateHint) {
    if (pomo.running) {
      pomoHint.textContent = "Kör…";
    } else {
      pomoHint.textContent = "Pausad / redo.";
    }
  }
  renderPomodoroNoteState(false);
}

function renderPomodoroNoteState(showSaved) {
  pomoNote.value = pomo.note || "";
  const when = new Date().toLocaleString("sv-SE");
  pomoNoteSaved.textContent = showSaved ? `Sparat ${when}` : (pomo.note ? `Anteckning finns sparad.` : "—");
}

function resumePomodoroIfRunning() {
  if (pomo.running && pomo.endsAt) {
    // If page was closed and time passed
    const left = pomo.endsAt - Date.now();
    pomo.leftMs = Math.max(0, left);
    if (pomo.leftMs <= 0) {
      pomo.running = false;
      pomo.endsAt = null;
      savePomodoroState();
      renderPomodoro();
      return;
    }
    startPomodoroTick();
  }
  renderPomodoro();
}
resumePomodoroIfRunning();

/** ====== INIT RENDERS ====== **/
renderTodo();
renderIdeas();
renderDone();
renderPrio();

/** ====== HELPERS ====== **/
function formatMMSS(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
function formatTime(iso) {
  // iso: "2026-02-16T12:30"
  try {
    const d = new Date(iso);
    return d.toLocaleString("sv-SE", { hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}
function formatHour(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("sv-SE", { hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  }[c]));
}

// Minimal RSS title extractor (robust enough for jina-proxy text)
function extractRssTitles(xmlText) {
  const titles = [];
  const re = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/gi;
  let m;
  while ((m = re.exec(xmlText))) {
    const t = (m[1] || m[2] || "").trim();
    if (!t) continue;
    titles.push(t);
  }
  // usually first title is channel name -> drop it
  return titles.slice(1);
}

/** ====== STARTUP LAZY LOADS ====== **/
loadWeather();
loadNews();
