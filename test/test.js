/* Integration test harness: real MongoDB + real server process. */
const { MongoMemoryServer } = require('mongodb-memory-server');
const { spawn } = require('child_process');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const PORT = 5199;
const BASE = `http://127.0.0.1:${PORT}`;

let pass = 0;
const failures = [];

const check = (name, cond, extra) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { failures.push(name); console.log(`  ✗ ${name}${extra ? ` -> ${JSON.stringify(extra)}` : ''}`); }
};

const req = async (method, url, { token, body } = {}) => {
  const res = await fetch(BASE + url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
};

(async () => {
  const mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri('taskflow_test');

  const server = spawn(process.execPath, ['server/index.js'], {
    cwd: REPO,
    env: { ...process.env, MONGO_URI: uri, JWT_SECRET: 'test-secret-value-0123456789', PORT: String(PORT), NODE_ENV: 'development' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverLog = '';
  server.stdout.on('data', (d) => { serverLog += d; });
  server.stderr.on('data', (d) => { serverLog += d; });

  // wait for boot
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(BASE + '/health'); if (r.ok) break; } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }

  const OID = 'a'.repeat(24);

  try {
    console.log('\n== health ==');
    const h = await req('GET', '/health');
    check('health 200 + db connected', h.status === 200 && h.data.db === 'connected', h.data);

    console.log('\n== auth ==');
    const reg = await req('POST', '/api/auth/register', {
      body: { name: '  Ada Lovelace ', email: '  Ada@Example.COM ', password: 'Passw0rd!' },
    });
    check('register 201', reg.status === 201, reg.data);
    check('register returns token', !!reg.data?.token);
    const adaTok = reg.data.token;
    const adaId = reg.data._id;

    const reg2 = await req('POST', '/api/auth/register', {
      body: { name: 'Grace Hopper', email: 'grace@example.com', password: 'Passw0rd!' },
    });
    const graceTok = reg2.data.token;
    const graceId = reg2.data._id;

    // email must be normalised on save AND on lookup
    const me = await req('GET', '/api/users/search?email=ADA@example.COM', { token: adaTok });
    check('search normalises email case', me.status === 200 && me.data.email === 'ada@example.com', me.data);

    const loginLower = await req('POST', '/api/auth/login', { body: { email: 'ada@example.com', password: 'Passw0rd!' } });
    check('login works with stored lowercase', loginLower.status === 200, loginLower.data);
    const loginUpper = await req('POST', '/api/auth/login', { body: { email: 'ADA@EXAMPLE.com', password: 'Passw0rd!' } });
    check('BUGFIX: login works with mixed case', loginUpper.status === 200, loginUpper.data);
    const loginPad = await req('POST', '/api/auth/login', { body: { email: '  ada@example.com ', password: 'Passw0rd!' } });
    check('BUGFIX: login trims whitespace', loginPad.status === 200, loginPad.data);

    const weak = await req('POST', '/api/auth/register', { body: { name: 'Weak', email: 'w@x.com', password: 'password' } });
    check('weak password rejected', weak.status === 400, weak.data);
    const shortPw = await req('POST', '/api/auth/register', { body: { name: 'Short', email: 's@x.com', password: 'Pass1!' } });
    check('short password rejected', shortPw.status === 400, shortPw.data);

    const badLogin = await req('POST', '/api/auth/login', { body: { email: 'ada@example.com', password: 'WrongPass1!' } });
    check('wrong password 401', badLogin.status === 401, badLogin.data);
    const ghost = await req('POST', '/api/auth/login', { body: { email: 'ghost@nowhere.com', password: 'WrongPass1!' } });
    check('unknown user 401 same message', ghost.status === 401 && ghost.data.message === badLogin.data.message, ghost.data);

    const noTok = await req('GET', '/api/projects');
    check('no token 401', noTok.status === 401);
    const badTok = await req('GET', '/api/projects', { token: 'garbage' });
    check('bad token 401', badTok.status === 401);

    console.log('\n== profile ==');
    const prof = await req('PUT', '/api/users/profile', { token: adaTok, body: { name: 'Ada L' } });
    check('profile update works', prof.status === 200 && prof.data.name === 'Ada L', prof.data);
    check('profile response has no password', prof.data && prof.data.password === undefined, prof.data);
    const longName = await req('PUT', '/api/users/profile', { token: adaTok, body: { name: 'x'.repeat(51) } });
    check('BUGFIX: profile name maxlength enforced', longName.status === 400, longName.data);

    console.log('\n== projects ==');
    const p = await req('POST', '/api/projects', {
      token: adaTok,
      body: { name: 'Apollo', description: 'Moon', color: '#34d3a0', dueDate: '' },
    });
    check('create project with empty dueDate', p.status === 201, p.data);
    check('create response includes userRole=admin', p.data?.userRole === 'admin', p.data?.userRole);
    const projId = p.data._id;

    const pBad = await req('POST', '/api/projects', { token: adaTok, body: { name: '', color: 'notahex' } });
    check('empty name rejected', pBad.status === 400, pBad.data);
    const pBadColor = await req('POST', '/api/projects', { token: adaTok, body: { name: 'ok', color: 'nope' } });
    check('bad colour rejected', pBadColor.status === 400, pBadColor.data);
    const pLong = await req('POST', '/api/projects', { token: adaTok, body: { name: 'x'.repeat(101) } });
    check('long name rejected', pLong.status === 400, pLong.data);

    const pGet = await req('GET', `/api/projects/${projId}`, { token: adaTok });
    check('get project 200', pGet.status === 200, pGet.data);
    check('no __v leaked', pGet.data.__v === undefined, Object.keys(pGet.data || {}));

    const pCast = await req('GET', `/api/projects/${OID}`, { token: adaTok });
    check('BUGFIX: unknown ObjectId -> 404 not 500', pCast.status === 404, pCast.data);
    const pJunk = await req('GET', '/api/projects/not-an-id', { token: adaTok });
    check('BUGFIX: malformed id -> 400 not 500', pJunk.status === 400, pJunk.data);

    const pPut = await req('PUT', `/api/projects/${projId}`, { token: adaTok, body: { status: 'completed', description: 'done' } });
    check('admin can update project', pPut.status === 200 && pPut.data.status === 'completed', pPut.data);
    check('update keeps userRole', pPut.data?.userRole === 'admin', pPut.data?.userRole);
    const pPutBad = await req('PUT', `/api/projects/${projId}`, { token: adaTok, body: { status: 'nope' } });
    check('BUGFIX: invalid status -> 400 not 500', pPutBad.status === 400, pPutBad.data);
    const pPutClear = await req('PUT', `/api/projects/${projId}`, { token: adaTok, body: { dueDate: '' } });
    check('dueDate can be cleared', pPutClear.status === 200 && pPutClear.data.dueDate === null, pPutClear.data?.dueDate);
    await req('PUT', `/api/projects/${projId}`, { token: adaTok, body: { status: 'active' } });

    console.log('\n== members ==');
    const addLower = await req('POST', `/api/projects/${projId}/members`, { token: adaTok, body: { email: 'GRACE@EXAMPLE.COM' } });
    check('BUGFIX: add member normalises email case', addLower.status === 201, addLower.data);
    check('BUGFIX: add member response has userRole', addLower.data?.userRole === 'admin', addLower.data?.userRole);
    check('BUGFIX: add member populates owner', typeof addLower.data?.owner === 'object', addLower.data?.owner);

    const addDup = await req('POST', `/api/projects/${projId}/members`, { token: adaTok, body: { email: 'grace@example.com' } });
    check('duplicate member -> 409', addDup.status === 409, addDup.data);
    const addGhost = await req('POST', `/api/projects/${projId}/members`, { token: adaTok, body: { email: 'ghost@nowhere.com' } });
    check('unknown member email -> 404', addGhost.status === 404, addGhost.data);
    const addBadRole = await req('POST', `/api/projects/${projId}/members`, { token: adaTok, body: { email: 'grace@example.com', memberRole: 'root' } });
    check('invalid role rejected', addBadRole.status === 400, addBadRole.data);

    const addAsMember = await req('POST', `/api/projects/${projId}/members`, { token: graceTok, body: { email: 'x@y.com' } });
    check('non-admin cannot add members', addAsMember.status === 403, addAsMember.data);

    const delOwner = await req('DELETE', `/api/projects/${projId}/members/${adaId}`, { token: adaTok });
    check('cannot remove owner', delOwner.status === 400, delOwner.data);

    console.log('\n== tasks ==');
    const t1 = await req('POST', '/api/tasks', { token: adaTok, body: { title: 'Design', project: projId, dueDate: '2020-01-01', priority: 'high' } });
    check('create task with past due date', t1.status === 201, t1.data);
    const t1Id = t1.data._id;
    const t2 = await req('POST', '/api/tasks', { token: adaTok, body: { title: 'Build', project: projId, tags: ['x', 'y'] } });
    check('create task with tags', t2.status === 201, t2.data);
    const t2Id = t2.data._id;

    const tNoDue = await req('POST', '/api/tasks', { token: adaTok, body: { title: 'No due', project: projId, dueDate: '' } });
    check('create task with empty dueDate', tNoDue.status === 201, tNoDue.data);
    const tBadAssign = await req('POST', '/api/tasks', { token: adaTok, body: { title: 'Bad', project: projId, assignee: OID } });
    check('BUGFIX: non-member assignee rejected', tBadAssign.status === 400, tBadAssign.data);
    const tBadStatus = await req('POST', '/api/tasks', { token: adaTok, body: { title: 'Bad', project: projId, status: 'nope' } });
    check('BUGFIX: invalid status -> 400 not 500', tBadStatus.status === 400, tBadStatus.data);
    const tLongTitle = await req('POST', '/api/tasks', { token: adaTok, body: { title: 'x'.repeat(201), project: projId } });
    check('long title -> 400 not 500', tLongTitle.status === 400, tLongTitle.data);
    const tGhostProj = await req('POST', '/api/tasks', { token: adaTok, body: { title: 'x', project: OID } });
    check('unknown project -> 404', tGhostProj.status === 404, tGhostProj.data);

    const tFilterBad = await req('GET', `/api/tasks?assignee=${OID}xyz`, { token: adaTok });
    check('BUGFIX: bad assignee filter -> 400 not 500', tFilterBad.status === 400, tFilterBad.data);
    const tFilterStatus = await req('GET', '/api/tasks?status=bogus', { token: adaTok });
    check('BUGFIX: bad status filter -> 400 not 500', tFilterStatus.status === 400, tFilterStatus.data);
    const tOverdue = await req('GET', `/api/tasks?project=${projId}&overdue=true`, { token: adaTok });
    check('overdue filter works', tOverdue.status === 200 && tOverdue.data.length === 1, tOverdue.data?.length);
    const tBoth = await req('GET', `/api/tasks?project=${projId}&status=todo&overdue=true`, { token: adaTok });
    check('BUGFIX: status+overdue combines', tBoth.status === 200 && tBoth.data.every((t) => t.status !== 'done'), tBoth.data);

    console.log('\n== member permissions on tasks ==');
    const memberEdit = await req('PUT', `/api/tasks/${t1Id}`, { token: graceTok, body: { title: 'HACKED', status: 'in-progress' } });
    check('BUGFIX: member title change is rejected, not silently dropped', memberEdit.status === 403, memberEdit.data);
    const stillOriginal = await req('GET', `/api/tasks/${t1Id}`, { token: graceTok });
    check('BUGFIX: rejected edit left the task untouched', stillOriginal.data.title === 'Design', stillOriginal.data?.title);
    const memberStatus = await req('PUT', `/api/tasks/${t1Id}`, { token: graceTok, body: { status: 'in-progress' } });
    check('member CAN change status', memberStatus.status === 200 && memberStatus.data.status === 'in-progress', memberStatus.data);
    check('completedAt not set while not done', memberStatus.data?.completedAt === null || memberStatus.data?.completedAt === undefined);

    const adminEdit = await req('PUT', `/api/tasks/${t1Id}`, { token: adaTok, body: { title: 'Design v2', description: 'updated' } });
    check('admin can edit title', adminEdit.status === 200 && adminEdit.data.title === 'Design v2', adminEdit.data);

    const outsider = await req('POST', '/api/auth/register', { body: { name: 'Outsider', email: 'out@example.com', password: 'Passw0rd!' } });
    const outsiderTok = outsider.data.token;
    const outsiderGet = await req('GET', `/api/tasks/${t1Id}`, { token: outsiderTok });
    check('non-member cannot read task', outsiderGet.status === 403, outsiderGet.data);
    const outsiderPut = await req('PUT', `/api/tasks/${t1Id}`, { token: outsiderTok, body: { title: 'x' } });
    check('non-member cannot edit task', outsiderPut.status === 403, outsiderPut.data);

    console.log('\n== completedAt lifecycle ==');
    await req('PUT', `/api/tasks/${t1Id}`, { token: adaTok, body: { status: 'done' } });
    const doneTask = await req('GET', `/api/tasks/${t1Id}`, { token: adaTok });
    check('completedAt set when done', !!doneTask.data.completedAt, doneTask.data?.completedAt);
    await req('PUT', `/api/tasks/${t1Id}`, { token: adaTok, body: { status: 'todo' } });
    const undoneTask = await req('GET', `/api/tasks/${t1Id}`, { token: adaTok });
    check('BUGFIX: completedAt cleared when reopened', undoneTask.data.completedAt === null || undoneTask.data.completedAt === undefined, undoneTask.data?.completedAt);

    console.log('\n== expedite ==');
    const exp1 = await req('PUT', `/api/projects/${projId}/tasks/${t1Id}/expedite`, { token: adaTok });
    check('expedite on', exp1.status === 200 && exp1.data.expedited === true && exp1.data.priority === 'urgent', exp1.data);
    const exp2 = await req('PUT', `/api/projects/${projId}/tasks/${t1Id}/expedite`, { token: adaTok });
    check('BUGFIX: un-expedite restores priority', exp2.data.expedited === false && exp2.data.priority !== 'urgent', exp2.data);
    const expAsMember = await req('PUT', `/api/projects/${projId}/tasks/${t1Id}/expedite`, { token: graceTok });
    check('member cannot expedite', expAsMember.status === 403, expAsMember.data);

    // cross-project escalation
    const p2 = await req('POST', '/api/projects', { token: outsiderTok, body: { name: 'Other' } });
    const expCross = await req('PUT', `/api/projects/${p2.data._id}/tasks/${t1Id}/expedite`, { token: outsiderTok });
    check('BUGFIX: cross-project expedite blocked', expCross.status === 404, expCross.data);

    console.log('\n== stats ==');
    const stats = await req('GET', `/api/projects/${projId}/stats`, { token: adaTok });
    check('stats 200', stats.status === 200, stats.data);
    check('stats counts correct', stats.data.total === 3 && stats.data.overdue >= 0, stats.data);
    const statsOutsider = await req('GET', `/api/projects/${projId}/stats`, { token: outsiderTok });
    check('stats blocked for non-member', statsOutsider.status === 403, statsOutsider.data);

    console.log('\n== warnings ==');
    const w = await req('POST', `/api/projects/${projId}/warnings`, {
      token: adaTok, body: { issuedTo: graceId, task: t1Id, message: 'Late again', severity: 'moderate' },
    });
    check('issue warning', w.status === 201, w.data);
    const warnId = w.data._id;
    const wSelf = await req('POST', `/api/projects/${projId}/warnings`, {
      token: adaTok, body: { issuedTo: adaId, task: t1Id, message: 'self' },
    });
    check('BUGFIX: cannot warn yourself', wSelf.status === 400, wSelf.data);
    const wOutsider = await req('POST', `/api/projects/${projId}/warnings`, {
      token: adaTok, body: { issuedTo: outsider.data._id, task: t1Id, message: 'not a member' },
    });
    check('BUGFIX: cannot warn a non-member', wOutsider.status === 400, wOutsider.data);
    const wCrossTask = await req('POST', `/api/projects/${projId}/warnings`, {
      token: adaTok, body: { issuedTo: graceId, task: 'b'.repeat(24), message: 'other project task' },
    });
    check('BUGFIX: cannot warn about foreign task', wCrossTask.status === 400, wCrossTask.data);
    const wByMember = await req('POST', `/api/projects/${projId}/warnings`, {
      token: graceTok, body: { issuedTo: adaId, task: t1Id, message: 'member tries' },
    });
    check('member cannot issue warnings', wByMember.status === 403, wByMember.data);

    // cross-project warning delete
    const delCross = await req('DELETE', `/api/projects/${p2.data._id}/warnings/${warnId}`, { token: outsiderTok });
    check('BUGFIX: cross-project warning delete blocked', delCross.status === 404, delCross.data);
    const stillThere = await req('GET', `/api/projects/${projId}/warnings`, { token: adaTok });
    check('warning survived cross-project delete', stillThere.data.length === 1, stillThere.data?.length);

    // resolve flow (new feature)
    const resolved = await req('PATCH', `/api/projects/${projId}/warnings/${warnId}`, { token: adaTok, body: { resolved: true } });
    check('BUGFIX/NEW: warning can be resolved', resolved.status === 200 && resolved.data.resolved === true, resolved.data);
    check('resolvedAt set', !!resolved.data.resolvedAt);
    const unresolved = await req('PATCH', `/api/projects/${projId}/warnings/${warnId}`, { token: adaTok, body: { resolved: false } });
    check('warning can be unresolved', unresolved.data.resolved === false && !unresolved.data.resolvedAt);

    console.log('\n== cascade deletes ==');
    const delT2 = await req('DELETE', `/api/tasks/${t2Id}`, { token: adaTok });
    check('delete task', delT2.status === 200, delT2.data);
    const wAfterTask = await req('GET', `/api/projects/${projId}/warnings`, { token: adaTok });
    check('BUGFIX: deleting task cleans its warnings', wAfterTask.data.length === 1, wAfterTask.data?.length);

    const delOwnerTask = await req('DELETE', `/api/tasks/${t1Id}`, { token: graceTok });
    check('member cannot delete others tasks', delOwnerTask.status === 403, delOwnerTask.data);

    console.log('\n== member removal unassigns tasks ==');
    const assignGrace = await req('PUT', `/api/tasks/${t1Id}`, { token: adaTok, body: { assignee: graceId } });
    check('assign to member ok', assignGrace.status === 200 && assignGrace.data.assignee._id === graceId, assignGrace.data?.assignee);
    const rmGrace = await req('DELETE', `/api/projects/${projId}/members/${graceId}`, { token: adaTok });
    check('remove member', rmGrace.status === 200, rmGrace.data);
    check('BUGFIX: removal response keeps userRole', rmGrace.data?.userRole === 'admin', rmGrace.data?.userRole);
    const afterRemove = await req('GET', `/api/tasks/${t1Id}`, { token: adaTok });
    check('BUGFIX: removed member tasks unassigned', afterRemove.data.assignee === null, afterRemove.data?.assignee);
    const graceNow = await req('GET', `/api/projects/${projId}`, { token: graceTok });
    check('removed member loses access', graceNow.status === 403, graceNow.data);

    console.log('\n== project delete cascade ==');
    const p3 = await req('POST', '/api/projects', { token: adaTok, body: { name: 'Temp' } });
    const t3 = await req('POST', '/api/tasks', { token: adaTok, body: { title: 'temp', project: p3.data._id } });
    await req('POST', `/api/projects/${p3.data._id}/members`, { token: adaTok, body: { email: 'grace@example.com' } });
    const w3 = await req('POST', `/api/projects/${p3.data._id}/warnings`, { token: adaTok, body: { issuedTo: graceId, task: t3.data._id, message: 'x' } });
    const delProj = await req('DELETE', `/api/projects/${p3.data._id}`, { token: adaTok });
    check('owner can delete project', delProj.status === 200, delProj.data);
    check('delete reports removed tasks', delProj.data?.deletedTasks === 1, delProj.data);
    const t3After = await req('GET', `/api/tasks/${t3.data._id}`, { token: adaTok });
    check('BUGFIX: project delete removed its tasks', t3After.status === 404, t3After.data);
    const w3After = await req('GET', `/api/projects/${p3.data._id}/warnings`, { token: adaTok });
    check('BUGFIX: project delete removed its warnings', w3After.status === 404, w3After.data);

    const delByMember = await req('DELETE', `/api/projects/${projId}`, { token: graceTok });
    check('member cannot delete project', delByMember.status === 403, delByMember.data);

    console.log('\n== 404 / api isolation ==');
    const nf = await req('GET', '/api/nope', { token: adaTok });
    check('unknown api route -> JSON 404', nf.status === 404 && nf.data.message, nf.data);
    check('unknown api route is not HTML', !String(nf.data?.message || '').includes('<'), nf.data);

    console.log('\n== headers ==');
    const headRes = await fetch(BASE + '/health');
    check('x-powered-by removed', !headRes.headers.get('x-powered-by'));
    check('helmet nosniff set', headRes.headers.get('x-content-type-options') === 'nosniff');
    check('helmet frameguard set', !!headRes.headers.get('x-frame-options'));
    const apiHead = await fetch(BASE + '/api/projects');
    check('rate-limit headers present on /api', !!apiHead.headers.get('ratelimit-policy'), [...apiHead.headers.keys()].filter(k=>k.startsWith('ratelimit')).join(','));

    console.log('\n== rate limiting ==');
    let limited = false;
    for (let i = 0; i < 14; i++) {
      const r = await req('POST', '/api/auth/login', { body: { email: 'nobody@x.com', password: 'Nope1234!' } });
      if (r.status === 429) { limited = true; break; }
    }
    check('auth rate limiter trips', limited);

    console.log('\n== input leakage ==');
    check('no stack traces in 404 body', !String(JSON.stringify(nf.data)).includes('at Object'));
  } catch (err) {
    console.error('HARNESS ERROR', err);
    failures.push('harness: ' + err.message);
  }

  console.log(`\n================ ${pass} passed, ${failures.length} failed ================`);
  if (failures.length) { console.log('FAILURES:\n - ' + failures.join('\n - ')); }
  if (/error|Error/.test(serverLog) && !failures.length) console.log('\nserver log:\n' + serverLog);

  server.kill();
  await mongo.stop();
  process.exit(failures.length ? 1 : 0);
})();