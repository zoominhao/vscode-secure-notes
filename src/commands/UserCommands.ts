/**
 * 用户相关命令
 * 登录、注销、密码管理
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { EncryptionService } from '../core/Encryption';
import { NotesManager } from '../core/NotesManager';
import { NotesTreeProvider } from '../ui/NotesTreeProvider';

export function registerUserCommands(
    context: vscode.ExtensionContext,
    notesManager: NotesManager,
    treeProvider: NotesTreeProvider
) {
    // 设置密码/登录用户
    context.subscriptions.push(
        vscode.commands.registerCommand('secureNotes.setPassword', async () => {
            const username = await vscode.window.showInputBox({
                prompt: '输入用户名',
                placeHolder: '例如：zoomin',
                value: EncryptionService.getCurrentUser() || ''
            });

            if (!username) return;

            const userFilePath = path.join(notesManager.getStoragePath(), `notes_${username}.encrypted`);
            const userExists = fs.existsSync(userFilePath);

            const password = await vscode.window.showInputBox({
                prompt: userExists
                    ? `用户 "${username}" 已存在，请输入密码登录`
                    : `新用户 "${username}"，请设置密码`,
                password: true,
                placeHolder: '请输入密码（用于加密/解密笔记）'
            });

            if (!password) return;

            if (userExists) {
                try {
                    EncryptionService.setCurrentUser(username, password);
                    const encryptedNotes = notesManager['loadStorage']().notes;

                    if (encryptedNotes.length > 0) {
                        const testDecrypt = EncryptionService.decrypt(encryptedNotes[0].encryptedTitle);
                        if (!testDecrypt || testDecrypt.length === 0) {
                            throw new Error('解密失败');
                        }
                    }

                    treeProvider.refresh();
                    vscode.window.showInformationMessage(`✅ 已登录为用户: ${username}`);
                } catch (error) {
                    EncryptionService.logout();
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
                EncryptionService.setCurrentUser(username, password);
                treeProvider.refresh();
                vscode.window.showInformationMessage(`✅ 新用户 "${username}" 创建成功！`);
            }
        })
    );

    // 注销用户
    context.subscriptions.push(
        vscode.commands.registerCommand('secureNotes.logout', async () => {
            const currentUser = EncryptionService.getCurrentUser();
            if (currentUser) {
                EncryptionService.logout();
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
}
