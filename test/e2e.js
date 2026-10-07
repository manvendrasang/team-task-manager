/* End-to-end test: production build served by the real server + headless browser. */
const { MongoMemoryServer } = require('mongodb-memory-server');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const REPO = path.resolve(__dirname, '..');
const PORT = 5211;
const BASE = `http://127.0.0.1:${PORT}`;

let pass = 0;
const failures = [];
const check = (name, cond, extra) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { failures.push(name); console.log(`  ✗ ${name}${extra !== undefined ? ` -> ${JSON.stringify(extra).slice(0, 400)}` : ''}`); }
};

const req = async (method, url, { token, body } = {}) => {
  const res = await fetch(BASE + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
};

(async () => {
  const mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri('taskflow_e2e');

  const server = spawn(process.execPath, ['server/index.js'], {
    cwd: REPO,
    env: { ...process.env, MONGO_URI: uri, JWT_SECRET: 'e2e-secret-0123456789abcdef', PORT: String(PORT), NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  server.stdout.on('data', (d) => { log += d; });
  server.stderr.on('data', (d) => { log += d; });

  for (let i = 0; i < 120; i++) {
    try { const r = await fetch(BASE + '/health'); if (r.ok) break; } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }

  try {
    console.log('\n== production static serving ==');
    const html = await fetch(BASE + '/');
    const htmlText = await html.text();
    check('GET / serves the SPA', html.status === 200 && htmlText.includes('<div id="root">'), html.status);
    check('CSP header set in production', !!html.headers.get('content-security-policy'));

    // Regression: the old catch-all returned index.html for unknown API routes.
    const api404 = await fetch(BASE + '/api/does-not-exist');
    const api404Text = await api404.text();
    check('BUGFIX: unknown /api route returns JSON 404, not the SPA',
      api404.status === 404 && !api404Text.includes('<div id="root">'), { status: api404.status, sniff: api404Text.slice(0, 80) });
    check('BUGFIX: unknown /api 404 is JSON', api404.headers.get('content-type')?.includes('application/json'), api404.headers.get('content-type'));

    const deep = await fetch(BASE + '/projects/abc123');
    const deepText = await deep.text();
    check('deep link still serves the SPA (client routing)', deep.status === 200 && deepText.includes('<div id="root">'));

    console.log('\n== the previously-broken client flows, over the real API ==');

    // The original report's bug #2: after adding a member the admin lost admin
    // controls because the response lacked userRole.
    const ada = await req('POST', '/api/auth/register', { body: { name: 'Ada Admin', email: 'ada@x.com', password: 'Passw0rd1' } });
    const grace = await req('POST', '/api/auth/register', { body: { name: 'Grace Member', email: 'grace@x.com', password: 'Passw0rd1' } });
    const adaTok = ada.data.token, graceTok = grace.data.token, graceId = grace.data._id;

    const proj = await req('POST', '/api/projects', { token: adaTok, body: { name: 'Apollo', color: '#7e72f2' } });
    const projId = proj.data._id;
    check('project created with userRole=admin', proj.data.userRole === 'admin', proj.data?.userRole);

    // UI reads `data.userRole` after this call to decide whether to show admin
    // buttons. Previously it came back undefined.
    const addRes = await req('POST', `/api/projects/${projId}/members`, { token: adaTok, body: { email: 'grace@x.com' } });
    check('BUGFIX: add-member response keeps admin UI working', addRes.data.userRole === 'admin', addRes.data?.userRole);
    check('BUGFIX: add-member response populates owner for the owner check',
      addRes.data.owner && typeof addRes.data.owner === 'object', addRes.data?.owner);

    const removeRes = await req('DELETE', `/api/projects/${projId}/members/${graceId}`, { token: adaTok });
    check('BUGFIX: remove-member response keeps userRole', removeRes.data.userRole === 'admin', removeRes.data?.userRole);
    await req('POST', `/api/projects/${projId}/members`, { token: adaTok, body: { email: 'grace@x.com' } });

    // Project edit UI (feature gap E): description/status/dueDate/colour
    const editRes = await req('PUT', `/api/projects/${projId}`, {
      token: adaTok, body: { description: 'Edited desc', status: 'active', color: '#34d3a0', dueDate: '2030-06-01' },
    });
    check('NEW: project edit persists all fields',
      editRes.data.description === 'Edited desc' && editRes.data.color === '#34d3a0' && editRes.data.dueDate,
      editRes.data);

    console.log('\n== warnings recipient inbox (feature gap E) ==');
    const t1 = await req('POST', '/api/tasks', { token: adaTok, body: { title: 'Ship it', project: projId, dueDate: '2020-01-01' } });
    const w = await req('POST', `/api/projects/${projId}/warnings`, {
      token: adaTok, body: { issuedTo: graceId, task: t1.data._id, message: 'Repeatedly late', severity: 'severe' },
    });
    check('warning issued', w.status === 201, w.data);

    // Previously the warned user had no way to see warnings about them.
    const inbox = await req('GET', '/api/warnings', { token: graceTok });
    check('NEW: recipient can see warnings about them', inbox.status === 200 && inbox.data.length === 1, inbox.data?.length);
    check('NEW: inbox includes the issuing project', inbox.data?.[0]?.project?.name === 'Apollo', inbox.data?.[0]?.project);
    check('NEW: inbox flags non-admins as !canManage', inbox.data?.[0]?.canManage === false, inbox.data?.[0]?.canManage);

    const otherInbox = await req('GET', '/api/warnings', { token: adaTok });
    check('NEW: issuing admin inbox is empty', otherInbox.data.length === 0, otherInbox.data?.length);

    // The recipient closing out their own warning
    const resolved = await req('PATCH', `/api/warnings/${w.data._id}/resolve`, { token: graceTok, body: { resolved: true } });
    check('NEW: recipient can resolve their own warning', resolved.status === 200 && resolved.data.resolved === true, resolved.data);

    const openOnly = await req('GET', '/api/warnings?resolved=false', { token: graceTok });
    check('NEW: inbox filter by resolved works', openOnly.data.length === 0, openOnly.data?.length);

    const bob = await req('POST', '/api/auth/register', { body: { name: 'Bob Outsider', email: 'bob@x.com', password: 'Passw0rd1' } });
    const bobInbox = await req('GET', '/api/warnings', { token: bob.data.token });
    check('NEW: outsiders see nothing in their inbox', bobInbox.data.length === 0);

    console.log('\n== profile update (dead endpoint now wired up) ==');
    const prof = await req('PUT', '/api/users/profile', { token: adaTok, body: { name: 'Ada Renamed' } });
    check('profile rename works', prof.data.name === 'Ada Renamed', prof.data);

    console.log('\n== auth failure does not nuke the session ==');
    const badLogin = await req('POST', '/api/auth/login', { body: { email: 'ada@x.com', password: 'WrongPass1' } });
    check('bad login is 401', badLogin.status === 401);
    check('bad login message is user-friendly', /invalid email or password/i.test(badLogin.data.message), badLogin.data);
    const stillValid = await req('GET', '/api/auth/me', { token: adaTok });
    check('existing token still works after a failed login', stillValid.status === 200, stillValid.data);

    console.log('\n== SPA assets ==');
    const buildDir = path.join(REPO, 'client/build/assets');
    const chunks = fs.readdirSync(buildDir).filter((f) => f.endsWith('.js'));
    check('code splitting produced multiple chunks', chunks.length >= 3, chunks.length);
    const html2 = await (await fetch(BASE + '/')).text();
    check('index.html references the main bundle', /index-[A-Za-z0-9_-]+\.js/.test(html2));

    console.log('\n== graceful health semantics ==');
    const health = await req('GET', '/health');
    check('health reports db connected', health.data.db === 'connected', health.data);

    if (failures.length === 0) console.log('\nserver log:\n' + log.split('\n').filter((l) => /✅|🚀/.test(l)).join('\n'));
  } catch (err) {
    console.error('HARNESS ERROR', err);
    failures.push('harness: ' + err.message);
  }

  console.log(`\n================ ${pass} passed, ${failures.length} failed ================`);
  if (failures.length) console.log('FAILURES:\n - ' + failures.join('\n - '));
  server.kill();
  await mongo.stop();
  process.exit(failures.length ? 1 : 0);
})();