# 2048 实施进度

## 已完成

1. 读取父级计划与必要参考配置，确定暖陶土印刷主题。
2. 建立独立 Vite/TypeScript/Vitest/Playwright 骨架、相对资源路径和 strictPort。
3. 实装纯规则引擎并通过 14 项规则测试，先向协调方回报可复用骨架。
4. 实装存储校验/降级与15项存储测试，完成中文响应式界面和真实输入。
5. 首轮浏览器检查修复 modal 单按钮 Tab 焦点问题；完善焦点循环。
6. 运行全部29项单测、生产build、开发与生产的真实Chrome验收。
7. 同一个生产包在 `/game-2048/` 子路径的 preview 完成同样验收。
8. 截图、视觉检查、README和任务记录完成，交回协调方。`findings.md` 写入被子 Agent 工具拒绝，未创建；研究结论以交回消息提供，关键说明已纳入 README。

## 实跑命令与结果

- `npm install`：成功，47 added / 48 audited / 0 vulnerabilities。
- `npm test`：2 files，29 passed。
- `npm run build`：`tsc --noEmit && vite build` 成功；生产 CSS 约10.22 kB，JS约11.94 kB（未gzip）。
- `npm run dev` + `npm run test:browser`：36 passed，随后仅停止本任务的dev服务。
- `npm run preview` + `GAME_URL=http://localhost:5174 npm run test:browser`：36 passed。
- `npm run preview -- --base=/game-2048/ --port 5184` + `GAME_URL=http://localhost:5184/game-2048/ npm run test:browser`：36 passed，临时服务随后停止。

浏览器覆盖：桌面1440×900、触屏390×844/360×844、方向键与焦点隔离、按钮、真触摸横/纵滑动、玩法、Tab/Escape、撤销/重开/快速重开、刷新保持棋盘/最高分/撤销/达成继续状态、真实最后一步获胜与终局、存储损坏/非法字段/不可用、减少动态效果。无pageerror/console error/HTTP错误。

## 产物与服务

- `artifacts/desktop-1440.png`
- `artifacts/mobile-390.png`
- `artifacts/mobile-360-reduced-motion.png`
- `artifacts/victory.png`
- `artifacts/game-over.png`
- `artifacts/smoke-results.json`（最后一次为子路径验收，36项）

5174 生产 preview 保持运行，地址 `http://localhost:5174/`。5184 临时子路径预览停止。未修改兄弟项目和根级计划；未创建仓库、提交、推送或部署；协调方新增的 `.github/workflows/deploy.yml` 未改动。

状态：本游戏完整交付，无已知阻塞问题；子 Agent 代码交付后由主 Agent 接管发布。

## GitHub Pages 发布（主 Agent，2026-11-20）
- 仓库：https://github.com/Raingor/game-2048 ，独立公开仓库，main。
- 首次代码提交：`22ea24c`；工作流 https://github.com/Raingor/game-2048/actions/runs/44712082116 成功。
- 站点：https://raingor.github.io/game-2048/ ，实测 HTTP 200。
- `GAME_URL=https://raingor.github.io/game-2048/ npm run test:browser`：36/36，桌面/手机真实操作、胜败、滑动、存储及资源检查全部通过。
- 主 Agent 另独立实跑29项单测、严格构建与本地36项浏览器检查，均通过。未将依赖、构建、截图或凭据提交。

## 数字块真实过渡返修（2026-11-20，本轮本地完成）

用户追加要求数字块过渡，旧版16格直接替换数字加原地scale不足以满足真实移动。本轮仅修改本游戏目录，没有git/提交/推送/部署。

实现：
- `engine.ts` 行解析器同时生成数值、每非零源块from/to/value轨迹和merged目标；`moveWithTrace()` 只计算一次，并返回唯一新块位置。原move接口保留。
- 新增 `motion.ts`：aria-hidden独立动画层，150ms源到目标平移，随后160ms合并弹跳和新块出现；16个逻辑格与可访问状态保留。
- 逻辑/存档同步提交；快速方向输入取消旧动画后立刻作用于已提交状态，所有输入均不依赖动画锁；撤销恢复最后一次逻辑移动。
- generation + WAAPI finished处理取消，旧动画不能回写状态；撤销、弹窗/重开、resize、visibility、pagehide、reduced-motion切换清理幽灵块。普通终局在反馈后弹窗，后台直接结算，不依赖rAF或固定超时。
- reduced-motion下立即显示终态，无移动/弹跳/新块缩放。

实跑：
- `npm test`：37/37（22规则/轨迹+15存储）。新增8项轨迹测试，覆盖四方向、跨空格、[2,2,2,2]不连锁合并、来源唯一及重建结果一致。
- `npm run build`：严格类型检查与生产构建成功，CSS约10.47kB / JS约14.86kB（未gzip）。
- `npm run dev -- --port 5184` + `GAME_URL=http://localhost:5184 npm run test:browser`：50/50。
- `GAME_URL=http://localhost:5174 npm run test:browser`：50/50，原36项保留；新增两rAF真实位置变化、overlay隐藏语义与16格、合并/生块动画帧、快速四方向无丢步、撤销/重开/resize/动态reduced-motion清理、0运动终态、胜利立即入存档及后台无需等待动画结算。无pageerror/console error/HTTP错误。
- 首次动画fullPage截图触发视口变化，正确的resize清理导致产物拍到终帧。已只改测试截图为viewport截图；滑动截图前后断言phase=sliding且块x严格在源目标之间，feedback截图前后断言反馈标记与paused动画仍在。新版完整生产回归已通过。

新增产物：`artifacts/sliding-intermediate.png`、`artifacts/merge-spawn-feedback.png`；`smoke-results.json`为50项结果。协调方并行回归可能更新同名产物，以最后验收为准。

服务：本轮自己的5184开发服务已停止；原5174生产preview保持运行。新版线上复验与发布交由主Agent；不把旧版已上线视为新动画已发布。

子Agent交付状态：代码/脚本/README/progress/task_plan已冻结；没有已知功能阻塞。后续发布由主Agent接管。

## 真实过渡版上线验收（主Agent，2026-11-20）

- 主Agent独立复核37项单测、严格构建及生产预览50项浏览器检查，均通过；查看中间帧截图，确认数字块真实处于两格之间。
- 动画代码提交 `d51422f` 已推送main；Pages工作流 https://github.com/Raingor/game-2048/actions/runs/44727475168 成功。
- `GAME_URL=https://raingor.github.io/game-2048/ npm run test:browser`：50/50，exit 0。
- 线上覆盖150ms真实两帧位移、合并弹跳/新块出现、快速四方向输入、动画中撤销/重开/resize、减少动态效果切换、胜利立即存档和后台结算。无pageerror、console error或HTTP错误。
- 在线地址保持 https://raingor.github.io/game-2048/ 。新版已发布并完成线上验收，上述“仅本地完成/待主Agent发布”为此前子Agent交付时的历史状态。

## 19角色陪伴任务（子Agent，本轮未运行浏览器）

用户要求所有游戏加入原消消乐人物头像。本轮仅维护game-2048目录，保留已上线规则与真实滑动动画，不修改engine/motion模块；没有git/提交/推送/发布/写memory，也未操作其他游戏或根计划。

实现：
- 从用户指定catalog读取19人物，只复制19张 `<id>.webp` 至 `public/characters-2d/`，逐字节校验一致，共682,082 bytes；无full身图、PNG或Three.js。
- 新增 `src/characters.ts` / `characters.css`：本地必要身份字段、头像URL、独立偏好读写、暖陶土陪伴头像/名字及原生details角色网格。主界面替换原合并示意装饰，不覆盖棋盘。
- 全部19人可选；图片alt、按钮aria-label/aria-pressed、非纯颜色勾选、明确焦点圈；选择后与Escape后收起返回summary。
- 角色组件位于游戏键盘域之外，不抢方向键；360px采用四列可滚动网格，最长姓名支持换行。
- 偏好key `puzzle-2048-character-v1`，版本1，仅保存id。try/catch涵盖存储getter/read/write；非法id、损坏JSON或不支持版本退回classic；不能写入时照常选择并提示。
- 新增 `src/characters.test.ts` 15项；`scripts/characters-smoke.mjs`覆盖19图加载/全部19角色真实选择/刷新/错误与禁用存储/键盘/Escape/方向键隔离/360宽度/错误收集，生成独立characters截图和JSON，无产品cheat globals。

实际运行：
- `npm test`：52/52，3个文件（原37+15角色测试）。
- `npm run build`：tsc与Vite成功，CSS约14.01kB/JS约18.26kB（未gzip）。
- `node --check scripts/characters-smoke.mjs`：通过。
- 19张复制素材逐字节比对：通过，682,082 bytes。
- **按主Agent错峰要求，本轮未启动浏览器、未生成新的characters截图、未做新版线上验收。** 旧版50项通过仅属历史，不能冒充头像版通过。

交接验收命令（在本项目目录运行）：
- `GAME_URL=http://localhost:5174/ node scripts/characters-smoke.mjs`
- `GAME_URL=http://localhost:5174/ npm run test:browser`
- 发布后同样通过GAME_URL传入Pages地址复验，由主Agent统一处理。

本轮没有新增/停止服务；原preview服务由协调方控制。代码/脚本/README/progress/task_plan已冻结，待主Agent浏览器与视觉检查。

## 主Agent人物版发布验收（2026-11-20）
- 代码提交 `f1c288e` 已推送main，Pages工作流 https://github.com/Raingor/game-2048/actions/runs/44733682435 成功。
- 主Agent独立单测与生产构建通过；本地与线上均通过 27 项人物检查和 50 项完整玩法回归。
- 线上地址 https://raingor.github.io/game-2048/ ，全部19张头像加载、选择与刷新保存、键盘与360px手机、存储异常降级通过；无页面、控制台或HTTP资源错误。
- 新版已上线，上文子Agent“未启动浏览器/待主Agent发布”仅为历史交接状态；截图和JSON位于忽略的artifacts目录，不提交构建/凭据。

## 2026-11-23 · iconfont 图标重采

- 通过 opencli 访问 iconfont.cn 搜索采集页面 favicon 与界面图标，图标名称、ID、搜索词和落位见 [ICONS.md](./ICONS.md)。
- 新增 `public/favicon.svg`，`index.html` 改用该文件；界面图标统一以 `currentColor` 渲染，favicon 使用本项目主题色圆角底。
- 撤销与重开按钮改用 iconfont 撤销/重置图标，替换原 ↶ / ↻ 字符。
- `npm test`、`npm run build` 通过；浏览器冒烟 50 项通过，截图复核图标尺寸、对比度与语义正常。

