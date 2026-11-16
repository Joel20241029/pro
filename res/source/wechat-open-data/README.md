# 微信开放数据域 Layout 引擎制作源

`engine.source.js` 原样保存 1.0.19 使用的微信 Layout 引擎。`LICENSE` 保留原微信 MIT 许可；源码内还含 Facebook、Zynga、Deutsche Telekom 版权与许可声明，制作时均完整保留。

1.0.20 为主包腾出空间，仅移除普通注释和多余缩进，不改变量、表达式、模块包装、语句、授权和排行逻辑。使用 Acorn 8.19.0 提取原 token，每个 token 的字节保持原样；间隙保留换行存在性，防止自动分号行为改变。输出须通过完整 ESTree 相等验证（仅排除位置和 raw 文本属性）及声明保留检查，失败不覆盖模板。

制作命令：

```sh
node project/LayaProject/tools/compact-open-data-engine.mjs --acorn /Users/happyelements/Downloads/daidai-wechat-implementation-20261110/tools/laya-cli/3.4.2/Resources/node_modules/acorn --report /Users/happyelements/Downloads/daidai-rage-1.0.20-20261114/checks/open-data-compaction.json
```

产物是 `project/LayaProject/build-templates/wxgame/openDataContext/engine.js`，由现有微信导出流程复制。源文件不进入游戏包。母版更新后重新生成，不直接编辑压缩模板。不要使用会删语句、改表达式或改变量名的压缩选项。
