const dbName = 'paperday-backgrounds';
async function transaction(mode, action) {
  const db = await new Promise((resolve, reject) => {
    const open = indexedDB.open(dbName, 1);
    open.onupgradeneeded = () => open.result.createObjectStore('images');
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(new Error('背景存储无法打开。'));
  });
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('images', mode);
      const request = action(tx.objectStore('images'));
      let result;
      request.onsuccess = () => { result = request.result; };
      tx.oncomplete = () => resolve(result);
      tx.onerror = tx.onabort = () => reject(new Error('背景图片未保存，请检查本机存储空间后重试。'));
    });
  } finally { db.close(); }
}
export const readBackground = () => transaction('readonly', store => store.get('active'));
export const writeBackground = record => transaction('readwrite', store => record ? store.put(record, 'active') : store.delete('active'));
export function legacyBackgroundBlob(data) {
  const [header, encoded] = data.split(',');
  const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
  return new Blob([bytes], { type: header.match(/data:([^;]+)/)[1] });
}
