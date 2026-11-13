/** UI单元测试只替代GPU接口；原生解码/渲染由ParticleGameCheckScene另验。 */
exports.library = () => ({ create(id) { return { id, node: new Laya.Sprite(), system: { main: { startLifetime: { constant: .4 }, duration: 1 }, shape: { shape: {} } }, start(parent,x,y){parent.addChild(this.node);this.node.pos(x,y);}, clear(){this.node.visible=false;}, clock(){}, destroy(){this.node.destroy?.();} }; } });
exports.installDecoder = () => Object.assign(Laya, {
 Shader3D: {find:()=>true}, ShaderParser: {parse(){}}, Texture2D: {whiteTexture:{}},
 Material: class { setShaderName(){} setTexture(){} destroy(){} },
 ShurikenParticle2DSystem: class {},
 SerializeUtil: {decodeObj(data,obj){
  obj.main={...data.main,startLifetime:{constant:data.main.startLifetime.constantMax}};
  obj.emission={enable:true,...data.emission};obj.shape=data.shape;return obj;
 }}
});
