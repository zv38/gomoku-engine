// 五子棋引擎 Web Worker：把重型搜索（1.5~4.5s）移出主线程，UI 不再卡顿
// 复用同目录 engine.js（与页面内联引擎同源同版），通过 postMessage 收发
importScripts('engine.js');
const E = self.GomokuEngine;

self.onmessage = function (e) {
  const d = e.data;
  try {
    const b = new E.Board();
    if (d.stack) for (let i = 0; i < d.stack.length; i++) { const m = d.stack[i]; b.play(m[0], m[1], m[2]); }
    const res = E.chooseMove(b, d.player, d.timeLimit, d.opts || {});
    self.postMessage({ reqId: d.reqId, ok: true, move: res.move, pv: res.pv, info: res.info });
  } catch (err) {
    self.postMessage({ reqId: d.reqId, ok: false, error: String((err && err.message) || err) });
  }
};
