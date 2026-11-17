# 音频制作源

这里保存原创合成音频的乐谱与参数。`village_loop.score.json` 为日间曲，`battle_loop.score.json` 为无鼓夜战曲，`ui_click.score.json` 为操作声，`tower_fire.score.json` 为统一发射声，`enemy_defeat.score.json` 为怪物共用的 0.43 秒低哑喉音，分三声逐渐减弱。正式 MP3 和哈希清单位于 `../../audio`，生成器为 `../../tools/build-audio.py`。

曲谱、采样率、编码参数与振荡器实现需一起保留，不能只替换运行MP3。日间曲本轮保持不变；新夜战曲采用拨弦和低音弦乐，无底鼓、军鼓或镲片。
