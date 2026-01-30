// ============ GAME STATE ============
let CONTENT = null;
let mode = "practice"; // practice | streak | boss | study
let queue = [];
let bossPool = [];
let skipped = [];
let inSkippedPhase = false;
let current = null;
let studyIndex = 0;

let score = 0;
let streak = 0;
let misses = 0;
let qIndex = 0;
let totalQs = 0;
let bossCorrect = 0; // Track mastered questions in Boss mode

// ============ PERSISTENT STATE (localStorage) ============
const STORAGE_KEY = "studyQuizSave";
let gameData = {
  xp: 0,
  level: 1,
  totalCorrect: 0,
  totalWrong: 0,
  unlockedThemes: ["default"],
  currentTheme: "default",
  mastery: {} // questionId -> mastery score (0-5)
};

// ============ LEVEL & THEME CONFIG ============
const LEVELS = [
  { level: 1, xpRequired: 0, title: "Beginner" },
  { level: 2, xpRequired: 100, title: "Student", unlockTheme: "ocean" },
  { level: 3, xpRequired: 250, title: "Scholar", unlockTheme: "forest" },
  { level: 4, xpRequired: 500, title: "Expert", unlockTheme: "sunset" },
  { level: 5, xpRequired: 800, title: "Master", unlockTheme: "galaxy" },
  { level: 6, xpRequired: 1200, title: "Champion", unlockTheme: "rainbow" }
];

const THEMES = {
  default: { name: "Default", primary: "#4f46e5", accent: "#22c55e", bg: "#0b1220" },
  ocean: { name: "Ocean", primary: "#0891b2", accent: "#06b6d4", bg: "#0c1929" },
  forest: { name: "Forest", primary: "#16a34a", accent: "#84cc16", bg: "#0f1f0f" },
  sunset: { name: "Sunset", primary: "#ea580c", accent: "#f59e0b", bg: "#1f1410" },
  galaxy: { name: "Galaxy", primary: "#7c3aed", accent: "#a855f7", bg: "#0f0a1f" },
  rainbow: { name: "Rainbow", primary: "#ec4899", accent: "#8b5cf6", bg: "#1a0f1f" }
};

const ENCOURAGEMENTS = [
  "You've got this! 💪",
  "Keep trying! 🌟",
  "Almost there! 🎯",
  "Don't give up! 🚀",
  "Learning is fun! 📚",
  "You're doing great! ⭐"
];

// ============ SOUND SYSTEM ============
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

function playTone(frequency, duration, type = "sine", volume = 0.3) {
  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

  gainNode.gain.setValueAtTime(volume, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + duration);
}

function playCorrectSound() {
  const ctx = getAudioContext();
  // Happy rising arpeggio
  const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.15, "sine", 0.25), i * 80);
  });
}

function playWrongSound() {
  // Gentle descending tone (not harsh - this is for kids!)
  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(350, ctx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.3);

  gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + 0.3);
}

function playLevelUpSound() {
  // Triumphant fanfare!
  const notes = [
    { freq: 523.25, delay: 0 },     // C5
    { freq: 659.25, delay: 100 },   // E5
    { freq: 783.99, delay: 200 },   // G5
    { freq: 1046.50, delay: 300 },  // C6
    { freq: 783.99, delay: 450 },   // G5
    { freq: 1046.50, delay: 550 }   // C6 (held longer)
  ];

  notes.forEach(({ freq, delay }, i) => {
    const duration = i === notes.length - 1 ? 0.4 : 0.2;
    setTimeout(() => playTone(freq, duration, "sine", 0.3), delay);
  });
}

function playStreakSound() {
  // Extra celebratory sound for streaks
  const notes = [659.25, 783.99, 987.77, 1174.66]; // E5, G5, B5, D6
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.12, "triangle", 0.2), i * 60);
  });
}

// ============ DOM ELEMENTS ============
const el = (id) => document.getElementById(id);

const titleEl = el("title");
const subtitleEl = el("subtitle");
const statusLeft = el("statusLeft");
const statusMid = el("statusMid");
const statusRight = el("statusRight");

const errorBox = el("errorBox");
const questionBox = el("questionBox");
const promptEl = el("prompt");
const answerArea = el("answerArea");
const feedbackEl = el("feedback");

const submitBtn = el("submitBtn");
const nextBtn = el("nextBtn");
const skipBtn = el("skipBtn");
const closeEnoughBtn = el("closeEnoughBtn");
const lenientToggle = el("lenientToggle");

const xpBarFill = el("xpBarFill");
const xpText = el("xpText");
const levelText = el("levelText");
const masteryText = el("masteryText");
const themeSelect = el("themeSelect");
const confettiContainer = el("confetti");
const levelUpModal = el("levelUpModal");
const levelUpMessage = el("levelUpMessage");
const levelUpClose = el("levelUpClose");
const studyArea = el("studyArea");

// ============ LOCAL STORAGE ============
function saveGame() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(gameData));
}

function loadGame() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      gameData = { ...gameData, ...parsed };
    }
  } catch (e) {
    console.warn("Could not load save data", e);
  }
}

function resetProgress() {
  if (confirm("Are you sure you want to reset ALL progress?\n\nThis will clear:\n• XP and level\n• Unlocked themes\n• Question mastery scores\n\nThis cannot be undone!")) {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }
}

// ============ XP & LEVELING ============
function getLevelInfo(level) {
  return LEVELS.find(l => l.level === level) || LEVELS[LEVELS.length - 1];
}

function getNextLevelInfo(level) {
  return LEVELS.find(l => l.level === level + 1);
}

function calculateLevel(xp) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].xpRequired) return LEVELS[i].level;
  }
  return 1;
}

function awardXP(baseXP) {
  // Streak bonus: multiply by streak (capped at 5x)
  const multiplier = Math.min(streak, 5);
  const bonusXP = baseXP + (multiplier > 1 ? Math.floor(baseXP * (multiplier - 1) * 0.5) : 0);

  const oldLevel = gameData.level;
  gameData.xp += bonusXP;
  gameData.level = calculateLevel(gameData.xp);

  updateXPDisplay();
  saveGame();

  // Check for level up
  if (gameData.level > oldLevel) {
    onLevelUp(gameData.level);
  }

  return bonusXP;
}

function updateXPDisplay() {
  const currentLevelInfo = getLevelInfo(gameData.level);
  const nextLevelInfo = getNextLevelInfo(gameData.level);

  levelText.textContent = `Level ${gameData.level}: ${currentLevelInfo.title}`;

  if (nextLevelInfo) {
    const xpIntoLevel = gameData.xp - currentLevelInfo.xpRequired;
    const xpNeeded = nextLevelInfo.xpRequired - currentLevelInfo.xpRequired;
    const percent = Math.min((xpIntoLevel / xpNeeded) * 100, 100);
    xpBarFill.style.width = percent + "%";
    xpText.textContent = `${gameData.xp} XP (${nextLevelInfo.xpRequired - gameData.xp} to next level)`;
  } else {
    xpBarFill.style.width = "100%";
    xpText.textContent = `${gameData.xp} XP (MAX LEVEL!)`;
  }
}

function onLevelUp(newLevel) {
  const levelInfo = getLevelInfo(newLevel);

  // Check for theme unlock
  if (levelInfo.unlockTheme && !gameData.unlockedThemes.includes(levelInfo.unlockTheme)) {
    gameData.unlockedThemes.push(levelInfo.unlockTheme);
    const themeName = THEMES[levelInfo.unlockTheme].name;
    levelUpMessage.textContent = `You reached Level ${newLevel}: ${levelInfo.title}! You unlocked the ${themeName} theme!`;
  } else {
    levelUpMessage.textContent = `You reached Level ${newLevel}: ${levelInfo.title}!`;
  }

  updateThemeSelector();
  saveGame();

  // Play level up fanfare!
  playLevelUpSound();

  // Show celebration
  levelUpModal.classList.remove("hidden");
  triggerConfetti(50);
}

// ============ THEME SYSTEM ============
function applyTheme(themeId) {
  const theme = THEMES[themeId] || THEMES.default;
  document.documentElement.style.setProperty("--primary", theme.primary);
  document.documentElement.style.setProperty("--accent", theme.accent);
  document.documentElement.style.setProperty("--bg", theme.bg);
  gameData.currentTheme = themeId;
  saveGame();
}

function updateThemeSelector() {
  themeSelect.innerHTML = "";
  gameData.unlockedThemes.forEach(themeId => {
    const theme = THEMES[themeId];
    if (theme) {
      const opt = document.createElement("option");
      opt.value = themeId;
      opt.textContent = theme.name;
      if (themeId === gameData.currentTheme) opt.selected = true;
      themeSelect.appendChild(opt);
    }
  });

  // Update theme hint visibility
  const themeHint = el("themeHint");
  if (themeHint) {
    if (gameData.unlockedThemes.length > 1) {
      themeHint.classList.add("hidden");
    } else {
      themeHint.classList.remove("hidden");
    }
  }
}

// ============ MASTERY & SPACED REPETITION ============
function getMastery(questionId) {
  return gameData.mastery[questionId] || 0;
}

function updateMastery(questionId, correct) {
  const current = getMastery(questionId);
  if (correct) {
    gameData.mastery[questionId] = Math.min(current + 1, 5);
  } else {
    gameData.mastery[questionId] = Math.max(current - 1, 0);
  }
  saveGame();
  updateMasteryDisplay();
}

function updateMasteryDisplay() {
  if (!CONTENT) return;
  const mastered = CONTENT.questions.filter(q => getMastery(q.id) >= 5).length;
  const total = CONTENT.questions.length;
  masteryText.textContent = `Mastered: ${mastered}/${total} ⭐`;
}

function getWeightedQuestions() {
  // Lower mastery = higher weight (appears more often)
  const weighted = [];
  CONTENT.questions.forEach(q => {
    const mastery = getMastery(q.id);
    // Weight: 5 for mastery 0, 4 for mastery 1, etc., minimum 1
    const weight = Math.max(5 - mastery, 1);
    for (let i = 0; i < weight; i++) {
      weighted.push(q);
    }
  });
  return shuffle(weighted);
}

// ============ CONFETTI ============
function triggerConfetti(count = 30) {
  confettiContainer.innerHTML = "";
  const colors = ["#ff6b6b", "#4ecdc4", "#ffe66d", "#95e1d3", "#f38181", "#aa96da", "#fcbad3"];

  for (let i = 0; i < count; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.style.left = Math.random() * 100 + "%";
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = Math.random() * 0.5 + "s";
    piece.style.animationDuration = (Math.random() * 1 + 1.5) + "s";
    confettiContainer.appendChild(piece);
  }

  setTimeout(() => {
    confettiContainer.innerHTML = "";
  }, 3000);
}

// ============ UTILITY ============
function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.remove("hidden");
  questionBox.classList.add("hidden");
  if (studyArea) studyArea.classList.add("hidden");
}

function clearError() {
  errorBox.classList.add("hidden");
}

function setStatus() {
  statusLeft.textContent = `Score: ${score}`;
  const streakEmoji = streak >= 3 ? " 🔥" : "";
  statusMid.textContent = `Streak: ${streak}${streakEmoji}${mode === "streak" ? ` | Misses: ${misses}/2` : ""}`;

  // In Boss mode, show how many questions mastered vs total, not attempt count
  if (mode === "boss") {
    statusRight.textContent = `Mastered: ${bossCorrect}/${totalQs}`;
  } else {
    statusRight.textContent = `Q: ${Math.min(qIndex, totalQs)}/${totalQs}`;
  }
}

function normalize(s) {
  return (s ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[""]/g, '"')
    .replace(/[']/g, "'")
    .replace(/\s+/g, " ");
}

function lenientMatch(user, answer) {
  // Clean: normalize, replace hyphens with spaces, remove other punctuation
  const clean = (x) => normalize(x).replace(/-/g, " ").replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
  const u = clean(user);
  const a = clean(answer);
  if (!u || !a) return false;
  if (u === a) return true;
  if (u.includes(a) || a.includes(u)) return true;

  const ut = new Set(u.split(" ").filter(Boolean));
  const at = new Set(a.split(" ").filter(Boolean));

  // Remove common filler words from answer when checking overlap
  const fillers = new Set(["a", "an", "the", "is", "are", "was", "were", "of", "to", "and"]);
  const atCore = new Set([...at].filter(w => !fillers.has(w)));

  let inter = 0;
  for (const t of ut) if (at.has(t) || atCore.has(t)) inter++;

  // Check if user got all the important (non-filler) words
  let coreMatches = 0;
  for (const t of atCore) if (ut.has(t)) coreMatches++;
  const coreOverlap = coreMatches / Math.max(1, atCore.size);

  // Pass if 70% total overlap OR if all core words match
  const overlap = inter / Math.max(1, at.size);
  return overlap >= 0.70 || coreOverlap >= 0.90;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function validateContent(json) {
  if (!json || typeof json !== "object") throw new Error("current.json must be a JSON object.");
  if (!Array.isArray(json.questions)) throw new Error("current.json must have a 'questions' array.");
  json.questions.forEach((q, i) => {
    if (!q.id) throw new Error(`Question #${i + 1} missing 'id'.`);
    if (!q.type) throw new Error(`Question '${q.id}' missing 'type'.`);
    if (!q.prompt) throw new Error(`Question '${q.id}' missing 'prompt'.`);
    const t = q.type;
    if (t === "multiple_choice") {
      if (!Array.isArray(q.choices) || q.choices.length < 2) throw new Error(`Question '${q.id}' needs 'choices' (2+).`);
      if (typeof q.answer !== "string") throw new Error(`Question '${q.id}' needs string 'answer'.`);
    } else if (t === "true_false") {
      if (typeof q.answer !== "boolean") throw new Error(`Question '${q.id}' needs boolean 'answer'.`);
    } else if (t === "short_answer") {
      if (typeof q.answer !== "string") throw new Error(`Question '${q.id}' needs string 'answer'.`);
    } else if (t === "order") {
      if (!Array.isArray(q.items) || q.items.length < 2) throw new Error(`Question '${q.id}' needs 'items' (2+).`);
      if (!Array.isArray(q.answerOrder) || q.answerOrder.length !== q.items.length) {
        throw new Error(`Question '${q.id}' needs 'answerOrder' same length as 'items'.`);
      }
    } else {
      throw new Error(`Question '${q.id}' has unsupported type '${t}'.`);
    }
  });
}

// ============ CONTENT LOADING ============
const loadingIndicator = el("loadingIndicator");

async function loadContent() {
  clearError();
  loadingIndicator.classList.remove("hidden");
  questionBox.classList.add("hidden");
  if (studyArea) studyArea.classList.add("hidden");

  try {
    const res = await fetch("content/current.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`Could not load content/current.json (HTTP ${res.status}).`);
    const json = await res.json();
    validateContent(json);
    CONTENT = json;

    titleEl.textContent = json.title || "Study Quiz";
    subtitleEl.textContent = json.testDate ? `Test date: ${json.testDate}` : "";

    // Initialize UI
    loadingIndicator.classList.add("hidden");
    questionBox.classList.remove("hidden");
    feedbackEl.classList.add("hidden");
    if (studyArea) studyArea.classList.add("hidden");

    updateMasteryDisplay();
    startMode("practice");
  } catch (e) {
    loadingIndicator.classList.add("hidden");
    showError(e.message || String(e));
  }
}

// ============ GAME MODES ============
function updateActiveModeButton(activeMode) {
  // Remove active class from all mode buttons
  document.querySelectorAll(".mode-btn").forEach(btn => btn.classList.remove("active"));

  // Add active class to the current mode button
  const modeMap = {
    study: "modeStudy",
    practice: "modePractice",
    streak: "modeStreak",
    boss: "modeBoss"
  };
  const activeBtn = el(modeMap[activeMode]);
  if (activeBtn) activeBtn.classList.add("active");
}

function startMode(newMode) {
  mode = newMode;
  score = 0;
  streak = 0;
  misses = 0;
  qIndex = 0;
  bossPool = [];
  bossCorrect = 0;
  skipped = [];
  inSkippedPhase = false;
  studyIndex = 0;

  // Highlight the active mode button
  updateActiveModeButton(newMode);

  if (studyArea) studyArea.classList.add("hidden");
  questionBox.classList.remove("hidden");

  if (mode === "study") {
    startStudyMode();
    return;
  }

  // Use weighted questions for spaced repetition in practice mode
  if (mode === "practice") {
    queue = getWeightedQuestions();
    // Remove duplicates for practice (just shuffle unique questions weighted)
    const seen = new Set();
    queue = queue.filter(q => {
      if (seen.has(q.id)) return false;
      seen.add(q.id);
      return true;
    });
  } else {
    queue = shuffle(CONTENT.questions);
  }

  totalQs = queue.length;

  nextBtn.classList.add("hidden");
  submitBtn.classList.remove("hidden");
  skipBtn.classList.remove("hidden");
  feedbackEl.classList.add("hidden");

  nextQuestion();
}

// ============ STUDY MODE (FLASHCARDS) ============
function startStudyMode() {
  questionBox.classList.add("hidden");
  studyArea.classList.remove("hidden");
  studyIndex = 0;

  // Set up click handler once (not on every render)
  const studyCard = el("studyCard");
  studyCard.onclick = () => {
    const answer = studyCard.querySelector(".study-answer");
    const divider = studyCard.querySelector(".study-divider");
    if (answer) answer.classList.toggle("hidden");
    if (divider) divider.classList.toggle("hidden");
  };

  renderStudyCard();
}

function renderStudyCard() {
  const studyCard = el("studyCard");
  const studyProgress = el("studyProgress");
  const studyPrev = el("studyPrev");
  const studyNext = el("studyNext");
  const studyDone = el("studyDone");

  if (!CONTENT || !CONTENT.questions.length) return;

  const q = CONTENT.questions[studyIndex];
  const mastery = getMastery(q.id);
  const masteryStars = "⭐".repeat(mastery) + "☆".repeat(5 - mastery);

  // Friendly question type labels
  const typeLabels = {
    multiple_choice: "📋 Multiple Choice",
    true_false: "✓✗ True or False",
    short_answer: "✏️ Fill in the Blank",
    order: "🔢 Put in Order"
  };
  const typeLabel = typeLabels[q.type] || q.type;

  let answerText = "";
  if (q.type === "true_false") {
    answerText = q.answer ? "✓ True" : "✗ False";
  } else if (q.type === "order") {
    answerText = q.answerOrder.join(" → ");
  } else {
    answerText = q.answer;
  }

  studyCard.innerHTML = `
    <div class="study-type">${typeLabel}</div>
    <div class="study-question">${q.prompt}</div>
    <div class="study-divider">tap to see answer</div>
    <div class="study-answer hidden">${answerText}</div>
    <div class="study-mastery">${masteryStars}</div>
  `;

  studyProgress.textContent = `Card ${studyIndex + 1} of ${CONTENT.questions.length}`;
  studyPrev.disabled = studyIndex === 0;
  studyNext.classList.toggle("hidden", studyIndex === CONTENT.questions.length - 1);
  studyDone.classList.toggle("hidden", studyIndex !== CONTENT.questions.length - 1);
}

function studyPrevCard() {
  if (studyIndex > 0) {
    studyIndex--;
    renderStudyCard();
  }
}

function studyNextCard() {
  if (studyIndex < CONTENT.questions.length - 1) {
    studyIndex++;
    renderStudyCard();
  }
}

function finishStudy() {
  startMode("practice");
}

// ============ QUIZ FLOW ============
function nextQuestion() {
  feedbackEl.classList.add("hidden");
  nextBtn.classList.add("hidden");
  closeEnoughBtn.classList.add("hidden");
  submitBtn.classList.remove("hidden");
  skipBtn.classList.remove("hidden");

  if (mode === "boss") {
    // If both queues are empty, we've mastered everything!
    if (bossPool.length === 0 && queue.length === 0) {
      showCompletion("Boss Battle complete! 🎉🏆");
      triggerConfetti(50);
      return;
    }

    // Prioritize main queue first, then work through missed questions
    if (queue.length > 0) {
      current = queue.shift();
    } else {
      // Shuffle bossPool so missed questions come back in random order
      bossPool = shuffle(bossPool);
      current = bossPool.shift();
    }
  } else {
    current = queue.shift();

    // Check if we need to start the skipped phase
    if (!current && skipped.length > 0 && !inSkippedPhase) {
      inSkippedPhase = true;
      queue = shuffle(skipped);
      skipped = [];
      totalQs = queue.length;
      qIndex = 0;
      showFeedback(`Now reviewing ${totalQs} skipped question${totalQs > 1 ? "s" : ""}! 📝`, false, true);
      current = queue.shift();
    }

    if (!current) {
      showCompletion("Practice complete! 🎉");
      triggerConfetti(30);
      return;
    }
  }

  qIndex++;
  setStatus();
  renderQuestion(current);
}

function showCompletion(msg) {
  promptEl.textContent = msg;
  answerArea.innerHTML = `<div class="completion-stats">
    <div>Total XP: ${gameData.xp}</div>
    <div>Session Score: ${score}</div>
    <div>Questions Mastered: ${CONTENT.questions.filter(q => getMastery(q.id) >= 5).length}/${CONTENT.questions.length}</div>
  </div>`;
  submitBtn.classList.add("hidden");
  nextBtn.classList.add("hidden");
  feedbackEl.classList.add("hidden");
}

function renderQuestion(q) {
  const mastery = getMastery(q.id);
  const masteryIndicator = mastery >= 5 ? " ⭐" : "";
  promptEl.textContent = q.prompt + masteryIndicator;
  answerArea.innerHTML = "";

  if (q.type === "multiple_choice") {
    const choices = q.choices;
    let selected = null;

    choices.forEach((c) => {
      const btn = document.createElement("button");
      btn.className = "choice";
      btn.textContent = c;
      btn.onclick = () => {
        selected = c;
        [...answerArea.querySelectorAll(".choice")].forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
      };
      answerArea.appendChild(btn);
    });

    q.__getUserAnswer = () => selected;

  } else if (q.type === "true_false") {
    let selected = null;
    ["True", "False"].forEach((label) => {
      const btn = document.createElement("button");
      btn.className = "choice";
      btn.textContent = label;
      btn.onclick = () => {
        selected = (label === "True");
        [...answerArea.querySelectorAll(".choice")].forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
      };
      answerArea.appendChild(btn);
    });

    q.__getUserAnswer = () => selected;

  } else if (q.type === "short_answer") {
    const row = document.createElement("div");
    row.className = "inputRow";
    const input = document.createElement("input");
    input.className = "textInput";
    input.type = "text";
    input.placeholder = "Type your answer…";
    input.autocomplete = "off";
    row.appendChild(input);
    answerArea.appendChild(row);

    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") submitBtn.click();
    });

    // Auto-focus input for better UX
    setTimeout(() => input.focus(), 50);

    q.__getUserAnswer = () => input.value;

  } else if (q.type === "order") {
    let items = shuffle(q.items);

    const list = document.createElement("div");
    list.className = "orderList";

    function renderList() {
      list.innerHTML = "";
      items.forEach((item, idx) => {
        const row = document.createElement("div");
        row.className = "orderItem";
        const left = document.createElement("div");
        left.textContent = item;

        const btns = document.createElement("div");
        btns.className = "orderBtns";

        const up = document.createElement("button");
        up.className = "smallBtn";
        up.textContent = "↑";
        up.disabled = idx === 0;
        up.onclick = () => {
          [items[idx - 1], items[idx]] = [items[idx], items[idx - 1]];
          renderList();
        };

        const down = document.createElement("button");
        down.className = "smallBtn";
        down.textContent = "↓";
        down.disabled = idx === items.length - 1;
        down.onclick = () => {
          [items[idx + 1], items[idx]] = [items[idx], items[idx + 1]];
          renderList();
        };

        btns.appendChild(up);
        btns.appendChild(down);

        row.appendChild(left);
        row.appendChild(btns);
        list.appendChild(row);
      });
    }

    renderList();
    answerArea.appendChild(list);

    q.__getUserAnswer = () => items;
  }
}

function checkAnswer(q, userAnswer) {
  if (q.type === "multiple_choice") {
    return userAnswer === q.answer;
  }
  if (q.type === "true_false") {
    return userAnswer === q.answer;
  }
  if (q.type === "short_answer") {
    const strict = !lenientToggle.checked;
    if (strict) return normalize(userAnswer) === normalize(q.answer);
    return lenientMatch(userAnswer, q.answer);
  }
  if (q.type === "order") {
    if (!Array.isArray(userAnswer)) return false;
    const u = userAnswer.map(normalize);
    const a = q.answerOrder.map(normalize);
    if (u.length !== a.length) return false;
    for (let i = 0; i < a.length; i++) if (u[i] !== a[i]) return false;
    return true;
  }
  return false;
}

function onSubmit() {
  if (!current) return;

  const userAnswer = current.__getUserAnswer?.();
  if ((current.type === "multiple_choice" || current.type === "true_false") && (userAnswer === null || userAnswer === undefined)) {
    showFeedback("Pick an answer first 🙂", false, true);
    return;
  }

  const correct = checkAnswer(current, userAnswer);

  if (correct) {
    score += 10;
    streak += 1;
    gameData.totalCorrect++;

    // Award XP with streak bonus
    const xpEarned = awardXP(10);

    // Update mastery
    updateMastery(current.id, true);

    // Boss mode: track mastered questions (already removed from pool when shifted)
    if (mode === "boss") {
      bossCorrect++;
    }

    // Sound effects!
    if (streak >= 3) {
      playStreakSound();
    } else {
      playCorrectSound();
    }

    // Celebration!
    triggerConfetti(streak >= 3 ? 20 : 10);

    const streakBonus = streak >= 3 ? ` (${streak} streak! 🔥)` : "";
    showFeedback(`Correct! +${xpEarned} XP${streakBonus} 🎉`, true);
  } else {
    streak = 0;
    gameData.totalWrong++;

    // Play wrong sound
    playWrongSound();

    // Update mastery
    updateMastery(current.id, false);

    if (mode === "streak") {
      misses += 1;
      const encouragement = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];
      showFeedback(buildWrongFeedback(current) + " " + encouragement, false);
      if (misses >= 2) {
        submitBtn.classList.add("hidden");
        nextBtn.classList.add("hidden");
        setStatus();
        showFeedback(`Streak over! Final score: ${score}. ${encouragement}`, false);
        return;
      }
    } else if (mode === "boss") {
      // Add missed question back to bossPool (will see it again later, not immediately)
      bossPool.push(current);
      const encouragement = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];
      showFeedback(buildWrongFeedback(current) + " " + encouragement, false);
    } else {
      const encouragement = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];
      showFeedback(buildWrongFeedback(current) + " " + encouragement, false);
    }

    saveGame();

    // Show "Close Enough" button for short_answer questions
    if (current.type === "short_answer") {
      closeEnoughBtn.classList.remove("hidden");
    }
  }

  setStatus();
  submitBtn.classList.add("hidden");
  skipBtn.classList.add("hidden");
  nextBtn.classList.remove("hidden");
}

function buildWrongFeedback(q) {
  if (q.type === "true_false") return `The answer is: ${q.answer ? "True" : "False"}.`;
  if (q.type === "order") return `Correct order: ${q.answerOrder.join(" → ")}.`;
  return `The answer is: ${q.answer}.`;
}

function onSkip() {
  if (!current) return;

  // Don't allow skipping in streak mode (would be too easy)
  if (mode === "streak") {
    showFeedback("No skipping in Streak mode! 🔥", false, true);
    return;
  }

  // Add to skipped list
  skipped.push(current);
  showFeedback("Question skipped - you'll see it again later!", false, true);

  // Move to next question
  submitBtn.classList.add("hidden");
  skipBtn.classList.add("hidden");
  closeEnoughBtn.classList.add("hidden");
  nextBtn.classList.remove("hidden");
}

function onCloseEnough() {
  if (!current) return;

  // Undo the wrong answer effects
  gameData.totalWrong--;
  gameData.totalCorrect++;

  // Award points as if correct
  score += 10;
  streak += 1;
  const xpEarned = awardXP(10);

  // Update mastery positively (undo the -1, then +1)
  gameData.mastery[current.id] = Math.min((gameData.mastery[current.id] || 0) + 2, 5);
  saveGame();
  updateMasteryDisplay();

  // Boss mode: count as mastered and remove from bossPool (it was added when marked wrong)
  if (mode === "boss") {
    const idx = bossPool.findIndex(q => q.id === current.id);
    if (idx !== -1) bossPool.splice(idx, 1);
    bossCorrect++;
  }

  // Show success feedback
  triggerConfetti(10);
  showFeedback(`Accepted! +${xpEarned} XP 👍`, true);

  // Hide close enough button
  closeEnoughBtn.classList.add("hidden");
  setStatus();
}

function showFeedback(msg, good, soft = false) {
  feedbackEl.textContent = msg;
  feedbackEl.classList.remove("hidden");
  feedbackEl.classList.toggle("good", !!good);
  feedbackEl.classList.toggle("bad", !good && !soft);
}

// ============ EVENT WIRING ============
function initUI() {
  el("modePractice").onclick = () => startMode("practice");
  el("modeStreak").onclick = () => startMode("streak");
  el("modeBoss").onclick = () => startMode("boss");
  el("modeStudy").onclick = () => startMode("study");

  submitBtn.onclick = onSubmit;
  nextBtn.onclick = nextQuestion;
  skipBtn.onclick = onSkip;
  closeEnoughBtn.onclick = onCloseEnough;

  el("reloadBtn").onclick = () => loadContent();
  el("resetBtn").onclick = resetProgress;

  themeSelect.onchange = (e) => applyTheme(e.target.value);

  levelUpClose.onclick = () => levelUpModal.classList.add("hidden");

  // Study mode controls
  el("studyPrev").onclick = studyPrevCard;
  el("studyNext").onclick = studyNextCard;
  el("studyDone").onclick = finishStudy;

  // Global keyboard handlers
  document.addEventListener("keydown", (e) => {
    // Escape closes modal
    if (e.key === "Escape" && !levelUpModal.classList.contains("hidden")) {
      levelUpModal.classList.add("hidden");
      return;
    }

    // Study mode keyboard navigation
    if (mode === "study" && !studyArea.classList.contains("hidden")) {
      if (e.key === "ArrowLeft") {
        studyPrevCard();
      } else if (e.key === "ArrowRight") {
        studyNextCard();
      } else if (e.key === " " || e.key === "Enter") {
        // Flip card (unless typing in an input)
        if (document.activeElement.tagName !== "INPUT") {
          e.preventDefault();
          const studyCard = el("studyCard");
          studyCard.click();
        }
      }
    }
  });
}

// ============ INITIALIZATION ============
function init() {
  loadGame();
  updateXPDisplay();
  updateThemeSelector();
  applyTheme(gameData.currentTheme);
  initUI();
  loadContent();
}

init();
