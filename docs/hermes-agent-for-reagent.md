# Hermes Agent 对 ReAgent 的借鉴备忘

Date: 2026-04-09
Status: Draft for review
Owner: Codex working pass

## 为什么写这个文档

最近在对比 `NousResearch/hermes-agent` 和 `ReAgent` 的产品形态、运行时设计、扩展机制与长期演进方向。

结论不是“让 ReAgent 追求 Hermes 全量对齐”，而是：

1. `Hermes Agent` 更像通用型 agent runtime。
2. `ReAgent` 更像 research workspace / research operating system。
3. `ReAgent` 最值得学习的是 Hermes 的 runtime seams，而不是抄它的全部产品边界。

这份文档的目标，是把这个判断固化成一份可以落到仓库演进中的设计备忘。

## 产品定位判断

### Hermes Agent 更像什么

从公开仓库和官方文档来看，`Hermes Agent` 的重点在于：

- 通用型 agent loop
- tool / toolset 组织
- skills 与记忆协作
- scheduled tasks
- subagent delegation
- plugin 与 event hooks
- 多入口、多平台、长期运行的 agent runtime

参考：

- https://github.com/NousResearch/hermes-agent
- https://hermes-agent.nousresearch.com/docs/developer-guide/architecture/
- https://hermes-agent.nousresearch.com/docs/developer-guide/agent-loop/
- https://hermes-agent.nousresearch.com/docs/user-guide/features/tools/
- https://hermes-agent.nousresearch.com/docs/user-guide/features/skills/
- https://hermes-agent.nousresearch.com/docs/user-guide/features/cron/
- https://hermes-agent.nousresearch.com/docs/user-guide/features/delegation/
- https://hermes-agent.nousresearch.com/docs/user-guide/features/hooks/
- https://hermes-agent.nousresearch.com/docs/developer-guide/context-compression-and-caching/

### ReAgent 更像什么

`ReAgent` 当前主线已经比较明确：

- 一个常驻 runtime
- 一个 CLI 主控面
- 一个可检查的 web console
- durable memory
- durable research artifacts
- research-first 的工具与工作流
- channel / OpenClaw / workspace 共同接入

这在仓库里已经写得很清楚：

- [README.md](../README.md)
- [ROADMAP.md](../ROADMAP.md)

代码层面也已经有对应基础：

- agent runtime: [src/agents/runtime.ts](../src/agents/runtime.ts)
- chat service facade: [src/services/chatService.ts](../src/services/chatService.ts)
- workspace skills: [src/services/skillRegistryService.ts](../src/services/skillRegistryService.ts)
- MCP registry: [src/services/mcpRegistryService.ts](../src/services/mcpRegistryService.ts)
- channel entry / policy: [src/services/channelService.ts](../src/services/channelService.ts)
- remote command policy: [src/services/inboundCommandPolicyService.ts](../src/services/inboundCommandPolicyService.ts)
- memory compaction: [src/services/memoryCompactionService.ts](../src/services/memoryCompactionService.ts)
- runtime startup and schedulers: [src/app.ts](../src/app.ts)

## 总判断

`ReAgent` 不应该把自己重写成 “另一个 Hermes”。

更合适的路线是：

- 保持 `ReAgent = Research Workspace / Research OS`
- 学习 `Hermes = Agent Runtime 内核设计`
- 把 Hermes 值得借鉴的能力吸收到 ReAgent 的研究工作台主线里

一句话说：

**ReAgent 要借鉴 Hermes 的内核组织方式，而不是复制 Hermes 的产品身份。**

## ReAgent 现在最值得保留的东西

在借鉴 Hermes 之前，先明确哪些东西不该在重构里被冲掉。

### 1. Runtime + CLI + Artifact 的产品主循环

`ReAgent` 不是 chat wrapper，这一点已经是优势，不该弱化。

保留重点：

- CLI 仍然是主控面
- web console 仍然是 inspection surface
- artifact 仍然比一次性回复更重要

参考：

- [README.md](../README.md)
- [ROADMAP.md](../ROADMAP.md)

### 2. Entry-aware runtime 的方向是对的

当前 runtime 已经有这些概念：

- `role`
- `skill`
- `activeEntrySource`
- `toolset`
- `MCP`
- session-level model / fallback / reasoning route

这说明 `ReAgent` 已经开始往“不是所有入口都拥有同一套能力”的方向走了，这是应该继续加强的，而不是回退。

参考：

- [src/agents/runtime.ts](../src/agents/runtime.ts)

### 3. Workspace memory 和 durable artifacts 是真正差异点

`ReAgent` 的长期价值不是“它也能做 deep research”，而是：

- 研究过程会留下结构化痕迹
- 研究输出可以回看、复用、复盘
- memory 和 artifact 不是聊天窗口里的临时上下文

这条主线比对齐通用 super-agent 更重要。

## 优先借鉴项

下面这些是我认为 `ReAgent` 最应该优先向 Hermes 学习的内容，按价值和落地性排序。

### P0. 正式的 Tool Registry 与 Runtime Hooks

#### 为什么最优先

当前 `ReAgent` 已经有一个可用的 agent runtime，但工具定义、工具筛选、工具执行和部分结果组织，仍然较集中地耦合在 [src/agents/runtime.ts](../src/agents/runtime.ts) 里。

这在功能还少时可接受，但在下面这些需求继续增加后会变得吃力：

- 新研究工具持续扩张
- artifact 工具要向 OpenClaw / package 面复用
- 需要更好的审计、拦截、指标
- 需要在不同入口上套不同 guardrail
- 需要插件或包级能力注入

Hermes 更值得借鉴的是：

- tool registry
- toolset 组合
- pre/post hook
- plugin 生命周期钩子

#### 建议落地方式

先不要做大而全插件系统，先做最小可用的 runtime seam：

1. 从 `AgentRuntime` 中拆出 `ToolRegistry`
2. 每个工具改成独立注册项，而不是继续堆在主类里
3. 加入统一 hook 点

建议的 hook 最小集合：

- `pre_llm_call`
- `post_llm_call`
- `pre_tool_call`
- `post_tool_call`
- `tool_error`
- `pre_reply_emit`

#### 对 ReAgent 的直接价值

- 更容易给研究工具扩容
- 更容易给远程入口加审计与约束
- 更容易把 OpenClaw / package / workspace 的工具能力统一起来
- 更容易把 artifact 生成、通知、索引更新变成 hook，而不是 scattered side effects

#### 初始落点

- [src/agents/runtime.ts](../src/agents/runtime.ts)
- [src/services/channelService.ts](../src/services/channelService.ts)
- [src/services/inboundCommandPolicyService.ts](../src/services/inboundCommandPolicyService.ts)

### P1. Skills 的 Progressive Disclosure，而不是一次性塞满 prompt

#### 现状判断

`ReAgent` 已经有一个不错的 workspace skill 基础：

- 支持本地 `SKILL.md`
- 支持 frontmatter
- 支持 env/config gating
- 支持工作区级 skill 管理

参考：

- [src/services/skillRegistryService.ts](../src/services/skillRegistryService.ts)
- [workspace/skills/](../workspace/skills)

但当前技能体系还更像“静态补充提示”，还不够像“按需展开的程序性知识层”。

#### 应该借鉴 Hermes 的哪部分

最值得学的是 skills 的 progressive disclosure 思路：

- 先暴露 skill catalog
- 只给模型短描述和触发条件
- 真正需要时再加载 skill body
- 再按需加载 skill 指向的参考文件

#### 建议落地方式

给 `ReAgent` 的 skill 体系补三层能力：

1. `skill catalog`
   - 只返回 `id`、`label`、`instruction`、`status`
2. `skill body`
   - 需要时才拼入 prompt
3. `skill references`
   - skill 允许声明 `references/`、模板、样例，只在必要时装入上下文

#### 对 ReAgent 的直接价值

- 减少 prompt 膨胀
- 让 research-specialized skill 更容易扩展
- 为以后做 `report -> reusable preset` / `module asset -> reusable skill` 打基础

#### 需要注意

不要直接复制 Hermes 的“技能自我进化”叙事。

更适合 `ReAgent` 的版本是：

- 允许从 report / module asset 生成候选 skill
- 需要人工审核或 operator confirm
- 生成的是 reusable preset，而不是无边界自改系统提示

### P1. Session Context Compression，而不是只做 turn 截断

#### 现状判断

当前 runtime 已经有 session turn 管理，但更接近“窗口裁剪”：

- `MAX_TURNS_PER_SESSION = 16`

参考：

- [src/agents/runtime.ts](../src/agents/runtime.ts)

这对研究任务来说偏保守，因为研究任务的高价值上下文通常不是“最近几句对话”，而是：

- 当前研究 brief
- 已确认方向
- 最近工具结果
- 正在处理的 artifact
- 未完成的下一步

#### 应该借鉴 Hermes 的哪部分

不是“压缩聊天记录”这个表层动作，而是：

- session 内摘要层
- tool trace 的结构化保留
- prompt caching / compressed context 的思路

#### 建议落地方式

新增一个 session digest 层，而不是只保留 turn 列表。

建议至少拆出这些摘要：

- `conversation_digest`
- `research_digest`
- `artifact_digest`
- `recent_tool_outcomes`
- `pending_actions`

这和已有的 workspace memory 不是替代关系，而是互补关系：

- memory 管长期事实与长期笔记
- session digest 管当前任务推进中的短中期上下文

#### 初始落点

- [src/agents/runtime.ts](../src/agents/runtime.ts)
- [src/services/memoryCompactionService.ts](../src/services/memoryCompactionService.ts)

### P2. 把专用 Scheduler 升级为通用 Job Runtime

#### 现状判断

`ReAgent` 已经不止一个 scheduler 了：

- memory compaction scheduler
- research discovery scheduler

而且它们都在 app 启动时作为 runtime 子系统被管理。

参考：

- [src/app.ts](../src/app.ts)

这其实已经说明：`ReAgent` 在形态上离通用 job runtime 不远了。

#### 应该借鉴 Hermes 的哪部分

Hermes 值得借鉴的不是 cron 语法本身，而是：

- 任务可被命名
- 任务在 fresh session 中运行
- 任务拥有自己的一组上下文和技能
- 任务结果可以投递回具体 surface
- 任务有审计记录

#### 建议落地方式

把多个 scheduler 统一到一个 `JobRuntime` 抽象下：

- `job type`
- `schedule`
- `entry surface`
- `capability profile`
- `delivery target`
- `retry policy`
- `audit trail`

适合最早纳入的 job：

- 每日论文推送
- 每周方向简报
- memory compaction
- 报告补全 / presentation refresh

#### 初始落点

- [src/app.ts](../src/app.ts)
- [src/services/researchDiscoverySchedulerService.ts](../src/services/researchDiscoverySchedulerService.ts)
- [src/services/memoryCompactionSchedulerService.ts](../src/services/memoryCompactionSchedulerService.ts)

### P2. 受约束的 Subagent Delegation，只服务研究流水线

#### 现状判断

`ReAgent` 的 roadmap 对多 agent 很克制，这个判断是对的。

参考：

- [ROADMAP.md](../ROADMAP.md)

不应该为了“看起来先进”而做 agent swarm。

#### 应该借鉴 Hermes 的哪部分

最值得借鉴的是受约束 delegation：

- 明确子任务边界
- 限制工具集
- 隔离上下文
- 回传 handoff summary，而不是把所有 token 带回来

#### 建议落地方式

只在研究流水线里做非常有限的角色拆分：

- `search agent`
- `reading agent`
- `synthesis agent`

每个子代理都输出标准 handoff artifact，例如：

- candidate set
- paper reading notes
- synthesis memo

#### 不建议做的版本

- 通用任意递归多 agent
- 无边界工具扩散
- 把复杂度堆给 orchestration 层

## 不建议现在照搬的部分

### 1. 不要优先追求“更通用的平台覆盖面”

`ReAgent` 当前真正需要的是把研究主线做深，而不是先覆盖更多聊天平台或更多通用 agent 表面能力。

### 2. 不要急着做“自动生成并自动启用技能”

这类能力很容易带来：

- prompt 漂移
- 可审计性下降
- operator 不知道系统到底学到了什么

更适合的做法是：

- 先生成候选
- 再人工审核
- 再纳入 workspace skill 或 preset

### 3. 不要为了对齐 Hermes 而削弱 Research Workspace 定位

如果 `ReAgent` 最后变成“也能聊天、也能调工具、也能跑点任务”的通用 runtime，它反而会失去最有价值的差异点。

应坚持：

- research brief
- discovery quality
- evidence-backed report
- artifact retrieval
- durable memory

这和 [ROADMAP.md](../ROADMAP.md) 当前方向是一致的。

## 建议的阶段化落地顺序

### Phase 1: Runtime seams

目标：

- 让 agent runtime 更可扩展、更可审计

交付建议：

1. 抽出 `ToolRegistry`
2. 抽出 `ToolExecutionPipeline`
3. 加最小 hook 集合
4. 把重要远程动作统一记入 audit trail

成功标志：

- 新增一个工具不再需要修改主循环多个位置
- 入口限制、审计和错误处理能统一挂在 pipeline 上

### Phase 2: Context and jobs

目标：

- 让 runtime 更适合长研究任务和周期性工作

交付建议：

1. session digest
2. 压缩策略与摘要持久化
3. 通用 `JobRuntime`
4. 把 discovery 和 compaction 迁入统一 job 模型

成功标志：

- 研究任务跨多轮后仍能保持清晰上下文
- 定时工作不再各自维护一套执行模型

### Phase 3: Research-only delegation

目标：

- 在不破坏产品清晰度的前提下提升研究吞吐

交付建议：

1. `search` / `reading` / `synthesis` 三类子工作流
2. handoff artifact 结构
3. 子代理工具边界
4. report -> reusable preset / skill candidate

成功标志：

- 多 agent 的价值体现在研究交付速度和质量上
- 而不是体现在架构图更复杂

## 这份文档对应的核心判断

可以把这份备忘压缩成三句话：

1. `Hermes Agent` 值得 ReAgent 学的是 runtime 内核设计，不是产品身份复制。
2. `ReAgent` 应继续强化自己作为 research workspace / research OS 的定位。
3. 最优先的借鉴点是 tool registry、hooks、progressive skills、context compression、job runtime，以及研究场景下的受约束 delegation。

## 参考

### 外部参考

- Hermes Agent repository: https://github.com/NousResearch/hermes-agent
- Hermes Agent architecture: https://hermes-agent.nousresearch.com/docs/developer-guide/architecture/
- Hermes Agent loop: https://hermes-agent.nousresearch.com/docs/developer-guide/agent-loop/
- Hermes Agent tools: https://hermes-agent.nousresearch.com/docs/user-guide/features/tools/
- Hermes Agent skills: https://hermes-agent.nousresearch.com/docs/user-guide/features/skills/
- Hermes Agent cron: https://hermes-agent.nousresearch.com/docs/user-guide/features/cron/
- Hermes Agent delegation: https://hermes-agent.nousresearch.com/docs/user-guide/features/delegation/
- Hermes Agent hooks: https://hermes-agent.nousresearch.com/docs/user-guide/features/hooks/
- Hermes Agent context compression and caching: https://hermes-agent.nousresearch.com/docs/developer-guide/context-compression-and-caching/

### 仓库内参考

- [README.md](../README.md)
- [ROADMAP.md](../ROADMAP.md)
- [src/agents/runtime.ts](../src/agents/runtime.ts)
- [src/services/chatService.ts](../src/services/chatService.ts)
- [src/services/skillRegistryService.ts](../src/services/skillRegistryService.ts)
- [src/services/mcpRegistryService.ts](../src/services/mcpRegistryService.ts)
- [src/services/channelService.ts](../src/services/channelService.ts)
- [src/services/inboundCommandPolicyService.ts](../src/services/inboundCommandPolicyService.ts)
- [src/services/memoryCompactionService.ts](../src/services/memoryCompactionService.ts)
- [src/app.ts](../src/app.ts)
