// カードやピンなどに順番に割り当てるアクセントカラー
export const palette = ["#00b8d9", "#7b5cff", "#ff5fa2", "#2ee6a6", "#ff8a5b", "#3a7bff", "#ffc83d"];

export const colorAt = (i: number) => palette[i % palette.length];
