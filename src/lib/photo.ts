import { Directory, File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Platform } from "react-native";

export interface PreparedPhoto {
  uri: string;
  base64: string;
}

/**
 * "Clean" the photo before sending: downscale to 1024px wide and re-encode as JPEG.
 * Keeps uploads small (~150 KB) and strips EXIF/location metadata.
 */
export async function preparePhoto(sourceUri: string): Promise<PreparedPhoto> {
  const image = await ImageManipulator.manipulate(sourceUri).resize({ width: 1024 }).renderAsync();
  const result = await image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: true });
  if (!result.base64) throw new Error("Could not encode photo");
  return { uri: result.uri, base64: result.base64 };
}

/**
 * Save a processed photo for the meal history. On native it's copied out of the cache into
 * permanent storage. On web there's no file system, so a small thumbnail is kept as a data URI.
 */
export async function persistPhoto(photo: PreparedPhoto, id: string): Promise<string | null> {
  if (Platform.OS === "web") return webThumbnail(photo);
  try {
    const dir = new Directory(Paths.document, "meals");
    if (!dir.exists) dir.create({ intermediates: true });
    const dest = new File(dir, `${id}.jpg`);
    await new File(photo.uri).copy(dest);
    return dest.uri;
  } catch (e) {
    console.warn("Failed to save photo", e);
    return null;
  }
}

async function webThumbnail(photo: PreparedPhoto): Promise<string> {
  try {
    const image = await ImageManipulator.manipulate(photo.uri).resize({ width: 480 }).renderAsync();
    const thumb = await image.saveAsync({ compress: 0.6, format: SaveFormat.JPEG, base64: true });
    if (thumb.base64) return `data:image/jpeg;base64,${thumb.base64}`;
  } catch (e) {
    console.warn("Failed to make thumbnail", e);
  }
  return `data:image/jpeg;base64,${photo.base64}`;
}

export function deletePhoto(uri: string | null) {
  if (!uri || uri.startsWith("data:")) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Missing photos are harmless.
  }
}

/** Hand-off between the camera screen and the result screen (base64 is too big for route params). */
let pending: PreparedPhoto | null = null;
export const pendingPhoto = {
  set: (p: PreparedPhoto) => (pending = p),
  get: () => pending,
};
