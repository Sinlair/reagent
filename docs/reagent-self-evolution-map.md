# ReAgent 自我进化能力分级图

Date: 2026-04-11
Status: Working draft
Owner: Codex working pass

## 为什么写这份文档

“ReAgent 能不能自我进化”这个问题，很容易把三件事混在一起：

1. 运行时是否可配置、可学习、可沉淀
2. 系统是否能把高质量输出转成可复用能力
3. 系统是否应该无边界地自动修改自己

这三件事不是同一个问题。

这份文档的目标是把 ReAgent 当前所处的位置、合理可做的下一步，以及高风险不建议做的方向拆开说清楚。

## 一句话结论

截至当前仓库状态，`ReAgent` 的整体位置更接近：

**`L1：可配置、可沉淀、可受控适配`，并且已经具备部分通向 `L2：候选能力生成` 的基础设施。**

它**还不是**一个“会自动重写自己”的系统，也**不应该**直接朝“无约束自我进化”去设计。

## 分级定义

### L0. 静态系统

- 只能执行固定流程
- 没有持久记忆、能力注册、运行时审计
- 不能把结果沉淀成后续可复用资产

### L1. 可配置适配

- 可以调整角色、技能、模型路由、命令授权、调度策略
- 可以保留 memory、artifact、audit、task state
- 变化来自 operator、配置文件、显式命令，而不是系统自己无监督改自己

### L2. 候选能力生成

- 系统能从 report、artifact、feedback 中提炼“候选 preset / tool / skill”
- 这些候选是建议，不自动生效
- 需要人工审核、验证、启用

### L3. 受控封装进化

- 系统能把通过审核的候选封装成模块、技能或预设
- 可以进入 workspace，但必须带审计、版本、回滚点
- 仍然要求显式批准

### L4. 边界内自优化

- 系统可在严格边界内自动微调部分非核心配置
- 例如调度时间、摘要策略、候选优先级、有限范围的 route fallback
- 必须满足：审计、回滚、阈值、人工覆盖优先

### L5. 无约束自我修改

- 自动生成并启用技能
- 自动重写系统提示或核心代码
- 自动放宽权限与策略
- 自动递归扩大 agent/tool 边界

这一级不是 ReAgent 当前应追求的目标。

## 当前评估

### 总体判断

- 当前总体等级：`L1`
- 接近 `L2` 的部分：artifact 沉淀、runtime seams、job/audit 基础
- 明确不应直接跨入的部分：`L5`

### 分维度评估

| 维度 | 当前等级 | 判断 | 仓库依据 |
| --- | --- | --- | --- |
| Runtime seams | `L1.5` | 已有 ToolRegistry、ToolExecutionPipeline、runtime hooks、audit trail，说明系统在向“可插拔、可观测”方向演进，但这些能力仍服务于受控运行时，而不是自改闭环。 | [src/agents/runtime.ts](../src/agents/runtime.ts), [src/agents/toolRegistry.ts](../src/agents/toolRegistry.ts), [src/agents/toolExecutionPipeline.ts](../src/agents/toolExecutionPipeline.ts) |
| Skills | `L1` | 已支持 workspace skills、frontmatter、env/config gating、enable/disable、状态检查，但没有“自动生成并自动启用技能”的实现。 | [src/services/skillRegistryService.ts](../src/services/skillRegistryService.ts), [workspace/skills/](../workspace/skills) |
| Memory / Artifacts | `L1.5` | 已有 durable memory、artifact 检索、research rounds、handoff/workstream memo，为“从输出沉淀出候选能力”打下基础，但还没有自动候选生成闭环。 | [README.md](../README.md), [src/routes/research.ts](../src/routes/research.ts), [src/services/memoryCompactionService.ts](../src/services/memoryCompactionService.ts) |
| Jobs / Schedulers | `L1` | 已有 discovery scheduler 和 memory compaction scheduler，以及统一的 runtime jobs 可观测层，但还不是通用型自演化作业系统。 | [src/app.ts](../src/app.ts), [src/services/runtimeJobsService.ts](../src/services/runtimeJobsService.ts) |
| Policy / Guardrails | `L1` | remote workspace mutation 和 session control 通过 allow / allowlist 管理，说明系统是“受控变更”思路，不是自由自改。 | [src/services/inboundCommandPolicyService.ts](../src/services/inboundCommandPolicyService.ts) |
| Core self-modification | `L0` | 没有发现自动改 TypeScript 代码、自动重写系统提示并持久化、自动启用新技能的实现。 | 仓库当前实现与设计文档结论 |

## 现在已经具备的“类进化”能力

这些能力更准确地说是“可积累、可调优、可沉淀”，而不是“自我进化”：

- 研究结果会沉淀成 report、presentation、module asset、workstream memo，而不是一次性回复
- runtime 会保留 audit、session digest、task state、scheduler runs
- operator 可以切换 role、skills、model route、fallback route、reasoning effort
- workspace 可以持续追加 skills、MCP servers、LLM routes、命令策略
- feedback、direction、memory 会影响后续研究质量和上下文组织

## 合理可做的下一步

这些方向是 ReAgent **可以做**、而且和项目定位一致的“受控进化”：

### 1. Report -> preset candidate

把高质量 report 提炼成“可复用预设候选”：

- 研究方向摘要
- 推荐查询模板
- 候选排序偏好
- 关注 venue / benchmark / baseline

输出应是：

- candidate JSON / markdown
- 审核前不自动生效

这和 roadmap 的方向一致：  
[ROADMAP.md](../ROADMAP.md)

### 2. Module asset -> skill candidate

把成熟的 module asset 转成 skill 候选：

- skill title
- short instruction
- reference files
- required env
- related tools

输出应是：

- `workspace skill candidate`
- 经过 operator confirm 后才纳入 workspace

### 3. Research-only bounded delegation

把 `search / reading / synthesis` 进一步做成受约束子工作流：

- 子角色边界明确
- 交付物是 handoff artifact
- 不开放任意递归 swarm

### 4. Job suggestion, not job self-spawn

系统可以建议新增作业，例如：

- weekly direction brief
- stale artifact refresh
- report follow-up review

但建议阶段和启用阶段必须分离。

## 高风险且不建议现在做的方向

以下能力虽然听起来“更聪明”，但不适合 ReAgent 当前阶段：

### 1. 自动生成并自动启用技能

这是设计文档里明确提醒不要急着做的方向。

风险：

- prompt 漂移
- skill 边界失控
- operator 不知道系统到底学到了什么
- 调试和回滚难度陡增

### 2. 自动重写系统提示或核心 runtime

风险：

- 破坏 runtime 可解释性
- 引入不可追踪回归
- 安全策略和能力边界可能被绕开

### 3. 自动修改仓库代码并长期固化

如果没有完整的：

- 审核
- 测试
- 回滚
- 变更归因

那这不叫自我进化，更像“自动制造不可控技术债”。

### 4. 无边界递归 subagent

风险：

- orchestration 复杂度高于研究收益
- token 和状态快速失控
- 交付物变模糊

## 设计原则

如果 ReAgent 要继续增强“进化”能力，应该遵守这些原则：

### 原则 1：只进化可复用资产，不优先进化核心人格

优先沉淀：

- preset
- report template
- retrieval hint
- module asset
- skill candidate

而不是优先让系统去改：

- system prompt
- 核心 runtime 代码
- 全局安全策略

### 原则 2：先生成候选，再人工批准

推荐顺序：

1. 生成 candidate
2. 展示 evidence / reason
3. 人工 review
4. 显式启用
5. 保留回滚点

### 原则 3：把“进化”限制在 research workspace 主线

最适合沉淀的不是通用 agent 花活，而是：

- 研究方向
- 查询策略
- 证据整理方式
- 报告模板
- 可复用研究模块

### 原则 4：所有变化都要可审计

任何进一步的自适应能力都至少应具备：

- 变更前状态
- 变更后状态
- 触发来源
- 证据来源
- operator 覆盖方式
- 回滚方式

## 推荐阶段图

### Phase A. 把当前 L1 做扎实

目标：

- 让 runtime、skills、jobs、artifacts 的边界更清晰

建议：

- 继续强化 hooks / audit / tool pipeline
- 让 artifact metadata 更适合下游复用
- 让 skills / presets / models / commands 的状态更可见

### Phase B. 进入 L2

目标：

- 支持 candidate generation，但不自动生效

建议：

- report -> preset candidate
- module asset -> skill candidate
- feedback -> ranking/prompt hint candidate

### Phase C. 有条件进入 L3

目标：

- 允许经过审核的候选正式进入 workspace

前提：

- validation
- provenance
- rollback
- operator approval

### Phase D. 谨慎探索 L4

目标：

- 只在局部、低风险、可回滚配置上做自动优化

前提：

- 有清晰指标
- 有失败阈值
- 有默认回退

## 对当前问题的最终回答

如果问题是：

**“ReAgent 现在能不能像一个 autonomous self-improving agent 一样自我进化？”**

答案是：

**不能。**

如果问题是：

**“ReAgent 现在有没有向受控进化方向演进的基础设施？”**

答案是：

**有，而且已经有了不错的基础。**

最合适的路线不是“让它自动改自己”，而是：

**让它把高质量研究输出逐步沉淀成可审核、可启用、可回滚的 reusable preset / skill / module。**

## 相关文档

- [README.md](../README.md)
- [ROADMAP.md](../ROADMAP.md)
- [docs/hermes-agent-for-reagent.md](./hermes-agent-for-reagent.md)
- [src/agents/runtime.ts](../src/agents/runtime.ts)
- [src/services/skillRegistryService.ts](../src/services/skillRegistryService.ts)
- [src/services/inboundCommandPolicyService.ts](../src/services/inboundCommandPolicyService.ts)
- [src/services/runtimeJobsService.ts](../src/services/runtimeJobsService.ts)
