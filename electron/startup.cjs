const path = require('node:path');
function startupController(app, env=process.env, platform=process.platform, executable=process.execPath) {
  const supported=platform==='win32' && app.isPackaged;
  // electron-builder portable launchers extract process.execPath into a temporary folder.
  const target=env.PORTABLE_EXECUTABLE_FILE || executable;
  const options={path:target,args:[]};
  function get(){
    if(!supported)return {supported:false,enabled:false};
    const value=app.getLoginItemSettings(options);
    return {supported:true,enabled:value.openAtLogin && value.executableWillLaunchAtLogin!==false};
  }
  return {get,set(enabled){
    if(typeof enabled!=='boolean')throw new Error('自启动选项无效。');
    if(!supported)throw new Error('开机自启动仅在 Windows 正式便携版中可用。');
    if(!path.isAbsolute(target))throw new Error('程序路径无效，无法设置自启动。');
    app.setLoginItemSettings({...options,openAtLogin:enabled,name:'PaperDay'});
    const result=get();
    if(result.enabled!==enabled)throw new Error('Windows 未应用该选项，请检查系统的启动应用设置。');
    return result;
  }};
}
module.exports={startupController};
