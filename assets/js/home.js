/* The homepage: cycling game images, the composer's typed examples, and the
   invite-only reply that saves a visitor's idea to the waitlist.
   Plan: modules/ai/docs/design/site_composer_handoff.md in the engine repo.
   The Worker side is modules/ai/backend/worker/src/waitlist.js. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var config = {};
  try { config = JSON.parse($('home-config').textContent); } catch (e) { /* defaults below */ }
  var IDEAS = (config.ideas && config.ideas.length) ? config.ideas : ['a 3D platformer'];
  var ENDPOINT = config.waitlist || '/waitlist';
  var TS_KEY = config.turnstile || '';

  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  /* ---- the games: stills that cycle every 4 s ---------------------------- */
  var imgs = document.querySelectorAll('#show img');
  var i = 0, timer = null, paused = reduce;
  var PLAY = '<path d="M3 1.5v9l7.5-4.5z"/>';
  var PAUSE = '<rect x="1.5" y="1" width="3" height="10" rx=".6"/><rect x="7.5" y="1" width="3" height="10" rx=".6"/>';

  function showGame(n) {
    if (!imgs.length) return;
    imgs[i].classList.remove('on');
    i = (n + imgs.length) % imgs.length;
    var img = imgs[i];
    img.classList.add('on');
    var title = $('cap-title');
    title.textContent = img.getAttribute('data-title');
    title.href = img.getAttribute('data-play');
    $('cap-meta').textContent = img.getAttribute('data-meta');
  }
  function startShow() { stopShow(); if (imgs.length > 1) timer = setInterval(function () { showGame(i + 1); }, 4000); }
  function stopShow() { if (timer) clearInterval(timer); timer = null; }

  /* ---- the composer's typed examples ------------------------------------- */
  var input = $('idea'), ghost = $('ghost'), send = $('send');
  var k = 0, pos = 0, dir = 1, typeTimer = null, typing = false;

  function tick() {
    var s = IDEAS[k];
    if (dir > 0) {
      pos++;
      ghost.textContent = s.slice(0, pos);
      if (pos >= s.length) { dir = -1; return later(3000); }   // hold long enough to read
      return later(55);
    }
    pos--;
    ghost.textContent = s.slice(0, pos);
    if (pos <= 0) { dir = 1; k = (k + 1) % IDEAS.length; return later(500); }
    later(22);
  }
  function later(ms) { typeTimer = setTimeout(tick, ms); }
  function startTyping() {
    if (typing || input.value || paused || document.activeElement === input) return;
    typing = true; ghost.classList.remove('hidden'); pos = 0; dir = 1; ghost.textContent = ''; later(400);
  }
  function stopTyping() { typing = false; clearTimeout(typeTimer); ghost.classList.add('hidden'); }

  // One control pauses everything that moves (WCAG 2.2.2).
  var pauseBtn = $('pause');
  function setPaused(p) {
    paused = p;
    $('pause-icon').innerHTML = p ? PLAY : PAUSE;
    pauseBtn.setAttribute('aria-label', p ? 'Play' : 'Pause');
    if (p) {
      stopShow();
      if (typing) { clearTimeout(typeTimer); typing = false; ghost.textContent = IDEAS[k]; }
    } else {
      startShow();
      stopTyping();
      startTyping();
    }
  }
  pauseBtn.addEventListener('click', function () { setPaused(!paused); });

  input.addEventListener('focus', stopTyping);
  input.addEventListener('blur', function () { if (!input.value) setTimeout(startTyping, 1500); });
  input.addEventListener('input', function () { send.disabled = !input.value.trim(); });
  input.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    // An empty Enter sends nothing: the example has already cleared on focus,
    // and the cursor stays in the field. The example is never a value.
    if (input.value.trim()) submitIdea();
  });
  send.addEventListener('click', submitIdea);

  /* ---- the reply thread ---------------------------------------------------- */
  var idea = '';

  // A reply arrives after a short beat, the way a chat answer does. The dots
  // sit where the reply will appear (just before `anchor`), and go when both
  // the beat and `waitFor` are done. Resolves with what `waitFor` resolved to.
  function typingBeat(anchor, waitFor) {
    var dots = $('dots');
    $('thread').insertBefore(dots, $(anchor));
    dots.classList.remove('hidden');
    var beat = new Promise(function (r) { setTimeout(r, reduce ? 0 : 700); });
    return Promise.all([beat, waitFor || null]).then(function (out) {
      dots.classList.add('hidden');
      return out[1];
    });
  }

  function submitIdea() {
    var v = input.value.trim();
    if (!v) { input.focus(); return; }
    idea = v;
    stopTyping();
    $('echo').textContent = v;
    $('composer').classList.add('hidden');
    $('thread').classList.remove('hidden');
    typingBeat('r1').then(function () {
      $('r1').classList.remove('hidden');
      renderTurnstile();
      $('email').focus();
    });
  }

  /* ---- the bot check ------------------------------------------------------- */
  // Rendered when the email form appears, in 'interaction-only' mode, so most
  // visitors never see it. The Worker refuses a request without a valid token.
  //
  // Three states matter, because each needs a different sentence:
  //   a token is ready            -> send it
  //   Cloudflare wants a tick     -> say so and keep the form (never time out)
  //   the check could not run     -> say so, and send nothing
  var TICK = 'Tick the box below to show you are a person, then press Save.';
  var BROKEN = 'The check that keeps out spam did not load. Reload the page and try again.';
  var widgetId = null, token = '', needsTick = false, broken = false, waiters = [];
  function renderTurnstile() {
    if (!TS_KEY || widgetId !== null) return;
    if (!window.turnstile) {                       // script still loading
      if (!renderTurnstile.waited) renderTurnstile.waited = Date.now();
      if (Date.now() - renderTurnstile.waited > 15000) { broken = true; flushToken(); return; }
      setTimeout(renderTurnstile, 200);
      return;
    }
    widgetId = window.turnstile.render('#ts', {
      sitekey: TS_KEY,
      action: 'waitlist',
      appearance: 'interaction-only',
      callback: function (t) { token = t; needsTick = false; broken = false; hideError(TICK); flushToken(); },
      'expired-callback': function () { token = ''; },
      'before-interactive-callback': function () { needsTick = true; flushToken(); },
      'error-callback': function () { token = ''; broken = true; flushToken(); return true; }
    });
  }
  function flushToken() { var w = waiters; waiters = []; w.forEach(function (r) { r(); }); }
  // Resolves to the token, or to '' with needsTick/broken saying why not.
  function getToken() {
    return new Promise(function (resolve) {
      if (!TS_KEY || token || needsTick || broken) return resolve(token);
      waiters.push(function () { resolve(token); });
      // Without a tick and without an error, a token normally comes in a second
      // or two. Past 15 s something is wrong; say so rather than hang.
      setTimeout(function () { if (!token && !needsTick) broken = true; flushToken(); }, 15000);
    });
  }
  function spendToken() {
    // A token works once. Whatever the answer, the next try needs a new one.
    token = '';
    broken = false;
    if (widgetId !== null && window.turnstile) window.turnstile.reset(widgetId);
  }

  /* ---- saving the idea ---------------------------------------------------- */
  var GENERIC = 'Something went wrong at our end, and your idea was not saved. Try again in a minute.';
  var form = $('email-form'), emailInput = $('email'), saveBtn = $('save'), errorLine = $('form-error');

  function showError(message) {
    errorLine.textContent = message;
    errorLine.classList.remove('hidden');
  }
  function hideError(onlyIf) {
    if (!onlyIf || errorLine.textContent === onlyIf) errorLine.classList.add('hidden');
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = emailInput.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError('That address does not look right. Check it and try again.');
      emailInput.focus();
      return;
    }
    errorLine.classList.add('hidden');
    if (TS_KEY && !token && needsTick) {           // Cloudflare is waiting for a tick
      showError(TICK);
      return;
    }
    saveBtn.disabled = true;

    var saved = getToken().then(function (t) {
      // No token: tell the person what to do instead of sending a request the
      // Worker is certain to refuse.
      if (TS_KEY && !t) return { ok: false, message: needsTick ? TICK : BROKEN, local: true };
      return fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentence: idea, email: email, turnstile: t })
      }).then(function (res) {
        return res.json().catch(function () { return null; });
      });
    }).catch(function () { return null; }).then(function (body) {
      if (!(body && body.local)) spendToken();   // a token that was never sent is still good
      return body;
    });

    form.classList.add('hidden');
    $('email-echo').textContent = email;
    $('me2').classList.remove('hidden');

    typingBeat('r2', saved).then(function (body) {
      saveBtn.disabled = false;
      if (body && body.ok) {
        $('r2').classList.remove('hidden');
        return;
      }
      // Put the form back where it was, say what went wrong, keep the address.
      $('me2').classList.add('hidden');
      form.classList.remove('hidden');
      showError((body && body.message) || GENERIC);
      emailInput.focus();
    });
  });

  /* ---- start ------------------------------------------------------------------ */
  if (reduce) {
    setPaused(true);
    ghost.classList.remove('hidden');
    ghost.textContent = IDEAS[0];
  } else {
    startShow();
    startTyping();
  }
})();
