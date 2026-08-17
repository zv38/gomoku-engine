// 回归测试：双方均用引擎（中档）随机对弈多局，断言 chooseMove 每步返回走法必为空点
// 目的：验证修复后不再因 Zobrist 转置回传已占点（即"无棋可走"的根因）而崩溃/判和
const { Board, chooseMove, EMPTY, BLACK, WHITE } = require('../engine.js');
function legal(b, m) { return Array.isArray(m) && b.inBounds(m[0], m[1]) && b.b[m[0]][m[1]] === EMPTY; }

const GAMES = 8;
let bad = 0, total = 0, games = 0, wins = { 1: 0, 2: 0, 0: 0 };
for (let g = 0; g < GAMES; g++) {
  const b = new Board();
  let color = BLACK, mv = 0, winner = 0;
  while (!b.isFull() && mv < 80) {
    const opts = { maxDepth: 4, vcf: true, vcfDepth: 6, vct: false };
    const res = chooseMove(b, color, 0.15, opts);
    if (!legal(b, res.move)) {
      bad++;
      console.log('✗ 非法走法 局' + g + ' 手' + mv + ' 执' + (color === BLACK ? '黑' : '白') +
        ' move=' + JSON.stringify(res.move));
      break;
    }
    b.play(res.move[0], res.move[1], color);
    total++;
    if (b.checkWin(res.move[0], res.move[1], color)) { winner = color; break; }
    color = color === BLACK ? WHITE : BLACK; mv++;
  }
  wins[winner]++;
  games++;
}
console.log('完成对局=' + games + ' 总手数=' + total + ' 非法走法=' + bad + ' 胜负(黑/白/和)=' + wins[1] + '/' + wins[2] + '/' + wins[0]);
process.exit(bad > 0 ? 1 : 0);
