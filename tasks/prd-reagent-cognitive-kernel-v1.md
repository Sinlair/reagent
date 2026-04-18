# PRD: ReAgent Cognitive Kernel v1

## 1. Introduction / Overview

ReAgent 当前已经有一套可用的 research workspace 与 host runtime：

- canonical `reagent agent ...` 与 `/api/agent/*`
- file-backed workspace memory、research rounds、artifacts
- hooks、audit、tool policies、bounded delegation
- OpenClaw host linkage 与多入口 session

但当前 agent 的“思考”仍主要停留在：

- recent turns
- session digest
- prompt 级规则
- tool call 的即时选择

这会导致几个问题：

- agent 更像“会调用工具的对话壳”，而不是持续积累判断的研究者
- 不同轮次之间缺少稳定的认知状态模型
- operator 能看到 session/profile/history/hooks，但看不到“它为什么这么想、现在在判断什么、下一步为什么做这个动作”
- delegation 和 tool policy 还没有真正由认知状态驱动

本次改造的目标不是做一个神经网络模型，也不是暴露完整 chain-of-thought，而是把 ReAgent 升级为一个：

- research-first workspace
- host runtime aware
- 有持续认知状态
- 可检查、可调试、可驱动行动

的 cognition kernel。

产品定位：

- ReAgent 继续是 `research workspace + host runtime + cognition kernel`
- Hermes-Agent 仍然是 runtime seam 的参考，不是目标同构产品
- cognition kernel 首先服务 research workflow，而不是抽象成纯通用 agent runtime

## 2. Goals

- 让 agent 拥有可持续的认知状态，而不是每轮只靠 recent turns 临时组织回答。
- 把认知状态组织成可解释的层：`perception / memory / hypothesis / reasoning / action / reflection`。
- 让 tool choice、next action、delegation 可以由认知状态驱动，而不只是 prompt 临场发挥。
- 让 operator 能在 CLI/API 中检查当前认知状态，而不暴露完整私有思维链。
- 让 Web `Agents` 面板最终具备 cognition inspection 能力。
- 保持 research-first 目标，不让 cognition kernel 偏离 brief、evidence、artifact、memory 的主工作流。

## 3. User Stories

### US-001: 建立结构化认知节点模型
**Description:** 作为系统开发者，我希望 agent 的认知状态不是字符串数组，而是结构化节点，这样后续才能做权重、冲突、衰减和行动决策。

**Acceptance Criteria:**
- [ ] 定义统一的 neuron node 结构
- [ ] neuron node 至少包含 `id`、`kind`、`content`、`salience`、`confidence`、`source`、`updatedAt`
- [ ] `kind` 至少支持 `perception`、`memory`、`hypothesis`、`reasoning`、`action`、`reflection`
- [ ] session 持久化结构可兼容旧 digest 数据读取
- [ ] Typecheck passes

### US-002: 让 session digest 基于认知节点构建
**Description:** 作为 operator，我希望 session digest 成为认知状态的摘要层，而不是唯一的状态层，这样 session 可以逐步成长。

**Acceptance Criteria:**
- [ ] session store 中新增持久化 cognition state
- [ ] 旧 `recentUserIntents`、`recentToolOutcomes`、`pendingActions` 保留为兼容摘要
- [ ] cognition state 可以从 turns 与旧 digest 推导初始化
- [ ] session 写回时不会破坏现有会话读取
- [ ] Tests pass
- [ ] Typecheck passes

### US-003: 引入多假设状态而不是单结论状态
**Description:** 作为研究者，我希望 agent 同时维护多个 hypothesis，这样它不会过早收敛到一个未经验证的结论。

**Acceptance Criteria:**
- [ ] cognition state 支持多个 hypothesis 节点
- [ ] hypothesis 节点可记录支持证据与冲突证据
- [ ] hypothesis 节点可记录当前置信度
- [ ] 没有足够证据时，agent 不会把 hypothesis 伪装成最终结论
- [ ] Typecheck passes

### US-004: 引入认知激活、衰减和冲突更新
**Description:** 作为系统开发者，我希望认知节点不是静态列表，而是会根据新输入和新证据激活、衰减和更新，这样更接近真实研究判断过程。

**Acceptance Criteria:**
- [ ] 新输入可提升相关节点 `salience`
- [ ] 长时间未触发的节点会衰减
- [ ] 新证据可更新节点 `confidence`
- [ ] 冲突证据可降低 hypothesis 置信度或标记冲突
- [ ] Tests pass
- [ ] Typecheck passes

### US-005: 在 prompt 中注入认知摘要而不是散乱上下文
**Description:** 作为 operator，我希望模型看到的是结构化 cognition summary，这样回答和行动更稳定。

**Acceptance Criteria:**
- [ ] prompt 中加入 `Neuron state` 或等价结构化 cognition block
- [ ] cognition block 至少覆盖 perception、memory、hypothesis、reasoning、action
- [ ] 注入内容可控，不暴露原始 chain-of-thought
- [ ] cognition block 与现有 memory primer、session history 共存
- [ ] Tests pass
- [ ] Typecheck passes

### US-006: 让工具选择由 cognition state 驱动
**Description:** 作为研究者，我希望 agent 在调用工具前先基于当前认知状态决定“为什么做”，这样行为更像研究工作流而不是随机工具调用。

**Acceptance Criteria:**
- [ ] tool choice 会读取当前 action/hypothesis/reasoning 节点
- [ ] 当高不确定性存在时，优先触发取证类动作而不是过早总结
- [ ] 当已有高置信度结论时，优先触发交付或复用类动作
- [ ] tool policy 仍然可以阻断不允许动作
- [ ] Tests pass
- [ ] Typecheck passes

### US-007: 让 delegation 由 cognition state 驱动
**Description:** 作为 operator，我希望 delegation 不是手工和 prompt 驱动的附属能力，而是认知状态下的明确行动选择。

**Acceptance Criteria:**
- [ ] delegation create path 可读取 action 节点与 hypothesis 状态
- [ ] `search / reading / synthesis` delegation 与当前 cognition state 对齐
- [ ] delegation 结果可写回 cognition state
- [ ] delegation 不会绕过现有 bounded guardrail
- [ ] Tests pass
- [ ] Typecheck passes

### US-008: 在 CLI 中暴露 cognition inspection
**Description:** 作为 operator，我希望通过根 CLI 检查当前 agent cognition，而不是只能看 turns 和 hooks。

**Acceptance Criteria:**
- [ ] 新增 `reagent agent cognition <sessionId|senderId>`
- [ ] cognition 输出至少覆盖 perception、memory、hypothesis、reasoning、action、reflection
- [ ] 支持 `--json`
- [ ] cognition 输出不包含原始私有思维链
- [ ] Tests pass
- [ ] Typecheck passes

### US-009: 在 HTTP API 中暴露 cognition inspection
**Description:** 作为 Web console 或集成方开发者，我希望通过 `/api/agent/*` 读取 cognition state，这样上层可以构建可观察 UI。

**Acceptance Criteria:**
- [ ] 新增 `/api/agent/sessions/:sessionId/cognition`
- [ ] API 返回结构与 CLI 认知模型一致
- [ ] API 返回不暴露原始 chain-of-thought
- [ ] 现有 session/profile/history/hooks API 不被破坏
- [ ] Tests pass
- [ ] Typecheck passes

### US-010: 在 Web Agents 面板中增加 cognition 观察区
**Description:** 作为 operator，我希望在 Web 的 `Agents` 面板中看到当前认知状态，这样我可以快速理解 agent 在想什么、下一步为什么这么做。

**Acceptance Criteria:**
- [ ] `Agents` 面板新增 cognition 区块
- [ ] cognition 区块至少显示 perception、hypothesis、reasoning、action
- [ ] cognition 区块支持空状态、弱状态、冲突状态提示
- [ ] cognition 区块不暴露原始私有思维链
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-011: 把 cognition state 与 workspace memory 对齐
**Description:** 作为研究者，我希望 agent 的 memory neuron 能和 workspace memory 形成明确边界，这样不会把短期认知和长期记忆混成一层。

**Acceptance Criteria:**
- [ ] cognition memory 节点可标注来自 workspace memory、session history、tool result、artifact 的来源
- [ ] workspace memory recall 命中可转成认知节点
- [ ] workspace memory 不会被误写成瞬时 hypothesis
- [ ] Typecheck passes

### US-012: 提供最小反思层
**Description:** 作为系统开发者，我希望每轮结束后 agent 能生成最小 reflection，这样后续轮次知道“这次行动是否缩小了不确定性”。

**Acceptance Criteria:**
- [ ] 每轮响应后生成 reflection 节点或等价摘要
- [ ] reflection 至少覆盖：这轮确认了什么、仍不确定什么、推荐下一步什么
- [ ] reflection 可驱动下一轮 action 节点更新
- [ ] Tests pass
- [ ] Typecheck passes

## 4. Functional Requirements

- FR-1: 系统必须为 agent session 持久化结构化 cognition state。
- FR-2: cognition state 必须支持 `perception`、`memory`、`hypothesis`、`reasoning`、`action`、`reflection` 六类节点。
- FR-3: 每个 cognition node 必须至少包含 `id`、`kind`、`content`、`salience`、`confidence`、`source`、`updatedAt`。
- FR-4: 现有 session digest 必须继续存在，但它必须降级为认知摘要层。
- FR-5: 系统必须兼容旧 session store 的读取。
- FR-6: 系统必须支持多个 hypothesis 并存，而不是只有一个 reasoning 结论。
- FR-7: hypothesis 必须能记录支持与冲突信息。
- FR-8: cognition node 必须支持激活、衰减和冲突更新。
- FR-9: prompt 必须注入结构化 cognition summary，而不是只注入扁平列表。
- FR-10: cognition summary 不得暴露原始 chain-of-thought。
- FR-11: tool selection 必须可以读取 cognition state。
- FR-12: delegation 选择必须可以读取 cognition state。
- FR-13: CLI 必须提供 cognition inspect 命令。
- FR-14: HTTP API 必须提供 cognition inspect 路由。
- FR-15: Web Agents 面板必须提供 cognition inspection UI。
- FR-16: cognition state 必须区分 workspace memory、session history、tool result、artifact 等来源。
- FR-17: 每轮结束后必须生成最小 reflection。
- FR-18: reflection 必须能更新下一轮 action 与 reasoning 状态。

## 5. Non-Goals (Out of Scope)

- 不实现真正神经网络或参数学习系统。
- 不暴露完整 chain-of-thought 给终端用户。
- 不把 ReAgent 改造成通用 agent cognition platform。
- 不在第一期引入 unrestricted recursive swarm。
- 不在第一期引入自动实验执行。
- 不在第一期重写整个 Channels 或 OpenClaw 层。

## 6. Design Considerations

- cognition kernel 必须服务 research-first 工作流，而不是偏离 brief、evidence、artifact。
- UI 上应展示“可检查的认知摘要”，而不是“模型私有思维原文”。
- CLI 与 Web 的认知视图要用同一套字段，不做两套心智模型。
- `reasoning` 应该表达当前判断框架，`hypothesis` 应该表达待验证候选结论，二者不要混在一起。
- `action` 应该表达当前下一步，而不是历史动作清单。

## 7. Technical Considerations

- 当前 `AgentRuntime` 已经有 session digest，可作为兼容层继续保留。
- 当前 `reagent agent ...` 与 `/api/agent/*` 已经存在，是 cognition inspect 的天然落点。
- 当前 Web `Agents` 面板已经有 session/profile/history/hooks 结构，适合再加 cognition 区块。
- 认知节点建议继续走 file-backed session store，避免第一期就引入单独数据库表。
- 多 hypothesis 与 action 决策可以先由 deterministic runtime rules 生成，不要求第一期就完全交给模型自由生成。

## 8. Success Metrics

- operator 能在 30 秒内通过 CLI 或 Web 看懂 agent 当前关注点、假设、判断和下一步动作。
- agent 在连续多轮研究任务中更少出现“每轮重置上下文”的行为。
- tool choice 与 delegation 更少出现与当前研究目标不一致的调用。
- 认知视图能够解释“为什么当前建议继续搜索/阅读/综合”，而不暴露原始 CoT。

## 9. Open Questions

- hypothesis 节点是否需要显式 `supportingNodeIds` / `conflictingNodeIds` 这样的图结构关系？
- 第一阶段的 `reflection` 应该是自动生成摘要，还是可以由工具执行结果直接写回？
- cognition 节点是否应该支持跨 session 迁移，还是先限定在单 session？
- `action` 节点是否应该直接驱动 bounded delegation，还是先只做建议层？
- Web cognition panel 第一阶段是否允许 operator 手工标记 hypothesis 为“confirmed / rejected”？
