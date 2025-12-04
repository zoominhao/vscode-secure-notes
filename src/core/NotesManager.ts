/**
 * 笔记管理服务
 * 负责笔记和文件夹的 CRUD 操作
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Note, EncryptedNote, Folder, EncryptedStorage } from '../models/Note';
import { EncryptionService } from './Encryption';

export class NotesManager {
    private storagePath: string;

    constructor(context: vscode.ExtensionContext) {
        const config = vscode.workspace.getConfiguration('secureNotes');
        const customPath = config.get<string>('storagePath');

        if (customPath && customPath.trim()) {
            this.storagePath = customPath.replace('~', os.homedir());
        } else {
            this.storagePath = path.join(os.homedir(), 'Documents', 'SecureNotes');
        }

        if (!fs.existsSync(this.storagePath)) {
            fs.mkdirSync(this.storagePath, { recursive: true });
        }
    }

    getStoragePath(): string {
        return this.storagePath;
    }

    private getStorageFile(): string {
        const currentUser = EncryptionService.getCurrentUser() || 'default';
        return path.join(this.storagePath, `notes_${currentUser}.encrypted`);
    }

    private loadStorage(): EncryptedStorage {
        try {
            const storageFile = this.getStorageFile();
            if (fs.existsSync(storageFile)) {
                const data = fs.readFileSync(storageFile, 'utf8');
                const parsed = JSON.parse(data);

                if (Array.isArray(parsed)) {
                    return { folders: [], notes: parsed };
                }
                return parsed;
            }
        } catch (error) {
            console.error('加载笔记失败:', error);
        }
        return { folders: [], notes: [] };
    }

    private saveStorage(storage: EncryptedStorage): void {
        try {
            const storageFile = this.getStorageFile();
            fs.writeFileSync(storageFile, JSON.stringify(storage, null, 2), 'utf8');
        } catch (error) {
            vscode.window.showErrorMessage(`保存失败: ${error}`);
        }
    }

    // 文件夹操作
    getFolders(): Folder[] {
        return this.loadStorage().folders;
    }

    createFolder(name: string): void {
        const storage = this.loadStorage();
        if (storage.folders.some(f => f.name === name)) {
            throw new Error('文件夹已存在');
        }
        storage.folders.push({ name, createdAt: Date.now() });
        this.saveStorage(storage);
    }

    deleteFolder(name: string): void {
        const storage = this.loadStorage();
        storage.folders = storage.folders.filter(f => f.name !== name);
        storage.notes = storage.notes.filter(n => n.folder !== name);
        this.saveStorage(storage);
    }

    // 笔记操作
    getAllNotes(): Note[] {
        if (!EncryptionService.hasPassword()) {
            return [];
        }

        const encryptedNotes = this.loadStorage().notes;
        const decryptedNotes: Note[] = [];

        for (const encrypted of encryptedNotes) {
            try {
                decryptedNotes.push({
                    id: encrypted.id,
                    folder: encrypted.folder || 'default',
                    title: EncryptionService.decrypt(encrypted.encryptedTitle),
                    content: EncryptionService.decrypt(encrypted.encryptedContent),
                    createdAt: encrypted.createdAt,
                    updatedAt: encrypted.updatedAt
                });
            } catch (error) {
                console.error('解密笔记失败:', encrypted.id);
            }
        }

        return decryptedNotes;
    }

    getNote(id: string): Note | null {
        if (!EncryptionService.hasPassword()) {
            return null;
        }

        const encrypted = this.loadStorage().notes.find(n => n.id === id);
        if (!encrypted) {
            return null;
        }

        try {
            return {
                id: encrypted.id,
                folder: encrypted.folder || 'default',
                title: EncryptionService.decrypt(encrypted.encryptedTitle),
                content: EncryptionService.decrypt(encrypted.encryptedContent),
                createdAt: encrypted.createdAt,
                updatedAt: encrypted.updatedAt
            };
        } catch (error) {
            throw new Error('解密失败，密码可能错误');
        }
    }

    createNote(title: string, content: string, folder: string = 'default'): Note {
        if (!EncryptionService.hasPassword()) {
            throw new Error('请先设置加密密码');
        }

        const existingNotes = this.getAllNotes();
        const duplicate = existingNotes.find(n => n.folder === folder && n.title === title);
        if (duplicate) {
            throw new Error(`文件夹"${folder}"下已存在同名笔记"${title}"`);
        }

        const note: Note = {
            id: Date.now().toString(),
            folder,
            title,
            content,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        const encryptedNote: EncryptedNote = {
            id: note.id,
            folder,
            encryptedTitle: EncryptionService.encrypt(title),
            encryptedContent: EncryptionService.encrypt(content),
            createdAt: note.createdAt,
            updatedAt: note.updatedAt
        };

        const storage = this.loadStorage();
        storage.notes.push(encryptedNote);
        this.saveStorage(storage);

        return note;
    }

    updateNote(id: string, title: string, content: string): void {
        if (!EncryptionService.hasPassword()) {
            throw new Error('请先设置加密密码');
        }

        const storage = this.loadStorage();
        const note = storage.notes.find(n => n.id === id);

        if (note) {
            note.encryptedTitle = EncryptionService.encrypt(title);
            note.encryptedContent = EncryptionService.encrypt(content);
            note.updatedAt = Date.now();
            this.saveStorage(storage);
        }
    }

    deleteNote(id: string): void {
        const storage = this.loadStorage();
        storage.notes = storage.notes.filter(n => n.id !== id);
        this.saveStorage(storage);
    }
}
