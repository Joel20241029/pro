# 微信小游戏分享图

- `village-share-original.png`：高清生成原稿，保留后续修改与重新导出的来源，不进入小游戏包。
- `village-share.jpg`：500 × 400 的微信分享卡片，从卡通重制的村民与村庄主绘画裁切导出。
- `制作说明.txt`：原始出图要求与制作记录。

游戏发布图同步至 `project/LayaProject/build-templates/wxgame/share/village-share.jpg`，Laya 导出后位于微信主包根目录下的 `share/village-share.jpg`。更新图片时必须同时更新这两份 JPG，并检查最终导出文件的哈希与尺寸。不要将分享图纳入人物、建筑或怪物分包，也不要加入游戏图集。

分享标题与路径由 `src/config/ShareConfig.ts` 管理。目前使用微信官方支持的包内图片路径，不配置未经取得的 `imageUrlId`。若以后改用微信后台审核素材，应按官方返回值同时提供有效的图片地址与对应 ID。
