# 微信原生 ASTC 分包

微信小游戏使用普通原生分包。游戏保持村庄和守夜两个加载阶段。主包保存代码、启动图、音乐音效及排行榜开放域。构建从本地制作清单生成 ASTC 图集，并将动画和配置放入对应分包。表中是 1.0.66 首次导出的历史数据。

| 微信包 | 1.0.66 本地导出原始字节 | 加载时机 |
|---|---:|---|
| 主包 | 2,830,743 | 小游戏启动 |
| 村庄分包 | 5,611,982 | 启动画面显示后 |
| 守夜分包 | 812,642 | 打开战前准备或恢复夜间存档 |
| 合计 | 9,255,367 | 两个分包均已下载 |

包内图集只发布 KTX。帧表保留图页原名，读取时映射到该阶段的 KTX。图集帧表、动画表和布局表从生成到导出统一使用单后缀 `.bin`。加载器直接按该文件名读取 UTF-8 内容，并显式使用 Laya 的 JSON 解码。建筑动画仍由 Laya 用 `.mc` 逻辑路径读取导出的 `.mc.bin`。PNG、JPG 原图继续用于制作和编辑器预览。

加载由 Laya 的微信原生桥完成。微信百分数换算到进度条，加载成功后再解码。两阶段复用原有失败重试和任务去重。不支持 ASTC 的微信设备在启动图上看到明确提示。

## 构建与校验

```sh
DAIDAI_ASTCENC=<astcenc可执行文件> node project/LayaProject/tools/build-wechat-delivery.mjs \
  <版本> <Downloads任务目录> <Laya CLI>
node project/LayaProject/tools/check-wechat-package.mjs tryVersion/wxgame <Downloads报告路径> \
  <Downloads任务目录>/source-inputs.json
```

构建入口从 `res/manifest.json` 和 `res/atlases/frames.json` 取分包及图页清单，将制作侧 `res/bundles` 与 Laya 工程素材逐文件核对。在隔离副本中编码并校验图页，使用出包前的 SHA-256 记录比对实际分包，验证通过后更新正式导出目录。Laya 编辑器预览仍读取工程内的 PNG、JPG 和元数据，微信发布使用上面的构建入口。

验证使用 Laya 3.4.2 及微信开发者工具。原生包统计取实际导出文件，微信平台统计单独记录。
