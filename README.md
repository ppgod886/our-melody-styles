# 我们的乐章 · 五种风格 — GROUP 06

同一份第六组 25 人真实名单、同一套交互（点谱线听声部 → 点音符读人物卡片 → 全点亮终章齐鸣），五种完全不同的"乐器"。

| 子站 | 风格 | 音乐 |
|---|---|---|
| [ink/](https://ppgod886.github.io/our-melody-styles/ink/) | 水墨国风卷：宣纸、远山、朱砂印 | 古筝拨弦 · D 宫五声 · 58 BPM |
| [dopamine/](https://ppgod886.github.io/our-melody-styles/dopamine/) | 多巴胺奶油：糖果色云团、果冻弹跳 | 马林巴 · C 大调 · 96 BPM |
| [y2k/](https://ppgod886.github.io/our-melody-styles/y2k/) | Y2K 蒸汽波：透视网格、扫描线、霓虹 | 复古合成器 · A 小调 · 102 BPM |
| [mag/](https://ppgod886.github.io/our-melody-styles/mag/) | 黑白杂志刊：巨型衬线字、胶片颗粒、电影黑边 | 爵士钢琴 · 大七和弦 · 63 BPM |
| [star/](https://ppgod886.github.io/our-melody-styles/star/) | 星空星轨：星座连线、星云、流星 | 空灵铃音 · C 利底亚 · 54 BPM |

## 结构

- 五站共享交互引擎（`js/main.js` / `js/audio.js` / `js/roster.js`），主题差异集中在：
  - `js/members.js`：名单（第六组真实 25 人）+ `window.AUDIO_CFG`（音阶/音色/节奏/混响全在这里）
  - `js/bg.js` + `css/style.css` + `index.html`：该站的视觉与背景动画
- 名单上传（CSV/JSON/Excel，3~40 人）与主站一致；换名单后编曲按声部自动重排
- 均支持系统"减弱动态效果"设置

## 更新

改完文件后：

```bash
git add -A && git commit -m "..."
git push https://x-access-token:$(gh auth token)@github.com/ppgod886/our-melody-styles.git main
```

注意：本机 git 配置了 ghproxy 只读镜像，推送需用上面的 token 直连方式。
GitHub Pages 约 1 分钟内自动更新。
