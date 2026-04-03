# ReAgent

ReAgent 閺勵垯绔存稉顏勭唨娴?Node.js + TypeScript 閻ㄥ嫬顔栨稉璇茬础 agent 閹貉冨煑閸欒埇鈧倸鐣犻幎濠勭埡缁岃泛浼愭担婊勭ウ閵嗕焦鏋冩禒鎯邦唶韫囧棎鈧礁浜曟穱锟犫偓姘朵壕閵嗕副penClaw 濡椼儲甯撮崪灞肩娑?OpenClaw 妞嬪孩鐗搁惃?runtime 閹貉冨煑閻ｅ矂娼伴弨鎹愮箻娴滃棗鎮撴稉鈧稉顏呮箛閸旓繝鍣烽妴?
鐎瑰啰骞囬崷銊︽纯閹恒儴绻庨垾婊冪敨娑撴艾濮熼懗钘夊閻ㄥ嫯浜ら柌蹇擃問娑撶儵鈧繐绱濋懓灞肩瑝閺勵垰宕熺痪顖滄畱 research demo閿涘奔绡冩潻妯圭瑝閺?OpenClaw 閺堫兛缍嬮惃鍕搼娴犻攱娴涙禒锝冣偓?
## 瑜版挸澧犵€规矮缍?
- 鐎瑰啯婀佺€瑰じ瀵屽?UI 閸?agent runtime閵?- 鐎瑰啯鏁幐?`role`閵嗕梗skills`閵嗕焦婀伴崷?tools閵嗕椒绱扮拠婵囧瘮娑斿懎瀵查妴?- 鐎瑰啯鏁幐?`mock`閵嗕梗native`閵嗕梗openclaw` 娑撳顫掑顔讳繆閹恒儱鍙嗛弬鐟扮础閵?- 鐎瑰啯鏁幐?OpenAI 閸忕厧顔愬Ο鈥崇€烽幒銉ュ弳閿涘苯鑻熼崠鍝勫瀻 `responses` 閸?`chat-completions` 娑撱倗顫掗崡蹇氼唴閵?- 鐎瑰啯鏁幐?provider/model 缁狙冨焼閻ㄥ嫭婀伴崷?LLM registry閵?- 鐎瑰啯鏁幐浣规拱閸?MCP registry 閸滃瞼濮搁幀浣哥潔缁€鎭掆偓?- 鐎瑰啫褰叉禒銉┾偓姘崇箖 PM2 鐢悂鈹楁潻鎰攽閵?
婵″倹鐏夋担鐘侯洣閻ㄥ嫭妲告稉鈧總妤€鐣弫瀵告畱 OpenClaw 鐎瑰じ瀵岄悽鐔糕偓渚婄礉濮ｆ柨顩?marketplace閵嗕苟odes閵嗕礁鐣弫鎾帳缂冾喕鑵戣箛鍐︹偓浣瑰灇閻旂喓娈戞径鏍劥 skill 娴ｆ挾閮撮敍宀冪箷閺勵垰绨茬拠銉ф暏 OpenClaw閵?
婵″倹鐏夋担鐘侯洣閻ㄥ嫭妲告稉鈧稉顏勫讲娴犮儴鍤滃杈ㄥ⒖鐏炴洜娈戦幒褍鍩楅崣鏉跨安閻㈩煉绱濋柌宥囧仯閺€鎯ф躬瀵邦喕淇婇崗銉ュ經閵嗕簚orkspace memory閵嗕购esearch workflow 閸滃苯顔栨稉璇茬础 agent 娴溿倓绨伴敍瀛痚Agent 閻滄澘婀鑼病閸欘垯浜掗幍鎸庡鏉╂瑤閲滅憴鎺曞閵?
## 娑撴槒顩﹂懗钘夊

### 1. 鐎瑰じ瀵屽蹇斿付閸掕泛褰?
Web 閹貉冨煑閸欎即绮拋銈嗗瘯閸?`/`閿涘苯缍嬮崜宥囨櫕闂堛垹瀵橀崥顐ョ箹娴滄稑灏崺鐕傜窗

- `Chat`
- `Channels`
- `Research`
- `Memory`
- `Logs`
- `Agents`
- `Skills`
- `Sessions`
- `Settings`

閸忔湹鑵戦敍?
- `Agents` 閻劍娼甸弻銉ф箙閸滃苯鍨忛幑顫窗鐠囨繆顫楅懝灞傗偓浣瑰Η閼冲鈧礁浼愰崗宄板瀻缂佸嫨鈧礁缍嬮崜?model route 閸滃矂鈧岸浜炬穱鈩冧紖閵?- `Agents` 闁插瞼骞囬崷銊ょ瘍閼崇晫娲块幒銉╁帳缂?`Primary model`閵嗕梗Fallbacks` 閸?`Reasoning`閵?- `Skills` 閻劍娼甸弻銉ф箙 skill registry閵嗕焦鎮崇槐顫偓浣虹摣闁鎷扮拠锔藉剰閵?- `Sessions` 閻劍娼甸弻銉ф箙閹镐椒绠欓崠?runtime 娴兼俺鐦介妴?- `Settings` 閻劍娼甸弻銉ф箙 LLM閵嗕礁浜曟穱掳鈧府CP閵嗕副penClaw bridge 閻ㄥ嫬缍嬮崜宥囧Ц閹降鈧?
### 2. Agent Runtime

瑜版挸澧?runtime 瀹歌尙绮￠弨顖涘瘮閿?
- 鐟欐帟澹婇敍姝歰perator`閵嗕梗assistant`閵嗕梗researcher`
- 閹垛偓閼虫枻绱癭workspace-control`閵嗕梗memory-ops`閵嗕梗research-ops`閵嗕梗mcp-ops`
- 閺堫剙婀村銉ュ徔閿?  - `agent_describe`
  - `memory_search`
  - `memory_remember`
  - `research_run`
  - `research_recent`
- 娴兼俺鐦介幐浣风畽閸栨牭绱癭workspace/channels/agent-runtime.json`
- 娴兼俺鐦界痪褎膩閸ㄥ鐭鹃悽鎲嬬窗`providerId + modelId`

閺咁噣鈧俺浜版径鈺冨箛閸︺劋绗夐崘宥呭涧閺勵垱瀚炬稉鈧▓?prompt閿涘矁鈧本妲哥挧?runtime 閻ㄥ嫬浼愰崗宄版儕閻滎垽绱濋獮鑸靛瘻瑜版挸澧犳导姘崇樈鐟欙絾鐎介懛顏勭箒閻?model route閵?
### 2.1 Workspace Skills

ReAgent 閻滄澘婀弨顖涘瘮娴犲孩婀伴崷?workspace 閸旂姾娴?OpenClaw 妞嬪孩鐗搁惃鍕Η閼宠姤鏋冩禒璁圭窗

- `workspace/skills/*/SKILL.md`

鏉╂瑤绨洪幎鈧懗鎴掔窗閿?
- 閸戣櫣骞囬崷?`Agents` 閸?`Skills` 妞ょ敻娼伴柌?- 閺勫墽銇氶懛顏勭箒閻ㄥ嫮濮搁幀浣碘偓浣规降濠ф劑鈧椒绶风挧鏍嚛閺勫骸鎷伴惄绋垮彠瀹搞儱鍙?- 閸︺劌鎯庨悽銊ユ倵濞夈劌鍙嗛崚?agent runtime prompt

瑜版挸澧?sample workspace 瀹歌尙绮￠崠鍛儓閿?
- `workspace/skills/research-brief/SKILL.md`
- `workspace/skills/travel-concierge/SKILL.md`

娑撯偓娑擃亝娓剁亸?skill 閺傚洣娆㈤崣顖欎簰闂€鑳箹閺嶅嚖绱?
```md
---
name: Research Brief
description: Produce tighter evidence-led summaries.
tools: research_run, research_recent
---
# Research Brief

When the user asks for analysis or comparison:

- prefer evidence-backed claims
- separate facts from inference
```

閸欘垶鈧?frontmatter 鐎涙顔岃ぐ鎾冲閺€顖涘瘮閿?
- `name`
- `description`
- `env`
- `tools`
- `emoji`
- `homepage`
- `enabled`
- `always`

### 3. LLM 閸欏苯宕楃拋顔芥暜閹?
ReAgent 閻滄澘婀弨顖涘瘮娑撱倗顫?OpenAI 閸忕厧顔愰崡蹇氼唴閿?
- `responses`
- `chat-completions`

閻劑鈧柨灏崚鍡窗

- `responses`
  - 闁倸鎮庣€规ɑ鏌?OpenAI 妞嬪孩鐗搁幒銉ュ經
  - 閺€顖涘瘮鏉╂粎鈻?MCP tools
  - 閺囨挳鈧倸鎮庣€瑰本鏆?tool/runtime 閼宠棄濮?- `chat-completions`
  - 闁倸鎮庡鍫濐樋閸欘亝褰佹笟?`/v1/chat/completions` 閻ㄥ嫬鍚嬬€瑰湱缍夐崗?  - 閺€顖涘瘮閺堫剙婀?function tools
  - 娑撳秵鏁幐浣哥秼閸撳秷绻栨總妤勭箼缁?MCP 閺嗘挳婀剁捄顖氱窞

### 3.1 Provider/Model 缁狙嗙熅閻?
ReAgent 閻滄澘婀稉宥呭涧閺€顖涘瘮 `.env` 闁插瞼娈戦垾婊冨弿鐏炩偓娑撯偓娑?provider + 娑撯偓娑?model閳ユ繐绱濇潻妯绘暜閹镐椒绔存稉顏呮拱閸?LLM registry閿?
- `workspace/channels/llm-providers.json`

鏉╂瑥鐪?registry 閻劍娼甸崑姘剧窗

- provider 缁狙囧帳缂?- model 缁狙冨礂鐠侇喛顩惄?- `agent` / `research` 姒涙顓荤捄顖滄暠
- `responses` / `chat-completions` 閸楀繗顔呴崚鍡樼ウ
- agent 娴兼俺鐦界痪?`providerId/modelId` 闁瀚?
娴兼ê鍘涚痪褍銇囬懛瀛樻Ц閿?
1. agent 娴兼俺鐦介弰鎯х础闁瀚ㄩ惃?`providerId/modelId`
2. registry 闁插瞼娈?`defaults.agent` 閹?`defaults.research`
3. 婵″倹鐏夊▽鈩冩箒 registry 鐠侯垳鏁遍敍灞藉晙闁偓閸?`.env` 闁插瞼娈戦弮褔鍘ょ純?
娑旂喎姘ㄩ弰顖濐嚛閿?
- 娴ｇ姴褰叉禒銉唨 `research` 姒涙顓荤挧鐗堢厙娑?`responses` 濡€崇€?- 鐠?`agent` 姒涙顓荤挧鏉垮綗娑撯偓娑?`chat-completions` 濡€崇€?- 閸愬秹鈧俺绻?`/model <providerId> <modelId>` 缂佹瑥宕熸稉?agent 娴兼俺鐦介崚鍥ㄥ床閸掓澘鍩嗛惃鍕熅閻?
### 4. 瀵邦喕淇婇柅姘朵壕

閺€顖涘瘮娑撳顫掑Ο鈥崇础閿?
- `mock`
  - 閺堫剙婀?UI 鐠嬪啳鐦崪灞剧Х閹垱绁﹀Ο鈩冨珯
- `native`
  - ReAgent 閼奉亜绻佺粻锛勬倞娴滃瞼娣惍浣烘瑜版洏鈧胶濮搁幀浣逛划婢跺秴鎷伴梹鑳枂鐠?- `openclaw`
  - 闁俺绻冩径鏍劥 OpenClaw gateway 閸嬫碍藟閹?
`native` 濡€崇础瀹歌尙绮￠崣顖欎簰闂€鎸庢埂娣囨繃瀵旀潻娑氣柤鏉╂劘顢戦敍灞借嫙閸︺劌鎯庨崝銊︽鐏忔繆鐦幁銏狀槻鏉烆喛顕楅悩鑸碘偓渚婄幢娴ｅ棗顩ч弸婊冧簳娣団€茬窗鐠囨繃婀伴煬顐亼閺佸牞绱濇禒宥囧姧闂団偓鐟曚線鍣搁弬鐗堝閻降鈧?
### 5. Research Workflow

閻梻鈹掑銉ょ稊濞翠椒绮涢悞鏈电箽閻ｆ瑱绱濋幒銉ュ經閸栧懏瀚敍?
- `POST /api/research`
- `GET /api/research/:taskId`
- `GET /api/research/recent`

瑜版挸澧犲ù浣衡柤娴犲秶鍔ч弰顖滅波閺嬪嫬瀵?research pipeline閿涘矁鈧奔绗夐弰顖涙珮闁俺浜版径鈺冩畱閸擃垯楠囬悧鈹库偓?
### 6. File-backed Memory

Memory 娴ｈ法鏁?workspace 閸愬懐娈戦弬鍥︽鐎涙ê鍋嶉敍?
- `MEMORY.md`
- `memory/YYYY-MM-DD.md`

閺€顖涘瘮閿?
- 鐠佹澘绻傚Λ鈧槐?- 鐠佹澘绻傞崘娆忓弳
- 閺傚洣娆㈤弻銉ф箙
- 閸?agent runtime 娑擃厺缍旀稉娲暕閸旂姾娴囨稉濠佺瑓閺傚洤鎷伴崣顖濈殶閻劌浼愰崗?
## 娴犳挸绨辩紒鎾寸€?
- `src/`
  - 閸氬海顏張宥呭閵嗕购untime閵嗕浇鐭鹃悽渚库偓涔竢ovider閵嗕攻ridge
- `web/`
  - 閹貉冨煑閸欐澘澧犵粩?- `workspace/`
  - 鏉╂劘顢戦弮?workspace閵嗕沟emory閵嗕工gent session閵嗕俯LM registry閵嗕府CP registry
- `prisma/`
  - SQLite schema 閸滃本鏆熼幑顔肩氨闁板秶鐤?- `package/`
  - 閻欘剛鐝涢惃?`@tencent-weixin/openclaw-weixin` 閸?- `OPERATIONS.md`
  - 鐢悂鈹楁潻鎰攽閸滃矁绻嶇紒纾嬵嚛閺?
## 韫囶偊鈧喎绱戞慨?
> 閸?Windows PowerShell 闁插矉绱濇俊鍌涚亯閹笛嗩攽缁涙牜鏆愰幏锔跨秶娴?`npm` shim閿涘瞼娲块幒銉ф暏 `npm.cmd`閵嗗倷绗呴棃銏仛娓氬绮烘稉鈧崘?`npm.cmd`閵?
### 1. 鐎瑰顥婃笟婵婄

```powershell
Copy-Item .env.example .env
npm.cmd install
npm.cmd run db:push
```

### 2. 閸氼垰濮╁鈧崣鎴犲箚婢?
```powershell
npm.cmd run dev
```

閹垫挸绱戦敍?
- `http://127.0.0.1:3000/`

### 3. 閻㈢喍楠囬弸鍕紦鏉╂劘顢?
```powershell
npm.cmd run build
npm.cmd start
```

## 閻滎垰顣ㄩ崣姗€鍣?
鐎瑰本鏆ｇ粈杞扮伐鐟?`.env.example`閵?
閺堚偓閸忔娊鏁惃鍕帳缂冾噣銆嶉敍?
```env
PORT=3000
HOST=0.0.0.0
PLATFORM_WORKSPACE_DIR=./workspace

LLM_PROVIDER=fallback
OPENAI_API_KEY=
OPENAI_BASE_URL=
OPENAI_WIRE_API=responses
OPENAI_MODEL=gpt-4.1-mini

WECHAT_PROVIDER=native
OPENCLAW_CLI_PATH=D:/nodejs/openclaw.cmd
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789
OPENCLAW_GATEWAY_TOKEN=
OPENCLAW_GATEWAY_PASSWORD=
OPENCLAW_WECHAT_CHANNEL_ID=openclaw-weixin
```

### 鐢瓕顫嗛柊宥囩枂缂佸嫬鎮?
#### 1. 閺堫剙婀?fallback 鐠嬪啳鐦?
```env
LLM_PROVIDER=fallback
WECHAT_PROVIDER=mock
```

#### 2. 鐎规ɑ鏌?OpenAI 閹存牕鍚嬬€?`responses` 閻ㄥ嫮缍夐崗?
```env
LLM_PROVIDER=openai
OPENAI_API_KEY=your_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_WIRE_API=responses
OPENAI_MODEL=gpt-5.4
```

#### 3. 閸欘亝鏁幐?`chat/completions` 閻ㄥ嫬鍚嬬€瑰湱缍夐崗?
```env
LLM_PROVIDER=openai
OPENAI_API_KEY=your_key
OPENAI_BASE_URL=https://example.com/v1
OPENAI_WIRE_API=chat-completions
OPENAI_MODEL=gpt-4o
```

## LLM Registry

婵″倹鐏夋担鐘侯洣閸?provider/model 缁狙冨瀻濞翠緤绱濋惄瀛樺复閺€鐧哥窗

- `workspace/channels/llm-providers.json`

娴犳挸绨辨潻鎰攽閸氬簼绱伴懛顏勫З閻㈢喐鍨氭稉鈧禒鐣屻仛娓氬鏋冩禒璁圭礉娴ｇ姳绡冮崣顖欎簰閹靛濮╅崚娑樼紦閵嗗倷绔存稉顏呮付鐏忓繒绮ㄩ弸鍕箙鐠ч攱娼甸崓蹇氱箹閺嶅嚖绱?
```json
{
  "defaults": {
    "agent": { "providerId": "proxy-a", "modelId": "gpt-4o" },
    "research": { "providerId": "proxy-a", "modelId": "gpt-5.4" }
  },
  "providers": [
    {
      "id": "proxy-a",
      "label": "Proxy A",
      "type": "openai",
      "enabled": true,
      "baseUrl": "https://proxy.example.com/v1",
      "apiKeyEnv": "PROXY_A_OPENAI_KEY",
      "wireApi": "responses",
      "models": [
        { "id": "gpt-5.4", "wireApi": "responses" },
        { "id": "gpt-4o", "wireApi": "chat-completions" }
      ]
    }
  ]
}
```

濞夈劍鍓伴敍?
- provider 缁?`wireApi` 閸欘垯浜掔悮?model 缁狙嗩洬閻?- `apiKeyEnv` 閺勵垳骞嗘晶鍐ㄥ綁闁插繐鎮曢敍灞肩瑝閺勵垱濡?key 閻╁瓨甯撮崘娆掔箻 JSON
- `agent` 閸?`research` 閸欘垯浜掔挧棰佺瑝閸氬本膩閸?- agent 娴兼俺鐦介崣顖欎簰閸愬秶鏁?`/model` 閹存牗甯撮崣锝呬粵鐟曞棛娲?
## 鐢悂鈹楁潻鎰攽

瀵偓閸欐垹骞嗘晶鍐嚞閻?`npm.cmd run dev`閵? 
閻喐顒滈梹鎸庢埂鏉╂劘顢戠拠椋庢暏 PM2 閹存牕鍙炬禒鏍箻缁嬪顓搁悶鍡楁珤閵?
### PM2

```powershell
npm.cmd run build
npx.cmd -y pm2@latest start ecosystem.config.cjs --only reagent
npx.cmd -y pm2@latest status reagent
npx.cmd -y pm2@latest logs reagent
```

瑜版挸澧?PM2 闁板秶鐤嗛崷?`ecosystem.config.cjs`閿涘矂绮拋銈囩拨鐎规熬绱?
- `HOST=127.0.0.1`
- `PORT=3000`

閺囨潙鐣弫瀵告畱鐠囧瓨妲戠憴?`OPERATIONS.md`閵?
## MCP

MCP 闁板秶鐤嗛弬鍥︽閸︻煉绱?
- `workspace/channels/mcp-servers.json`

LLM 鐠侯垳鏁遍柊宥囩枂閺傚洣娆㈤崷顭掔窗

- `workspace/channels/llm-providers.json`

鏉╂劘顢戦弮鍓佸Ц閹礁褰叉禒銉┾偓姘崇箖閿?
- `GET /api/runtime/meta`

瑜版挸澧犻柅鏄忕帆閺勵垽绱?
- 閸欘亣顩?MCP registry 闁插本婀?server閿涘畭Settings -> Infrastructure` 鐏忓彉绱伴弰鍓с仛閻喎鐤勯悩鑸碘偓?- 閸欘亝婀佽ぐ鎾冲 active route 閺?`openai + responses` 閺冭绱漴untime 閹靛秳绱伴惇鐔割劀鐏忔繆鐦幎濠呯箼缁?MCP tools 閺嗘挳婀剁紒娆惸侀崹?- `chat-completions` 鐠侯垰绶為惄顔煎閸欘亙绻氶悾娆愭拱閸?tools閿涘奔绗夐幒銉ㄧ箼缁?MCP

### 妤傛ê鐥?MCP

娴犳挸绨遍柌宀€娈?sample `mcp-servers.json` 瀹歌尙绮￠幑銏″灇妤傛ê鐥?Maps 閻ㄥ嫯绻欑粙?MCP 濡剝婢橀敍?
```json
{
  "serverLabel": "amap-maps",
  "serverUrl": "https://mcp.amap.com/sse?key=${AMAP_MAPS_API_KEY}",
  "enabled": true
}
```

濞夈劍鍓伴敍?
- 娑撳秹娓剁憰浣瑰Ω妤傛ê鐥?key 閺勫孩鏋冮崘娆掔箻 `mcp-servers.json`
- 閸欘亣顩﹂崷銊у箚婢у啫褰夐柌蹇涘櫡鐠佸墽鐤?`AMAP_MAPS_API_KEY`閿涘eAgent 娴兼艾婀潻鎰攽閺冩儼鍤滈崝銊ㄐ掗弸?`${AMAP_MAPS_API_KEY}`
- 娴ｅ棗顩ч弸婊冪秼閸?agent route 鏉╂ɑ妲?`chat-completions`閿涘矂鐝?MCP 娴犲秶鍔ф稉宥勭窗閻喓娈戦弳鎾苟缂佹瑦膩閸?- 鐟曚浇顔€鏉╂粎鈻?MCP 閻㈢喐鏅ラ敍灞界秼閸撳秳绱扮拠婵囧灗姒涙顓?agent route 闂団偓鐟曚礁鍨忛崚?`responses`

## HTTP API 濮掑倽顫?
### 閸嬨儱鎮嶉崪宀冪箥鐞涘本妞?
- `GET /health`
- `GET /api/runtime/meta`
- `GET /api/ui/runtime-log`

### 閼卞﹤銇夐崪?agent

- `GET /api/channels/wechat/chat/messages`
- `POST /api/channels/wechat/chat`
- `GET /api/channels/wechat/agent?senderId=...`
- `GET /api/channels/wechat/agent/sessions`
- `POST /api/channels/wechat/agent/role`
- `POST /api/channels/wechat/agent/skills`
- `POST /api/channels/wechat/agent/model`
- `POST /api/channels/wechat/agent/fallbacks`
- `POST /api/channels/wechat/agent/reasoning`

### 瀵邦喕淇婇柅姘朵壕

- `GET /api/channels/status`
- `GET /api/channels/wechat/messages`
- `POST /api/channels/wechat/login/start`
  - native provider: prepare or refresh QR login and let ReAgent finish detection in the background
- `POST /api/channels/wechat/login/complete`
  - compatibility/manual wait endpoint for flows that still require an explicit wait step
- `POST /api/channels/wechat/logout`
- `POST /api/channels/wechat/inbound`

### Memory

- `GET /api/memory/status`
- `GET /api/memory/files`
- `GET /api/memory/file?path=...`
- `GET /api/memory/search?q=...`
- `POST /api/memory/remember`

### Research

- `POST /api/research`
- `GET /api/research/:taskId`
- `GET /api/research/recent`

## 缁€杞扮伐鐠囬攱鐪?
### 閸嬨儱鎮嶅Λ鈧弻?
```powershell
curl http://127.0.0.1:3000/health
```

### 閺堫剙婀撮懕濠傘亯

```powershell
curl -X POST http://127.0.0.1:3000/api/channels/wechat/chat `
  -H "Content-Type: application/json" `
  -d "{\"senderId\":\"ui-wechat-user\",\"text\":\"Reply with exactly PONG.\"}"
```

### 閺屻儴顕楄ぐ鎾冲 agent 娴兼俺鐦?
```powershell
curl "http://127.0.0.1:3000/api/channels/wechat/agent?senderId=ui-wechat-user"
```

### 閸掑洦宕茶ぐ鎾冲 agent 娴兼俺鐦介惃鍕侀崹瀣熅閻?
```powershell
curl -X POST http://127.0.0.1:3000/api/channels/wechat/agent/model `
  -H "Content-Type: application/json" `
  -d "{\"senderId\":\"ui-wechat-user\",\"providerId\":\"proxy-a\",\"modelId\":\"gpt-4o\"}"
```

### 鐟欙箑褰傞惍鏃傗敀娴犺濮?
```powershell
curl -X POST http://127.0.0.1:3000/api/research `
  -H "Content-Type: application/json" `
  -d "{\"topic\":\"retrieval augmented generation\",\"question\":\"What are the main evaluation dimensions?\",\"maxPapers\":5}"
```

## 閼卞﹤銇夐崨鎴掓姢

- `/research <topic>`
- `/memory <query>`
- `/remember <fact>`
- `/role <assistant|operator|researcher>`
- `/skills`
- `/model [providerId modelId]`
- `/fallbacks [providerId/modelId, ...]`
- `/reasoning [default|none|minimal|low|medium|high|xhigh]`

`/model` 娑撳秴鐢崣鍌涙殶閺冩湹绱版潻鏂挎礀瑜版挸澧犵捄顖滄暠閸滃苯褰查悽?provider/model 閸掓銆冮敍娑樼敨娑撳﹤寮弫鐗堟娴兼艾鍨忛幑銏犵秼閸?agent 娴兼俺鐦介惃鍕侀崹瀣熅閻究鈧? 
`/model default` 娴兼碍绔婚幒澶婄秼閸撳秳绱扮拠婵堟畱閺勬儳绱＄憰鍡欐磰閿涘苯娲栭崚?registry 閹?`.env` 閻ㄥ嫰绮拋銈堢熅閻究鈧?
`/fallbacks` 閻劍娼甸弻銉ф箙閹存牗娲块弬鏉跨秼閸?agent 娴兼俺鐦介惃?fallback model route 閸掓銆冮妴? 
`/reasoning` 閻劍娼甸弻銉ф箙閹存牞顔曠純顔肩秼閸?agent 娴兼俺鐦介惃?reasoning effort閵?
## 瀵偓閸欐垵鎳℃禒?
```powershell
npm.cmd run dev
npm.cmd run build
npm.cmd start
npm.cmd run check
npm.cmd test
npm.cmd run db:push
```

婵″倹鐏夋担鐘辩瘍鐟曚胶娣幎?`package/` 闁插瞼娈?OpenClaw Weixin 閸栧拑绱?
```powershell
npm.cmd --prefix package run typecheck
npm.cmd --prefix package run build
npm.cmd --prefix package run test
```

## 瀹歌尙鐓℃潏鍦櫕

- 瑜版挸澧犳い鍦窗閸?OpenClaw 閸氼垰褰傞敍灞肩稻娑撳秵妲?OpenClaw 閺堫兛缍嬮妴?- 瑜版挸澧犲▽鈩冩箒閸愬懎缂撻柎瀛樻綀鐏炲偊绱濇稉宥呯安鐠囥儳娲块幒銉紭闂囨彃鍩岄崗顒傜秹閵?- `native` 瀵邦喕淇婂Ο鈥崇础闂€鎸庢埂鏉╂劘顢戝▽鈩冩箒闂傤噣顣介敍灞肩稻瀵邦喕淇婇惂璇茬秿閹浇绻冮張鐔锋倵娴犲秶鍔х憰渚€鍣搁弬鐗堝閻降鈧?- 鏉╂粎鈻?MCP 閻╊喖澧犻崣顏勬躬 `responses` 閸楀繗顔呮稉瀣讲閻劊鈧?- 婵″倹鐏夋担鐘插涧闁板秶鐤?`.env`閿涘奔绮涢悞鑸垫Ц閺冄呮畱閳ユ粌鍙忕仦鈧崡鏇熌侀崹瀣р偓婵嚹佸蹇ョ幢provider/model 缁狙冨瀻濞翠浇顩﹂棃?`workspace/channels/llm-providers.json`閵?- `Agents -> Cron` 閻╊喖澧犳潻妯绘Ц鐎瑰じ瀵屽?UI 閸楃姳缍呴敍灞肩瑝閺勵垰鐣弫瀵告畱鐠嬪啫瀹崇化鑽ょ埠閵?- `Tools` 閸?`Skills` 妞ょ敻娼板鑼病閸欘垳鏁ら敍灞肩稻缁?OpenClaw 閻ㄥ嫬鐣弫瀵告晸閹線銆夐棃銏ｇ箷閺堝妯婄捄婵勨偓?
## 鐎瑰鍙忓楦款唴

- 娑撳秷顩﹂幎?`.env` 閹绘劒姘﹂崚棰佺波鎼存挶鈧?- 娑撳秷顩﹂幎?API key閵嗕宫ateway token閵嗕礁浜曟穱鈥冲殶閹诡喖鍟撴潻娑欐瀮濡楋絾鍨?issue閵?- 閻㈢喍楠囬悳顖氼暔瀵ら缚顔呴弨鎯ф躬閸欏秴鎮滄禒锝囨倞閸氬酣娼伴敍灞借嫙閸旂娀澹岄弶鍐︹偓?- 婵″倹鐏夌憰浣规瘹闂囪尙绮伴崶銏ゆЕ娴ｈ法鏁ら敍宀冨殾鐏忔垵鍘涢梽鎰煑閻╂垵鎯夐崷鏉挎絻閵嗕椒鍞悶鍡樻降濠ф劕鎷伴弮銉ョ箶鐠佸潡妫堕妴?
## Windows Always-On Install

If you want ReAgent to behave more like a host app on Windows, install the built-in scheduled task wrapper:

```powershell
Copy-Item .env.example .env
npm.cmd install
npm.cmd run db:push
npm.cmd run build
npm.cmd run service:preflight
npm.cmd run service:install
```

The runner writes logs and state under `workspace/service/` and will restart `dist/server.js` after crashes or reboots.

Use `npm.cmd run service:status` to inspect the scheduled task and current runner state.
