/* Deep RBAC matrix: every role against every privileged action. */
const { MongoMemoryServer } = require('mongodb-memory-server');
const { spawn } = require('child_process');

const path = require('path');
const REPO = path.resolve(__dirname, '..');
const PORT = 5301;
const BASE = `http://127.0.0.1:${PORT}`;

let pass = 0; const failures = [];
const check = (n, c, x) => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { failures.push(n); console.log(`  ✗ ${n}${x !== undefined ? ` -> ${JSON.stringify(x).slice(0, 250)}` : ''}`); }
};

const req = async (m, u, { token, body } = {}) => {
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
    env: { ...process.env, MONGO_URI: mongo.getUri('rbac'), JWT_SECRET: 'rbac-secret-0123456789abcdef', PORT: String(PORT), NODE_ENV: 'development' },
    stdio: 'ignore',
  });
  for (let i = 0; i < 150; i++) {
    try { const r = await fetch(BASE + '/health'); if (r.ok) break; } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }

  const mk = async (n, e) => (await req('POST', '/api/auth/register', { body: { name: n, email: e, password: 'Passw0rd1' } })).data;

  try {
    const owner = await mk('Owner One', 'owner@x.com');
    const admin = await mk('Admin Two', 'admin@x.com');
    const member = await mk('Member Three', 'member@x.com');
    const outsider = await mk('Outsider Four', 'out@x.com');
    const stranger = await mk('Stranger Five', 'stranger@x.com');
    const newbie = await mk('Newbie Six', 'newbie@x.com');

    const proj = (await req('POST', '/api/projects', { token: owner.token, body: { name: 'RBAC Project' } })).data;
    await req('POST', `/api/projects/${proj._id}/members`, { token: owner.token, body: { email: 'admin@x.com', memberRole: 'admin' } });
    await req('POST', `/api/projects/${proj._id}/members`, { token: owner.token, body: { email: 'member@x.com' } });

    const t1 = (await req('POST', '/api/tasks', { token: owner.token, body: { title: 'Task One', project: proj._id } })).data;
    const t2 = (await req('POST', '/api/tasks', { token: member.token, body: { title: 'Member Task', project: proj._id } })).data;

    console.log('\n== read access ==');
    for (const [who, u, want] of [['owner', owner, 200], ['admin', admin, 200], ['member', member, 200], ['outsider', outsider, 403]]) {
      const r = await req('GET', `/api/tasks/${t1._id}`, { token: u.token });
      check(`${who} read task -> ${want}`, r.status === want, { got: r.status, msg: r.data?.message });
    }

    console.log('\n== write matrix ==');
    const cases = [
      ['owner edits title', owner, 'PUT', `/api/tasks/${t1._id}`, { title: 'X' }, 200],
      ['admin edits title', admin, 'PUT', `/api/tasks/${t1._id}`, { title: 'X' }, 200],
      ['member edits title (must fail)', member, 'PUT', `/api/tasks/${t1._id}`, { title: 'X' }, 403],
      ['outsider edits title (must fail)', outsider, 'PUT', `/api/tasks/${t1._id}`, { title: 'X' }, 403],
      ['member moves status (allowed)', member, 'PUT', `/api/tasks/${t1._id}`, { status: 'review' }, 200],
      ['outsider moves status (must fail)', outsider, 'PUT', `/api/tasks/${t1._id}`, { status: 'review' }, 403],
      ['owner expedites', owner, 'PUT', `/api/projects/${proj._id}/tasks/${t1._id}/expedite`, null, 200],
      ['member expedites (must fail)', member, 'PUT', `/api/projects/${proj._id}/tasks/${t1._id}/expedite`, null, 403],
      ['owner updates project', owner, 'PUT', `/api/projects/${proj._id}`, { description: 'd' }, 200],
      ['admin updates project', admin, 'PUT', `/api/projects/${proj._id}`, { description: 'd' }, 200],
      ['member updates project (must fail)', member, 'PUT', `/api/projects/${proj._id}`, { description: 'd' }, 403],
      ['owner adds member', owner, 'POST', `/api/projects/${proj._id}/members`, { email: 'stranger@x.com' }, 201],
      ['admin adds member', admin, 'POST', `/api/projects/${proj._id}/members`, { email: 'newbie@x.com' }, 201],
      ['member adds member (must fail)', member, 'POST', `/api/projects/${proj._id}/members`, { email: 'out@x.com' }, 403],
      ['owner issues warning', owner, 'POST', `/api/projects/${proj._id}/warnings`, { issuedTo: member._id, task: t1._id, message: 'm' }, 201],
      ['admin issues warning', admin, 'POST', `/api/projects/${proj._id}/warnings`, { issuedTo: member._id, task: t1._id, message: 'm' }, 201],
      ['member issues warning (must fail)', member, 'POST', `/api/projects/${proj._id}/warnings`, { issuedTo: owner._id, task: t1._id, message: 'm' }, 403],
      ['owner deletes project', owner, 'DELETE', `/api/projects/${proj._id}`, null, 200],
    ];
    for (const [name, u, m, url, body, want] of cases) {
      const r = await req(m, url, { token: u.token, body });
      check(`${name} -> ${want}`, r.status === want, { got: r.status, msg: r.data?.message });
    }

    console.log('\n== member who created a task may delete it ==');
    const p2 = (await req('POST', '/api/projects', { token: owner.token, body: { name: 'P2' } })).data;
    await req('POST', `/api/projects/${p2._id}/members`, { token: owner.token, body: { email: 'member@x.com' } });
    const own = (await req('POST', '/api/tasks', { token: member.token, body: { title: 'Mine', project: p2._id } })).data;
    const other = (await req('POST', '/api/tasks', { token: owner.token, body: { title: 'Theirs', project: p2._id } })).data;
    check('creator can delete own task', (await req('DELETE', `/api/tasks/${own._id}`, { token: member.token })).status === 200);
    check("member can't delete someone else's task", (await req('DELETE', `/api/tasks/${other._id}`, { token: member.token })).status === 403);

    console.log('\n== warning visibility is membership-scoped ==');
    const p3 = (await req('POST', '/api/projects', { token: owner.token, body: { name: 'P3' } })).data;
    await req('POST', `/api/projects/${p3._id}/members`, { token: owner.token, body: { email: 'member@x.com' } });
    const t3 = (await req('POST', '/api/tasks', { token: owner.token, body: { title: 'T3', project: p3._id } })).data;
    await req('POST', `/api/projects/${p3._id}/warnings`, { token: owner.token, body: { issuedTo: member._id, task: t3._id, message: 'be better' } });
    const memberSees = await req('GET', `/api/projects/${p3._id}/warnings`, { token: member.token });
    check('member can read project warnings', memberSees.status === 200 && memberSees.data.length === 1, memberSees.status);
    const outsiderSees = await req('GET', `/api/projects/${p3._id}/warnings`, { token: outsider.token });
    check('outsider cannot read project warnings', outsiderSees.status === 403, outsiderSees.status);
    const resolveTry = await req('PATCH', `/api/warnings/${memberSees.data[0]._id}/resolve`, { token: outsider.token, body: { resolved: true } });
    check('unrelated user cannot resolve someone else\'s warning', resolveTry.status === 403, resolveTry.status);

    console.log('\n== no IDOR via query params ==');
    const memberProjList = await req('GET', '/api/projects', { token: member.token });
    check('member list excludes projects they are not in',
      memberProjList.data.every((p) => p.members.some((m) => String(m.user?._id) === String(member._id))), memberProjList.data.map((p) => p.name));
    const taskList = await req('GET', '/api/tasks', { token: member.token });
    const visibleProjects = new Set((await req('GET', '/api/projects', { token: member.token })).data.map((p) => p._id));
    check('every listed task belongs to a project the caller is in',
      taskList.data.every((t) => visibleProjects.has(t.project?._id)),
      taskList.data.map((t) => t.project?.name));
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