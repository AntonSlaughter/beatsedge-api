function calculateFantasyScore(game) {
  return (
    (game.points || 0) +
    (game.rebounds || 0) * 1.2 +
    (game.assists || 0) * 1.5 +
    (game.steals || 0) * 3 +
    (game.blocks || 0) * 3 -
    (game.turnovers || 0)
  );
}

function calculateCombo(game, type) {
  switch (type) {
    case 'PRA':
      return (game.points || 0) +
             (game.rebounds || 0) +
             (game.assists || 0);

    case 'PR':
      return (game.points || 0) +
             (game.rebounds || 0);

    case 'PA':
      return (game.points || 0) +
             (game.assists || 0);

    case 'RA':
      return (game.rebounds || 0) +
             (game.assists || 0);

    default:
      return 0;
  }
}

module.exports = {
  calculateFantasyScore,
  calculateCombo
};
