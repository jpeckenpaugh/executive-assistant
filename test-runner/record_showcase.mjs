import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const DEMOS_DIR = path.join(REPO_ROOT, 'demos/latest');
const GALLERY_DIR = path.join(DEMOS_DIR, 'gallery');

const sm3Playwright = path.resolve(REPO_ROOT, '../sm3/node_modules/playwright/index.mjs');
const { chromium } = await import(sm3Playwright);

// 1. Cursor simulation helper
async function injectCursor(page) {
  await page.evaluate(() => {
    if (document.getElementById('demo-cursor')) return;
    const c = document.createElement('div');
    c.id = 'demo-cursor';
    c.style.position = 'fixed';
    c.style.top = '0';
    c.style.left = '0';
    c.style.width = '18px';
    c.style.height = '18px';
    c.style.borderRadius = '50%';
    c.style.backgroundColor = 'rgba(49, 93, 155, 0.88)';
    c.style.border = '2px solid #ffffff';
    c.style.boxShadow = '0 0 16px rgba(49, 93, 155, 0.95)';
    c.style.pointerEvents = 'none';
    c.style.zIndex = '99999999';
    c.style.transform = 'translate(-50%, -50%)';
    c.style.transition = 'width 0.12s ease, height 0.12s ease, background-color 0.12s ease';
    document.body.appendChild(c);
    window.__setCursor = (x, y) => {
      c.style.left = `${x}px`;
      c.style.top = `${y}px`;
    };
  });
}

async function smoothMove(page, targetX, targetY, steps = 16, delayMs = 15) {
  await page.mouse.move(targetX, targetY, { steps });
  await page.evaluate(({ x, y }) => window.__setCursor?.(x, y), { x: targetX, y: targetY });
  if (delayMs > 0) await page.waitForTimeout(delayMs);
}

async function smoothClick(page, target, steps = 14) {
  let locator;
  if (typeof target === 'string') {
    locator = page.locator(target).first();
  } else if (target && typeof target.scrollIntoViewIfNeeded === 'function') {
    locator = target;
  } else if (target && typeof target.first === 'function') {
    locator = target.first();
  }

  let box;
  if (locator) {
    try {
      await locator.scrollIntoViewIfNeeded();
      await page.waitForTimeout(60);
    } catch (_) {}
    box = await locator.boundingBox();
  } else if (target && typeof target.x === 'number') {
    box = target;
  }

  if (!box) {
    console.warn('[smoothClick] Warning: target element bounding box was null for:', target);
    return;
  }

  const targetX = box.x + box.width / 2;
  const targetY = box.y + box.height / 2;
  await smoothMove(page, targetX, targetY, steps);
  await page.evaluate(() => {
    const c = document.getElementById('demo-cursor');
    if (c) {
      c.style.width = '13px';
      c.style.height = '13px';
      c.style.backgroundColor = 'rgba(239, 68, 68, 0.95)';
    }
  });
  await page.waitForTimeout(100);
  await page.mouse.click(targetX, targetY);
  await page.evaluate(() => {
    const c = document.getElementById('demo-cursor');
    if (c) {
      c.style.width = '18px';
      c.style.height = '18px';
      c.style.backgroundColor = 'rgba(49, 93, 155, 0.88)';
    }
  });
  await page.waitForTimeout(150);
}

async function smoothType(page, selector, text, delayMs = 26) {
  await smoothClick(page, selector);
  for (const char of text) {
    await page.keyboard.type(char, { delay: delayMs });
  }
  await page.waitForTimeout(120);
}

async function generateWebPThumbnail(browser, sourcePngPath, outWebPPath) {
  console.log(`[Thumbnail] Generating WebP from ${sourcePngPath}...`);
  const page = await browser.newPage();
  const pngDataUrl = `data:image/png;base64,${fs.readFileSync(sourcePngPath).toString('base64')}`;

  const webpBase64 = await page.evaluate(async (dataUrl) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 450;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const webpData = canvas.toDataURL('image/webp', 0.88);
        resolve(webpData.split(',')[1]);
      };
      img.src = dataUrl;
    });
  }, pngDataUrl);

  fs.writeFileSync(outWebPPath, Buffer.from(webpBase64, 'base64'));
  await page.close();
  console.log(`[Thumbnail] Saved WebP (${fs.statSync(outWebPPath).size} bytes) to ${outWebPPath}`);
}

async function main() {
  fs.mkdirSync(GALLERY_DIR, { recursive: true });

  console.log('[Playwright] Launching Chromium 1280x720 video recording...');
  const browser = await chromium.launch({ headless: true });

  const tempVideoDir = path.join(DEMOS_DIR, '__temp_video');
  fs.mkdirSync(tempVideoDir, { recursive: true });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: tempVideoDir,
      size: { width: 1280, height: 720 },
    },
  });

  const page = await context.newPage();
  const startTime = Date.now();

  // Intercept dialog prompts for inbox atomic processing
  page.on('dialog', async (dialog) => {
    const msg = dialog.message();
    console.log(`[Dialog] Handled: "${msg}"`);
    if (msg.includes('Process as:')) {
      await dialog.accept('task');
    } else if (msg.includes('Title (optional)')) {
      await dialog.accept('Clarify partner launch dates with Jordan');
    } else if (msg.includes('Priority:')) {
      await dialog.accept('high');
    } else if (msg.includes('Reset sample records?')) {
      await dialog.accept();
    } else {
      await dialog.accept();
    }
  });

  // Mock Gemini API route for the AI command bar
  await page.route('https://generativelanguage.googleapis.com/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    actions: [
                      {
                        type: 'commitment',
                        data: {
                          title: 'Board Strategy Sync',
                          kind: 'meeting',
                          starts_at: '2026-10-19T10:00',
                          duration_minutes: 60,
                          location: 'Executive Boardroom',
                          attendees: 'Sarah Chen (COO), David Marcus (CFO)',
                          notes: 'Q4 Roadmap, Capital Review & Executive Alignment'
                        }
                      },
                      {
                        type: 'task',
                        data: {
                          title: 'Prepare Q4 Capital Review Dossier',
                          priority: 'high',
                          due_at: '2026-10-19T09:00',
                          recurrence: 'none',
                          description: 'Compile executive balance model & slides for Sarah Chen'
                        }
                      }
                    ]
                  })
                }
              ]
            }
          }
        ]
      })
    });
  });

  try {
    console.log('[Recording] Navigating to https://jpeckenpaugh.github.io/executive-assistant/ ...');
    await page.goto('https://jpeckenpaugh.github.io/executive-assistant/', { waitUntil: 'networkidle' });

    // Seed AI config for seamless natural language execution
    await page.evaluate(() => {
      localStorage.setItem('ea_ai_config', JSON.stringify({
        provider: 'gemini',
        apiKey: 'demo-gemini-key',
        customEndpoint: ''
      }));
    });

    await injectCursor(page);
    await page.evaluate(() => window.__setCursor?.(640, 360));
    await page.waitForTimeout(500);

    // -------------------------------------------------------------------
    // Beat 1: Daily Briefing Dashboard & Executive Cockpit (0.0s - 4.5s)
    // -------------------------------------------------------------------
    console.log('[1/6] Capturing Daily Briefing Dashboard & Executive Cockpit...');
    // Scan metric cards
    await smoothMove(page, 240, 160, 14); // Pending inbox card
    await page.waitForTimeout(500);
    await smoothMove(page, 640, 160, 14); // Overdue tasks card
    await page.waitForTimeout(500);
    await smoothMove(page, 1040, 160, 14); // Active reminders card
    await page.waitForTimeout(500);

    // Spotlight high-priority schedule queue
    await smoothMove(page, 340, 320, 12);
    await page.waitForTimeout(600);

    const still1 = path.join(GALLERY_DIR, '01-daily-briefing-cockpit.png');
    await page.screenshot({ path: still1 });
    console.log(`  -> Saved ${path.basename(still1)}`);

    // -------------------------------------------------------------------
    // Beat 2: Calendar Scheduling & Advisory Overlap Alert (4.5s - 10.5s)
    // -------------------------------------------------------------------
    console.log('[2/6] Navigating to Commitments & Creating Overlapping Meeting...');
    await smoothClick(page, 'a.nav-link:has-text("Commitments")');
    await page.waitForTimeout(400);

    await smoothClick(page, 'button[data-go="/commitments/new"]');
    await page.waitForTimeout(400);

    // Fill commitment details that intentionally collide with existing Product planning (starts_at 00:16)
    await smoothType(page, 'form[data-form-type="commitments"] input[name="title"]', 'Q4 Strategic Capital Allocation', 18);
    await page.locator('form[data-form-type="commitments"] input[name="starts_at"]').fill('2026-10-19T00:16');
    await page.locator('form[data-form-type="commitments"] input[name="duration_minutes"]').fill('60');
    await page.locator('form[data-form-type="commitments"] input[name="location"]').fill('Executive Boardroom');
    await page.locator('form[data-form-type="commitments"] input[name="attendees"]').fill('Sarah Chen (COO), David Marcus (CFO)');
    await page.waitForTimeout(300);

    // Click save commitment
    const saveCommitmentBtn = page.locator('form[data-form-type="commitments"] button.btn-primary');
    await smoothClick(page, saveCommitmentBtn);
    await page.waitForSelector('#flash .alert', { timeout: 4000 });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await page.waitForTimeout(500);

    // Spotlight conflict alert notice
    await smoothMove(page, 640, 110, 12);
    await page.waitForTimeout(700);

    const still2 = path.join(GALLERY_DIR, '02-calendar-conflict-detection.png');
    await page.screenshot({ path: still2 });
    console.log(`  -> Saved ${path.basename(still2)}`);

    // -------------------------------------------------------------------
    // Beat 3: Quick-Capture Inbox & Atomic Triage Processing (10.5s - 15.5s)
    // -------------------------------------------------------------------
    console.log('[3/6] Navigating to Inbox & Executing Atomic Triage...');
    await smoothClick(page, 'a.nav-link:has-text("Inbox")');
    await page.waitForTimeout(500);

    // Move cursor over pending item and capture screenshot before triggering
    const firstProcessBtn = page.locator('button[data-action="process"]').first();
    const pBox = await firstProcessBtn.boundingBox();
    if (pBox) {
      await smoothMove(page, pBox.x + pBox.width / 2, pBox.y + pBox.height / 2, 12);
    }
    await page.waitForTimeout(500);

    const still3 = path.join(GALLERY_DIR, '03-atomic-inbox-triage.png');
    await page.screenshot({ path: still3 });
    console.log(`  -> Saved ${path.basename(still3)}`);

    // Trigger process dialog
    await firstProcessBtn.click();
    await page.waitForTimeout(800);

    // -------------------------------------------------------------------
    // Beat 4: Task Execution & Priority Management (15.5s - 20.5s)
    // -------------------------------------------------------------------
    console.log('[4/6] Navigating to Tasks & Demonstrating Task Progression...');
    await smoothClick(page, 'a.nav-link:has-text("Tasks")');
    await page.waitForTimeout(500);

    // Hover over tasks list
    await smoothMove(page, 400, 240, 12);
    await page.waitForTimeout(500);

    const still4 = path.join(GALLERY_DIR, '04-task-delegation-recurrence.png');
    await page.screenshot({ path: still4 });
    console.log(`  -> Saved ${path.basename(still4)}`);

    // Complete an open task
    const completeTaskBtn = page.locator('button[data-action="complete"]').first();
    if (await completeTaskBtn.isVisible()) {
      await smoothClick(page, completeTaskBtn);
      await page.waitForTimeout(700);
    }

    // -------------------------------------------------------------------
    // Beat 5: Natural Language AI Command Bar Execution (20.5s - 26.0s)
    // -------------------------------------------------------------------
    console.log('[5/6] Invoking AI Natural Language Command Bar...');
    await smoothClick(page, '#ai-command-input');
    await smoothType(page, '#ai-command-input', 'Schedule Board Strategy Sync tomorrow 10am and prep review dossier', 16);
    await page.waitForTimeout(200);

    await smoothClick(page, '#ai-command-form button[type="submit"]');
    await page.waitForSelector('#ai-command-modal', { timeout: 4000 });
    await page.waitForTimeout(600);

    // Inspect AI-generated structured action items in modal
    await smoothMove(page, 640, 310, 12);
    await page.waitForTimeout(600);

    const still5 = path.join(GALLERY_DIR, '05-ai-command-preview-modal.png');
    await page.screenshot({ path: still5 });
    console.log(`  -> Saved ${path.basename(still5)}`);

    // Confirm and execute AI actions into SQLite
    await smoothClick(page, '#ai-command-confirm-btn');
    await page.waitForTimeout(800);

    // -------------------------------------------------------------------
    // Beat 6: Local SQLite OPFS Workspace & Management (26.0s - 30.5s)
    // -------------------------------------------------------------------
    console.log('[6/6] Navigating to Local SQLite Workspace Tab...');
    await smoothClick(page, 'a.nav-link:has-text("Workspace")');
    await page.waitForTimeout(500);

    // Spotlight OPFS stats
    await smoothMove(page, 460, 215, 12);
    await page.waitForTimeout(600);

    const still6 = path.join(GALLERY_DIR, '06-opfs-sqlite-workspace.png');
    await page.screenshot({ path: still6 });
    console.log(`  -> Saved ${path.basename(still6)}`);

    // Hold steady until exact 30.5s mark
    const elapsed = Date.now() - startTime;
    const targetDurationMs = 30500;
    const remainingMs = targetDurationMs - elapsed;
    if (remainingMs > 0) {
      console.log(`[Hold] Holding final steady state for ${(remainingMs / 1000).toFixed(1)}s to complete 30.5s recording...`);
      await page.waitForTimeout(remainingMs);
    }
  } catch (err) {
    console.error('[Error during recording]', err);
    throw err;
  } finally {
    const videoObj = page.video();
    await context.close();
    await browser.close();

    const rawVideoPath = await videoObj.path();
    console.log(`[Video] Raw recording saved at: ${rawVideoPath}`);

    const finalWebM = path.join(DEMOS_DIR, 'demo.webm');
    const ffmpegMac = path.resolve(process.env.HOME, 'Library/Caches/ms-playwright/ffmpeg-1013/ffmpeg-mac');

    if (fs.existsSync(ffmpegMac)) {
      console.log(`[FFmpeg] Transcoding video with VP9 to exact 30.5s duration...`);
      await new Promise((resolve, reject) => {
        const proc = spawn(ffmpegMac, [
          '-y',
          '-i', rawVideoPath,
          '-t', '30.5',
          '-c:v', 'libvpx-vp9',
          '-b:v', '750k',
          '-crf', '32',
          '-an',
          finalWebM
        ], { stdio: 'inherit' });
        proc.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`FFmpeg exited with code ${code}`));
        });
      });
    } else {
      console.log(`[Video] Moving raw WebM to ${finalWebM}...`);
      fs.copyFileSync(rawVideoPath, finalWebM);
    }

    try {
      fs.rmSync(tempVideoDir, { recursive: true, force: true });
    } catch (_) {}

    // Generate Card Thumbnail WebP
    const helperBrowser = await chromium.launch({ headless: true });
    try {
      const sourceStill = path.join(GALLERY_DIR, '01-daily-briefing-cockpit.png');
      const cardThumbWebP = path.join(DEMOS_DIR, 'thumb.webp');
      await generateWebPThumbnail(helperBrowser, sourceStill, cardThumbWebP);

      const netfixThumb = path.resolve(REPO_ROOT, '../thumbnails/executive-assistant.webp');
      const betaThumb = path.resolve(REPO_ROOT, '../beta-livive-net/thumbnails/executive-assistant.webp');
      const liviveThumb = path.resolve(REPO_ROOT, '../livive-net/thumbnails/executive-assistant.webp');

      for (const tPath of [netfixThumb, betaThumb, liviveThumb]) {
        if (fs.existsSync(path.dirname(tPath))) {
          fs.copyFileSync(cardThumbWebP, tPath);
          console.log(`[Thumbnail] Copied to ${tPath}`);
        }
      }

      // Also copy finalWebM to livive-net/previews if directory exists
      const livivePreview = path.resolve(REPO_ROOT, '../livive-net/previews/executive-assistant.webm');
      if (fs.existsSync(path.dirname(livivePreview))) {
        fs.copyFileSync(finalWebM, livivePreview);
        console.log(`[Preview Video] Copied to ${livivePreview}`);
      }
    } finally {
      await helperBrowser.close();
    }

    console.log('\n======================================================');
    console.log('SUCCESS: All Executive Assistant showcase assets captured!');
    console.log(`  - Video: ${finalWebM} (${(fs.statSync(finalWebM).size / 1024 / 1024).toFixed(2)} MB)`);
    for (const f of fs.readdirSync(GALLERY_DIR).sort()) {
      const p = path.join(GALLERY_DIR, f);
      console.log(`  - Gallery: ${f} (${(fs.statSync(p).size / 1024).toFixed(1)} KB)`);
    }
    console.log('======================================================\n');
  }
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
