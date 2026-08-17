// 优化正确性校验：
// 1) 增量 evaluate() == 全盘扫描 evaluateFull()（覆盖 play/undo 随机序列 + 残局 + 直接改盘面后复位）
// 2) 查表版 pointShapes == 独立字符串版 pointShapes（覆盖全部 15x15 格子 x 黑白 + 随机局）
const E = require('../engine.js');
const { Board, BLACK, WHITE, EMPTY, evaluate, evaluateFull, pointShapes, SIZE } = E;

// 独立字符串版 pointShapes（复刻原实现）
const SHAPES = {
  five: ['11111'],
  openFour: ['011110'],
  four: ['11110', '01111', '11011', '10111', '11101'],
  openThree: ['011100', '001110', '010110', '011010'],
  closedThree: ['11100', '00111', '11010', '01011', '10110', '01101', '11001', '10011'],
  openTwo: ['001100', '011000', '000110', '010100', '001010'],
  closedTwo: ['11000', '00011', '10100', '00101', '10010', '01001'],
};
const SHAPE_ORDER = ['five', 'openFour', 'four', 'openThree', 'closedThree', 'openTwo', 'closedTwo'];
const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
function windowStr(board, r, c, dr, dc, player, span = 4) {
  let s = '';
  for (let i = -span; i <= span; i++) {
    const nr = r + i * dr, nc = c + i * dc;
    if (!board.inBounds(nr, nc)) s += '2';
    else { const v = board.b[nr][nc]; s += (v === EMPTY ? '0' : (v === player ? '1' : '2')); }
  }
  return s;
}
function matchCoverCenter(s, pat, center) {
  const pl = pat.length;
  for (let i = 0; i + pl <= s.length; i++) {
    if (i <= center && center < i + pl && s.substr(i, pl) === pat) return true;
  }
  return false;
}
function pointShapesStr(board, r, c, player) {
  board.b[r][c] = player;
  const res = { five: 0, openFour: 0, four: 0, openThree: 0, closedThree: 0, openTwo: 0, closedTwo: 0 };
  for (const [dr, dc] of DIRS) {
    const s = windowStr(board, r, c, dr, dc, player, 4);
    const center = 4;
    for (const k of SHAPE_ORDER) {
      let hit = false;
      for (const pat of SHAPES[k]) { if (matchCoverCenter(s, pat, center)) { hit = true; break; } }
      if (hit) { res[k]++; break; }
    }
  }
  board.b[r][c] = EMPTY;
  return res;
}

let fail = 0;
function check(name, cond) {
  if (cond) console.log('  [OK] ' + name);
  else { fail++; console.log('  [FAIL] ' + name); }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---- 1) 随机 play/undo 序列：增量评估与全盘扫描恒等 ----
{
  let bad = 0, N = 2000;
  for (let t = 0; t < N; t++) {
    const b = new Board();
    let color = BLACK;
    for (let i = 0; i < 200; i++) {
      // 随机落一子（可重复、可越界——模拟搜索中的任意尝试）
      const r = Math.floor(Math.random() * SIZE), c = Math.floor(Math.random() * SIZE);
      b.play(r, c, color);
      if (evaluate(b) !== evaluateFull(b)) { bad++; if (bad < 3) console.log('  ! 增量≠全盘 手' + i + ' (' + r + ',' + c + ') inc=' + evaluate(b) + ' full=' + evaluateFull(b)); break; }
      color = color === BLACK ? WHITE : BLACK;
      // 随机回退若干
      if (Math.random() < 0.3) b.undo();
    }
    // 回退到空盘再回退（越界）应无异常
    while (b.stack.length) b.undo();
    if (evaluate(b) !== 0) { bad++; console.log('  ! 空盘增量≠0 inc=' + evaluate(b)); }
    if (bad > 0) break;
  }
  check('增量 evaluate == 全盘 evaluateFull（2000 随机 play/undo 序列）', bad === 0);
}

// ---- 2) 合法对局：增量评估与全盘扫描逐步一致 ----
{
  let bad = 0;
  for (let t = 0; t < 100; t++) {
    const b = new Board();
    let color = BLACK;
    for (let i = 0; i < 100 && !b.isFull(); i++) {
      const cs = b.candidates();
      if (!cs.length) break;
      const mv = cs[Math.floor(Math.random() * cs.length)];
      b.play(mv[0], mv[1], color);
      if (evaluate(b) !== evaluateFull(b)) { bad++; if (bad < 3) console.log('  ! 增量≠全盘 局' + t + ' 手' + i); break; }
      color = color === BLACK ? WHITE : BLACK;
    }
    if (bad > 0) break;
  }
  check('合法对局逐步一致性（100 局）', bad === 0);
}

// ---- 3) 查表 pointShapes == 字符串 pointShapes：全盘 15x15 x 黑/白 + 随机局 ----
{
  let bad = 0;
  for (let t = 0; t < 300; t++) {
    const b = new Board();
    let color = BLACK;
    for (let i = 0; i < 60; i++) {
      const cs = b.candidates();
      if (!cs.length) break;
      const mv = cs[Math.floor(Math.random() * cs.length)];
      b.play(mv[0], mv[1], color);
      color = color === BLACK ? WHITE : BLACK;
    }
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      if (b.b[r][c] !== EMPTY) continue;
      for (const p of [BLACK, WHITE]) {
        const a = pointShapes(b, r, c, p);
        const s = pointShapesStr(b, r, c, p);
        if (!eq(a, s)) { bad++; if (bad < 5) console.log('  ! pointShapes 不一致 (' + r + ',' + c + ') p=' + p + ' 表=' + JSON.stringify(a) + ' 串=' + JSON.stringify(s)); }
        // 落子后的瞬时评估（临时改盘面）也应与全盘一致
        if (evaluate(b) !== evaluateFull(b)) { bad++; if (bad < 5) console.log('  ! 临时落子评估污染 inc=' + evaluate(b) + ' full=' + evaluateFull(b)); }
      }
    }
    if (bad > 0) break;
  }
  check('pointShapes 查表版 == 字符串版（300 随机局 x 全空点 x 黑白）', bad === 0);
}

// ---- 4) 禁手判定：新旧一致（查表 pointShapes 改动影响 forbiddenAt）----
{
  let bad = 0;
  for (let t = 0; t < 200; t++) {
    const b = new Board();
    let color = BLACK;
    for (let i = 0; i < 40; i++) {
      const cs = b.candidates();
      if (!cs.length) break;
      const mv = cs[Math.floor(Math.random() * cs.length)];
      b.play(mv[0], mv[1], color);
      color = color === BLACK ? WHITE : BLACK;
    }
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      if (b.b[r][c] !== EMPTY) continue;
      // 用字符串版独立算禁手与引擎 isForbidden 对比
      b.b[r][c] = BLACK;
      const sh = pointShapesStr(b, r, c, BLACK);
      let forbidden = false;
      for (const [dr, dc] of DIRS) {
        let len = 1, nr = r + dr, nc = c + dc;
        while (b.inBounds(nr, nc) && b.b[nr][nc] === BLACK) { len++; nr += dr; nc += dc; }
        nr = r - dr; nc = c - dc;
        while (b.inBounds(nr, nc) && b.b[nr][nc] === BLACK) { len++; nr -= dr; nc -= dc; }
        if (len >= 6) { forbidden = true; break; }
      }
      if (!forbidden && sh.five === 0) {
        const fours = sh.openFour + sh.four;
        if (fours >= 2) forbidden = true;
        else if (sh.openThree >= 2) forbidden = true;
      }
      b.b[r][c] = EMPTY;
      const eng = E.isForbidden(b, r, c);
      if (forbidden !== eng) { bad++; if (bad < 5) console.log('  ! 禁手不一致 (' + r + ',' + c + ') 独立=' + forbidden + ' 引擎=' + eng); }
    }
    if (bad > 0) break;
  }
  check('禁手判定 独立字符串版 == 引擎（200 随机局）', bad === 0);
}

console.log(fail === 0 ? '\n校验全部通过' : '\n存在 ' + fail + ' 项失败');
process.exit(fail ? 1 : 0);
