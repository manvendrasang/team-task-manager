/*
 * Verifies the README's documented local flow end to end.
 *
 * Expects to be running:
 *   npm run dev:local     (terminal 1 - temporary MongoDB + API on :5000)
 *   npm run client        (terminal 2 - Vite dev server on :3000)
 */
const puppeteer = require('puppeteer');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0; const failures = [];
const check = (n, c, x) => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { failures.push(n); console.log(`  ✗ ${n}${x !== undefined ? ` -> ${String(x).slice(0, 200)}` : ''}`); }
};

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 950 });
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (/401 \(Unauthorized\)/.test(m.text())) return;
    
    errs.push(m.text());
  });

  try {
    console.log('\n== the README quick-start path ==');
    await page.goto('http://localhost:3000/register', { waitUntil: 'networkidle0' });
    check('app is served at :3000', (await page.evaluate(() => document.body.innerText)).includes('Create account'));

    await page.type('#reg-name', 'Read Me Tester');
    await page.type('#reg-email', `readme+${Date.now()}@test.local`);
    await page.type('#reg-password', 'Passw0rd1');
    await page.type('#reg-confirm', 'Passw0rd1');
    await page.click('.auth-submit');
    await page.waitForFunction(() => location.pathname === '/dashboard', { timeout: 25000 });
    check('signup against the temporary MongoDB works', true);

    await page.waitForSelector('.theme-toggle', { timeout: 15000 });

    // Exercise a write so we know the temp DB is actually persisting.
    await page.goto('http://localhost:3000/projects', { waitUntil: 'networkidle0' });
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /Create Project/.test(b.innerText)).click());
    await page.waitForSelector('#new-proj-name', { timeout: 10000 });
    await page.type('#new-proj-name', 'README Check');
    await page.evaluate(() => [...document.querySelectorAll('.modal button')].find((b) => /Create Project/.test(b.innerText)).click());
    await sleep(2000);
    check('can create a project (writes are landing in the temp DB)',
      (await page.evaluate(() => document.body.innerText)).includes('README Check'));

    const health = await (await fetch('http://localhost:5000/health')).json();
    check('GET /health reports a connected database', health.status === 'ok' && health.db === 'connected', health);

    const real = errs.filter((e) => !/DevTools|favicon|source-map/i.test(e));
    check('no console errors on the documented path', real.length === 0, real.slice(0, 3));
  } catch (err) {
    failures.push('harness: ' + err.message);
    console.error('HARNESS ERROR', err.message);
  }

  console.log(`\n================ ${pass} passed, ${failures.length} failed ================`);
  if (failures.length) console.log('FAILURES:\n - ' + failures.join('\n - '));
  await browser.close();
  process.exit(failures.length ? 1 : 0);
})();