#!/usr/bin/env node
// dep-diagram generator — deterministic: the same repo state and options always give a byte-identical HTML.
// usage: node gen.mjs --base <ref> [--head HEAD] [--right features] [--out file.html]
//                     [--config cfg.json] [--notes notes.json] [--emit-notes skeleton.json] [--max-importers 30]
// Structure (files, marks, functions, edges) comes only from git and the TypeScript compiler API.
// Text (title, summaries, notes) is optional and never changes the structure.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// ---------- args ----------
function parseArgs(argv) {
  const o = { head: "HEAD", right: "features", out: path.join(os.tmpdir(), "dep-diagram.html"), maxImporters: 30 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = () => argv[++i];
    if (k === "--base") o.base = v(); else if (k === "--head") o.head = v(); else if (k === "--right") o.right = v();
    else if (k === "--out") o.out = v(); else if (k === "--config") o.config = v(); else if (k === "--notes") o.notes = v();
    else if (k === "--emit-notes") o.emitNotes = v(); else if (k === "--max-importers") o.maxImporters = Number(v());
    else if (k === "-h" || k === "--help") o.help = true; else throw new Error("unknown option: " + k);
  }
  return o;
}
const opt = parseArgs(process.argv.slice(2));
if (opt.help || !opt.base) {
  console.error("usage: node gen.mjs --base <ref> [--head HEAD] [--right features] [--out file.html]\n" +
    "       [--config cfg.json] [--notes notes.json] [--emit-notes skeleton.json] [--max-importers 30]");
  process.exit(opt.help ? 0 : 2);
}

// ---------- git ----------
let TOP;
const git = (args, o = {}) => execFileSync("git", ["-C", TOP, "-c", "core.quotepath=off", ...args], { encoding: "utf8", maxBuffer: 1000000000, ...o });
TOP = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const headC = git(["rev-parse", "--verify", opt.head + "^{commit}"]).trim();
let baseC;
try { baseC = git(["merge-base", opt.base, headC]).trim(); } catch { baseC = git(["rev-parse", "--verify", opt.base + "^{commit}"]).trim(); }

function readBlobs(commit, paths) {
  const out = new Map();
  if (!paths.length) return out;
  const r = spawnSync("git", ["-C", TOP, "cat-file", "--batch"], { input: paths.map((p) => commit + ":" + p).join("\n") + "\n", maxBuffer: 2000000000 });
  if (r.status !== 0) throw new Error("git cat-file failed: " + r.stderr);
  const b = r.stdout; let pos = 0, idx = 0;
  while (pos < b.length) {
    const nl = b.indexOf(10, pos); const head = b.toString("utf8", pos, nl).split(" ");
    pos = nl + 1;
    if (head[head.length - 1] === "missing") { idx++; continue; }
    const size = Number(head[2]);
    let text = b.toString("utf8", pos, pos + size); pos += size + 1;
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    out.set(paths[idx++], { text, size });
  }
  return out;
}

// ---------- typescript ----------
function loadTS() {
  // needs the JS compiler API (createProgram etc.). TypeScript 7 (native) ships no such API, so only 5.x / 6.x are used; anything else falls back to an installed typescript@5
  const usable = (t) => t && typeof t.createProgram === "function" && typeof t.resolveModuleName === "function" && /^[56]\./.test(t.version);
  const dir = path.join(os.tmpdir(), "dep-diagram-ts");
  const tries = [path.join(TOP, "package.json"), path.join(HERE, "package.json"), path.join(dir, "package.json")];
  for (const t of tries) { try { const m = createRequire(t)("typescript"); if (usable(m)) return { ts: m, from: path.dirname(t) }; } catch {} }
  fs.mkdirSync(dir, { recursive: true });
  execFileSync("npm", ["install", "--prefix", dir, "typescript@5", "--no-audit", "--no-fund", "--silent"], { stdio: ["ignore", "ignore", "inherit"] });
  const m = createRequire(path.join(dir, "package.json"))("typescript");
  if (!usable(m)) throw new Error("typescript@5 could not be loaded from " + dir);
  return { ts: m, from: dir };
}
const { ts, from: tsFrom } = loadTS();
console.error("typescript " + ts.version + " (" + tsFrom + ")");

const SRC = /\.(?:[cm]?[jt]s|[jt]sx)$/;
const ROOT = "/repo/";
const isTest = (p) => /\.(?:test|spec)\.[^./]+$/.test(p) || /(^|\/)(?:__tests__|e2e)\//.test(p);

// ---------- tree context: files of one commit, parsing, resolution, program ----------
function makeTree(commit) {
  const all = git(["ls-tree", "-r", "-z", "--name-only", commit]).split("\0").filter(Boolean).sort(cmp);
  const files = new Set(all), dirs = new Set([""]);
  for (const p of all) { let d = path.posix.dirname(p); while (d !== "." && !dirs.has(d)) { dirs.add(d); d = path.posix.dirname(d); } }
  const want = all.filter((p) => SRC.test(p) || (/\.json$/.test(p) && !/lock/i.test(p)));
  const blobs = readBlobs(commit, want);
  const text = (rel) => { const b = blobs.get(rel); return b && (b.size < (1 << 20) || SRC.test(rel)) ? b.text : undefined; };
  const sfCache = new Map();
  const sfOf = (rel) => {
    if (sfCache.has(rel)) return sfCache.get(rel);
    const t = text(rel); const sf = t == null ? undefined : ts.createSourceFile(ROOT + rel, t, ts.ScriptTarget.Latest, true);
    sfCache.set(rel, sf); return sf;
  };
  const rel = (v) => (v.startsWith(ROOT) ? v.slice(ROOT.length) : null);
  const mrHost = {
    fileExists: (f) => { const r = rel(f); return r != null && files.has(r); },
    readFile: (f) => { const r = rel(f); return r == null ? undefined : text(r); },
    directoryExists: (d) => { const r = rel(d.replace(/\/$/, "")); return r === "" || (r != null && dirs.has(r)); },
    realpath: (x) => x, getCurrentDirectory: () => "/repo", useCaseSensitiveFileNames: true, getDirectories: () => [],
  };
  const baseOpts = { allowJs: true, checkJs: false, noEmit: true, noLib: true, types: [], skipLibCheck: true, target: ts.ScriptTarget.ESNext, resolveJsonModule: true };
  const cfgCache = new Map();
  const optionsFor = (r) => {
    let d = path.posix.dirname(r); if (d === ".") d = "";
    for (;;) {
      for (const n of ["tsconfig.json", "jsconfig.json"]) {
        const c = d ? d + "/" + n : n;
        if (files.has(c)) {
          if (!cfgCache.has(c)) {
            let o = {};
            try {
              const j = ts.readConfigFile(ROOT + c, (f) => mrHost.readFile(f));
              const parsed = ts.parseJsonConfigFileContent(j.config || {}, { ...mrHost, readDirectory: () => [] }, ROOT + d, undefined, ROOT + c);
              o = parsed.options;
            } catch {}
            const out = { ...o, ...baseOpts };
            if (!o.moduleResolution) out.moduleResolution = ts.ModuleResolutionKind.Node10 ?? ts.ModuleResolutionKind.NodeJs;
            if (o.baseUrl == null && o.paths && !o.pathsBasePath) out.pathsBasePath = ROOT + d;
            cfgCache.set(c, out);
          }
          return cfgCache.get(c);
        }
      }
      if (!d) break; d = path.posix.dirname(d); if (d === ".") d = "";
    }
    if (!cfgCache.has("")) cfgCache.set("", { ...baseOpts, moduleResolution: ts.ModuleResolutionKind.Node10 ?? ts.ModuleResolutionKind.NodeJs });
    return cfgCache.get("");
  };
  const resolve = (spec, fromRel) => {
    if (!/^[.\/#@~]|^[A-Za-z0-9_$-]/.test(spec)) return null;
    const r = ts.resolveModuleName(spec, ROOT + fromRel, optionsFor(fromRel), mrHost).resolvedModule;
    if (!r || r.isExternalLibraryImport) return null;
    const x = rel(r.resolvedFileName);
    return x != null && files.has(x) && !/(^|\/)node_modules\//.test(x) ? x : null;
  };
  return { commit, all, files, srcFiles: all.filter((p) => SRC.test(p)), text, sfOf, rel, resolve, optionsFor, entriesCache: new Map() };
}

// ---------- top-level declaration entries ----------
const TEST_ROOTS = new Set(["describe", "it", "test", "suite"]);
function clip(s, n) { s = s.replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; }
function commentLine(sf, r) {
  let t = sf.text.slice(r.pos, r.end);
  t = r.kind === ts.SyntaxKind.MultiLineCommentTrivia ? t.replace(/^\/\*+/, "").replace(/\*+\/$/, "").split("\n").map((l) => l.replace(/^\s*\*?\s?/, "")) : [t.replace(/^\/\/+\s?/, "")];
  for (const l of t) { const s = l.trim(); if (!s) continue; if (/^@(?!file|fileoverview|module|description)/.test(s)) return ""; return s; }
  return "";
}
const DIRECTIVE = /^(?:eslint|prettier|@ts-|istanbul|biome|tslint|c8|v8|webpack|use strict|use client|use server|copyright|license|spdx|region|endregion|TODO|FIXME)|copyright|licensed under|spdx-license|@license/i;
const goodComment = (s) => s && !DIRECTIVE.test(s);
function docOf(sf, pos) {
  const rs = ts.getLeadingCommentRanges(sf.text, pos) || [];
  const tokStart = ts.skipTrivia(sf.text, pos);
  for (let i = rs.length - 1; i >= 0; i--) { const nx = i + 1 < rs.length ? rs[i + 1].pos : tokStart; if ((sf.text.slice(rs[i].end, nx).match(/\n/g) || []).length >= 2) break; const s = commentLine(sf, rs[i]); if (goodComment(s)) return clip(s, 120); if (rs[i].kind === ts.SyntaxKind.MultiLineCommentTrivia) break; }
  return "";
}
function fileSummary(sf) {
  const rs = ts.getLeadingCommentRanges(sf.text, 0) || [];
  const first = sf.statements[0];
  for (const r of rs) {
    const s = commentLine(sf, r); if (!goodComment(s)) continue;
    const gap = sf.text.slice(r.end, first ? first.getStart(sf, false) : sf.text.length);
    if ((gap.match(/\n/g) || []).length >= 2 || !first || ts.isImportDeclaration(first) || ts.isExportDeclaration(first)) return clip(s, 120);
  }
  return "";
}
function testName(stmt, sf) {
  if (!ts.isExpressionStatement(stmt)) return null;
  let e = stmt.expression, first;
  while (ts.isCallExpression(e)) { first = e.arguments[0]; e = e.expression; if (ts.isPropertyAccessExpression(e)) e = e.expression; }
  if (!ts.isIdentifier(e) || !TEST_ROOTS.has(e.text)) return null;
  const a = first ? (ts.isStringLiteralLike(first) ? JSON.stringify(first.text) : first.getText(sf)) : "";
  return clip(e.text + "(" + a + ")", 60);
}
function entriesOf(tree, rel) {
  if (tree.entriesCache.has(rel)) return tree.entriesCache.get(rel);
  const sf = tree.sfOf(rel); const res = { sf, list: [], byId: new Map() };
  tree.entriesCache.set(rel, res);
  if (!sf) return res;
  const test = isTest(rel);
  const add = (name, kind, node, docPos, startNode) => {
    const s = startNode.getStart(sf, true), e = startNode.end;
    let en = res.byId.get(name);
    if (!en) {
      let id = name; en = { id, name, kind, ranges: [], order: res.list.length, doc: docOf(sf, docPos) };
      res.byId.set(name, en); res.list.push(en);
    }
    en.ranges.push([s, e]);
  };
  const addTest = (stmt) => {
    let n = testName(stmt, sf); if (!n) return false;
    let id = n, k = 2; while (res.byId.has(id)) id = n + " (" + k++ + ")";
    const en = { id, name: n, kind: "テスト", ranges: [[stmt.getStart(sf, true), stmt.end]], order: res.list.length, doc: "" };
    res.byId.set(id, en); res.list.push(en); return true;
  };
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st)) add(st.name ? st.name.text : "default", "関数", st, st.getFullStart(), st);
    else if (ts.isClassDeclaration(st)) add(st.name ? st.name.text : "default", "クラス", st, st.getFullStart(), st);
    else if (ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st)) add(st.name.text, "型", st, st.getFullStart(), st);
    else if (ts.isEnumDeclaration(st)) add(st.name.text, "列挙", st, st.getFullStart(), st);
    else if (ts.isModuleDeclaration(st) && ts.isIdentifier(st.name)) add(st.name.text, "名前空間", st, st.getFullStart(), st);
    else if (ts.isVariableStatement(st)) {
      const isConst = (st.declarationList.flags & ts.NodeFlags.Const) !== 0;
      st.declarationList.declarations.forEach((d, i) => {
        const names = []; (function g(n) { if (ts.isIdentifier(n)) names.push(n.text); else if (ts.isObjectBindingPattern(n) || ts.isArrayBindingPattern(n)) n.elements.forEach((el) => { if (ts.isBindingElement(el)) g(el.name); }); })(d.name);
        const init = d.initializer && ts.skipOuterExpressions ? ts.skipOuterExpressions(d.initializer) : d.initializer;
        const kind = init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) ? "関数" : init && ts.isClassExpression(init) ? "クラス" : isConst ? "定数" : "変数";
        for (const nm of names) {
          add(nm, kind, d, i === 0 ? st.getFullStart() : d.getFullStart(), i === 0 ? st : d);
          const en = res.byId.get(nm); const last = en.ranges[en.ranges.length - 1]; if (i > 0) last[0] = d.getStart(sf);
        }
      });
    } else if (ts.isExportAssignment(st)) add("default", "export", st, st.getFullStart(), st);
    else if (test) addTest(st);
  }
  return res;
}
function findEntry(ents, pos, prefer) {
  let first = null;
  for (const en of ents.list) for (const [s, e] of en.ranges) if (pos >= s && pos < e) { if (!prefer || en.name === prefer) return en; first = first || en; }
  return first;
}

// ---------- program + edges ----------
function makeProgram(tree, roots) {
  const host = {
    getSourceFile: (f) => { const r = tree.rel(f); return r == null ? undefined : tree.sfOf(r); },
    getDefaultLibFileName: () => "/lib.d.ts", writeFile() {}, getCurrentDirectory: () => "/repo", getDirectories: () => [],
    fileExists: (f) => { const r = tree.rel(f); return r != null && tree.files.has(r); },
    readFile: (f) => { const r = tree.rel(f); return r == null ? undefined : tree.text(r); },
    getCanonicalFileName: (f) => f, useCaseSensitiveFileNames: () => true, getNewLine: () => "\n",
    directoryExists: (d) => { const r = tree.rel(d.replace(/\/$/, "")); return r != null && (r === "" || tree.files.has(r) || true); },
    realpath: (x) => x,
    resolveModuleNames: (names, containing) => names.map((n) => {
      const c = tree.rel(containing); const r = c == null ? null : tree.resolve(n, c);
      return r ? { resolvedFileName: ROOT + r, extension: ts.Extension ? extOf(r) : ".ts", isExternalLibraryImport: false } : undefined;
    }),
  };
  const extOf = (r) => ({ ".ts": ".ts", ".tsx": ".tsx", ".js": ".js", ".jsx": ".jsx", ".mjs": ".js", ".cjs": ".js", ".mts": ".ts", ".cts": ".ts", ".json": ".json" })[path.posix.extname(r)] || ".ts";
  const options = { allowJs: true, checkJs: false, noEmit: true, noLib: true, types: [], skipLibCheck: true, target: ts.ScriptTarget.ESNext, jsx: ts.JsxEmit.Preserve, resolveJsonModule: true };
  const program = ts.createProgram({ rootNames: roots.map((r) => ROOT + r), options, host });
  return { program, checker: program.getTypeChecker() };
}

function extractEdges(tree, prog, rel) {
  const { program, checker } = prog; const sf = program.getSourceFile(ROOT + rel);
  const out = []; if (!sf) return out;
  const ents = entriesOf(tree, rel);
  const relOf = (sfile) => { const r = tree.rel(sfile.fileName); return r != null && tree.files.has(r) ? r : null; };
  const declTarget = (sym) => {
    if (!sym) return null;
    if (sym.flags & ts.SymbolFlags.Alias) { try { sym = checker.getAliasedSymbol(sym); } catch { return null; } }
    const ds = sym.declarations || []; if (!ds.length) return null;
    const d = ds.find((x) => relOf(x.getSourceFile())) || null; if (!d) return null;
    const f = relOf(d.getSourceFile());
    if (ts.isSourceFile(d)) return { file: f, decl: null, ns: true };
    if (ts.isModuleDeclaration(d) && ts.isStringLiteral(d.name)) return { file: f, decl: null, ns: true };
    const en = findEntry(entriesOf(tree, f), d.getStart(), sym.name);
    return { file: f, decl: en ? en.id : null };
  };
  const moduleTarget = (lit) => { const s = checker.getSymbolAtLocation(lit); const d = s && s.declarations && s.declarations[0]; if (d && ts.isSourceFile(d) && relOf(d)) return { file: relOf(d), decl: null }; const r = tree.resolve(lit.text, rel); return r && tree.files.has(r) ? { file: r, decl: null } : null; };
  const add = (pos, t) => { if (t && t.file !== rel) { const en = pos == null ? null : findEntry(ents, pos); out.push({ sf: rel, sd: en ? en.id : null, tf: t.file, td: t.decl }); } };
  const walk = (n) => {
    if (ts.isIdentifier(n)) {
      const t = declTarget(checker.getSymbolAtLocation(n));
      if (t && t.ns) { const p = n.parent; if (ts.isPropertyAccessExpression(p) && p.expression === n && checker.getSymbolAtLocation(p.name)) return; }
      add(n.getStart(sf), t); return;
    }
    if (ts.isCallExpression(n) && n.arguments.length && ts.isStringLiteralLike(n.arguments[0]) &&
        (n.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(n.expression) && n.expression.text === "require"))) add(n.getStart(sf), moduleTarget(n.arguments[0]));
    if (ts.isImportTypeNode(n) && ts.isLiteralTypeNode(n.argument) && ts.isStringLiteral(n.argument.literal) && !n.qualifier) add(n.getStart(sf), moduleTarget(n.argument.literal));
    ts.forEachChild(n, walk);
  };
  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st)) { if (!st.importClause) add(null, moduleTarget(st.moduleSpecifier)); continue; }
    if (ts.isImportEqualsDeclaration(st)) { if (ts.isExternalModuleReference(st.moduleReference) && ts.isStringLiteral(st.moduleReference.expression)) add(null, moduleTarget(st.moduleReference.expression)); continue; }
    if (ts.isExportDeclaration(st) && st.moduleSpecifier) {
      const mt = moduleTarget(st.moduleSpecifier); if (!mt) continue;
      if (st.exportClause && ts.isNamedExports(st.exportClause)) {
        const ms = checker.getSymbolAtLocation(st.moduleSpecifier); const exps = ms ? checker.getExportsOfModule(ms) : [];
        for (const el of st.exportClause.elements) {
          const nm = (el.propertyName || el.name).text; const s = exps.find((x) => x.name === nm);
          add(null, (s && declTarget(s)) || mt);
        }
      } else add(null, mt);
      continue;
    }
    walk(st);
  }
  return out;
}

// ---------- diff ----------
const diffTok = git(["diff", "--name-status", "-z", "--no-renames", baseC, headC]).split("\0").filter(Boolean);
const config = opt.config ? JSON.parse(fs.readFileSync(opt.config, "utf8")) : {};
const globRe = (g) => new RegExp("^" + g.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*\/|\*\*|\*|\?/g, (m) => (m === "**/" ? "(?:.*/)?" : m === "**" ? ".*" : m === "*" ? "[^/]*" : "[^/]")) + "$");
const DEFAULT_IGNORE = ["**/package-lock.json", "**/pnpm-lock.yaml", "**/yarn.lock", "**/bun.lockb", "**/Cargo.lock", "**/poetry.lock"];
const ignoreRes = [...DEFAULT_IGNORE, ...(config.ignore || [])].map(globRe);
const ignored = (p) => ignoreRes.some((r) => r.test(p));
const zoneDefs = (config.zones || []).map((z) => ({ ...z, res: (z.match || []).map(globRe) }));
const status = new Map();
for (let i = 0; i + 1 < diffTok.length; i += 2) {
  const s = diffTok[i][0], p = diffTok[i + 1]; if (ignored(p)) continue;
  status.set(p, s === "A" ? "A" : s === "D" ? "D" : "M");
}
const changedPaths = [...status.keys()].sort(cmp);
const headTree = makeTree(headC);
const deleted = changedPaths.filter((p) => status.get(p) === "D");
const baseTree = deleted.length || changedPaths.some((p) => status.get(p) === "M") ? makeTree(baseC) : null;
const changedSrc = changedPaths.filter((p) => status.get(p) !== "D" && SRC.test(p) && headTree.files.has(p));
const deletedSrc = deleted.filter((p) => SRC.test(p) && baseTree.files.has(p));
const changedSet = new Set(changedPaths);

// ---------- 1-hop neighbours ----------
const importers = new Map(), importees = new Map();
for (const f of headTree.srcFiles) {
  const t = headTree.text(f); if (t == null) continue;
  const info = ts.preProcessFile(t, true, true);
  const set = new Set();
  for (const m of info.importedFiles) { const r = headTree.resolve(m.fileName, f); if (r && r !== f) set.add(r); }
  importees.set(f, [...set].sort(cmp));
  for (const r of set) { if (!importers.has(r)) importers.set(r, new Set()); importers.get(r).add(f); }
}
const isBarrel = (f) => { const sf = headTree.sfOf(f); return !!sf && sf.statements.length > 0 && sf.statements.every((s) => (ts.isExportDeclaration(s) && s.moduleSpecifier) || ts.isImportDeclaration(s)); };
const impOf = new Map(); const omitted = new Map();
for (const c of changedSrc) {
  const seen = new Set(), q = [c], found = new Set();
  while (q.length) { const x = q.pop(); for (const i of importers.get(x) || []) { if (seen.has(i) || i === c) continue; seen.add(i); found.add(i); if (!changedSet.has(i) && isBarrel(i)) q.push(i); } }
  const list = [...found].filter((i) => !ignored(i)).sort(cmp);
  if (list.length > opt.maxImporters) { omitted.set(c, list); impOf.set(c, []); } else impOf.set(c, list);
}
const neighbours = new Set();
for (const c of changedSrc) { for (const i of impOf.get(c)) neighbours.add(i); for (const i of importees.get(c) || []) if (!ignored(i)) neighbours.add(i); }
const importerSet = new Set(); for (const c of changedSrc) for (const i of impOf.get(c)) if (!changedSet.has(i)) importerSet.add(i);

// ---------- edges ----------
let rawEdges = [];
{
  const roots = [...new Set([...changedSrc, ...importerSet, ...neighbours])].filter((p) => SRC.test(p)).sort(cmp);
  const prog = makeProgram(headTree, roots);
  for (const f of [...changedSrc, ...[...importerSet].sort(cmp)]) {
    const es = extractEdges(headTree, prog, f);
    for (const e of es) if (changedSet.has(e.sf) || changedSet.has(e.tf)) rawEdges.push({ ...e, base: false });
  }
}
if (deletedSrc.length) {
  const prog = makeProgram(baseTree, deletedSrc);
  for (const f of deletedSrc) for (const e of extractEdges(baseTree, prog, f)) rawEdges.push({ ...e, base: true });
}
// validate ends against the tree each file is drawn from, keep file ends that exist
const treeFor = (p) => (status.get(p) === "D" ? baseTree : headTree);
const edgeMap = new Map();
for (const e of rawEdges) {
  if (ignored(e.sf) || ignored(e.tf)) continue;
  const stf = treeFor(e.sf), ttf = treeFor(e.tf);
  if (!stf.files.has(e.sf) || !ttf.files.has(e.tf)) continue;
  let sd = e.sd, td = e.td;
  if (sd != null && !entriesOf(stf, e.sf).byId.has(sd)) sd = null;
  if (td != null && !entriesOf(ttf, e.tf).byId.has(td)) td = null;
  const k = e.sf + "#" + (sd ?? "") + "\0" + e.tf + "#" + (td ?? ""); edgeMap.set(k, { sf: e.sf, sd, tf: e.tf, td });
}
let edges = [...edgeMap.values()];
const hasFn = new Set(edges.filter((e) => e.td != null).map((e) => e.sf + "\0" + (e.sd ?? "") + "\0" + e.tf));
edges = edges.filter((e) => e.td != null || !hasFn.has(e.sf + "\0" + (e.sd ?? "") + "\0" + e.tf));
const anyBetween = new Map(); for (const e of edges) if (e.sd != null || e.td != null) anyBetween.set(e.sf + "\0" + e.tf, 1);
edges = edges.filter((e) => e.sd != null || e.td != null || !anyBetween.has(e.sf + "\0" + e.tf));
const ref = (f, d) => (d == null ? f : f + "#" + d);
edges.sort((a, b) => cmp(ref(a.sf, a.sd), ref(b.sf, b.sd)) || cmp(ref(a.tf, a.td), ref(b.tf, b.td)));

// ---------- touched declarations (diff hunks) ----------
function hunks(p) {
  let out; try { out = git(["diff", "-U0", "--no-renames", "--no-color", baseC, headC, "--", ":(literal)" + p]); } catch { return []; }
  const hs = []; for (const m of out.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) hs.push([Number(m[1]), m[2] === undefined ? 1 : Number(m[2])]);
  return hs;
}
function touchedTags(p) {
  const st = status.get(p), tree = treeFor(p), ents = entriesOf(tree, p), tags = new Map();
  if (st === "D") { for (const en of ents.list) tags.set(en.id, "del"); return tags; }
  if (st === "A") { for (const en of ents.list) tags.set(en.id, "add"); return tags; }
  const hs = hunks(p), sf = ents.sf, baseEnts = baseTree && baseTree.files.has(p) ? entriesOf(baseTree, p) : { byId: new Map() };
  const line = (pos) => sf.getLineAndCharacterOfPosition(pos).line + 1;
  for (const en of ents.list) {
    const touched = en.ranges.some(([s, e]) => { const a = line(s), b = line(Math.max(s, e - 1)); return hs.some(([c, d]) => (d > 0 ? c <= b && c + d - 1 >= a : c >= a && c < b)); });
    if (touched) tags.set(en.id, baseEnts.byId.has(en.id) ? "mod" : "add");
  }
  return tags;
}

// ---------- assemble ----------
const endpoints = new Map(); const addEnd = (f, d) => { if (!endpoints.has(f)) endpoints.set(f, new Set()); if (d != null) endpoints.get(f).add(d); };
for (const e of edges) { addEnd(e.sf, e.sd); addEnd(e.tf, e.td); }
const nodeSet = new Set([...changedPaths, ...neighbours, ...endpoints.keys()]);
for (const p of [...nodeSet]) if (ignored(p)) nodeSet.delete(p);
const MARKS = [{ label: "新規", color: "green", badge: "A" }, { label: "変更", color: "yellow", badge: "M" }, { label: "削除", color: "red", badge: "D" }, { label: "変更なし", color: "gray" }];
const markOf = { A: "新規", M: "変更", D: "削除" };
const zoneOf = (p) => { const z = zoneDefs.find((z) => z.res.some((r) => r.test(p))); return z ? z.id : undefined; };
const files = [];
for (const p of [...nodeSet].sort(cmp)) {
  const st = status.get(p), tree = treeFor(p);
  if (!tree.files.has(p)) continue;
  const f = { path: p, mark: st ? markOf[st] : "変更なし" };
  const z = zoneOf(p); if (z) f.zone = z;
  if (isTest(p)) f.test = true;
  if (SRC.test(p)) {
    const ents = entriesOf(tree, p); const tags = st ? touchedTags(p) : new Map(); const ends = endpoints.get(p) || new Set();
    if (ents.sf) { const s = fileSummary(ents.sf); if (s) f.summary = s; }
    const fns = [];
    for (const en of ents.list) if (tags.has(en.id) || ends.has(en.id)) {
      const o = { name: en.name }; if (en.id !== en.name) o.id = en.id; o.kind = en.kind; if (en.doc) o.note = en.doc; if (tags.has(en.id)) o.tag = tags.get(en.id); fns.push(o);
    }
    if (st === "M" && baseTree && baseTree.files.has(p)) {
      const be = entriesOf(baseTree, p);
      for (const en of be.list) if (!ents.byId.has(en.id)) { const o = { name: en.name }; if (en.id !== en.name) o.id = en.id; o.kind = en.kind; if (en.doc) o.note = en.doc; o.tag = "del"; fns.push(o); }
    }
    if (fns.length) f.fns = fns;
  }
  if (omitted.has(p)) { const l = omitted.get(p); f.extra = l.slice(0, 8).join(", ") + (l.length > 8 ? " …他 " + (l.length - 8) + " 件" : "") + "（import 元が " + l.length + " 件で多いため図から省略）"; }
  files.push(f);
}
const usedZones = new Set(files.map((f) => f.zone));
const zones = zoneDefs.filter((z) => usedZones.has(z.id)).map((z) => ({ id: z.id, label: z.label, color: z.color }));
const usedMarks = MARKS;
const nodePaths = new Set(files.map((f) => f.path));
const edgeList = edges.filter((e) => nodePaths.has(e.sf) && nodePaths.has(e.tf)).map((e) => [ref(e.sf, e.sd), ref(e.tf, e.td)]);

// ---------- notes (text only) ----------
let title = config.title || opt.base + "..." + opt.head;
if (opt.emitNotes) {
  const sk = { $title: title };
  for (const f of files) { sk[f.path] = f.summary || ""; for (const fn of f.fns || []) sk[f.path + "#" + (fn.id || fn.name)] = fn.note || ""; }
  fs.writeFileSync(opt.emitNotes, JSON.stringify(sk, null, 2) + "\n");
}
if (opt.notes) {
  const notes = JSON.parse(fs.readFileSync(opt.notes, "utf8")); const used = new Set();
  if (typeof notes.$title === "string" && notes.$title.trim()) { title = notes.$title.trim(); used.add("$title"); }
  for (const f of files) {
    const s = notes[f.path]; if (typeof s === "string" && s.trim()) { f.summary = s.trim(); used.add(f.path); } else if (f.path in notes) used.add(f.path);
    for (const fn of f.fns || []) { const k = f.path + "#" + (fn.id || fn.name); const n = notes[k]; if (typeof n === "string" && n.trim()) { fn.note = n.trim(); } if (k in notes) used.add(k); }
  }
  for (const k of Object.keys(notes)) if (!used.has(k)) console.error("notes: unknown key ignored: " + k);
}
// keep key order stable after notes were applied
const ordered = files.map((f) => { const o = { path: f.path, mark: f.mark }; for (const k of ["zone", "test", "summary", "extra"]) if (f[k] !== undefined) o[k] = f[k]; if (f.fns) o.fns = f.fns.map((x) => { const q = { name: x.name }; if (x.id) q.id = x.id; q.kind = x.kind; if (x.note) q.note = x.note; if (x.tag) q.tag = x.tag; return q; }); return o; });

const DATA = { title, marks: usedMarks, ...(zones.length ? { zones } : {}), tagSymbols: { add: "＋", mod: "〜", del: "−" }, files: ordered, edges: edgeList };
const J = (v) => JSON.stringify(v).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
const body = "var DATA = {\n  title: " + J(DATA.title) + ",\n  marks: " + J(DATA.marks) + ",\n" + (zones.length ? "  zones: " + J(DATA.zones) + ",\n" : "") +
  "  tagSymbols: " + J(DATA.tagSymbols) + ",\n  files: [\n" + ordered.map((f) => "    " + J(f)).join(",\n") + "\n  ],\n  edges: [\n" + edgeList.map((e) => "    " + J(e)).join(",\n") + "\n  ]\n};";
let tpl = fs.readFileSync(path.join(HERE, "template.html"), "utf8");
const bi = tpl.indexOf("/* DATA:BEGIN"), ei = tpl.indexOf("/* DATA:END */");
if (bi < 0 || ei < 0) throw new Error("template.html has no DATA markers");
tpl = tpl.slice(0, bi) + "/* DATA:BEGIN (generated by gen.mjs) */\n" + body + "\n" + tpl.slice(ei);
tpl = tpl.replace(/rightDir: "[^"]*"/, () => "rightDir: " + J(opt.right));
fs.writeFileSync(opt.out, tpl);
console.error(`${opt.out}: ${ordered.length} files, ${ordered.reduce((a, f) => a + (f.fns || []).length, 0)} functions, ${edgeList.length} edges (base ${baseC.slice(0, 8)}, head ${headC.slice(0, 8)})`);
