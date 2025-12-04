/**
 * 加密服务
 * 负责所有加密/解密操作和用户管理
 */

import * as CryptoJS from 'crypto-js';

export class EncryptionService {
    private static currentUser: string | null = null;
    private static userPasswords: Map<string, string> = new Map();

    static setCurrentUser(username: string, password: string): void {
        this.currentUser = username;
        this.userPasswords.set(username, password);
    }

    static getCurrentUser(): string | null {
        return this.currentUser;
    }

    static hasPassword(): boolean {
        return this.currentUser !== null && this.userPasswords.has(this.currentUser);
    }

    static encrypt(text: string): string {
        if (!this.currentUser || !this.userPasswords.has(this.currentUser)) {
            throw new Error('未设置加密密码');
        }
        const password = this.userPasswords.get(this.currentUser)!;
        return CryptoJS.AES.encrypt(text, password).toString();
    }

    static decrypt(encryptedText: string): string {
        if (!this.currentUser || !this.userPasswords.has(this.currentUser)) {
            throw new Error('未设置加密密码');
        }
        const password = this.userPasswords.get(this.currentUser)!;
        const bytes = CryptoJS.AES.decrypt(encryptedText, password);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        if (!decrypted) {
            throw new Error('解密失败，密码可能错误');
        }
        return decrypted;
    }

    static logout(): void {
        if (this.currentUser) {
            this.userPasswords.delete(this.currentUser);
            this.currentUser = null;
        }
    }
}
