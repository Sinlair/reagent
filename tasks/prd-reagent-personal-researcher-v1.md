# PRD: ReAgent 面向个人研究者的 V1 产品化

## 1. Introduction / Overview

ReAgent 当前已经具备强工程底座：

- 常驻 runtime、CLI、Web console、HTTP API
- research / memory / channels / jobs / artifacts 多表面并存
- canonical `reagent agent ...` 与 `/api/agent/*`
- runtime hooks、audit、host session linkage、bounded delegation
- `research/rounds/<taskId>/` 下的 durable dossier 与 workstream memo

但它距离“真正可公开交付、可被个人研究者长期使用的产品”还有明显差距。

当前主要问题不是“有没有功能”，而是：

- 首次安装和首次成功路径仍偏工程化
- research 结果质量与可信呈现还不够产品级
- 主流程仍偏“能力拼装”，不是清晰的个人研究者工作闭环
- 备份、恢复、升级、故障支持等产品可靠性能力不足
- Web 与 CLI 虽然能力强，但对个人研究者来说还不够像一个稳定、可理解的 v1 产品

这份 PRD 的目标是把 ReAgent 从“内部可用的工程产品雏形”推进到“面向个人研究者可公开试用的 v1 产品”。

核心用户：

- 个人研究者
- 有研究需求的开发者
- 想在本地长期积累方向、论文、笔记和产物的单人 operator

## 2. Goals

- 让新用户在 15 分钟内完成安装、初始化，并产出第一份可用研究结果。
- 让 research brief、discovery、report、artifact reopen 形成清晰的单人工作闭环。
- 让报告输出从“能看”提升到“可信、可复用、可回看”。
- 让个人用户能安全地备份、迁移和恢复整个 workspace。
- 让常见故障具备可操作的恢复提示，而不是只抛出工程错误。
- 让 Web console 和 CLI 都围绕个人研究者的主路径收束，而不是只暴露底层能力。
- 为公开试用前的发布验证增加稳定的产品级 smoke gate。

## 3. User Stories

### US-001: 首次运行 readiness 摘要
**Description:** 作为首次安装的个人研究者，我希望 `reagent onboard` 直接告诉我当前缺什么、先做什么，这样我不需要先读完整文档才能启动。

**Acceptance Criteria:**
- [ ] `reagent onboard` 按 `required` 和 `optional` 区分问题项
- [ ] readiness 输出至少覆盖：`.env`、workspace、database、LLM route、channel mode、runtime port
- [ ] 每个 blocking issue 都给出一条明确 next step
- [ ] `--json` 输出结构稳定，适合 Web 或脚本复用
- [ ] Tests pass
- [ ] Typecheck passes

### US-002: 安全 starter profile
**Description:** 作为首次安装的个人研究者，我希望用一个安全 starter profile 启动本地环境，这样我可以先进入产品主流程，再逐步切换到真实 provider。

**Acceptance Criteria:**
- [ ] `reagent onboard --apply` 在缺失配置时可落地 `fallback + mock` 的 starter profile
- [ ] 若已有明确配置，不覆盖用户已填写的 provider 值
- [ ] onboarding 完成后，`reagent home` 和 Web console 可直接进入可用状态
- [ ] 文案明确说明 starter profile 适合体验，不适合作为最终 research 质量基线
- [ ] Tests pass
- [ ] Typecheck passes

### US-003: 首份结果引导清单
**Description:** 作为首次进入 Web 的个人研究者，我希望首页明确告诉我下一步做什么，这样我能从空 workspace 快速到第一份可用结果。

**Acceptance Criteria:**
- [ ] `landing/home` 页面显示 “first useful report” checklist
- [ ] checklist 至少包含：创建 brief、运行 discovery / research、打开 report、保存 memory
- [ ] 每个 checklist step 都有明确 CTA，不要求用户手动记命令
- [ ] 当已有结果时，checklist 能显示已完成状态
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-004: 个人研究 brief 模板
**Description:** 作为个人研究者，我希望从模板创建 research brief，这样我不必每次从空白字段开始描述目标、约束和评价标准。

**Acceptance Criteria:**
- [ ] Web 中提供至少 3 个 personal research brief starter templates
- [ ] 模板至少覆盖：topic、target problem、success criteria、known baselines、evaluation priorities
- [ ] 用户可在模板基础上编辑后保存为 direction / brief
- [ ] brief 仍可继续导出或导入 markdown
- [ ] Tests pass
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-005: Discovery 结果可信解释
**Description:** 作为个人研究者，我希望 discovery 结果清楚展示为什么这些 paper 排在前面，并减少重复候选，这样我可以更快判断是否值得继续阅读。

**Acceptance Criteria:**
- [ ] discovery 结果卡片显示 ranking reasons
- [ ] 相同或高度重复的 paper 候选被显式抑制或合并
- [ ] 每个候选至少展示来源、年份、venue 或等价元数据
- [ ] discovery 空结果和弱结果有明确提示，不只显示空白
- [ ] Tests pass
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-006: 报告中的证据与置信度标签
**Description:** 作为个人研究者，我希望在 report 中直接区分事实、证据、推断与置信度，这样我可以判断结论是否可靠、是否值得复用。

**Acceptance Criteria:**
- [ ] report detail 为 evidence item 展示 `sourceType`、`confidence` 与 claim/support 结构
- [ ] paper-supported、code-supported、inference 至少有一种显式标签机制
- [ ] 低证据覆盖或高推断比例时，report 页面显式展示 warning
- [ ] 无 evidence 时显示明确空态而不是静默省略
- [ ] Tests pass
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-007: 最近产物浏览与重开
**Description:** 作为个人研究者，我希望快速重开最近的 report、presentation、module asset 和 workstream memo，这样上一次工作不会在下一次启动时消失。

**Acceptance Criteria:**
- [ ] Web 中提供 recent artifacts list，至少包含 report、presentation、module asset、workstream memo
- [ ] recent list 支持直接跳转到 detail view
- [ ] `reagent home` 至少显示最新 report 和最新 active task
- [ ] 对缺失 artifact 的情况给出可理解错误，而不是原始路径异常
- [ ] Tests pass
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-008: 单个产物导出包
**Description:** 作为个人研究者，我希望把一个研究结果导出成可分享的 bundle，这样我可以在本地之外复用报告和 supporting files。

**Acceptance Criteria:**
- [ ] 新增单个 artifact bundle 导出命令
- [ ] 导出包至少可包含：report、review、related workstream memo、核心元数据
- [ ] 导出结果是明确的本地文件路径
- [ ] 导出失败时说明缺了哪些文件
- [ ] Tests pass
- [ ] Typecheck passes

### US-009: Workspace 备份快照
**Description:** 作为个人研究者，我希望一条命令备份整个 workspace，这样我在换机器、更新版本或做实验前可以安全留档。

**Acceptance Criteria:**
- [ ] 新增 workspace backup snapshot 命令
- [ ] 备份至少覆盖：workspace memory、channels runtime state、research rounds、database 文件或等价持久化层
- [ ] 备份结果输出单个可定位的 snapshot 路径
- [ ] 备份不会默认覆盖已有 snapshot
- [ ] Tests pass
- [ ] Typecheck passes

### US-010: Workspace 恢复预览与应用
**Description:** 作为个人研究者，我希望恢复前先预览 snapshot 内容，再选择应用，这样我不会误覆盖当前 workspace。

**Acceptance Criteria:**
- [ ] 新增 restore preview 命令
- [ ] 新增 restore apply 命令
- [ ] preview 至少显示 snapshot 时间、包含内容、目标 workspace
- [ ] apply 之前要求显式确认或等价安全机制
- [ ] 恢复后 `reagent home`、research recent、memory files 可重新读取数据
- [ ] Tests pass
- [ ] Typecheck passes

### US-011: 故障恢复提示与支持包
**Description:** 作为个人研究者，我希望遇到故障时拿到具体恢复提示，并能导出一个支持包，这样我不需要手工翻日志排查。

**Acceptance Criteria:**
- [ ] `home`、`settings`、`channels`、`agents` 页面出现阻塞故障时显示可操作 recovery hint
- [ ] 新增 support bundle 导出命令
- [ ] support bundle 至少包含：runtime status、doctor summary、recent logs、channel lifecycle、agent runtime audit
- [ ] 支持包不默认包含敏感 secret 原文
- [ ] Tests pass
- [ ] Typecheck passes

### US-012: 面向个人研究者的 daily digest preset
**Description:** 作为个人研究者，我希望快速启用“每天给我一份研究更新”的默认配置，这样我不必手工拼 scheduler 参数。

**Acceptance Criteria:**
- [ ] Web 中提供 daily digest preset
- [ ] preset 至少配置 sender、time、topK、maxPapers 与 enabled 状态
- [ ] preset 能与当前 brief / direction 配合工作
- [ ] scheduler 空态和禁用态有清晰说明
- [ ] Tests pass
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-013: 产品级 browser smoke gate
**Description:** 作为维护者，我希望发布前自动跑一次 browser smoke，这样 public beta 不会因为核心页面损坏而直接发出去。

**Acceptance Criteria:**
- [ ] release verify 流程包含 browser smoke
- [ ] smoke 至少覆盖：`Sessions` 页、`Agents` 页、session 切换、history/hook/runtime 面板
- [ ] smoke 失败时能输出可定位的 artifact，例如截图或结果 JSON
- [ ] smoke 不依赖真实 WeChat pairing，默认可跑在 mock 环境
- [ ] Tests pass
- [ ] Typecheck passes

## 4. Functional Requirements

- FR-1: 系统必须把首次可用路径收束到 `onboard -> home -> brief -> research -> report -> reopen`。
- FR-2: onboarding 必须明确区分阻塞项与非阻塞项。
- FR-3: onboarding 必须提供安全 starter profile，而不是要求用户手工填完全部 provider 才能开始。
- FR-4: 首页必须为新用户提供 first useful report checklist。
- FR-5: Web 中必须提供 brief 模板创建流，而不是仅提供空白字段。
- FR-6: discovery 结果必须显示 ranking reasons。
- FR-7: discovery 结果必须有重复候选抑制或合并机制。
- FR-8: report 页面必须显式展示 evidence、confidence 和 support / inference 边界。
- FR-9: 报告弱质量状态必须有 warning，而不是只在内部 critique 中可见。
- FR-10: recent artifacts 必须支持快速重开。
- FR-11: 至少一种单个 artifact bundle 导出能力必须进入 v1。
- FR-12: 系统必须支持 workspace backup snapshot。
- FR-13: 系统必须支持 restore preview 与 restore apply。
- FR-14: backup / restore 必须覆盖 file-backed workspace state 和数据库层。
- FR-15: 常见阻塞故障必须给出 recovery hints。
- FR-16: 系统必须支持导出 support bundle。
- FR-17: support bundle 默认不得泄露明文 secret。
- FR-18: daily digest 必须提供面向个人研究者的 preset，而不是只暴露底层 scheduler 参数。
- FR-19: canonical `reagent agent ...` 与 `/api/agent/*` 必须继续作为 agent runtime 的主表面。
- FR-20: 现有兼容入口 `channels agent`、顶层 `sessions/history/watch` 不得在 v1 产品化过程中被破坏。
- FR-21: Web 中的 `Agents` 与 `Sessions` 页面必须以 canonical `agent` API 为数据源。
- FR-22: 发布前验证必须包含 browser smoke gate。

## 5. Non-Goals (Out of Scope)

- 不做多租户 SaaS
- 不做团队协作、评论、共享工作区权限模型
- 不做完整企业级 RBAC / secret vault / org admin 平台
- 不做 autonomous experiment execution
- 不做移动端 App
- 不做“自动自我修改代码”的自演化闭环
- 不追求与 OpenClaw / Hermes 的完全同构产品定位

## 6. Design Considerations

- 继续坚持“CLI 是主控制面，Web 是强 inspection + guided action 面”，不要把产品重心变成纯聊天界面。
- 首页和 onboarding 的语言要更偏产品文案，而不是运行时内部术语。
- 对个人研究者来说，优先展示：
  - 下一步做什么
  - 为什么推荐这个结果
  - 这个结果靠什么证据支撑
  - 之前的工作如何重新打开
- `Agents` / `Sessions` 页面应优先服务“理解当前 session 在做什么”，而不是服务 runtime 实现细节本身。
- 备份、恢复、导出、支持包这些能力要默认安全，不应以“用户知道自己在做什么”为前提。

## 7. Technical Considerations

- 现有 canonical agent surface 已存在：`reagent agent ...`、`/api/agent/*`、`web` 中 `Agents` / `Sessions` 页面，应继续复用，不要重新造一套 agent runtime 表面。
- 现有 runtime session state 已持久化到 `workspace/channels/agent-runtime.json`，delegation state 已持久化到 `workspace/channels/agent-delegations.json`，应直接复用。
- OpenClaw host session registry 与 transcript 已落在 `workspace/channels/openclaw-*`，host inspection 应继续基于这套缓存与只读读取实现。
- research 结果质量相关能力已部分存在：
  - `rankingReasons`
  - `evidence`
  - `confidence`
  - critique / review
  v1 的重点是更好地产品化展示与解释，而不是从零开始重做 research pipeline。
- `research/rounds/<taskId>/` 已经是 dossier 基线，artifact reopen、export、delegation artifact 应优先复用这套路径结构。
- backup / restore 设计需要明确：
  - 是否包含数据库快照
  - 是否采用 zip 包
  - 是否支持 preview manifest
- browser smoke 应优先复用现有 mock provider，不依赖真实 WeChat pairing。
- 发布验证建议接入现有 `release:verify`，不要新增平行发布流程。

## 8. Milestones

### P0: 从首次安装到首份可信结果

范围：

- US-001 首次运行 readiness 摘要
- US-002 安全 starter profile
- US-003 首份结果引导清单
- US-004 个人研究 brief 模板
- US-005 Discovery 结果可信解释
- US-006 报告中的证据与置信度标签
- US-007 最近产物浏览与重开
- US-011 故障恢复提示与支持包

完成标准：

- 新用户在不查源码的前提下完成首份结果闭环
- 首页、brief、discovery、report、artifact reopen 可串成稳定路径
- report 不再只是“能看”，而是“可判断可信度”

### P1: 稳定使用、迁移与发布护栏

范围：

- US-008 单个产物导出包
- US-009 Workspace 备份快照
- US-010 Workspace 恢复预览与应用
- US-012 面向个人研究者的 daily digest preset
- US-013 产品级 browser smoke gate

完成标准：

- 用户可以导出、备份、恢复自己的工作区
- 用户可以把 daily digest 作为日常入口，而不是只靠手动运行
- 发布验证对核心页面具备浏览器级保护

## 9. Success Metrics

- 首次安装到首份 report 的中位耗时小于 15 分钟。
- 首次 onboarding 后无需查 README 就能进入可用主流程的比例达到 80%。
- recent artifacts 中，用户能在 3 次点击内重开上一次 report 或 workstream memo。
- report detail 中，主要 findings 对应 evidence 的覆盖率明显高于当前基线。
- backup snapshot 与 restore apply 在干净 workspace 上可稳定成功。
- release verify 对核心页面断裂具备浏览器级阻断能力。

## 10. Open Questions

- v1 默认推荐的 LLM 路线应该是 `fallback` 体验优先，还是 `OpenAI` 质量优先？
- v1 是否继续把 `native WeChat` 作为默认对外叙事，还是以 `mock + OpenClaw` 为主？
- backup snapshot 的格式应该是 zip 包、目录快照，还是两者都支持？
- artifact export bundle 的最小范围是否只包含 report/review/workstream，还是应加入 selected memory context？
- public beta 阶段是否需要一个显式的“个人研究者 preset”而不是通用 workspace preset？
