/* Member-role UI paths: the flows most likely to be silently broken. */
const { MongoMemoryServer } = require('mongodb-memory-server');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer');

const path = require('path');
const REPO = path.resolve(__dirname, '..');
const PORT = 5311;
const BASE = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0; const failures = [];
const check = (n, c, x) => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else {
    failures.push(n);
    console.log(`  ✗ ${n}${x !== undefined ? ` -> ${JSON.stringify(x).slice(0, 250)}` : ''}`);
  }
};

const api = async (m, u, { token, body } = {}) => {
  const r = await fetch(BASE + u, {
    method: m,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let d = null; try { d = await r.json(); } catch {}
  return { status: r.status, data: d };
};

(async () => {
  const mongo = await MongoMemoryServer.create();
  const server = spawn(process.execPath, ['server/index.js'], {
    cwd: REPO,
    env: { ...process.env, MONGO_URI: mongo.getUri('member'), JWT_SECRET: 'member-secret-0123456789abcdef', PORT: String(PORT), NODE_ENV: 'production' },
    stdio: 'ignore',
  });
  for (let i = 0; i < 150; i++) {
    try { const r = await fetch(BASE + '/health'); if (r.ok) break; } catch {}
    await sleep(200);
  }

  const admin = (await api('POST', '/api/auth/register', { body: { name: 'Ada Admin', email: 'ada@x.com', password: 'Passw0rd1' } })).data;
  const member = (await api('POST', '/api/auth/register', { body: { name: 'Mel Member', email: 'mel@x.com', password: 'Passw0rd1' } })).data;
  const proj = (await api('POST', '/api/projects', { token: admin.token, body: { name: 'Shared Project' } })).data;
  await api('POST', `/api/projects/${proj._id}/members`, { token: admin.token, body: { email: 'mel@x.com' } });
  const task = (await api('POST', '/api/tasks', { token: admin.token, body: { title: 'Admin Task', project: proj._id, priority: 'high' } })).data;

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

  const signIn = async (page, email) => {
    await page.goto(BASE + '/login', { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.clear());
    await page.goto(BASE + '/login', { waitUntil: 'networkidle0' });
    await page.type('#login-email', email);
    await page.type('#login-password', 'Passw0rd1');
    await page.click('.auth-submit');
    await page.waitForFunction(() => location.pathname === '/dashboard', { timeout: 20000 });
    await page.waitForSelector('.theme-toggle', { timeout: 15000 });
  };

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 950 });
    const errs = [];
    page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/401 \(Unauthorized\)/.test(m.text())) errs.push(m.text()); });

    console.log('\n== member signs in (mixed-case email) ==');
    await signIn(page, 'MEL@X.com');
    check('BUGFIX: member can sign in with a mixed-case email', page.url().includes('/dashboard'), page.url());

    await page.goto(`${BASE}/projects/${proj._id}`, { waitUntil: 'networkidle0' });
    await sleep(2500);
    await page.waitForSelector('.project-detail-page', { timeout: 25000 }).catch(async()=>{console.log('URL:',page.url());console.log('BODY:',(await page.evaluate(()=>document.body.innerText)).slice(0,300));});
    await sleep(800);

    console.log('\n== admin-only controls are hidden from a member ==');
    check('member sees no Delete project button', !(await page.$$eval('.project-detail-actions button', (bs) => bs.map((b) => b.innerText))).some((t) => /Delete/i.test(t)));
    check('member sees no Warn button', !(await page.$$eval('.project-detail-actions button', (bs) => bs.map((b) => b.innerText))).some((t) => /Warn/i.test(t)));
    check('member sees no Edit project button', !(await page.$$eval('.project-detail-actions button', (bs) => bs.map((b) => b.innerText))).some((t) => /^Edit$/.test(t.trim())));
    check('member can still create a task', !!(await page.$('.project-detail-actions .btn-primary')));

    console.log('\n== member editing a task ==');
    const cards = await page.$$('.task-card');
    check('task card rendered for the member', cards.length >= 1, cards.length);
    check('member sees no expedite button', !(await page.$('[title="Expedite task"]')));
    check('member sees no delete-task button', !(await page.$('[title="Delete task"]')));
    check('member CAN see the status dropdown', !!(await page.$('.task-status-select')));

    // Opening the edit modal as a member must disable admin-only fields and
    // must NOT send them (server now rejects them).
    const editBtn = await page.$('.task-action-btn');
    if (editBtn) {
      await editBtn.click();
      await page.waitForSelector('#task-title', { timeout: 8000 });
      check('member edit modal locks the title field', await page.$eval('#task-title', (el) => el.disabled));
      check('member edit modal locks the description field', await page.$eval('#task-desc', (el) => el.disabled));
      check('member edit modal leaves status editable', !(await page.$eval('#task-status', (el) => el.disabled)));
      check('member edit modal leaves assignee editable', !(await page.$eval('#task-assignee', (el) => el.disabled)));

      // Assign to yourself and change status: the two things members may do.
      await page.select('#task-assignee', member._id);
      await page.select('#task-status', 'in-progress');
      await sleep(500);
      // The first footer button is Cancel — click the submit by label.
      await page.evaluate(() => {
        [...document.querySelectorAll('.task-modal-footer button')]
          .find((b) => /Update|Create/.test(b.innerText)).click();
      });
      await sleep(2000);

      const after = await api('GET', `/api/tasks/${task._id}`, { token: admin.token });
      check('member can assign a task to themselves',
        String(after.data.assignee?._id) === String(member._id),
        { got: after.data.assignee?._id, want: member._id });
      check('member can move a task status', after.data.status === 'in-progress', after.data?.status);
      check('BUGFIX: member edit did not blank the title', after.data.title === 'Admin Task', after.data?.title);
      check('BUGFIX: member edit did not change priority', after.data.priority === 'high', after.data?.priority);
      check('no error toast from the member save', !/only project admins/i.test(await page.evaluate(() => document.body.innerText)));
    }

    console.log('\n== members tab hides owner remove button ==');
    const memberTab = await page.evaluateHandle(() => [...document.querySelectorAll('.detail-tab')].find((t) => t.innerText.includes('Members')));
    await memberTab.asElement().click();
    await sleep(600);
    const memberRows = await page.$$eval('.member-row', (rows) => rows.map((r) => r.innerText));
    check('both members listed', memberRows.length === 2, memberRows);
    check('owner row shows the owner tag', memberRows.some((r) => /owner/i.test(r)), memberRows);
    check('member cannot see Remove buttons at all', !memberRows.some((r) => /Remove/i.test(r)), memberRows);

    console.log('\n== warnings tab is read-only for a member ==');
    const warnTab = await page.evaluateHandle(() => [...document.querySelectorAll('.detail-tab')].find((t) => t.innerText.includes('Warnings')));
    await warnTab.asElement().click();
    await sleep(600);
    check('member sees no "Issue New Warning" button', !/Issue New Warning/.test(await page.evaluate(() => document.body.innerText)));

    console.log('\n== my tasks reflects the assignment ==');
    await page.goto(BASE + '/my-tasks', { waitUntil: 'networkidle0' });
    await sleep(900);
    check('assigned task appears in My Tasks', /Admin Task/.test(await page.evaluate(() => document.body.innerText)));

    const realErrs = errs.filter((e) => !/DevTools|favicon|source-map/i.test(e));
    check('no console errors during member flows', realErrs.length === 0, realErrs.slice(0, 3));

    await browser.close();
  } catch (err) {
    failures.push('harness: ' + err.message);
    console.error('HARNESS ERROR', err.message);
  }

  console.log(`\n================ ${pass} passed, ${failures.length} failed ================`);
  if (failures.length) console.log('FAILURES:\n - ' + failures.join('\n - '));
  server.kill();
  await mongo.stop();
  process.exit(failures.length ? 1 : 0);
})();