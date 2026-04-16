# PRD: Hermes Agent 改造

## 1. Introduction / Overview

ReAgent 当前已经具备一批明显带有 Hermes Agent 风格的 runtime seams，包括：

- entry-aware toolsets
- runtime hooks 与 audit trail
- per-sender role / skills / model / fallback / reasoning 控制
- OpenClaw host session 的 `sessions / history / watch` 入口
- research workstream 与候选能力沉淀

但这些能力现在分散在多个表面：

- `reagent channels agent ...`
- 顶层 `reagent sessions | history | watch`
- `/api/channels/wechat/agent*`
- `workspace/channels/agent-runtime.json`
- `workspace/channels/agent-runtime-audit.jsonl`

这导致两个问题：

1. 对 operator 来说，ReAgent 已经有 agent runtime，但还没有一个一等公民的“agent 控制面”。
2. 对外心智模型仍偏 WeChat / channel implementation，而不是 Hermes 风格的统一 runtime surface。

本次改造的目标不是把 ReAgent 改造成泛化的通用 agent 产品，而是在保持研究工作台定位的前提下，补齐一个 Hermes Agent 风格、兼容 OpenClaw 心智模型、可直接落地到 CLI / API / Web 的统一 agent runtime 产品面。

## 2. Goals

- 提供一个一等公民的 `reagent agent` 根命令族，统一 agent runtime 的查看与控制。
- 提供一个一等公民的 `/api/agent/*` 命名空间，替代当前 WeChat 专属的 agent API 心智模型。
- 把 runtime session、host session、hooks、tool policy、delegation、audit 关联到同一个可观察模型中。
- 让 operator 可以在 3 步内完成：找 session、看 profile、改 runtime 配置。
- 保持现有 `reagent channels agent ...` 与 `reagent sessions|history|watch` 命令可继续使用，不做破坏式迁移。
- 支持有边界的 delegation，优先服务 `search / reading / synthesis` 研究子工作流，而不是开放递归 swarm。
- 在 Web console 中补齐 Agent Runtime 观察与操作入口。

## 3. User Stories

### US-001: 统一 Agent Session 标识
**Description:** 作为 operator，我希望 direct / ui / wechat / openclaw 都映射到统一的 agent session 标识，这样我可以用一个模型理解 runtime 状态，而不是记住不同入口的特例。

**Acceptance Criteria:**
- [ ] 定义 canonical `sessionId`，至少支持 `direct`、`ui`、`wechat`、`openclaw` 四类入口。
- [ ] 现有 `wechat:<senderId>` 持久化记录可被兼容读取，不要求一次性丢弃旧数据。
- [ ] session detail 返回 `sessionId`、`entrySource`、`senderId`、`updatedAt`、`digest`、`turnCount`。
- [ ] session detail 返回 `enabledToolsets` 与 `availableToolsets`。
- [ ] Typecheck/lint passes

### US-002: 一等公民的 Root CLI Agent Surface
**Description:** 作为 operator，我希望从根 CLI 直接查看和修改 agent runtime，而不是必须记住 `channels agent` 与 `sessions/history/watch` 的分散入口。

**Acceptance Criteria:**
- [ ] 新增 `reagent agent sessions`
- [ ] 新增 `reagent agent session <sessionId|senderId>`
- [ ] 新增 `reagent agent history <sessionId|senderId>`
- [ ] 新增 `reagent agent profile <sessionId|senderId>`
- [ ] 新增 `reagent agent role|skills|model|fallbacks|reasoning`
- [ ] CLI `--json` 输出结构稳定，能区分 canonical 字段与 legacy alias 字段
- [ ] Typecheck/lint passes

### US-003: 兼容旧命令而不破坏现有流
**Description:** 作为现有 ReAgent 用户，我希望升级后旧命令仍然能工作，这样我的脚本、习惯和文档不会立即失效。

**Acceptance Criteria:**
- [ ] `reagent channels agent session|role|skills|model|fallbacks|reasoning` 继续可用
- [ ] 顶层 `reagent sessions|history|watch` 继续可用
- [ ] CLI help 明确标注 canonical surface 与 compatibility alias
- [ ] 旧命令输出与新命令输出在核心字段上保持一致
- [ ] Typecheck/lint passes

### US-004: Hooks 与 Audit 可直接检查
**Description:** 作为 operator，我希望直接查看某个 agent session 的 llm/tool/reply hooks 与审计记录，这样我能判断 runtime 为什么这么做。

**Acceptance Criteria:**
- [ ] 新增 `reagent agent hooks <sessionId|senderId> [--limit N]`
- [ ] 支持按 `event`、`source`、`senderId`、`sessionId` 过滤 hooks / audit
- [ ] hook 事件至少覆盖 `llm_call`、`tool_call`、`tool_blocked`、`tool_error`、`reply_emit`
- [ ] hook 详情包含时间、stage、toolName、provider/model、reason 或 preview
- [ ] Typecheck/lint passes

### US-005: Host Session 与 Runtime Session 关联可见
**Description:** 作为 operator，我希望看到 OpenClaw host session 与 ReAgent runtime session 的关联关系，这样我能排查“host 在哪条线，runtime 在哪条线”的问题。

**Acceptance Criteria:**
- [ ] session detail 可选返回 `hostSessionKey`、`accountId`、`threadId`、`lastHostSyncAt`
- [ ] 新增 `reagent agent host sessions`
- [ ] 新增 `reagent agent host history <sessionKey>`
- [ ] runtime session 不存在 host 映射时，返回空值而不是伪造关联
- [ ] Typecheck/lint passes

### US-006: 受约束的 Delegation Surface
**Description:** 作为 operator，我希望从 agent runtime 发起受约束 delegation，只允许研究子工作流级别的委派，这样可以提高吞吐但不引入失控 swarm。

**Acceptance Criteria:**
- [ ] 新增 `reagent agent delegate <sessionId|senderId> <search|reading|synthesis>`
- [ ] 新增 `reagent agent delegates`
- [ ] 每个 delegation 记录包含输入、边界、状态、输出 artifact 路径、错误信息
- [ ] delegation 默认禁止递归创建 delegation
- [ ] delegation 输出必须沉淀为 artifact 或 memo，而不是仅停留在 stdout
- [ ] Typecheck/lint passes

### US-007: 统一 Agent API Namespace
**Description:** 作为集成方或 Web console 开发者，我希望通过 `/api/agent/*` 访问统一 agent runtime，而不是继续依赖 `/api/channels/wechat/agent*` 这种 channel-specific 路径。

**Acceptance Criteria:**
- [ ] 新增 `/api/agent/runtime`
- [ ] 新增 `/api/agent/sessions`
- [ ] 新增 `/api/agent/sessions/:sessionId`
- [ ] 新增 `/api/agent/sessions/:sessionId/history`
- [ ] 新增 `/api/agent/sessions/:sessionId/hooks`
- [ ] 新增 `/api/agent/sessions/:sessionId/profile`
- [ ] 新增 `/api/agent/delegations` 与 `/api/agent/delegations/:delegationId`
- [ ] 现有 `/api/channels/wechat/agent*` 作为兼容 wrapper 保留
- [ ] Typecheck/lint passes

### US-008: Web Console Agent Runtime 视图
**Description:** 作为 operator，我希望在 Web console 里查看 session 列表、profile、history、hooks 和 delegation，这样我不必只依赖 CLI 做排查。

**Acceptance Criteria:**
- [ ] Web console 新增 Agent Runtime 入口
- [ ] 至少包含 `Sessions`、`Profile`、`History`、`Hooks`、`Delegations` 五个信息区
- [ ] 支持按 `entrySource`、`updatedAt`、`llmStatus` 过滤 session
- [ ] 支持从 session 列表跳转到详情页
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

## 4. Functional Requirements

- FR-1: 系统必须提供 canonical agent runtime surface，命名为 `agent`，并在根 CLI 中暴露。
- FR-2: 系统必须为每个 agent session 生成可稳定引用的 `sessionId`，而不是仅依赖 WeChat senderId。
- FR-3: session model 必须支持 `direct`、`ui`、`wechat`、`openclaw` 四种 entry source。
- FR-4: 系统必须继续兼容现有 `channels agent` 命令族。
- FR-5: 系统必须继续兼容现有顶层 `sessions`、`history`、`watch` host surface。
- FR-6: `reagent agent sessions` 必须支持 `--source`、`--limit`、`--json`。
- FR-7: `reagent agent session` 必须返回 role、skills、provider/model、fallbackRoutes、reasoning、toolsets、digest、last messages。
- FR-8: `reagent agent history` 必须返回 runtime conversation history，而不是 host history 的隐式替代品。
- FR-9: `reagent agent hooks` 必须返回内建 runtime audit hook 事件。
- FR-10: hook/audit 返回必须区分 `llm_call`、`tool_call`、`tool_error`、`tool_blocked`、`reply_emit`。
- FR-11: 系统必须暴露当前 session 的 policy / toolset 边界，至少包括允许 toolsets 与当前 entry source。
- FR-12: 系统必须允许 operator 修改 role、skills、model、fallbackRoutes、reasoningEffort。
- FR-13: profile 修改必须同时支持 canonical API 和兼容 alias API。
- FR-14: `/api/agent/sessions/:sessionId/profile` 必须支持读取与更新 session profile。
- FR-15: 系统必须返回 runtime session 与 host session 的显式关联字段，而不是把两者混成一个对象。
- FR-16: host session 相关查询必须保持只读，不因为查看 host state 而修改 runtime state。
- FR-17: delegation 只能支持受约束类型：`search`、`reading`、`synthesis`。
- FR-18: delegation 必须记录 `status`，至少包括 `queued`、`running`、`completed`、`failed`、`cancelled`。
- FR-19: delegation 必须记录输出 artifact 或 memo 路径。
- FR-20: delegation 默认禁止二次 delegation，除非后续有单独需求与 guardrail 设计。
- FR-21: Web console 必须提供 Agent Runtime 总览与 session 详情。
- FR-22: 所有新表面必须支持 JSON 可读输出或结构化响应，方便脚本与 UI 复用。
- FR-23: 所有新的 agent surface 必须可审计，且能追溯到 sessionId 与触发时间。
- FR-24: 现有持久化文件在迁移后必须继续可读，不能要求用户手工清理 workspace。

## 5. Non-Goals (Out of Scope)

- 不把 ReAgent 改造成与 Hermes Agent 完全同构的通用 agent 平台。
- 不追求与 Hermes 或 OpenClaw 在所有 CLI 细节上的 byte-for-byte parity。
- 不做 unrestricted recursive multi-agent swarm。
- 不做自动修改仓库代码的“自我进化”闭环。
- 不在本期引入 experiment execution、sandbox orchestration、secret vault、device pairing 等更大范围 host/runtime 能力。
- 不重写现有 research / memory / channels 主产品线。
- 不要求第一期就把所有旧路径删除或强制迁移。

## 6. Design Considerations

- 设计语言应延续 ReAgent 当前“runtime + operator console”风格，而不是复制一套完全陌生的 Hermes UI。
- CLI 层应强调“canonical command + compatibility alias”的关系，减少认知切换成本。
- Web 详情页建议按 operator 排障顺序组织：
  1. Profile
  2. History
  3. Hooks
  4. Host linkage
  5. Delegations
- session 列表中应优先展示：
  - entrySource
  - senderId
  - role
  - model
  - last activity
  - whether host-linked
- blocked tool calls 应在 UI 中明确显示原因，而不是只显示失败。

## 7. Technical Considerations

- 当前 runtime session 持久化文件为 `workspace/channels/agent-runtime.json`，且实现中 `buildSessionKey(senderId)` 仍硬编码为 `wechat:<senderId>`。本次改造需要把 session identity 泛化到多入口，同时兼容旧 key。
- 当前 runtime audit 已写入 `workspace/channels/agent-runtime-audit.jsonl`，可直接作为 hooks / audit 读取基线，无需另造一套日志机制。
- 当前 OpenClaw host session 已落在 `workspace/channels/openclaw-sessions.json`。改造应以“关联显示”为原则，而不是把 host state 复制进 runtime store。
- 当前 `/api/channels/wechat/agent` 与 `/api/channels/wechat/agent/sessions` 已具备基础 session/profile 能力。建议新增独立 `AgentSurfaceService` 或等价抽象，由新旧 routes 共同调用，避免 route 层逻辑重复。
- 当前 root CLI 已具备 `sessions / history / watch` 顶层 host 命令。建议新增 `reagent agent host ...` 作为 canonical host 子表面，同时保留顶层 alias。
- delegation 建议优先复用现有 `ResearchRoundService`、handoff、workstream memo 与 artifact 路径，而不是创建一套与 research 无关的新 delegation 仓储。
- Web console 的 Agent Runtime 页面应优先复用现有 API 调用与布局模式，不做全站导航重构。
- 需要补齐测试：
  - session store 迁移测试
  - new CLI family 测试
  - API wrapper 一致性测试
  - hooks 过滤测试
  - delegation artifact test
  - UI smoke test

## 8. CLI / API / Data Structure Draft

### 8.1 CLI Draft

```bash
reagent agent runtime
reagent agent sessions --source wechat --limit 20
reagent agent session wechat:wx-user-1
reagent agent history wechat:wx-user-1
reagent agent hooks wechat:wx-user-1 --limit 30
reagent agent profile wechat:wx-user-1
reagent agent role wechat:wx-user-1 researcher
reagent agent skills wechat:wx-user-1 workspace-control,memory-ops,research-ops
reagent agent model wechat:wx-user-1 proxy-a gpt-5.4
reagent agent fallbacks wechat:wx-user-1 proxy-a/gpt-5.4,proxy-b/gpt-4.1
reagent agent reasoning wechat:wx-user-1 high
reagent agent host sessions
reagent agent host history agent:main:thread:wx-user-1
reagent agent delegate wechat:wx-user-1 search --task <taskId>
reagent agent delegates --status running
```

兼容 alias：

```bash
reagent channels agent session wx-user-1
reagent channels agent role wx-user-1 researcher
reagent channels agent skills wx-user-1 workspace-control,memory-ops
reagent channels agent model wx-user-1 proxy-a gpt-5.4
reagent channels agent fallbacks wx-user-1 proxy-a/gpt-5.4
reagent channels agent reasoning wx-user-1 high

reagent sessions
reagent history <sessionKey>
reagent watch <sessionKey>
```

### 8.2 API Draft

```http
GET    /api/agent/runtime
GET    /api/agent/sessions?source=wechat&limit=20
GET    /api/agent/sessions/:sessionId
GET    /api/agent/sessions/:sessionId/history?limit=50
GET    /api/agent/sessions/:sessionId/hooks?limit=50&event=tool_blocked
GET    /api/agent/sessions/:sessionId/profile
PATCH  /api/agent/sessions/:sessionId/profile

GET    /api/agent/host/sessions?limit=20
GET    /api/agent/host/sessions/:sessionKey/history?limit=50

GET    /api/agent/delegations?status=running&sessionId=wechat:wx-user-1
POST   /api/agent/delegations
GET    /api/agent/delegations/:delegationId
POST   /api/agent/delegations/:delegationId/cancel
```

兼容 wrapper：

```http
GET  /api/channels/wechat/agent
GET  /api/channels/wechat/agent/sessions
POST /api/channels/wechat/agent/role
POST /api/channels/wechat/agent/skills
POST /api/channels/wechat/agent/model
POST /api/channels/wechat/agent/fallbacks
POST /api/channels/wechat/agent/reasoning
```

这些 wrapper 应内部转调 canonical agent surface，而不是继续维护两套独立逻辑。

### 8.3 Data Structure Draft

#### AgentSessionProfile

```json
{
  "sessionId": "wechat:wx-user-1",
  "entrySource": "wechat",
  "senderId": "wx-user-1",
  "senderName": "Alice",
  "hostSessionKey": "agent:main:thread:wx-user-1",
  "accountId": "wx_ops_2",
  "threadId": "thread-1",
  "lastHostSyncAt": "2026-04-14T10:00:00.000Z",
  "roleId": "researcher",
  "skillIds": ["workspace-control", "memory-ops", "research-ops"],
  "enabledToolsets": ["workspace", "memory", "research-core"],
  "availableToolsets": ["workspace", "memory", "research-core", "research-admin", "research-heavy", "mcp"],
  "providerId": "proxy-a",
  "modelId": "gpt-5.4",
  "wireApi": "responses",
  "fallbackRoutes": [
    { "providerId": "proxy-b", "modelId": "gpt-4.1" }
  ],
  "reasoningEffort": "high",
  "llmStatus": "ready",
  "digest": {
    "updatedAt": "2026-04-14T10:00:00.000Z",
    "recentUserIntents": ["User asked: compare browser agents"],
    "recentToolOutcomes": ["discovery_run: completed"],
    "pendingActions": ["Send one paper title to continue."]
  },
  "turnCount": 12,
  "updatedAt": "2026-04-14T10:00:00.000Z"
}
```

#### AgentHookAuditEvent

```json
{
  "eventId": "evt_01",
  "ts": "2026-04-14T10:00:00.000Z",
  "sessionId": "wechat:wx-user-1",
  "senderId": "wx-user-1",
  "source": "wechat",
  "event": "tool_blocked",
  "stage": "tool-continue",
  "providerId": "proxy-a",
  "modelId": "gpt-5.4",
  "toolName": "workspace_write",
  "reason": "Tool call blocked by runtime policy.",
  "preview": "Blocked write attempt to remote workspace.",
  "roleId": "researcher",
  "skillIds": ["workspace-control", "research-ops"]
}
```

#### AgentDelegationRecord

```json
{
  "delegationId": "dlg_01",
  "sessionId": "wechat:wx-user-1",
  "taskId": "task_123",
  "kind": "search",
  "status": "running",
  "input": {
    "prompt": "Find strong browser-agent baselines",
    "scope": "research-only",
    "allowRecursiveDelegation": false
  },
  "artifact": {
    "path": "workspace/research/rounds/task_123/workstreams/search.md",
    "type": "workstream-memo"
  },
  "createdAt": "2026-04-14T10:00:00.000Z",
  "updatedAt": "2026-04-14T10:03:00.000Z",
  "error": null
}
```

## 9. Success Metrics

- 90% 的常见 agent runtime 排障可以通过 `reagent agent ...` 完成，而不需要同时记住 `channels agent` 与顶层 host 命令。
- operator 在 30 秒内可以定位一个 session 的 role、model、reasoning 与最近 hook 事件。
- 新老命令并存后，现有 CLI 用法无明显回归。
- runtime session 与 host session 的关联误判率接近 0；缺失关联时优先返回空值。
- delegation 输出可被 reopen，而不是只能在一次终端输出中查看。
- Web console 的 Agent Runtime 页面可完成最小闭环：列表、详情、过滤、跳转。

## 10. Open Questions

- canonical sessionId 是否直接采用 `<entrySource>:<senderId>`，还是引入独立 UUID + alias map？
- `reagent agent runtime` 是否需要展示全局默认 route、skills registry 与 hooks health，还是仅展示 session 统计？
- profile 更新应以一个 `PATCH /profile` 统一提交为主，还是继续保留 role/skills/model/fallbacks/reasoning 的细分 endpoint 作为主路径？
- delegation 第一阶段是否只允许 operator 手动触发，暂不开放给 inbound slash commands？
- Web console 第一阶段是否允许直接编辑 profile，还是只做只读观察加 CLI 跳转提示？
