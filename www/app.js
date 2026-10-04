const app = document.querySelector("#app");
const homeButton = document.querySelector("#home-button");
const collator = new Intl.Collator("cs", { numeric: true, sensitivity: "base" });
const ROUND_SIZE = 8;

let lessons = [];
let lesson = null;
let queue = [];
let round = [];
let hebrewOrder = [];
let czechOrder = [];
let selectedHebrew = null;
let selectedCzech = null;
let matched = new Set();
let mistakes = 0;
let completed = 0;
let startedAt = 0;
let timerId = null;
let wrongId = null;

homeButton.addEventListener("click", showLibrary);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function completionKey(id) {
  return `hebrew-offline-completions-${id}`;
}

function completionCount(id) {
  return Number(localStorage.getItem(completionKey(id)) || 0);
}

function normalizedLessons(payload) {
  return payload
    .map((item, lessonIndex) => ({
      ...item,
      id: item.id ?? lessonIndex,
      title: item.title || item.name || `Lekce ${lessonIndex + 1}`,
      pairs: (item.pairs || []).map((pair, pairIndex) => ({
        id: pair.id ?? pairIndex,
        hebrew: pair.hebrew || "",
        czech: pair.czech || ""
      }))
    }))
    .filter((item) => item.pairs.length)
    .sort((a, b) => collator.compare(a.title, b.title));
}

async function loadLessons() {
  try {
    const response = await fetch("./lessons.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    lessons = normalizedLessons(payload.lessons || []);
    if (!lessons.length) throw new Error("Slovník je prázdný.");
    showLibrary();
  } catch (error) {
    app.innerHTML = `<div class="error"><strong>Slovník se nepodařilo načíst.</strong><br>${escapeHtml(error.message)}</div>`;
  }
}

function stopTimer() {
  if (timerId) clearInterval(timerId);
  timerId = null;
}

function showLibrary() {
  stopTimer();
  lesson = null;
  app.innerHTML = `
    <section class="hero">
      <h1>Vyberte lekci</h1>
      <p>Slovník je uložen přímo v zařízení a funguje bez připojení k internetu.</p>
    </section>
    <section class="lesson-grid">
      ${lessons.map((item) => `
        <article class="lesson-card">
          <button class="lesson-launch" type="button" data-lesson-id="${item.id}">
            <div class="lesson-preview">
              ${item.pairs.slice(0, 15).map((pair) => `<span class="preview-word">${escapeHtml(pair.hebrew)}</span>`).join("")}
            </div>
            <div class="lesson-info">
              <h2>${escapeHtml(item.title)}</h2>
              <div class="lesson-meta">
                <span>${item.pairs.length} dvojic</span>
                <span>${completionCount(item.id)} dokončení</span>
              </div>
            </div>
          </button>
        </article>
      `).join("")}
    </section>
  `;
  app.querySelectorAll("[data-lesson-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const selected = lessons.find((item) => String(item.id) === button.dataset.lessonId);
      if (selected) startLesson(selected);
    });
  });
}

function startLesson(selected) {
  lesson = selected;
  queue = shuffle(selected.pairs);
  mistakes = 0;
  completed = 0;
  startedAt = Date.now();
  nextRound();
  timerId = setInterval(updateStats, 1000);
}

function nextRound() {
  round = queue.splice(0, ROUND_SIZE);
  hebrewOrder = shuffle(round);
  czechOrder = shuffle(round);
  matched = new Set();
  selectedHebrew = null;
  selectedCzech = null;
  wrongId = null;
  renderGame();
}

function elapsedText() {
  const seconds = Math.floor((Date.now() - startedAt) / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function renderGame() {
  const total = lesson.pairs.length;
  const percent = Math.round((completed / total) * 100);
  app.innerHTML = `
    <section class="lesson-head">
      <div>
        <p>Přiřazování dvojic</p>
        <h1>${escapeHtml(lesson.title)}</h1>
      </div>
      <div class="stats">
        <div class="stat"><span>Čas</span><strong id="time-stat">${elapsedText()}</strong></div>
        <div class="stat"><span>Chyby</span><strong>${mistakes}</strong></div>
        <div class="stat"><span>Hotovo</span><strong>${completed}/${total}</strong></div>
      </div>
    </section>
    <div class="progress"><div style="width:${percent}%"></div></div>
    <p class="instruction">Vyberte český význam a odpovídající hebrejské slovíčko.</p>
    <section class="game-grid">
      <div class="word-column">
        <h2>Česky</h2>
        <div class="word-list">
          ${czechOrder.map((pair) => wordButton(pair, "czech")).join("")}
        </div>
      </div>
      <div class="word-column">
        <h2>Hebrejsky</h2>
        <div class="word-list">
          ${hebrewOrder.map((pair) => wordButton(pair, "hebrew")).join("")}
        </div>
      </div>
    </section>
  `;
  app.querySelectorAll(".word-button").forEach((button) => {
    button.addEventListener("click", () => chooseWord(button.dataset.side, button.dataset.id));
  });
}

function wordButton(pair, side) {
  const id = String(pair.id);
  const selected = side === "hebrew" ? selectedHebrew === id : selectedCzech === id;
  const classes = [
    "word-button",
    side === "hebrew" ? "hebrew" : "",
    selected ? "selected" : "",
    matched.has(id) ? "matched" : "",
    wrongId === id ? "wrong" : ""
  ].filter(Boolean).join(" ");
  const text = side === "hebrew" ? pair.hebrew : pair.czech;
  return `<button type="button" class="${classes}" data-side="${side}" data-id="${id}">${escapeHtml(text)}</button>`;
}

function chooseWord(side, id) {
  if (matched.has(id)) return;
  wrongId = null;
  if (side === "hebrew") selectedHebrew = selectedHebrew === id ? null : id;
  else selectedCzech = selectedCzech === id ? null : id;

  if (selectedHebrew && selectedCzech) {
    if (selectedHebrew === selectedCzech) {
      matched.add(id);
      completed += 1;
      selectedHebrew = null;
      selectedCzech = null;
      if (matched.size === round.length) {
        if (queue.length) {
          setTimeout(nextRound, 220);
        } else {
          setTimeout(finishLesson, 220);
        }
        return;
      }
    } else {
      mistakes += 1;
      wrongId = selectedHebrew;
      const wrongCzech = selectedCzech;
      renderGame();
      const other = app.querySelector(`[data-side="czech"][data-id="${CSS.escape(wrongCzech)}"]`);
      if (other) other.classList.add("wrong");
      setTimeout(() => {
        selectedHebrew = null;
        selectedCzech = null;
        wrongId = null;
        renderGame();
      }, 520);
      return;
    }
  }
  renderGame();
}

function updateStats() {
  const node = document.querySelector("#time-stat");
  if (node) node.textContent = elapsedText();
}

function finishLesson() {
  stopTimer();
  const count = completionCount(lesson.id) + 1;
  localStorage.setItem(completionKey(lesson.id), String(count));
  app.innerHTML = `
    <section class="finished">
      <div class="check">✓</div>
      <h1>Lekce dokončena</h1>
      <p><strong>${escapeHtml(lesson.title)}</strong></p>
      <p>Čas: ${elapsedText()} · Chyby: ${mistakes}</p>
      <button id="repeat-button" class="secondary" type="button">Procvičit znovu</button>
      <button id="library-button" class="primary" type="button">Zpět na lekce</button>
    </section>
  `;
  document.querySelector("#repeat-button").addEventListener("click", () => startLesson(lesson));
  document.querySelector("#library-button").addEventListener("click", showLibrary);
}

loadLessons();
