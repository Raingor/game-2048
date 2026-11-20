# 2048 · 陶土之间

一个独立的中文 2048 小游戏。暖陶土积木、无计时压力，原生 TypeScript + DOM + CSS，无框架、无运行时依赖、无外部图片或字体请求。

## 仓库与在线试玩

- GitHub：https://github.com/Raingor/game-2048
- GitHub Pages：https://raingor.github.io/game-2048/ （发布配置已加入，首次部署与线上验收进行中）
- 每次推送 main 自动执行单元测试与生产构建，仅发布 `dist/` 静态文件。

## 启动与验证

需要 Node.js 22.12+（建议 Node 24）及 npm。本机实际验证环境：Node v24.18.0 / npm 11.16.0。

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
npm run test:browser
```

- 开发服务默认 `http://localhost:5174/`。
- 生产预览默认也用 5174，`dev` 与 `preview` 不可同时占用该端口。两者均 `strictPort: true`，冲突时报错而不静默漂移；不要终止他人的服务。
- 需要并行预览可显式运行 `npm run preview -- --port 5184`，随后 `GAME_URL=http://localhost:5184 npm run test:browser`。
- `build` 先执行严格 TypeScript 检查，再由 Vite 生成 `dist/`；`base: './'` 使构建资源支持静态子目录，无须写死仓库名。
- 浏览器脚本使用 Playwright 的独立 Chrome 上下文，需要本机安装 Google Chrome；不访问用户已登录浏览器。脚本使用 `GAME_URL`，默认指向 5174。

## 玩法

- 点击棋盘获得焦点后按方向键，或在棋盘上真实触摸滑动，也可以使用方向按钮。
- 全部数字向同一方向移动；相同数字相遇合并。每块每回合只合并一次，例如 `[2,2,2,2] → [4,4,0,0]`。
- 合并后的数字计入分数。有效移动后生成一个数字（90% 为 2，10% 为 4）；无效移动不生成新块、不消耗撤销。
- 达成 2048 后可以继续挑战；棋盘没有空位且不能合并时结算。
- 撤销最近一次有效移动，恢复棋盘、分数与达成状态；撤销只能用一次，不降低最高分。
- 重开前确认，最高分保留。玩法弹窗支持 Escape 关闭、Tab 焦点循环与返回原焦点。
- 只有游戏区域取得交互焦点时才接管方向键；规则弹窗和页面其他区域不接管。

## 保存与降级

存储 key：`puzzle-2048-v1`。仅保存版本、最高分、当前棋盘/分数/达成与继续状态、最近一步快照。刷新可继续本局及撤销。

读写捕获异常，校验版本、16 格棋盘、合法 2 的幂、整数分数、布尔状态与撤销快照。损坏或不支持的存档安全回到新局；浏览器拒绝存储或配额不足时照常可玩，并显示本局不能保存的提示。存档只属于当前浏览器/来源，不提供云同步、多标签页协调或清除数据后的恢复。

产品不暴露游戏实例或作弊全局变量。浏览器验收通过测试侧 localStorage 固定夹具构造接近胜负的局面，再真实操作最后一步；不导入开发服务器的 `/src` 模块，生产预览同样适用。

## 文件结构

- `src/engine.ts`：纯规则、可注入随机数、移动/合并/计分/撤销/结算，不依赖 DOM、存储或动画。
- `src/storage.ts`：独立版本化存档、字段校验、异常降级。
- `src/main.ts`、`src/style.css`：界面、输入、可访问弹窗、响应式和减少动态效果支持。
- `src/engine.test.ts`、`src/storage.test.ts`：29 个单元测试。
- `scripts/smoke.mjs`：36 项真实浏览器检查，桌面 1440×900、触屏 390×844 / 360×844，CDP 真触摸事件、胜败/撤销/重开/持久化、焦点、存储降级和错误收集。
- `artifacts/`：忽略的截图与 `smoke-results.json`，每次脚本运行更新。

## 实际验收结果

- `npm install`：成功；48 个已审计包，0 vulnerabilities。
- `npm test`：29/29，通过规则 14 项、存储 15 项。
- `npm run build`：严格类型检查及生产构建成功。
- 开发态 `npm run test:browser`：36/36。
- 生产态 `GAME_URL=http://localhost:5174 npm run test:browser`：36/36。
- 同一生产包子路径 `npm run preview -- --base=/game-2048/ --port 5184` + `GAME_URL=http://localhost:5184/game-2048/ npm run test:browser`：36/36。
- 三次浏览器验收均无 pageerror、异常 console error、HTTP 404 或其他 HTTP 错误；390/360 无横向溢出。桌面和手机截图经视觉核验。

截图：`artifacts/desktop-1440.png`、`mobile-390.png`、`mobile-360-reduced-motion.png`、`victory.png`、`game-over.png`。本地验证不等于远程发布；仓库及发布由协调方统一处理。
