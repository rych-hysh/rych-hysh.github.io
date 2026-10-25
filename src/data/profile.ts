// content/ フォルダの YAML と写真を読み込み、形式をチェックしてページに渡します。
// 内容の編集は content/ だけで完結するので、このファイルは基本的に触らなくて OK です。
import { parse } from "yaml";
import { z } from "astro/zod";
import type { ImageMetadata } from "astro";

import profileRaw from "../../content/profile.yaml?raw";
import careerRaw from "../../content/career.yaml?raw";
import skillsRaw from "../../content/skills.yaml?raw";
import photosRaw from "../../content/photos.yaml?raw";
import travelRaw from "../../content/travel.yaml?raw";
import bikeRaw from "../../content/bike.yaml?raw";

/** YAML を読み込んでスキーマで検証。間違いがあればファイル名と場所つきでビルドを止める */
function load<T extends z.ZodType>(file: string, raw: string, schema: T): z.infer<T> {
  let data: unknown;
  try {
    data = parse(raw) ?? [];
  } catch (e) {
    throw new Error(`content/${file} の書き方に誤りがあります:\n${(e as Error).message}`);
  }
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(全体)"}: ${i.message}`)
      .join("\n");
    throw new Error(`content/${file} の内容に誤りがあります:\n${issues}`);
  }
  return result.data;
}

// 年などを数字で書いても文字列で書いても OK にする
const text = z.union([z.string(), z.number()]).transform(String);

const socialSchema = z.object({
  label: z.string(),
  handle: text,
  url: z.string(),
  icon: z.enum(["github", "x", "instagram", "linkedin", "note", "mail"]),
});

const profileData = load(
  "profile.yaml",
  profileRaw,
  z.object({
    name: z.string(),
    role: z.string(),
    tagline: z.string(),
    intro: z.string(),
    location: z.string(),
    socials: z.array(socialSchema).default([]),
  }),
);

export const { socials, ...profile } = profileData;
export type Social = z.infer<typeof socialSchema>;

export const career = load(
  "career.yaml",
  careerRaw,
  z.array(
    z.object({
      period: text,
      title: z.string(),
      org: z.string(),
      description: z.string().default(""),
    }),
  ),
);

export const { groups: skills, certifications } = load(
  "skills.yaml",
  skillsRaw,
  z.object({
    groups: z.array(z.object({ label: z.string(), items: z.array(text) })).default([]),
    certifications: z
      .array(z.object({ name: z.string(), issuer: z.string().default(""), year: text.default("") }))
      .default([]),
  }),
);

// ---------------------------------------------------------------- travel
const travelImages = import.meta.glob<{ default: ImageMetadata }>(
  "../../content/travel/*.{jpg,jpeg,JPG,JPEG,png,PNG,webp,WEBP,avif,AVIF}",
  { eager: true },
);
const travelByName = new Map(
  Object.entries(travelImages).map(([path, mod]) => [path.split("/").pop()!, mod.default]),
);

const travelData = load(
  "travel.yaml",
  travelRaw,
  z.array(
    z.object({
      id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "id は半角英数字とハイフンで指定してください").optional(),
      place: z.string(),
      region: z.string().default(""),
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      description: z.string().default(""),
      photos: z.array(z.object({
        file: z.string().min(1).regex(/^[^/\\]+$/, "content/travel/ 内のファイル名を指定してください"),
        alt: z.string().trim().min(1, "写真の内容を表す alt を入力してください"),
        caption: z.string().default(""),
      })).default([]),
    }),
  ),
);
const travelIds = new Set<string>();
export const trips = travelData.map((trip, index) => {
  // id のない従来の4項目だけのデータも読み込める。新規登録では固定 id を推奨。
  const id = trip.id ?? `place-${index + 1}`;
  if (travelIds.has(id)) throw new Error(`content/travel.yaml の id "${id}" が重複しています`);
  travelIds.add(id);
  return {
    ...trip,
    id,
    photos: trip.photos.map((photo) => {
      const image = travelByName.get(photo.file);
      if (!image) {
        throw new Error(`content/travel.yaml の ${trip.place} の写真 "${photo.file}" が content/travel/ に見つかりません（大文字小文字も確認してください）`);
      }
      return { ...photo, image };
    }),
  };
});
export type Trip = (typeof trips)[number];

// ---------------------------------------------------------------- bike
export const bike = load(
  "bike.yaml",
  bikeRaw,
  z.object({
    bikes: z
      .array(
        z.object({
          name: z.string(),
          maker: z.string().default(""),
          year: text.default(""),
          cc: z.number().optional(),
          note: z.string().default(""),
        }),
      )
      .default([]),
    stats: z.object({
      totalKm: z.number().min(0),
    }),
    photos: z.array(z.object({ file: z.string(), caption: z.string().default("") })).default([]),
    routes: z.array(z.object({ name: z.string(), area: z.string().default(""), km: z.number().positive() })).default([]),
  }),
);

// バイクの写真（content/bike/）。photos.yaml と同じく、リストにない画像は最後に追加
const bikeImages = import.meta.glob<{ default: ImageMetadata }>(
  "../../content/bike/*.{jpg,jpeg,JPG,JPEG,png,PNG,webp,avif,AVIF}",
  { eager: true },
);
const bikeByName = new Map(
  Object.entries(bikeImages).map(([path, mod]) => [path.split("/").pop()!, mod.default]),
);
export const bikePhotos: { image: ImageMetadata; caption: string }[] = [
  ...bike.photos.map((m) => {
    const image = bikeByName.get(m.file);
    if (!image) throw new Error(`content/bike.yaml の写真 "${m.file}" が content/bike/ に見つかりません`);
    return { image, caption: m.caption };
  }),
  ...[...bikeByName.entries()]
    .filter(([name]) => !bike.photos.some((m) => m.file === name))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, image]) => ({ image, caption: "" })),
];

// ---------------------------------------------------------------- photos
const photoMeta = load(
  "photos.yaml",
  photosRaw,
  z.array(z.object({ file: z.string(), title: z.string().optional(), place: text.optional() })),
);

const images = import.meta.glob<{ default: ImageMetadata }>(
  "../../content/photos/*.{jpg,jpeg,JPG,JPEG,png,PNG,webp,avif,AVIF}",
  { eager: true },
);
const byName = new Map(
  Object.entries(images).map(([path, mod]) => [path.split("/").pop()!, mod.default]),
);

export type Photo = { image: ImageMetadata; title: string; place: string };

const listed = photoMeta.map((m): Photo => {
  const image = byName.get(m.file);
  if (!image) {
    throw new Error(
      `content/photos.yaml の "${m.file}" が content/photos/ に見つかりません（ファイル名・拡張子の大文字小文字を確認してください）`,
    );
  }
  return { image, title: m.title ?? stem(m.file), place: m.place ?? "" };
});

const listedNames = new Set(photoMeta.map((m) => m.file));
const unlisted = [...byName.entries()]
  .filter(([name]) => !listedNames.has(name))
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, image]): Photo => ({ image, title: stem(name), place: "" }));

export const photos: Photo[] = [...listed, ...unlisted];

function stem(file: string) {
  return file.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
}
