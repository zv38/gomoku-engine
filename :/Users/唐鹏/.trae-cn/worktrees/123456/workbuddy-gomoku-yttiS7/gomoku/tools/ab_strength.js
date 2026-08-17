// A/B 棋力对比：优化版(engine.js) vs 旧版(可指定路径)
// 用法：node ab_strength.js [局数] [每手秒] [旧引擎路径]
// 双方完全相同配置（maxDepth 12, VCF+VCT），公平对弈，统计优化版胜率
const ENew = require('../engine.js');
const EOld = require(process.argv[4] || './baselines/engine_base.js');

const OPTS = { maxDepth: 12, vcf: true, vcfDepth: 14, vct: true, vctDepth: 7 };

function playGame(newColor, tl) {
  const b = new ENew.Board();
  let color = ENew.BLACK, mv = 0, winner = 0;
  while (!b.isFull() && mv < 225) {
    let mvRes;
    if (color === newColor) {
      const r = ENew.chooseMove(b, color, tl, OPTS);
      mvRes = r.move;
    } else {
      const r = EOld.chooseMove(b, color, tl, OPTS);
      mvRes = r.move;
    }
    if (!mvRes || b.b[mvRes[0]][mvRes[1]] !== ENew.EMPTY) {
      const ms = ENew.legalMoves(b, color, 1);
      mvRes = ms[0];
    }
    if (!mvRes) break;
    b.play(mvRes[0], mvRes[1], color);
    if (b.checkWin(mvRes[0], mvRes[1], color)) { winner = color; break; }
    color = color === ENew.BLACK ? ENew.WHITE : ENew.BLACK; mv++;
  }
  return winner;
}

let newWins = 0, games = 0, draws = 0;
const GAMES = parseInt(process.argv[2] || '12', 10), TL = parseFloat(process.argv[3] || '1.0');
for (let g = 0; g < GAMES; g++) {
  const newColor = g % 2 === 0 ? ENew.BLACK : ENew.WHITE;   // 优化版各执先手一次
  const w = playGame(newColor, TL);
  games++;
  if (w === newColor) newWins++;
  if (w === 0) draws++;
  if (games % 5 === 0 || g === GAMES - 1) console.log(`局${g + 1}/${GAMES} 新执${newColor === ENew.BLACK ? '黑' : '白'} 胜方=${w === 0 ? '和' : (w === ENew.BLACK ? '黑' : '白')} 新胜率=${(newWins / games * 100).toFixed(0)}%`);
}
console.log(`\n优化版(engine.js) vs 旧版(${process.argv[4] || './engine_base.js'})`);
console.log(`新引擎胜率 = ${newWins}/${games} = ${(newWins / games * 100).toFixed(0)}%  和棋=${draws}`);
console.log(newWins >= games * 0.5 ? '✓ 新引擎棋力不低于旧引擎' : '⚠ 新引擎胜率偏低，需核查');
process.exit(newWins >= Math.ceil(games * 0.5) ? 0 : 1);