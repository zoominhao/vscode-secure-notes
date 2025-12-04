/**
 * 导入导出命令
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { NotesManager } from '../core/NotesManager';
import { NotesTreeProvider } from '../ui/NotesTreeProvider';
import { EncryptionService } from '../core/Encryption';

export function registerImportExportCommands(
    context: vscode.ExtensionContext,
    notesManager: NotesManager,
    treeProvider: NotesTreeProvider
) {
    // 导出为文件和目录结构
    context.subscriptions.push(
        vscode.commands.registerCommand('secureNotes.exportToFiles', async () => {
            if (!EncryptionService.hasPassword()) {
                vscode.window.showWarningMessage('请先输入密码');
                return;
            }

            const uri = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                title: '选择导出目录'
            });

            if (!uri || !uri[0]) return;

            const exportRoot = uri[0].fsPath;
            const notes = notesManager.getAllNotes();

            try {
                let exportedCount = 0;
                const folders = notesManager.getFolders();

                const folderMap = new Map<string, any[]>();
                notes.forEach(note => {
                    if (!folderMap.has(note.folder)) {
                        folderMap.set(note.folder, []);
                    }
                    folderMap.get(note.folder)!.push(note);
                });

                const allFolders = new Set<string>();
                folders.forEach(f => allFolders.add(f.name));
                notes.forEach(n => allFolders.add(n.folder));

                allFolders.forEach((folderName: string) => {
                    const folderPath = path.join(exportRoot, folderName);
                    if (!fs.existsSync(folderPath)) {
                        fs.mkdirSync(folderPath, { recursive: true });
                    }

                    const folderNotes = folderMap.get(folderName) || [];
                    folderNotes.forEach((note: any) => {
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
            if (!EncryptionService.hasPassword()) {
                vscode.window.showWarningMessage('请先设置加密密码');
                return;
            }

            const uri = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                title: '选择要导入的目录'
            });

            if (!uri || !uri[0]) return;

            const importRoot = uri[0].fsPath;

            try {
                let importedCount = 0;
                const items = fs.readdirSync(importRoot);
                const existingNotes = notesManager.getAllNotes();

                for (const itemName of items) {
                    const itemPath = path.join(importRoot, itemName);
                    const stats = fs.statSync(itemPath);

                    if (itemName.startsWith('.') || itemName === 'node_modules') {
                        continue;
                    }

                    if (stats.isDirectory()) {
                        const files = fs.readdirSync(itemPath).filter(f => f.endsWith('.md'));

                        for (const fileName of files) {
                            const filePath = path.join(itemPath, fileName);
                            let content = fs.readFileSync(filePath, 'utf8');
                            const title = fileName.replace(/\.md$/, '');

                            content = content.replace(/\n---\n创建时间:.*\n修改时间:.*$/s, '');
                            content = content.trim();

                            const existing = existingNotes.find(n => n.folder === itemName && n.title === title);

                            if (existing) {
                                notesManager.updateNote(existing.id, title, content);
                            } else {
                                notesManager.createNote(title, content, itemName);
                            }
                            importedCount++;
                        }
                    } else if (itemName.endsWith('.md')) {
                        let content = fs.readFileSync(itemPath, 'utf8');
                        const title = itemName.replace(/\.md$/, '');

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
