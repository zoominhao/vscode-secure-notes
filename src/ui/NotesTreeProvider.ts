/**
 * 笔记树视图提供者
 * 负责侧边栏的树状结构显示
 */

import * as vscode from 'vscode';
import { Note } from '../models/Note';
import { NotesManager } from '../core/NotesManager';
import { EncryptionService } from '../core/Encryption';

export class NotesTreeProvider implements vscode.TreeDataProvider<TreeItem> {
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
        if (!EncryptionService.hasPassword()) {
            if (!element) {
                return Promise.resolve([new PasswordPromptItem()]);
            }
            return Promise.resolve([]);
        }

        const notes = this.notesManager.getAllNotes();
        const folders = this.notesManager.getFolders();

        if (!element) {
            // 根级别：显示所有文件夹
            const noteCountMap = new Map<string, number>();
            notes.forEach(note => {
                noteCountMap.set(note.folder, (noteCountMap.get(note.folder) || 0) + 1);
            });

            const allFolderNames = new Set<string>();
            folders.forEach(f => allFolderNames.add(f.name));
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

// 树项类型
export type TreeItem = FolderItem | NoteItem | PasswordPromptItem;

export class PasswordPromptItem extends vscode.TreeItem {
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

export class FolderItem extends vscode.TreeItem {
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

export class NoteItem extends vscode.TreeItem {
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
