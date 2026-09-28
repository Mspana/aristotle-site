---
layout: post
title: "Testing Opus 5.5"
date: 2026-09-28
---

Anthropic finally released Opus 5.5, their long-awaited response to GPT Astra. There's a lot of hype that its visuals are just as good, or even better.

The verdict? Not as good. But not bad, and it might be smarter.

I gave it my now-standard prompt, "Please make me league of legends". Here's what it gave me:

<div class="game-embed">
  <div class="game-frame">
    <button class="game-poster" type="button" aria-label="Play the Opus 5.5 game"
            data-game-src="{{ '/games/opus-league/' | relative_url }}">
      <img src="{{ '/assets/images/posters/opus-league.jpg' | relative_url }}" alt="" loading="lazy">
      <span class="game-play">
        <span class="game-play-icon"><svg width="22" height="26" viewBox="0 0 22 26" aria-hidden="true"><path d="M0 0l22 13L0 26z"/></svg></span>
        <span class="game-play-label">Play &middot; 10 MB</span>
      </span>
    </button>
  </div>
  <p class="game-meta">
    <span>Aristotle w/ Opus 5.5 &middot; Godot web build &middot; keyboard and mouse</span>
    <a href="{{ '/games/opus-league/' | relative_url }}" target="_blank" rel="noopener">Open in a new tab</a>
  </p>
</div>

Visually, this was a pretty significant step behind Astra, but a significant step forward from Fable 5.1's.

<figure>
  <img src="{{ '/assets/images/posters/riftward.jpg' | relative_url }}" alt="Riftward, the MOBA GPT-6 Astra made in Aristotle" loading="lazy">
  <figcaption>Astra, with nicely mocked environments and players.</figcaption>
</figure>

<figure>
  <img src="{{ '/assets/images/posters/opus-league.jpg' | relative_url }}" alt="The MOBA Opus 5.5 made in Aristotle" loading="lazy">
  <figcaption>Opus 5.5, with less exciting graphics.</figcaption>
</figure>

<figure>
  <img src="{{ '/assets/images/posters/claude.jpg' | relative_url }}" alt="The MOBA Claude with Fable 5.1 made, from the MOBA test" loading="lazy">
  <figcaption>Fable 5.1, with its "hockey puck flash game" aesthetic.</figcaption>
</figure>

On the bright side, this game felt really, really good. Controls were responsive, and the characters animated nicely in response to your movement. It was also pretty unforgiving: it's the first game where the enemy killed me before I killed them. Note to the dev: please add AOE moves. I didn't like the wizard I was playing.

Very uniquely, Opus 5.5 thought about the *entire game* before creating it. It thought as if it was making changes, but just didn't. And once it had everything thought out, then it did it. It's like it mimed out what it wanted to do first.

<figure>
  <a href="{{ '/assets/images/posts/opus-5-5-thinking.png' | relative_url }}" target="_blank" rel="noopener"><img src="{{ '/assets/images/posts/opus-5-5-thinking.png' | relative_url }}" alt="Timeline from the chat log: Opus 5.5 thinks for 11 minutes 40 seconds, writing 'Now I'm writing the player controller script' and similar lines, with no changes made, then makes its first change at 11:52." loading="lazy"></a>
  <figcaption>Opus 5.5: 11 minutes 40 seconds of thinking, written as if it were building, before its first change.</figcaption>
</figure>

<figure>
  <a href="{{ '/assets/images/posts/astra-working.png' | relative_url }}" target="_blank" rel="noopener"><img src="{{ '/assets/images/posts/astra-working.png' | relative_url }}" alt="Timeline from the chat log: GPT-6 Astra runs the match, thinks for a second or two, fixes scripts, and runs the match again, several times in eight minutes." loading="lazy"></a>
  <figcaption>Astra, same prompt: a few seconds of thinking, a change, a test run, repeat.</figcaption>
</figure>

Overall, I think I expected more from Anthropic. They've mostly had OpenAI's number when it comes to frontier models, but Astra certainly offered more visual capability in this example. Perhaps Opus can build better mechanics. That'll be in the next test, where it makes a few more games.

-Matt

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
