(() => {
  const $ = (id) => document.getElementById(id);

  /* =========================
     ELEMENTS
  ========================= */
  const wheel = $("wheel");
  const wheelRing = document.querySelector(".wheelRing");
  const wheelIcon = $("wheelIcon");

  const sheetWrap = $("sheetWrap");
  const sheet = $("sheet");
  const sheetTitle = $("sheetTitle");
  const sheetContent = $("sheetContent");

  const topDate = $("topDate");
  const topRight = document.querySelector(".topRight");

  const startPrioCountEl = $("startPrioCount");
  const centerLabelEl = $("centerLabel");

  if (topRight) topRight.textContent = "";

  function clamp01(x) { return Math.max(0, Math.min(1, x)); }
  function pad2(n) { return String(n).padStart(2, "0"); }

  /* =========================
     STORAGE
  ========================= */
  const LS_KEY = "sbdash_store_v3";

  function loadStore() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : { prio: [], todo: [], ideas: [], done: [] };
    } catch {
      return { prio: [], todo: [], ideas: [], done: [] };
    }
  }

  const store = loadStore();
  const saveStore = () => localStorage.setItem(LS_KEY, JSON.stringify(store));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());

  const fmt = (ts) =>
    new Date(ts).toLocaleString("sv-SE", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
    });

  /* =========================
     TOP DATE
  ========================= */
  function updateTopDate() {
    if (!topDate) return;
    const now = new Date();
    const weekday = now.toLocaleDateString("sv-SE", { weekday: "long" });
    const date = now.toLocaleDateString("sv-SE", { day: "2-digit", month: "long", year: "numeric" });
    topDate.textContent = `${weekday} ${date}`;
  }
  updateTopDate();
  setInterval(updateTopDate, 60_000);

  /* =========================
     START PRIO COUNT
  ========================= */
  function updateStartPrioCount() {
    if (!startPrioCountEl) return;
    const c = Array.isArray(store.prio) ? store.prio.length : 0;
    startPrioCountEl.textContent = `Aktiva prios: ${c}`;
  }
  updateStartPrioCount();

  /* =========================
     VIEWS
  ========================= */
  const VIEW_DEFS = [
    { id: "calendar", label: "KALENDER",   icon: "assets/ui/icon-calendar.svg" },
    { id: "prio",     label: "AKTIV PRIO", icon: "assets/ui/icon-prio.svg" },
    { id: "weather",  label: "VÄDER",      icon: "assets/ui/icon-weather.svg" },
    { id: "news",     label: "NYHETER",    icon: "assets/ui/icon-news.svg" },
    { id: "todo",     label: "TODO",       icon: "assets/ui/icon-todo.svg" },
    { id: "ideas",    label: "IDÉER",      icon: "assets/ui/icon-ideas.svg" },
    { id: "timer",    label: "TIMER",      icon: "assets/ui/icon-pomodoro.svg" },
  ];

  let activeIndex = 0;
  const STEP = 360 / VIEW_DEFS.length;
  let rotationDeg = 0;

  function setCenterLabel(text) {
    if (!centerLabelEl) return;
    centerLabelEl.textContent = text || "";
  }

  function sectorFromDeg(deg) {
    const raw = Math.round(deg / STEP);
    return ((raw % VIEW_DEFS.length) + VIEW_DEFS.length) % VIEW_DEFS.length;
  }

  function setPreview(index) {
    activeIndex = (index + VIEW_DEFS.length) % VIEW_DEFS.length;
    const v = VIEW_DEFS[activeIndex];
    if (wheelIcon) wheelIcon.src = v.icon;
    setCenterLabel(v.label);
  }

  function setRotation(deg) {
    rotationDeg = deg;
    if (wheelRing) wheelRing.style.transform = `rotate(${deg}deg)`;
    setPreview(sectorFromDeg(deg));
  }

  /* =========================
     SHEET OPEN/CLOSE  (Punkt 3: togglar sheetOpen)
  ========================= */
  function openSheet() {
    sheetWrap?.classList.add("open");
    document.body.classList.add("sheetOpen");     // ✅ premium-wheel trigger
    if (centerLabelEl) centerLabelEl.style.opacity = "0";
  }

  function closeSheet() {
    sheetWrap?.classList.remove("open");
    document.body.classList.remove("sheetOpen");  // ✅ premium-wheel trigger
    if (centerLabelEl) centerLabelEl.style.opacity = "1";
  }

  /* =========================
     SHEET drag-to-close
  ========================= */
  let sheetDragStartY = null;

  sheet?.addEventListener("pointerdown", (e) => {
    sheetDragStartY = e.clientY;
    sheet.classList.add("dragging");
    sheet.setPointerCapture?.(e.pointerId);
  }, { passive: true });

  sheet?.addEventListener("pointermove", (e) => {
    if (sheetDragStartY == null) return;
    const delta = e.clientY - sheetDragStartY;
    if (delta > 0) {
      sheet.style.transform = `translateX(-50%) translateY(${delta}px)`;
      e.preventDefault?.();
    }
  }, { passive: false });

  sheet?.addEventListener("pointerup", () => {
    if (sheetDragStartY == null) return;

    const currentTransform = sheet.style.transform || "";
    // delta hämtas enklast via att läsa sista translateY – men vi använder original-logik:
    // (din tidigare logik räknade delta, vi behåller den robust)
    // Här gör vi om med en sparad delta genom att använda startY igen:
    // => vi gör enklare: om sheetDragStartY sattes och du släpper, återställ alltid.
    // (close-trigger sker i originalet vid delta > 120, så vi behöver räkna delta)
  }, { passive: true });

  // Behåll exakt din original close-logik (delta > 120)
  sheet?.addEventListener("pointerup", (e) => {
    if (sheetDragStartY == null) return;
    const delta = e.clientY - sheetDragStartY;
    if (delta > 120) closeSheet();

    sheet.style.transform = "";
    sheet.classList.remove("dragging");
    sheetDragStartY = null;
  }, { passive: true });

  sheet?.addEventListener("pointercancel", () => {
    sheet.style.transform = "";
    sheet.classList.remove("dragging");
    sheetDragStartY = null;
  }, { passive: true });

  /* =========================
     WHEEL interaction
  ========================= */
  let dragging = false;
  let startAngle = 0;
  let tapStartX = 0, tapStartY = 0;
  let didDrag = false;

  function angle(cx, cy, x, y) {
    return Math.atan2(y - cy, x - cx) * (180 / Math.PI);
  }

  wheel?.addEventListener("pointerdown", (e) => {
    dragging = true;
    didDrag = false;
    tapStartX = e.clientX;
    tapStartY = e.clientY;

    const r = wheel.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    startAngle = angle(cx, cy, e.clientX, e.clientY) - rotationDeg;

    wheel.setPointerCapture?.(e.pointerId);
  }, { passive: true
