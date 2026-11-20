# 2048 · 陶土之间

一个独立的中文 2048 小游戏。暖陶土积木、无计时压力，原生 TypeScript + DOM + CSS，无框架、无运行时依赖、无外部图片或字体请求。

## 仓库与在线试玩

- GitHub：https://github.com/Raingor/game-2048
- GitHub Pages：https://raingor.github.io/game-2048/ （19角色陪伴版已上线，线上27项头像检查与50项完整玩法回归通过；52项单测与严格构建通过）
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

## 数字块过渡

- 数字块在真实源格与目标格之间平滑移动约 **150ms**，合并后弹跳、新块出现约 **160ms**；不是直接替换数字后的原地缩放。
- `engine.ts` 的同一个行解析器返回结果及每块 `from → to` 轨迹和合并目标，`moveWithTrace()` 一次计算供状态提交与视觉消费。视觉层不重复实现合并规则。
- `motion.ts` 使用独立 `aria-hidden` WAAPI 动画层，保留16个逻辑格及其可访问标签。分数、局面、存档与胜败状态即时提交，动画只负责显示。
- 快速输入会取消上一段视觉过渡，再从已经提交的局面立即执行下一步；没有等待动画的输入锁或丢步队列。撤销、弹窗、重开、窗口尺寸变化、页面可见性变化都会取消并清理旧动画。
- 普通情况下在位移和反馈完成后显示胜败弹窗；切后台会直接结算显示，不依赖 requestAnimationFrame 或固定超时推进规则。异步清理由 generation 与 `Animation.finished` 控制，取消的旧回调不会恢复旧局。
- 减少动态效果偏好开启或切换时立即清理动画并显示终态；该模式下不创建平移、弹跳或新块缩放动画。

## 19位陪伴角色

主界面提供头像与人物名字，展开原生 `details` 可选择消消乐中的全部19位伙伴。所有角色直接可选，无关卡解锁限制；选完自动收起，焦点返回展开入口。键盘 Enter 展开、Tab 到角色、Enter/空格选择，Escape 收起并返回入口。角色区域在游戏方向键接管范围之外，不会改变棋盘或分数。

人物名单从用户指定的消消乐 `catalog.ts` 复制必要的 id/name/short，**仅复制19张 WebP 头像**至本项目 `public/characters-2d/`（总682,082 bytes），没有full身图、PNG、Three.js或兄弟目录运行时依赖。图片使用 `./characters-2d/<id>.webp` 相对路径，兼容本地和Pages子路径。

选择偏好独立存于 `puzzle-2048-character-v1`，结构为 `{ version: 1, id }`；不混入棋盘存档。读取/写入均捕获异常，损坏JSON、不支持版本或非法id安全退回自嘲熊（Joke Bear）；存储不可用时仍可选择，提示不能保存。

```sh
# 由协调方错峰运行；需独立Chrome，不使用用户登录会话
GAME_URL=http://localhost:5174/ node scripts/characters-smoke.mjs
# 仍须回归原玩法与真实位移动画
GAME_URL=http://localhost:5174/ npm run test:browser
```

新增脚本覆盖19张加载、19角色逐一真实选择、刷新保存、损坏/非法/禁用存储、原生details键盘与Escape、方向键隔离、360px溢出检查，并生成 `artifacts/characters-*.png` 及 `characters-results.json`。子Agent按错峰要求未启动浏览器；随后主Agent独立本地与线上各27项头像+50项玩法检查通过，人物版已发布。

## 保存与降级

存储 key：`puzzle-2048-v1`。仅保存版本、最高分、当前棋盘/分数/达成与继续状态、最近一步快照。刷新可继续本局及撤销。

读写捕获异常，校验版本、16 格棋盘、合法 2 的幂、整数分数、布尔状态与撤销快照。损坏或不支持的存档安全回到新局；浏览器拒绝存储或配额不足时照常可玩，并显示本局不能保存的提示。存档只属于当前浏览器/来源，不提供云同步、多标签页协调或清除数据后的恢复。

产品不暴露游戏实例或作弊全局变量。浏览器验收通过测试侧 localStorage 固定夹具构造接近胜负的局面，再真实操作最后一步；不导入开发服务器的 `/src` 模块，生产预览同样适用。

## 文件结构

- `src/engine.ts`：纯规则、可注入随机数、移动/合并/计分/撤销/结算，不依赖 DOM、存储或动画。
- `src/storage.ts`：独立版本化存档、字段校验、异常降级。
- `src/main.ts`、`src/style.css`：界面、输入、可访问弹窗、响应式和减少动态效果支持。
- `src/motion.ts`：可取消的真实位移、合并弹跳和新块出现，使用 WAAPI 与 generation 清理。
- `src/characters.ts`、`src/characters.css`：本地角色名单、独立偏好存储、原生details选择器与陶土主题样式。
- `src/engine.test.ts`、`src/storage.test.ts`、`src/characters.test.ts`：52 个单元测试，原37项规则/存档与15项角色偏好测试。
- `scripts/characters-smoke.mjs`：独立角色浏览器验收脚本，使用GAME_URL，覆盖19头像/选择/保存/降级/键盘/360px。
- `scripts/smoke.mjs`：50 项真实浏览器检查，保留原36项；桌面 1440×900、触屏 390×844 / 360×844，CDP 真触摸事件、胜败/撤销/重开/持久化、焦点、存储降级和错误收集。新增真实两帧位移、合并/生块反馈、快速输入/撤销/重开/resize清理、减少动态效果0运动、后台结算检查。
- `artifacts/`：忽略的截图与 `smoke-results.json`，每次脚本运行更新。

## 本轮角色功能实际验收

- `npm test`：52/52，3个测试文件通过（原37+角色15）。
- `npm run build`：严格类型检查及生产构建成功。
- `node --check scripts/characters-smoke.mjs`：语法检查成功。
- 19张WebP与源文件逐字节一致，合计682,082 bytes，未复制额外素材。
- **未运行新版浏览器检查或新版线上验收**：按协调方错峰要求交由其执行；没有新增浏览器截图，不能把下列历史结果视为头像版通过。

## 此前真实位移动画版验收（历史）

- `npm install`：成功；48 个已审计包，0 vulnerabilities。
- 本轮 `npm test`：37/37，规则与轨迹22项、存储15项。
- 本轮 `npm run build`：严格类型检查及生产构建成功。
- 本轮开发态 `npm run dev -- --port 5184` + `GAME_URL=http://localhost:5184 npm run test:browser`：50/50。
- 本轮生产态 `GAME_URL=http://localhost:5174 npm run test:browser`：50/50，含新增截图前后真实中间位置断言。
- 原版本同一生产包子路径 `npm run preview -- --base=/game-2048/ --port 5184` + `GAME_URL=http://localhost:5184/game-2048/ npm run test:browser`：36/36。
- 真实位移动画版代码提交 `d51422f`；[Pages部署工作流44727475168](https://github.com/Raingor/game-2048/actions/runs/44727475168)成功。
- 新版线上 `GAME_URL=https://raingor.github.io/game-2048/ npm run test:browser`：50/50，含真实中间位移、合并/新块反馈、快速操作和动画中断回归。
- 本轮开发、生产预览和线上浏览器验收均无 pageerror、异常 console error、HTTP 404 或其他 HTTP 错误；390/360 无横向溢出。

截图：`artifacts/desktop-1440.png`、`mobile-390.png`、`mobile-360-reduced-motion.png`、`victory.png`、`game-over.png`、`sliding-intermediate.png`、`merge-spawn-feedback.png`。两张动画证据使用viewport截图，避免fullPage改变视口触发产品正确的resize清理；截图前后断言动画仍暂停在真实中间位移/反馈状态。仓库及发布由主Agent统一处理；本轮本地与线上验收均已完成。
