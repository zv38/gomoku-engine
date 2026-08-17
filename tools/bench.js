// 微基准：量化 evaluate / moveKey / pointShapes 的单次成本，定位优化靶点
const E = require('../engine.js');
const { Board, BLACK, WHITE, EMPTY, evaluate, moveKey, pointShapes, legalMoves } = E;

const b = new Board();
const seq = [[7,7],[7,8],[8,8],[8,7],[9,9],[6,6],[9,7],[6,9],[10,10],[5,5],[10,8],[5,8],[11,11],[4,4]];
let color = BLACK;
for (const [r,c] of seq) { if (b.b[r][c]===EMPTY) b.play(r,c,color); color = color===BLACK?WHITE:BLACK; }

function bench(fn, n, label) {
  // 预热
  for (let i=0;i<50;i++) fn();
  const t0 = process.hrtime.bigint();
  for (let i=0;i<n;i++) fn();
  const t1 = process.hrtime.bigint();
  const ms = Number(t1 - t0)/1e6;
  console.log(`${label}: ${(ms/n).toFixed(3)} ms/次  (${n}次, 共${ms.toFixed(1)}ms)`);
}

const cand = b.candidates().slice(0,20);
bench(() => evaluate(b), 3000, 'evaluate()     ');
const M = E; // 仅用已导出函数
bench(() => legalMoves(b, BLACK, 20), 3000, 'legalMoves(20) ');
bench(() => legalMoves(b, BLACK, 12), 3000, 'legalMoves(12) ');
bench(() => b.candidates().length, 3000, 'candidates().len');
