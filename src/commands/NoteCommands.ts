/**
 * 笔记相关命令
 * 创建、打开、编辑、删除笔记
 */

import * as vscode from 'vscode';
import { NotesManager } from '../core/NotesManager';
import { NotesTreeProvider, NoteItem } from '../ui/NotesTreeProvider';
import { NoteEditorPanel } from '../ui/NoteEditor';
import { EncryptionService } from '../core/Encryption';

export function registerNoteCommands(
    context: vscode.ExtensionContext,
    notesManager: NotesManager,
    treeProvider: NotesTreeProvider
) {
    // 创建笔记
    context.subscriptions.push(
        vscode.commands.registerCommand('secureNotes.createNote', async () => {
            if (!EncryptionService.hasPassword()) {
                vscode.window.showWarningMessage('请先设置加密密码');
                vscode.commands.executeCommand('secureNotes.setPassword');
                return;
            }

            const allNotes = notesManager.getAllNotes();
            const existingFolders = [...new Set(allNotes.map(n => n.folder).filter(f => f))];

            if (existingFolders.length === 0) {
                existingFolders.push('默认');
            }

            const folderOptions = ['+ 新建文件夹', ...existingFolders];
            const selected = await vscode.window.showQuickPick(folderOptions, { placeHolder: '选择文件夹' });

            if (!selected) return;

            let folder = '默认';
            if (selected === '+ 新建文件夹') {
                const newFolder = await vscode.window.showInputBox({
                    prompt: '输入新文件夹名称',
                    placeHolder: '例如：工作、生活、学习'
                });
                if (newFolder && newFolder.trim()) {
                    folder = newFolder.trim();
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

    // 打开笔记
    context.subscriptions.push(
        vscode.commands.registerCommand('secureNotes.openNote', async (noteId: string) => {
            if (!EncryptionService.hasPassword()) {
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
}
