import * as vscode from 'vscode';
import * as CryptoJS from 'crypto-js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// 文件夹数据结构
interface Folder {
    name: string;
    createdAt: number;
}

// 笔记数据结构（存储时全部加密）
interface EncryptedNote {
    id: string;
    folder: string; // 文件夹名称
    encryptedTitle: string;
    encryptedContent: string;
    createdAt: number;
    updatedAt: number;
}

// 存储文件结构
interface EncryptedStorage {
    folders: Folder[];
    notes: EncryptedNote[];
}

// 解密后的笔记
interface Note {
    id: string;
    folder: string;
    title: string;
    content: string;
    createdAt: number;
    updatedAt: number;
}

// 用户数据结构
interface User {
    username: string;
    passwordHash: string; // 用户登录密码的哈希
}

// 加密工具类
class Encryption {
    private static currentUser: string | null = null;
    private static userPasswords: Map<string, string> = new Map(); // username -> encryption password

    static setCurrentUser(username: string, password: string) {
        this.currentUser = username;
        this.userPasswords.set(username, password);
    }

    static getCurrentUser(): string | null {
        return this.currentUser;
    }

    static hasPassword(): boolean {
        return this.currentUser !== null && this.userPasswords.has(this.currentUser);
    }

    static encrypt(text: string): string {
        if (!this.currentUser || !this.userPasswords.has(this.currentUser)) {
            throw new Error('未设置加密密码');
        }
        const password = this.userPasswords.get(this.currentUser)!;
        return CryptoJS.AES.encrypt(text, password).toString();
    }

    static decrypt(encryptedText: string): string {
        if (!this.currentUser || !this.userPasswords.has(this.currentUser)) {
            throw new Error('未设置加密密码');
        }
        const password = this.userPasswords.get(this.currentUser)!;
        const bytes = CryptoJS.AES.decrypt(encryptedText, password);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        if (!decrypted) {
            throw new Error('解密失败，密码可能错误');
        }
        return decrypted;
    }

    static hashPassword(password: string): string {
        return CryptoJS.SHA256(password).toString();
    }

    static logout() {
        if (this.currentUser) {
            this.userPasswords.delete(this.currentUser);
            this.currentUser = null;
        }
    }
}

// 笔记管理器
class NotesManager {
    private storagePath: string;

    constructor(context: vscode.ExtensionContext) {
        // 优先使用用户配置的路径，否则使用默认路径
        const config = vscode.workspace.getConfiguration('secureNotes');
        const customPath = config.get<string>('storagePath');

        if (customPath && customPath.trim()) {
            this.storagePath = customPath.replace('~', os.homedir());
        } else {
            // 默认存储到用户文档目录
            this.storagePath = path.join(os.homedir(), 'Documents', 'SecureNotes');
        }

        // 确保目录存在
        if (!fs.existsSync(this.storagePath)) {
            fs.mkdirSync(this.storagePath, { recursive: true });
        }
    }

    getStoragePath(): string {
        return this.storagePath;
    }

    private getStorageFile(): string {
        const currentUser = Encryption.getCurrentUser() || 'default';
        // 每个用户独立的笔记文件
        return path.join(this.storagePath, `notes_${currentUser}.encrypted`);
    }

    private loadStorage(): EncryptedStorage {
        try {
            const storageFile = this.getStorageFile();
            if (fs.existsSync(storageFile)) {
                const data = fs.readFileSync(storageFile, 'utf8');
                const parsed = JSON.parse(data);

                // 兼容旧格式（如果是数组，转换为新格式）
                if (Array.isArray(parsed)) {
                    return {
                        folders: [],
                        notes: parsed
                    };
                }
                return parsed;
            }
        } catch (error) {
            console.error('加载笔记失败:', error);
        }
        return { folders: [], notes: [] };
    }

    private saveStorage(storage: EncryptedStorage) {
        try {
            const storageFile = this.getStorageFile();
            fs.writeFileSync(storageFile, JSON.stringify(storage, null, 2), 'utf8');
        } catch (error) {
            vscode.window.showErrorMessage(`保存失败: ${error}`);
        }
    }

    private loadEncryptedNotes(): EncryptedNote[] {
        return this.loadStorage().notes;
    }

    private saveEncryptedNotes(notes: EncryptedNote[]) {
        const storage = this.loadStorage();
        storage.notes = notes;
        this.saveStorage(storage);
    }

    getFolders(): Folder[] {
        return this.loadStorage().folders;
    }

    createFolder(name: string) {
        const storage = this.loadStorage();

        // 检查文件夹是否已存在
        if (storage.folders.some(f => f.name === name)) {
            throw new Error('文件夹已存在');
        }

        storage.folders.push({
            name,
            createdAt: Date.now()
        });

        this.saveStorage(storage);
    }

    deleteFolder(name: string) {
        const storage = this.loadStorage();

        // 删除文件夹
        storage.folders = storage.folders.filter(f => f.name !== name);

        // 同时删除该文件夹下的所有笔记
        storage.notes = storage.notes.filter(n => n.folder !== name);

        this.saveStorage(storage);
    }

    createNote(title: string, content: string, folder: string = 'default'): Note {
        if (!Encryption.hasPassword()) {
            throw new Error('请先设置加密密码');
        }

        // 检查同文件夹下是否已存在同名笔记
        const existingNotes = this.getAllNotes();
        const duplicate = existingNotes.find(n => n.folder === folder && n.title === title);
        if (duplicate) {
            throw new Error(`文件夹"${folder}"下已存在同名笔记"${title}"`);
        }

        const note: Note = {
            id: Date.now().toString(),
            folder,
            title,
            content,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        // 加密并保存
        const encryptedNote: EncryptedNote = {
            id: note.id,
            folder,
            encryptedTitle: Encryption.encrypt(title),
            encryptedContent: Encryption.encrypt(content),
            createdAt: note.createdAt,
            updatedAt: note.updatedAt
        };

        const notes = this.loadEncryptedNotes();
        notes.push(encryptedNote);
        this.saveEncryptedNotes(notes);

        return note;
    }

    updateNote(id: string, title: string, content: string) {
        if (!Encryption.hasPassword()) {
            throw new Error('请先设置加密密码');
        }

        const notes = this.loadEncryptedNotes();
        const note = notes.find(n => n.id === id);

        if (note) {
            note.encryptedTitle = Encryption.encrypt(title);
            note.encryptedContent = Encryption.encrypt(content);
            note.updatedAt = Date.now();
            this.saveEncryptedNotes(notes);
        }
    }

    deleteNote(id: string) {
        const notes = this.loadEncryptedNotes();
        const filtered = notes.filter(n => n.id !== id);
        this.saveEncryptedNotes(filtered);
    }

    getAllNotes(): Note[] {
        if (!Encryption.hasPassword()) {
            return [];
        }

        const encryptedNotes = this.loadEncryptedNotes();
        const decryptedNotes: Note[] = [];

        for (const encrypted of encryptedNotes) {
            try {
                decryptedNotes.push({
                    id: encrypted.id,
                    folder: encrypted.folder || 'default',
                    title: Encryption.decrypt(encrypted.encryptedTitle),
                    content: Encryption.decrypt(encrypted.encryptedContent),
                    createdAt: encrypted.createdAt,
                    updatedAt: encrypted.updatedAt
                });
            } catch (error) {
                console.error('解密笔记失败:', encrypted.id);
            }
        }

        return decryptedNotes;
    }

    getNote(id: string): Note | null {
        if (!Encryption.hasPassword()) {
            return null;
        }

        const encryptedNotes = this.loadEncryptedNotes();
        const encrypted = encryptedNotes.find(n => n.id === id);

        if (!encrypted) {
            return null;
        }

        try {
            return {
                id: encrypted.id,
                folder: encrypted.folder || 'default',
                title: Encryption.decrypt(encrypted.encryptedTitle),
                content: Encryption.decrypt(encrypted.encryptedContent),
                createdAt: encrypted.createdAt,
                updatedAt: encrypted.updatedAt
            };
        } catch (error) {
            throw new Error('解密失败，密码可能错误');
        }
    }
}

// 密码提示项
class PasswordPromptItem extends vscode.TreeItem {
    constructor() {
        super('🔒 点击设置密码以查看笔记', vscode.TreeItemCollapsibleState.None);
        this.tooltip = '需要输入密码才能查看笔记';
        this.contextValue = 'passwordPrompt';
        this.command = {
            command: 'secureNotes.setPassword',
            title: '设置密码'
        };
    }
}

// 文件夹或笔记项
type TreeItem = FolderItem | NoteItem | PasswordPromptItem;

// 笔记树视图
class NotesTreeProvider implements vscode.TreeDataProvider<TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private notesManager: NotesManager) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TreeItem): Thenable<TreeItem[]> {
        // 如果没有密码，显示提示
        if (!Encryption.hasPassword()) {
            if (!element) {
                return Promise.resolve([new PasswordPromptItem()]);
            }
            return Promise.resolve([]);
        }

        const notes = this.notesManager.getAllNotes();
        const folders = this.notesManager.getFolders();

        if (!element) {
            // 根级别：显示所有文件夹（包括空文件夹）
            const noteCountMap = new Map<string, number>();

            // 统计每个文件夹的笔记数量
            notes.forEach(note => {
                noteCountMap.set(note.folder, (noteCountMap.get(note.folder) || 0) + 1);
            });

            // 显示所有文件夹（包括定义的空文件夹）
            const allFolderNames = new Set<string>();

            // 添加明确创建的文件夹
            folders.forEach(f => allFolderNames.add(f.name));

            // 添加有笔记的文件夹（向后兼容）
            notes.forEach(n => allFolderNames.add(n.folder));

            const folderItems: TreeItem[] = [];
            allFolderNames.forEach(folderName => {
                const count = noteCountMap.get(folderName) || 0;
                folderItems.push(new FolderItem(folderName, count));
            });

            return Promise.resolve(folderItems);
        } else if (element instanceof FolderItem) {
            // 文件夹下：显示笔记
            const folderNotes = notes.filter(n => n.folder === element.label);
            return Promise.resolve(
                folderNotes.map(note => new NoteItem(
                    note.id,
                    note.title,
                    vscode.TreeItemCollapsibleState.None
                ))
            );
        }

        return Promise.resolve([]);
    }
}

class FolderItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly noteCount: number
    ) {
        super(label, vscode.TreeItemCollapsibleState.Collapsed);
        this.tooltip = `文件夹: ${label} (${noteCount} 个笔记)`;
        this.description = `${noteCount}`;
        this.contextValue = 'folder';
        this.iconPath = new vscode.ThemeIcon('folder');
    }
}

class NoteItem extends vscode.TreeItem {
    constructor(
        public readonly id: string,
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
        this.tooltip = `🔒 ${label}`;
        this.description = '🔒';
        this.contextValue = 'note';
        this.command = {
            command: 'secureNotes.openNote',
            title: '打开笔记',
            arguments: [this.id]
        };
    }
}

// 富文本编辑器
class NoteEditorPanel {
    public static currentPanel: NoteEditorPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    private constructor(
        panel: vscode.WebviewPanel,
        private noteId: string | null,
        private notesManager: NotesManager,
        private treeProvider: NotesTreeProvider,
        private folder: string = 'default'
    ) {
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.onDidReceiveMessage(
            message => this.handleMessage(message),
            null,
            this._disposables
        );
        this.update();
    }

    public static show(
        noteId: string | null,
        notesManager: NotesManager,
        treeProvider: NotesTreeProvider,
        folder: string = 'default'
    ) {
        const column = vscode.window.activeTextEditor?.viewColumn || vscode.ViewColumn.One;

        if (NoteEditorPanel.currentPanel) {
            NoteEditorPanel.currentPanel._panel.reveal(column);
            NoteEditorPanel.currentPanel.noteId = noteId;
            NoteEditorPanel.currentPanel.folder = folder;
            NoteEditorPanel.currentPanel.update();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'noteEditor',
            '📝 加密笔记编辑器',
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        NoteEditorPanel.currentPanel = new NoteEditorPanel(panel, noteId, notesManager, treeProvider, folder);
    }

    private handleMessage(message: any) {
        switch (message.command) {
            case 'save':
                this.saveNote(message.title, message.content);
                break;
        }
    }

    private saveNote(title: string, content: string) {
        try {
            if (!Encryption.hasPassword()) {
                vscode.window.showErrorMessage('请先设置加密密码');
                return;
            }

            if (this.noteId) {
                // 更新现有笔记时，检查是否改名导致同名冲突
                const currentNote = this.notesManager.getNote(this.noteId);
                if (currentNote && currentNote.title !== title) {
                    // 标题变了，需要检查新标题是否重复
                    const allNotes = this.notesManager.getAllNotes();
                    const duplicate = allNotes.find(n =>
                        n.id !== this.noteId &&
                        n.folder === currentNote.folder &&
                        n.title === title
                    );
                    if (duplicate) {
                        vscode.window.showErrorMessage(`文件夹"${currentNote.folder}"下已存在同名笔记"${title}"`);
                        return;
                    }
                }

                this.notesManager.updateNote(this.noteId, title, content);
                vscode.window.showInformationMessage('✅ 笔记已保存');
            } else {
                // 新建笔记
                const note = this.notesManager.createNote(title, content, this.folder);
                this.noteId = note.id;
                vscode.window.showInformationMessage('✅ 笔记已创建');
            }

            this.treeProvider.refresh();
        } catch (error) {
            vscode.window.showErrorMessage(`保存失败: ${error}`);
        }
    }

    private update() {
        this._panel.webview.html = this.getHtmlContent();
    }

    private getHtmlContent(): string {
        let noteTitle = '';
        let noteContent = '';

        // 只有打开已存在的笔记时才加载内容
        if (this.noteId) {
            const note = this.notesManager.getNote(this.noteId);
            if (note) {
                noteTitle = note.title;
                noteContent = note.content;
            }
        }
        // 新建笔记时保持空白

        const escapedTitle = noteTitle.replace(/"/g, '&quot;');

        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>加密笔记编辑器</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        .editor-container {
            display: flex;
            flex-direction: column;
            height: 100vh;
        }
        .title-bar {
            padding: 8px 12px;
            background: var(--vscode-editorGroupHeader-tabsBackground);
            border-bottom: 1px solid var(--vscode-editorGroup-border);
        }
        input[type="text"] {
            width: 100%;
            padding: 8px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            font-size: 14px;
            font-family: inherit;
        }
        .editor-toolbar {
            background: var(--vscode-editorGroupHeader-tabsBackground);
            border-bottom: 1px solid var(--vscode-editorGroup-border);
            padding: 4px 8px;
            display: flex;
            gap: 4px;
        }
        .toolbar-btn {
            background: transparent;
            color: var(--vscode-foreground);
            border: 1px solid transparent;
            padding: 4px 10px;
            cursor: pointer;
            font-size: 13px;
            font-family: inherit;
        }
        .toolbar-btn:hover {
            background: var(--vscode-toolbar-hoverBackground);
            border-color: var(--vscode-contrastBorder);
        }
        .color-palette-btn {
            width: 32px;
            height: 32px;
            background: #ffff00;
            color: #000;
            border: 2px solid var(--vscode-editorGroup-border);
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            box-shadow: inset 0 0 8px rgba(0,0,0,0.2);
            transition: all 0.2s;
        }
        .color-palette-btn:hover {
            border-color: var(--vscode-focusBorder);
            box-shadow: 0 0 12px var(--vscode-focusBorder), inset 0 0 8px rgba(0,0,0,0.2);
            transform: scale(1.1);
        }
        .editor-content {
            flex: 1;
            display: flex;
            flex-direction: column;
        }
        .editor-wrapper {
            flex: 1;
            display: flex;
            overflow-y: auto;
        }
        #lineNumbers {
            width: 50px;
            padding: 10px 5px;
            background: var(--vscode-editorGutter-background);
            color: var(--vscode-editorLineNumber-foreground);
            text-align: right;
            font-size: 14px;
            line-height: 20px;
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            overflow-y: auto;
            user-select: none;
            border-right: 1px solid var(--vscode-editorGroup-border);
        }
        #lineNumbers::-webkit-scrollbar {
            width: 0;
            height: 0;
        }
        #lineNumbers div {
            height: 20px;
            line-height: 20px;
        }
        #noteContent {
            flex: 1;
            padding: 10px;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            border: none;
            font-size: 14px;
            line-height: 20px;
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            outline: none;
            overflow-y: auto;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        #noteContent:focus {
            outline: none;
        }
        #noteContent:empty:before {
            content: attr(data-placeholder);
            color: var(--vscode-input-placeholderForeground);
            opacity: 0.6;
        }
        .status-bar {
            padding: 4px 12px;
            background: var(--vscode-statusBar-background);
            color: var(--vscode-statusBar-foreground);
            border-top: 1px solid var(--vscode-statusBar-border);
            font-size: 12px;
            display: flex;
            justify-content: space-between;
        }
    </style>
</head>
<body>
    <div class="editor-container">
        <div class="title-bar">
            <input type="text" id="noteTitle" placeholder="未命名笔记" value="${escapedTitle}">
        </div>
        <div class="editor-toolbar">
            <button class="toolbar-btn" onclick="saveNote()">💾 保存</button>
            <span style="border-left: 1px solid var(--vscode-editorGroup-border); margin: 0 4px;"></span>
            <button class="toolbar-btn" onclick="applyBold()" title="粗体"><b>B</b></button>
            <button class="toolbar-btn" onclick="applyItalic()" title="斜体"><i>I</i></button>
            <button class="toolbar-btn" onclick="applyUnderline()" title="下划线"><u>U</u></button>
            <span style="border-left: 1px solid var(--vscode-editorGroup-border); margin: 0 4px;"></span>
            <button id="currentColorBtn" class="color-palette-btn" onclick="applyCurrentColor()" title="点击应用当前颜色">🎨</button>
            <input type="color" id="colorPicker" onchange="updateCurrentColor()" value="#ffff00" style="display:none;">
            <button class="toolbar-btn" onclick="clearFormat()" title="清除格式">清除</button>
        </div>
        <div class="editor-content">
            <div class="editor-wrapper">
                <div id="lineNumbers"></div>
                <div id="noteContent" contenteditable="true" data-placeholder="开始写笔记..." spellcheck="false">${noteContent}</div>
            </div>
        </div>
        <div class="status-bar">
            <span id="charCount">字符: 0 | 行: 1</span>
            <span>🔒 已加密</span>
        </div>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        const noteContent = document.getElementById('noteContent');
        const noteTitle = document.getElementById('noteTitle');
        const lineNumbers = document.getElementById('lineNumbers');
        const colorPicker = document.getElementById('colorPicker');
        const currentColorBtn = document.getElementById('currentColorBtn');
        let savedRange = null;

        // 保存选区
        noteContent.addEventListener('mouseup', () => {
            const sel = window.getSelection();
            if (sel.rangeCount > 0) {
                savedRange = sel.getRangeAt(0).cloneRange();
            }
        });

        // 双击颜色按钮打开选择器
        currentColorBtn.addEventListener('dblclick', () => {
            colorPicker.click();
        });

        // 粗体
        function applyBold() {
            document.execCommand('bold');
            noteContent.focus();
        }

        // 斜体
        function applyItalic() {
            document.execCommand('italic');
            noteContent.focus();
        }

        // 下划线
        function applyUnderline() {
            document.execCommand('underline');
            noteContent.focus();
        }

        // 更新当前颜色按钮
        function updateCurrentColor() {
            const color = colorPicker.value;
            const rgb = hexToRgb(color);
            const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
            const textColor = brightness > 128 ? '#000000' : '#ffffff';

            currentColorBtn.style.backgroundColor = color;
            currentColorBtn.style.color = textColor;
        }

        // 应用当前颜色
        function applyCurrentColor() {
            if (!savedRange) return;

            const color = colorPicker.value;
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(savedRange);

            const rgb = hexToRgb(color);
            const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
            const textColor = brightness > 128 ? '#000000' : '#ffffff';

            document.execCommand('backColor', false, color);
            document.execCommand('foreColor', false, textColor);
            noteContent.focus();
        }

        // 十六进制颜色转 RGB
        function hexToRgb(hex) {
            const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : { r: 255, g: 255, b: 255 };
        }

        // 清除格式
        function clearFormat() {
            document.execCommand('removeFormat');
            noteContent.focus();
        }

        // 初始化当前颜色按钮
        updateCurrentColor();

        // 更新行号
        function updateLineNumbers() {
            const text = noteContent.innerText || noteContent.textContent || '';
            const lines = text.split('\\n').length;
            lineNumbers.innerHTML = '';
            for (let i = 1; i <= lines; i++) {
                const lineDiv = document.createElement('div');
                lineDiv.textContent = i;
                lineNumbers.appendChild(lineDiv);
            }
        }

        // 同步滚动
        noteContent.addEventListener('scroll', () => {
            lineNumbers.scrollTop = noteContent.scrollTop;
        });

        // 保存笔记
        function saveNote() {
            const title = noteTitle.value.trim();

            if (!title) {
                alert('请输入标题');
                return;
            }

            const content = noteContent.innerHTML;

            vscode.postMessage({
                command: 'save',
                title,
                content
            });
        }

        // 更新字符统计
        function updateCharCount() {
            const text = noteContent.innerText || noteContent.textContent || '';
            const chars = text.length;
            const lines = text.split('\\n').length;
            document.getElementById('charCount').textContent = \`字符: \${chars} | 行: \${lines}\`;
        }

        noteContent.addEventListener('input', () => {
            updateCharCount();
            updateLineNumbers();
        });
        noteTitle.addEventListener('input', updateCharCount);

        // 初始化
        updateCharCount();
        updateLineNumbers();

        // 自动保存
        let autoSaveTimer;
        noteContent.addEventListener('input', () => {
            clearTimeout(autoSaveTimer);
            autoSaveTimer = setTimeout(() => {
                if (noteTitle.value.trim()) {
                    saveNote();
                }
            }, 5000);
        });

        // 快捷键
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                saveNote();
            }
        });
    </script>
</body>
</html>`;
    }

    public dispose() {
        NoteEditorPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const d = this._disposables.pop();
            if (d) d.dispose();
        }
    }
}

// 插件激活
export function activate(context: vscode.ExtensionContext) {
    const notesManager = new NotesManager(context);
    const treeProvider = new NotesTreeProvider(notesManager);

    vscode.window.registerTreeDataProvider('secureNotes', treeProvider);

    // 显示存储路径
    vscode.window.showInformationMessage(`📝 加密笔记存储路径: ${notesManager.getStoragePath()}`);

    // 创建笔记
    context.subscriptions.push(
        vscode.commands.registerCommand('secureNotes.createNote', async () => {
            if (!Encryption.hasPassword()) {
                vscode.window.showWarningMessage('请先设置加密密码');
                vscode.commands.executeCommand('secureNotes.setPassword');
                return;
            }

            // 询问文件夹
            const allNotes = notesManager.getAllNotes();
            const existingFolders = [...new Set(allNotes.map(n => n.folder).filter(f => f))];

            // 如果没有文件夹，默认提供一些选项
            if (existingFolders.length === 0) {
                existingFolders.push('默认');
            }

            const folderOptions = [
                '+ 新建文件夹',
                ...existingFolders
            ];

            const selected = await vscode.window.showQuickPick(
                folderOptions,
                { placeHolder: '选择文件夹' }
            );

            if (!selected) {
                return;
            }

            let folder = '默认';
            if (selected === '+ 新建文件夹') {
                const newFolder = await vscode.window.showInputBox({
                    prompt: '输入新文件夹名称',
                    placeHolder: '例如：工作、生活、学习'
                });
                if (newFolder && newFolder.trim()) {
                    folder = newFolder.trim();

                    // 创建空文件夹
                    try {
                        notesManager.createFolder(folder);
                        treeProvider.refresh();
                        vscode.window.showInformationMessage(`✅ 文件夹 "${folder}" 已创建`);
                    } catch (error) {
                        vscode.window.showErrorMessage(`创建文件夹失败: ${error}`);
                        return;
                    }
                } else {
                    return;
                }
            } else {
                folder = selected;
            }

            NoteEditorPanel.show(null, notesManager, treeProvider, folder);
        })
    );

    // 在文件夹中创建笔记
    context.subscriptions.push(
        vscode.commands.registerCommand('secureNotes.createNoteInFolder', async (folderItem: FolderItem) => {
            if (!Encryption.hasPassword()) {
                vscode.window.showWarningMessage('请先设置加密密码');
                vscode.commands.executeCommand('secureNotes.setPassword');
                return;
            }
            NoteEditorPanel.show(null, notesManager, treeProvider, folderItem.label);
        })
    );

    // 打开笔记
    context.subscriptions.push(
        vscode.commands.registerCommand('secureNotes.openNote', async (noteId: string) => {
            if (!Encryption.hasPassword()) {
                vscode.window.showWarningMessage('请先输入密码解锁笔记');
                vscode.commands.executeCommand('secureNotes.setPassword');
                return;
            }
            NoteEditorPanel.show(noteId, notesManager, treeProvider);
        })
    );

    // 删除笔记
    context.subscriptions.push(
        vscode.commands.registerCommand('secureNotes.deleteNote', async (item: NoteItem) => {
            const confirm = await vscode.window.showWarningMessage(
                `确定删除笔记"${item.label}"吗？`,
                '删除',
                '取消'
            );
            if (confirm === '删除') {
                notesManager.deleteNote(item.id);
                treeProvider.refresh();
                vscode.window.showInformationMessage('✅ 笔记已删除');
            }
        })
    );

    // 删除文件夹
    context.subscriptions.push(
        vscode.commands.registerCommand('secureNotes.deleteFolder', async (folderItem: FolderItem) => {
            const noteCount = folderItem.noteCount;
            const message = noteCount > 0
                ? `确定删除文件夹"${folderItem.label}"及其下的 ${noteCount} 个笔记吗？`
                : `确定删除文件夹"${folderItem.label}"吗？`;

            const confirm = await vscode.window.showWarningMessage(
                message,
                { modal: true },
                '删除',
                '取消'
            );

            if (confirm === '删除') {
                notesManager.deleteFolder(folderItem.label);
                treeProvider.refresh();
                vscode.window.showInformationMessage(`✅ 文件夹已删除`);
            }
        })
    );

    // 设置密码/登录用户
    context.subscriptions.push(
        vscode.commands.registerCommand('secureNotes.setPassword', async () => {
            // 询问用户名
            const username = await vscode.window.showInputBox({
                prompt: '输入用户名',
                placeHolder: '例如：zoomin',
                value: Encryption.getCurrentUser() || ''
            });

            if (!username) {
                return;
            }

            // 检查用户文件是否存在
            const userFilePath = path.join(notesManager.getStoragePath(), `notes_${username}.encrypted`);
            const userExists = fs.existsSync(userFilePath);

            // 询问密码
            const password = await vscode.window.showInputBox({
                prompt: userExists
                    ? `用户 "${username}" 已存在，请输入密码登录`
                    : `新用户 "${username}"，请设置密码`,
                password: true,
                placeHolder: '请输入密码（用于加密/解密笔记）'
            });

            if (!password) {
                return;
            }

            // 如果用户已存在，验证密码是否正确
            if (userExists) {
                try {
                    // 临时设置密码并尝试解密第一个笔记
                    Encryption.setCurrentUser(username, password);
                    const encryptedNotes = notesManager['loadEncryptedNotes']();

                    if (encryptedNotes.length > 0) {
                        // 尝试解密第一个笔记的标题来验证密码
                        const testDecrypt = Encryption.decrypt(encryptedNotes[0].encryptedTitle);
                        if (!testDecrypt || testDecrypt.length === 0) {
                            throw new Error('解密失败');
                        }
                    }

                    // 密码正确
                    treeProvider.refresh();
                    vscode.window.showInformationMessage(`✅ 已登录为用户: ${username}`);
                } catch (error) {
                    // 密码错误，清除并提示
                    Encryption.logout();
                    treeProvider.refresh();
                    await vscode.window.showErrorMessage(
                        `❌ 密码错误！无法解密用户 "${username}" 的笔记`,
                        '重试'
                    ).then(selection => {
                        if (selection === '重试') {
                            vscode.commands.executeCommand('secureNotes.setPassword');
                        }
                    });
                }
            } else {
                // 新用户，直接设置
                Encryption.setCurrentUser(username, password);
                treeProvider.refresh();
                vscode.window.showInformationMessage(`✅ 新用户 "${username}" 创建成功！`);
            }
        })
    );

    // 注销用户
    context.subscriptions.push(
        vscode.commands.registerCommand('secureNotes.logout', async () => {
            const currentUser = Encryption.getCurrentUser();
            if (currentUser) {
                Encryption.logout();
                treeProvider.refresh();
                vscode.window.showInformationMessage(`✅ 用户 "${currentUser}" 已注销`);
            }
        })
    );

    // 更改存储路径
    context.subscriptions.push(
        vscode.commands.registerCommand('secureNotes.changeStoragePath', async () => {
            const uri = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                title: '选择笔记存储目录'
            });

            if (uri && uri[0]) {
                const config = vscode.workspace.getConfiguration('secureNotes');
                await config.update('storagePath', uri[0].fsPath, vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage(`✅ 存储路径已更改为: ${uri[0].fsPath}\n请重启 VSCode 以应用更改`);
            }
        })
    );

    // 导出笔记（JSON格式）
    context.subscriptions.push(
        vscode.commands.registerCommand('secureNotes.exportNotes', async () => {
            const notes = notesManager.getAllNotes();
            const exportData = notes.map(note => ({
                title: note.title,
                content: note.content,
                createdAt: new Date(note.createdAt).toLocaleString(),
                updatedAt: new Date(note.updatedAt).toLocaleString()
            }));

            const exportPath = path.join(notesManager.getStoragePath(), 'notes-export-decrypted.json');
            fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
            vscode.window.showInformationMessage(`✅ 笔记已导出（明文）: ${exportPath}`);
        })
    );

    // 导出为文件和目录结构
    context.subscriptions.push(
        vscode.commands.registerCommand('secureNotes.exportToFiles', async () => {
            if (!Encryption.hasPassword()) {
                vscode.window.showWarningMessage('请先输入密码');
                return;
            }

            const uri = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                title: '选择导出目录'
            });

            if (!uri || !uri[0]) {
                return;
            }

            const exportRoot = uri[0].fsPath;
            const notes = notesManager.getAllNotes();

            try {
                let exportedCount = 0;
                const folders = notesManager.getFolders();

                // 按文件夹组织笔记
                const folderMap = new Map<string, Note[]>();
                notes.forEach(note => {
                    if (!folderMap.has(note.folder)) {
                        folderMap.set(note.folder, []);
                    }
                    folderMap.get(note.folder)!.push(note);
                });

                // 获取所有文件夹（包括空文件夹）
                const allFolders = new Set<string>();
                folders.forEach(f => allFolders.add(f.name));
                notes.forEach(n => allFolders.add(n.folder));

                // 创建所有文件夹（包括空的）
                allFolders.forEach(folderName => {
                    const folderPath = path.join(exportRoot, folderName);
                    if (!fs.existsSync(folderPath)) {
                        fs.mkdirSync(folderPath, { recursive: true });
                    }

                    // 导出该文件夹下的笔记
                    const folderNotes = folderMap.get(folderName) || [];
                    folderNotes.forEach(note => {
                        const safeTitle = note.title.replace(/[/\\?%*:|"<>]/g, '-');
                        const fileName = `${safeTitle}.md`;
                        const filePath = path.join(folderPath, fileName);

                        const content = `# ${note.title}\n\n${note.content}\n\n---\n创建时间: ${new Date(note.createdAt).toLocaleString()}\n修改时间: ${new Date(note.updatedAt).toLocaleString()}`;
                        fs.writeFileSync(filePath, content, 'utf8');
                        exportedCount++;
                    });
                });

                vscode.window.showInformationMessage(`✅ 已导出 ${exportedCount} 个笔记和 ${allFolders.size} 个文件夹到: ${exportRoot}`);

            } catch (error) {
                vscode.window.showErrorMessage(`导出失败: ${error}`);
            }
        })
    );

    // 从文件导入笔记
    context.subscriptions.push(
        vscode.commands.registerCommand('secureNotes.importFromFiles', async () => {
            if (!Encryption.hasPassword()) {
                vscode.window.showWarningMessage('请先设置加密密码');
                return;
            }

            const uri = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                title: '选择要导入的目录'
            });

            if (!uri || !uri[0]) {
                return;
            }

            const importRoot = uri[0].fsPath;

            try {
                let importedCount = 0;

                // 读取目录结构
                const items = fs.readdirSync(importRoot);

                // 获取当前所有笔记
                const existingNotes = notesManager.getAllNotes();

                for (const itemName of items) {
                    const itemPath = path.join(importRoot, itemName);
                    const stats = fs.statSync(itemPath);

                    // 跳过隐藏文件和系统文件
                    if (itemName.startsWith('.') || itemName === 'node_modules') {
                        continue;
                    }

                    if (stats.isDirectory()) {
                        // 这是一个文件夹
                        const files = fs.readdirSync(itemPath).filter(f => f.endsWith('.md'));

                        for (const fileName of files) {
                            const filePath = path.join(itemPath, fileName);
                            let content = fs.readFileSync(filePath, 'utf8');
                            const title = fileName.replace(/\.md$/, '');

                            // 清除导出时添加的时间信息
                            content = content.replace(/\n---\n创建时间:.*\n修改时间:.*$/s, '');
                            content = content.trim();

                            // 检查是否已存在同名笔记
                            const existing = existingNotes.find(n => n.folder === itemName && n.title === title);

                            if (existing) {
                                // 覆盖已存在的笔记
                                notesManager.updateNote(existing.id, title, content);
                            } else {
                                // 创建新笔记
                                notesManager.createNote(title, content, itemName);
                            }
                            importedCount++;
                        }
                    } else if (itemName.endsWith('.md')) {
                        // 根目录下的 .md 文件，放到"默认"文件夹
                        let content = fs.readFileSync(itemPath, 'utf8');
                        const title = itemName.replace(/\.md$/, '');

                        // 清除导出时添加的时间信息
                        content = content.replace(/\n---\n创建时间:.*\n修改时间:.*$/s, '');
                        content = content.trim();

                        const existing = existingNotes.find(n => n.folder === '默认' && n.title === title);
                        if (existing) {
                            notesManager.updateNote(existing.id, title, content);
                        } else {
                            notesManager.createNote(title, content, '默认');
                        }
                        importedCount++;
                    }
                }

                treeProvider.refresh();

                if (importedCount === 0) {
                    vscode.window.showWarningMessage('未找到可导入的 .md 文件');
                } else {
                    vscode.window.showInformationMessage(`✅ 已导入 ${importedCount} 个笔记`);
                }

            } catch (error) {
                vscode.window.showErrorMessage(`导入失败: ${error}\n请检查目录权限和文件格式`);
                console.error('Import error:', error);
            }
        })
    );
}

export function deactivate() {}
