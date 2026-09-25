// Genera web/img/og-card.jpg (1200x630) desde og-card.html. Uso: node web-plantillas/og-card.js
// Requiere Playwright (en el entorno de Claude ya está instalado de forma global).
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); }
(async () => {
  const b = await pw.chromium.launch(process.env.PLAYWRIGHT_BROWSERS_PATH ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  // Las fuentes de Google se descargan con curl (así también funciona detrás de un proxy)
  const { execFileSync } = require('child_process');
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => {
    const cuerpo = execFileSync('curl', ['-sL', '-A', 'Mozilla/5.0 Chrome/120', r.request().url()], { maxBuffer: 64 * 1024 * 1024 });
    r.fulfill({ status: 200, body: cuerpo, contentType: /googleapis/.test(r.request().url()) ? 'text/css' : 'font/ttf', headers: { 'access-control-allow-origin': '*' } });
  });
  await p.goto('file://' + path.join(__dirname, 'og-card.html'));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(__dirname, '..', 'web', 'img', 'og-card.jpg'), type: 'jpeg', quality: 88 });
  await b.close();
  console.log('Listo: web/img/og-card.jpg');
})();
