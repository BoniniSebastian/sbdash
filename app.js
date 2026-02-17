(() => {

  const $ = (id) => document.getElementById(id);

  /* =========================================================
     GLOBAL TIMER STATE (lever utanför vyer)
     ========================================================= */

  const TIMER = {
    total: 5 * 60,
    left: 5 * 60,
    running: false,
    t0: 0,
    pausedLeft: 5 * 60,
    raf: 0
  };

  function clamp01(x){ return Math.max(0, Math.min(1, x)); }
  function pad2(n){ return String(n).padStart(2, "0"); }

  function timerLoop(){
    if(!TIMER.running) return;

    const elapsed = (performance.now() - TIMER.t0) / 1000;
    TIMER.left = Math.max(0, Math.floor(TIMER.pausedLeft - elapsed));

    updateWheelTimerProgress();

    if(TIMER.left <= 0){
      TIMER.running = false;
      cancelAnimationFrame(TIMER.raf);
      navigator.vibrate?.([20,40,20]);
      return;
    }

    TIMER.raf = requestAnimationFrame(timerLoop);
  }

  function startPauseTimer(){
    if(TIMER.running){
      TIMER.running = false;
      TIMER.pausedLeft = TIMER.left;
      cancelAnimationFrame(TIMER.raf);
      return;
    }

    if(TIMER.left <= 0){
      TIMER.left = TIMER.total;
      TIMER.pausedLeft = TIMER.left;
    }

    TIMER.running = true;
    TIMER.t0 = performance.now();
    TIMER.raf = requestAnimationFrame(timerLoop);
  }

  function setTimerMinutes(m){
    const min = Number(m);
    if(!Number.isFinite(min) || min <= 0) return;

    TIMER.running = false;
    cancelAnimationFrame(TIMER.raf);

    TIMER.total = min * 60;
    TIMER.left = TIMER.total;
    TIMER.pausedLeft = TIMER.left;

    updateWheelTimerProgress();
  }

  function resetTimer(){
    TIMER.running = false;
    cancelAnimationFrame(TIMER.raf);
    TIMER.left = TIMER.total;
    TIMER.pausedLeft = TIMER.left;
    updateWheelTimerProgress();
  }

  /* =========================================================
     WHEEL TIMER PROGRESS (runt scrollhjulet)
     ========================================================= */

  const wheel = $("wheel");
  const wheelWrap = document.querySelector(".wheelWrap");

  const wheelSvg = document.createElementNS("http://www.w3.org/2000/svg","svg");
  wheelSvg.setAttribute("class","wheelTimerSvg");
  wheelSvg.innerHTML = `
    <circle id="wheelTimerBg"></circle>
    <circle id="wheelTimerProg"></circle>
  `;
  wheelWrap.appendChild(wheelSvg);

  function updateWheelTimerProgress(){
    const bg = document.getElementById("wheelTimerBg");
    const prog = document.getElementById("wheelTimerProg");
    if(!bg || !prog) return;

    const size = wheel.offsetWidth;
    const r = (size/2) - 6;

    wheelSvg.setAttribute("width", size);
    wheelSvg.setAttribute("height", size);

    bg.setAttribute("cx", size/2);
    bg.setAttribute("cy", size/2);
    bg.setAttribute("r", r);

    prog.setAttribute("cx", size/2);
    prog.setAttribute("cy", size/2);
    prog.setAttribute("r", r);

    const C = 2 * Math.PI * r;

    bg.style.strokeDasharray = C;
    prog.style.strokeDasharray = C;

    const pct = TIMER.total ? TIMER.left / TIMER.total : 0;
    prog.style.strokeDashoffset = C * (1 - pct);

    if(pct > 0.4) prog.style.stroke = "rgba(0,209,255,.9)";
    else if(pct > 0.15) prog.style.stroke = "rgba(255,165,0,.9)";
    else prog.style.stroke = "rgba(255,70,70,.9)";
  }

  window.addEventListener("resize", updateWheelTimerProgress);
  updateWheelTimerProgress();

  /* =========================================================
     STORAGE
     ========================================================= */

  const LS_KEY = "sbdash_store_v2";
  function loadStore(){
    try{
      const raw = localStorage.getItem(LS_KEY);
      const p = raw ? JSON.parse(raw) : {};
      return {
        prio: p.prio || [],
        todo: p.todo || [],
        ideas: p.ideas || [],
        done: p.done || []
      };
    }catch{
      return { prio:[], todo:[], ideas:[], done:[] };
    }
  }

  const store = loadStore();
  const saveStore = () => localStorage.setItem(LS_KEY, JSON.stringify(store));

  const uid = () => crypto.randomUUID ? crypto.randomUUID() : Date.now()+"";

  const fmt = ts =>
    new Date(ts).toLocaleString("sv-SE",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});

  /* =========================================================
     SWIPE (utan Slutför-text)
     ========================================================= */

  function attachSwipe(li, onComplete){
    const content = li.querySelector(".swipeContent");

    let startX = 0;
    let dragging = false;

    li.addEventListener("pointerdown",(e)=>{
      startX = e.clientX;
      dragging = true;
      content.setPointerCapture(e.pointerId);
    });

    li.addEventListener("pointermove",(e)=>{
      if(!dragging) return;

      const dx = e.clientX - startX;
      if(dx < 0){
        content.style.transform = `translateX(${dx}px)`;
      }
    });

    li.addEventListener("pointerup",(e)=>{
      dragging = false;
      const offset = parseInt(content.style.transform.replace(/[^\-0-9]/g,"")) || 0;

      if(offset < -80){
        onComplete?.();
      }

      content.style.transform = "translateX(0)";
    });
  }

  function mkSwipeItem({text,meta}, onComplete, onClick){
    const li = document.createElement("li");
    li.className = "swipeItem";

    const content = document.createElement("div");
    content.className = "swipeContent";

    const left = document.createElement("div");
    left.className = "swipeLeft";

    const t = document.createElement("div");
    t.className = "swipeText";
    t.textContent = text;

    left.appendChild(t);

    const right = document.createElement("div");
    right.className = "swipeRight";

    const m = document.createElement("div");
    m.className = "miniMeta";
    m.textContent = meta || "";

    right.appendChild(m);

    content.appendChild(left);
    content.appendChild(right);
    li.appendChild(content);

    attachSwipe(li,onComplete);

    if(onClick){
      content.addEventListener("click",onClick);
    }

    return li;
  }

  /* =========================================================
     MODAL (Glass)
     ========================================================= */

  function openModal(item, origin){
    const wrap = document.createElement("div");
    wrap.className = "modalWrap open";
    wrap.innerHTML = `
      <div class="modalBackdrop"></div>
      <div class="modalCard">
        <div class="modalHeader">
          <div class="modalTitle">Anteckning</div>
          <button class="modalClose">✕</button>
        </div>
        <div class="modalBody">
          <div class="modalMainText">${item.text}</div>
          <textarea class="modalTextArea">${item.note || ""}</textarea>
        </div>
        <div class="modalFooter">
          <button class="miniBtn">Spara</button>
        </div>
      </div>
    `;

    document.body.appendChild(wrap);

    wrap.querySelector(".modalClose").onclick = ()=> wrap.remove();
    wrap.querySelector(".modalBackdrop").onclick = ()=> wrap.remove();

    wrap.querySelector(".miniBtn").onclick = ()=>{
      item.note = wrap.querySelector(".modalTextArea").value;
      saveStore();
      wrap.remove();
    };
  }

  /* =========================================================
     RENDER FUNCTIONS
     ========================================================= */

  const sheetWrap = $("sheetWrap");
  const sheet = $("sheet");
  const sheetTitle = $("sheetTitle");
  const sheetContent = $("sheetContent");
  const topRight = document.querySelector(".topRight");

  topRight.textContent = ""; // ta bort Preview

  function renderList(type){
    sheetTitle.textContent = type;

    sheetContent.innerHTML = `
      <div class="miniForm">
        <input id="input" class="miniInput" type="text">
        <button id="add" class="miniBtn miniBtnIcon">+</button>
      </div>
      <ul id="list" class="miniList"></ul>
    `;

    const input = $("input");
    const add = $("add");
    const list = $("list");

    add.onclick = ()=>{
      const t = input.value.trim();
      if(!t) return;
      store[type].unshift({id:uid(),text:t,createdAt:Date.now()});
      saveStore();
      input.value="";
      draw();
    };

    function complete(id){
      const i = store[type].findIndex(x=>x.id===id);
      if(i===-1) return;
      const item = store[type].splice(i,1)[0];
      store.done.unshift({...item,origin:type,doneAt:Date.now()});
      saveStore();
      draw();
    }

    function draw(){
      list.innerHTML="";
      store[type].forEach(item=>{
        list.appendChild(
          mkSwipeItem(
            {text:item.text,meta:fmt(item.createdAt)},
            ()=>complete(item.id),
            ()=>openModal(item,type)
          )
        );
      });
    }

    draw();
  }

  function renderTimer(){
    sheetTitle.textContent="Timer";

    sheetContent.innerHTML = `
      <div class="card timerCard">
        <div class="timerInner">
          <div class="timerTime">${pad2(Math.floor(TIMER.left/60))}:${pad2(TIMER.left%60)}</div>
          <div class="timerBtns">
            <button class="miniBtn" id="start">Start/Paus</button>
            <button class="miniBtn" id="reset">Reset</button>
          </div>
          <div class="timerPresets">
            ${[1,5,10,15,30].map(m=>`<button class="miniBtn" data-m="${m}">${m}</button>`).join("")}
          </div>
        </div>
      </div>
    `;

    $("start").onclick=startPauseTimer;
    $("reset").onclick=resetTimer;

    sheetContent.querySelectorAll("[data-m]").forEach(btn=>{
      btn.onclick=()=>setTimerMinutes(btn.dataset.m);
    });
  }

  /* =========================================================
     SIMPLE VIEW SWITCH
     ========================================================= */

  const VIEWS = ["calendar","prio","weather","news","todo","ideas","done","timer"];
  let activeIndex=0;

  function renderView(id){
    if(id==="prio") return renderList("prio");
    if(id==="todo") return renderList("todo");
    if(id==="ideas") return renderList("ideas");
    if(id==="timer") return renderTimer();
  }

  /* =========================================================
     OPEN/CLOSE SHEET
     ========================================================= */

  function openSheet(){
    sheetWrap.classList.add("open");
    renderView(VIEWS[activeIndex]);
  }

  function closeSheet(){
    sheetWrap.classList.remove("open");
  }

  wheel.addEventListener("click",openSheet);

})();
