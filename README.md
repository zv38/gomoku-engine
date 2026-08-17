# 五子棋引擎 Gomoku Engine v2

准职业级五子棋 AI，纯 JavaScript 实现，零依赖。内置玻璃拟态 Web 界面，浏览器打开即玩；同时提供 Node 命令行引擎，可用于自对弈、A/B 棋力对比与回归测试。

## 特性

- **PVS 迭代加深搜索**：主变搜索（Principal Variation Search）+ 迭代加深 + 杀手着法/历史表着法排序
- **VCF / VCT 威胁搜索**：连续冲四杀（VCF）与连续活三杀（VCT），能稳定算出 10+ 手的强制连杀
- **Zobrist 换位表**：哈希去重，避免重复局面重复搜索
- **精确棋型识别**：预计算 3^9=19683 种线型查找表，评估 O(1) 查表，黑白复用
- **威胁组合（跨线聚合）**：四三、双四、双活三等跨线组合加成，量级介于活四与冲四之间；黑棋双四/双三禁手点不给加成
- **增量评估 O(1)**：play/undo 时维护全局计数，评估与合法着法生成不随盘面增大而变慢
- **禁手规则**：黑棋三三、四四、长连禁手识别与过滤（可选）
- **Web Worker 后台搜索**：重型搜索移出主线程，界面不卡顿
- **玻璃拟态 UI**：暗色基底 + 玻璃拟态、极光背景、落子扩散动画、五连发光穿透线、AI 思考呼吸光晕、胜利粒子特效

## 快速开始

### 网页版（浏览器直接玩）

直接用浏览器打开 `gomoku_play.html` 即可，无需任何安装。

也可以起个本地静态服务器：

```bash
npx serve .
# 然后访问 http://localhost:3000/gomoku_play.html
```

支持选择持方（黑/白）、三档难度、AI 性格、悔棋、提示与对局记录。

### Node 命令行引擎

```bash
node -e "const E=require('./engine.js'); const b=new E.Board(); b.play(7,7,E.BLACK); console.log(E.chooseMove(b,E.WHITE,1.0));"
```

`engine.js` 同时暴露全局 `GomokuEngine`（浏览器）与 `module.exports`（Node）。

## 目录结构

```
├── gomoku_play.html      # 可玩的 Web 界面（引擎已内联，自包含）
├── gomoku_worker.js      # Web Worker：后台搜索线程
├── engine.js             # 核心引擎（v2，浏览器 / Node 双端）
├── engine.py             # Python 参考实现（纯标准库）
├── sync_engine.js        # 开发工具：将 engine.js 同步进 gomoku_play.html
└── tools/
    ├── selftest.js       # 引擎自检（棋型 / VCF / VCT / 禁手）
    ├── ab_strength.js    # A/B 棋力对比：优化版 vs 旧版
    ├── regress.js        # 回归测试（多局自对弈合法性）
    ├── verify_opt.js     # 增量评估 / 查表正确性校验
    ├── bench.js          # 微基准
    └── baselines/        # 历史版本引擎（对比基准）
```

## 测试与验证

```bash
# 自检：棋型 / VCF / VCT / 禁手 / 压力
node tools/selftest.js

# 回归：8 局自对弈，断言每步必落空点
node tools/regress.js

# 正确性：增量评估 == 全盘扫描，查表 == 字符串版
node tools/verify_opt.js

# A/B 棋力对比：默认与 baselines/engine_base.js 对战
node tools/ab_strength.js 20 0.3        # 20 局，每手 0.3 秒
node tools/ab_strength.js 20 0.3 path\to\other_engine.js
```

建议用 120+ 局获取稳定胜率（小样本波动大）。

## 引擎设计要点

- 评估量级即优先级：`FIVE(1e9) > OPEN_FOUR(1e7) > 四三/双四(8e6) > 双活三(3e5) > 冲四(1e5) > 活三(1e4) …`
- 组合威胁按**全盘聚合**统计（非单线），跨线四三/双四才能被正确捕获
- 换位表用 Zobrist 哈希，栈式增量维护，避免哈希重建

## License

本项目采用 **MIT 或 Apache-2.0 双许可**（Dual-licensed under MIT OR Apache-2.0），任选其一即可，详见 [LICENSE](LICENSE) 与 [LICENSE-APACHE](LICENSE-APACHE)。
