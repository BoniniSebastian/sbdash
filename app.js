(() => {
  const $ = (id) => document.getElementById(id);

  /* =====================================================
     ELEMENTS
  ===================================================== */
  const wheel = $("wheel");
  const wheelRing = document.querySelector(".wheelRing");
  const wheelIcon = $("wheelIcon");

  const sheetWrap = $("sheetWrap");
  const sheet = $("sheet");
  const sheetTitle = $("sheetTitle");
  const sheetContent = $("sheetContent");

  const topDate = $("topDate");
  const startPrioCountEl = $("startPrioCount");
  const centerLabelEl = $("centerLabel");

  /* =====================================================
     STORAGE
  ===================================================== */
  const LS_KEY = "sbdash_store_v5";

  function loadStore(){
    try{
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : { prio:[], lists:[], ideas:[], done:[] };
    }catch{
      return { prio:[], lists:[], ideas:[], done:[] };
    }
  }

  const store = loadStore();
  const saveStore = () => localStorage.setItem(LS_KEY, JSON.stringify(store));
  const uid = () => crypto.randomUUID?.() ?? Date.now()+""+Math.random();

  /* =====================================================
     DATE
  ===================================================== */
  function updateTopDate(){
    if(!topDate) return;
    const now = new Date();
    const weekday = now.toLocaleDateString("sv-SE",{weekday:"long"});
    const date = now.toLocaleDateString("sv-SE",{day:"2-digit",month:"long",year:"numeric"});
    topDate.textContent = `${weekday} ${date}`;
  }
  updateTopDate();
  setInterval(updateTopDate,60000);

  function updateStartPrioCount(){
    if(startPrioCountEl)
      startPrioCountEl.textContent = `Aktiva prios: ${store.prio.length}`;
  }
  updateStartPrioCount();

  /* =====================================================
     VIEWS
  ===================================================== */
  const VIEW_DEFS = [
    { id:"calendar", label:"KALENDER", icon:"assets/ui/icon-calendar.svg" },
    { id:"prio",     label:"PRIOS",    icon:"assets/ui/icon-prio.svg" },
    { id:"weather",  label:"VÄDER",    icon:"assets/ui/icon-weather.svg" },
    { id:"news",     label:"NYHETER",  icon:"assets/ui/icon-news.svg" },
    { id:"lists",    label:"LISTOR",   icon:"assets/ui/icon-todo.svg" },
    { id:"ideas",    label:"IDÉER",    icon:"assets/ui/icon-ideas.svg" },
    { id:"timer",    label:"TIMER",    icon:"assets/ui/icon-pomodoro.svg" },
  ];

  let activeIndex = 0;
  const STEP = 360 / VIEW_DEFS.length;
  let rotationDeg = 0;

  function setCenterLabel(text){
    if(centerLabelEl) centerLabelEl.textContent = text;
  }

  function sectorFromDeg(deg){
    const raw = Math.round(deg / STEP);
    return ((raw % VIEW_DEFS.length)+VIEW_DEFS.length)%VIEW_DEFS.length;
  }

  function setPreview(index){
    activeIndex = (index + VIEW_DEFS.length)%VIEW_DEFS.length;
    const v = VIEW_DEFS[activeIndex];
    if(wheelIcon) wheelIcon.src = v.icon;
    setCenterLabel(v.label);
  }

  function setRotation(deg){
    rotationDeg = deg;
    if(wheelRing) wheelRing.style.transform = `rotate(${deg}deg)`;
    const idx = sectorFromDeg(deg);
    setPreview(idx);

    if(sheetWrap?.classList.contains("open")){
      renderView(VIEW_DEFS[idx].id);
    }
  }

  function openSheet(){
    sheetWrap?.classList.add("open");
    document.body.classList.add("sheetOpen");
  }

  function closeSheet(){
    sheetWrap?.classList.remove("open");
    document.body.classList.remove("sheetOpen");
  }

  /* =====================================================
     WHEEL
  ===================================================== */
  let dragging=false;
  let startAngle=0;

  function angle(cx,cy,x,y){
    return Math.atan2(y-cy,x-cx)*(180/Math.PI);
  }

  wheel?.addEventListener("pointerdown",(e)=>{
    dragging=true;
    const r=wheel.getBoundingClientRect();
    const cx=r.left+r.width/2;
    const cy=r.top+r.height/2;
    startAngle=angle(cx,cy,e.clientX,e.clientY)-rotationDeg;
  });

  wheel?.addEventListener("pointermove",(e)=>{
    if(!dragging) return;
    const r=wheel.getBoundingClientRect();
    const cx=r.left+r.width/2;
    const cy=r.top+r.height/2;
    const deg=angle(cx,cy,e.clientX,e.clientY)-startAngle;
    setRotation(deg);
  });

  wheel?.addEventListener("pointerup",()=>{
    if(!dragging) return;
    dragging=false;
    const idx=sectorFromDeg(rotationDeg);
    setRotation(idx*STEP);
  });

  wheel?.addEventListener("click",()=>{
    openSheet();
    renderView(VIEW_DEFS[activeIndex].id);
  });

  /* =====================================================
     TIMER (Neon + Puls + Rätt håll)
  ===================================================== */
  const TIMER={
    total:300,
    left:300,
    running:false,
    raf:0,
    t0:0
  };

  function updateRing(){
    const prog=document.getElementById("wheelTimerProg");
    if(!prog) return;

    const r=160;
    const C=2*Math.PI*r;
    prog.style.strokeDasharray=C;
    const pct=TIMER.left/TIMER.total;
    prog.style.strokeDashoffset=C*(1-pct);
  }

  function timerLoop(){
    if(!TIMER.running) return;
    const elapsed=(performance.now()-TIMER.t0)/1000;
    TIMER.left=Math.max(0,TIMER.total-elapsed);
    updateRing();
    if(TIMER.left<=0){
      TIMER.running=false;
      return;
    }
    TIMER.raf=requestAnimationFrame(timerLoop);
  }

  function startTimer(min){
    TIMER.total=min*60;
    TIMER.left=TIMER.total;
    TIMER.running=true;
    TIMER.t0=performance.now();
    cancelAnimationFrame(TIMER.raf);
    TIMER.raf=requestAnimationFrame(timerLoop);
  }

  function renderTimer(){
    sheetTitle.textContent="Timer";
    sheetContent.innerHTML=`
      <div class="card" style="padding:20px;text-align:center">
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
          ${[1,5,10,15,30].map(m=>
            `<button class="miniBtn timerBtn" data-min="${m}">${m}</button>`
          ).join("")}
          <button class="miniBtn" id="resetTimer">Reset</button>
        </div>
      </div>
    `;

    sheetContent.querySelectorAll(".timerBtn").forEach(btn=>{
      btn.onclick=()=>startTimer(btn.dataset.min);
    });

    $("resetTimer").onclick=()=>{
      TIMER.running=false;
      TIMER.left=TIMER.total;
      updateRing();
    };
  }

  /* =====================================================
     LISTS + SUBTASKS
  ===================================================== */
  function renderLists(){
    sheetTitle.textContent="Listor";
    sheetContent.innerHTML=`
      <div class="miniForm">
        <input id="input" class="miniInput" placeholder="Ny lista..." />
        <button id="add" class="miniBtn miniBtnIcon">+</button>
      </div>
      <ul id="list" class="miniList"></ul>
    `;

    const input=$("input");
    const list=$("list");

    $("add").onclick=()=>{
      if(!input.value.trim()) return;
      store.lists.unshift({
        id:uid(),
        text:input.value,
        tasks:[]
      });
      input.value="";
      saveStore();
      draw();
    };

    function draw(){
      list.innerHTML="";
      store.lists.forEach(item=>{
        const total=item.tasks.length;
        const done=item.tasks.filter(t=>t.done).length;

        const li=document.createElement("li");
        li.className="checkItem";
        li.innerHTML=`
          <div class="checkRow">
            <input type="checkbox" class="checkBox">
            <div class="checkMid">
              <div class="checkText">${item.text}</div>
            </div>
            <div class="checkRight">
              <div class="miniMeta">${done}/${total}</div>
            </div>
          </div>
        `;

        li.querySelector(".checkRow").onclick=(e)=>{
          if(e.target.classList.contains("checkBox")) return;
          openListModal(item);
        };

        list.appendChild(li);
      });
    }

    draw();
  }

  function openListModal(listItem){
    const wrap=document.createElement("div");
    wrap.className="modalWrap open";
    wrap.innerHTML=`
      <div class="modalBackdrop"></div>
      <div class="modalCard">
        <div class="modalHeader">
          <div class="modalTitle">${listItem.text}</div>
          <button class="modalClose">✕</button>
        </div>
        <div class="modalBody">
          <input id="newTask" class="miniInput" placeholder="Ny task..." />
          <ul id="taskList" class="miniList" style="margin-top:12px;"></ul>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    wrap.querySelector(".modalClose").onclick=()=>wrap.remove();
    wrap.querySelector(".modalBackdrop").onclick=()=>wrap.remove();

    const taskList=wrap.querySelector("#taskList");
    const input=wrap.querySelector("#newTask");

    input.onkeydown=(e)=>{
      if(e.key==="Enter" && input.value.trim()){
        listItem.tasks.push({text:input.value,done:false});
        input.value="";
        saveStore();
        renderTasks();
      }
    };

    function renderTasks(){
      taskList.innerHTML="";
      const sorted=[...listItem.tasks].sort((a,b)=>a.done-b.done);

      sorted.forEach(task=>{
        const li=document.createElement("li");
        li.className="checkItem";
        li.innerHTML=`
          <div class="checkRow">
            <input type="checkbox" class="checkBox" ${task.done?"checked":""}>
            <div class="checkMid">
              <div class="checkText" style="${task.done?"text-decoration:line-through;opacity:.5":""}">
                ${task.text}
              </div>
            </div>
          </div>
        `;

        li.querySelector(".checkBox").onchange=()=>{
          task.done=!task.done;
          saveStore();
          renderTasks();
        };

        taskList.appendChild(li);
      });
    }

    renderTasks();
  }

  /* =====================================================
     WEATHER (fylligare)
  ===================================================== */
  async function renderWeather(){
    sheetTitle.textContent="Väder";
    sheetContent.innerHTML=`<div class="card weatherCard" id="weatherBox">Laddar...</div>`;
    const r=await fetch("https://api.open-meteo.com/v1/forecast?latitude=59.33&longitude=18.06&current=temperature_2m,wind_speed_10m");
    const d=await r.json();
    $("weatherBox").innerHTML=`
      <div style="font-size:42px;font-weight:900">${Math.round(d.current.temperature_2m)}°</div>
      <div>Vind ${Math.round(d.current.wind_speed_10m)} m/s</div>
    `;
  }

  /* =====================================================
     NEWS
  ===================================================== */
  async function renderNews(){
    sheetTitle.textContent="Nyheter";
    sheetContent.innerHTML=`<div class="card">Laddar...</div>`;
  }

  function renderCalendar(){
    sheetTitle.textContent="Kalender";
    sheetContent.innerHTML=`<div class="card" style="height:420px"></div>`;
  }

  function renderView(id){
    if(id==="calendar") return renderCalendar();
    if(id==="prio")     return renderLists();
    if(id==="weather")  return renderWeather();
    if(id==="news")     return renderNews();
    if(id==="lists")    return renderLists();
    if(id==="ideas")    return renderLists();
    if(id==="timer")    return renderTimer();
  }

  setRotation(0);
})();
