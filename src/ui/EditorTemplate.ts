/**
 * 编辑器 HTML 模板生成器
 */

export function generateEditorHTML(noteTitle: string, noteContent: string): string {
    const escapedTitle = noteTitle.replace(/"/g, '&quot;');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>加密笔记编辑器</title>
    <style>
        ${getEditorStyles()}
    </style>
</head>
<body>
    <div class="editor-container">
        <div class="title-bar">
            <input type="text" id="noteTitle" placeholder="未命名笔记" value="${escapedTitle}">
        </div>
        <div class="editor-toolbar">
            <button class="toolbar-btn" onclick="saveNote()">💾 保存</button>
            <span class="separator"></span>
            <button class="toolbar-btn" onclick="applyBold()" title="粗体"><b>B</b></button>
            <button class="toolbar-btn" onclick="applyItalic()" title="斜体"><i>I</i></button>
            <button class="toolbar-btn" onclick="applyUnderline()" title="下划线"><u>U</u></button>
            <span class="separator"></span>
            <button id="currentColorBtn" class="color-palette-btn" onclick="applyCurrentColor()" title="应用当前颜色">🎨</button>
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
        ${getEditorScript()}
    </script>
</body>
</html>`;
}

function getEditorStyles(): string {
    return `
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
            align-items: center;
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
        .separator {
            width: 1px;
            height: 20px;
            background: var(--vscode-editorGroup-border);
            margin: 0 4px;
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
    `;
}

function getEditorScript(): string {
    return `
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
            const result = /^#?([a-f\\\\d]{2})([a-f\\\\d]{2})([a-f\\\\d]{2})$/i.exec(hex);
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

        // 更新行号
        function updateLineNumbers() {
            const text = noteContent.innerText || noteContent.textContent || '';
            const lines = text.split('\\\\n').length;
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
            vscode.postMessage({ command: 'save', title, content });
        }

        // 更新字符统计
        function updateCharCount() {
            const text = noteContent.innerText || noteContent.textContent || '';
            const chars = text.length;
            const lines = text.split('\\\\n').length;
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
        updateCurrentColor();

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
    `;
}
