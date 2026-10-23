import { mkdir, readFile, writeFile, rename, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { defaultSettings } from './catalog.mjs';
export const emptyState = () => ({ version: 1, settings: { ...defaultSettings, topics: [...defaultSettings.topics] }, focus: null, encryptedKey: '', papers: {}, history: [], daily: {}, summaries: {}, cache: {} });
export class Store {
  constructor(directory) { this.directory = directory; this.file = join(directory, 'library.json'); this.state = emptyState(); this.queue = Promise.resolve(); }
  async open() {
    await mkdir(this.directory, { recursive: true });
    try {
      const s = JSON.parse(await readFile(this.file, 'utf8'));
      if (s.version !== 1 || !Array.isArray(s.history) || !s.papers || !s.settings || !s.daily || !s.summaries || !s.cache) throw new Error('数据结构不正确');
      this.state = { ...emptyState(), ...s };
    } catch (error) { if (error.code !== 'ENOENT') throw new Error('本地阅读记录无法读取。为保护去重历史，软件未覆盖原文件。请备份数据目录后修复 library.json。'); }
    return this;
  }
  async update(fn) {
    const task = this.queue.then(async () => {
      const next = structuredClone(this.state); const result = await fn(next);
      const temp = `${this.file}.tmp`;
      await writeFile(temp, JSON.stringify(next, null, 2), { encoding: 'utf8', mode: 0o600 });
      try { await copyFile(this.file, `${this.file}.bak`); } catch (e) { if (e.code !== 'ENOENT') throw e; }
      // Windows indexers / antivirus can briefly hold a newly written file.
      // Retry the same atomic replacement without clearing or truncating history.
      for (let attempt = 0; ; attempt++) {
        try { await rename(temp, this.file); break; }
        catch (error) {
          if (!['EPERM', 'EBUSY', 'EACCES'].includes(error.code) || attempt >= 4) throw error;
          await new Promise(resolve => setTimeout(resolve, 20 * 2 ** attempt));
        }
      }
      this.state = next; return result;
    });
    this.queue = task.catch(() => {}); return task;
  }
}
