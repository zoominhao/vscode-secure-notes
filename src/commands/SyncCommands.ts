/**
 * 云同步命令
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { SyncService } from '../core/SyncService';
import { NotesManager } from '../core/NotesManager';
import { NotesTreeProvider } from '../ui/NotesTreeProvider';
import { EncryptionService } from '../core/Encryption';

export function registerSyncCommands(
    context: vscode.ExtensionContext,
    notesManager: NotesManager,
    treeProvider: NotesTreeProvider,
    syncService: SyncService
) {
    // 配置云同步
    context.subscriptions.push(
        vscode.commands.registerCommand('secureNotes.configureSyncCommands', async () => {
            const configured = await syncService.configure();
            if (configured) {
                treeProvider.refresh();
            }
        })
    );

    // 手动同步
    context.subscriptions.push(
        vscode.commands.registerCommand('secureNotes.syncNow', async () => {
            const currentUser = EncryptionService.getCurrentUser();
            if (!currentUser) {
                vscode.window.showWarningMessage('请先登录');
                return;
            }

            const localFilePath = path.join(
                notesManager.getStoragePath(),
                `notes_${currentUser}.encrypted`
            );

            await syncService.sync(localFilePath, currentUser);
            treeProvider.refresh();
        })
    );

    // 上传到云端
    context.subscriptions.push(
        vscode.commands.registerCommand('secureNotes.uploadToCloud', async () => {
            const currentUser = EncryptionService.getCurrentUser();
            if (!currentUser) {
                vscode.window.showWarningMessage('请先登录');
                return;
            }

            const localFilePath = path.join(
                notesManager.getStoragePath(),
                `notes_${currentUser}.encrypted`
            );

            const success = await syncService.uploadToCloud(localFilePath, currentUser);
            if (success) {
                vscode.window.showInformationMessage('✅ 笔记已上传到云端');
            }
        })
    );

    // 从云端下载
    context.subscriptions.push(
        vscode.commands.registerCommand('secureNotes.downloadFromCloud', async () => {
            const currentUser = EncryptionService.getCurrentUser();
            if (!currentUser) {
                vscode.window.showWarningMessage('请先登录');
                return;
            }

            const confirm = await vscode.window.showWarningMessage(
                '从云端下载会覆盖本地笔记，确定继续吗？',
                { modal: true },
                '确定',
                '取消'
            );

            if (confirm !== '确定') return;

            const localFilePath = path.join(
                notesManager.getStoragePath(),
                `notes_${currentUser}.encrypted`
            );

            const success = await syncService.downloadFromCloud(localFilePath, currentUser);
            if (success) {
                treeProvider.refresh();
                vscode.window.showInformationMessage('✅ 已从云端下载笔记');
            }
        })
    );
}
