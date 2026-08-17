// 五子棋引擎 v2 自检 —— 棋型 / VCF / VCT / 功能 / 压力
// 用法：node selftest.js
const E = require('../engine.js');
const { Board, chooseMove, vcf, vct, pointShapes, makesFive, evaluate } = E;

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  [OK] ' + name + (extra ? '  ' + extra : '')); }
  else { fail++; console.log('  [FAIL] ' + name + (extra ? '  ' + extra : '')); }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('== 五子棋引擎 v2 自检 ==');

// ---- 棋型识别 ----
{
  const b = new Board();
  b.play(7, 4, 1); b.play(7, 5, 1); b.play(7, 6, 1); // 活三
  const sh = pointShapes(b, 7, 5, 1);
  check('活三识别 openThree>=1', sh.openThree >= 1, JSON.stringify(sh));
}
{
  const b = new Board();
  b.play(7, 3, 1); b.play(7, 4, 1); b.play(7, 5, 1); b.play(7, 6, 1); // 活四
  const sh = pointShapes(b, 7, 4, 1);
  check('活四识别 openFour>=1', sh.openFour >= 1, JSON.stringify(sh));
}
{
  const b = new Board();
  b.play(7, 2, 2); b.play(7, 3, 1); b.play(7, 4, 1); b.play(7, 5, 1); b.play(7, 6, 1); // 冲四(左堵)
  const sh = pointShapes(b, 7, 4, 1);
  check('冲四识别 four>=1 且非活四', sh.four >= 1 && sh.openFour === 0, JSON.stringify(sh));
}
{
  const b = new Board();
  b.play(7, 4, 1); b.play(7, 6, 1); b.play(7, 7, 1); // 跳四 XX_XX? 这里是 X_XX，补 (7,5) 成活四；先测跳活三
  b.play(7, 9, 1);
  // 落 (7,5)：形成 (7,4)(5)(6)(7) 连四？(7,6)(7,7) 已有 → (7,4,5,6,7) 五连？不，(7,8)空。测 makesFive
  check('五连判定 makesFive', makesFive(b, 7, 8, 1) === false, '(7,8)非五连');
}

// ---- VCF：2 步强制杀 ----
// 黑：(7,3)(7,4)(7,5) 横向眠三(7,2白堵)，(5,6)(6,6) 竖向二子
// 黑走 (7,6)→冲四(7,3-6)，白必挡(7,7)；黑再走(8,6)→竖向(5,6)(6,6)(7,6)(8,6)活四→胜
{
  const b = new Board();
  b.play(7, 2, 2);
  b.play(7, 3, 1); b.play(7, 4, 1); b.play(7, 5, 1);
  b.play(5, 6, 1); b.play(6, 6, 1);
  const path = vcf(b, 1, 12, new Map(), Date.now() + 5000);
  check('VCF 2步强制杀', path !== null, path ? '路径=' + JSON.stringify(path) : 'null');
  if (path) check('VCF 首着为冲四(7,6)', eq(path[0], [7, 6]), JSON.stringify(path[0]));
}

// ---- VCF 负例：平静局面无杀 ----
{
  const b = new Board();
  b.play(7, 7, 1); b.play(7, 8, 2); b.play(8, 7, 1); b.play(8, 8, 2);
  const path = vcf(b, 1, 8, new Map(), Date.now() + 3000);
  check('VCF 平静局面无杀(返回null)', path === null, path ? '误报' : '正确');
}

// ---- VCT：双活三 ----
{
  const b = new Board();
  b.play(7, 5, 1); b.play(7, 6, 1); b.play(7, 7, 1);          // 横活三
  b.play(5, 6, 1); b.play(6, 6, 1);                            // 竖向含(7,6)→(5,6)(6,6)(7,6)活三
  const path = vct(b, 1, 5, new Map(), Date.now() + 5000);
  check('VCT 双活三杀', path !== null, path ? '首着=' + JSON.stringify(path[0]) : 'null');
}

// ---- 主搜索功能 ----
{
  const b = new Board();
  const r = chooseMove(b, 1, 0.5, { maxDepth: 4 });
  check('空盘首手天元', eq(r.move, [7, 7]), JSON.stringify(r.move));
}
{
  const b = new Board();
  for (let c = 3; c <= 6; c++) b.play(7, c, 1);
  const r = chooseMove(b, 1, 0.5, { maxDepth: 4 });
  check('黑四连走必胜点', r.move && (eq(r.move, [7, 2]) || eq(r.move, [7, 7])), JSON.stringify(r.move) + ' kill=' + r.info.kill);
}
{
  const b = new Board();
  for (let c = 3; c <= 6; c++) b.play(7, c, 2);
  const r = chooseMove(b, 1, 0.5, { maxDepth: 4 });
  check('白活四拦截', r.move && (eq(r.move, [7, 2]) || eq(r.move, [7, 7])), JSON.stringify(r.move));
}

// ---- 压力：自对弈 40 手，预算约束 ----
{
  const b = new Board(); let turn = 1, winner = 0, t0 = Date.now(), slow = 0;
  for (let i = 0; i < 40; i++) {
    const mt = Date.now();
    const r = chooseMove(b, turn, 0.5, { maxDepth: 6, vcfDepth: 10, vctDepth: 4 });
    const dt = Date.now() - mt;
    if (dt > 2500) slow++;
    if (!r.move) break;
    b.play(r.move[0], r.move[1], turn);
    if (b.checkWin(r.move[0], r.move[1], turn)) { winner = turn; break; }
    turn = turn === 1 ? 2 : 1;
  }
  check('自对弈 40 手无超时(>2.5s)', slow === 0, 'slow=' + slow + ' 总耗时=' + (Date.now() - t0) + 'ms winner=' + (winner || '无'));
}

// ---- 禁手判定（黑棋 Renju 规则）----
{
  // 三三禁手：落子后同时形成两个活三
  const b = new Board();
  b.play(7, 6, 1); b.play(7, 8, 1);   // 横：落(7,7) → (7,6)(7,7)(7,8) 活三
  b.play(6, 7, 1); b.play(8, 7, 1);   // 纵：落(7,7) → (6,7)(7,7)(8,7) 活三
  b.play(0, 0, 2);                    // 占位白子，避免空盘
  check('三三禁手判定', E.isForbidden(b, 7, 7) === true);

  // 四四禁手：落子后同时形成两个四
  const b4 = new Board();
  b4.play(7, 4, 1); b4.play(7, 5, 1); b4.play(7, 6, 1); // 横：落(7,7) → 冲四/活四
  b4.play(4, 7, 1); b4.play(5, 7, 1); b4.play(6, 7, 1); // 纵：落(7,7) → 冲四
  b4.play(0, 0, 2);
  check('四四禁手判定', E.isForbidden(b4, 7, 7) === true);

  // 长连禁手：落子后形成六连
  const b6 = new Board();
  for (let i = 2; i <= 6; i++) b6.play(7, i, 1);
  b6.play(0, 0, 2);
  check('长连禁手判定', E.isForbidden(b6, 7, 7) === true);

  // 非禁手：落子仅成单一活三（不是禁手）
  const b3 = new Board();
  b3.play(7, 6, 1); b3.play(7, 8, 1); // 落(7,7) 仅横活三
  b3.play(0, 0, 2);
  check('单活三非禁手', E.isForbidden(b3, 7, 7) === false);

  // 非禁手：四三（冲四+活三）是必胜型，不是禁手
  const b43 = new Board();
  b43.play(7, 4, 1); b43.play(7, 5, 1); b43.play(7, 6, 1); // 落(7,7) → 四（横）
  b43.play(6, 7, 1); b43.play(8, 7, 1);                    // 纵：落(7,7) → 活三
  b43.play(0, 0, 2);
  check('四三非禁手(必胜型)', E.isForbidden(b43, 7, 7) === false);

  // 非禁手：成五优先于禁手
  const b5 = new Board();
  for (let i = 3; i <= 6; i++) b5.play(7, i, 1); // 落(7,7) → 五连
  b5.play(0, 0, 2);
  check('成五优先非禁手', E.isForbidden(b5, 7, 7) === false);

  // legalMoves 对黑棋过滤禁手点：构造三三局面，(7,7) 不应出现在候选
  const bl = new Board();
  bl.play(7, 6, 1); bl.play(7, 8, 1); bl.play(6, 7, 1); bl.play(8, 7, 1); bl.play(0, 0, 2);
  const lm = E.legalMoves(bl, 1, 40);
  check('legalMoves 过滤黑棋禁手点', !lm.some(m => m[0] === 7 && m[1] === 7), '禁手点仍在候选?');
}

console.log('\n结果：通过 ' + pass + ' / 失败 ' + fail);
process.exit(fail ? 1 : 0);
