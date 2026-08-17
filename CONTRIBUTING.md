# 贡献指南 Contributing

欢迎贡献！无论是提 issue、修 bug、加功能还是改进文档，都很感谢。

## 起步

1. **Fork** 本仓库并克隆到本地
2. 创建功能分支：`git checkout -b feat/my-feature`
3. 提交前运行自检确保无回归：

   ```bash
   node tools/selftest.js   # 引擎自检
   node tools/regress.js    # 回归测试
   ```

4. 推送分支并发起 Pull Request

## 开发说明

- 核心引擎在 [engine.js](engine.js)，浏览器 / Node 双端可用
- 修改引擎后，用 `node sync_engine.js` 同步进 `gomoku_play.html` 的内联脚本
- Web 界面使用 Web Worker（[gomoku_worker.js](gomoku_worker.js)）跑后台搜索
- 测试/基准脚本统一放在 `tools/` 目录

## 提交规范

- 使用语义化提交信息，例如 `feat: ...`、`fix: ...`、`perf: ...`、`docs: ...`
- 一句话说明"为什么改"，而非"改了哪些文件"

## 代码风格

- 保持与现有代码一致的风格（2 空格缩进、无分号亦可，与文件内现有风格保持一致）
- 引擎改动须保证评估/搜索量级语义不被破坏（见 [README](README.md#引擎设计要点) 的威胁量级说明）
- 新功能尽量带上 `tools/` 下的验证脚本

## 许可证

本仓库采用 MIT OR Apache-2.0 双许可。你的贡献默认按此许可授权。
