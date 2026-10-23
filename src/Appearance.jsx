import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Check, ImagePlus, Palette, Type, X } from 'lucide-react';
import { animateChange } from './transitions.js';

const AppearanceContext = createContext(null);
const storageKey = 'paperday.appearance.v1';
export const themes = [
  { id: 'mint', name: '深灰薄荷', colors: ['#191f1e', '#28332f', '#9bd9bb'] },
  { id: 'violet', name: '暮紫', colors: ['#211e29', '#35303f', '#c4b0e8'] },
  { id: 'ocean', name: '深蓝海盐', colors: ['#18232d', '#283944', '#9bcfdb'] },
  { id: 'apricot', name: '暖棕杏色', colors: ['#f4eee6', '#fffbf5', '#93603e'] },
];
const defaults = { theme: 'mint', fontSize: 16, background: '', strength: 25 };
function load() {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey));
    if (!value) return defaults;
    return { theme: themes.some(t => t.id === value.theme) ? value.theme : 'mint', fontSize: [16,18,20].includes(value.fontSize) ? value.fontSize : 16, background: typeof value.background === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value.background) && value.background.length < 2800000 ? value.background : '', strength: [10,25,40].includes(value.strength) ? value.strength : 25 };
  } catch { return defaults; }
}
export function AppearanceProvider({ children }) {
  const [appearance, setAppearance] = useState(load);
  const [error, setError] = useState('');
  function update(patch) {
    const next = { ...appearance, ...patch };
    try { localStorage.setItem(storageKey, JSON.stringify(next)); animateChange(() => setAppearance(next)); setError(''); }
    catch { setError('外观设置无法保存，可能是本地存储空间不足。请尝试更小的背景图片。'); }
  }
  useEffect(() => {
    document.documentElement.dataset.theme = appearance.theme;
    document.documentElement.style.fontSize = `${appearance.fontSize}px`;
    document.documentElement.dataset.wallpaper = appearance.background ? 'true' : 'false';
  }, [appearance]);
  return <AppearanceContext.Provider value={{ appearance, update, error, setError }}><div className="app-background" aria-hidden="true" style={{ backgroundImage: appearance.background ? `url("${appearance.background}")` : 'none', opacity: appearance.strength / 100 }}/>{children}</AppearanceContext.Provider>;
}
export function AppearancePanel() {
  const { appearance, update, error, setError } = useContext(AppearanceContext);
  const input = useRef(null);
  async function chooseBackground(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) { setError('请选择不超过 2 MB 的 PNG、JPG 或 WebP 图片。'); return; }
    try {
      const data = await new Promise((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
      const image = new Image(); image.src = data; await image.decode();
      update({ background: data });
    } catch { setError('图片无法读取，请换一张图片。'); }
  }
  return <section className="panel appearance-panel"><h2><Palette size={20}/>外观与阅读</h2><p className="appearance-intro">选一种安静的颜色，让阅读更舒服。外观设置即时生效并保存在本机。</p><div className="theme-grid" role="group" aria-label="预设主题">{themes.map(t => <button key={t.id} className={`theme-option ${appearance.theme === t.id ? 'selected' : ''}`} aria-pressed={appearance.theme === t.id} onClick={() => update({ theme:t.id })}><span className="theme-preview" style={{ background:t.colors[0] }}><i style={{ background:t.colors[1] }}/><i style={{ background:t.colors[2] }}/></span><span>{t.name}</span>{appearance.theme === t.id && <Check size={16}/>}</button>)}</div><div className="appearance-row"><div><h3><Type size={18}/>界面字号</h3><p>正文与控件一起缩放，默认已放大。</p></div><div className="size-options" role="group" aria-label="界面字号">{[[16,'舒适'],[18,'大字'],[20,'特大']].map(([size,name]) => <button key={size} aria-pressed={appearance.fontSize === size} className={appearance.fontSize === size ? 'active' : ''} onClick={() => update({ fontSize:size })}>{name}<small>{size}px</small></button>)}</div></div><div className="appearance-row"><div><h3><ImagePlus size={18}/>自定义背景</h3><p>仅在本机使用，居中铺满。支持 2 MB 以内图片。</p></div><div className="background-actions"><input ref={input} type="file" accept="image/png,image/jpeg,image/webp" aria-label="选择背景图片" hidden onChange={chooseBackground}/><button className="secondary" onClick={() => input.current.click()}><ImagePlus size={17}/>{appearance.background ? '更换图片' : '选择图片'}</button>{appearance.background && <button className="secondary" onClick={() => update({background:''})}><X size={16}/>移除</button>}</div></div>{appearance.background && <label className="background-strength">背景显著程度<select value={appearance.strength} onChange={e => update({ strength:Number(e.target.value) })}><option value={10}>轻淡</option><option value={25}>适中</option><option value={40}>清晰</option></select></label>}{error && <p className="error-box" role="alert">{error}</p>}</section>;
}
