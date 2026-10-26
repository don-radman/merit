// QA for the built demo. Needs Playwright with Chromium available to `require` (not a dependency of this repo):
//   VITE_DEMO_BAR=1 npx vite build && node scripts/qa-demo.cjs dist /tmp/shots
//   (the demo bar is dev-only unless VITE_DEMO_BAR=1, and the Vest all / Run payout steps need it)

// End-to-end QA of the built demo (path routing, as deployed on Vercel).
// Serves dist/ with an SPA fallback and drives the real flows in Chromium.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const DIST = process.argv[2], OUT = process.argv[3], PORT = 8093, HOST = process.argv[4] || 'localhost';
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.html': 'text/html' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split(/[?#]/)[0]);
  let f = path.join(DIST, u);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
  res.setHeader('content-type', MIME[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(res);
});
const results = []; const ok = (name, cond, note = '') => results.push({ name, pass: !!cond, note });
(async () => {
  await new Promise(r => srv.listen(PORT, r));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  ctx.on('page', p => { p.on('pageerror', e => errors.push(String(e))); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); });
  const p = await ctx.newPage(); p.on('pageerror', e => errors.push(String(e))); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const base = `http://${HOST}:${PORT}`;
  const text = async (sel) => (await p.locator(sel).first().textContent().catch(() => '')) || '';
  const money = async (label) => { const t = await p.locator('.stat', { hasText: label }).locator('.stat__value').first().textContent(); return t.trim(); };

  // 1. Front page and routes
  await p.goto(base + '/'); await p.waitForSelector('h1'); ok('home renders', (await p.title()).includes('Merit') && (await text('h1')).trim().length > 0, await text('h1'));
  await p.goto(base + '/issuer'); await p.waitForSelector('.row:not(.row--head):not(.row--skeleton)', { timeout: 8000 }); ok('/issuer deep link', (await text('h1')) === 'Attribution ledger');
  await p.goto(base + '/scout?code=CALDER-DO2'); await p.waitForSelector('.row:not(.row--head):not(.row--skeleton)'); ok('/scout?code=DO2', (await text('h1')).includes('Dorsey'));
  await p.goto(base + '/i/NOPE-1'); await p.waitForTimeout(1500); ok('bad link shows an error, not a crash', (await p.locator('.banner--err, h1').count()) > 0);

  // 2. The full investor flow, on the real stub, in a phone frame
  await p.goto(base + '/scout'); await p.waitForSelector('.row:not(.row--head):not(.row--skeleton)');
  const rowsBefore = await p.locator('.row:not(.row--head):not(.row--skeleton)').count(); const earnedBefore = await money('Earned');
  await p.goto(base + '/i/CALDER-PR7?frame=phone'); await p.waitForSelector('h1');
  await p.getByRole('button', { name: 'Create account' }).click();
  await p.waitForSelector('text=Confirm who you are', { timeout: 15000 });
  const btn = p.getByRole('button', { name: /Check my details/ }); await btn.waitFor(); await p.fill('#name', 'Test Investor'); await btn.click();
  await p.waitForSelector('text=How much would you like to subscribe', { timeout: 15000 });
  await p.getByRole('button', { name: /Subscribe/ }).click();
  await p.waitForSelector('text=What this means', { timeout: 30000 });
  const holding = await text('.hero-figure'); ok('investor flow completes', /250,000/.test(holding), holding);
  await p.screenshot({ path: path.join(OUT, 'qa-investor-done.png') });
  await p.goto(base + '/scout'); await p.waitForSelector('.row:not(.row--head):not(.row--skeleton)'); await p.waitForTimeout(600);
  const rowsAfter = await p.locator('.row:not(.row--head):not(.row--skeleton)').count(); const earnedAfter = await money('Earned');
  ok('new row lands on the book', rowsAfter === rowsBefore + 1, `${rowsBefore} -> ${rowsAfter}`);
  ok('Earned moves by the fee', earnedBefore !== earnedAfter, `${earnedBefore} -> ${earnedAfter}`);
  ok('top row is Vesting', (await p.locator('.row:not(.row--head):not(.row--skeleton)').first().textContent()).includes('Vesting'));

  // 3. Public view hides fees, keeps names and amounts
  await p.getByRole('button', { name: 'What the world sees' }).click(); await p.waitForTimeout(300);
  const feeCells = await p.locator('.row__fee').allTextContents();
  ok('public view masks every fee', feeCells.every(t => /••••/.test(t)), feeCells.join('|'));
  ok('public view keeps invested amounts', (await p.locator('.row:not(.row--head) .num').first().textContent()).includes('US$'));
  await p.getByRole('button', { name: 'Your view' }).click();

  // 4. Vest all -> Payable; Collect now; Run payout on the fund console
  await p.getByRole('button', { name: 'Vest all' }).click(); await p.waitForTimeout(500);
  ok('after Vest all nothing is vesting', !(await p.locator('.pill--vesting').count()));
  const payableTile = await money('On its way'); ok('On its way tile present', payableTile.startsWith('US$'), payableTile);
  await p.goto(base + '/issuer'); await p.waitForSelector('.row:not(.row--head):not(.row--skeleton)');
  const payableBefore = await money('Payable now');
  await p.getByRole('button', { name: /Run payout/ }).click();
  await p.waitForFunction(() => !document.querySelector('.pill--claimable'), null, { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(500);
  ok('payout run clears Payable', !(await p.locator('.pill--claimable').count()), `was ${payableBefore}`);
  ok('paid to date after payout', (await money('Paid to date')).startsWith('US$'));
  await p.screenshot({ path: path.join(OUT, 'qa-issuer-after-payout.png') });
  await p.goto(base + '/scout'); await p.waitForSelector('.row:not(.row--head):not(.row--skeleton)');
  ok('adviser sees Paid', (await p.locator('.pill--claimed').count()) >= 2);

  // 5. Fail next: an armed failure surfaces as an in-place error, not a crash
  await p.selectOption('.devbar select', 'network');
  // "Fail next" fails the NEXT client call, which on a fresh investor screen is the link lookup itself.
  await p.locator('.devbar').getByRole('button', { name: 'Investor', exact: true }).click();
  await p.locator('.banner--err').or(p.getByText('Create your account')).first().waitFor({ timeout: 10000 });
  if (!(await p.locator('.banner--err').count())) { await p.getByRole('button', { name: 'Create account' }).click(); await p.waitForTimeout(2500); }
  ok('armed failure shows an in-place error', (await p.locator('.banner--err').count()) > 0 || (await p.getByText(/Connection problem|Not completed/).count()) > 0);
  await p.selectOption('.devbar select', '—').catch(() => {});

  // 6. Reset restores the seed
  await p.goto(base + '/scout'); await p.waitForSelector('.row:not(.row--head):not(.row--skeleton)');
  await p.getByRole('button', { name: 'Reset' }).click(); await p.waitForTimeout(800);
  await p.goto(base + '/scout'); await p.waitForSelector('.row:not(.row--head):not(.row--skeleton)');
  ok('reset restores four seed rows', (await p.locator('.row:not(.row--head):not(.row--skeleton)').count()) === 4);
  ok('reset restores Earned', (await money('Earned')) === earnedBefore, await money('Earned'));

  // 7. The guide: opens, steps, links are real, drag and minimise work
  await p.goto(base + '/?guide=1'); await p.waitForSelector('.guide');
  ok('guide opens from ?guide=1', true);
  const links = []; for (let i = 0; i < 10; i++) { links.push(...await p.locator('.guide__links a').evaluateAll(a => a.map(x => x.href))); await p.locator('.guide').getByRole('button', { name: 'Next' }).click(); await p.waitForTimeout(250); }
  ok('guide reaches the last step', await p.locator('.guide').getByRole('button', { name: 'Finish' }).count() === 1);
  ok('all guide links are stellar.expert', links.length > 10 && links.every(h => h.startsWith('https://stellar.expert/explorer/testnet/')), String(links.length));
  const head = p.locator('.guide__head'); const b = await head.boundingBox();
  await p.mouse.move(b.x + 40, b.y + 10); await p.mouse.down(); await p.mouse.move(200, 200, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(200);
  const after = await p.locator('.guide').boundingBox(); ok('guide drags', after.x < 260 && after.y < 260, `${Math.round(after.x)},${Math.round(after.y)}`);
  await p.locator('.guide').getByRole('button', { name: 'Minimise' }).click(); await p.waitForTimeout(200);
  const mini = await p.locator('.guide').boundingBox(); ok('guide minimises', mini.height < 80, `${Math.round(mini.height)}px`);
  await p.screenshot({ path: path.join(OUT, 'qa-guide-min.png') });
  await p.locator('.guide').getByRole('button', { name: 'Expand' }).click(); await p.waitForTimeout(200);
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(200); ok('arrow keys step', (await text('.guide__kicker')).includes('10 of 11'));

  // 8. demo host landing
  await p.goto(base + '/'); await p.waitForSelector('h1');
  ok('localhost root is the front page, not the book', !(await p.locator('.stats').count()) && (await p.title()).includes('Merit'));

  // 9. Phone width, no horizontal scroll
  const m = await browser.newContext({ viewport: { width: 390, height: 844 } }); const q = await m.newPage();
  for (const r of ['/', '/scout', '/issuer', '/i/CALDER-PR7']) { await q.goto(base + r); await q.waitForSelector('h1'); const w = await q.evaluate(() => document.documentElement.scrollWidth); ok(`no horizontal scroll at 390px ${r}`, w <= 390, String(w)); }
  await m.close();

  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  const fails = results.filter(r => !r.pass);
  for (const r of results) console.log((r.pass ? 'PASS ' : 'FAIL ') + r.name + (r.note ? '  — ' + r.note : ''));
  console.log(`\n${results.length - fails.length}/${results.length} passed`);
  await browser.close(); srv.close(); process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('QA crashed:', e); process.exit(2); });
