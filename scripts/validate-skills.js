#!/usr/bin/env node
/**
 * scripts/validate-skills.js
 *
 * Lints every skill under `skills/` against the current repo state.
 * Fails (exit 1) if any of these drift from reality:
 *
 *   1. SKILL.md frontmatter is missing or malformed (name / description required).
 *   2. Any relative link (`[text](../foo/bar.md)`) points at a path that doesn't exist.
 *   3. Any fenced `file_path:line_number` anchor points at a path that doesn't exist.
 *   4. Any referenced bare file path (e.g. `backend/routes/sites.js`) doesn't exist.
 *
 * Intentionally pure-Node, zero deps — runnable from `./scripts/setup.sh`'s
 * Node 20 baseline without touching `package.json`.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SKILLS_DIR = path.join(REPO_ROOT, 'skills');

const problems = [];
function fail(file, msg) {
  problems.push({ file: path.relative(REPO_ROOT, file), msg });
}

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.isFile() && entry.name.endsWith('.md')) acc.push(full);
  }
  return acc;
}

function parseFrontmatter(src) {
  if (!src.startsWith('---\n')) return null;
  const end = src.indexOf('\n---', 4);
  if (end === -1) return null;
  const block = src.slice(4, end);
  const fm = {};
  for (const raw of block.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!m) continue;
    let [, key, val] = m;
    val = val.replace(/^['"]|['"]$/g, '').trim();
    fm[key] = val;
  }
  return fm;
}

function checkFrontmatter(file, src) {
  const basename = path.basename(file);
  if (basename !== 'SKILL.md') return;
  const fm = parseFrontmatter(src);
  if (!fm) {
    fail(file, 'SKILL.md has no YAML frontmatter block');
    return;
  }
  for (const key of ['name', 'description']) {
    if (!fm[key]) fail(file, `frontmatter missing required key: ${key}`);
  }
  if (fm.name && !/^[a-z][a-z0-9-]*$/.test(fm.name)) {
    fail(file, `frontmatter name "${fm.name}" is not kebab-case lowercase`);
  }
}

function checkRelativeLinks(file, src) {
  const dir = path.dirname(file);
  // Match [text](target) — skip absolute http(s)://, mailto:, and in-document #anchors.
  const linkRx = /\[([^\]]*)\]\(([^)\s]+?)(?:\s+"[^"]*")?\)/g;
  let m;
  while ((m = linkRx.exec(src)) !== null) {
    const target = m[2];
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const [pathPart] = target.split('#');
    if (!pathPart) continue;
    const resolved = path.resolve(dir, pathPart);
    if (!fs.existsSync(resolved)) {
      fail(file, `broken relative link: ${target}  (resolved to ${path.relative(REPO_ROOT, resolved)})`);
    }
  }
}

function checkLineAnchors(file, src) {
  // Match `backend/foo/bar.js:123` (inside backticks or bare) but only if the
  // path part looks like a real repo file (contains a slash and a dot-ext).
  const rx = /([A-Za-z0-9_\-./]+\.[A-Za-z]{1,5}):(\d+)/g;
  let m;
  while ((m = rx.exec(src)) !== null) {
    const rel = m[1];
    if (rel.startsWith('http') || rel.startsWith('//')) continue;
    if (!rel.includes('/')) continue;
    // Ignore example snippets like "localhost:8000" — require either a known
    // top-level repo dir or a file extension we ship.
    const firstSeg = rel.split('/')[0];
    const known = new Set([
      'backend', 'frontend', 'scripts', 'docs', 'skills', 'android', 'ios',
    ]);
    if (!known.has(firstSeg)) continue;
    const resolved = path.join(REPO_ROOT, rel);
    if (!fs.existsSync(resolved)) {
      fail(file, `dangling path anchor: ${rel}:${m[2]}`);
    }
  }
}

function checkBarePaths(file, src) {
  // Match fenced-inline repo paths like `backend/services/llm/index.js` that
  // aren't part of an anchor already covered above.
  const rx = /`([A-Za-z0-9_\-./]+\.[A-Za-z]{1,5})`/g;
  const known = new Set(['backend', 'frontend', 'scripts', 'docs', 'skills', 'android', 'ios']);
  let m;
  while ((m = rx.exec(src)) !== null) {
    const rel = m[1];
    if (!rel.includes('/')) continue;
    const firstSeg = rel.split('/')[0];
    if (!known.has(firstSeg)) continue;
    const resolved = path.join(REPO_ROOT, rel);
    if (!fs.existsSync(resolved)) {
      fail(file, `broken file reference: ${rel}`);
    }
  }
}

function main() {
  if (!fs.existsSync(SKILLS_DIR)) {
    console.error(`[validate-skills] no ${SKILLS_DIR} — nothing to check`);
    process.exit(0);
  }
  const files = walk(SKILLS_DIR);
  if (files.length === 0) {
    console.error('[validate-skills] skills/ exists but contains no markdown');
    process.exit(1);
  }

  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    checkFrontmatter(file, src);
    checkRelativeLinks(file, src);
    checkLineAnchors(file, src);
    checkBarePaths(file, src);
  }

  if (problems.length === 0) {
    console.log(`[validate-skills] OK — ${files.length} file(s), no drift detected`);
    process.exit(0);
  }

  console.error(`[validate-skills] ${problems.length} problem(s) across ${files.length} file(s):\n`);
  for (const p of problems) console.error(`  - ${p.file}: ${p.msg}`);
  process.exit(1);
}

main();
