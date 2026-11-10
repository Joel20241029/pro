/** Laya 3.4 的 setImageData 每次执行 texStorage2D，重复上传会触发 immutable texture 错误。
 * sharedCanvas 固定尺寸：首次分配存储，此后使用引擎已有的子图上传，不读取任何 CPU 像素。
 * _texture 是本机 BaseTexture 实际持有的 InternalTexture，但发行 d.ts 隐藏了该成员；
 * 访问仅限此适配类，依据 laya.core.js Texture2D.setImageData 及 ITextureContext 声明。
 * 升级引擎时必须重新核对这两处，不能静默退回反复分配路径。
 */
export class SharedCanvasTexture extends Laya.Texture2D {
    private allocated = false;
    setImageData(source: HTMLImageElement | HTMLCanvasElement | ImageBitmap, premultiplyAlpha: boolean, invertY: boolean) {
        if (!this.allocated) { super.setImageData(source, premultiplyAlpha, invertY); this.allocated = true; }
        else {
            const texture = (this as unknown as { _texture: Laya.InternalTexture })._texture;
            Laya.LayaGL.textureContext.setTextureSubImageData(texture, source, 0, 0, premultiplyAlpha, invertY);
        }
    }
}
