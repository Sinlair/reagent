# ReAgent 自我进化任务清单

Date: 2026-04-11
Status: Working draft
Owner: Codex working pass

## 目的

这份清单把 [reagent-self-evolution-map.md](./reagent-self-evolution-map.md) 里的分级判断，收敛成可直接进入开发排期的任务列表。

目标不是让 ReAgent 变成“自动改自己”的系统，而是推动它沿着这条路线前进：

1. 先把 `L1` 的 runtime seams、artifact metadata、review surfaces 做扎实
2. 再进入 `L2`，生成 `preset / skill / module` 候选
3. 再进入 `L3`，把经审核的候选纳入 workspace

## 范围边界

### 本清单包含

- candidate 生成、存储、审查、启用
- report / module asset / feedback 到 reusable preset 的转换
- review、audit、rollback、dry-run
- 研究场景下的受控 delegation 基础

### 本清单不包含

- 自动改 TypeScript 源码
- 自动改 system prompt 并持久化
- 自动生成并自动启用技能
- 无边界递归 subagent

## 执行顺序

推荐顺序：

1. `SE-1xx`: 打基础
2. `SE-2xx`: 候选生成
3. `SE-3xx`: 受控启用
4. `SE-4xx`: 低风险局部自优化

## Phase A: 把 L1 做扎实

### SE-101 候选能力数据模型

- 优先级：`P0`
- 目标：引入统一的 candidate 数据结构，作为后续 preset / skill / module 候选的共同底座
- 建议内容：
  - 新增 `candidateType`
  - 新增 `sourceType`
  - 新增 `status`: `draft | reviewed | approved | rejected | applied`
  - 新增 `evidence`
  - 新增 `review`
  - 新增 `applyResult`
- 建议落点：
  - `src/types/`
  - `src/schemas/`
  - `src/services/`
- 建议文件：
  - `src/types/evolutionCandidate.ts`
  - `src/schemas/evolutionCandidateSchema.ts`
  - `src/services/evolutionCandidateService.ts`
- 验收标准：
  - 可以本地持久化 candidate
  - 可以 list / get / update status
  - candidate 带完整 provenance 和 review 字段
- 测试建议：
  - candidate schema parse test
  - candidate repository/service CRUD test

### SE-102 Candidate 存储与审计

- 优先级：`P0`
- 目标：所有候选都必须可追踪、可回看、可审计
- 建议内容：
  - 设计候选存储目录
  - 记录候选生成来源
  - 记录批准、拒绝、应用日志
- 建议落点：
  - `workspace/research/`
  - `src/services/`
- 建议文件：
  - `src/services/evolutionCandidateService.ts`
  - `src/services/jobRuntimeObservabilityService.ts`
  - `src/agents/runtimeAuditService.ts`
- 验收标准：
  - 每个 candidate 都能追溯到 source artifact / report / feedback
  - review 操作有 audit trail
  - apply 操作有 audit trail
- 测试建议：
  - audit event persistence test
  - candidate review lifecycle test

### SE-103 CLI 与 API 审查面

- 优先级：`P0`
- 目标：给 candidate 增加可用的 inspection / review surface
- 建议内容：
  - CLI 支持 `list / get / approve / reject / apply / dry-run`
  - HTTP route 支持 candidate list/detail/review/apply
- 建议落点：
  - `src/cli/`
  - `src/routes/`
- 建议文件：
  - `src/cli/researchArtifactsReports.ts`
  - `src/routes/research.ts`
  - `src/cli.ts`
- 示例命令：
  - `reagent research candidates`
  - `reagent research candidate <id>`
  - `reagent research candidate approve <id>`
  - `reagent research candidate apply <id> --dry-run`
- 验收标准：
  - operator 能完整 review 一个 candidate 生命周期
  - 所有 apply 动作都有 dry-run
- 测试建议：
  - CLI dispatch test
  - route authorization and payload validation test

### SE-104 Artifact Metadata 补强

- 优先级：`P0`
- 目标：让 report / module asset / direction report 足够“可转化”
- 建议内容：
  - 补充更稳定的 metadata
  - 标明 evidence level、inference、topic、direction、reusability hints
- 建议落点：
  - `src/types/researchArtifacts.ts`
  - `src/services/researchPresentationService.ts`
  - `src/services/researchModuleAssetService.ts`
  - `src/services/researchDirectionReportService.ts`
- 验收标准：
  - 一个 artifact 不看全文也能判断是否可转为 preset / skill 候选
- 测试建议：
  - artifact metadata serialization test
  - recent artifact listing regression test

## Phase B: 进入 L2 候选生成

### SE-201 Report -> Preset Candidate

- 优先级：`P1`
- 目标：从高质量 report 中提炼“研究预设候选”
- 建议内容：
  - 从 report 提炼 topic summary
  - 生成 query hints
  - 生成 venue / benchmark / baseline preferences
  - 生成 ranking hints
- 建议落点：
  - `src/services/researchDirectionReportService.ts`
  - `src/services/evolutionCandidateService.ts`
  - `src/routes/research.ts`
- 目标产物：
  - `preset-candidate.json`
  - 对应 markdown explanation
- 验收标准：
  - 输入一份 direction report 或 research report，能生成可审查 candidate
  - candidate 必须带 evidence 摘要和 reason
- 测试建议：
  - report-to-preset candidate generation test
  - invalid report input test

### SE-202 Module Asset -> Skill Candidate

- 优先级：`P1`
- 目标：把稳定 module asset 转成 skill 候选
- 建议内容：
  - 生成 skill title
  - 生成 instruction
  - 推导 reference files
  - 推导 required env / related tools
  - 生成可写入 `SKILL.md` 的候选草案
- 建议落点：
  - `src/services/researchModuleAssetService.ts`
  - `src/services/skillRegistryService.ts`
  - `src/services/evolutionCandidateService.ts`
- 验收标准：
  - 生成的 skill candidate 可人工审阅
  - 生成结果不会自动写入 `workspace/skills/`
- 测试建议：
  - module-asset-to-skill-candidate test
  - candidate references path-safety test

### SE-203 Feedback -> Ranking Hint Candidate

- 优先级：`P1`
- 目标：把 feedback 变成 retrieval / ranking 的候选策略，而不是只做展示
- 建议内容：
  - 汇总 useful / not-useful / more-like-this / less-like-this
  - 产出 ranking hint candidate
  - 允许被 direction profile 或 preset 采用
- 建议落点：
  - `src/services/researchFeedbackService.ts`
  - `src/services/researchDirectionService.ts`
  - `src/services/evolutionCandidateService.ts`
- 验收标准：
  - feedback 不再只是历史记录
  - 至少能输出一种结构化 ranking hint candidate
- 测试建议：
  - feedback summary to candidate test
  - repeated feedback dedup / aggregation test

### SE-204 Candidate Generation Dashboard

- 优先级：`P1`
- 目标：在 web console 中可见 candidate 队列与 review 状态
- 建议内容：
  - recent candidates
  - candidate detail
  - evidence / reason 面板
  - review status badge
- 建议落点：
  - `web/app.js`
  - `web/index.html`
  - `web/styles.css`
- 验收标准：
  - 可以在 UI 中浏览 candidate，而不必只靠 CLI
- 测试建议：
  - route smoke test
  - UI rendering snapshot or DOM assertions if the repo later adds them

## Phase C: 进入 L3 受控启用

### SE-301 Candidate Dry-Run Apply

- 优先级：`P1`
- 目标：所有 candidate 在真正启用前都必须支持 dry-run
- 建议内容：
  - 比较 before / after
  - 展示会修改哪些文件或配置
  - 展示风险与依赖
- 建议落点：
  - `src/services/workspaceConfigService.ts`
  - `src/services/skillRegistryService.ts`
  - `src/services/evolutionCandidateService.ts`
- 验收标准：
  - 不落盘也能完整预览变更
  - dry-run 输出能直接用于 code review / operator review
- 测试建议：
  - config dry-run apply test
  - skill candidate dry-run materialization test

### SE-302 Approved Preset -> Workspace Config

- 优先级：`P1`
- 目标：把批准的 preset candidate 纳入 workspace 管理配置
- 建议内容：
  - 写入 direction/profile/preset 存储
  - 保留 applied-by / applied-at / source-candidate-id
  - 保证可回滚
- 建议落点：
  - `src/services/workspaceConfigService.ts`
  - `src/services/researchDirectionService.ts`
  - `src/routes/research.ts`
- 验收标准：
  - apply 后可从 CLI 与 UI 看到生效结果
  - rollback 后能恢复到 apply 前状态
- 测试建议：
  - apply + rollback lifecycle test

### SE-303 Approved Skill Candidate -> Workspace Skill

- 优先级：`P1`
- 目标：把批准后的 skill candidate 材料化为受控 workspace skill
- 建议内容：
  - 输出到 `workspace/skills/<name>/SKILL.md`
  - 写入 references
  - 更新 skills config
  - 保留 source candidate metadata
- 建议落点：
  - `src/services/skillRegistryService.ts`
  - `workspace/skills/`
  - `src/services/evolutionCandidateService.ts`
- 验收标准：
  - skill materialization 是显式操作
  - 文件生成路径安全
  - skill 能被 registry 正常识别
- 测试建议：
  - generated skill discovery test
  - path traversal safety test

### SE-304 Review Policy And Guardrails

- 优先级：`P0`
- 目标：把 candidate review / apply 也纳入命令与权限治理
- 建议内容：
  - 本地允许
  - 远程默认只读
  - remote apply 必须 allowlist
- 建议落点：
  - `src/services/inboundCommandPolicyService.ts`
  - `src/services/inboundCommandRegistry.ts`
  - `src/services/inboundCommandHandlers.ts`
- 验收标准：
  - 远程 surface 不能无授权 apply candidate
  - review 与 apply 分级授权
- 测试建议：
  - policy authorization test
  - remote apply rejection test

## Phase D: 有条件探索 L4

### SE-401 Low-Risk Auto-Tuning

- 优先级：`P2`
- 前提：
  - 已有 candidate review + apply + rollback
  - 已有稳定指标
- 目标：只在低风险局部配置上做自动调优
- 候选范围：
  - scheduler default time suggestion
  - retrieval ranking weight suggestion
  - summary depth preference suggestion
- 明确不包括：
  - 自动生成并启用技能
  - 自动改核心 runtime
  - 自动改系统提示
- 验收标准：
  - 所有 auto-tuning 都可关闭
  - 所有变化都能回滚
- 测试建议：
  - threshold / rollback / disable flag test

## 依赖关系

最关键依赖如下：

- `SE-101` 是所有后续 candidate 工作的前置
- `SE-102` 和 `SE-103` 完成后，才适合做 `SE-201` 到 `SE-204`
- `SE-301` 是 `SE-302` 和 `SE-303` 的前置
- `SE-304` 最晚必须在 `SE-302` 与 `SE-303` 落地前完成
- `SE-401` 必须晚于整个 `Phase C`

## 推荐拆票方式

如果要拆成 issue，建议这样分：

### Milestone 1: Candidate Foundation

- `SE-101`
- `SE-102`
- `SE-103`
- `SE-104`

### Milestone 2: Candidate Generation

- `SE-201`
- `SE-202`
- `SE-203`
- `SE-204`

### Milestone 3: Controlled Promotion

- `SE-301`
- `SE-302`
- `SE-303`
- `SE-304`

### Milestone 4: Optional Local Optimization

- `SE-401`

## 建议的最小可交付路径

如果只做一条最小闭环，推荐顺序是：

1. `SE-101` 候选模型
2. `SE-102` 候选审计
3. `SE-103` CLI / API 审查面
4. `SE-201` report -> preset candidate
5. `SE-301` dry-run apply
6. `SE-302` approved preset -> workspace config

这样就能先得到一条完整的受控进化链路：

`report -> candidate -> review -> dry-run -> apply -> rollback`

## 相关文档

- [reagent-self-evolution-map.md](./reagent-self-evolution-map.md)
- [README.md](../README.md)
- [ROADMAP.md](../ROADMAP.md)
- [docs/hermes-agent-for-reagent.md](./hermes-agent-for-reagent.md)
