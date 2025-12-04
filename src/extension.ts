/**
 * VSCode 加密笔记插件 - 入口文件
 *
 * 这是插件的主入口，负责：
 * 1. 初始化核心服务
 * 2. 注册所有命令
 * 3. 注册树视图
 */

import * as vscode from 'vscode';
import { NotesManager } from './core/NotesManager';
import { SyncService } from './core/SyncService';
import { NotesTreeProvider } from './ui/NotesTreeProvider';
import { registerNoteCommands } from './commands/NoteCommands';
import { registerFolderCommands } from './commands/FolderCommands';
import { registerUserCommands } from './commands/UserCommands';
import { registerImportExportCommands } from './commands/ImportExportCommands';
import { registerSyncCommands } from './commands/SyncCommands';

/**
 * 插件激活函数
 * VSCode 会在需要时调用此函数
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('加密笔记插件已激活');

    // 初始化核心服务
    const notesManager = new NotesManager(context);
    const syncService = new SyncService(context);
    const treeProvider = new NotesTreeProvider(notesManager);

    // 注册树视图
    vscode.window.registerTreeDataProvider('secureNotes', treeProvider);

    // 显示存储路径
    vscode.window.showInformationMessage(`📝 加密笔记存储路径: ${notesManager.getStoragePath()}`);

    // 注册所有命令
    registerNoteCommands(context, notesManager, treeProvider);
    registerFolderCommands(context, notesManager, treeProvider);
    registerUserCommands(context, notesManager, treeProvider);
    registerImportExportCommands(context, notesManager, treeProvider);
    registerSyncCommands(context, notesManager, treeProvider, syncService);
}

/**
 * 插件停用函数
 */
export function deactivate() {
    console.log('加密笔记插件已停用');
}
