const gameState = require("./gameState");

function getCorrectRanking() {
  return [...gameState.answers.values()]
    .filter(answer => answer.isCorrect)
    .sort((a, b) => {
      if (a.responseTimeMs !== b.responseTimeMs) {
        return a.responseTimeMs - b.responseTimeMs;
      }
      if (a.arrivalSequence !== b.arrivalSequence) {
        return a.arrivalSequence - b.arrivalSequence;
      }
      return a.playerId.localeCompare(b.playerId);
    });
}

function eliminatePlayers() {
  const round = gameState.currentRound;
  const maxWinners = gameState.maxWinners[round - 1];
  const activeBefore = [...gameState.players.values()]
    .filter(player => player.status === "ACTIVE");

  const ranking = getCorrectRanking();
  const winners = ranking.slice(0, maxWinners);
  const winnerIds = new Set(winners.map(item => item.playerId));
  const eliminated = [];

  for (const player of activeBefore) {
    if (!winnerIds.has(player.id)) {
      player.status = "SPECTATOR";
      player.eliminatedAtRound = round;
      eliminated.push(player.id);
    }
  }

  const qualified = winners.map((answer, index) => {
    const player = gameState.players.get(answer.playerId);
    return {
      rank: index + 1,
      playerId: answer.playerId,
      name: player ? player.name : "Người chơi",
      className: player ? player.className : "",
      responseTimeMs: answer.responseTimeMs,
      receivedAt: answer.receivedAt
    };
  });

  return {
    round,
    totalParticipants: activeBefore.length,
    totalSubmitted: gameState.answers.size,
    totalCorrect: ranking.length,
    maxWinners,
    qualified,
    eliminated,
    completedAt: Date.now()
  };
}

module.exports = { getCorrectRanking, eliminatePlayers };
