const fs = require('fs');
const path = require('path');

function findRoutes(dir) {
  const results = [];
  const files = fs.readdirSync(dir);
  files.forEach((f) => {
    const p = path.join(dir, f);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      results.push(...findRoutes(p));
    } else if (f.endsWith('.routes.js')) {
      results.push(p);
    }
  });
  return results;
}

function extractControllerPath(routeContent, routeFile) {
  const m = routeContent.match(/require\(['"](.*?\.controller.*?)['"]\)/);
  if (!m) return null;
  let rel = m[1];
  // Resolve relative to routeFile
  return path.resolve(path.dirname(routeFile), rel);
}

function extractControllerRefs(routeContent) {
  const refs = new Set();
  const re = /controller\.([a-zA-Z0-9_]+)/g;
  let m;
  while ((m = re.exec(routeContent))) {
    refs.add(m[1]);
  }
  // also other named imports, e.g. const { a, b } = require('./x.controller')
  const m2 = routeContent.match(/const\s*\{([^}]+)\}\s*=\s*require\(['"][^']*controller['"]\)/);
  if (m2) {
    m2[1].split(',').map(s=>s.trim()).forEach(s=>{ if (s) refs.add(s); });
  }
  return Array.from(refs);
}

function extractExports(controllerContent) {
  const exports = new Set();
  // match module.exports = { ... }
  const m = controllerContent.match(/module\.exports\s*=\s*\{([\s\S]*?)\};?/);
  if (m) {
    const body = m[1];
    body.split(',').forEach(part => {
      const name = part.replace(/\/\*.*?\*\//g, '').trim().split(':')[0].trim();
      if (name) exports.add(name);
    });
  }
  // also named exports via exports.foo =
  const re = /exports\.([a-zA-Z0-9_]+)\s*=/g;
  let mm;
  while ((mm = re.exec(controllerContent))) exports.add(mm[1]);
  return Array.from(exports);
}

const base = path.resolve(__dirname, '..', 'src', 'Entities');
const routes = findRoutes(base);
let issues = [];

routes.forEach(routeFile => {
  const content = fs.readFileSync(routeFile, 'utf8');
  const refs = extractControllerRefs(content);
  const ctrlPathResolved = extractControllerPath(content, routeFile);
  if (!ctrlPathResolved) return;
  // try with .js
  let ctrlFile = ctrlPathResolved;
  if (!fs.existsSync(ctrlFile) && fs.existsSync(ctrlFile + '.js')) ctrlFile = ctrlFile + '.js';
  if (!fs.existsSync(ctrlFile)) {
    issues.push({ type: 'missing-controller', route: routeFile, controller: ctrlFile });
    return;
  }
  const ctrlContent = fs.readFileSync(ctrlFile, 'utf8');
  const exports = extractExports(ctrlContent);
  refs.forEach(r => {
    if (!exports.includes(r)) {
      issues.push({ type: 'missing-export', route: routeFile, controller: ctrlFile, ref: r, exports });
    }
  });
});

if (issues.length === 0) {
  console.log('No mismatches found.');
  process.exit(0);
}

console.log('Mismatches found:');
issues.forEach(it => {
  if (it.type === 'missing-controller') {
    console.log(`- Route ${it.route} requires controller file not found: ${it.controller}`);
  } else {
    console.log(`- Route ${it.route} references '${it.ref}' but controller ${it.controller} exports: [${it.exports.join(', ')}]`);
  }
});
process.exit(1);
