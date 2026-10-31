const base='http://127.0.0.1:23119/api/';
export async function moveZoteroItem(fetcher,paper,current,target,prior){
 if(prior.libraryID!==target.libraryID)throw new Error('旧记录跨文库移动请在 Zotero 中操作；此处支持同一文库内修改分类，不会复制或删除原条目。');
 let serverID;
 async function call(path,options={}){
  let r;try{r=await fetcher(base+path,{...options,headers:{'Content-Type':'application/json','Zotero-API-Version':'3',...(serverID?{'Zotero-Server-ID':serverID}:{}),...options.headers},signal:AbortSignal.timeout(path==='local/authorize'?120000:30000),redirect:'error'});}catch{throw new Error(options.method==='PATCH'?'位置更新请求中断，请先在 Zotero 核对结果。':'无法连接 Zotero 本地 API。');}
  if(r.status===403)throw new Error('Zotero 未允许访问或你拒绝了授权。请在 Zotero 设置→高级中允许本机应用通信，再重试。');
  if(r.status===401)throw new Error('Zotero 授权已失效，请重试并在 Zotero 中确认授权。');
  if(r.status===412)throw new Error('Zotero 数据库或条目已变化，未覆盖修改，请刷新后重试。');
  if(!r.ok)throw new Error(`Zotero 本地 API 返回 HTTP ${r.status}，请确认使用 Zotero 10 或更新版本。`);
  const instance=r.headers.get('Zotero-Server-ID');if(serverID&&instance&&serverID!==instance)throw new Error('Zotero 数据库已变化，请重新打开导入窗口。');
  return r;
 }
 const root=await call('');serverID=root.headers.get('Zotero-Server-ID');if(!serverID)throw new Error('当前 Zotero 不支持带授权的本地写入，请升级到 Zotero 10。');
 const roots=current.targets.filter(t=>t.collectionID===null);
 let prefix='users/0';
 if(roots[0]?.libraryID!==target.libraryID){const groups=await (await call('users/0/groups')).json();const matches=groups.filter(g=>(g.data?.name||g.name)===target.libraryName);if(matches.length!==1||!Number.isInteger(matches[0].id))throw new Error('无法唯一识别群组文库，请在 Zotero 中移动。');prefix=`groups/${matches[0].id}`;}
 const collections=await (await call(prefix+'/collections')).json();if(!Array.isArray(collections))throw new Error('Zotero 分类列表异常。');
 const rows=collections.map(c=>c.data||c),byKey=new Map(rows.map(c=>[c.key,c]));
 function full(c,seen=new Set()){if(seen.has(c.key))throw new Error('Zotero 分类层级异常。');seen.add(c.key);return c.parentCollection?full(byKey.get(c.parentCollection)||{},seen)+' / '+c.name:c.name;}
 function keyFor(t){if(!t||t.collectionID===null)return null;const wanted=t.label.slice(t.libraryName.length+3),matches=rows.filter(c=>full(c)===wanted);if(matches.length!==1||!/^[A-Z0-9]{8}$/.test(matches[0].key))throw new Error('分类已变化或名称路径不唯一，请刷新后再试。');return matches[0].key;}
 const newKey=keyFor(target),oldTarget=current.targets.find(t=>t.libraryID===prior.libraryID&&t.collectionID===prior.collectionID);const oldKey=oldTarget?keyFor(oldTarget):null;
 const found=await (await call(prefix+'/items?'+new URLSearchParams({q:paper.id,qmode:'everything',format:'json'}))).json();
 if(!Array.isArray(found))throw new Error('Zotero 条目查询响应异常。');
 const url=`https://arxiv.org/abs/${paper.id}`;const matches=found.map(x=>x.data||x).filter(d=>!d.deleted&&!d.parentItem&&d.itemType!=='attachment'&&(d.url===url||String(d.extra||'').split(/\r?\n/).some(line=>line.trim()===`arXiv: ${paper.id}`)));
 if(matches.length!==1)throw new Error(matches.length?'Zotero 中有多个相同 arXiv 条目，请先处理重复项。':'未找到原条目，未重新创建论文。请先在 Zotero 核对。');
 const item=matches[0];if(!/^[A-Z0-9]{8}$/.test(item.key)||!Number.isInteger(item.version)||!Array.isArray(item.collections))throw new Error('Zotero 条目版本或分类数据异常。');
 const next=[...new Set([...item.collections.filter(k=>k!==oldKey),...(newKey?[newKey]:[])])];
 if(JSON.stringify([...next].sort())===JSON.stringify([...item.collections].sort()))return;
 const auth=await (await call('local/authorize',{method:'POST',body:JSON.stringify({appName:'PaperDay（修改论文分类）'})})).json();
 if(typeof auth.key!=='string'||!auth.key)throw new Error('Zotero 未授予本地写入权限。');
 const result=await call(`${prefix}/items/${item.key}`,{method:'PATCH',headers:{'Zotero-API-Key':auth.key,'If-Unmodified-Since-Version':String(item.version)},body:JSON.stringify({collections:next})});
 if(result.status!==204)throw new Error('Zotero 未确认位置修改，请在 Zotero 核对。');
}
