const SIZE = 6;

const boardElement = document.getElementById("board");
const clicksElement = document.getElementById("clicks");
const messageElement = document.getElementById("message");
const resetBtn = document.getElementById("resetBtn");
const newPuzzleBtn = document.getElementById("newPuzzleBtn");

let board = [];
let clickCount = 0;
let puzzleSolved = false;

const directions = ["up", "right", "down", "left"];

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

function updateClicks() {
  clicksElement.textContent = clickCount;
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
        const shouldWander = Math.random() < 0.55 && distanceToGoal > 3;
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

function pipeFromConnections(connections) {
  const sorted = [...connections].sort((a, b) => directions.indexOf(a) - directions.indexOf(b));
  const key = sorted.join(",");

  if (key === "left,right") return { type: "straight", rotation: 1 };
  if (key === "up,down") return { type: "straight", rotation: 0 };
  if (key === "up,right") return { type: "corner", rotation: 0 };
  if (key === "right,down") return { type: "corner", rotation: 1 };
  if (key === "down,left") return { type: "corner", rotation: 2 };
  if (key === "up,left") return { type: "corner", rotation: 3 };

  return { type: "straight", rotation: 0 };
}

function createTile(x, y, type, rotation, solvedRotation, isPath = false) {
  return {
    x,
    y,
    type,
    rotation,
    solvedRotation,
    isPath,
    isWinningPath: false
  };
}

function generatePuzzle() {
  const solvedBoard = Array.from({ length: SIZE }, (_, y) =>
    Array.from({ length: SIZE }, (_, x) =>
      createTile(x, y, "rock", 0, 0, false)
    )
  );

  const path = buildGuaranteedPath();

  for (let i = 0; i < path.length; i++) {
    const current = path[i];
    const prev = path[i - 1];
    const next = path[i + 1];

    if (i === 0) {
      const outDir = directionBetween(current, next);
      const sourceRotation = outDir === "right" ? 0 : 1;
      solvedBoard[current.y][current.x] = createTile(
        current.x,
        current.y,
        "source",
        sourceRotation,
        sourceRotation,
        true
      );
      continue;
    }

    if (i === path.length - 1) {
      const inDir = directionBetween(current, prev);
      const villageRotation = OPPOSITE[inDir] === "left" ? 0 : 1;
      solvedBoard[current.y][current.x] = createTile(
        current.x,
        current.y,
        "village",
        villageRotation,
        villageRotation,
        true
      );
      continue;
    }

    const dirToPrev = directionBetween(current, prev);
    const dirToNext = directionBetween(current, next);
    const connections = [dirToPrev, dirToNext].map((dir) => OPPOSITE[dir]);
    const pipe = pipeFromConnections(connections);

    solvedBoard[current.y][current.x] = createTile(
      current.x,
      current.y,
      pipe.type,
      pipe.rotation,
      pipe.rotation,
      true
    );
  }

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (solvedBoard[y][x].isPath) {
        continue;
      }

      const roll = Math.random();

      if (roll < 0.22) {
        solvedBoard[y][x] = createTile(x, y, "rock", 0, 0, false);
      } else {
        const type = Math.random() < 0.5 ? "straight" : "corner";
        const solvedRotation = randomInt(4);
        solvedBoard[y][x] = createTile(x, y, type, solvedRotation, solvedRotation, false);
      }
    }
  }

  board = solvedBoard.map((row) =>
    row.map((tile) => {
      if (tile.type === "source" || tile.type === "village" || tile.type === "rock") {
        return { ...tile, isWinningPath: false };
      }

      let newRotation = tile.solvedRotation;
      const extraTurns = 1 + randomInt(3);
      newRotation = (newRotation + extraTurns) % 4;

      return {
        ...tile,
        rotation: newRotation,
        isWinningPath: false
      };
    })
  );

  clickCount = 0;
  puzzleSolved = false;
  updateClicks();
  setMessage("Rotate the pipes to connect the water source to the village.", "info");
  drawBoard();
}

function getConnections(tile) {
  if (tile.type === "rock") return [];

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
    setMessage("That rock is an obstacle. It cannot be rotated.", "info");
    return;
  }

  tile.rotation = (tile.rotation + 1) % 4;
  clickCount += 1;
  updateClicks();

  clearWinningPath();
  drawBoard();
  flashTile(x, y, "tile-hit-good");
  checkWin();
}

function findWinningPath() {
  const stack = [{ x: 0, y: 0, path: ["0,0"] }];
  const visited = new Set();

  while (stack.length > 0) {
    const current = stack.pop();
    const key = `${current.x},${current.y}`;

    if (visited.has(key)) {
      continue;
    }
    visited.add(key);

    const tile = board[current.y][current.x];
    const connections = getConnections(tile);

    if (tile.type === "village") {
      return current.path;
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

      stack.push({
        x: nx,
        y: ny,
        path: [...current.path, `${nx},${ny}`]
      });
    }
  }

  return null;
}

function checkWin() {
  clearWinningPath();
  const winningPath = findWinningPath();

  if (!winningPath) {
    setMessage(`Clicks used: ${clickCount}. Keep going.`, "info");
    drawBoard();
    return false;
  }

  for (const point of winningPath) {
    const [x, y] = point.split(",").map(Number);
    board[y][x].isWinningPath = true;
  }

  puzzleSolved = true;
  drawBoard();
  launchConfetti();
  setMessage(`You delivered clean water in ${clickCount} clicks.`, "success");
  return true;
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
      if (tile.type !== "source" && tile.type !== "village" && tile.type !== "rock") {
        const extraTurns = 1 + randomInt(3);
        tile.rotation = (tile.solvedRotation + extraTurns) % 4;
      }
    }
  }

  clickCount = 0;
  puzzleSolved = false;
  updateClicks();
  setMessage("Puzzle reset. Try to solve it with fewer clicks.", "info");
  drawBoard();
}

newPuzzleBtn.addEventListener("click", generatePuzzle);
resetBtn.addEventListener("click", resetCurrentPuzzle);

generatePuzzle();