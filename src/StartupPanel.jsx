import React,{useEffect,useState} from 'react';
import {Power,LoaderCircle} from 'lucide-react';
import api from './api.js';
export default function StartupPanel(){
  const [value,setValue]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{let active=true;api.startup().then(v=>{if(active)setValue(v);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
  async function toggle(){setBusy(true);setError('');try{setValue(await api.setStartup(!value.enabled));}catch(e){setError(e.message);}finally{setBusy(false);}}
  return <section className="panel startup-panel"><h2><Power size={19}/>启动与系统</h2><div className="startup-row"><div><h3>开机自启动</h3><p>登录 Windows 后自动打开 PaperDay，默认关闭。</p></div><button className="toggle-switch" role="switch" aria-label="开机自启动" aria-checked={!!value?.enabled} disabled={!value?.supported||busy} onClick={toggle}>{busy?<LoaderCircle size={16} className="spin"/>:<i/>}</button></div>{value&&!value.supported?<p className="note">开发预览中不可设置，请在 Windows 便携版中使用。</p>:<p className="note">即时保存。便携版请放在固定目录；移动或重命名 exe 后，重新关闭并开启此选项。可在 Windows“启动应用”中管理。</p>}{error&&<p className="error-box" role="alert">{error}</p>}</section>;
}
