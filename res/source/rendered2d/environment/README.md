# 环境道具离线渲染源

本目录只保存真实 Blender 制作源。树、路牌、石头、花朵与火焰的 image_gen 原图在 `res/design/hd2d/environment/`，不混称为已有三维模型。

## 内容

- `campfire_base.blend`：八块圆角石、三根木柴与端面，固定相机、环境光和火焰暖光。前排三石带有 `frontOccluder` 标记。
- `fruit_apple.blend`：高细分苹果、果柄、叶片、相机与光照。
- `render-report.json`：原始输出尺寸、哈希和脚本来源。报告中的 `.blend` 在本目录，PNG 在 `res/design/hd2d/environment/`；完整路径映射见该目录的 `manifest.json`。

源模型不进入微信包，未来只接入验收通过的二维贴图。

## 重建

复用项目已有八石三柴的火堆构图与材质工具，离线提高圆角、细分和木纹。使用 Blender 4.5.16 LTS：

```bash
"/Users/happyelements/Downloads/daidai-3d-implementation-20261113/tools/Blender.app/Contents/MacOS/Blender" \
  --background --python-exit-code 1 \
  --python res/tools/hd2d/render-environment-props.py \
  -- /Users/happyelements/Downloads/daidai-hd2d-20261113/environment/offline
```

输出底座、前石、苹果 PNG，两个可编辑工程和报告。前石层只隐藏其他几何对相机的可见性，保留其光照作用；相机和画布不变。检查后复制到上述两个候选目录，再更新清单和 Laya 场景。

当前为可迭代小样，未完成原参考图的整体美术验收；不能把可编辑模型或透明输出本身当作画质已达标。
