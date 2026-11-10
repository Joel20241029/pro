/** 仅在编辑器构建进程运行。开放域由项目制作源维护，禁止打入 IDE 的示例头像与假榜模板。
 * Laya 3.4 默认保留旧开放域目录；此项目改为每次按制作源重建，避免旧示例文件残留。
 * API 依据 engine/types/editor-env.d.ts 与官方插件开发文档；负优先级在微信内置设置后执行。
 */
@IEditorEnv.regBuildPlugin("wxgame", -100)
export class WechatBuild implements IEditorEnv.IBuildPlugin {
    onSetup(task: IEditorEnv.IBuildTask) {
        task.config.keepFilesDuringCleaning = task.config.keepFilesDuringCleaning.filter(path => path !== "openDataContext");
        task.config.ignoreFilesInBuildTemplate.push("openDataContext/avatar.png", "openDataContext/render/**/*");
    }
}
