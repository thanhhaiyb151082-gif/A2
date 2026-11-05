const gameState = require("./gameState");
const config = require("../../config/game.config");
const {
  clearRoundTimer,
  setRoundClock,
  scheduleRoundEnd
} = require("./timerEngine");
const { eliminatePlayers } = require("./rankingEngine");

let ioRef = null;

function setIO(io) {
  ioRef = io;
}

function publicQuestion(question) {
  return {
    id: question.id,
    question: question.question,
    options: question.options,
    durationMs: gameState.durationMs
  };
}

function publicPlayer(player) {
  return {
    id: player.id,
    name: player.name,
    className: player.className,
    status: player.status,
    joinedAt: player.joinedAt,
    eliminatedAtRound: player.eliminatedAtRound
  };
}

function getPublicSnapshot() {
  const activePlayers = [...gameState.players.values()].filter(p => p.status === "ACTIVE");
  const spectators = [...gameState.players.values()].filter(p => p.status === "SPECTATOR");
  const question = gameState.currentRound > 0
    ? gameState.questions[gameState.currentRound - 1]
    : null;

  return {
    status: gameState.status,
    roundStatus: gameState.roundStatus,
    currentRound: gameState.currentRound,
    totalRounds: gameState.totalRounds,
    durationMs: gameState.durationMs,
    startedAt: gameState.startedAt,
    endsAt: gameState.endsAt,
    serverNow: Date.now(),
    question: question && gameState.roundStatus === "OPEN" ? publicQuestion(question) : null,
    activeCount: activePlayers.length,
    spectatorCount: spectators.length,
    answeredCount: gameState.answers.size,
    maxWinners: gameState.maxWinners,
    champion: gameState.champion
      ? publicPlayer(gameState.players.get(gameState.champion))
      : null,
    latestResult: gameState.roundResults.at(-1) || null
  };
}

function getAdminSnapshot() {
  const snapshot = getPublicSnapshot();
  return {
    ...snapshot,
    players: [...gameState.players.values()].map(publicPlayer),
    latestResult: gameState.roundResults.at(-1) || null,
    roundResults: gameState.roundResults
  };
}

function emitState() {
  if (!ioRef) return;
  ioRef.emit("game:state", getPublicSnapshot());
  ioRef.to("admins").emit("admin:state", getAdminSnapshot());
}

function startRound(roundNumber) {
  if (!ioRef) throw new Error("Socket.IO chưa được khởi tạo.");
  if (gameState.status === "FINISHED") throw new Error("Trò chơi đã kết thúc.");
  if (gameState.roundStatus === "OPEN") throw new Error("Vòng hiện tại vẫn đang diễn ra.");
  if (!Number.isInteger(roundNumber) || roundNumber < 1 || roundNumber > config.totalRounds) {
    throw new Error("Số vòng không hợp lệ.");
  }
  if (roundNumber !== gameState.currentRound + 1) {
    throw new Error("Chỉ được mở vòng kế tiếp theo đúng thứ tự.");
  }

  const active = [...gameState.players.values()].filter(p => p.status === "ACTIVE");
  if (active.length === 0) throw new Error("Không còn người chơi đủ điều kiện.");

  gameState.status = "PLAYING";
  gameState.currentRound = roundNumber;
  gameState.roundStatus = "OPEN";
  gameState.answers.clear();
  gameState.arrivalSequence = 0;

  setRoundClock();

  const question = gameState.questions[roundNumber - 1];

  ioRef.emit("round:started", {
    round: roundNumber,
    question: publicQuestion(question),
    startedAt: gameState.startedAt,
    endsAt: gameState.endsAt,
    serverNow: Date.now(),
    durationMs: gameState.durationMs
  });

  scheduleRoundEnd(endRound);
  emitState();

  return { round: roundNumber, endsAt: gameState.endsAt };
}

function endRound() {
  if (gameState.roundStatus !== "OPEN") return null;

  // Close first. This prevents late or duplicate submissions during ranking.
  gameState.roundStatus = "CLOSED";
  clearRoundTimer();

  const result = eliminatePlayers();
  gameState.roundResults.push(result);

  const activeAfter = [...gameState.players.values()].filter(p => p.status === "ACTIVE");

  if (result.round === config.totalRounds) {
    if (result.qualified.length > 0) {
      const championId = result.qualified[0].playerId;
      gameState.champion = championId;
      gameState.players.get(championId).status = "CHAMPION";
    }
    gameState.status = "FINISHED";
  } else if (activeAfter.length === 0) {
    gameState.status = "FINISHED";
  }

  const payload = {
    ...result,
    activeCount: activeAfter.length,
    spectatorCount: [...gameState.players.values()].filter(p => p.status === "SPECTATOR").length,
    qualified: result.qualified,
    eliminatedPlayers: result.eliminated.map(id => {
      const p = gameState.players.get(id);
      return p ? { id: p.id, name: p.name, className: p.className } : { id };
    })
  };

  ioRef.emit("round:results", payload);

  for (const playerId of result.eliminated) {
    const player = gameState.players.get(playerId);
    if (player?.socketId) {
      ioRef.to(player.socketId).emit("player:eliminated", {
        round: result.round,
        message: "Bạn đã được chuyển sang chế độ theo dõi."
      });
    }
  }

  if (gameState.status === "FINISHED") {
    const champion = gameState.champion
      ? publicPlayer(gameState.players.get(gameState.champion))
      : null;

    ioRef.emit("game:finished", {
      champion,
      message: champion
        ? `Chúc mừng ${champion.name} trở thành Quán quân!`
        : "Trò chơi kết thúc nhưng không có người chiến thắng."
    });
  }

  emitState();
  return payload;
}

function startGame() {
  if (gameState.status !== "WAITING" || gameState.currentRound !== 0) {
    throw new Error("Trò chơi đã được bắt đầu hoặc đã kết thúc. Hãy đặt lại trước.");
  }
  const players = [...gameState.players.values()];
  if (players.length === 0) throw new Error("Chưa có người chơi đăng ký.");

  players.forEach(player => {
    player.status = "ACTIVE";
    player.eliminatedAtRound = null;
  });

  return startRound(1);
}

function nextRound() {
  if (gameState.status !== "PLAYING" || gameState.roundStatus !== "CLOSED") {
    throw new Error("Vòng hiện tại chưa kết thúc.");
  }
  if (gameState.currentRound >= config.totalRounds) {
    throw new Error("Đã hoàn thành vòng cuối.");
  }
  return startRound(gameState.currentRound + 1);
}

function resetGame() {
  clearRoundTimer();
  gameState.status = "WAITING";
  gameState.roundStatus = "WAITING";
  gameState.currentRound = 0;
  gameState.startedAt = null;
  gameState.endsAt = null;
  gameState.startedMono = null;
  gameState.endsMono = null;
  gameState.answers.clear();
  gameState.roundResults = [];
  gameState.arrivalSequence = 0;
  gameState.champion = null;

  for (const player of gameState.players.values()) {
    player.status = "WAITING";
    player.eliminatedAtRound = null;
    player.answerHistory = [];
  }

  emitState();
}

function registerPlayer({ id, name, className, reconnectToken, socketId }) {
  if (gameState.status !== "WAITING" || gameState.currentRound !== 0) {
    throw new Error("Phòng chơi đã khóa đăng ký người mới.");
  }
  const player = {
    id,
    name,
    className,
    reconnectToken,
    socketId,
    status: "WAITING",
    joinedAt: Date.now(),
    eliminatedAtRound: null,
    answerHistory: []
  };
  gameState.players.set(id, player);
  emitState();
  return player;
}

function resumePlayer({ id, reconnectToken, socketId }) {
  const player = gameState.players.get(id);
  if (!player || player.reconnectToken !== reconnectToken) {
    throw new Error("Thông tin kết nối lại không hợp lệ.");
  }
  player.socketId = socketId;
  emitState();
  return player;
}

function detachSocket(socketId) {
  for (const player of gameState.players.values()) {
    if (player.socketId === socketId) player.socketId = null;
  }
}

module.exports = {
  setIO,
  publicPlayer,
  getPublicSnapshot,
  getAdminSnapshot,
  emitState,
  startGame,
  startRound,
  endRound,
  nextRound,
  resetGame,
  registerPlayer,
  resumePlayer,
  detachSocket
};
