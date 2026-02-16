/* =============================
   SB DASH – WHEEL APP
   ============================= */

const sheetWrap = document.getElementById("sheetWrap");
const sheet = document.getElementById("sheet");
const sheetTitle = document.getElementById("sheetTitle");
const sheetContent = document.getElementById("sheetContent");

const wheel = document.getElementById("wheel");
const wheelRing = document.querySelector(".wheelRing");
const wheelIcon = document.getElementById("wheelIcon");

const topDate = document.getElementById("topDate");

/* =============================
   DATE
   ============================= */
function setDate(){
  const now = new Date();
  topDate.textContent = now.toLocaleDateString("sv-SE", {
    weekday:"long",
    day:"2-digit",
    month:"long"
  });
}
setDate();

/* =============================
   VIEWS
   ============================= */

const VIEWS = [
  { key:"calendar", icon:"icon-calendar.svg", title:"Kalender" },
  { key:"weather",  icon:"icon-weather.svg",  title:"Väder" },
  { key:"news",     icon:"icon-news.svg",     title:"Nyheter" },
  { key:"timer",    icon:"icon-timer.svg",    title:"Timer" },
  { key:"prio",     icon:"icon-prio.svg",     title:"Aktiv prio" }
];

let currentIndex = 0;
let currentRotation = 0;

/* =============================
   RENDER VIEW
   ============================= */

function renderView(){
  const view = VIEWS[currentIndex];

  wheelIcon.src = "assets/ui/" + view.icon;
  sheetTitle.textContent = view.title;

  if(view.key === "calendar"){
    sheetContent.innerHTML = `
      <div class="blockTitle">Kalender</div>
      <div class="card">
        <div class="calScale">
          <iframe class="calFrame"
            src="https://calendar.google.com/calendar/embed?src=ZXJpY3Nzb25ib25pbmlAZ21haWwuY29t&mode=AGENDA&ctz=Europe%2FStockholm&hl=sv&showTitle=0&showTabs=0&showNav=0&showPrint=0&showCalendars=0&showDate=0"
            frameborder="0"></iframe>
        </div>
      </div>
    `;
  }

  if(view.key === "weather"){
    sheetContent.innerHTML = `
      <div class="blockTitle">Väder</div>
      <div class="card" style="padding:16px">
        (kopplas in senare)
      </div>
    `;
  }

  if(view.key === "news"){
    sheetContent.innerHTML = `
      <div class="blockTitle">Nyheter</div>
      <div class="card" style="padding:16px">
        (kopplas in senare)
      </div>
    `;
  }

  if(view.key === "timer"){
    sheetContent.innerHTML = `
      <div class="blockTitle">Timer</div>
      <div class="card" style="padding:16px">
        (timer kopplas in nästa steg)
      </div>
    `;
  }

  if(view.key === "prio"){
    sheetContent.innerHTML = `
      <div class="blockTitle">Aktiv prio</div>

      <div class="miniForm">
        <input id="prioInput" class="miniInput" placeholder="Skriv prio..." />
        <button id="prioAddBtn" class="miniBtn">+ Lägg</button>
      </div>

      <ul id="prioList" class="miniList"></ul>
    `;

    setupPrio();
  }
}

/* =============================
   PRIO LOGIC
   ============================= */

function setupPrio(){
  const input = document.getElementById("prioInput");
  const addBtn = document.getElementById("prioAddBtn");
  const list = document.getElementById("prioList");

  let items = JSON.parse(localStorage.getItem("sb_prio") || "[]");

  function save(){
    localStorage.setItem("sb_prio", JSON.stringify(items));
  }

  function render(){
    list.innerHTML = "";
    items.forEach((text,i)=>{
      const li = document.createElement("li");
      li.className = "itemRow";
      li.innerHTML = `
        <div class="itemText">${text}</div>
        <div class="itemMeta">✕</div>
      `;
      li.querySelector(".itemMeta").onclick = ()=>{
        items.splice(i,1);
        save();
        render();
      };
      list.appendChild(li);
    });
  }

  function add(){
    if(!input.value.trim()) return;
    items.unshift(input.value.trim());
    input.value="";
    save();
    render();
  }

  addBtn.onclick = add;
  input.addEventListener("keydown", e=>{
    if(e.key==="Enter") add();
  });

  render();
}

/* =============================
   WHEEL LOGIC
   ============================= */

function rotateWheel(delta){
  currentRotation += delta;
  wheelRing.style.transform = `rotate(${currentRotation}deg)`;
}

function changeIndex(dir){
  currentIndex = (currentIndex + dir + VIEWS.length) % VIEWS.length;
  renderView();
}

/* Mouse wheel (desktop) */
wheel.addEventListener("wheel", e=>{
  e.preventDefault();
  const dir = e.deltaY > 0 ? 1 : -1;
  rotateWheel(dir * 18);
  changeIndex(dir);
});

/* Touch drag */
let startY = null;

wheel.addEventListener("pointerdown", e=>{
  startY = e.clientY;
  wheel.setPointerCapture(e.pointerId);
});

wheel.addEventListener("pointermove", e=>{
  if(startY === null) return;
  const delta = e.clientY - startY;

  if(Math.abs(delta) > 30){
    const dir = delta > 0 ? 1 : -1;
    rotateWheel(dir * 18);
    changeIndex(dir);
    startY = e.clientY;
  }
});

wheel.addEventListener("pointerup", ()=>{
  startY = null;
});

/* Click opens sheet */
wheel.addEventListener("click", ()=>{
  sheetWrap.classList.add("open");
});

/* =============================
   SHEET DRAG TO CLOSE
   ============================= */

let dragStart = null;

sheet.addEventListener("pointerdown", e=>{
  dragStart = e.clientY;
});

sheet.addEventListener("pointermove", e=>{
  if(dragStart === null) return;

  const delta = e.clientY - dragStart;
  if(delta > 0){
    sheet.style.transform =
      `translateX(-50%) translateY(${delta}px)`;
  }
});

sheet.addEventListener("pointerup", e=>{
  if(dragStart === null) return;

  const delta = e.clientY - dragStart;

  if(delta > 120){
    sheetWrap.classList.remove("open");
  }

  sheet.style.transform = "";
  dragStart = null;
});

/* =============================
   INIT
   ============================= */

renderView();
