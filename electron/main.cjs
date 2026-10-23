const { app, BrowserWindow, ipcMain, safeStorage, shell, dialog, net, Menu } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { writeFile } = require('node:fs/promises');
const { mkdirSync } = require('node:fs');
let win, service;
const dev = !app.isPackaged && process.env.PAPERDAY_DEV === '1';
const rendererUrl = dev ? 'http://127.0.0.1:5173/' : pathToFileURL(path.join(__dirname, '../dist/index.html')).href;
app.setName('PaperDay');
if (!app.isPackaged && process.env.PAPERDAY_DATA_DIR) {
  const testDirectory = path.resolve(process.env.PAPERDAY_DATA_DIR);
  mkdirSync(testDirectory, { recursive: true });
  app.setPath('userData', testDirectory);
}
app.setAppUserModelId('com.paperday.desktop');
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
  app.whenReady().then(async () => {
    const [{ Store }, { ArxivSource, canonicalId }, { PaperService }, { generateSummary }, { interpretFocus }] = await Promise.all([
      import('../core/store.mjs'), import('../core/papers.mjs'), import('../core/service.mjs'), import('../core/ai.mjs'), import('../core/focus.mjs')
    ]);
    const directory = !app.isPackaged && process.env.PAPERDAY_DATA_DIR ? path.resolve(process.env.PAPERDAY_DATA_DIR) : app.getPath('userData');
    const store = await new Store(directory).open();
    const secrets = {
      async encrypt(text) { if (!await safeStorage.isAsyncEncryptionAvailable()) throw new Error('系统安全存储暂不可用，密钥未保存。'); return (await safeStorage.encryptStringAsync(text)).toString('base64'); },
      async decrypt(text) { try { return (await safeStorage.decryptStringAsync(Buffer.from(text, 'base64'))).result; } catch { throw new Error('无法解密 API Key，请在设置中重新填写。'); } }
    };
    // Electron net follows the operating system's proxy settings.
    const fetcher = (url, options) => net.fetch(url, options);
    service = new PaperService(store, new ArxivSource(fetcher), secrets, () => new Date(), (paper, settings, key) => generateSummary(paper, settings, key, fetcher), (prompt, settings, key) => interpretFocus(prompt, settings, key, fetcher));
    const handle = (name, fn) => ipcMain.handle(`paperday:${name}`, async (event, ...args) => {
      if (event.sender !== win?.webContents || event.senderFrame !== win.webContents.mainFrame || event.senderFrame.url.split('?')[0].split('#')[0] !== rendererUrl) throw new Error('请求来源无效。');
      try { return { ok: true, value: await fn(...args) }; } catch (error) { return { ok: false, error: error.message || '操作失败，请重试。' }; }
    });
    handle('state', () => service.snapshot());
    handle('settings', input => service.saveSettings(input));
    handle('recommend', extra => service.recommend(extra === true));
    handle('focus', description => service.setFocus(description));
    handle('summary', id => service.summarize(id));
    handle('update', (id, patch) => service.updatePaper(id, patch));
    handle('open', async (id, kind) => { id = canonicalId(id); if (!store.state.papers[id]) throw new Error('论文不存在。'); await shell.openExternal(`https://arxiv.org/${kind === 'pdf' ? 'pdf' : 'abs'}/${id}`); });
    handle('folder', () => shell.openPath(directory));
    handle('export', async rawId => {
      const id = canonicalId(rawId), p = store.state.papers[id], s = store.state.summaries[id];
      if (!p) throw new Error('论文不存在。');
      const markdown = `# ${s?.titleZh || p.title}\n\n${p.title}\n\n作者：${p.authors.join(', ')}\n\n发布日期：${p.published.slice(0,10)}\n\n[论文原文](${p.url}) · [PDF](${p.pdfUrl})\n\n` + (s ? `## 中文概述\n\n${s.overview}\n\n## 创新点（作者声称）\n\n${s.innovations.map(x => '- '+x).join('\n')}\n\n## 研究方法\n\n${s.approach}\n\n## 局限与待核实\n\n${s.limitations}\n\n> AI 解读仅依据标题与摘要，未核验全文。模型：${s.model}\n\n` : '') + `## 原文摘要\n\n${p.abstract}\n`;
      const result = await dialog.showSaveDialog(win, { title: '导出阅读笔记', defaultPath: `PaperDay-${id.replaceAll('/', '-')}.md`, filters: [{ name: 'Markdown', extensions: ['md'] }] });
      if (!result.canceled && result.filePath) { await writeFile(result.filePath, markdown, 'utf8'); return true; } return false;
    });
    Menu.setApplicationMenu(null);
    win = new BrowserWindow({ width: 1400, height: 940, minWidth: 960, minHeight: 680, backgroundColor: '#191f1e', title: '见微 PaperDay', icon: path.join(__dirname, '../assets/icon.ico'), show: false, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (e, url) => { if (url !== rendererUrl) e.preventDefault(); });
    win.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    win.once('ready-to-show', () => win.show());
    await win.loadURL(rendererUrl);
  }).catch(error => { dialog.showErrorBox('PaperDay 启动失败', error.message); app.quit(); });
  app.on('window-all-closed', () => app.quit());
}
