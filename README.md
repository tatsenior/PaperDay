# 见微 PaperDay

**每天一篇论文，让好奇心慢慢生长。**

PaperDay 是一款 Windows 桌面论文阅读工具。选择研究方向后，每天首次打开时推荐一篇尚未推荐过的近期论文，搭配中文解读，帮助你发现值得深入阅读的研究。

[下载 Windows 版](https://github.com/Snowyw1nd/PaperDay/releases/latest) · [更新日志](https://github.com/Snowyw1nd/PaperDay/releases) · [反馈问题](https://github.com/Snowyw1nd/PaperDay/issues)

## 功能

- **每日推荐**：按研究方向发现近期 arXiv 论文，避免重复，支持“再来一篇”。
- **自然语言筛选**：描述关注主题、会议要求和排除方向，借助自己的模型 API 筛选候选。
- **中文阅读助手**：提供中文概述、作者声称的创新点、研究方法及局限，支持围绕当前论文连续问答。
- **阅读记录**：收藏、已读标记、标题与作者搜索，以及按时间和阅读状态筛选历史论文。
- **原文与导出**：打开论文 PDF，导出 Markdown 笔记或 RIS 文献文件。
- **Zotero 集成**：选择文库与分类导入论文，可附带中文笔记，并支持修改已导入条目的分类。
- **个性化界面**：多套主题、可调字号和自定义背景。

## 开始使用

1. 在 [Releases](https://github.com/Snowyw1nd/PaperDay/releases/latest) 下载 **PaperDay-v1.2-Windows.exe**。
2. 双击运行，无需安装 Node.js；首次启动便携包需要短暂解压。
3. 按引导选择研究领域和二级方向。
4. 使用中文解读、问答或模型筛选时，填写自己的兼容 Chat Completions 的模型服务信息；也可稍后连接，先浏览论文原文。

适用于 **Windows 10 / 11 x64**。获取新论文和调用模型需要联网，已有阅读记录与已生成解读可离线查看。Zotero 导入需要打开其桌面端；旧记录修改分类需要 Zotero 10 的本地写入授权，目前支持同一文库内更新分类。

## 使用须知

- 论文来源为 arXiv，其中可能包含未经同行评审的预印本；会议条件取决于可核对的论文信息。
- 中文解读与问答基于标题和摘要，未读取或核验 PDF 全文，模型输出需结合原文确认。
- 模型服务与调用费用由用户自行提供和承担，相关问题、描述及论文材料会发送到所配置的服务。
- 阅读数据保存在本机，API Key 由 Windows 加密保存；请勿公开个人数据目录或密钥。Zotero 同步遵循其自身设置。
- Windows 发布包由 GitHub Actions 构建，附带 SHA256 校验文件，目前未进行商业代码签名。

## 从源码运行

需要 Windows x64、Node.js 22.12+ 和 npm。

```powershell
npm ci
node node_modules/electron/install.js
npm run dev
```

构建便携版可运行 `npm run package`，产物位于 `release/`；也可在仓库 **Actions → Build Windows** 中手动构建。

问题和建议请提交 [Issue](https://github.com/Snowyw1nd/PaperDay/issues)，请勿附带 API Key 或完整个人数据。
