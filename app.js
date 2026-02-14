/* =========
   SB Dash v1 (single file)
   - Views carousel: weather/news/todo/ideas/done
   - Todo + Ideas + Done saved in localStorage
   - Aktiv prio (superprio) on the right (stored + moves from todo)
   - News RSS
   - FIXED DIAL bottom-right + touch-safe (no page scroll)
   ========= */

function setDates() {
  const now = new Date();
  const weekday = now.toLocaleDateString("sv-SE", { weekday: "long" });
  const date = now.toLocaleDateString("sv-SE", { day: "2-digit", month: "long", year: "numeric" });
  const pretty = `${weekday} ${date}`;

  const todayText = document.getElementById("todayText");
  const dialDate = document.getElementById("dialDate");
  if (todayText) todayText.textContent = pretty;
  if (dialDate) dialDate.textContent = pretty;
}
setDates();

/* ---------------- Views ---------------- */
let VIEWS = ["weather", "news", "todo", "ideas", "done"];
let currentIndex = 0;

const track = document.getElementById("viewTrack");
const nav = document.getElementById("underNav");
const dialIcon = document.querySelector(".dialIcon");

const ICONS = {
  weather: "assets/ui/icon-weather.svg",
  news: "assets/ui/icon-news.svg",
  todo: "assets/ui/icon-todo.svg",
  ideas: "assets/ui/icon-ideas.svg",
  done: "assets/ui/icon-done.svg",
};

function setViewByIndex(idx) {
  currentIndex = (idx + VIEWS.length) % VIEWS.length;
  const view = VIEWS[currentIndex];

  if (track) track.style.transform = `translateX(-${currentIndex * 100}%)`;

  if (nav) {
    [...nav.querySelectorAll(".navBtn")].forEach(btn => {
      btn.classList.toggle("active", btn.dataset.view === view);
    });
  }

  if (dialIcon && ICONS[view]) dialIcon.src = ICONS[view];
}

function setViewByName(view) {
  const idx = VIEWS.indexOf(view);
  if (idx !== -1) setViewByIndex(idx);
}

/* Buttons under main */
if (nav) {
  nav.addEventListener("click", (e) => {
    const btn = e.target.closest(".navBtn");
    if (!btn) return;
    setViewByName(btn.dataset.view);
  });
}

/* Mouse wheel over main panel (desktop) */
const mainPanel = document.querySelector(".mainPanel");
let wheelCooldown = false;

if (mainPanel) {
  mainPanel.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (wheelCooldown) return;
    wheelCooldown = true;

    const dir = e.deltaY > 0 ? 1 : -1;
    setViewByIndex(currentIndex + dir);

    setTimeout(() => (wheelCooldown = false), 350);
  }, { passive: false });
}

/* ---------------- Storage ---------------- */
const LS_KEY = "sbdash_v1";
const store = loadStore();

function loadStore() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { todo: [], done: [], ideas: [], super: [] };
    const parsed = JSON.parse(raw);
    return {
      todo: Array.isArray(parsed.todo) ? parsed.todo : [],
      done: Array.isArray(parsed.done) ? parsed.done : [],
      ideas: Array.isArray(parsed.ideas) ? parsed.ideas : [],
      super: Array.isArray(parsed.super) ? parsed.super : [],
    };
  } catch {
    return { todo: [], done: [], ideas: [], super: [] };
  }
}

function saveStore() {
  localStorage.setItem(LS_KEY, JSON.stringify(store));
}

function uid() {
  return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
}

function fmt(ts) {
  try {
    return new Date(ts).toLocaleString("sv-SE", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
    });
  } catch { return ""; }
}

/* ---------------- Todo / Done ---------------- */
const todoInput = document.getElementById("todoInput");
const todoAddBtn = document.getElementById("todoAddBtn");
const todoList = document.getElementById("todoList");

const doneList = document.getElementById("doneList");
const doneClearBtn = document.getElementById("doneClearBtn");

function addTodo(text) {
  const t = text.trim();
  if (!t) return;
  store.todo.unshift({ id: uid(), text: t, createdAt: Date.now() });
  saveStore();
  renderTodo();
}

function completeTodo(id) {
  const idx = store.todo.findIndex(x => x.id === id);
  if (idx === -1) return;
  const item = store.todo.splice(idx, 1)[0];
  store.done.unshift({ ...item, doneAt: Date.now() });
  saveStore();
  renderTodo();
  renderDone();
}

function restoreDone(id) {
  const idx = store.done.findIndex(x => x.id === id);
  if (idx === -1) return;
  const item = store.done.splice(idx, 1)[0];
  const { doneAt, ...rest } = item;
  store.todo.unshift(rest);
  saveStore();
  renderTodo();
  renderDone();
}

function removeFrom(listName, id) {
  store[listName] = store[listName].filter(x => x.id !== id);
  saveStore();
  renderTodo();
  renderDone();
  renderIdeas();
  renderPrio();
}

function promoteTodoToPrio(id) {
  const idx = store.todo.findIndex(x => x.id === id);
  if (idx === -1) return;
  const item = store.todo.splice(idx, 1)[0];
  store.super.unshift({ id: item.id, text: item.text, createdAt: item.createdAt });
  saveStore();
  renderTodo();
  renderPrio();
}

function renderTodo() {
  if (!todoList) return;
  todoList.innerHTML = "";

  if (store.todo.length === 0) {
    todoList.innerHTML = `<li class="miniHint">Inga uppgifter just nu.</li>`;
    return;
  }

  for (const item of store.todo) {
    const li = document.createElement("li");
    li.className = "miniRow";

    const left = document.createElement("div");
    left.className = "miniRowLeft";

    const doneBtn = document.createElement("button");
    doneBtn.className = "miniIconBtn";
    doneBtn.textContent = "✓";
    doneBtn.title = "Markera som slutförd";
    doneBtn.addEventListener("click", () => completeTodo(item.id));

    const fireBtn = document.createElement("button");
    fireBtn.className = "miniIconBtn";
    fireBtn.textContent = "🔥";
    fireBtn.title = "Flytta till Aktiv prio";
    fireBtn.addEventListener("click", () => promoteTodoToPrio(item.id));

    const txt = document.createElement("div");
    txt.className = "miniText";
    txt.textContent = item.text;

    left.appendChild(doneBtn);
    left.appendChild(fireBtn);
    left.appendChild(txt);

    const right = document.createElement("div");
    right.style.display = "flex";
    right.style.alignItems = "center";
    right.style.gap = "10px";

    const meta = document.createElement("div");
    meta.className = "miniMeta";
    meta.textContent = fmt(item.createdAt);

    const del = document.createElement("button");
    del.className = "miniIconBtn";
    del.textContent = "🗑️";
    del.title = "Ta bort";
    del.addEventListener("click", () => removeFrom("todo", item.id));

    right.appendChild(meta);
    right.appendChild(del);

    li.appendChild(left);
    li.appendChild(right);
    todoList.appendChild(li);
  }
}

function renderDone() {
  if (!doneList) return;
  doneList.innerHTML = "";

  if (store.done.length === 0) {
    doneList.innerHTML = `<li class="miniHint">Inget slutfört ännu.</li>`;
    return;
  }

  for (const item of store.done) {
    const li = document.createElement("li");
    li.className = "miniRow";

    const left = document.createElement("div");
    left.className = "miniRowLeft";

    const backBtn = document.createElement("button");
    backBtn.className = "miniIconBtn";
    backBtn.textContent = "↩︎";
    backBtn.title = "Flytta tillbaka till Att göra";
    backBtn.addEventListener("click", () => restoreDone(item.id));

    const txt = document.createElement("div");
    txt.className = "miniText";
    txt.textContent = item.text;

    left.appendChild(backBtn);
    left.appendChild(txt);

    const right = document.createElement("div");
    right.style.display = "flex";
    right.style.alignItems = "center";
    right.style.gap = "10px";

    const meta = document.createElement("div");
    meta.className = "miniMeta";
    meta.textContent = fmt(item.doneAt);

    const del = document.createElement("button");
    del.className = "miniIconBtn";
    del.textContent = "🗑️";
    del.title = "Ta bort";
    del.addEventListener("click", () => removeFrom("done", item.id));

    right.appendChild(meta);
    right.appendChild(del);

    li.appendChild(left);
    li.appendChild(right);
    doneList.appendChild(li);
  }
}

if (todoAddBtn && todoInput) {
  todoAddBtn.addEventListener("click", () => {
    addTodo(todoInput.value);
    todoInput.value = "";
    todoInput.focus();
  });
  todoInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      addTodo(todoInput.value);
      todoInput.value = "";
    }
  });
}

if (doneClearBtn) {
  doneClearBtn.addEventListener("click", () => {
    store.done = [];
    saveStore();
    renderDone();
  });
}

/* ---------------- Ideas ---------------- */
const ideaInput = document.getElementById("ideaInput");
const ideaAddBtn = document.getElementById("ideaAddBtn");
const ideasList = document.getElementById("ideasList");

function addIdea(text) {
  const t = text.trim();
  if (!t) return;
  store.ideas.unshift({ id: uid(), text: t, createdAt: Date.now() });
  saveStore();
  renderIdeas();
}

function renderIdeas() {
  if (!ideasList) return;
  ideasList.innerHTML = "";

  if (store.ideas.length === 0) {
    ideasList.innerHTML = `<li class="miniHint">Inga idéer sparade ännu.</li>`;
    return;
  }

  for (const item of store.ideas) {
    const li = document.createElement("li");
    li.className = "miniRow";

    const left = document.createElement("div");
    left.className = "miniRowLeft";

    const txt = document.createElement("div");
    txt.className = "miniText";
    txt.textContent = item.text;

    left.appendChild(txt);

    const right = document.createElement("div");
    right.style.display = "flex";
    right.style.alignItems = "center";
    right.style.gap = "10px";

    const meta = document.createElement("div");
    meta.className = "miniMeta";
    meta.textContent = fmt(item.createdAt);

    const del = document.createElement("button");
    del.className = "miniIconBtn";
    del.textContent = "🗑️";
    del.title = "Ta bort";
    del.addEventListener("click", () => removeFrom("ideas", item.id));

    right.appendChild(meta);
    right.appendChild(del);

    li.appendChild(left);
    li.appendChild(right);
    ideasList.appendChild(li);
  }
}

if (ideaAddBtn && ideaInput) {
  ideaAddBtn.addEventListener("click", () => {
    addIdea(ideaInput.value);
    ideaInput.value = "";
    ideaInput.focus();
  });
  ideaInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      addIdea(ideaInput.value);
      ideaInput.value = "";
    }
  });
}

/* ---------------- Aktiv prio ---------------- */
const prioInput = document.getElementById("prioInput");
const prioAddBtn = document.getElementById("prioAddBtn");
const prioList = document.getElementById("prioList");
const prioCount = document.getElementById("prioCount");

function addPrio(text) {
  const t = text.trim();
  if (!t) return;
  store.super.unshift({ id: uid(), text: t, createdAt: Date.now() });
  saveStore();
  renderPrio();
}

function completePrio(id) {
  const idx = store.super.findIndex(x => x.id === id);
  if (idx === -1) return;
  const item = store.super.splice(idx, 1)[0];
  store.done.unshift({ ...item, doneAt: Date.now() });
  saveStore();
  renderPrio();
  renderDone();
}

function renderPrio() {
  if (prioCount) prioCount.textContent = String(store.super.length);
  if (!prioList) return;

  prioList.innerHTML = "";

  if (store.super.length === 0) {
    prioList.innerHTML = `<li class="miniHint">Inget i Aktiv prio just nu.</li>`;
    return;
  }

  for (const item of store.super) {
    const li = document.createElement("li");
    li.className = "miniRow";

    const left = document.createElement("div");
    left.className = "miniRowLeft";

    const doneBtn = document.createElement("button");
    doneBtn.className = "miniIconBtn";
    doneBtn.textContent = "✓";
    doneBtn.title = "Klarmarkera (flyttar till Slutförda)";
    doneBtn.addEventListener("click", () => completePrio(item.id));

    const txt = document.createElement("div");
    txt.className = "miniText";
    txt.textContent = item.text;

    left.appendChild(doneBtn);
    left.appendChild(txt);

    const right = document.createElement("div");
    right.style.display = "flex";
    right.style.alignItems = "center";
    right.style.gap = "10px";

    const meta = document.createElement("div");
    meta.className = "miniMeta";
    meta.textContent = fmt(item.createdAt);

    const del = document.createElement("button");
    del.className = "miniIconBtn";
    del.textContent = "🗑️";
    del.title = "Ta bort";
    del.addEventListener("click", () => removeFrom("super", item.id));

    right.appendChild(meta);
    right.appendChild(del);

    li.appendChild(left);
    li.appendChild(right);
    prioList.appendChild(li);
  }
}

if (prioAddBtn && prioInput) {
  prioAddBtn.addEventListener("click", () => {
    addPrio(prioInput.value);
    prioInput.value = "";
    prioInput.focus();
  });
  prioInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      addPrio(prioInput.value);
      prioInput.value = "";
    }
  });
}

/* ---------------- News (RSS) ---------------- */
const RSS_URL = "https://news.google.com/rss?hl=sv&gl=SE&ceid=SE:sv";
const RSS_PROXY = (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
const NEWS_MAX = 10;

const newsListEl = document.getElementById("newsList");
const newsMetaEl = document.getElementById("newsMeta");
const newsRefreshBtn = document.getElementById("newsRefreshBtn");

async function loadNews() {
  if (!newsListEl || !newsMetaEl) return;

  newsMetaEl.textContent = "Laddar senaste…";
  newsListEl.innerHTML = "";

  try {
    const xmlText = await fetch(RSS_PROXY(RSS_URL), { cache: "no-store" }).then(r => {
      if (!r.ok) throw new Error("RSS fetch failed");
      return r.text();
    });

    const doc = new DOMParser().parseFromString(xmlText, "text/xml");
    const items = Array.from(doc.querySelectorAll("item")).slice(0, NEWS_MAX);

    if (items.length === 0) {
      newsMetaEl.textContent = "Kunde inte läsa nyheter just nu.";
      newsListEl.innerHTML = `<li class="miniHint">Tomt flöde.</li>`;
      return;
    }

    newsMetaEl.textContent = `Uppdaterad: ${new Date().toLocaleString("sv-SE")}`;

    for (const it of items) {
      const title = it.querySelector("title")?.textContent?.trim() || "Nyhet";
      const link = it.querySelector("link")?.textContent?.trim() || "#";
      const pubDateRaw = it.querySelector("pubDate")?.textContent?.trim() || "";
      const pubDate = pubDateRaw ? new Date(pubDateRaw) : null;

      const li = document.createElement("li");
      li.className = "miniRow";

      const left = document.createElement("div");
      left.className = "miniRowLeft";

      const a = document.createElement("a");
      a.href = link;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = title;
      a.style.color = "var(--text)";
      a.style.textDecoration = "none";
      a.style.fontWeight = "900";

      a.addEventListener("mouseenter", () => (a.style.textDecoration = "underline"));
      a.addEventListener("mouseleave", () => (a.style.textDecoration = "none"));

      left.appendChild(a);

      const right = document.createElement("div");
      right.style.display = "flex";
      right.style.alignItems = "center";
      right.style.gap = "10px";

      const meta = document.createElement("div");
      meta.className = "miniMeta";
      meta.textContent = pubDate && !isNaN(pubDate.getTime())
        ? pubDate.toLocaleString("sv-SE", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })
        : "";

      right.appendChild(meta);

      li.appendChild(left);
      li.appendChild(right);
      newsListEl.appendChild(li);
    }
  } catch {
    newsMetaEl.textContent = "Nyheter kunde inte laddas. (RSS/proxy kan vara nere)";
    newsListEl.innerHTML = `<li class="miniHint">Testa igen om en stund.</li>`;
  }
}

if (newsRefreshBtn) newsRefreshBtn.addEventListener("click", loadNews);
loadNews();
setInterval(loadNews, 10 * 60 * 1000);

/* ---------------- Dial (FIXED, touch-safe) ---------------- */
const dialEl = document.querySelector(".dial");
const dialRing = document.querySelector(".dialRing");

let isDragging = false;
let startAngle = 0;
let currentRotation = 0;

const STEP = 360 / VIEWS.length;

function getAngle(cx, cy, mx, my) {
  return Math.atan2(my - cy, mx - cx) * (180 / Math.PI);
}

function setRotation(deg) {
  currentRotation = deg;
  if (dialRing) dialRing.style.transform = `rotate(${deg}deg)`;
}

function syncRotationToIndex() {
  setRotation(currentIndex * STEP);
}

/* keep dial in sync for buttons/scroll */
const originalSetView = setViewByIndex;
setViewByIndex = function(idx){
  originalSetView(idx);
  syncRotationToIndex();
};

function onPointerDown(e){
  if (!dialEl) return;
  isDragging = true;
  dialEl.setPointerCapture?.(e.pointerId);
  e.preventDefault();

  const rect = dialEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  startAngle = getAngle(cx, cy, e.clientX, e.clientY) - currentRotation;
}

function onPointerMove(e){
  if (!isDragging) return;
  e.preventDefault();

  const rect = dialEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  const angle = getAngle(cx, cy, e.clientX, e.clientY);
  setRotation(angle - startAngle);
}

function onPointerUp(e){
  if (!isDragging) return;
  isDragging = false;
  e.preventDefault();

  const snapped = Math.round(currentRotation / STEP);
  const finalIndex = ((snapped % VIEWS.length) + VIEWS.length) % VIEWS.length;

  originalSetView(finalIndex);
  syncRotationToIndex();
}

if (dialEl) {
  dialEl.addEventListener("pointerdown", onPointerDown, { passive:false });
  window.addEventListener("pointermove", onPointerMove, { passive:false });
  window.addEventListener("pointerup", onPointerUp, { passive:false });
  window.addEventListener("pointercancel", onPointerUp, { passive:false });
}

/* Init */
renderTodo();
renderDone();
renderIdeas();
renderPrio();
setViewByIndex(0);
syncRotationToIndex();
