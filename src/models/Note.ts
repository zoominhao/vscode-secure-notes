/**
 * 笔记数据模型
 */

export interface Note {
    id: string;
    folder: string;
    title: string;
    content: string;
    createdAt: number;
    updatedAt: number;
}

export interface EncryptedNote {
    id: string;
    folder: string;
    encryptedTitle: string;
    encryptedContent: string;
    createdAt: number;
    updatedAt: number;
}

export interface Folder {
    name: string;
    createdAt: number;
}

export interface EncryptedStorage {
    folders: Folder[];
    notes: EncryptedNote[];
}
