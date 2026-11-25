/**
 * 歌词文字色 / 背景色预设调色板。
 *
 * 每个调色板都给出了 100 个可直接使用的颜色（#RRGGBBAA），
 * 供"基础设置 → 歌词 → 文本颜色 / 文本背景色"的电视端选择面板使用。
 */

interface ILyricColorOption {
    value: string;
    title: string;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    const hue = ((h % 360) + 360) % 360;
    const sat = Math.min(100, Math.max(0, s)) / 100;
    const lig = Math.min(100, Math.max(0, l)) / 100;
    const c = (1 - Math.abs(2 * lig - 1)) * sat;
    const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
    const m = lig - c / 2;
    let r = 0;
    let g = 0;
    let b = 0;
    if (hue < 60) {
        r = c;
        g = x;
    } else if (hue < 120) {
        r = x;
        g = c;
    } else if (hue < 180) {
        g = c;
        b = x;
    } else if (hue < 240) {
        g = x;
        b = c;
    } else if (hue < 300) {
        r = x;
        b = c;
    } else {
        r = c;
        b = x;
    }
    return [
        Math.round((r + m) * 255),
        Math.round((g + m) * 255),
        Math.round((b + m) * 255),
    ];
}

function toHex(rgb: [number, number, number], alpha = "FF") {
    const body = rgb
        .map(v => v.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();
    return `#${body}${alpha}`;
}

const HUE_NAMES: Array<[string, number]> = [
    ["红", 0],
    ["橙", 26],
    ["琥珀", 42],
    ["黄", 56],
    ["草绿", 88],
    ["绿", 132],
    ["青", 168],
    ["天蓝", 198],
    ["蓝", 218],
    ["靛紫", 240],
    ["紫", 272],
    ["玫粉", 318],
];

/** 歌词文字颜色：100 个（含原有 6 个经典色 + 12 色相 × 7 档明度 + 10 个中性色） */
export const LYRIC_TEXT_COLORS: ILyricColorOption[] = (() => {
    const list: ILyricColorOption[] = [
        { value: "#FFFFFFFF", title: "白色（默认）" },
        { value: "#FFE9D2FF", title: "米白" },
        { value: "#5FD0FFFF", title: "青蓝" },
        { value: "#FFD166FF", title: "暖黄" },
        { value: "#FF9ECDFF", title: "粉色" },
        { value: "#B5FF8AFF", title: "浅绿" },
    ];

    const lightnessList = [58, 66, 72, 78, 84, 90, 96];
    HUE_NAMES.forEach(([name, hue]) => {
        lightnessList.forEach((lightness, index) => {
            list.push({
                value: toHex(hslToRgb(hue, 82, lightness)),
                title: `${name} ${index + 1}`,
            });
        });
    });

    // 中性色补足到 100
    const neutralList = [18, 28, 38, 48, 58, 68, 76, 84, 92, 99];
    neutralList.forEach((lightness, index) => {
        list.push({
            value: toHex(hslToRgb(210, 8, lightness)),
            title: `中性 ${index + 1}`,
        });
    });

    return list.slice(0, 100);
})();

/** 歌词背景颜色：100 个（透明 + 12 色相 × 8 档暗色 + 3 个黑白半透明） */
export const LYRIC_BG_COLORS: ILyricColorOption[] = (() => {
    const list: ILyricColorOption[] = [
        { value: "transparent", title: "透明（默认）" },
    ];

    const lightnessList = [10, 14, 18, 22, 26, 30, 34, 38];
    HUE_NAMES.forEach(([name, hue]) => {
        lightnessList.forEach((lightness, index) => {
            list.push({
                value: toHex(hslToRgb(hue, 56, lightness), index % 2 ? "CC" : "DD"),
                title: `${name} 深 ${index + 1}`,
            });
        });
    });

    list.push({ value: "#00000099", title: "黑色半透明" });
    list.push({ value: "#00000059", title: "黑色轻遮罩" });
    list.push({ value: "#000000D9", title: "黑色重遮罩" });

    // 中性深色补足
    const neutralList = [8, 12, 16, 20, 24];
    neutralList.forEach((lightness, index) => {
        list.push({
            value: toHex(hslToRgb(214, 22, lightness), "DD"),
            title: `墨色 ${index + 1}`,
        });
    });

    return list.slice(0, 100);
})();
