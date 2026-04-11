# 变更日志

[English](./CHANGELOG.md)

本项目遵循 [Keep a Changelog](https://keepachangelog.com/) 格式。

## [0.1.10] - 2026-04-08

### 调整

- 参考 OpenClaw，把通道消息入口改成 command-first 的分流方式
- 新增意图路由，让普通问候和轻量聊天绕开 tool loop
- 研究和工作区操作意图继续走 agent runtime

### 修复

- 修掉 `你好` 这类普通问候掉进奇怪 fallback 文案的问题
- 在 agent runtime fallback 前输出真实错误日志，方便定位网关和模型兼容性问题

## [0.1.9] - 2026-04-08

### 调整

- 删除仓库内的多包结构，对外只保留一个官方包 `@sinlair/reagent`
- 简化发布脚本，校验、打包和发布都只针对根包
- 更新 README、release notes 和贡献文档，使产品叙事完全收敛到单包 CLI/runtime

### 修复

- 清掉运行时和前端里残留的 `@sinlair/reagent-openclaw` 安装提示
- 清理仓库中的运行时/测试生成垃圾，并加入忽略规则

## [0.1.8] - 2026-04-08

### 新增

- 根 CLI 新增 `reagent home`、`reagent onboard`、`reagent doctor --fix`
- 补齐围绕 standalone `@sinlair/reagent` 的根包发布流程

### 调整

- 产品主线重新收敛到 standalone 的 `reagent` always-on runtime/CLI
- `reagent home` 升级为真正的 dashboard 式入口，聚合 runtime、research、memory 和 next steps
- 对外安装入口收口为唯一官方 npm 包 `@sinlair/reagent`

### 修复

- 去掉 research task store 中重复持久化的 report 载荷
- 收紧发布元数据，避免多包叙事继续暴露给最终用户

## [0.1.0] - 2026-04-03

### 新增

- 首次公开发布 ReAgent，提供本地研究工作台和运行时 CLI
