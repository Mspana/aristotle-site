// Serve a built copy of the site and hand /waitlist to a local Worker, the way
// production routes aristotle.games/waitlist to the broker Worker while the
// rest of the apex is GitHub Pages. Development only; Jekyll skips _scripts.
//
//   1. Build with the test Turnstile key:
//        jekyll build --config _config.yml,_config.dev.yml -d <out>
//      (no Ruby here? docker run --rm -v "$PWD:/srv/jekyll" jekyll/jekyll:4.2.2 ...)
//   2. In the engine repo, modules/ai/backend/worker, with .dev.vars holding the
//      local Supabase keys and TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA:
//        npx wrangler dev --port 8787
//   3. node _scripts/serve-local.mjs <out> [port] [worker-url]
//      then open http://127.0.0.1:4000/

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.argv[2] || "_site");
const port = Number(process.argv[3] || 4000);
const worker = (process.argv[4] || "http://127.0.0.1:8787").replace(/\/+$/, "");

const TYPES = {
	".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
	".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
	".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
	".ico": "image/x-icon", ".mp4": "video/mp4", ".wasm": "application/wasm", ".pck": "application/octet-stream",
};

async function file(path) {
	let p = normalize(join(root, decodeURIComponent(path)));
	if (!p.startsWith(root)) return null;
	try {
		if ((await stat(p)).isDirectory()) p = join(p, "index.html");
		return { body: await readFile(p), type: TYPES[extname(p)] || "application/octet-stream" };
	} catch {
		return null;
	}
}

createServer(async (req, res) => {
	const url = new URL(req.url, "http://localhost");
	if (url.pathname === "/waitlist") {
		const chunks = [];
		for await (const c of req) chunks.push(c);
		try {
			const up = await fetch(worker + "/waitlist", {
				method: req.method,
				headers: { "content-type": req.headers["content-type"] || "application/json" },
				body: req.method === "POST" ? Buffer.concat(chunks) : undefined,
			});
			res.writeHead(up.status, { "content-type": up.headers.get("content-type") || "application/json" });
			res.end(Buffer.from(await up.arrayBuffer()));
		} catch (e) {
			res.writeHead(502, { "content-type": "text/plain" });
			res.end("Worker not reachable at " + worker + ": " + e.message);
		}
		return;
	}
	const f = await file(url.pathname);
	if (!f) {
		res.writeHead(404, { "content-type": "text/plain" });
		res.end("not found");
		return;
	}
	res.writeHead(200, { "content-type": f.type });
	res.end(f.body);
}).listen(port, "127.0.0.1", () => {
	console.log(`site: http://127.0.0.1:${port}/  (from ${root})`);
	console.log(`/waitlist -> ${worker}/waitlist`);
});
