import { useEffect, useRef, useState } from 'react';
import type { MouseEvent, PointerEvent, ReactNode } from 'react';
import { ArrowRightIcon, CheckIcon, FingerprintIcon, LockIcon, MeritMark, ShieldCheckIcon } from '@/components/icons.tsx';
import { MODE, PRODUCT } from '@/lib/index.ts';
import { hrefFor, navigate } from '@/route.ts';
import './home-premium.css';

function Go({ to, className = 'premium-button', children }: { to: string; className?: string; children: ReactNode }) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    navigate(to);
    window.scrollTo(0, 0);
  };
  return <a className={className} href={hrefFor(to)} onClick={onClick}>{children}</a>;
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    block: 'start',
  });
}

// The master Peak Signal silhouette is unchanged. Material and depth belong
// only to this decorative sculpture; all functional brand marks remain flat.
const MASTER = 'M 10 90 L 34 22 L 49 52 L 68 10 L 92 90 L 71 90 L 60 57 L 49 80 L 36 58 L 25 90 Z M 68 23 L 59 44 L 67 38 L 74 43 Z';
function SteelSculpture() {
  const stage = useRef<HTMLDivElement>(null);
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    stage.current?.style.setProperty('--premium-tilt-x', `${-y * 5}deg`);
    stage.current?.style.setProperty('--premium-tilt-y', `${x * 7}deg`);
  };
  const reset = () => {
    stage.current?.style.setProperty('--premium-tilt-x', '0deg');
    stage.current?.style.setProperty('--premium-tilt-y', '0deg');
  };
  return (
    <div className="premium-sculpture" onPointerMove={move} onPointerLeave={reset} aria-hidden="true">
      <div className="premium-sculpture-horizon" />
      <div className="premium-sculpture-stage" ref={stage}>
        <svg viewBox="0 0 112 116" className="premium-steel-mark" fillRule="evenodd">
          <defs>
            <linearGradient id="premium-steel-edge" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#8d9696" /><stop offset=".28" stopColor="#303839" />
              <stop offset=".53" stopColor="#b7c0bf" /><stop offset=".7" stopColor="#404a4a" /><stop offset="1" stopColor="#111919" />
            </linearGradient>
            <linearGradient id="premium-steel-face" x1=".1" y1="0" x2=".85" y2="1">
              <stop offset="0" stopColor="#f0f1e9" /><stop offset=".21" stopColor="#bdc5c3" />
              <stop offset=".38" stopColor="#7d8786" /><stop offset=".405" stopColor="#e4e7df" />
              <stop offset=".49" stopColor="#c1c8c4" /><stop offset=".72" stopColor="#7b8582" />
              <stop offset=".91" stopColor="#c9d0ca" /><stop offset="1" stopColor="#a1aba6" />
            </linearGradient>
            <linearGradient id="premium-steel-light" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#fff" stopOpacity=".7" /><stop offset=".3" stopColor="#fff" stopOpacity="0" />
              <stop offset=".8" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#fff" stopOpacity=".25" />
            </linearGradient>
            <pattern id="premium-brush" width="2" height=".45" patternUnits="userSpaceOnUse">
              <path d="M0 .15H2" stroke="#fff" strokeOpacity=".1" strokeWidth=".08" />
              <path d="M0 .35H2" stroke="#15201e" strokeOpacity=".15" strokeWidth=".06" />
            </pattern>
          </defs>
          {Array.from({ length: 22 }, (_, i) => <path key={i} d={MASTER} transform={`translate(${6 - i * .26} ${7 - i * .3})`} fill="url(#premium-steel-edge)" />)}
          <path d={MASTER} fill="url(#premium-steel-light)" />
          <path d={MASTER} transform="translate(.2 -.2)" fill="url(#premium-steel-face)" />
          <path d={MASTER} transform="translate(.2 -.2)" fill="url(#premium-brush)" />
        </svg>
      </div>
      <div className="premium-sculpture-caption"><span>Peak Signal / 01</span><span>A record of value</span></div>
    </div>
  );
}

const steps = [
  { title: 'Make the introduction.', short: 'Introduce', body: 'Share your adviser link. Your client arrives at the fund’s own portal, with your introduction already attached.', label: 'The starting point', value: 'A personal introduction', detail: 'One link. A clear connection.', code: 'CALDER-PR7', status: 'Link ready' },
  { title: 'Put it on the record.', short: 'Record', body: 'When the approved client subscribes, the introduction is recorded with the investment. It appears in the adviser’s book and the fund’s ledger.', label: 'The shared record', value: 'An introduction, recognised', detail: 'The same event. Both sides of the book.', code: 'INTRODUCTION / 001', status: 'Recorded' },
  { title: 'Let the terms do the work.', short: 'Vest', body: 'The fee follows the fund’s agreed holding window. It becomes payable when that window closes; an eligible early exit can reverse it.', label: 'The agreed terms', value: 'A defined vesting window', detail: 'A clear status at every stage.', code: 'VESTING → PAYABLE', status: 'Vesting' },
  { title: 'Close the loop.', short: 'Pay', body: 'The fund runs a payout for payable fees. This demo simulates that step; live settlement runs through a separate pipeline. Auditor reconciliation is shown as an illustration.', label: 'The final step', value: 'Credit where it’s due.', detail: 'Private terms. A complete record.', code: 'PLACEMENT FEE / SETTLED', status: 'Paid' },
];

const layers = [
  { name: 'Your portal', owner: 'Merit Connect', number: '01', title: 'Your front door stays yours.', copy: 'Your brand, your investor journey, your identity checks. Connect carries the adviser code and the approval signal into Merit.', note: 'The investor experiences your fund.' },
  { name: 'The book & ledger', owner: 'Merit', number: '02', title: 'One record. The right view.', copy: 'Advisers see their own introductions and fees. Fund operations see the ledger and payout run, with a consistent set of statuses across both.', note: 'Vesting. Payable. Paid. Reversed.' },
  { name: 'Attribution', owner: 'Merit', number: '03', title: 'Recognition, written in.', copy: 'The attribution contract records the introduction, the investment and its status. The adviser’s rate and fee are not stored in that public record.', note: 'The introduction is public. The rate is not.' },
  { name: 'Confidential settlement', owner: 'OpenZeppelin / Stellar', number: '04', title: 'Privacy with accountability.', copy: 'The settlement design uses confidential-transfer primitives, with a separate auditor channel. The current non-zero-knowledge verifier does not yet guarantee payout-amount privacy.', note: 'Testnet only. Zero-knowledge verification remains in progress.' },
];

export default function Home() {
  const [step, setStep] = useState(0);
  const [layer, setLayer] = useState(0);
  const [publicView, setPublicView] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { document.title = `${PRODUCT.name} · ${PRODUCT.tagline.replace(/\.$/, '')}`; }, []);
  const jump = (id: string) => { setMenuOpen(false); scrollToSection(id); };

  return (
    <div className="premium-home">
      <a className="premium-skip" href="#premium-main" onClick={e => { e.preventDefault(); document.getElementById('premium-main')?.focus(); }}>Skip to content</a>
      <div className="premium-header-shell">
        <header className="premium-header premium-container">
          <a href={hrefFor('/')} className="premium-brand" aria-label="Merit home"><MeritMark size={32} /><span>Merit</span></a>
          <nav className={`premium-nav${menuOpen ? ' premium-nav-open' : ''}`} aria-label="Main navigation" id="premium-navigation">
            <button className="premium-control" onClick={() => jump('premium-product')}>The product</button>
            <button className="premium-control" onClick={() => jump('premium-connect')}>Merit Connect</button>
            <button className="premium-control" onClick={() => jump('premium-foundation')}>The foundation</button>
          </nav>
          <Go to="/scout" className="premium-header-demo">Explore the demo <ArrowRightIcon size={16} /></Go>
          <button className="premium-menu" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} aria-controls="premium-navigation" onClick={() => setMenuOpen(!menuOpen)}><span /><span /></button>
        </header>
      </div>
      <main id="premium-main" tabIndex={-1}>
      <div className="premium-dark-opening">
          <section className="premium-hero premium-container" aria-labelledby="premium-hero-title">
            <div className="premium-hero-copy">
              <div className="premium-eyebrow premium-hero-eyebrow"><span className="premium-signal" /> Infrastructure for fund distribution</div>
              <h1 id="premium-hero-title">Relationships<br />create value.<br /><span>Make it count.</span></h1>
              <p>Every introduction recognised.<br />Every placement fee accounted for.<br />Private terms, from the outset.</p>
              <div className="premium-hero-actions"><Go to="/scout">Explore the adviser’s book <ArrowRightIcon size={18} /></Go><button className="premium-text-link" onClick={() => jump('premium-process')}>See how it works <ArrowRightIcon size={16} className="premium-down-arrow" /></button></div>
              <div className="premium-hero-note">For fund managers, advisers & family offices.</div>
            </div>
            <SteelSculpture />
          </section>
          <div className="premium-principles premium-container" aria-label="Product principles">
            <div><span>01 / Attribution</span><p>The connection, recorded.</p></div>
            <div><span>02 / Confidentiality</span><p>Your terms stay yours.</p></div>
            <div><span>03 / Settlement</span><p>A clear path to paid.</p></div>
            <span className="premium-principles-note">Built on Stellar.<br />Designed around people.</span>
          </div>
      </div>

      <section className="premium-product premium-section premium-container" id="premium-product" aria-labelledby="premium-product-title">
        <div className="premium-section-intro">
          <div className="premium-eyebrow"><span className="premium-section-index">01</span> The product</div>
          <div><h2 id="premium-product-title">The relationship is personal.<br /><span>The record should be precise.</span></h2><p>Capital moves through people. Merit gives the people who bring it a shared record — from the first introduction to the final placement fee.</p></div>
        </div>
        <div className="premium-product-grid">
          <div className="premium-audiences">
            <Go to="/scout" className="premium-audience"><span className="premium-audience-number">01</span><div><h3>For the adviser</h3><p>Your introductions. Your terms. Your book.<br />Know where you stand, without chasing.</p><span>Open the adviser’s book <ArrowRightIcon size={16} /></span></div></Go>
            <Go to="/issuer" className="premium-audience"><span className="premium-audience-number">02</span><div><h3>For the fund</h3><p>A single view of the people bringing capital.<br />Agreed rules, clear statuses, one payout workflow.</p><span>Open the fund’s ledger <ArrowRightIcon size={16} /></span></div></Go>
            <Go to="/i/CALDER-PR7?frame=phone" className="premium-audience"><span className="premium-audience-number">03</span><div><h3>For the investor</h3><p>A familiar experience, in the fund’s own brand.<br />The introduction comes with you.</p><span>Follow an investor link <ArrowRightIcon size={16} /></span></div></Go>
          </div>
          <div className="premium-record-wrap">
            <div className="premium-record-topline"><span className="premium-eyebrow">A little visibility. A lot of certainty.</span><LockIcon size={16} /></div>
            <div className="premium-record">
              <div className="premium-record-header"><div><span className="premium-eyebrow">The adviser’s book</span><h3>Value, recognised.</h3></div><MeritMark size={32} /></div>
              <div className="premium-record-switch" role="group" aria-label="Illustrate record visibility"><button className="premium-control" aria-pressed={!publicView} onClick={() => setPublicView(false)}>Your view</button><button className="premium-control" aria-pressed={publicView} onClick={() => setPublicView(true)}>Public record</button></div>
              <div className="premium-record-amount" aria-live="polite"><span>Placement fee <LockIcon size={12} /></span><strong>{publicView ? 'Private' : 'US$1,250.00'}</strong><span>{publicView ? 'The fee is not shown in the public record.' : 'Visible to you and the fund.'}</span></div>
              <div className="premium-record-row"><span>Introduction</span><span><CheckIcon size={14} /> Recorded</span></div>
              <div className="premium-record-row"><span>Fund</span><span>Calder Income</span></div>
              <div className="premium-record-row"><span>Fee status</span><span className="premium-paid"><CheckIcon size={13} /> Paid</span></div>
              <div className="premium-record-bottom"><span className="premium-signal" /> The introduction is public. The rate is not.</div>
            </div>
            <p className="premium-caption">Illustrative record. This toggle explains visibility; it is not an access control.</p>
          </div>
        </div>
      </section>

      <section className="premium-process" id="premium-process" aria-labelledby="premium-process-title">
        <div className="premium-container premium-section">
          <div className="premium-section-intro"><div className="premium-eyebrow"><span className="premium-section-index">02</span> From introduction to payout</div><h2 id="premium-process-title">Four steps.<br /><span>Nothing left to chase.</span></h2></div>
          <div className="premium-step-navigation" role="group" aria-label="Explore the four steps">{steps.map((item, i) => <button className="premium-control" key={item.short} aria-pressed={step === i} onClick={() => setStep(i)}><span>0{i + 1}</span>{item.short}<ArrowRightIcon size={17} /></button>)}</div>
          <div className="premium-step-content" aria-live="polite">
            <div className="premium-step-copy"><span className="premium-eyebrow">Step 0{step + 1} / 04</span><h3>{steps[step].title}</h3><p>{steps[step].body}</p><button className="premium-text-link" onClick={() => setStep((step + 1) % 4)}>{step === 3 ? 'Start with an introduction' : 'Continue to the next step'} <ArrowRightIcon size={18} /></button></div>
            <div className="premium-step-visual"><div className="premium-step-visual-top"><MeritMark size={24} /><span>{steps[step].label}</span><span className="premium-step-status"><CheckIcon size={12} />{steps[step].status}</span></div><div className="premium-step-visual-center"><span className="premium-step-glyph" aria-hidden>{step === 0 ? <ArrowRightIcon size={34} /> : step === 1 ? <ShieldCheckIcon size={34} /> : step === 2 ? <LockIcon size={34} /> : <CheckIcon size={34} />}</span><h4>{steps[step].value}</h4><p>{steps[step].detail}</p></div><div className="premium-step-code"><span>{steps[step].code}</span><span>Illustrative workflow</span></div></div>
          </div>
        </div>
      </section>

      <section className="premium-connect premium-section premium-container" id="premium-connect" aria-labelledby="premium-connect-title">
        <div className="premium-section-intro"><div className="premium-eyebrow"><span className="premium-section-index">03</span> Merit Connect</div><div><h2 id="premium-connect-title">Your identity.<br /><span>Connected to our infrastructure.</span></h2><p>Merit is the record and the payout. Merit Connect brings them into the access portal you already run — or one we build together.</p></div></div>
        <div className="premium-connect-grid">
          <div className="premium-portal-scene">
            <div className="premium-portal-browser"><span /><span /><span /><div>Calder · Investor access</div><LockIcon size={12} /></div>
            <div className="premium-portal"><div className="premium-calder-brand"><span>C</span>Calder</div><div className="premium-portal-rule" /><span className="premium-portal-label">A considered approach to income</span><h3>Built for what<br />comes next.</h3><p>Calder Short-Duration<br />Income Fund</p><div className="premium-portal-intro"><span>Introduced by</span><strong>Raghunathan Family Office</strong></div><Go to="/i/CALDER-PR7?frame=phone" className="premium-portal-button">Explore the sample portal <ArrowRightIcon size={17} /></Go><div className="premium-portal-secure"><FingerprintIcon size={16} /> Your account. Your device.</div></div>
            <div className="premium-connect-label"><MeritMark size={20} /><span>Connected by Merit</span><CheckIcon size={14} /></div>
            <p className="premium-caption">Calder is a fictional manager. Shown in its own brand.</p>
          </div>
          <div className="premium-connect-copy"><h3>It feels like your fund.<br />Because it is.</h3><p>The investor sees the manager they trust. The adviser gets the recognition they earned. Your team keeps control of the relationship.</p><div className="premium-connect-item"><span>01</span><div><h4>Your brand, throughout</h4><p>Your portal, your onboarding and your client experience.</p></div></div><div className="premium-connect-item"><span>02</span><div><h4>Your approvals, respected</h4><p>Identity checks stay with you. Merit receives the approval signal.</p></div></div><div className="premium-connect-item"><span>03</span><div><h4>One connected book</h4><p>Advisers can track introductions across funds using Merit.</p></div></div><Go to="/i/CALDER-PR7?frame=phone" className="premium-text-link">Experience the investor journey <ArrowRightIcon size={18} /></Go></div>
        </div>
      </section>

      <section className="premium-foundation" id="premium-foundation" aria-labelledby="premium-foundation-title"><div className="premium-container premium-section"><div className="premium-section-intro"><div className="premium-eyebrow"><span className="premium-section-index">04</span> The foundation</div><div><h2 id="premium-foundation-title">Precise on the surface.<br /><span>Considered at every layer.</span></h2><p>A focused product on a shared network. Each layer has a clear job, from your investor’s first interaction to the fund’s final reconciliation.</p></div></div><div className="premium-layers"><div className="premium-layer-list" role="group" aria-label="Explore infrastructure layers">{layers.map((item, i) => <button className="premium-control" key={item.name} aria-pressed={layer === i} onClick={() => setLayer(i)}><span className="premium-layer-number">{item.number}</span><span><strong>{item.name}</strong><small>{item.owner}</small></span><ArrowRightIcon size={18} /></button>)}</div><div className="premium-layer-detail" aria-live="polite"><span className="premium-eyebrow">Layer {layers[layer].number} / {layers[layer].owner}</span><h3>{layers[layer].title}</h3><p>{layers[layer].copy}</p><div><ShieldCheckIcon size={18} /><span>{layers[layer].note}</span></div></div></div><div className="premium-foundation-foot"><span>Built on Stellar</span><p>Testnet demonstration. Introductions and investment amounts are public; adviser rates are not stored on the ledger. Payout-amount privacy is not yet guaranteed by the current verifier.</p></div></div></section>

      <section className="premium-close premium-container" aria-labelledby="premium-close-title"><div><div className="premium-eyebrow">See the whole relationship</div><h2 id="premium-close-title">Credit where<br />it’s due.</h2></div><div className="premium-close-action"><p>Follow an introduction.<br />See what changes when it counts.</p><Go to="/scout">Explore the adviser’s book <ArrowRightIcon size={18} /></Go><Go to="/issuer" className="premium-text-link">Open the fund’s ledger <ArrowRightIcon size={17} /></Go></div><MeritMark size={166} className="premium-close-mark" /></section>
      </main>
      <footer className="premium-footer premium-container"><div className="premium-footer-top"><a href={hrefFor('/')} className="premium-brand"><MeritMark size={24} /><span>Merit</span></a><span>Introductions count.</span><button className="premium-text-link" onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })}>Back to top <ArrowRightIcon size={14} className="premium-up-arrow" /></button></div><div className="premium-footer-bottom"><p>{MODE === 'live' ? 'Stellar testnet' : 'Interactive demonstration'}. Calder is fictional. All figures are illustrative.<br />Payouts are simulated in demo mode; live settlement uses a separate pipeline. No real funds.</p><span>Programme design & operations<br />by Co/Unity</span></div></footer>
    </div>
  );
}
