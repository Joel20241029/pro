# 工程设置

保存3.4.2工程所需的资源导入、模块与预览启动场景设置。这里的发布位置是该制作工程自己的release目录；正式微信包仍由 project/LayaProject 导出到 tryVersion/wxgame。

`DimensionsSettings.json` 增加 `HD2D 720x1040` 原生预览设备预设，便于查看高清二维小场景；它不是共享工程或正式游戏的分辨率配置。小场景由自身的视口脚本等比显示。
