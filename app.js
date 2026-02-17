(() => {

  const $ = id => document.getElementById(id);

  /* =========================================================
     STORAGE
  ========================================================= */

  const LS_KEY = "sbdash_store_v3";

  function loadStore(){
    try{
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : {prio:[],todo:[],ideas:[],done:[]};
    }catch{
      return {prio:[],todo:[],ideas:[],done:[]};
    }
  }

  const store = loadStore();
  const saveStore = () => localStorage.setItem(LS_KEY, JSON.stringify(store));
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : Date.now()+"";

  const fmt = ts =>
    new Date(ts).toLocaleString("sv-SE",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});

  /* =========================================================
     WHEEL VIEWS (DONE REMOVED)
  ========================================================= */

  const VIEWS = ["calendar","prio","weather","news","todo","ideas","timer"];
  let activeIndex = 0;

  /* =========================================================
     SWIPE FIXED (snap + animate out)
  ========================================================= */

  function attachSwipe(li,onComplete){

    const content = li.querySelector(".swipeContent");

    let startX=0;
    let currentX=0;
    let dragging=false;

    li.addEventListener("pointerdown",e=>{
      startX = e.clientX;
      dragging = true;
      content.style.transition="none";
      content.setPointerCapture(e.pointerId);
    });

    li.addEventListener("pointermove",e=>{
      if(!dragging) return;

      const dx = e.clientX - startX;
      if(dx < 0){
        currentX = dx;
        content.style.transform = `translateX(${dx}px)`;
      }
    });

    li.addEventListener("pointerup",()=>{
      dragging=false;

      if(currentX < -100){
        content.style.transition="transform 180ms ease";
        content.style.transform="translateX(-120%)";
        setTimeout(()=> onComplete?.(),150);
      }else{
        content.style.transition="transform 180ms ease";
        content.style.transform="translateX(0)";
      }

      currentX=0;
    });
  }

  function mkSwipeItem({text,meta},onComplete,onClick){

    const li=document.createElement("li");
    li.className="swipeItem";

    const content=document.createElement("div");
    content.className="swipeContent";

    content.innerHTML=`
      <div class="swipeLeft">
        <div class="swipeText">${text}</div>
      </div>
      <div class="swipeRight">
        <div class="miniMeta">${meta||""}</div>
      </div>
    `;

    li.appendChild(content);

    attachSwipe(li,onComplete);

    if(onClick){
      content.style.cursor="pointer";
      content.addEventListener("click",onClick);
    }

    return li;
  }

  /* =========================================================
     MODAL
  ========================================================= */

  function openModal(item){

    const wrap=document.createElement("div");
    wrap.className="modalWrap open";
    wrap.innerHTML=`
      <div class="modalBackdrop"></div>
      <div class="modalCard">
        <div class="modalHeader">
          <div class="modalTitle">Anteckning</div>
          <button class="modalClose">✕</button>
        </div>
        <div class="modalBody">
          <div class="modalMainText">${item.text}</div>
          <textarea class="modalTextArea">${item.note||""}</textarea>
        </div>
        <div class="modalFooter">
          <button class="miniBtn">Spara</button>
        </div>
      </div>
    `;

    document.body.appendChild(wrap);

    wrap.querySelector(".modalBackdrop").onclick=()=>wrap.remove();
    wrap.querySelector(".modalClose").onclick=()=>wrap.remove();

    wrap.querySelector(".miniBtn").onclick=()=>{
      item.note = wrap.querySelector(".modalTextArea").value;
      saveStore();
      wrap.remove();
    };
  }

  /* =========================================================
     LIST RENDER (PRIO/TODO/IDEAS)
  ========================================================= */

  const sheetTitle = $("sheetTitle");
  const sheetContent = $("sheetContent");

  function renderList(type,label){

    sheetTitle.innerHTML = `
      ${label}
      <span class="doneHeaderBtn" id="openDone">
        Visa slutförda
        <img src="assets/ui/icon-done.svg">
      </span>
    `;

    sheetContent.innerHTML=`
      <div class="miniForm">
        <input id="input" class="miniInput" placeholder="Skriv...">
        <button id="add" class="miniBtn miniBtnIcon">+</button>
      </div>
      <ul id="list" class="miniList"></ul>
    `;

    $("openDone").onclick=()=>renderDone();

    const input=$("input");
    const add=$("add");
    const list=$("list");

    add.onclick=()=>{
      const t=input.value.trim();
      if(!t) return;
      store[type].unshift({id:uid(),text:t,createdAt:Date.now()});
      saveStore();
      input.value="";
      draw();
    };

    function complete(id){
      const i=store[type].findIndex(x=>x.id===id);
      if(i===-1) return;
      const item=store[type].splice(i,1)[0];
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
            ()=>openModal(item)
          )
        );
      });
    }

    draw();
  }

  function renderDone(){

    sheetTitle.textContent="Slutförda";

    sheetContent.innerHTML=`
      <ul id="doneList" class="miniList"></ul>
    `;

    const list=$("doneList");

    store.done.forEach(item=>{
      const li=document.createElement("li");
      li.className="itemRow";
      li.innerHTML=`
        <div class="itemText">${item.text}</div>
        <div class="itemMeta">${fmt(item.doneAt)}</div>
      `;
      list.appendChild(li);
    });
  }

  /* =========================================================
     CALENDAR (TALLER)
  ========================================================= */

  function renderCalendar(){
    sheetTitle.textContent="Kalender";
    sheetContent.innerHTML=`
      <div class="card">
        <div class="calScale">
          <iframe class="calFrame"
          src="https://calendar.google.com/calendar/embed?mode=AGENDA&ctz=Europe%2FStockholm&hl=sv"
          frameborder="0"></iframe>
        </div>
      </div>
    `;
  }

  /* =========================================================
     WEATHER (MORE DATA + FORECAST)
  ========================================================= */

  async function renderWeather(){

    sheetTitle.textContent="Väder";

    sheetContent.innerHTML=`
      <div class="card weatherCard">
        <div id="wNow"></div>
        <div id="wForecast"></div>
      </div>
    `;

    const lat=59.3293, lon=18.0686;

    const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation_probability,wind_speed_10m&current=temperature_2m,wind_speed_10m&timezone=Europe%2FStockholm`;

    const r=await fetch(url);
    const data=await r.json();

    $("wNow").innerHTML=`
      <div class="weatherNow">
        <div>${Math.round(data.current.temperature_2m)}°</div>
        <div>${Math.round(data.current.wind_speed_10m)} m/s</div>
      </div>
    `;

    const hours=data.hourly.temperature_2m.slice(0,6);

    $("wForecast").innerHTML=`
      <div class="weatherForecast">
        ${hours.map((t,i)=>`
          <div>
            <div>${i}h</div>
            <div>${Math.round(t)}°</div>
          </div>
        `).join("")}
      </div>
    `;
  }

  /* =========================================================
     VIEW SWITCH
  ========================================================= */

  function renderView(id){
    if(id==="prio") return renderList("prio","Aktiv prio");
    if(id==="todo") return renderList("todo","Todo");
    if(id==="ideas") return renderList("ideas","Idéer");
    if(id==="calendar") return renderCalendar();
    if(id==="weather") return renderWeather();
    if(id==="news") return;   // TODO senare
    if(id==="timer") return;  // TODO senare
  }  // ✅ VIKTIG: denna saknades hos dig

  // --- INIT + OPEN SHEET ---
  const wheel = document.getElementById("wheel");
  const sheetWrap = document.getElementById("sheetWrap");

  function openSheet(){
    sheetWrap.classList.add("open");
    renderView(VIEWS[activeIndex]);
  }

  function closeSheet(){
    sheetWrap.classList.remove("open");
  }

  wheel?.addEventListener("click", openSheet);

  // (valfritt) Rendera inget direkt. Låt det ske när sheet öppnas.
  // renderView("calendar");

})();
