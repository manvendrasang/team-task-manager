/* Real-browser UI tests against the production build. */
const { MongoMemoryServer } = require('mongodb-memory-server');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer');

const path = require('path');
const REPO = path.resolve(__dirname, '..');
const PORT = 5231;
const BASE = `http://127.0.0.1:${PORT}`;

let pass = 0;
const failures = [];
const check = (name, cond, extra) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { failures.push(name); console.log(`  ✗ ${name}${extra !== undefined ? ` -> ${String(extra).slice(0, 300)}` : ''}`); }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri('taskflow_ui');

  const server = spawn(process.execPath, ['server/index.js'], {
    cwd: REPO,
    env: { ...process.env, MONGO_URI: uri, JWT_SECRET: 'ui-secret-0123456789abcdef', PORT: String(PORT), NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (let i = 0; i < 120; i++) {
    try { const r = await fetch(BASE + '/health'); if (r.ok) break; } catch {}
    await sleep(200);
  }

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

  // React's dev warnings and the CRA runtime banner are noise here.
  const realErrors = () => consoleErrors.filter(
    (t) => !/favicon|Download the React DevTools|source-map/i.test(t)
  );

  const text = () => page.evaluate(() => document.body.innerText);
  const clickByText = async (selector, needle) => {
    const handle = await page.evaluateHandle((sel, n) => {
      const el = [...document.querySelectorAll(sel)].find((e) => e.innerText.trim().includes(n));
      if (el) el.click();
      return el;
    }, selector, needle);
    return handle;
  };

  try {
    console.log('\n== registration + login ==');
    await page.goto(BASE + '/register', { waitUntil: 'networkidle0' });
    check('register page renders', (await text()).includes('Create account'));

    // Client-side password rules should gate submit
    const disabledEarly = await page.$eval('.auth-submit', (b) => b.disabled);
    check('submit disabled until password rules met', disabledEarly === true);

    await page.type('#reg-name', 'Ada Admin');
    await page.type('#reg-email', 'ADA@Example.com');
    await page.type('#reg-password', 'Passw0rd1');
    await page.type('#reg-confirm', 'Passw0rd1');
    await sleep(200);
    const rulesMet = await page.$$eval('.password-rules li', (ls) => ls.every((l) => l.className === 'met'));
    check('password rule checklist ticks off', rulesMet === true);
    await page.click('.auth-submit');
    try {
      await page.waitForFunction(() => location.pathname === '/dashboard', { timeout: 15000 });
      check('registration redirects to dashboard', true);
    } catch {
      check('registration redirects to dashboard', false, {
        url: page.url(),
        body: (await text()).slice(0, 300),
      });
    }

    console.log('\n== theme ==');
    // The shell renders inside a lazy Suspense boundary, so wait for it.
    await page.waitForSelector('.theme-toggle', { timeout: 15000 });
    const themeBefore = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    await page.click('.theme-toggle');
    await sleep(300);
    const themeAfter = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    check('theme toggles and persists', themeBefore !== themeAfter, { themeBefore, themeAfter });
    await page.click('.theme-toggle');
    await sleep(200);

    console.log('\n== project creation via the UI ==');
    await page.click('a[href="/projects"]');
    await page.waitForSelector('.project-list-page', { timeout: 10000 });
    check('empty state shown', (await text()).includes('No projects yet'));

    await clickByText('button', 'Create Project');
    await page.waitForSelector('#new-proj-name', { timeout: 5000 });
    await page.type('#new-proj-name', 'Apollo Program');
    await page.type('#new-proj-desc', 'Get to the moon');
    check('modal traps focus inside dialog', await page.evaluate(() => document.activeElement?.getAttribute('aria-label') === 'Close dialog' || !!document.activeElement?.closest('.modal')));

    // Escape should close the modal (new behaviour)
    await page.keyboard.press('Escape');
    await sleep(300);
    const modalGone = await page.$('#new-proj-name');
    check('NEW: Escape closes the modal', modalGone === null);

    await clickByText('button', 'Create Project');
    await page.waitForSelector('#new-proj-name', { timeout: 5000 });
    await page.type('#new-proj-name', 'Apollo Program');
    await page.type('#new-proj-desc', 'Get to the moon');
    await clickByText('.modal button', 'Create Project');
    await sleep(1500);
    // Guards the focus-stealing regression: every typed character must survive.
    check('BUGFIX: all typed characters are kept in modal inputs', (await text()).includes('Apollo Program'),
      await page.evaluate(() => document.querySelector('.project-card-title')?.innerText));
    check('BUGFIX: multiline input keeps all characters', (await text()).includes('Get to the moon'),
      await page.evaluate(() => document.querySelector('.project-card-desc')?.innerText));

    console.log('\n== warnings recipient inbox ==');
    await page.click('a[href="/warnings"]');
    await page.waitForSelector('.my-warnings-page', { timeout: 10000 });
    check('NEW: warnings page reachable from nav', (await text()).includes('Warnings'));
    await page.waitForFunction(
      () => document.querySelector('.my-warnings-page')?.innerText.includes('No open warnings'),
      { timeout: 10000 }
    ).catch(() => {});
    check('NEW: empty inbox for a user with none', (await text()).includes('No open warnings'),
      await page.evaluate(() => document.querySelector('.my-warnings-page')?.innerText?.slice(0, 120)));

    console.log('\n== 404 route (previously a blank page) ==');
    await page.goto(BASE + '/this-does-not-exist', { waitUntil: 'networkidle0' });
    const nf = await text();
    check('NEW: unknown URL renders a 404 page, not a blank screen', nf.includes('404') && nf.includes('Page not found'), nf.slice(0, 120));
    check('NEW: 404 page offers a way back', nf.includes('Back to dashboard'));

    console.log('\n== auth redirect ==');
    await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle0' });
    check('session persists across reload (not logged out)', (await text()).includes('Good'), (await text()).slice(0, 80));

    console.log('\n== mobile layout (no media queries existed before) ==');
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle0' });
    await sleep(500);
    const menuVisible = await page.evaluate(() => {
      const b = document.querySelector('.mobile-menu-btn');
      return b ? getComputedStyle(b).display !== 'none' : false;
    });
    check('NEW: hamburger menu visible on mobile', menuVisible === true);

    await page.click('.mobile-menu-btn');
    await sleep(500);
    const drawerOpen = await page.evaluate(() => {
      const s = document.querySelector('.sidebar');
      return s ? s.getBoundingClientRect().left >= 0 : false;
    });
    check('NEW: sidebar drawer opens on mobile', drawerOpen === true);

    const noHScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2);
    check('NEW: no horizontal overflow on mobile', noHScroll === true,
      await page.evaluate(() => `${document.documentElement.scrollWidth} vs ${window.innerWidth}`));

    console.log('\n== console cleanliness ==');
    const errs = realErrors();
    check('NEW: no uncaught console errors during the run', errs.length === 0, errs.slice(0, 3));
  } catch (err) {
    console.error('HARNESS ERROR', err.message);
    failures.push('harness: ' + err.message);
    await page.screenshot({ path: '/tmp/opencode/mem/fail.png' }).catch(() => {});
  }

  console.log(`\n================ ${pass} passed, ${failures.length} failed ================`);
  if (failures.length) console.log('FAILURES:\n - ' + failures.join('\n - '));

  await browser.close();
  server.kill();
  await mongo.stop();
  process.exit(failures.length ? 1 : 0);
})();