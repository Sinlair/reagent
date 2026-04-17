# PRD: ReAgent Open-Source Productization v1

## 1. Introduction / Overview

ReAgent 当前已经具备一套有价值的本地优先 research workspace 内核：

- 常驻 runtime、CLI、Web console、HTTP API
- canonical `reagent agent ...` 与 `/api/agent/*`
- research brief、discovery、report、workstream、presentation、module asset、memory
- hooks、audit、host linkage、bounded delegation
- OpenClaw bridge、mock/native WeChat、workspace skills、MCP、配置控制

但它距离 “像 Hermes-Agent 那样可公开采用、可扩展、可维护的开源项目” 仍有明显差距。

当前缺口不主要在“再加几个 agent API”，而在以下几层：

- 公开采用门槛仍高：安装、升级、恢复、发布验证、回归保护还不够产品级
- 开发者平台还不完整：扩展 contract、样例、文档、兼容性边界还不清晰
- 开源运营面还不够稳：发布护栏、稳定入口、最小自助排障能力还不够
- 产品定位仍需收束：应该保持 research-first，而不是半途变成模糊的通用 agent runtime

这份 PRD 的目标不是把 ReAgent 改造成 Hermes-Agent 的完全复刻，而是把它产品化成一个：

- research-first
- 本地优先
- 可公开安装试用
- 可恢复、可调试、可发布
- 对第三方开发者有清晰扩展入口

的开源项目。

默认假设：

- ReAgent 继续保持 “research workspace / research operating system” 定位
- Hermes-Agent 作为 runtime seam 与开源产品表达的参考对象，而不是目标同构对象
- npm 全局安装继续作为主入口，独立安装包或更重分发方式可以作为后续增强

## 2. Goals

- 让新用户在 15 分钟内完成安装、onboard、启动 runtime，并打开可用 Web console。
- 让用户在升级、迁移、实验前可以安全备份并恢复 workspace。
- 让维护者在发布前通过自动化 smoke gate 阻断明显损坏的核心页面与核心 CLI 路径。
- 让用户在遇到常见故障时可以通过 product-facing hint 和 support bundle 自助定位问题。
- 让第三方开发者可以通过清晰的 skills / MCP / plugin / config 合约扩展 ReAgent。
- 让 README、docs、examples、release artifacts 足够支撑公开采用，而不是只适合仓库作者本人使用。
- 在不破坏 research-first 产品定位的前提下，把 ReAgent 做成“值得公开推荐”的开源项目。

## 3. User Stories

### US-001: 提供一条稳定的公开安装路径
**Description:** 作为第一次接触 ReAgent 的开源用户，我希望有一条明确且稳定的安装路径，这样我可以在不读源码的情况下完成安装和启动。

**Acceptance Criteria:**
- [ ] README 首页提供一条官方推荐安装路径
- [ ] 安装步骤覆盖 Node 版本、数据库初始化、runtime 启动、Web 入口
- [ ] 首次安装失败时有明确的 doctor 或 onboard 下一步
- [ ] 至少提供一条从空目录到可访问 Web console 的验证路径
- [ ] Typecheck passes

### US-002: 提供 release-grade 首次运行体验
**Description:** 作为第一次运行 ReAgent 的用户，我希望 onboard、home、runtime status 和 Web console 能形成连贯入口，这样我不会在第一步就掉进实现细节。

**Acceptance Criteria:**
- [ ] `reagent onboard` 输出的 next steps 与 `reagent home`、Web console 保持一致
- [ ] starter profile、channel mode、runtime health 的状态在 CLI 与 Web 中表达一致
- [ ] 关键首跑页面不会要求用户手工推断下一条命令
- [ ] 首次运行路径至少覆盖 onboard、home、service run、dashboard 或 Web console
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-003: 提供 workspace backup snapshot 命令
**Description:** 作为长期使用 ReAgent 的个人用户，我希望一条命令就能生成 workspace 备份快照，这样我可以在升级、迁移或实验前安全留档。

**Acceptance Criteria:**
- [ ] 新增 workspace backup snapshot 命令
- [ ] snapshot 至少覆盖 file-backed memory、channels runtime state、research rounds 与数据库文件或等价持久化层
- [ ] 成功执行后返回一个明确的本地 snapshot 路径
- [ ] 默认情况下不会覆盖已有 snapshot
- [ ] snapshot 元数据中记录创建时间与包含内容
- [ ] Tests pass
- [ ] Typecheck passes

### US-004: 提供 restore preview 与 restore apply
**Description:** 作为需要恢复工作区的用户，我希望在恢复前先预览 snapshot 内容，再明确执行恢复，这样我不会误覆盖当前 workspace。

**Acceptance Criteria:**
- [ ] 新增 restore preview 命令
- [ ] 新增 restore apply 命令
- [ ] preview 至少展示 snapshot 时间、包含内容、目标 workspace 路径
- [ ] apply 之前要求显式确认或等价安全机制
- [ ] restore 失败时保留清晰的错误信息，不做静默破坏
- [ ] Tests pass
- [ ] Typecheck passes

### US-005: 提供 support bundle 导出能力
**Description:** 作为遇到问题的开源用户，我希望导出一个不泄露 secrets 的 support bundle，这样我可以自己排查或者提交 issue。

**Acceptance Criteria:**
- [ ] 新增 support bundle 导出命令
- [ ] bundle 包含 runtime status、doctor summary、recent logs、channel lifecycle、agent runtime audit
- [ ] bundle 默认不包含明文 secrets
- [ ] 成功执行后返回一个明确的本地 bundle 路径
- [ ] bundle 可直接作为 issue 附件或本地诊断材料使用
- [ ] Tests pass
- [ ] Typecheck passes

### US-006: 在关键产品面提供 recovery hints
**Description:** 作为遇到阻塞错误的用户，我希望在关键页面直接看到恢复提示，这样我不用先读源码或翻日志。

**Acceptance Criteria:**
- [ ] Home、Settings、Channels、Agents 页面在阻塞错误场景下显示 product-facing recovery hint
- [ ] recovery hint 明确指出下一条命令、下一项设置或下一份诊断材料
- [ ] 默认不直接暴露内部 stack trace
- [ ] recovery hint 文案与 CLI doctor / status 结果一致
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-007: 建立发布前的 browser smoke gate
**Description:** 作为维护者，我希望发布前自动跑一套浏览器 smoke gate，这样 broken build 不会直接流向公开用户。

**Acceptance Criteria:**
- [ ] `release:verify` 或等价发布验证流程包含 browser smoke
- [ ] smoke 至少覆盖 Landing/Home、Sessions、Agents、session switching、history/hooks/runtime/delegations 面板
- [ ] smoke 失败时保存截图或结果 JSON 等可定位 artifact
- [ ] smoke 能在 mock 环境运行，不依赖真实 WeChat pairing
- [ ] Tests pass
- [ ] Typecheck passes

### US-008: 建立稳定的公开文档入口
**Description:** 作为开源用户或开发者，我希望有结构清晰的文档入口，这样我能快速判断 ReAgent 是否适合我以及该怎么扩展它。

**Acceptance Criteria:**
- [ ] 文档明确区分用户入口、开发者入口、运维入口
- [ ] README 不再承担全部说明职责，至少有 docs 目录导航
- [ ] 文档覆盖安装、运行、升级、恢复、agent runtime、research、memory、OpenClaw bridge
- [ ] 文档明确说明 ReAgent 与 Hermes-Agent 的关系和产品定位差异
- [ ] Typecheck passes

### US-009: 提供开发者扩展样例与 contract 文档
**Description:** 作为第三方开发者，我希望有最小可运行的 skill / MCP / plugin 示例和合约说明，这样我可以扩展 ReAgent 而不是猜实现。

**Acceptance Criteria:**
- [ ] 至少提供一个 workspace skill 示例
- [ ] 至少提供一个 MCP server 配置示例
- [ ] 至少提供一个 plugin 或 bridge-facing contract 示例
- [ ] 每个扩展示例都有入口说明、配置要求和验证步骤
- [ ] 文档说明稳定字段、兼容边界与不保证稳定的部分
- [ ] Typecheck passes

### US-010: 建立产品级的示例与演示路径
**Description:** 作为初次评估 ReAgent 的用户，我希望通过少量高质量示例快速理解它的产品价值，这样我能判断是否值得采用。

**Acceptance Criteria:**
- [ ] 至少提供一条个人研究者主路径示例
- [ ] 至少提供一条 OpenClaw / channel runtime inspection 示例
- [ ] 至少提供一条从 brief 到 report 再到 artifact reopen 的演示路径
- [ ] 示例命令与当前 CLI 输出保持一致
- [ ] Typecheck passes

### US-011: 建立公开开源项目的发布与兼容性规则
**Description:** 作为项目维护者，我希望有清晰的发布与兼容性规则，这样外部用户知道什么是稳定接口，什么是实验接口。

**Acceptance Criteria:**
- [ ] 明确标注稳定入口、兼容 alias、实验能力
- [ ] CHANGELOG 覆盖用户可见变更
- [ ] 发布流程说明中包括版本升级、回归验证和兼容性提示
- [ ] README 或 docs 中说明 breaking change 的处理原则
- [ ] Typecheck passes

### US-012: 明确产品定位而不是模糊对标 Hermes-Agent
**Description:** 作为潜在用户或贡献者，我希望明确知道 ReAgent 是 research-first workspace，而不是 Hermes-Agent 的直接替代品，这样我对项目边界有准确预期。

**Acceptance Criteria:**
- [ ] README 或 docs 中明确说明 ReAgent 的研究工作台定位
- [ ] README 或 docs 中明确说明与 Hermes-Agent 的相似点和不同点
- [ ] 文档说明哪些能力是 Hermes-style runtime seams，哪些能力是 ReAgent 独有的 research artifact model
- [ ] 文档避免把项目叙事写成“泛化 agent runtime 已完成”
- [ ] Typecheck passes

## 4. Functional Requirements

- FR-1: 系统必须提供一条官方推荐的公开安装路径，并可从 README 直接进入。
- FR-2: 系统必须把首跑路径收束为 `onboard -> home -> service run -> web console`。
- FR-3: 系统必须支持 workspace backup snapshot。
- FR-4: backup snapshot 必须覆盖 file-backed workspace state 和数据库层。
- FR-5: 系统必须支持 restore preview。
- FR-6: 系统必须支持 restore apply。
- FR-7: restore apply 必须具备显式确认或等价安全机制。
- FR-8: 系统必须支持导出不泄露明文 secrets 的 support bundle。
- FR-9: 关键产品页面必须对阻塞错误提供 recovery hints。
- FR-10: 发布验证必须包含 browser smoke gate。
- FR-11: browser smoke 必须能在 mock 环境下运行。
- FR-12: 系统必须提供用户文档、开发者文档和运维文档的清晰入口。
- FR-13: 文档必须覆盖安装、运行、升级、恢复、research、memory、agent runtime、OpenClaw bridge。
- FR-14: 系统必须为 workspace skill、MCP、plugin/bridge 扩展提供最小示例和 contract 文档。
- FR-15: 示例和文档中的命令必须与当前 CLI 行为一致。
- FR-16: 发布流程必须说明兼容 alias 与 canonical surface 的关系。
- FR-17: 文档必须明确 ReAgent 的 research-first 定位以及与 Hermes-Agent 的差异。
- FR-18: 发布面必须包含可消费的 changelog。
- FR-19: 用户可见的失败路径必须返回清晰的下一步，而不是只输出内部错误。
- FR-20: 所有新增 CLI 表面必须支持 `--json`，方便脚本和上层 UI 复用。

## 5. Non-Goals (Out of Scope)

- 不把 ReAgent 改造成与 Hermes-Agent 完全同构的通用 agent runtime。
- 不在本期引入多租户 SaaS、团队协作、云托管控制台。
- 不在本期开放 unrestricted recursive swarm。
- 不在本期做移动端 App。
- 不在本期做 autonomous experiment execution。
- 不要求本期就提供所有平台的原生安装器或桌面打包。

## 6. Design Considerations

- 继续坚持 “CLI 是主控制面，Web 是 inspection + guided action 面”。
- 文档和首页表达应更像产品说明，而不是实现细节堆叠。
- 恢复、备份、支持包等能力应默认安全，不要求用户预先理解底层文件布局。
- 扩展文档应优先解释“怎么接入、怎么验证、什么稳定、什么不稳定”。
- Hermes-Agent 相关表述应避免营销式模糊对标，应该明确说明 “借鉴 runtime seams，但不复制产品定位”。

## 7. Technical Considerations

- 现有 workspace 已经保留大量 file-backed 状态：`workspace/channels/`、`workspace/memory/`、`workspace/research/`、skills 目录与 SQLite 数据库。这为 backup / restore 提供了明确边界。
- 现有 `release:verify` 还不包含浏览器 smoke，需要补齐真实页面回归。
- 现有 `reagent doctor`、`reagent home`、`reagent runtime status`、Web runtime panels 已经有基础诊断能力，应优先复用而不是重造。
- 现有 plugin / skill / MCP 能力已经存在，但 contract 仍散落在代码和 README 中，需要提升为稳定文档入口。
- 现有 `reagent agent ...` 与 `/api/agent/*` 已具备统一 runtime 表面，这部分更适合做文档、示例、发布护栏，而不是继续盲目扩展表面数量。
- backup / restore / support bundle 建议优先走本地文件命令，不引入远程存储依赖。
- browser smoke 建议优先跑 mock provider 场景，保证 CI 与开发环境都可重复执行。

## 8. Success Metrics

- 新用户从 README 到打开可用 Web console 的中位时间小于 15 分钟。
- 发布前 smoke gate 能阻断核心页面损坏的构建。
- 用户在升级前可通过一条命令完成 snapshot 备份。
- 用户在遇到常见阻塞问题时，能通过 recovery hint 或 support bundle 自助定位。
- 至少一名外部开发者可以基于公开示例接入一个 skill 或 MCP server，而不需要阅读内部实现。
- README 与 docs 足以让外部用户理解：ReAgent 是 research-first workspace，而不是 Hermes-Agent 替代品。

## 9. Open Questions

- v1 是否仍以 npm 全局安装作为唯一公开分发路径，还是需要额外提供更低门槛安装方式？
- backup snapshot 的格式应该是目录快照、zip 包，还是同时支持两者？
- restore apply 是否需要强制创建当前 workspace 的临时保护副本？
- support bundle 中哪些日志默认应包含，哪些需要显式 `--include-sensitive` 才能导出？
- OpenClaw 是否继续主要作为 WeChat bridge 模式存在，还是未来要提升成更独立的 channel / host 表面？
- 开发者扩展示例应优先押注 skills / MCP，还是同时给出 plugin 级示例？
