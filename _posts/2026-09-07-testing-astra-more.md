---
layout: post
title: "Testing Astra More"
date: 2026-09-07
---

I was so excited with the results from our [previous Astra test]({% post_url 2026-09-07-moba-test %}) that I made some more.

They're all playable here, with a timelapse of the AI making them.

All the prompts were very simple, given to GPT 6 Astra on XHigh:

Please make me Wardogs/Battlefield

<div class="game-embed">
  <div class="game-frame">
    <button class="game-poster" type="button" aria-label="Play Iron Front"
            data-game-src="{{ '/games/ironfront/' | relative_url }}">
      <img src="{{ '/assets/images/posters/ironfront.jpg' | relative_url }}" alt="" loading="lazy">
      <span class="game-play">
        <span class="game-play-icon"><svg width="22" height="26" viewBox="0 0 22 26" aria-hidden="true"><path d="M0 0l22 13L0 26z"/></svg></span>
        <span class="game-play-label">Play &middot; 10 MB</span>
      </span>
    </button>
  </div>
  <p class="game-meta">
    <span>Iron Front &middot; Operation Dustline &middot; keyboard and mouse</span>
    <span class="game-links">
      <a href="{{ '/assets/timelapses/ironfront.mp4' | relative_url }}">Watch it being built (3 min)</a>
      <a href="{{ '/games/ironfront/' | relative_url }}" target="_blank" rel="noopener">Open game in new tab</a>
    </span>
  </p>
</div>

Please make me Rocket League

<div class="game-embed">
  <div class="game-frame">
    <button class="game-poster" type="button" aria-label="Play Neon League"
            data-game-src="{{ '/games/neonleague/' | relative_url }}">
      <img src="{{ '/assets/images/posters/neonleague.jpg' | relative_url }}" alt="" loading="lazy">
      <span class="game-play">
        <span class="game-play-icon"><svg width="22" height="26" viewBox="0 0 22 26" aria-hidden="true"><path d="M0 0l22 13L0 26z"/></svg></span>
        <span class="game-play-label">Play &middot; 10 MB</span>
      </span>
    </button>
  </div>
  <p class="game-meta">
    <span>Neon League &middot; Car Soccer &middot; keyboard</span>
    <span class="game-links">
      <a href="{{ '/assets/timelapses/neonleague.mp4' | relative_url }}">Watch it being built (3 min)</a>
      <a href="{{ '/games/neonleague/' | relative_url }}" target="_blank" rel="noopener">Open game in new tab</a>
    </span>
  </p>
</div>

Please make me Runescape

<div class="game-embed">
  <div class="game-frame">
    <button class="game-poster" type="button" aria-label="Play Willowfell"
            data-game-src="{{ '/games/willowfell/' | relative_url }}">
      <img src="{{ '/assets/images/posters/willowfell.jpg' | relative_url }}" alt="" loading="lazy">
      <span class="game-play">
        <span class="game-play-icon"><svg width="22" height="26" viewBox="0 0 22 26" aria-hidden="true"><path d="M0 0l22 13L0 26z"/></svg></span>
        <span class="game-play-label">Play &middot; 12 MB</span>
      </span>
    </button>
  </div>
  <p class="game-meta">
    <span>Willowfell &middot; An Old-World Adventure &middot; keyboard and mouse</span>
    <span class="game-links">
      <a href="{{ '/assets/timelapses/willowfell.mp4' | relative_url }}">Watch it being built (2 min)</a>
      <a href="{{ '/games/willowfell/' | relative_url }}" target="_blank" rel="noopener">Open game in new tab</a>
    </span>
  </p>
</div>

The craziest part is how simple the prompts are. I basically gave it a name. It doesn't even have screenshots, or the ability to google things. These games are by no means complete, but the AI does recognize that and ask the user how they'd like to continue building.

Cost was ~$10 each, about the same as the last test.

Next time, I'll see how it does on bigger tasks. I'll give it advanced, fleshed out prompts, and maybe some images.

-Matt

P.S. Occasionally I ran into development quirks (internet dropping, quota reached testing, etc). Each time, I just told the model 'continue'.

<script>
(function () {
  document.querySelectorAll('.game-poster').forEach(function (poster) {
    poster.addEventListener('click', function () {
      var frame = document.createElement('iframe');
      frame.src = poster.getAttribute('data-game-src');
      frame.title = poster.getAttribute('aria-label');
      frame.allow = 'autoplay; fullscreen; gamepad';
      poster.parentNode.replaceChild(frame, poster);
      frame.focus();
    });
  });
}());
</script>
