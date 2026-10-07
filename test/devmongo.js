/* Verifies `npm run dev`: real Mongo, real backend, real Vite dev server. */
const { MongoMemoryServer } = require('mongodb-memory-server');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer');
const fs = require('fs');

const path = require('path');
const REPO = path.resolve(__dirname, '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0; const failures = [];
const check = (n, c, x) => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { failures.push(n); console.log(`  ✗ ${n}${x !== undefined ? ` -> ${String(x).slice(0, 200)}` : ''}`); }
};

(async () => {
  const mongo = await MongoMemoryServer.create({ instance: { port: 27017, dbName: 'devtest' } });

  const dev = spawn('npm', ['run', 'dev'], {
    cwd: REPO,
    detached: true,
    env: {
      ...process.env,
      MONGO_URI: mongo.getUri('devtest'),
      JWT_SECRET: 'dev-secret-0123456789abcdef',
      PORT: '5000',
      NODE_ENV: 'development',
      CLIENT_ORIGIN: 'http://localhost:3000',
    },
    stdio: 'ignore',
  });

  const stop = async () => {
    try { process.kill(-dev.pid, 'SIGKILL'); } catch {}
    await sleep(800);
    await mongo.stop();
  };

  try {
    let up = false;
    for (let i = 0; i < 150; i++) {
      try { const r = await fetch('http://localhost:5000/health'); if (r.ok) { up = true; break; } } catch {}
      await sleep(200);
    }
    check('backend boots under npm run dev', up);
    check('vite dev server responds', (await fetch('http://localhost:3000/')).status === 200);

    const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const p = await b.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
    p.on('console', (m) => {
      if (m.type() !== 'error') return;
      const text = m.text();
      // The unauthenticated /api/auth/me probe below legitimately 401s, and
      // a missing favicon is noise.
      if (/401 \(Unauthorized\)/.test(text)) return;
      errs.push(`${text} @ ${m.location()?.url || '?'}`);
    });

    await p.goto('http://localhost:3000/register', { waitUntil: 'networkidle0' });
    await p.type('#reg-name', 'Dev User');
    await p.type('#reg-email', 'dev@x.com');
    await p.type('#reg-password', 'Passw0rd1');
    await p.type('#reg-confirm', 'Passw0rd1');
    await p.click('.auth-submit');

    let ok = true;
    try { await p.waitForFunction(() => location.pathname === '/dashboard', { timeout: 20000 }); }
    catch { ok = false; }
    check('dev proxy + auth works end to end', ok, await p.evaluate(() => document.body.innerText.slice(0, 120)));

    await p.waitForSelector('.theme-toggle', { timeout: 10000 }).catch(() => {});
    check('dev shell renders', !!(await p.$('.theme-toggle')));

    // Vite must proxy /api, not serve index.html for it
    const proxied = await p.evaluate(async () => {
      const r = await fetch('/api/auth/me');
      return { status: r.status, type: r.headers.get('content-type') };
    });
    check('vite proxies /api to express (JSON, not HTML)',
      proxied.status === 401 && String(proxied.type).includes('application/json'), proxied);

    // HMR: touching a source file should recompile without killing the server
    const css = REPO + '/client/src/index.css';
    const original = fs.readFileSync(css, 'utf8');
    fs.appendFileSync(css, '\n/* hmr probe */\n');
    await sleep(5000);
    check('vite HMR keeps serving after a source edit', (await fetch('http://localhost:3000/')).status === 200);
    fs.writeFileSync(css, original);
    await sleep(1500);

    const realErrs = errs.filter((e) => !/DevTools|favicon|source-map|HMR|hmr/i.test(e));
    check('no console errors in dev mode', realErrs.length === 0, realErrs.slice(0,3));

    await b.close();
  } catch (err) {
    failures.push('harness: ' + err.message);
    console.error('HARNESS ERROR', err.message);
  }

  console.log(`\n================ ${pass} passed, ${failures.length} failed ================`);
  if (failures.length) console.log('FAILURES:\n - ' + failures.join('\n - '));
  await stop();
  process.exit(failures.length ? 1 : 0);
})();