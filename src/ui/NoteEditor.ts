/**
 * 笔记编辑器面板
 * 负责编辑器的创建、显示和消息处理
 */

import * as vscode from 'vscode';
import { NotesManager } from '../core/NotesManager';
import { NotesTreeProvider } from './NotesTreeProvider';
import { generateEditorHTML } from './EditorTemplate';
import { EncryptionService } from '../core/Encryption';

export class NoteEditorPanel {
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
            if (!EncryptionService.hasPassword()) {
                vscode.window.showErrorMessage('请先设置加密密码');
                return;
            }

            if (this.noteId) {
                // 更新现有笔记
                const currentNote = this.notesManager.getNote(this.noteId);
                if (currentNote && currentNote.title !== title) {
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

        if (this.noteId) {
            const note = this.notesManager.getNote(this.noteId);
            if (note) {
                noteTitle = note.title;
                noteContent = note.content;
            }
        }

        return generateEditorHTML(noteTitle, noteContent);
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
