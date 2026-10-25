import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Check, Crop, ImagePlus, Palette, Type, X } from 'lucide-react';
import { animateChange } from './transitions.js';
import { MAX_BACKGROUND_BYTES } from '../core/background.mjs';
import { legacyBackgroundBlob, readBackground, writeBackground } from './backgroundStore.js';
import BackgroundCropper from './BackgroundCropper.jsx';

const AppearanceContext = createContext(null);
const storageKey = 'paperday.appearance.v1';
export const themes = [
  { id: 'mint', name: '深灰薄荷', colors: ['#191f1e', '#28332f', '#9bd9bb'] },
  { id: 'violet', name: '暮紫', colors: ['#211e29', '#35303f', '#c4b0e8'] },
  { id: 'ocean', name: '深蓝海盐', colors: ['#18232d', '#283944', '#9bcfdb'] },
  { id: 'apricot', name: '暖棕杏色', colors: ['#f4eee6', '#fffbf5', '#93603e'] },
];
const defaults = { theme:'mint', fontSize:16, background:'', imageOpacity:70, maskType:'theme', maskOpacity:35, blur:0, surfaceOpacity:94 };
const bounded = (n,min,max,fallback) => typeof n === 'number' && Number.isFinite(n) ? Math.max(min, Math.min(max,n)) : fallback;
function load() {
  try {
    const value=JSON.parse(localStorage.getItem(storageKey)); if(!value) return defaults;
    return { theme:themes.some(t=>t.id===value.theme)?value.theme:'mint', fontSize:[16,18,20].includes(value.fontSize)?value.fontSize:16,
      background:typeof value.background==='string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value.background) && value.background.length<2800000?value.background:'',
      imageOpacity:bounded(value.imageOpacity ?? value.strength,0,100,70), maskType:['theme','dark','light','none'].includes(value.maskType)?value.maskType:'theme',
      maskOpacity:bounded(value.maskOpacity,0,90,35), blur:bounded(value.blur,0,20,0), surfaceOpacity:bounded(value.surfaceOpacity,60,100,94) };
  } catch { return defaults; }
}
export function AppearanceProvider({children}) {
  const [appearance,setAppearance]=useState(load), current=useRef(appearance);
  const [record,setRecord]=useState(null), [backgroundUrl,setBackgroundUrl]=useState(''), [ready,setReady]=useState(false), [error,setError]=useState('');
  function update(patch, animate=true) {
    const next={...current.current,...patch};
    try {localStorage.setItem(storageKey,JSON.stringify(next));current.current=next; if(animate)animateChange(()=>setAppearance(next));else setAppearance(next);setError('');return true;}
    catch {setError('外观设置未保存，请检查本机存储空间。');return false;}
  }
  useEffect(()=>{
    let alive=true;
    (async()=>{
      try {
        let saved=await readBackground();
        if(!saved && current.current.background){const blob=legacyBackgroundBlob(current.current.background);saved={original:blob,preview:blob,crop:null};await writeBackground(saved);}
        if(alive && saved?.original instanceof Blob && saved?.preview instanceof Blob){setRecord(saved);if(current.current.background)update({background:''},false);}
      }catch(e){if(alive)setError(e.message);}
      finally{if(alive)setReady(true);}
    })();return()=>{alive=false;};
  },[]);
  useEffect(()=>{
    if(!record){setBackgroundUrl('');return;}
    const url=URL.createObjectURL(record.preview);setBackgroundUrl(url);return()=>URL.revokeObjectURL(url);
  },[record]);
  const hasBackground=!!(record || appearance.background);
  useEffect(()=>{
    document.documentElement.dataset.theme=appearance.theme;document.documentElement.style.fontSize=`${appearance.fontSize}px`;
    document.documentElement.dataset.wallpaper=hasBackground?'true':'false';document.documentElement.style.setProperty('--surface-mix',`${appearance.surfaceOpacity}%`);
  },[appearance,hasBackground]);
  async function saveBackground(next){await writeBackground(next);setRecord(next);update({background:''},false);}
  async function removeBackground(){await writeBackground(null);if(!update({background:''},false))throw new Error('背景设置无法移除，请重试。');setRecord(null);}
  const source=backgroundUrl || appearance.background;
  const maskColor=appearance.maskType==='dark'?'#000':appearance.maskType==='light'?'#fff':'var(--bg)';
  return <AppearanceContext.Provider value={{appearance,update,record,ready,error,setError,hasBackground,saveBackground,removeBackground}}>
    <div className="app-background" aria-hidden="true" style={{backgroundImage:source?`url("${source}")`:'none',opacity:appearance.imageOpacity/100,filter:`blur(${appearance.blur}px)`,transform:appearance.blur?`scale(${1+appearance.blur/300})`:undefined}}/>
    <div className="app-background app-background-mask" aria-hidden="true" style={{backgroundColor:maskColor,opacity:source && appearance.maskType!=='none'?appearance.maskOpacity/100:0}}/>{children}
  </AppearanceContext.Provider>;
}
export function AppearancePanel(){
  const {appearance,update,record,ready,error,setError,hasBackground,saveBackground,removeBackground}=useContext(AppearanceContext);
  const input=useRef(null);const [editing,setEditing]=useState(null);const [removing,setRemoving]=useState(false);
  function chooseBackground(event){
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    if(!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size>MAX_BACKGROUND_BYTES){setError('请选择不超过 10 MB 的 PNG、JPG 或 WebP 图片。');return;}
    setError('');setEditing({original:file,crop:null});
  }
  const slider=(key,label,min,max,unit='%')=><label className="background-slider" key={key}><span>{label}<output>{appearance[key]}{unit}</output></span><input type="range" aria-label={label} min={min} max={max} step={1} value={appearance[key]} onChange={e=>update({[key]:Number(e.target.value)},false)}/></label>;
  return <section className="panel appearance-panel"><h2><Palette size={20}/>外观与阅读</h2><p className="appearance-intro">选一种安静的颜色，让阅读更舒服。外观设置即时生效并保存在本机。</p>
    <div className="theme-grid" role="group" aria-label="预设主题">{themes.map(t=><button key={t.id} className={`theme-option ${appearance.theme===t.id?'selected':''}`} aria-pressed={appearance.theme===t.id} onClick={()=>update({theme:t.id})}><span className="theme-preview" style={{background:t.colors[0]}}><i style={{background:t.colors[1]}}/><i style={{background:t.colors[2]}}/></span><span>{t.name}</span>{appearance.theme===t.id&&<Check size={16}/>}</button>)}</div>
    <div className="appearance-row"><div><h3><Type size={18}/>界面字号</h3><p>正文与控件一起缩放，默认已放大。</p></div><div className="size-options" role="group" aria-label="界面字号">{[[16,'舒适'],[18,'大字'],[20,'特大']].map(([size,name])=><button key={size} aria-pressed={appearance.fontSize===size} className={appearance.fontSize===size?'active':''} onClick={()=>update({fontSize:size})}>{name}<small>{size}px</small></button>)}</div></div>
    <div className="appearance-row"><div><h3><ImagePlus size={18}/>自定义背景</h3><p>支持 10 MB 以内图片。按当前窗口比例框选，原图仅保存在本机。</p></div><div className="background-actions"><input ref={input} type="file" accept="image/png,image/jpeg,image/webp" aria-label="选择背景图片" hidden onChange={chooseBackground}/><button className="secondary" disabled={!ready || removing} onClick={()=>input.current.click()}><ImagePlus size={17}/>{hasBackground?'更换图片':'选择图片'}</button>{record&&<button className="secondary" disabled={removing} onClick={()=>setEditing(record)}><Crop size={16}/>重新裁剪</button>}{hasBackground&&<button className="secondary" disabled={removing || !ready} onClick={async()=>{setRemoving(true);try{await removeBackground();}catch(e){setError(e.message);}finally{setRemoving(false);}}}><X size={16}/>移除</button>}</div></div>
    {hasBackground&&<div className="background-tuning">{slider('imageOpacity','图片不透明度',0,100)}<label className="background-mask-type">遮罩颜色<select value={appearance.maskType} onChange={e=>update({maskType:e.target.value},false)}><option value="theme">跟随主题</option><option value="dark">黑色</option><option value="light">白色</option><option value="none">无遮罩</option></select></label>{appearance.maskType!=='none'&&slider('maskOpacity','遮罩强度',0,90)}{slider('blur','背景模糊',0,20,'px')}{slider('surfaceOpacity','卡片不透明度',60,100)}<p className="background-hint">图片与遮罩独立调节；卡片透明度只影响底色，文字和图标保持清晰。窗口比例变化后可重新裁剪。</p></div>}
    {error&&<p className="error-box" role="alert">{error}</p>}
    {editing&&<BackgroundCropper original={editing.original} initialCrop={editing.crop} onSave={saveBackground} onClose={()=>setEditing(null)}/>}
  </section>;
}
