import React, { useEffect, useRef, useState } from 'react';
import { Check, Crop, LoaderCircle, RotateCcw, X } from 'lucide-react';
import { cropRectangle } from '../core/background.mjs';

export default function BackgroundCropper({ original, initialCrop, onSave, onClose }) {
  const [image, setImage] = useState(null);
  const [url, setUrl] = useState('');
  const [crop, setCrop] = useState({ zoom: initialCrop?.zoom || 1, x: initialCrop?.x ?? 50, y: initialCrop?.y ?? 50 });
  const [aspect, setAspect] = useState(innerWidth / innerHeight);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const stage = useRef(null), drag = useRef(null), dialog = useRef(null);
  useEffect(() => {
    const objectUrl = URL.createObjectURL(original); let alive = true;
    const img = new Image(); img.onload = () => { if (alive) { setImage(img); setUrl(objectUrl); } }; img.onerror = () => { if (alive) setError('图片无法解码，请选择有效的 PNG、JPG 或 WebP 图片。'); }; img.src = objectUrl;
    return () => { alive = false; URL.revokeObjectURL(objectUrl); };
  }, [original]);
  useEffect(() => { const resize = () => setAspect(innerWidth / innerHeight); addEventListener('resize', resize); return () => removeEventListener('resize', resize); }, []);
  useEffect(() => {
    const previous = document.activeElement; dialog.current.showModal();
    return () => { previous?.focus?.(); };
  }, []);
  const rect = image ? cropRectangle(image.naturalWidth, image.naturalHeight, aspect, crop.zoom, crop.x, crop.y) : null;
  function move(event) {
    if (!drag.current || !rect || busy) return;
    const origin = drag.current, size = stage.current.getBoundingClientRect();
    const remainingX = image.naturalWidth - origin.rect.width, remainingY = image.naturalHeight - origin.rect.height;
    setCrop(prev => ({ ...prev, x: remainingX > 0 ? Math.min(100, Math.max(0, (origin.rect.x + (event.clientX - origin.x) / size.width * image.naturalWidth) / remainingX * 100)) : 50, y: remainingY > 0 ? Math.min(100, Math.max(0, (origin.rect.y + (event.clientY - origin.y) / size.height * image.naturalHeight) / remainingY * 100)) : 50 }));
  }
  async function save() {
    if (!rect || busy) return; setBusy(true); setError('');
    try {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 3840 / rect.width, 2160 / rect.height);
      canvas.width = Math.max(1, Math.round(rect.width * scale)); canvas.height = Math.max(1, Math.round(rect.height * scale));
      const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('图片裁剪暂不可用，请重试。');
      ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, canvas.width, canvas.height);
      const preview = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .92));
      if (!preview) throw new Error('无法生成裁剪图片。');
      await onSave({ original, preview, crop: { ...crop, aspect }, at: new Date().toISOString() });
      onClose();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="crop-dialog" aria-labelledby="crop-title" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}>
    <div className="crop-heading"><div><h2 id="crop-title"><Crop size={21}/>框选背景区域</h2><p>完整图片始终可见。拖动选框或调整选区大小，亮起的区域将作为背景，与当前窗口同比例。</p></div><button className="icon-button" disabled={busy} onClick={onClose} aria-label="取消背景裁剪"><X size={20}/></button></div>
    <div className="crop-stage" ref={stage} style={{ aspectRatio: image ? image.naturalWidth / image.naturalHeight : aspect, width: `min(100%, ${48 * (image ? image.naturalWidth / image.naturalHeight : aspect)}vh)` }} aria-label="完整背景图片，拖动选框调整区域"
      onPointerDown={e => { if (!rect || busy || !e.target.closest('.crop-selection')) return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, rect }; }}
      onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      {rect ? <><img src={url} alt="背景裁剪预览" draggable={false} style={{ width: '100%', height: '100%', left:0, top:0 }}/><div className="crop-selection" style={{left:`${rect.x/image.naturalWidth*100}%`,top:`${rect.y/image.naturalHeight*100}%`,width:`${rect.width/image.naturalWidth*100}%`,height:`${rect.height/image.naturalHeight*100}%`}}><div className="crop-grid" aria-hidden="true"/><i/><i/><i/><i/></div></> : <LoaderCircle className="spin"/>}
    </div>
    <div className="crop-controls">{[['zoom','选区缩放',1,4,.05],['x','水平位置',0,100,1],['y','垂直位置',0,100,1]].map(([key,label,min,max,step]) => <label key={key}>{label}<span>{key === 'zoom' ? `${crop[key].toFixed(2)}×` : `${Math.round(crop[key])}%`}</span><input type="range" aria-label={label} min={min} max={max} step={step} value={crop[key]} disabled={busy} onChange={e => setCrop(prev => ({ ...prev, [key]: Number(e.target.value) }))}/></label>)}</div>
    {error && <p className="error-box" role="alert">{error}</p>}
    <div className="crop-footer"><button className="secondary" disabled={busy} onClick={() => setCrop({zoom:1,x:50,y:50})}><RotateCcw size={16}/>居中重置</button><span>原图仅保存在本机，可随时重新裁剪。</span><button className="primary" disabled={!image || busy} onClick={save}>{busy ? <LoaderCircle size={17} className="spin"/> : <Check size={17}/>}应用选区</button></div>
  </dialog>;
}
