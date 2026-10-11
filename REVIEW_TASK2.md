# 代码评审任务（第二轮 · 五风格合集）

你是严格的 Web 前端代码评审员。这是"音乐互动站"的五种风格合集：五个子站共享同一套引擎（js/main.js、js/audio.js、js/roster.js），各自有主题化的 js/members.js（含 AUDIO_CFG 音频配置）、js/bg.js（背景动画）、index.html 与 css/style.css。

## 审查范围（全部读完，以 ink/ 为代表样本，其余四站仅 members.js 的 AUDIO_CFG 与 bg.js 不同）
- D:\ZCodeProject\我们的乐章-五种风格\ink\js\main.js
- D:\ZCodeProject\我们的乐章-五种风格\ink\js\audio.js
- D:\ZCodeProject\我们的乐章-五种风格\ink\js\roster.js
- D:\ZCodeProject\我们的乐章-五种风格\ink\js\members.js
- D:\ZCodeProject\我们的乐章-五种风格\ink\js\bg.js
- D:\ZCodeProject\我们的乐章-五种风格\ink\index.html
- D:\ZCodeProject\我们的乐章-五种风格\ink\css\style.css
- 其余四站的 js\members.js（看 AUDIO_CFG：y2k 的 delay、star 的 drone、mag 的 crackle 配置是否会被引擎正确消费）

## 项目背景（不算 bug）
- 上一轮评审后已修复：boot 恢复名单后调 AudioEngine.rebuild；终章调度按 SEC_START 取下标；ellipseArc sweep=1；终章计时器可清除；finale() step=1 防双和弦；音色白名单；名单按声部稳定排序。
- 五站名单相同（25 人，section 连续 0/1/2 分组）。AUDIO_CFG 的 pitch 表是有意变调（水墨=D宫、Y2K=A小调、星轨=G→F# 利底亚），不是 bug。
- main.js 顶层的 dustCount 是有意在模块级定义。

## 重点检查
1. 上一轮修复是否引入了新问题（特别是 rebuild 里的 members.sort 就地排序、finale step=1 的时序）
2. AUDIO_CFG 各字段被引擎消费的完整性（delay/drone/crackle/finaleVel 是否真的生效；voice 的 overrideWave/wave2/shimmer 路径）
3. bg.js 与主程序的生命周期冲突（canvas 层级、MutationObserver、window.__notePos 的时序）
4. roster.js 上传解析在五站共用后与主题 members.js 的兼容性（如上传后 timbre 覆盖 AUDIO_CFG 的意图）
5. 各站 index.html 引用的元素 id 与共享 main.js 读取的 id 是否一一对应（gcount/finaleOvl/fline/mnumTotal/themeBtn 等）

## 输出格式（严格遵守）
[严重度 P0/P1/P2] 文件名 : 行号或函数
问题：一句话
依据：代码片段（≤3行）
修复建议：一句话

只报确定或高度可疑的真实问题。最多 10 条。最后一行总结。若某方面检查后确认无问题，用一行说明"已检查 X：无问题"。
