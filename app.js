/* =========================
   SB Dash – app.js (FULL)
   - Wheel ring + center text (NO wheel icon)
   - Start icon swaps while rotating
   - News: Google News RSS via cache-bust + proxy fallback + stale-filter + local cache
   - Weather (Open-Meteo)
   - Timer ring on wheel (countdown direction correct)
   ========================= */

(() => {
  const $ = (id) => document.getElementById(id);

  /* =========================
     ELEMENTS
  ========================= */
  const wheel = $("wheel");
  const wheelRing = document.querySelector(".wheelRing");
  const wheelCenterText = $("wheelCenterText");

  const sheetWrap = $("sheetWrap");
  const sheet = $("sheet");
  const sheetTitle = $("sheetTitle");
  const sheetContent = $("sheetContent");

  const topDate = $("topDate");
  const startPrioCountEl = $("startPrioCount");
  const startIconEl = $("startIcon");

  // Preview (behind wheel)
  const previewTitle = $("previewTitle");
  const previewBody = $("previewBody");

  function clamp01(x){ return Math.max(0, Math.min(1, x)); }
  function pad2(n){ return String(n).padStart(2, "0"); }

  /* =========================
     STORAGE (prio count only here)
  ========================= */
  const LS_KEY = "sbdash_store_v4";
  function loadStore(){
    try{
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : { prio:[], lists:[], ideas:[], done:[] };
    }catch{
      return { prio:[], lists:[], ideas:[], done:[] };
    }
  }
  const store = loadStore();

  function updateStartPrioCount(){
    if(!startPrioCountEl) return;
    const c = Array.isArray(store.prio) ? store.prio.length : 0;
    startPrioCountEl.textContent = `Aktiva prios: ${c}`;
  }
  updateStartPrioCount();

  /* =========================
     DATE
  ========================= */
  function updateTopDate(){
    if(!topDate) return;
    const now = new Date();
    const weekday = now.toLocaleDateString("sv-SE", { weekday:"long" });
    const date = now.toLocaleDateString("sv-SE", { day:"2-digit", month:"long", year:"numeric" });
    topDate.textContent = `${weekday} ${date}`;
  }
  updateTopDate();
  setInterval(updateTopDate, 60_000);

  /* =========================
     VIEWS
  ========================= */
  const VIEW_DEFS = [
    { id:"calendar", label:"KALENDER", icon:"assets/ui/icon-calendar.svg" },
    { id:"weather",  label:"VÄDER",    icon:"assets/ui/icon-weather.svg" },
    { id:"news",     label:"NYHETER",  icon:"assets/ui/icon-news.svg" },
    { id:"timer",    label:"TIMER",    icon:"assets/ui/icon-pomodoro.svg" },
  ];

  let activeIndex = 0;
  const STEP = 360 / VIEW_DEFS.length;
  let rotationDeg = 0;

  function sectorFromDeg(deg){
    const raw = Math.round(deg / STEP);
    return ((raw % VIEW_DEFS.length) + VIEW_DEFS.length) % VIEW_DEFS.length;
  }

  function setWheelText(txt){
    if(wheelCenterText) wheelCenterText.textContent = txt || "—";
  }

  function setStartIcon(src){
    if(startIconEl && src) startIconEl.src = src;
  }

  /* =========================
     PREVIEW
  ========================= */
  let lastWeather = null;
  let lastNews = [];

  function renderPreview(viewId){
    const v = VIEW_DEFS.find(x => x.id === viewId);
    if(previewTitle) previewTitle.textContent = v ? v.label : "Preview";

    if(!previewBody) return;

    if(viewId === "calendar"){
      previewBody.innerHTML = `<div class="miniHint">Tryck på hjulet för att öppna kalendern.</div>`;
      return;
    }

    if(viewId === "weather"){
      if(lastWeather?.current){
        const t = Math.round(lastWeather.current.temperature_2m);
        const w = Math.round(lastWeather.current.wind_speed_10m);
        previewBody.innerHTML = `
          <div style="display:flex;justify-content:space-between;gap:10px;font-weight:900;">
            <div>${t}°</div><div>${w} m/s</div>
          </div>
          <div class="miniHint" style="margin-top:8px;">Tryck för prognos</div>
        `;
      } else {
        previewBody.innerHTML = `<div class="miniHint">Tryck för att ladda väder.</div>`;
      }
      return;
    }

    if(viewId === "news"){
      if(lastNews.length){
        previewBody.innerHTML =
          lastNews.slice(0,3).map(n => `<div style="margin-top:8px;font-weight:900;line-height:1.15;">• ${n.title}</div>`).join("") +
          `<div class="miniHint" style="margin-top:10px;">Tryck för fler</div>`;
      } else {
        previewBody.innerHTML = `<div class="miniHint">Tryck för att ladda nyheter.</div>`;
      }
      return;
    }

    if(viewId === "timer"){
      previewBody.innerHTML = `
        <div style="font-weight:900;">${timerText()}</div>
        <div class="miniHint" style="margin-top:8px;">Tryck för 1/5/10/15/30</div>
      `;
      return;
    }
  }

  function applyActiveView(idx){
    activeIndex = (idx + VIEW_DEFS.length) % VIEW_DEFS.length;
    const v = VIEW_DEFS[activeIndex];

    setWheelText(v.label);
    setStartIcon(v.icon);
    renderPreview(v.id);
  }

  function setRotation(deg){
    rotationDeg = deg;
    if(wheelRing) wheelRing.style.transform = `rotate(${deg}deg)`;

    const idx = sectorFromDeg(deg);
    applyActiveView(idx);

    // live update inside sheet if open (light throttle)
    if(sheetWrap?.classList.contains("open")){
      clearTimeout(setRotation._t);
      setRotation._t = setTimeout(() => renderView(VIEW_DEFS[idx].id), 90);
    }
  }

  /* =========================
     SHEET OPEN/CLOSE
  ========================= */
  function openSheet(){
    sheetWrap?.classList.add("open");
    if(wheelCenterText) wheelCenterText.style.opacity = "0";
  }
  function closeSheet(){
    sheetWrap?.classList.remove("open");
    if(wheelCenterText) wheelCenterText.style.opacity = "1";
  }

  // click outside to close
  sheetWrap?.addEventListener("click", (e) => {
    if(e.target === sheetWrap) closeSheet();
  });

  // drag-to-close
  let sheetDragStartY = null;
  sheet?.addEventListener("pointerdown", (e) => {
    sheetDragStartY = e.clientY;
    sheet.setPointerCapture?.(e.pointerId);
  }, { passive:true });

  sheet?.addEventListener("pointermove", (e) => {
    if(sheetDragStartY == null) return;
    const delta = e.clientY - sheetDragStartY;
    if(delta > 0){
      sheet.style.transform = `translateX(-50%) translateY(${delta}px)`;
      e.preventDefault();
    }
  }, { passive:false });

  sheet?.addEventListener("pointerup", () => {
    if(sheetDragStartY == null) return;
    const delta = parseFloat((sheet.style.transform.match(/translateY\(([-\d.]+)px\)/)||[])[1] || "0");
    if(delta > 120) closeSheet();
    sheet.style.transform = "";
    sheetDragStartY = null;
  }, { passive:true });

  sheet?.addEventListener("pointercancel", () => {
    sheet.style.transform = "";
    sheetDragStartY = null;
  }, { passive:true });

  /* =========================
     WHEEL interaction
  ========================= */
  let dragging = false;
  let startAngle = 0;
  let tapStartX = 0, tapStartY = 0;
  let didDrag = false;

  function angle(cx, cy, x, y){
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
  }, { passive:true });

  wheel?.addEventListener("pointermove", (e) => {
    if(!dragging) return;

    const dx = e.clientX - tapStartX;
    const dy = e.clientY - tapStartY;
    if(!didDrag && Math.hypot(dx, dy) > 18) didDrag = true;

    if(didDrag){
      const r = wheel.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const deg = angle(cx, cy, e.clientX, e.clientY) - startAngle;
      setRotation(deg);
      e.preventDefault();
    }
  }, { passive:false });

  wheel?.addEventListener("pointerup", () => {
    if(!dragging) return;
    dragging = false;

    const idx = sectorFromDeg(rotationDeg);
    setRotation(idx * STEP);

    if(!didDrag){
      openSheet();
      renderView(VIEW_DEFS[activeIndex].id);
    }
  }, { passive:true });

  wheel?.addEventListener("pointercancel", () => { dragging = false; }, { passive:true });

  wheel?.addEventListener("wheel", (e) => {
    e.preventDefault();
    const dir = e.deltaY > 0 ? 1 : -1;
    const next = (activeIndex + dir + VIEW_DEFS.length) % VIEW_DEFS.length;
    setRotation(next * STEP);
  }, { passive:false });

  wheel?.addEventListener("click", () => {
    openSheet();
    renderView(VIEW_DEFS[activeIndex].id);
  });

  /* =========================
     TIMER + wheel ring SVG + pulse
  ========================= */
  const TIMER = {
    total: 5 * 60,
    left:  5 * 60,
    running: false,
    t0: 0,
    pausedLeft: 5 * 60,
    raf: 0
  };
  const canVibrate = !!navigator.vibrate;

  // pulse overlay
  const pulse = document.createElement("div");
  pulse.className = "timerPulse";
  wheel?.appendChild(pulse);

  // ring svg
  const wheelSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  wheelSvg.setAttribute("class", "wheelTimerSvg");
  wheelSvg.innerHTML = `
    <circle id="wheelTimerBg"></circle>
    <circle id="wheelTimerProg"></circle>
  `;
  wheel?.appendChild(wheelSvg);

  function updateWheelTimerProgress(){
    const bg = document.getElementById("wheelTimerBg");
    const prog = document.getElementById("wheelTimerProg");
    if(!wheel || !wheelSvg || !bg || !prog) return;

    const size = wheel.getBoundingClientRect().width;
    const r = (size / 2) - 10;
    const cx = size / 2;
    const cy = size / 2;

    wheelSvg.setAttribute("viewBox", `0 0 ${size} ${size}`);

    bg.setAttribute("cx", cx);
    bg.setAttribute("cy", cy);
    bg.setAttribute("r", r);

    prog.setAttribute("cx", cx);
    prog.setAttribute("cy", cy);
    prog.setAttribute("r", r);

    const C = 2 * Math.PI * r;
    bg.style.strokeDasharray = String(C);
    bg.style.strokeDashoffset = "0";

    prog.style.strokeDasharray = String(C);

    const pct = TIMER.total ? (TIMER.left / TIMER.total) : 0;
    // Countdown direction
    prog.style.strokeDashoffset = String(-C * (1 - clamp01(pct)));

    if(pct > 0.40) prog.style.stroke = "rgba(0,209,255,.92)";
    else if(pct > 0.15) prog.style.stroke = "rgba(255,165,0,.92)";
    else prog.style.stroke = "rgba(255,70,70,.92)";
  }
  window.addEventListener("resize", updateWheelTimerProgress);

  function timerText(){
    const safe = Math.max(0, TIMER.left);
    const mm = Math.floor(safe / 60);
    const ss = safe % 60;
    return `${pad2(mm)}:${pad2(ss)}`;
  }

  function setTimerMinutesAndStart(min){
    const m = Number(min);
    if(!Number.isFinite(m) || m <= 0) return;

    TIMER.running = false;
    cancelAnimationFrame(TIMER.raf);

    TIMER.total = Math.round(m * 60);
    TIMER.left = TIMER.total;
    TIMER.pausedLeft = TIMER.left;

    TIMER.running = true;
    TIMER.t0 = performance.now();
    document.body.classList.add("timerRunning");
    cancelAnimationFrame(TIMER.raf);
    TIMER.raf = requestAnimationFrame(timerLoop);

    updateWheelTimerProgress();
    renderPreview("timer");
  }

  function resetTimer(){
    TIMER.running = false;
    cancelAnimationFrame(TIMER.raf);
    TIMER.left = TIMER.total;
    TIMER.pausedLeft = TIMER.left;
    document.body.classList.remove("timerRunning");
    updateWheelTimerProgress();
    renderPreview("timer");
  }

  function timerLoop(){
    if(!TIMER.running) return;

    const elapsed = (performance.now() - TIMER.t0) / 1000;
    TIMER.left = Math.max(0, Math.floor(TIMER.pausedLeft - elapsed));

    updateWheelTimerProgress();
    renderPreview("timer");

    if(TIMER.left <= 0){
      TIMER.running = false;
      cancelAnimationFrame(TIMER.raf);
      document.body.classList.remove("timerRunning");
      if(canVibrate) navigator.vibrate([20, 40, 20, 60, 20]);
      updateWheelTimerProgress();
      return;
    }
    TIMER.raf = requestAnimationFrame(timerLoop);
  }

  function renderTimer(){
    sheetTitle.textContent = "Timer";
    sheetContent.innerHTML = `
      <div class="card">
        <div style="display:flex;flex-direction:column;align-items:center;gap:6px;">
          <div id="tTime" style="font-size:52px;font-weight:900;letter-spacing:.6px;">${timerText()}</div>
          <div class="miniHint" id="tState">${TIMER.running ? "Fokus…" : (TIMER.left === TIMER.total ? "Redo" : (TIMER.left > 0 ? "Pausad" : "KLAR"))}</div>
        </div>

        <div class="timerBtns" style="margin-top:12px;">
          <button class="timerBtn" data-min="1">1</button>
          <button class="timerBtn" data-min="5">5</button>
          <button class="timerBtn" data-min="10">10</button>
          <button class="timerBtn" data-min="15">15</button>
          <button class="timerBtn" data-min="30">30</button>
          <button class="timerBtn timerBtnReset" id="tReset">Reset</button>
        </div>
      </div>
    `;

    sheetContent.querySelectorAll("[data-min]").forEach(btn => {
      btn.addEventListener("click", () => setTimerMinutesAndStart(btn.dataset.min));
    });
    $("tReset")?.addEventListener("click", resetTimer);
  }

  /* =========================
     CALENDAR
  ========================= */
  const CAL_SRC =
    "https://calendar.google.com/calendar/embed?src=ZXJpY3Nzb25ib25pbmlAZ21haWwuY29t&mode=AGENDA&ctz=Europe%2FStockholm&hl=sv&bgcolor=%230b1118&showTitle=0&showTabs=0&showNav=0&showPrint=0&showCalendars=0&showDate=0";

  function renderCalendar(){
    sheetTitle.textContent = "Kalender";
    sheetContent.innerHTML = `
      <div class="card" style="padding:14px;">
        <div style="border-radius:16px; overflow:hidden; border:1px solid rgba(255,255,255,.10); background: rgba(0,0,0,.10);">
          <iframe
            style="width:100%; height:520px; border:0;"
            src="${CAL_SRC}"
            scrolling="yes">
          </iframe>
        </div>
      </div>
      <div class="miniHint" style="margin-top:10px;">(iPhone Safari kan kräva cookies för Google iframe.)</div>
    `;
  }

  /* =========================
     WEATHER
  ========================= */
  async function renderWeather(){
    sheetTitle.textContent = "Väder";
    sheetContent.innerHTML = `
      <div class="card">
        <div id="wNow" style="font-weight:900;">Laddar…</div>
        <div class="miniHint" id="wSub" style="margin-top:8px;"></div>
      </div>
    `;

    const lat = 59.3293, lon = 18.0686;
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,wind_speed_10m` +
      `&daily=temperature_2m_max,temperature_2m_min` +
      `&forecast_days=2` +
      `&timezone=Europe%2FStockholm`;

    try{
      const r = await fetch(url, { cache:"no-store" });
      if(!r.ok) throw new Error("weather http");
      const data = await r.json();
      lastWeather = data;

      const t = Math.round(data.current.temperature_2m);
      const w = Math.round(data.current.wind_speed_10m);

      const tmax = Math.round(data.daily.temperature_2m_max?.[0] ?? 0);
      const tmin = Math.round(data.daily.temperature_2m_min?.[0] ?? 0);

      $("wNow").textContent = `${t}° • ${w} m/s`;
      $("wSub").textContent = `Idag: ${tmin}°–${tmax}°`;

      renderPreview("weather");
    }catch{
      const el = $("wNow");
      if(el) el.textContent = "Kunde inte hämta väder.";
    }
  }

  /* =========================
     NEWS
  ========================= */
  const RSS_URL_BASE = "https://news.google.com/rss?hl=sv&gl=SE&ceid=SE:sv";
  const NEWS_CACHE_KEY = "sbdash_news_cache_v1";

  const PROXIES = [
    (u) => `https://r.jina.ai/http://${u.replace(/^https?:\/\//, "")}`,                 // ofta minst cache
    (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
  ];

  async function fetchTextWithFallback(url){
    let lastErr = null;
    for(const mk of PROXIES){
      try{
        const proxyUrl = mk(url);
        const res = await fetch(proxyUrl, { cache:"no-store" });
        if(!res.ok) throw new Error(`HTTP ${res.status}`);

        const txt = await res.text();

        if(proxyUrl.includes("/get?url=")){
          const obj = JSON.parse(txt);
          if(obj?.contents) return obj.contents;
          throw new Error("No contents in allorigins get");
        }
        return txt;
      }catch(err){
        lastErr = err;
      }
    }
    throw (lastErr || new Error("All proxies failed"));
  }

  function parseRss(xmlText, max = 10){
    const xml = new DOMParser().parseFromString(xmlText, "text/xml");
    const items = Array.from(xml.querySelectorAll("item")).slice(0, max);
    return items.map((item) => ({
      title: item.querySelector("title")?.textContent?.trim() || "Nyhet",
      link: item.querySelector("link")?.textContent?.trim() || "#",
      pubDate: item.querySelector("pubDate")?.textContent?.trim() || "",
    }));
  }

  function saveNewsCache(items){
    try{
      localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify({ updatedAt: Date.now(), items }));
    }catch{}
  }
  function loadNewsCache(){
    try{
      return JSON.parse(localStorage.getItem(NEWS_CACHE_KEY) || "null");
    }catch{ return null; }
  }

  function renderNewsList(items, metaText){
    const newsList = document.getElementById("newsList");
    const newsMeta = document.getElementById("newsMeta");
    if(!newsList || !newsMeta) return;

    newsMeta.textContent = metaText || "";
    newsList.innerHTML = "";

    if(!items?.length){
      newsList.innerHTML = `<li class="miniHint">Inget att visa just nu.</li>`;
      return;
    }

    items.forEach((it) => {
      const li = document.createElement("li");
      li.className = "miniRow";

      const left = document.createElement("div");
      left.className = "miniRowLeft";

      const a = document.createElement("a");
      a.href = it.link;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = it.title;
      a.style.color = "var(--text)";
      a.style.textDecoration = "none";
      a.style.fontWeight = "900";
      a.style.fontSize = "12px";
      a.style.whiteSpace = "nowrap";
      a.style.overflow = "hidden";
      a.style.textOverflow = "ellipsis";

      left.appendChild(a);

      const right = document.createElement("div");
      right.className = "miniMeta";
      if(it.pubDate){
        const date = new Date(it.pubDate);
        if(!isNaN(date.getTime())){
          right.textContent = date.toLocaleString("sv-SE", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });
        }
      }

      li.appendChild(left);
      li.appendChild(right);
      newsList.appendChild(li);
    });
  }

  let newsLoading = false;
  async function loadNews(){
    const newsList = document.getElementById("newsList");
    const newsMeta = document.getElementById("newsMeta");
    if(!newsList || !newsMeta) return;

    if(newsLoading) return;
    newsLoading = true;

    newsMeta.textContent = "Laddar…";
    newsList.innerHTML = "";

    try{
      // cache-bust
      const url = `${RSS_URL_BASE}&_=${Date.now()}`;
      const xmlText = await fetchTextWithFallback(url);

      const items = parseRss(xmlText, 10);

      // filter 48h (om allt är gammalt, visa ändå men märk)
      const now = Date.now();
      const fresh = items.filter(it => {
        const t = it.pubDate ? new Date(it.pubDate).getTime() : 0;
        return t && (now - t) < (48 * 60 * 60 * 1000);
      });
      const finalItems = fresh.length ? fresh : items;

      lastNews = finalItems;
      saveNewsCache(finalItems);

      const stamp = new Date().toLocaleString("sv-SE", { hour:"2-digit", minute:"2-digit" });
      const note = fresh.length ? "" : " (äldre batch)";
      renderNewsList(finalItems, `Uppdaterad: ${stamp}${note}`);

      renderPreview("news");
    }catch{
      const c = loadNewsCache();
      if(c?.items?.length){
        lastNews = c.items;
        const stamp = new Date(c.updatedAt).toLocaleString("sv-SE", { hour:"2-digit", minute:"2-digit" });
        renderNewsList(c.items, `Visar cache (senast: ${stamp})`);
        renderPreview("news");
      }else{
        renderNewsList([], "Kunde inte ladda nyheter.");
      }
    }finally{
      newsLoading = false;
    }
  }

  function renderNews(){
    sheetTitle.textContent = "Nyheter";
    sheetContent.innerHTML = `
      <ul id="newsList" class="miniList"></ul>
      <div id="newsMeta" class="miniHint" style="margin-top:8px;">Laddar…</div>
    `;
    loadNews();
  }

  // auto-refresh var 10:e minut om news-view är öppen
  setInterval(() => {
    if(document.getElementById("newsList") && document.getElementById("newsMeta")){
      loadNews();
    }
  }, 10 * 60 * 1000);

  /* =========================
     VIEW SWITCH
  ========================= */
  function renderView(id){
    if(id === "calendar") return renderCalendar();
    if(id === "weather")  return renderWeather();
    if(id === "news")     return renderNews();
    if(id === "timer")    return renderTimer();
  }

  /* =========================
     INIT
  ========================= */
  setRotation(0);
  applyActiveView(0);
  updateWheelTimerProgress();
  renderPreview("calendar");
})();