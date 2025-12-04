/**
 * 颜色工具函数
 * RGB 转换、亮度计算等
 */

export interface RGB {
    r: number;
    g: number;
    b: number;
}

/**
 * 十六进制颜色转 RGB
 */
export function hexToRgb(hex: string): RGB {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 255 };
}

/**
 * 计算颜色亮度
 * 返回值范围 0-255
 */
export function calculateBrightness(rgb: RGB): number {
    return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
}

/**
 * 根据背景色自动选择文字颜色
 * @param bgColor 背景色（十六进制）
 * @returns 文字颜色（黑色或白色）
 */
export function getContrastColor(bgColor: string): string {
    const rgb = hexToRgb(bgColor);
    const brightness = calculateBrightness(rgb);
    return brightness > 128 ? '#000000' : '#ffffff';
}
