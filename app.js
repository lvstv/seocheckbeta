const STORAGE_KEY = "seo-audit-toolkit-v0.1.0";
let checklist = [];
let state = {};
let activeSection = null;
let searchTerm = "";

const nav = document.getElementById("sectionNav");
const content = document.getElementById("sectionContent");
const searchInput = document.getElementById("searchInput");

async function init() {
  try {
    const response = await fetch("checklist.json");
    if (!response.ok) throw new Error("Не удалось загрузить checklist.json");
    checklist = await response.json();
    loadState();
    activeSection = checklist[0]?.id ?? null;
    renderNav();
    renderSection();
    updateProgress();
  } catch (error) {
    content.innerHTML = `<div class="empty">${escapeHtml(error.message)}. Проверьте, что все файлы проекта находятся в одной папке и открывайте сайт через локальный сервер или GitHub Pages.</div>`;
  }
}

function loadState() {
  try { state = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { state = {}; }
}
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const label = document.getElementById("saveState");
  label.textContent = "Сохранено в браузере";
  window.clearTimeout(saveState.timer);
  saveState.timer = window.setTimeout(() => label.textContent = "Локальное сохранение", 1600);
}
function getAllItems() {
  return checklist.flatMap(section => section.groups.flatMap(group => group.items.map((_, i) => `${section.id}::${group.title}::${i}`)));
}
function updateProgress() {
  const ids = getAllItems();
  const done = ids.filter(id => state[id]?.status === "OK").length;
  const percent = ids.length ? Math.round(done / ids.length * 100) : 0;
  document.getElementById("overallPercent").textContent = `${percent}%`;
  document.getElementById("overallBar").style.width = `${percent}%`;
  const active = checklist.find(s => s.id === activeSection);
  if (active) {
    const sectionIds = active.groups.flatMap(g => g.items.map((_, i) => `${active.id}::${g.title}::${i}`));
    const sectionDone = sectionIds.filter(id => state[id]?.status === "OK").length;
    const counter = document.getElementById("sectionCount");
    if (counter) counter.textContent = `${sectionDone} / ${sectionIds.length} выполнено`;
  }
}
function renderNav() {
  nav.innerHTML = checklist.map(section => `
    <button class="nav-item ${section.id === activeSection ? "active" : ""}" data-section="${section.id}" type="button">${escapeHtml(section.title)}</button>
  `).join("");
  nav.querySelectorAll("[data-section]").forEach(button => button.addEventListener("click", () => {
    activeSection = button.dataset.section;
    renderNav(); renderSection();
  }));
}
function renderSection() {
  const section = checklist.find(s => s.id === activeSection);
  if (!section) return;
  const term = searchTerm.trim().toLocaleLowerCase("ru");
  let visibleCount = 0;
  const groupsHtml = section.groups.map((group, groupIndex) => {
    const rows = group.items.map((item, itemIndex) => {
      const id = `${section.id}::${group.title}::${itemIndex}`;
      if (term && !item.toLocaleLowerCase("ru").includes(term) && !group.title.toLocaleLowerCase("ru").includes(term)) return "";
      visibleCount++;
      const current = state[id] || {status:"NOT CHECKED", note:""};
      const done = current.status === "OK";
      return `<div class="check-row ${done ? "done" : ""}">
        <input type="checkbox" id="${escapeAttr(id)}" data-id="${escapeAttr(id)}" ${done ? "checked" : ""} aria-label="Отметить проверку выполненной">
        <label class="check-label" for="${escapeAttr(id)}">${escapeHtml(item)}</label>
        <select class="status-select" data-status="${escapeAttr(id)}" aria-label="Статус проверки">
          ${["NOT CHECKED","OK","ERROR","WARNING","N/A"].map(status => `<option value="${status}" ${current.status === status ? "selected" : ""}>${statusLabel(status)}</option>`).join("")}
        </select>
      </div>`;
    }).join("");
    if (!rows.trim()) return "";
    return `<section class="group"><div class="group-title">${escapeHtml(group.title)}</div>${rows}</section>`;
  }).join("");
  content.innerHTML = `
    <div class="section-head">
      <div><h2>${escapeHtml(section.title)}</h2><p>${escapeHtml(section.description || "")}</p></div>
      <div class="section-count" id="sectionCount"></div>
    </div>
    ${visibleCount ? groupsHtml : '<div class="empty">По вашему запросу ничего не найдено в этом разделе.</div>'}
  `;
  content.querySelectorAll("[data-id]").forEach(input => input.addEventListener("change", () => {
    const id = input.dataset.id;
    state[id] = {...(state[id] || {}), status: input.checked ? "OK" : "NOT CHECKED"};
    saveState(); renderSection(); updateProgress();
  }));
  content.querySelectorAll("[data-status]").forEach(select => select.addEventListener("change", () => {
    const id = select.dataset.status;
    state[id] = {...(state[id] || {}), status: select.value};
    saveState(); renderSection(); updateProgress();
  }));
  updateProgress();
}
function statusLabel(value) {
  return ({ "NOT CHECKED":"Не проверено", "OK":"OK — норма", "ERROR":"Ошибка", "WARNING":"Внимание", "N/A":"Не применимо" })[value] || value;
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function escapeAttr(value) { return escapeHtml(value); }

searchInput.addEventListener("input", () => { searchTerm = searchInput.value; renderSection(); });
document.getElementById("resetButton").addEventListener("click", () => {
  if (!confirm("Сбросить все отметки во всех разделах? Это действие нельзя отменить.")) return;
  state = {}; saveState(); renderSection(); updateProgress();
});
init();
