
/* procesos.js - Tablero Kanban simple para procesos (localStorage)
   Requisitos:
   - proceso.js ya agrega playerKey al índice procesos_{usuarioActual} cuando abres un perfil.
   - Guardado por jugador: proceso_{playerKey}
*/

(function(){
  "use strict";

  const STAGES = (window.ProcesoCRM?.STAGES) || [
    "Nuevo","Evaluando","Contactado","Interesado","Tryout / Visita","Oferta","Admitido","No interesado"
  ];
  const CHECK_KEYS = (window.ProcesoCRM?.CHECK_KEYS) || ["contacto","evaluado","academico","combine","tryout","decision"];

  function $(id){ return document.getElementById(id); }

  function getUsername(){
    return localStorage.getItem("usuarioActual") || "";
  }

  function getIndex(username){
    const k = `procesos_${username}`;
    try { return JSON.parse(localStorage.getItem(k) || "[]"); }
    catch { return []; }
  }

  function setIndex(username, arr){
    const k = `procesos_${username}`;
    localStorage.setItem(k, JSON.stringify(arr || []));
  }

  function removeFromIndex(playerKey){
    const username = getUsername();
    if (!username) return;
    const arr = getIndex(username).filter(k => k !== playerKey);
    setIndex(username, arr);
  }
function storageKey(playerKey){
    return `proceso_${playerKey}`;
  }

  function loadProceso(playerKey){
    const raw = localStorage.getItem(storageKey(playerKey));
    if (!raw) return null;
    try { return JSON.parse(raw); }
    catch { return null; }
  }

  function saveProceso(playerKey, proceso){
    const updated = { ...proceso, lastUpdated: new Date().toISOString() };
    localStorage.setItem(storageKey(playerKey), JSON.stringify(updated));
    return updated;
  }

  // playerKey = username_Nombre_Apellido
  function parseNameFromPlayerKey(playerKey){
    const parts = (playerKey || "").split("_");
    if (parts.length < 3) return { nombre: playerKey, apellido: "" };
    return { nombre: parts[1] || "", apellido: parts.slice(2).join(" ") || "" };
  }

  
  function getCalificaciones(username){
    const k = `calificaciones_${username}`;
    try { return JSON.parse(localStorage.getItem(k) || "{}"); }
    catch { return {}; }
  }

  function starsFromRating(n){
    const r = Number(n || 0);
    if (!r) return "";
    const full = Math.max(0, Math.min(5, Math.round(r)));
    return "★".repeat(full) + "☆".repeat(5 - full);
  }
function progressOf(proceso){
    const c = proceso?.checklist || {};
    let done = 0;
    CHECK_KEYS.forEach(k => { if (c[k]) done++; });
    return { done, total: CHECK_KEYS.length, pct: CHECK_KEYS.length ? Math.round((done/CHECK_KEYS.length)*100) : 0 };
  }

  function safe(v){ return (v ?? "").toString(); }

  function matchesFilters(card, q, priority, decision){
    const hay = (safe(card.searchText)).toLowerCase();
    const okQ = !q || hay.includes(q.toLowerCase());
    const okP = (priority === "all") || (card.priority === priority);
    const okD = (decision === "all") || (card.decisionStatus === decision);
    return okQ && okP && okD;
  }

  function buildBoardSkeleton(){
    const board = $("board");
    board.innerHTML = "";

    STAGES.forEach(stage => {
      const col = document.createElement("div");
      col.className = "col";
      col.dataset.stage = stage;

      const head = document.createElement("div");
      head.className = "col-header";
      head.innerHTML = `
        <div class="col-title">${stage}</div>
        <div class="col-count" id="count-${cssId(stage)}">0</div>
      `;

      const dz = document.createElement("div");
      dz.className = "dropzone";
      dz.dataset.stage = stage;

      dz.addEventListener("dragover", (e)=>{ e.preventDefault(); dz.classList.add("drag-over"); });
      dz.addEventListener("dragleave", ()=> dz.classList.remove("drag-over"));
      dz.addEventListener("drop", (e)=>{
        e.preventDefault();
        dz.classList.remove("drag-over");
        const playerKey = e.dataTransfer.getData("text/playerKey");
        if (!playerKey) return;
        moveCardToStage(playerKey, stage);
      });

      col.appendChild(head);
      col.appendChild(dz);
      board.appendChild(col);
    });
  }

  const refreshTopScrollWidth = setupTopScrollbar();


  function cssId(stage){
    return stage.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  }

  function cardEl(card){
    const { done, total, pct } = card.progress;

    const el = document.createElement("div");
    el.className = "card";
    el.draggable = true;
    el.dataset.playerKey = card.playerKey;
    
    el.addEventListener("dragstart", (e)=>{
      e.dataTransfer.setData("text/playerKey", card.playerKey);
      e.dataTransfer.effectAllowed = "move";
    });
    // Toggle expand / collapse
    el.addEventListener("click", (e) => {
      // Evitar que botones disparen el toggle
      if (e.target.tagName === "BUTTON") return;

      const extra = el.querySelector(".card-extra");
      if (!extra) return;

      const isOpen = extra.style.display === "block";
      extra.style.display = isOpen ? "none" : "block";
    });

    el.innerHTML = `
      <div class="card-top">
        <div>
          <div class="name">${card.nombre} ${card.apellido}</div>
          <div class="tiny" style="margin-top:4px">
            ${card.ratingStars ? card.ratingStars : ""}
            ${card.position ? " • " + card.position : ""}
          </div>
          <div class="sub">${card.nextStep ? ("Next: " + escapeHtml(card.nextStep)) : "—"}</div>
        </div>
        <div class="badge ${card.priority}">${card.priority}</div>
      </div>

      <div class="card-extra" style="display:none">

          <div class="row">
            <div class="progress" title="${done}/${total}">
              <div style="width:${pct}%"></div>
            </div>
            <div class="tiny">${done}/${total}</div>
          </div>

          <div class="row">
            <div class="tiny">Decisión: <strong>${card.decisionStatus}</strong></div>
            <div class="tiny">${card.lastUpdatedText}</div>
          </div>

          <div class="actions-row">
            <button class="linkbtn" data-action="open">Abrir perfil</button>
            <button class="linkbtn" data-action="note">Copiar next</button>
          </div>

          <div class="actions-row secondary">
            <button class="linkbtn" data-action="opts">Opciones</button>
          </div>

        </div>


      <div class="opts" style="display:none;margin-top:8px;gap:8px;flex-direction:column;">
        <button class="linkbtn" data-action="remove" style="border-color: rgba(139,0,0,.35); font-weight:900;">Quitar del tablero</button>
        <button class="linkbtn" data-action="wipe" style="border-color: rgba(139,0,0,.35);">Quitar + borrar datos</button>
      </div>
    `;

    el.querySelector('[data-action="open"]').addEventListener("click", ()=>{
      const url = `perfil.html?nombre=${encodeURIComponent(card.nombre)}&apellido=${encodeURIComponent(card.apellidoRaw)}`;
      window.location.href = url;
    });

    el.querySelector('[data-action="note"]').addEventListener("click", async ()=>{
      const txt = card.nextStep || "";
      try{
        await navigator.clipboard.writeText(txt);
      }catch{
        // fallback: nada
      }
    });

    // Opciones (menú)
    const optsBtn = el.querySelector('[data-action="opts"]');
    const optsBox = el.querySelector('.opts');
    optsBtn.addEventListener("click", ()=>{
      if (!optsBox) return;
      const isOpen = optsBox.style.display !== "none";
      optsBox.style.display = isOpen ? "none" : "flex";
    });

    // Quitar del tablero (solo índice)
    el.querySelector('[data-action="remove"]').addEventListener("click", ()=>{
      const ok = confirm(`¿Quitar a ${card.nombre} ${card.apellido} del tablero de procesos?\n\nEsto NO borra su proceso guardado, solo lo oculta del tablero.`);
      if (!ok) return;
      removeFromIndex(card.playerKey);
      // Remover visualmente
      el.remove();
      // Refrescar contadores
      boot();
    });

    // Quitar + borrar datos (índice + proceso_{playerKey})
    el.querySelector('[data-action="wipe"]').addEventListener("click", ()=>{
      const ok = confirm(`¿Quitar y borrar datos del proceso de ${card.nombre} ${card.apellido}?\n\nEsto elimina el jugador del tablero y borra su proceso guardado en este navegador.`);
      if (!ok) return;
      removeFromIndex(card.playerKey);
      localStorage.removeItem(storageKey(card.playerKey));
      el.remove();
      boot();
    });

    return el;
  }

  function escapeHtml(s){
    return safe(s)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  function render(cards){
    // limpiar columnas
    document.querySelectorAll(".dropzone").forEach(dz => dz.innerHTML = "");

    // filtros
    const q = $("search").value.trim();
    const pr = $("priorityFilter").value;
    const de = $("decisionFilter").value;

    const filtered = cards.filter(c => matchesFilters(c, q, pr, de));

    // colocar en columnas
    const counts = {};
    STAGES.forEach(s => counts[s] = 0);

    filtered.forEach(c => {
      const stage = STAGES.includes(c.stage) ? c.stage : "Nuevo";
      const dz = document.querySelector(`.dropzone[data-stage="${cssAttr(stage)}"]`);
      if (dz) {
        dz.appendChild(cardEl(c));
        counts[stage] += 1;
      }
    });

    // counts
    STAGES.forEach(s=>{
      const el = document.getElementById(`count-${cssId(s)}`);
      if (el) el.textContent = counts[s] || 0;
    });

    $("totalCount").textContent = filtered.length;

    // Actualizar el ancho del scrollbar superior
    const inner = document.getElementById("boardTopScrollInner");
    const board = document.getElementById("board");
    if (inner && board) inner.style.width = board.scrollWidth + "px";

  }

  function cssAttr(s){
    return s.replace(/"/g, '\\"');
  }

  function cardsFromStorage(){
    const username = getUsername();
    const index = getIndex(username);

    const cards = [];
    index.forEach(playerKey => {
      const p = loadProceso(playerKey);
      if (!p) return;

      const nm = parseNameFromPlayerKey(playerKey);
      const prog = progressOf(p);
      const last = p.lastUpdated ? new Date(p.lastUpdated) : null;

      const califs = getCalificaciones(username);
      const notaKey = `${username}_${nm.nombre}_${nm.apellido}`; // mismo patrón que perfil.js
      const rating = califs[notaKey] || 0;
      const ratingStars = starsFromRating(rating);

      cards.push({
        playerKey,
        stage: p.stage || "Nuevo",
        priority: (p.priority || "B").toString().toUpperCase(),
        decisionStatus: (p.decision?.status || "pendiente"),
        nextStep: p.nextStep || "",
        progress: prog,
        nombre: nm.nombre,
        apellido: nm.apellido,
        apellidoRaw: nm.apellido,
        rating: rating,
        ratingStars: ratingStars,
        position: p.position || "",   // 👈 AQUÍ
        lastUpdatedText: last && !Number.isNaN(last.getTime()) ? last.toLocaleDateString() : "—",
        searchText: `${nm.nombre} ${nm.apellido} ${p.nextStep || ""} ${p.notes || ""} ${p.decision?.details || ""}`
      });


    });

    return cards;
  }

  function moveCardToStage(playerKey, stage){
    const p = loadProceso(playerKey);
    if (!p) return;
    p.stage = stage;
    saveProceso(playerKey, p);
    boot(); // refresh
  }

  function boot(){
    const username = getUsername();
    $("equipo-label").textContent = `Equipo: ${username || "—"}`;

    buildBoardSkeleton();
    const cards = cardsFromStorage();
    render(cards);

    // Re-render en cambios de filtros
    const rerender = () => render(cardsFromStorage());

    $("search").addEventListener("input", rerender);
    $("priorityFilter").addEventListener("change", rerender);
    $("decisionFilter").addEventListener("change", rerender);

    $("refreshBtn").addEventListener("click", rerender);
    $("clearBtn").addEventListener("click", ()=>{
      $("search").value = "";
      $("priorityFilter").value = "all";
      $("decisionFilter").value = "all";
      rerender();
    });
  }

  document.addEventListener("DOMContentLoaded", boot);
})();

function setupTopScrollbar(){
  const top = document.getElementById("boardTopScroll");
  const inner = document.getElementById("boardTopScrollInner");
  const board = document.getElementById("board");
  if (!top || !inner || !board) return;

  // Ajusta el ancho “falso” del scroll de arriba al ancho real del tablero
  const syncWidth = () => {
    inner.style.width = board.scrollWidth + "px";
  };

  // Sync bidireccional
  let lock = false;

  top.addEventListener("scroll", () => {
    if (lock) return;
    lock = true;
    board.scrollLeft = top.scrollLeft;
    lock = false;
  });

  board.addEventListener("scroll", () => {
    if (lock) return;
    lock = true;
    top.scrollLeft = board.scrollLeft;
    lock = false;
  });

  // Recalcular cuando cambie el contenido o tamaño
  syncWidth();
  window.addEventListener("resize", syncWidth);

  // Por si renderizas de nuevo
  return syncWidth;
}
