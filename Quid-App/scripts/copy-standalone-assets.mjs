import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const root = process.cwd();
const copies = [
  [join(root, ".next", "static"), join(root, ".next", "standalone", ".next", "static")],
  [join(root, "public"), join(root, ".next", "standalone", "public")],
];

for (const [from, to] of copies) {
  if (!existsSync(from)) {
    throw new Error(`Missing build asset path: ${from}`);
  }
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true, force: true });
}
