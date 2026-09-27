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
  var widgetId = null, token = '', waiters = [];
  function renderTurnstile() {
    if (!TS_KEY || widgetId !== null) return;
    if (!window.turnstile) { setTimeout(renderTurnstile, 200); return; }   // script still loading
    widgetId = window.turnstile.render('#ts', {
      sitekey: TS_KEY,
      action: 'waitlist',
      appearance: 'interaction-only',
      callback: function (t) { token = t; flushToken(); },
      'expired-callback': function () { token = ''; },
      'error-callback': function () { token = ''; flushToken(); }
    });
  }
  function flushToken() { var w = waiters; waiters = []; w.forEach(function (r) { r(token); }); }
  function getToken() {
    return new Promise(function (resolve) {
      if (!TS_KEY || token) return resolve(token);
      waiters.push(resolve);
      setTimeout(flushToken, 15000);   // never hang the form on a stuck widget
    });
  }
  function spendToken() {
    // A token works once. Whatever the answer, the next try needs a new one.
    token = '';
    if (widgetId !== null && window.turnstile) window.turnstile.reset(widgetId);
  }

  /* ---- saving the idea ---------------------------------------------------- */
  var GENERIC = 'Something went wrong at our end, and your idea was not saved. Try again in a minute.';
  var form = $('email-form'), emailInput = $('email'), saveBtn = $('save'), errorLine = $('form-error');

  function showError(message) {
    errorLine.textContent = message;
    errorLine.classList.remove('hidden');
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
    saveBtn.disabled = true;

    var saved = getToken().then(function (t) {
      return fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentence: idea, email: email, turnstile: t })
      }).then(function (res) {
        return res.json().catch(function () { return null; });
      });
    }).catch(function () { return null; }).then(function (body) {
      spendToken();
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
