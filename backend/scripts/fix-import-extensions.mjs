import fs from "node:fs";
import path from "node:path";

const root = path.resolve("src");
function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.isFile() && full.endsWith(".js")) files.push(full);
  }
  return files;
}

function patch(content) {
  let out = content;

  out = out.replace(/(from\s+["'])(\.{1,2}\/[^"'\n\r]+)(["'])/g, (m, a, spec, c) => {
    if (/\.(js|mjs|cjs|json|node)$/.test(spec)) return m;
    return `${a}${spec}.js${c}`;
  });

  out = out.replace(/(import\s+["'])(\.{1,2}\/[^"'\n\r]+)(["'])/g, (m, a, spec, c) => {
    if (/\.(js|mjs|cjs|json|node)$/.test(spec)) return m;
    return `${a}${spec}.js${c}`;
  });

  out = out.replace(/(export\s+(?:\*|\{[^}]*\})\s+from\s+["'])(\.{1,2}\/[^"'\n\r]+)(["'])/g, (m, a, spec, c) => {
    if (/\.(js|mjs|cjs|json|node)$/.test(spec)) return m;
    return `${a}${spec}.js${c}`;
  });

  return out;
}

const files = walk(root);
let changed = 0;
for (const file of files) {
  const before = fs.readFileSync(file, "utf8");
  const after = patch(before);
  if (before !== after) {
    fs.writeFileSync(file, after, "utf8");
    changed += 1;
    console.log(`updated: ${path.relative(process.cwd(), file)}`);
  }
}

console.log(`\nDone. Changed ${changed} file(s) out of ${files.length}.`);
