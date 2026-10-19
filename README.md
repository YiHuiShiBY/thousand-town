# 千人小镇 · Thousand Town

一座住着 1000 位居民的温暖现代社区，在浏览器里实时运转——校门的早晨、通勤的公交、河岸的晚饭。走近一栋楼，看看谁在这里。

在线版：<https://yihuishi.com/demos/thousand-town/>（[仪绘士 · 画境长廊](https://yihuishi.com) 作品之一）

## 运行

纯静态、零构建、零外部依赖，全部资源本地内置（含第三方库），离线可用：

- 直接双击 `index.html` 即可在浏览器中打开；
- 或用任意静态服务器：`python -m http.server` 后访问 <http://localhost:8000>。

## 页面

| 入口 | 内容 |
|---|---|
| `index.html` | 小镇主体验：1000 位居民的起居、上学、通勤与河岸生活，公交与出租车按班次运营 |
| `atlas.html` | 平面图集 |
| `drone-show/gallery.html` | 无人机表演图库 |
| `resident-character-admin.html` | 居民三维档案馆 |

## 技术

- [Three.js r180](https://github.com/mrdoob/three.js/tree/r180)（含 Reflector、GLTFLoader）负责三维渲染；
- [p5.js 1.7.0](https://github.com/processing/p5.js/tree/v1.7.0) 负责草图层；
- 无构建流程、无框架、无运行时外部请求，`vendor/` 与 `assets/` 即全部依赖。

## 第三方致谢

| 组件 | 许可证 |
|---|---|
| Three.js r180 / Reflector / GLTFLoader | MIT |
| p5.js 1.7.0 | LGPL-2.1（`第三方许可/` 内附官方原始分发包，含可读源码） |
| 银河全景图（ESO / S. Brunier） | CC BY 4.0 |

完整署名与许可文本见 [`第三方许可/`](./第三方许可/) 目录。

## 许可

除上述第三方组件（以各自许可证为准）外，本项目的代码与内容保留所有权利。
