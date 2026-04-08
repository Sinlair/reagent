import path from "node:path";
import { fileURLToPath } from "node:url";

export const packageRootDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

export function resolvePackagePath(...segments: string[]): string {
  return path.join(packageRootDir, ...segments);
}
