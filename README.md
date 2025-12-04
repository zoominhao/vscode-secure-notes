# VSCode 加密笔记插件

一个功能完整的加密笔记插件，支持富文本编辑、多用户、文件夹管理和完全加密存储。

## ✨ 核心功能

- 🔐 **多用户支持** - 每个用户独立密码和笔记存储
- 📝 **富文本编辑** - 粗体、斜体、下划线、背景颜色高亮
- 📊 **行号显示** - 类似 Notepad++ 的编辑器体验
- 🗂️ **文件夹管理** - 创建、删除文件夹，保留空文件夹
- 🔒 **完全加密** - AES-256 加密标题和内容
- 📤 **导入导出** - 支持明文文件和目录结构
- 💾 **自动保存** - 5秒自动保存
- ⚡ **同名检查** - 防止重复笔记

## 🚀 快速开始

### 克隆项目

```bash
git clone https://github.com/zoominhao/vscode-secure-notes.git
cd vscode-secure-notes
```

### 安装依赖

**必需依赖：**
- Node.js (推荐 v16+)
- npm 或 yarn

```bash
npm install
```

这会安装：
- `crypto-js` - AES 加密库
- `@types/vscode` - VSCode API 类型定义
- `@types/crypto-js` - crypto-js 类型定义

### 编译插件

```bash
npm run compile
```

编译后会在 `out/` 目录生成 JavaScript 文件。

### 开发调试

1. 在 VSCode 中打开此项目
2. 按 `F5` 启动调试
3. 在新窗口中测试插件功能

### 打包安装

**安装打包工具：**
```bash
npm install -g vsce
```

**打包插件：**
```bash
vsce package --allow-missing-repository
```

生成 `vscode-secure-notes-1.0.0.vsix` 文件。

**安装插件：**
- 方式1：VSCode 扩展面板 → `...` → Install from VSIX
- 方式2：命令行 `code --install-extension vscode-secure-notes-1.0.0.vsix`

## 📖 使用说明

### 1. 登录/设置密码

首次使用或每次打开 VSCode：
1. 点击侧边栏 📝 图标
2. 点击 "🔒 点击设置密码以查看笔记"
3. 输入用户名（如：zoomin）
4. 输入密码

**注意：** 密码错误会明确提示，可重试。

### 2. 创建笔记

**方式1：** 点击顶部 `+` 按钮 → 选择/创建文件夹
**方式2：** 右键文件夹 → "在此文件夹创建笔记"

### 3. 文件夹管理

- **创建空文件夹：** 点击 `+` → "新建文件夹" → 立即显示
- **删除文件夹：** 右键文件夹 → 点击垃圾桶图标（会删除所有笔记）
- **空文件夹：** 删除最后一个笔记后文件夹仍然保留

### 4. 富文本编辑

工具栏功能：
- **B** - 粗体
- *I* - 斜体
- <u>U</u> - 下划线
- **🎨** - 背景颜色（单击应用，双击选择新颜色）
- **清除** - 清除所有格式

**使用方法：**
1. 选中文字
2. 点击工具栏按钮
3. 格式自动应用

### 5. 导入导出

**导出（明文文件）：**
- 点击顶部 📤 图标
- 选择导出目录
- 生成文件夹和 .md 文件

**导入：**
- 点击顶部 ☁️ 图标
- 选择包含 .md 文件的目录
- 自动加密并导入（同名覆盖）

### 6. 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Cmd+S` | 保存笔记 |
| `Cmd+Shift+P` → "设置加密密码" | 登录/切换用户 |
| `Cmd+Shift+P` → "注销当前用户" | 注销 |

## 🔧 技术栈

- **语言**: TypeScript
- **框架**: VSCode Extension API
- **加密**: crypto-js (AES-256)
- **存储**: JSON 文件
- **编辑器**: 自定义 Webview

## 📁 项目结构

```
vscode-secure-notes/
├── package.json          # 插件配置和依赖
├── package-lock.json     # 依赖版本锁定
├── tsconfig.json        # TypeScript 配置
├── .gitignore           # Git 忽略文件
├── src/
│   └── extension.ts     # 主代码（1500+ 行）
├── resources/
│   └── notebook.svg     # 侧边栏图标
├── node_modules/        # npm 依赖（不提交）
├── out/                 # 编译输出（不提交）
└── README.md           # 文档
```

**说明：**
- `node_modules/` - 运行 `npm install` 自动生成
- `out/` - 运行 `npm run compile` 自动生成
- 两者都在 `.gitignore` 中，不会提交到 Git

## 🔐 安全说明

- **加密算法：** AES-256
- **加密内容：** 标题和内容都加密
- **存储文件：** `notes_用户名.encrypted`
- **密码存储：** 仅在内存中，重启后需重新输入
- **文件安全：** 即使加密文件被盗，没有密码也无法解密

## 📂 存储位置

**默认路径：**
```
~/Documents/SecureNotes/notes_用户名.encrypted
```

**自定义路径：**
- 命令面板 → "更改存储路径"
- 或在设置中修改 `secureNotes.storagePath`

**多用户文件：**
```
~/Documents/SecureNotes/
├── notes_zoomin.encrypted     # zoomin 用户的笔记
├── notes_alice.encrypted       # alice 用户的笔记
└── notes_bob.encrypted         # bob 用户的笔记
```

## 🐛 已知问题

- 需要手动输入密码（每次重启 VSCode）
- 密码遗失无法恢复（请务必记住密码）
- 大量笔记时加密/解密可能较慢

## 📝 更新日志

### v1.0.0 (2025-12-04)
- ✅ 多用户支持（独立密码和存储）
- ✅ 文件夹管理（创建、删除、保留空文件夹）
- ✅ 富文本编辑（粗体、斜体、下划线、颜色高亮）
- ✅ 行号显示（类似 Notepad++）
- ✅ 导入导出（明文文件结构）
- ✅ 圆形调色板设计
- ✅ 选区保存恢复
- ✅ 同名检查
- ✅ 自动保存

---

**作者**: zoominhao
**仓库**: https://github.com/zoominhao/vscode-secure-notes
**许可**: MIT
