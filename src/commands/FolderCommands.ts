/**
 * 文件夹相关命令
 */

import * as vscode from 'vscode';
import { NotesManager } from '../core/NotesManager';
import { NotesTreeProvider, FolderItem } from '../ui/NotesTreeProvider';
import { NoteEditorPanel } from '../ui/NoteEditor';
import { EncryptionService } from '../core/Encryption';

export function registerFolderCommands(
    context: vscode.ExtensionContext,
    notesManager: NotesManager,
    treeProvider: NotesTreeProvider
) {
    // 在文件夹中创建笔记
    context.subscriptions.push(
        vscode.commands.registerCommand('secureNotes.createNoteInFolder', async (folderItem: FolderItem) => {
            if (!EncryptionService.hasPassword()) {
                vscode.window.showWarningMessage('请先设置加密密码');
                vscode.commands.executeCommand('secureNotes.setPassword');
                return;
            }
            NoteEditorPanel.show(null, notesManager, treeProvider, folderItem.label);
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
}
