const questions = require("../../data/questions.json");
const config = require("../../config/game.config");

const gameState = {
  status: "WAITING",          // WAITING | PLAYING | FINISHED
  roundStatus: "WAITING",     // WAITING | OPEN | CLOSED
  currentRound: 0,
  totalRounds: config.totalRounds,
  durationMs: config.durationMs,
  maxWinners: config.maxWinners,
  questions,

  // Map<playerId, player>
  players: new Map(),

  // Map<playerId, answerRecord> for the currently open round
  answers: new Map(),

  roundResults: [],
  startedAt: null,
  endsAt: null,
  startedMono: null,
  endsMono: null,
  timerId: null,
  arrivalSequence: 0,
  champion: null
};

module.exports = gameState;
