# 小望 Xiaowang

**你离开后，研究还会继续。**

基于 QCA Forward 的个人云端研究伙伴：工作日研究、独立复盘、Drive 报告、长期记忆，以及实时语音交流。

## 能做什么

- 以同一身份恢复研究空间，重复登录复用已有模板、记忆和计划。
- 按计划研究，独立复盘并保存可追溯的来源与成果。
- 从 Drive 直接打开最近报告，读取长期记忆，追问已有成果。
- 使用 Realtime 进行语音交流；支持文字输入、历史记录、断线恢复。
- 绑定微信后，配置盘前研究与收盘汇报投递；微信默认会话无需手填 target。

研究方法只在固定检查通过后进入试用，不承诺模型能力或投资收益提升。历史回放必须明确标注补跑，不能作为当时自动执行的证明。

## 本地运行

需要 Node.js 22.13 或以上，以及具有对应 API 权限的 QCA 账号。

```sh
npm ci
npm run dev
```

打开 http://localhost:5178。首次连接选择服务区域，填写自己的 QCA PAT 和同花顺 MCP 凭据。后续登录可留空同花顺凭据，复用云端配置。

生产方式：

```sh
npm run build
npm start
```

## 部署到 Vercel

1. Fork 本仓库并导入 Vercel。
2. 使用仓库自带的 `vercel.json`，开启 Fluid Compute，Node.js 使用 22 或 24。
3. 部署完成后通过 HTTPS 打开网页，填写自己的 QCA PAT。
4. 在语音入口选择声音，允许麦克风后开始通话。也可先用文字交流检查连接。

Vercel 的 WebSocket 支持目前为 Beta。语音函数最长配置为 300 秒，代理在 240 秒主动轮换，客户端恢复连接；这不代表通话完全无缝，需要以部署环境实测为准。计划、报告、记忆不依赖 Vercel 进程常驻。

官方说明：[Vercel WebSockets](https://vercel.com/docs/functions/websockets)。

## 数据与凭据

- 每位使用者填写自己的 QCA Key；仅保留在当前页面内存，刷新后重新输入。
- QCA Key 经同源 HTTP / WebSocket 代理转发到用户选择的固定 QCA 区域，不写入项目、部署环境变量或浏览器持久存储。
- 同花顺凭据由 QCA Vault 管理，报告与研究记忆由用户自己的 QCA 账号保存。
- 公共部署的运营者控制服务端代理。只在你信任或自己部署的站点输入凭据。
- `.env`、构建目录、日志和本地部署配置不进入 Git。

## 验证

```sh
npm test
npm run test:voice
npm run lint
npm run typecheck
npm run build
```

自动测试不替代真实音频、真实渠道送达与下个工作日自动执行验收。模型、同花顺数据、QCA 功能及 Vercel 用量可能产生各自的服务费用。

## 项目结构

| 目录 | 内容 |
| --- | --- |
| `app/` | 伙伴界面、档案、计划、记忆和通话 |
| `lib/` | QCA 客户端、研究流程、语音状态管理 |
| `server/` | 本地同源转发和 WebSocket 代理 |
| `api/` | Vercel API 与语音入口 |
| `research-skill/` | 研究协议与固定校验脚本 |

## License

Apache-2.0。语音客户端包含改编自 [QoderAI/forward-quickstart](https://github.com/QoderAI/forward-quickstart) 的代码，版权说明见 `NOTICE` 与 `licenses/`。
