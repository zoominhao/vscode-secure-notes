/**
 * 云同步服务
 * 支持多种云存储后端（WebDAV、GitHub、自定义服务器等）
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { EncryptedStorage } from '../models/Note';

export enum SyncProvider {
    None = 'none',
    WebDAV = 'webdav',
    GitHub = 'github',
    Custom = 'custom'
}

export interface SyncConfig {
    provider: SyncProvider;
    url?: string;
    username?: string;
    password?: string;
    token?: string;
    autoSync?: boolean;
}

export class SyncService {
    private config: SyncConfig;
    private syncInProgress = false;

    constructor(private context: vscode.ExtensionContext) {
        this.config = this.loadConfig();
    }

    /**
     * 加载同步配置
     */
    private loadConfig(): SyncConfig {
        const config = vscode.workspace.getConfiguration('secureNotes');
        return {
            provider: config.get('sync.provider', SyncProvider.None),
            url: config.get('sync.url'),
            username: config.get('sync.username'),
            autoSync: config.get('sync.autoSync', false)
        };
    }

    /**
     * 设置同步配置
     */
    async configure(): Promise<boolean> {
        const provider = await vscode.window.showQuickPick(
            [
                { label: '禁用同步', value: SyncProvider.None },
                { label: 'WebDAV', value: SyncProvider.WebDAV, description: '支持 Nextcloud、ownCloud 等' },
                { label: 'GitHub', value: SyncProvider.GitHub, description: '使用 GitHub 仓库' },
                { label: '自定义服务器', value: SyncProvider.Custom, description: 'HTTP/HTTPS API' }
            ],
            { placeHolder: '选择云同步方式' }
        );

        if (!provider) {
            return false;
        }

        this.config.provider = provider.value as SyncProvider;

        if (provider.value === SyncProvider.None) {
            await this.saveConfig();
            vscode.window.showInformationMessage('✅ 云同步已禁用');
            return true;
        }

        // 根据不同提供商配置参数
        switch (provider.value) {
            case SyncProvider.WebDAV:
                return await this.configureWebDAV();
            case SyncProvider.GitHub:
                return await this.configureGitHub();
            case SyncProvider.Custom:
                return await this.configureCustom();
        }

        return false;
    }

    /**
     * 配置 WebDAV
     */
    private async configureWebDAV(): Promise<boolean> {
        const url = await vscode.window.showInputBox({
            prompt: '输入 WebDAV 服务器地址',
            placeHolder: 'https://cloud.example.com/remote.php/dav/files/username/SecureNotes'
        });

        if (!url) return false;

        const username = await vscode.window.showInputBox({
            prompt: '输入用户名',
            placeHolder: 'username'
        });

        if (!username) return false;

        const password = await vscode.window.showInputBox({
            prompt: '输入密码',
            password: true
        });

        if (!password) return false;

        this.config.url = url;
        this.config.username = username;
        this.config.password = password;

        await this.saveConfig();
        vscode.window.showInformationMessage('✅ WebDAV 同步已配置');
        return true;
    }

    /**
     * 配置 GitHub
     */
    private async configureGitHub(): Promise<boolean> {
        const repo = await vscode.window.showInputBox({
            prompt: '输入 GitHub 仓库',
            placeHolder: 'username/repo-name'
        });

        if (!repo) return false;

        const token = await vscode.window.showInputBox({
            prompt: '输入 GitHub Personal Access Token',
            password: true,
            placeHolder: 'ghp_...'
        });

        if (!token) return false;

        this.config.url = `https://api.github.com/repos/${repo}`;
        this.config.token = token;

        await this.saveConfig();
        vscode.window.showInformationMessage('✅ GitHub 同步已配置');
        return true;
    }

    /**
     * 配置自定义服务器
     */
    private async configureCustom(): Promise<boolean> {
        const url = await vscode.window.showInputBox({
            prompt: '输入服务器 API 地址',
            placeHolder: 'https://api.example.com/notes'
        });

        if (!url) return false;

        const token = await vscode.window.showInputBox({
            prompt: '输入 API Token（可选）',
            password: true
        });

        this.config.url = url;
        if (token) {
            this.config.token = token;
        }

        await this.saveConfig();
        vscode.window.showInformationMessage('✅ 自定义同步已配置');
        return true;
    }

    /**
     * 保存配置
     */
    private async saveConfig(): Promise<void> {
        const config = vscode.workspace.getConfiguration('secureNotes');
        await config.update('sync.provider', this.config.provider, vscode.ConfigurationTarget.Global);
        await config.update('sync.url', this.config.url, vscode.ConfigurationTarget.Global);
        await config.update('sync.username', this.config.username, vscode.ConfigurationTarget.Global);

        // 密码和 token 存储在 secrets 中（更安全）
        if (this.config.password) {
            await this.context.secrets.store('sync.password', this.config.password);
        }
        if (this.config.token) {
            await this.context.secrets.store('sync.token', this.config.token);
        }
    }

    /**
     * 上传到云端
     */
    async uploadToCloud(localFilePath: string, currentUser: string): Promise<boolean> {
        if (this.config.provider === SyncProvider.None) {
            return false;
        }

        if (this.syncInProgress) {
            vscode.window.showWarningMessage('同步正在进行中...');
            return false;
        }

        this.syncInProgress = true;

        try {
            const fileContent = fs.readFileSync(localFilePath, 'utf8');
            const fileName = `notes_${currentUser}.encrypted`;

            switch (this.config.provider) {
                case SyncProvider.WebDAV:
                    return await this.uploadToWebDAV(fileName, fileContent);
                case SyncProvider.GitHub:
                    return await this.uploadToGitHub(fileName, fileContent);
                case SyncProvider.Custom:
                    return await this.uploadToCustom(fileName, fileContent);
                default:
                    return false;
            }
        } catch (error) {
            vscode.window.showErrorMessage(`上传失败: ${error}`);
            return false;
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * 从云端下载
     */
    async downloadFromCloud(localFilePath: string, currentUser: string): Promise<boolean> {
        if (this.config.provider === SyncProvider.None) {
            return false;
        }

        if (this.syncInProgress) {
            vscode.window.showWarningMessage('同步正在进行中...');
            return false;
        }

        this.syncInProgress = true;

        try {
            const fileName = `notes_${currentUser}.encrypted`;
            let content: string | null = null;

            switch (this.config.provider) {
                case SyncProvider.WebDAV:
                    content = await this.downloadFromWebDAV(fileName);
                    break;
                case SyncProvider.GitHub:
                    content = await this.downloadFromGitHub(fileName);
                    break;
                case SyncProvider.Custom:
                    content = await this.downloadFromCustom(fileName);
                    break;
            }

            if (content) {
                fs.writeFileSync(localFilePath, content, 'utf8');
                return true;
            }

            return false;
        } catch (error) {
            vscode.window.showErrorMessage(`下载失败: ${error}`);
            return false;
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * WebDAV 上传
     */
    private async uploadToWebDAV(fileName: string, content: string): Promise<boolean> {
        if (!this.config.url || !this.config.username || !this.config.password) {
            throw new Error('WebDAV 配置不完整');
        }

        const url = `${this.config.url}/${fileName}`;
        const auth = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/octet-stream'
            },
            body: content
        });

        if (response.ok) {
            vscode.window.showInformationMessage('✅ 已上传到云端');
            return true;
        } else {
            throw new Error(`WebDAV 上传失败: ${response.statusText}`);
        }
    }

    /**
     * WebDAV 下载
     */
    private async downloadFromWebDAV(fileName: string): Promise<string | null> {
        if (!this.config.url || !this.config.username || !this.config.password) {
            throw new Error('WebDAV 配置不完整');
        }

        const url = `${this.config.url}/${fileName}`;
        const auth = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${auth}`
            }
        });

        if (response.ok) {
            vscode.window.showInformationMessage('✅ 已从云端下载');
            return await response.text();
        } else if (response.status === 404) {
            return null; // 文件不存在
        } else {
            throw new Error(`WebDAV 下载失败: ${response.statusText}`);
        }
    }

    /**
     * GitHub 上传（使用 Contents API）
     */
    private async uploadToGitHub(fileName: string, content: string): Promise<boolean> {
        if (!this.config.url || !this.config.token) {
            throw new Error('GitHub 配置不完整');
        }

        const token = await this.context.secrets.get('sync.token');
        if (!token) {
            throw new Error('GitHub Token 未找到');
        }

        const apiUrl = `${this.config.url}/contents/${fileName}`;

        // 先获取文件 SHA（如果存在）
        let sha: string | undefined;
        try {
            const getResponse = await fetch(apiUrl, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            if (getResponse.ok) {
                const data: any = await getResponse.json();
                sha = data.sha;
            }
        } catch (error) {
            // 文件不存在，忽略
        }

        // 上传或更新文件
        const body: any = {
            message: `Update encrypted notes - ${new Date().toLocaleString()}`,
            content: Buffer.from(content).toString('base64')
        };

        if (sha) {
            body.sha = sha; // 更新现有文件
        }

        const response = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (response.ok) {
            vscode.window.showInformationMessage('✅ 已上传到 GitHub');
            return true;
        } else {
            const error = await response.text();
            throw new Error(`GitHub 上传失败: ${error}`);
        }
    }

    /**
     * GitHub 下载
     */
    private async downloadFromGitHub(fileName: string): Promise<string | null> {
        if (!this.config.url || !this.config.token) {
            throw new Error('GitHub 配置不完整');
        }

        const token = await this.context.secrets.get('sync.token');
        if (!token) {
            throw new Error('GitHub Token 未找到');
        }

        const apiUrl = `${this.config.url}/contents/${fileName}`;

        const response = await fetch(apiUrl, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (response.ok) {
            const data: any = await response.json();
            const content = Buffer.from(data.content, 'base64').toString('utf8');
            vscode.window.showInformationMessage('✅ 已从 GitHub 下载');
            return content;
        } else if (response.status === 404) {
            return null;
        } else {
            throw new Error(`GitHub 下载失败: ${response.statusText}`);
        }
    }

    /**
     * 自定义服务器上传
     */
    private async uploadToCustom(fileName: string, content: string): Promise<boolean> {
        // TODO: 实现自定义 API 上传
        vscode.window.showInformationMessage('自定义同步功能开发中...');
        return false;
    }

    /**
     * 自定义服务器下载
     */
    private async downloadFromCustom(fileName: string): Promise<string | null> {
        // TODO: 实现自定义 API 下载
        return null;
    }

    /**
     * 同步（智能合并）
     */
    async sync(localFilePath: string, currentUser: string): Promise<void> {
        if (this.config.provider === SyncProvider.None) {
            vscode.window.showInformationMessage('请先配置云同步');
            return;
        }

        const choice = await vscode.window.showQuickPick(
            [
                { label: '⬆️ 上传到云端', value: 'upload' },
                { label: '⬇️ 从云端下载', value: 'download' },
                { label: '🔄 智能合并', value: 'merge' }
            ],
            { placeHolder: '选择同步方式' }
        );

        if (!choice) return;

        switch (choice.value) {
            case 'upload':
                await this.uploadToCloud(localFilePath, currentUser);
                break;
            case 'download':
                await this.downloadFromCloud(localFilePath, currentUser);
                break;
            case 'merge':
                await this.smartMerge(localFilePath, currentUser);
                break;
        }
    }

    /**
     * 智能合并
     * 将本地和云端的笔记按时间戳合并
     */
    private async smartMerge(localFilePath: string, currentUser: string): Promise<void> {
        try {
            const fileName = `notes_${currentUser}.encrypted`;

            // 1. 下载云端数据
            let cloudContent: string | null = null;
            switch (this.config.provider) {
                case SyncProvider.WebDAV:
                    cloudContent = await this.downloadFromWebDAV(fileName);
                    break;
                case SyncProvider.GitHub:
                    cloudContent = await this.downloadFromGitHub(fileName);
                    break;
                case SyncProvider.Custom:
                    cloudContent = await this.downloadFromCustom(fileName);
                    break;
            }

            if (!cloudContent) {
                vscode.window.showInformationMessage('云端无数据，上传本地数据');
                await this.uploadToCloud(localFilePath, currentUser);
                return;
            }

            // 2. 解析本地和云端数据
            const localData: EncryptedStorage = JSON.parse(fs.readFileSync(localFilePath, 'utf8'));
            const cloudData: EncryptedStorage = JSON.parse(cloudContent);

            // 3. 合并笔记（按 ID 去重，保留最新的）
            const mergedNotesMap = new Map();

            // 添加本地笔记
            localData.notes.forEach(note => {
                mergedNotesMap.set(note.id, note);
            });

            // 添加或更新云端笔记（如果更新时间更晚）
            cloudData.notes.forEach(cloudNote => {
                const localNote = mergedNotesMap.get(cloudNote.id);
                if (!localNote || cloudNote.updatedAt > localNote.updatedAt) {
                    mergedNotesMap.set(cloudNote.id, cloudNote);
                }
            });

            // 4. 合并文件夹（去重）
            const allFolders = new Set<string>();
            localData.folders.forEach(f => allFolders.add(f.name));
            cloudData.folders.forEach(f => allFolders.add(f.name));

            const mergedFolders = Array.from(allFolders).map(name => ({
                name,
                createdAt: Date.now()
            }));

            // 5. 生成合并结果
            const mergedData: EncryptedStorage = {
                folders: mergedFolders,
                notes: Array.from(mergedNotesMap.values())
            };

            // 6. 保存到本地
            fs.writeFileSync(localFilePath, JSON.stringify(mergedData, null, 2), 'utf8');

            // 7. 上传合并结果
            await this.uploadToCloud(localFilePath, currentUser);

            vscode.window.showInformationMessage(
                `✅ 智能合并完成！合并了 ${mergedData.notes.length} 个笔记`
            );
        } catch (error) {
            vscode.window.showErrorMessage(`智能合并失败: ${error}`);
        }
    }
}
