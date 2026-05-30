/**
 * Playwright DOM inspector for ProductManager click-blocking bug.
 * Logs in, navigates to /app/applications -> Settings tab,
 * then inspects the ProductManager card for overlay/pointer-events issues.
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:8080';
const EMAIL = 'basillowell@yahoo.com';
// We'll try sign-in; if auth page differs we'll handle it

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

// Capture console errors
page.on('console', msg => {
  if (msg.type() === 'error') console.log('[CONSOLE ERROR]', msg.text());
});

// ── 1. Load the app ───────────────────────────────────────────────────────
await page.goto(BASE, { waitUntil: 'networkidle' });
console.log('\n=== PAGE TITLE:', await page.title(), '===');

// ── 2. Sign in ────────────────────────────────────────────────────────────
// Try to find email input
const emailInput = page.locator('input[type="email"]').first();
const hasEmail = await emailInput.isVisible().catch(() => false);
if (hasEmail) {
  await emailInput.fill(EMAIL);
  // Use password from env or a placeholder — we'll see if the page has a password field
  const pwInput = page.locator('input[type="password"]').first();
  const hasPw = await pwInput.isVisible().catch(() => false);
  if (hasPw) {
    // We can't sign in without the password, so skip full auth
    console.log('[AUTH] Login form visible but cannot auto-authenticate without password.');
    console.log('[AUTH] Proceeding with DOM analysis on unauthenticated state if possible.');
  }
} else {
  console.log('[AUTH] No email input visible — may already be logged in or on different page.');
}

// ── 3. Navigate to applications page ─────────────────────────────────────
await page.goto(`${BASE}/app/applications`, { waitUntil: 'networkidle' });
console.log('\n=== APPLICATIONS PAGE TITLE:', await page.title(), '===');
console.log('[NAV] Current URL:', page.url());

// Check if we got redirected (auth guard)
const currentUrl = page.url();
if (!currentUrl.includes('/app/applications')) {
  console.log('[REDIRECT] Got redirected to:', currentUrl);
  console.log('[INFO] App requires authentication — analyzing DOM from landing page instead');

  // Still check the global DOM for any problematic overlays
  const bodyInert = await page.evaluate(() => document.body.hasAttribute('inert'));
  const bodyAriaHidden = await page.evaluate(() => document.body.getAttribute('aria-hidden'));
  console.log('\n[BODY] inert:', bodyInert, '| aria-hidden:', bodyAriaHidden);
}

// ── 4. Look for the Settings tab and click it ─────────────────────────────
const settingsTab = page.getByRole('button', { name: 'Settings' }).first();
const hasSettingsTab = await settingsTab.isVisible().catch(() => false);
if (hasSettingsTab) {
  await settingsTab.click();
  await page.waitForTimeout(1000);
  console.log('\n[CLICK] Clicked Settings tab');
}

// ── 5. Find the ProductManager card ───────────────────────────────────────
const productSection = page.locator('text=Products').first();
const hasProducts = await productSection.isVisible().catch(() => false);
console.log('[PRODUCTS] ProductManager visible:', hasProducts);

// ── 6. Check body-level inert/aria-hidden ────────────────────────────────
const domAnalysis = await page.evaluate(() => {
  const results = {
    bodyInert: document.body.hasAttribute('inert'),
    bodyAriaHidden: document.body.getAttribute('aria-hidden'),
    htmlInert: document.documentElement.hasAttribute('inert'),
    dialogsOpen: [...document.querySelectorAll('[role="dialog"]')].map(d => ({
      tagName: d.tagName,
      ariaHidden: d.getAttribute('aria-hidden'),
      inert: d.hasAttribute('inert'),
      dataState: d.getAttribute('data-state'),
      classes: d.className.slice(0, 100),
    })),
    // Check for fixed overlays
    fixedOverlays: [...document.querySelectorAll('*')].filter(el => {
      const style = window.getComputedStyle(el);
      return style.position === 'fixed' && el !== document.documentElement;
    }).map(el => ({
      tag: el.tagName,
      id: el.id,
      classes: el.className.slice(0, 120),
      zIndex: window.getComputedStyle(el).zIndex,
      pointerEvents: window.getComputedStyle(el).pointerEvents,
      opacity: window.getComputedStyle(el).opacity,
      display: window.getComputedStyle(el).display,
      width: el.getBoundingClientRect().width,
      height: el.getBoundingClientRect().height,
      top: el.getBoundingClientRect().top,
      left: el.getBoundingClientRect().left,
    })),
    // Check for any inert elements anywhere
    inertElements: [...document.querySelectorAll('[inert]')].map(el => ({
      tag: el.tagName,
      id: el.id,
      classes: el.className.slice(0, 100),
    })),
    // Check for aria-hidden on major containers
    ariaHiddenContainers: [...document.querySelectorAll('[aria-hidden="true"]')].map(el => ({
      tag: el.tagName,
      id: el.id,
      classes: el.className.slice(0, 100),
    })),
  };
  return results;
});

console.log('\n=== DOM ANALYSIS ===');
console.log('body.inert:', domAnalysis.bodyInert);
console.log('body[aria-hidden]:', domAnalysis.bodyAriaHidden);
console.log('html.inert:', domAnalysis.htmlInert);
console.log('\nOpen dialogs:', JSON.stringify(domAnalysis.dialogsOpen, null, 2));
console.log('\nInert elements:', JSON.stringify(domAnalysis.inertElements, null, 2));
console.log('\nAria-hidden containers:', JSON.stringify(domAnalysis.ariaHiddenContainers, null, 2));

console.log('\n=== FIXED OVERLAYS (sorted by z-index) ===');
const sorted = domAnalysis.fixedOverlays
  .filter(o => o.display !== 'none')
  .sort((a, b) => (parseInt(b.zIndex) || 0) - (parseInt(a.zIndex) || 0));
sorted.forEach(o => {
  console.log(`[z:${o.zIndex}] ${o.tag}.${o.classes.slice(0,60)} | ptr:${o.pointerEvents} | opacity:${o.opacity} | ${Math.round(o.width)}x${Math.round(o.height)} @ (${Math.round(o.left)},${Math.round(o.top)})`);
});

// ── 7. If we can find an Edit button, check what's above it ──────────────
const editBtn = page.locator('button', { hasText: 'Edit' }).first();
const hasEditBtn = await editBtn.isVisible().catch(() => false);
console.log('\n[EDIT BUTTON] Visible:', hasEditBtn);

if (hasEditBtn) {
  const editBtnAnalysis = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Edit');
    if (!btn) return { found: false };

    const rect = btn.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // elementFromPoint at the button's center
    const topElement = document.elementFromPoint(centerX, centerY);
    const topElInfo = topElement ? {
      tag: topElement.tagName,
      id: topElement.id,
      classes: topElement.className.slice(0, 150),
      isTheSameButton: topElement === btn || btn.contains(topElement) || topElement.contains(btn),
    } : null;

    // Walk up the button's ancestors, checking computed styles
    const ancestors = [];
    let el = btn.parentElement;
    while (el && el !== document.body) {
      const style = window.getComputedStyle(el);
      const interesting =
        style.pointerEvents === 'none' ||
        parseFloat(style.opacity) < 1 ||
        el.hasAttribute('inert') ||
        el.getAttribute('aria-hidden') === 'true' ||
        el.hasAttribute('disabled');
      ancestors.push({
        tag: el.tagName,
        id: el.id,
        classes: el.className.slice(0, 100),
        pointerEvents: style.pointerEvents,
        opacity: style.opacity,
        inert: el.hasAttribute('inert'),
        ariaHidden: el.getAttribute('aria-hidden'),
        disabled: el.hasAttribute('disabled'),
        interesting,
      });
      el = el.parentElement;
    }

    // Check the button itself
    const btnStyle = window.getComputedStyle(btn);
    return {
      found: true,
      button: {
        rect,
        disabled: btn.disabled,
        ariaDisabled: btn.getAttribute('aria-disabled'),
        pointerEvents: btnStyle.pointerEvents,
        opacity: btnStyle.opacity,
        type: btn.type,
      },
      topElementAtClickPoint: topElInfo,
      interestingAncestors: ancestors.filter(a => a.interesting),
      allAncestors: ancestors,
    };
  });

  console.log('\n=== EDIT BUTTON ANALYSIS ===');
  console.log('Button disabled:', editBtnAnalysis.button?.disabled);
  console.log('Button aria-disabled:', editBtnAnalysis.button?.ariaDisabled);
  console.log('Button pointer-events:', editBtnAnalysis.button?.pointerEvents);
  console.log('Button opacity:', editBtnAnalysis.button?.opacity);
  console.log('Button type:', editBtnAnalysis.button?.type);

  console.log('\nElement at click point:', JSON.stringify(editBtnAnalysis.topElementAtClickPoint, null, 2));
  console.log('Is the right element receiving clicks:', editBtnAnalysis.topElementAtClickPoint?.isTheSameButton);

  console.log('\nInteresting ancestors (opacity<1, pointer-events:none, inert, aria-hidden):');
  (editBtnAnalysis.interestingAncestors || []).forEach(a => {
    console.log(`  ${a.tag}#${a.id}.${a.classes.slice(0,60)} → ptr:${a.pointerEvents} opacity:${a.opacity} inert:${a.inert} aria-hidden:${a.ariaHidden} disabled:${a.disabled}`);
  });

  if ((editBtnAnalysis.interestingAncestors || []).length === 0) {
    console.log('  (none — no blocking ancestors found)');
  }

  console.log('\nAll ancestors:');
  (editBtnAnalysis.allAncestors || []).forEach(a => {
    console.log(`  ${a.tag}.${a.classes.slice(0,80)} ptr:${a.pointerEvents} opacity:${a.opacity}`);
  });
}

// ── 8. Check Add Product button too ──────────────────────────────────────
const addBtn = page.locator('button', { hasText: 'Add Product' }).first();
const hasAddBtn = await addBtn.isVisible().catch(() => false);
console.log('\n[ADD PRODUCT BUTTON] Visible:', hasAddBtn);
if (hasAddBtn) {
  const addBtnProps = await addBtn.evaluate(btn => ({
    disabled: btn.disabled,
    ariaDisabled: btn.getAttribute('aria-disabled'),
    pointerEvents: window.getComputedStyle(btn).pointerEvents,
    opacity: window.getComputedStyle(btn).opacity,
    type: btn.type,
    textContent: btn.textContent?.trim(),
  }));
  console.log('Add Product button props:', addBtnProps);
}

await browser.close();
console.log('\n=== INSPECTION COMPLETE ===');
