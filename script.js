const BASE_SIZE = 6;
let SIZE = BASE_SIZE;

const boardElement = document.getElementById("board");
const clicksElement = document.getElementById("clicks");
const scoreElement = document.getElementById("score");
const messageElement = document.getElementById("message");
const resetBtn = document.getElementById("resetBtn");
const newPuzzleBtn = document.getElementById("newPuzzleBtn");
const difficultySelect = document.getElementById("difficulty");
const milestoneElement = document.getElementById("milestone");

const soundButton = document.getElementById("soundButton");
const soundCollect = document.getElementById("soundCollect");
const soundMiss = document.getElementById("soundMiss");
const soundWin = document.getElementById("soundWin");

let board = [];
let clickCount = 0;
let puzzleSolved = false;
let difficulty = "normal";
let waterScore = 0;
let highestWaterScore = 0;
let lastTriggeredMilestoneIndex = -1;

const directions = ["up", "right", "down", "left"];

const difficultySettings = {
  easy: {
    pathWanderChance: 0.35,
    extraRockChance: 0.12,
    scrambleMin: 1,
    scrambleRange: 2,
    milestoneThresholds: [3, 6, 10],
    extraSolutionCount: 1
  },
  normal: {
    pathWanderChance: 0.55,
    extraRockChance: 0.22,
    scrambleMin: 1,
    scrambleRange: 3,
    milestoneThresholds: [4, 8, 12],
    extraSolutionCount: 1
  },
  hard: {
    pathWanderChance: 0.72,
    extraRockChance: 0.3,
    scrambleMin: 2,
    scrambleRange: 3,
    milestoneThresholds: [5, 10, 15],
    extraSolutionCount: 2
  }
};

const milestoneMessages = [
  "💧 Water is flowing...",
  "🚰 Halfway there!",
  "🌍 A village is counting on you!"
];

const DIR_VECTORS = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 }
};

const OPPOSITE = {
  up: "down",
  right: "left",
  down: "up",
  left: "right"
};

function randomInt(max) {
  return Math.floor(Math.random() * max);
}

function playSound(audioElement) {
  if (!audioElement) return;

  try {
    audioElement.pause();
    audioElement.currentTime = 0;
    const playPromise = audioElement.play();

    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        // Ignore autoplay/user gesture issues silently.
      });
    }
  } catch {
    // Ignore audio playback errors.
  }
}

function updateClicks() {
  clicksElement.textContent = clickCount;
}

function updateScore() {
  scoreElement.textContent = waterScore;
  updateMilestone();
}

function updateMilestone() {
  const thresholds = difficultySettings[difficulty].milestoneThresholds;
  let newestMilestoneIndex = -1;

  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (highestWaterScore >= thresholds[i]) {
      newestMilestoneIndex = i;
      break;
    }
  }

  if (newestMilestoneIndex >= 0) {
    milestoneElement.textContent = milestoneMessages[newestMilestoneIndex];

    if (newestMilestoneIndex > lastTriggeredMilestoneIndex && !puzzleSolved) {
      lastTriggeredMilestoneIndex = newestMilestoneIndex;
    }
  } else {
    milestoneElement.textContent = "";
  }
}

function setMessage(text, type = "") {
  messageElement.textContent = text;
  messageElement.className = "message";
  if (type) {
    messageElement.classList.add(type);
  }
}

function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < SIZE && y < SIZE;
}

function getNeighborsForPath(x, y, visited) {
  const candidates = [];

  if (x + 1 < SIZE && !visited.has(`${x + 1},${y}`)) {
    candidates.push({ x: x + 1, y: y });
  }

  if (y + 1 < SIZE && !visited.has(`${x},${y + 1}`)) {
    candidates.push({ x: x, y: y + 1 });
  }

  return candidates;
}

function buildGuaranteedPath() {
  const wanderChance = difficultySettings[difficulty].pathWanderChance;

  while (true) {
    const path = [{ x: 0, y: 0 }];
    const visited = new Set(["0,0"]);

    let x = 0;
    let y = 0;

    while (!(x === SIZE - 1 && y === SIZE - 1)) {
      const candidates = getNeighborsForPath(x, y, visited);

      if (candidates.length === 0) {
        break;
      }

      let next;

      if (candidates.length === 2) {
        const distanceToGoal = (SIZE - 1 - x) + (SIZE - 1 - y);
        const shouldWander = Math.random() < wanderChance && distanceToGoal > 3;
        next = shouldWander ? candidates[randomInt(2)] : candidates[0];
      } else {
        next = candidates[0];
      }

      x = next.x;
      y = next.y;
      visited.add(`${x},${y}`);
      path.push({ x, y });
    }

    if (x === SIZE - 1 && y === SIZE - 1 && path.length >= SIZE + 2) {
      return path;
    }
  }
}

function directionBetween(a, b) {
  if (b.x === a.x && b.y === a.y - 1) return "up";
  if (b.x === a.x + 1 && b.y === a.y) return "right";
  if (b.x === a.x && b.y === a.y + 1) return "down";
  if (b.x === a.x - 1 && b.y === a.y) return "left";
  return null;
}

function connectionKey(connections) {
  return [...connections]
    .sort((a, b) => directions.indexOf(a) - directions.indexOf(b))
    .join(",");
}

function pipeFromConnections(connections) {
  const key = connectionKey(connections);

  if (key === "left,right") return { type: "straight", rotation: 1 };
  if (key === "up,down") return { type: "straight", rotation: 0 };
  if (key === "up,right") return { type: "corner", rotation: 0 };
  if (key === "right,down") return { type: "corner", rotation: 1 };
  if (key === "down,left") return { type: "corner", rotation: 2 };
  if (key === "up,left") return { type: "corner", rotation: 3 };

  if (key === "up,right,left") return { type: "tee", rotation: 0 };
  if (key === "up,right,down") return { type: "tee", rotation: 1 };
  if (key === "right,down,left") return { type: "tee", rotation: 2 };
  if (key === "up,down,left") return { type: "tee", rotation: 3 };

  if (key === "up,right,down,left") return { type: "cross", rotation: 0 };

  return { type: "straight", rotation: 0 };
}

function createTile(x, y, type, rotation, solvedRotation, isPath = false, fixedConnections = null) {
  return {
    x,
    y,
    type,
    rotation,
    solvedRotation,
    isPath,
    isWinningPath: false,
    fixedConnections
  };
}

function scrambleTurnsForTile(tile) {
  if (tile.type === "cross") {
    return 0;
  }

  const settings = difficultySettings[difficulty];
  return settings.scrambleMin + randomInt(settings.scrambleRange);
}

function pathToSet(path) {
  return new Set(path.map((point) => `${point.x},${point.y}`));
}

function buildAlternatePaths(primaryPath, count) {
  const primarySet = pathToSet(primaryPath);
  const alternatePaths = [];
  const uniqueSignatures = new Set([primaryPath.map((p) => `${p.x},${p.y}`).join("|")]);
  const minimumUniqueCells = 2;

  let attempts = 0;
  while (alternatePaths.length < count && attempts < 600) {
    attempts += 1;

    const candidate = buildGuaranteedPath();
    const signature = candidate.map((p) => `${p.x},${p.y}`).join("|");

    if (uniqueSignatures.has(signature)) {
      continue;
    }

    let uniqueToCandidate = 0;
    for (const point of candidate) {
      if (!primarySet.has(`${point.x},${point.y}`)) {
        uniqueToCandidate += 1;
      }
    }

    if (uniqueToCandidate < minimumUniqueCells) {
      continue;
    }

    uniqueSignatures.add(signature);
    alternatePaths.push(candidate);
  }

  return alternatePaths;
}

function buildConnectionMap(paths) {
  const connectionMap = new Map();

  function ensureEntry(x, y) {
    const key = `${x},${y}`;
    if (!connectionMap.has(key)) {
      connectionMap.set(key, new Set());
    }
    return connectionMap.get(key);
  }

  for (const path of paths) {
    for (let i = 0; i < path.length - 1; i++) {
      const current = path[i];
      const next = path[i + 1];
      const dir = directionBetween(current, next);

      if (!dir) {
        continue;
      }

      ensureEntry(current.x, current.y).add(dir);
      ensureEntry(next.x, next.y).add(OPPOSITE[dir]);
    }
  }

  return connectionMap;
}

function generatePuzzle() {
  const solvedBoard = Array.from({ length: SIZE }, (_, y) =>
    Array.from({ length: SIZE }, (_, x) =>
      createTile(x, y, "rock", 0, 0, false)
    )
  );

  const mainPath = buildGuaranteedPath();
  const extraPaths = buildAlternatePaths(mainPath, difficultySettings[difficulty].extraSolutionCount);
  const allPaths = [mainPath, ...extraPaths];
  const connectionMap = buildConnectionMap(allPaths);

  for (const [key, connectionSet] of connectionMap.entries()) {
    const [x, y] = key.split(",").map(Number);
    const connections = [...connectionSet];

    if (x === 0 && y === 0) {
      solvedBoard[y][x] = createTile(
        x,
        y,
        "source",
        0,
        0,
        true,
        connections
      );
      continue;
    }

    if (x === SIZE - 1 && y === SIZE - 1) {
      solvedBoard[y][x] = createTile(
        x,
        y,
        "village",
        0,
        0,
        true,
        connections
      );
      continue;
    }

    const pipe = pipeFromConnections(connections);
    solvedBoard[y][x] = createTile(
      x,
      y,
      pipe.type,
      pipe.rotation,
      pipe.rotation,
      true
    );
  }

  const rockChance = difficultySettings[difficulty].extraRockChance;

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (solvedBoard[y][x].isPath) {
        continue;
      }

      const roll = Math.random();

      if (roll < rockChance) {
        solvedBoard[y][x] = createTile(x, y, "rock", 0, 0, false);
      } else {
        const randomTypeRoll = Math.random();
        let type = "corner";

        if (randomTypeRoll < 0.4) {
          type = "straight";
        } else if (randomTypeRoll < 0.75) {
          type = "corner";
        } else if (randomTypeRoll < 0.92) {
          type = "tee";
        } else {
          type = "cross";
        }

        const solvedRotation = type === "cross" ? 0 : randomInt(4);
        solvedBoard[y][x] = createTile(x, y, type, solvedRotation, solvedRotation, false);
      }
    }
  }

  board = solvedBoard.map((row) =>
    row.map((tile) => {
      if (tile.type === "source" || tile.type === "village" || tile.type === "rock") {
        return { ...tile, isWinningPath: false };
      }

      return {
        ...tile,
        rotation: (tile.solvedRotation + scrambleTurnsForTile(tile)) % 4,
        isWinningPath: false
      };
    })
  );

  clickCount = 0;
  waterScore = 0;
  highestWaterScore = 0;
  lastTriggeredMilestoneIndex = -1;
  puzzleSolved = false;
  updateClicks();
  updateScore();
  setMessage("Rotate the pipes to connect the water source to the village.", "info");
  drawBoard();
  evaluateBoardState(false);
}

function getConnections(tile) {
  if (tile.type === "rock") return [];

  if (tile.fixedConnections) {
    return tile.fixedConnections;
  }

  if (tile.type === "source") {
    return tile.rotation === 0 ? ["right"] : ["down"];
  }

  if (tile.type === "village") {
    return tile.rotation === 0 ? ["left"] : ["up"];
  }

  if (tile.type === "straight") {
    return tile.rotation % 2 === 0 ? ["up", "down"] : ["left", "right"];
  }

  if (tile.type === "corner") {
    const map = [
      ["up", "right"],
      ["right", "down"],
      ["down", "left"],
      ["left", "up"]
    ];
    return map[tile.rotation];
  }

  if (tile.type === "tee") {
    const map = [
      ["up", "right", "left"],
      ["up", "right", "down"],
      ["right", "down", "left"],
      ["up", "down", "left"]
    ];
    return map[tile.rotation];
  }

  if (tile.type === "cross") {
    return ["up", "right", "down", "left"];
  }

  return [];
}

function getTileSymbol(tile) {
  if (tile.type === "source") return "🚰";
  if (tile.type === "village") return "🏠";
  if (tile.type === "rock") return "🪨";

  if (tile.type === "straight") {
    return tile.rotation % 2 === 0 ? "│" : "─";
  }

  if (tile.type === "corner") {
    const symbols = ["└", "┌", "┐", "┘"];
    return symbols[tile.rotation];
  }

  if (tile.type === "tee") {
    const symbols = ["┴", "├", "┬", "┤"];
    return symbols[tile.rotation];
  }

  if (tile.type === "cross") {
    return "┼";
  }

  return "";
}

function drawBoard() {
  boardElement.innerHTML = "";

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const tile = board[y][x];
      const el = document.createElement("button");

      el.type = "button";
      el.className = "tile";
      el.textContent = getTileSymbol(tile);
      el.setAttribute("aria-label", `Tile ${x + 1}, ${y + 1}`);
      el.setAttribute("data-pipe-type", tile.type);

      if (tile.type === "source") el.classList.add("source");
      if (tile.type === "village") el.classList.add("village");
      if (tile.type === "rock") el.classList.add("obstacle");
      if (tile.isWinningPath) el.classList.add("winning-path");

      el.addEventListener("click", () => handleTileClick(x, y));
      boardElement.appendChild(el);
    }
  }
}

function flashTile(x, y, className) {
  const index = y * SIZE + x;
  const el = boardElement.children[index];
  if (!el) return;

  el.classList.add(className);
  setTimeout(() => {
    el.classList.remove(className);
  }, 180);
}

function clearWinningPath() {
  for (const row of board) {
    for (const tile of row) {
      tile.isWinningPath = false;
    }
  }
}

function getTraversalFromSource() {
  const queue = [{ x: 0, y: 0 }];
  const visited = new Set(["0,0"]);
  const parent = new Map();
  let villageKey = null;

  while (queue.length > 0) {
    const current = queue.shift();
    const currentKey = `${current.x},${current.y}`;
    const tile = board[current.y][current.x];
    const connections = getConnections(tile);

    if (tile.type === "village") {
      villageKey = currentKey;
      break;
    }

    for (const dir of connections) {
      const delta = DIR_VECTORS[dir];
      const nx = current.x + delta.x;
      const ny = current.y + delta.y;

      if (!inBounds(nx, ny)) {
        continue;
      }

      const nextTile = board[ny][nx];
      const nextConnections = getConnections(nextTile);

      if (!nextConnections.includes(OPPOSITE[dir])) {
        continue;
      }

      const nextKey = `${nx},${ny}`;
      if (visited.has(nextKey)) {
        continue;
      }

      visited.add(nextKey);
      parent.set(nextKey, currentKey);
      queue.push({ x: nx, y: ny });
    }
  }

  let winningPath = null;

  if (villageKey) {
    winningPath = [];
    let cursor = villageKey;

    while (cursor) {
      winningPath.push(cursor);
      cursor = parent.get(cursor);
    }

    winningPath.reverse();
  }

  return { visited, winningPath };
}

function findWinningPath() {
  return getTraversalFromSource().winningPath;
}

function evaluateBoardState(playedFromTileRotation = true) {
  clearWinningPath();

  const { visited, winningPath } = getTraversalFromSource();
  const previousScore = waterScore;
  const connectedCountExcludingSource = Math.max(0, visited.size - 1);

  waterScore = connectedCountExcludingSource;
  highestWaterScore = Math.max(highestWaterScore, waterScore);
  updateScore();

  if (winningPath) {
    for (const point of winningPath) {
      const [x, y] = point.split(",").map(Number);
      board[y][x].isWinningPath = true;
    }

    puzzleSolved = true;
    drawBoard();
    launchConfetti();
    playSound(soundWin);

    const difficultyLabel = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
    setMessage(`You delivered clean water in ${clickCount} clicks on ${difficultyLabel}.`, "success");
    return true;
  }

  drawBoard();

  if (playedFromTileRotation) {
    if (waterScore > previousScore) {
      setMessage(`Nice move. Water score: ${waterScore}.`, "info");
    } else if (waterScore < previousScore) {
      setMessage(`That move reduced the flow. Water score: ${waterScore}.`, "info");
    } else {
      setMessage(`Clicks used: ${clickCount}. Water score: ${waterScore}. Keep going.`, "info");
    }
  } else {
    setMessage("Rotate the pipes to connect the water source to the village.", "info");
  }

  return false;
}

function handleTileClick(x, y) {
  const tile = board[y][x];

  if (puzzleSolved) {
    setMessage("Puzzle already solved. Start a new one or reset this one.", "success");
    return;
  }

  if (tile.type === "source" || tile.type === "village") {
    return;
  }

  if (tile.type === "rock") {
    flashTile(x, y, "tile-hit-bad");
    playSound(soundMiss);
    setMessage("That rock is an obstacle. It cannot be rotated.", "info");
    return;
  }

  playSound(soundButton);

  if (tile.type !== "cross") {
    tile.rotation = (tile.rotation + 1) % 4;
  }

  clickCount += 1;
  updateClicks();

  flashTile(x, y, "tile-hit-good");
  evaluateBoardState(true);
}

function launchConfetti() {
  const colors = ["#ffc907", "#2e9df7", "#ff902a", "#8bd3ff", "#7ed957"];

  for (let i = 0; i < 120; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti";
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.background = colors[randomInt(colors.length)];
    piece.style.animationDelay = `${Math.random() * 0.5}s`;
    piece.style.transform = `rotate(${randomInt(360)}deg)`;
    document.body.appendChild(piece);

    setTimeout(() => {
      piece.remove();
    }, 3200);
  }
}

function resetCurrentPuzzle() {
  for (const row of board) {
    for (const tile of row) {
      tile.rotation = tile.solvedRotation;
      tile.isWinningPath = false;
    }
  }

  for (const row of board) {
    for (const tile of row) {
      if (
        tile.type !== "source" &&
        tile.type !== "village" &&
        tile.type !== "rock" &&
        tile.type !== "cross"
      ) {
        tile.rotation = (tile.solvedRotation + scrambleTurnsForTile(tile)) % 4;
      }
    }
  }

  clickCount = 0;
  waterScore = 0;
  highestWaterScore = 0;
  lastTriggeredMilestoneIndex = -1;
  puzzleSolved = false;
  updateClicks();
  updateScore();
  playSound(soundButton);
  setMessage("Puzzle reset. Try to solve it with fewer clicks.", "info");
  drawBoard();
  evaluateBoardState(false);
}

difficultySelect.addEventListener("change", (event) => {
  difficulty = event.target.value;
  playSound(soundButton);
  generatePuzzle();
});

newPuzzleBtn.addEventListener("click", () => {
  playSound(soundButton);
  generatePuzzle();
});

resetBtn.addEventListener("click", () => {
  resetCurrentPuzzle();
});

generatePuzzle();