# 2048 实施任务

范围：只维护本游戏目录；不修改消消乐、其他游戏或根级计划。无后端、账号、跨项目运行时依赖；头像任务仅复用用户指定的19张消消乐WebP。

- [x] 读取父级计划与必要参考配置，加载 frontend-design。
- [x] 独立 package/lock/tsconfig/Vite/.gitignore，原生 TS+DOM+CSS。
- [x] 安装、基础构建与 14 条规则测试通过后向协调方回报骨架。
- [x] 规则模块：四方向、单回合一次合并、有效移动才生块、分数、单步撤销、2048 后继续、无路可走结算。
- [x] 存储模块：独立 key、版本和字段校验、读写异常降级、刷新续局。
- [x] 陶土主题中文界面：键盘、触摸、按钮、最高分、玩法、重开确认、结果弹窗。
- [x] 焦点限制、弹窗 Tab 循环与 Escape、可访问名称、减少动态效果、窄屏适配。
- [x] 单元测试 29/29、严格检查和生产构建通过。
- [x] 开发态 Chrome 36/36 浏览器验收。
- [x] 生产 preview Chrome 36/36 浏览器验收。
- [x] 同一生产包子路径 preview 36/36，确认资源无绝对路径假设。
- [x] 桌面/手机截图与视觉核验，README/progress 交付。
- [ ] `findings.md`：子 Agent 工具禁止写 findings 报告文件，未创建；研究结论已直接交回协调方，关键说明已纳入 README。

已知限制：存档仅在当前浏览器/来源保存，不承诺云同步或多标签协调；浏览器脚本需已安装 Chrome。无已知阻塞问题。

交回时保留 5174 生产 preview；临时 5184 子路径 preview 停止。协调方接管独立仓库与发布，本 Agent 不运行 git/commit/push/deploy。

## 数字块过渡返修

- [x] 同源引擎轨迹（from/to/value、merged、spawned），不重复实现合并规则。
- [x] aria-hidden独立WAAPI层真实150ms位移、合并弹跳、新块出现；16个逻辑格保留。
- [x] 逻辑同步提交；快输入取消前视觉后执行下一步，无漏步。
- [x] 撤销、重开/弹窗、resize、visibility、pagehide、reduced-motion切换取消旧动画；终局不依赖rAF推进。
- [x] 37/37单元测试、严格构建成功；开发5184与生产5174各50/50浏览器检查（含原36项）。
- [x] 动画证据viewport截图及截图前后真中间帧断言，协调方已核图确认数字跨格移动。
- [x] README/progress记录实际本地结果，文件冻结；5184开发服务已停，5174preview保留。

本轮不负责git或发布，旧版线上已部署不等于新动画已发布；主Agent接管新版提交与线上核验。（以上为动画交接时历史；动画后已由主Agent发布并通过线上50项，见progress。）

## 19角色陪伴任务

- [x] 读取指定catalog，复制且校验19张WebP（682,082 bytes），无其他素材/依赖。
- [x] 独立characters.ts/css，显眼头像+名字、原生details全部19人选择、相对图片URL。
- [x] 独立版本化localStorage选择保存、错误字段/非法id/损坏/存储禁用降级。
- [x] alt/aria-pressed/名称/焦点、Escape收起返回summary、选完收起、不接管游戏方向键。
- [x] 52/52单测、严格build、新头像脚本语法检查通过；现有motion与engine不变。
- [x] README/progress记录真实状态，代码冻结，无git/推送/发布/memory。
- [ ] 主Agent错峰运行 `GAME_URL=http://localhost:5174/ node scripts/characters-smoke.mjs`，核characters截图与360px布局。
- [ ] 主Agent回归原 `GAME_URL=http://localhost:5174/ npm run test:browser` 50项。
- [ ] 主Agent统一提交发布并线上复验；本轮未启动浏览器，不能将旧版验收冒充头像版完成。
