'use strict';

var GRID_WIDTH = 40;
var SNAKE_CELL = 1;
var FOOD_CELL = 2;
var UP = {x: 0, y: -1};
var DOWN = {x: 0, y: 1};
var LEFT = {x: -1, y: 0};
var RIGHT = {x: 1, y: 0};
var INITIAL_SNAKE_LENGTH = 4;
var BRAILLE_SPACE = '\u2800';

var grid;
var snake;
var currentDirection;
var moveQueue;
var hasMoved;
var gamePaused = false;
var urlRevealed = false;
var whitespaceReplacementChar;

function main() {
  detectBrowserUrlWhitespaceEscaping();
  cleanUrl();
  setupEventHandlers();
  drawMaxScore();
  initUrlRevealed();
  startGame();

  var lastFrameTime = Date.now();
  window.requestAnimationFrame(function frameHandler() {
    var now = Date.now();
    if (!gamePaused && now - lastFrameTime >= tickTime()) {
      updateWorld();
      drawWorld();
      lastFrameTime = now;
    }
    window.requestAnimationFrame(frameHandler);
  });
}

function detectBrowserUrlWhitespaceEscaping() {
  history.replaceState(null, null, '#' + BRAILLE_SPACE + BRAILLE_SPACE)
  if (location.hash.indexOf(BRAILLE_SPACE) == -1) {
    console.warn('Browser is escaping whitespace characters on URL')
    var replacementData = pickWhitespaceReplacementChar();
    whitespaceReplacementChar = replacementData[0];
    $('#url-escaping-note').classList.remove('invisible');
    $('#replacement-char-description').textContent = replacementData[1];
  }
}

function cleanUrl() {
  history.replaceState(null, null, location.pathname.replace(/\b\/$/, ''));
}

function setupEventHandlers() {
  var directionsByKey = {
    37: LEFT, 38: UP, 39: RIGHT, 40: DOWN,
    87: UP, 65: LEFT, 83: DOWN, 68: RIGHT,
    75: UP, 72: LEFT, 74: DOWN, 76: RIGHT
  };

  document.onkeydown = function (event) {
    var key = event.keyCode;
    if (key in directionsByKey) {
      changeDirection(directionsByKey[key]);
    }
  };

  $('#up').ontouchstart = function () { changeDirection(UP) };
  $('#down').ontouchstart = function () { changeDirection(DOWN) };
  $('#left').ontouchstart = function () { changeDirection(LEFT) };
  $('#right').ontouchstart = function () { changeDirection(RIGHT) };

  window.onblur = function pauseGame() {
    gamePaused = true;
    window.history.replaceState(null, null, location.hash + '[paused]');
  };

  window.onfocus = function unpauseGame() {
    gamePaused = false;
    drawWorld();
  };

  $('#reveal-url').onclick = function (e) {
    e.preventDefault();
    setUrlRevealed(!urlRevealed);
  };

  document.querySelectorAll('.expandable').forEach(function (expandable) {
    var expand = expandable.querySelector('.expand-btn');
    var collapse = expandable.querySelector('.collapse-btn');
    var content = expandable.querySelector('.expandable-content');
    expand.onclick = collapse.onclick = function () {
      expand.classList.remove('hidden');
      content.classList.remove('hidden');
      expandable.classList.toggle('expanded');
    };
    expandable.ontransitionend = function () {
      var expanded = expandable.classList.contains('expanded');
      expand.classList.toggle('hidden', expanded);
      content.classList.toggle('hidden', !expanded);
    };
  });
}

function initUrlRevealed() {
  setUrlRevealed(Boolean(localStorage.urlRevealed));
}

function setUrlRevealed(value) {
  urlRevealed = value;
  $('#url-container').classList.toggle('invisible', !urlRevealed);
  if (urlRevealed) {
    localStorage.urlRevealed = 'y';
  } else {
    delete localStorage.urlRevealed;
  }
}

function startGame() {
  grid = new Array(GRID_WIDTH * 4);
  snake = [];
  for (var x = 0; x < INITIAL_SNAKE_LENGTH; x++) {
    var y = 2;
    snake.unshift({x: x, y: y});
    setCellAt(x, y, SNAKE_CELL);
  }
  currentDirection = RIGHT;
  moveQueue = [];
  hasMoved = false;
  dropFood();
}

function updateWorld() {
  if (moveQueue.length) {
    currentDirection = moveQueue.pop();
  }

  var head = snake[0];
  var tail = snake[snake.length - 1];
  var newX = head.x + currentDirection.x;
  var newY = head.y + currentDirection.y;

  var outOfBounds = newX < 0 || newX >= GRID_WIDTH || newY < 0 || newY >= 4;
  var collidesWithSelf = cellAt(newX, newY) === SNAKE_CELL
    && !(newX === tail.x && newY === tail.y);

  if (outOfBounds || collidesWithSelf) {
    endGame();
    startGame();
    return;
  }

  var eatsFood = cellAt(newX, newY) === FOOD_CELL;
  if (!eatsFood) {
    snake.pop();
    setCellAt(tail.x, tail.y, null);
  }

  setCellAt(newX, newY, SNAKE_CELL);
  snake.unshift({x: newX, y: newY});

  if (eatsFood) {
    dropFood();
  }
}

function endGame() {
  var score = currentScore();
  var maxScore = parseInt(localStorage.maxScore || 0);
  if (score > 0 && score > maxScore && hasMoved) {
    localStorage.maxScore = score;
    localStorage.maxScoreGrid = gridString();
    drawMaxScore();
    showMaxScore();
  }
}

function drawWorld() {
  var hash = '#|' + gridString() + '|[score:' + currentScore() + ']';

  if (urlRevealed) {
    $('#url').textContent = location.href.replace(/#.*$/, '') + hash;
  }

  if (whitespaceReplacementChar) {
    hash = hash.replace(/\u2800/g, whitespaceReplacementChar);
  }

  history.replaceState(null, null, hash);

  if (decodeURIComponent(location.hash) !== hash) {
    console.warn('history.replaceState() throttling detected. Using location.hash fallback');
    location.hash = hash;
  }
}

function gridString() {
  var str = '';
  for (var x = 0; x < GRID_WIDTH; x += 2) {
    var n = 0
      | bitAt(x, 0) << 0
      | bitAt(x, 1) << 1
      | bitAt(x, 2) << 2
      | bitAt(x + 1, 0) << 3
      | bitAt(x + 1, 1) << 4
      | bitAt(x + 1, 2) << 5
      | bitAt(x, 3) << 6
      | bitAt(x + 1, 3) << 7;
    str += String.fromCharCode(0x2800 + n);
  }
  return str;
}

function tickTime() {
  var start = 125;
  var end = 75;
  return start + snake.length * (end - start) / grid.length;
}

function currentScore() {
  return snake.length - INITIAL_SNAKE_LENGTH;
}

function cellAt(x, y) {
  return grid[x % GRID_WIDTH + y * GRID_WIDTH];
}

function bitAt(x, y) {
  return cellAt(x, y) ? 1 : 0;
}

function setCellAt(x, y, cellType) {
  grid[x % GRID_WIDTH + y * GRID_WIDTH] = cellType;
}

function dropFood() {
  var emptyCells = grid.length - snake.length;
  if (emptyCells === 0) return;
  var dropCounter = Math.floor(Math.random() * emptyCells);
  for (var i = 0; i < grid.length; i++) {
    if (grid[i] === SNAKE_CELL) continue;
    if (dropCounter === 0) {
      grid[i] = FOOD_CELL;
      break;
    }
    dropCounter--;
  }
}

function changeDirection(newDir) {
  var lastDir = moveQueue[0] || currentDirection;
  var opposite = newDir.x + lastDir.x === 0 && newDir.y + lastDir.y === 0;
  if (!opposite) {
    moveQueue.unshift(newDir);
  }
  hasMoved = true;
}

function drawMaxScore() {
  var maxScore = localStorage.maxScore;
  if (maxScore == null) return;

  var maxScorePoints = maxScore == 1 ? '1 point' : maxScore + ' points'
  var maxScoreGrid = localStorage.maxScoreGrid;

  $('#max-score-points').textContent = maxScorePoints;
  $('#max-score-grid').textContent = maxScoreGrid;
  $('#max-score-container').classList.remove('hidden');

  $('#share').onclick = function (e) {
    e.preventDefault();
    shareScore(maxScorePoints, maxScoreGrid);
  };
}

function showMaxScore() {
  if ($('#max-score-container.expanded')) return
  $('#max-score-container .expand-btn').click();
}

function shareScore(scorePoints, grid) {
  var message = '|' + grid + '| Got ' + scorePoints + ' playing this URL snake game!';
  var url = $('link[rel=canonical]').href;
  if (navigator.share) {
    navigator.share({text: message, url: url});
  } else {
    navigator.clipboard.writeText(message + '\n' + url)
      .then(function () { showShareNote('copied to clipboard') })
      .catch(function () { showShareNote('clipboard write failed') })
  }
}

function showShareNote(message) {
  var note = $("#share-note");
  note.textContent = message;
  note.classList.remove("invisible");
  setTimeout(function () { note.classList.add("invisible") }, 1000);
}

function pickWhitespaceReplacementChar() {
  var candidates = [
    ['\u00A0', 'non-breaking spaces'], // Much cleaner than / or slashes
    ['\u1680', 'ogham space marks'],
    ['\u2004', 'three-per-em spaces'],
    ['૟', 'strange symbols']
  ];

  var N = 5;
  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d');
  ctx.font = '30px system-ui';
  var targetWidth = ctx.measureText(BRAILLE_SPACE.repeat(N)).width;

  for (var i = 0; i < candidates.length; i++) {
    var char = candidates[i][0];
    var str = char.repeat(N);
    var width = ctx.measureText(str).width;
    var similarWidth = Math.abs(targetWidth - width) / targetWidth <= 0.15;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillText(str, 0, 30);
    var pixelData = ctx.getImageData(0, 0, Math.max(width, 1), 30).data;
    var totalPixels = pixelData.length / 4;
    var coloredPixels = 0;
    for (var j = 0; j < totalPixels; j++) {
      if (pixelData[j * 4 + 3] != 0) coloredPixels++;
    }
    var notTooDark = coloredPixels / totalPixels < 0.10;

    if (similarWidth && notTooDark) {
      return candidates[i];
    }
  }

  return ['_', 'underscores']; // Last resort for visibility
}

var $ = document.querySelector.bind(document);

main();
