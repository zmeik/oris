#!/usr/bin/env python3
"""Build a static GitHub Pages snapshot of the live reference application.

Renders /play and /play/anatomy/<file_id> from a running Flask instance
on http://127.0.0.1:5051, mirrors every GET API response as a static
file under docs/api and docs/panorama, copies static assets, and
rewrites absolute URLs to live under the /oris/ subdir on
zmeik.github.io. POST/PUT/DELETE requests are intercepted at runtime
by a fetch shim that returns 200-OK no-ops, so the polished UI runs
in browser-only state without a Flask backend.

Run:
    cd oris-repo
    PORT=5051 python3 reference-app/mock_app.py &  # if not running
    python3 tools/build_pages.py
    git add docs/
    git commit -m "Rebuild docs/ from live reference app"
"""

from __future__ import annotations

import re
import shutil
import subprocess
import sys
import time
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen

REPO = Path(__file__).resolve().parent.parent
APP_DIR = REPO / "reference-app"
DOCS = REPO / "docs"
HOST = "http://127.0.0.1:5051"
FILE_IDS = (1001, 1002, 1003)
# GitHub Pages serves the repo at /<repo>/. The user's repo is
# https://github.com/zmeik/oris → site is at https://zmeik.github.io/oris/.
# Every absolute path baked into the HTML or JS gets prefixed with this.
PAGES_PREFIX = "/oris"

# All GET endpoints that the polished /play and /play/anatomy pages hit
# at startup. Each is mirrored as a static file at docs/<path-without-leading-slash>.
GET_ENDPOINTS = [
    "/api/play/cases",
    "/api/darwin/sandboxes",
    "/api/darwin/test-cases",
    "/api/darwin/tree",
    "/api/panorama/anatomy-templates",
    *[f"/api/darwin/arena/{fid}" for fid in FILE_IDS],
    *[f"/api/darwin/ground-truth/{fid}" for fid in FILE_IDS],
    *[f"/api/darwin/ground-truth/{fid}/history" for fid in FILE_IDS],
    *[f"/api/darwin/tooth-bboxes/{fid}" for fid in FILE_IDS],
    *[f"/api/darwin/card-hints/{fid}" for fid in FILE_IDS],
    *[f"/api/anatomy/{fid}/templates" for fid in FILE_IDS],
]
IMAGE_ENDPOINTS = [
    (f"/panorama/{fid}/image", f"panorama/{fid}/image") for fid in FILE_IDS
]
HTML_PAGES = [
    ("/play", "play/index.html"),
    *[(f"/play/anatomy/{fid}", f"play/anatomy/{fid}/index.html") for fid in FILE_IDS],
]

# Fetch shim — injected as the FIRST <script> in every rendered HTML.
# Re-routes API + panorama requests to the static-mirror paths under
# the GitHub Pages subdir, and turns POST/PUT/DELETE into 200-ok
# no-ops so the JS modules run without errors.
FETCH_SHIM = r"""<script>
/* GitHub Pages static-mode shim — re-routes all /api/, /panorama/ and
   /static/ requests to the static-mirror paths under the repo subdir, and
   turns POST/PUT/DELETE into 200-ok no-ops so the polished UI runs in
   browser-only state without a Flask backend. The runtime PATH_PREFIX
   is computed from location.pathname so the same shim works on
   zmeik.github.io/oris/ AND on a forked username.github.io/<repo>/. */
(function () {
  function detectPrefix() {
    // /oris/play/, /oris/play/anatomy/1001/, /oris/index.html → '/oris'
    // /play/, /index.html → ''
    var m = location.pathname.match(/^\/([^\/]+)\/(?:play|api|panorama|static|index\.html)/);
    if (m) return '/' + m[1];
    // root-level /play/ etc.
    if (/^\/(?:play|index\.html)/.test(location.pathname)) return '';
    return '';
  }
  var PREFIX = detectPrefix();
  window.__ORIS_BASE = PREFIX;

  var origFetch = window.fetch;
  window.fetch = function (url, opts) {
    opts = opts || {};
    if (typeof url === 'string') {
      var method = (opts.method || 'GET').toUpperCase();
      if (method !== 'GET' && method !== 'HEAD') {
        // POST / PUT / DELETE in static mode → echo a stub success response.
        // sequence_num=0, structures_saved=0 keep the save banners happy.
        return Promise.resolve(new Response(
          JSON.stringify({ ok: true, sequence_num: 0, structures_saved: 0, structures_total: 0 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
      }
      if (url.indexOf('/api/') === 0) {
        // Strip query string (Pages ignores it anyway) then add .json extension
        // so the static mirror file at <path>.json is served. This matters for
        // endpoint pairs where one URL is a prefix of another, e.g.
        //   /api/darwin/ground-truth/1001        → 1001.json
        //   /api/darwin/ground-truth/1001/history → 1001/history.json
        var noQuery = url.split('?')[0];
        url = PREFIX + noQuery + '.json';
      }
      else if (url.indexOf('/panorama/') === 0) url = PREFIX + url + '.png';
    }
    return origFetch.call(this, url, opts);
  };

  // Re-write any `/panorama/...` URL to the static-mirror PNG path.
  function rewritePanoramaSrc(s) {
    if (!s) return s;
    if (s.indexOf(PREFIX + '/panorama/') === 0) return s;          // already prefixed
    if (s.indexOf('/panorama/') !== 0) return s;                    // not a panorama URL
    return PREFIX + s + (s.endsWith('.png') ? '' : '.png');
  }
  // (1) Override HTMLImageElement.prototype.src — this catches BOTH
  // programmatic image loads (`new Image(); img.src = '...'`, used by
  // anatomy_editor.html's loadImage()) AND DOM-inserted IMGs whose
  // src is set after creation. The set on the prototype intercepts
  // every Image instance.
  var imgProto = HTMLImageElement.prototype;
  var origDescriptor = Object.getOwnPropertyDescriptor(imgProto, 'src')
                    || Object.getOwnPropertyDescriptor(Element.prototype, 'src');
  if (origDescriptor && origDescriptor.set) {
    Object.defineProperty(imgProto, 'src', {
      configurable: true,
      enumerable: origDescriptor.enumerable,
      get: function () { return origDescriptor.get.call(this); },
      set: function (v) {
        if (typeof v === 'string') v = rewritePanoramaSrc(v);
        origDescriptor.set.call(this, v);
      }
    });
  }
  // (2) Belt-and-braces: an additional MutationObserver pass for IMG
  // nodes whose src attribute is set via setAttribute() (which doesn't
  // hit the prototype descriptor on some browsers).
  function rewriteImgAttr(node) {
    if (!node || node.nodeType !== 1) return;
    if (node.tagName === 'IMG' && node.getAttribute('src')) {
      var s = node.getAttribute('src');
      var fixed = rewritePanoramaSrc(s);
      if (fixed !== s) node.setAttribute('src', fixed);
    }
    if (node.querySelectorAll) {
      node.querySelectorAll('img[src^="/panorama/"]').forEach(function (img) {
        var s = img.getAttribute('src');
        var fixed = rewritePanoramaSrc(s);
        if (fixed !== s) img.setAttribute('src', fixed);
      });
    }
  }
  document.addEventListener('DOMContentLoaded', function () { rewriteImgAttr(document); });
  new MutationObserver(function (muts) {
    muts.forEach(function (m) {
      m.addedNodes.forEach(rewriteImgAttr);
      if (m.type === 'attributes' && m.target.tagName === 'IMG') rewriteImgAttr(m.target);
    });
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
})();
</script>"""


def fetch_bytes(url: str) -> bytes:
    return urlopen(HOST + url, timeout=60).read()


def wait_for_server() -> None:
    for _ in range(20):
        try:
            urlopen(HOST + "/api/darwin/sandboxes", timeout=2).read()
            return
        except URLError:
            time.sleep(0.5)
    print(f"Server not reachable at {HOST}. Start it with: PORT=5051 python3 reference-app/mock_app.py")
    sys.exit(1)


def rewrite_html(html: str) -> str:
    """Inject fetch shim and prefix absolute URLs."""
    # (1) Static asset paths — these are loaded by the browser before the
    # fetch shim runs, so they must be baked at build time.
    html = html.replace('src="/static/', f'src="{PAGES_PREFIX}/static/')
    html = html.replace('href="/static/', f'href="{PAGES_PREFIX}/static/')

    # (2) Cross-page navigation. The Flask routes /play and
    # /play/anatomy/<id> are absolute URLs in the source HTML/JS:
    #   - anatomy_editor.html  : <a href="/play" class="tb-btn back">
    #   - darwin_lab.html JS    : window.location.href = `/play/anatomy/${id}`
    # On GitHub Pages those resolve to host-root, not the /oris subdir,
    # and 404. Patch them to embed window.__ORIS_BASE (set by the shim).
    html = html.replace(
        'href="/play"',
        'href="javascript:void(0)" onclick="window.location.href=(window.__ORIS_BASE||\'\')+\'/play/\'"',
    )
    html = html.replace(
        "window.location.href = `/play/anatomy/${id}`",
        "window.location.href = `${window.__ORIS_BASE||''}/play/anatomy/${id}/`",
    )
    # Anatomy editor: meta-refresh / canonical URLs containing /play/.
    # Future-proof: any remaining `href="/play/` (with leading slash but
    # no static-asset path) in static HTML.
    # We don't blindly s|/play/|...| because /play/ also appears inside
    # plain text in the disclaimer, which we leave alone.

    # (3) Inject shim as first child of <head> so PATH_PREFIX is set
    # before any other script — including the inline darwin_lab.html
    # bootstrap that may read window.__ORIS_BASE.
    if "<head>" in html:
        html = html.replace("<head>", "<head>\n" + FETCH_SHIM, 1)
    return html


def rewrite_js(js: str) -> str:
    """fetch()-bound URLs go through the runtime shim, but image src=
    attributes built in JS template literals are loaded by the browser
    before any MutationObserver fires. So for the specific narrow case
    of `<img ... src="/panorama/${id}/image">` we patch the literal at
    build time to embed `window.__ORIS_BASE` and the `.png` suffix.
    Other `/api/` and `/panorama/` strings are left alone so the fetch
    shim catches them.
    """
    # arena-core.js builds the panorama IMG via a template literal:
    #   `<img id="..." src="/panorama/${tc.file_id}/image" ...>`
    # Replace the literal text inside that template so the browser
    # requests the right URL on first paint without a 404 dance.
    return js.replace(
        'src="/panorama/${tc.file_id}/image"',
        'src="${window.__ORIS_BASE||\'\'}/panorama/${tc.file_id}/image.png"',
    )


def main() -> None:
    wait_for_server()

    # 1. Wipe build outputs (keep architecture.md / glossary.md / etc).
    for sub in ("play", "api", "panorama", "static"):
        target = DOCS / sub
        if target.exists():
            print(f"Removing {target.relative_to(REPO)}")
            shutil.rmtree(target)

    # 2. Mirror HTML pages.
    print("Rendering HTML pages...")
    for url, dest in HTML_PAGES:
        out = DOCS / dest
        out.parent.mkdir(parents=True, exist_ok=True)
        html = fetch_bytes(url).decode("utf-8")
        out.write_text(rewrite_html(html), encoding="utf-8")
        print(f"  ✓ {url} → {out.relative_to(DOCS)}")

    # 3. Mirror JSON API responses. Each is saved with `.json` so endpoint
    # pairs like /api/darwin/ground-truth/1001 (file) and
    # /api/darwin/ground-truth/1001/history (file) can coexist —
    # 1001.json sits beside the 1001/ directory that contains history.json.
    # The fetch shim re-routes browser requests to the right `.json` file.
    print("Mirroring GET endpoints...")
    for url in GET_ENDPOINTS:
        out = DOCS / (url.lstrip("/") + ".json")
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(fetch_bytes(url))
        print(f"  ✓ {url} → {out.relative_to(DOCS)}")

    # 4. Mirror panorama PNGs (suffix .png so the shim's URL rewrite matches).
    print("Mirroring panorama images...")
    for url, dest in IMAGE_ENDPOINTS:
        out = DOCS / (dest + ".png")
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(fetch_bytes(url))
        print(f"  ✓ {url} → {out.relative_to(DOCS)}")

    # 5. Copy static assets, then prefix-patch every JS file.
    print("Copying static assets...")
    src_static = APP_DIR / "static"
    dst_static = DOCS / "static"
    shutil.copytree(src_static, dst_static)

    print("Prefix-patching JS modules...")
    js_count = 0
    for js_path in dst_static.rglob("*.js"):
        original = js_path.read_text(encoding="utf-8")
        patched = rewrite_js(original)
        if patched != original:
            js_path.write_text(patched, encoding="utf-8")
            js_count += 1
    print(f"  ✓ patched {js_count} JS files (subset under static/js/**)")

    # 6. Landing page — meta-refresh redirect to /oris/play/, with a
    # plain anchor as a fallback for browsers that block meta-refresh.
    print("Writing docs/index.html (redirect to /play/)...")
    landing_html = f"""<!doctype html>
<html lang=\"en\">
<head>
<meta charset=\"utf-8\">
<title>ORIS v0.1 · Reference Application</title>
<meta http-equiv=\"refresh\" content=\"0; url={PAGES_PREFIX}/play/\">
<meta name=\"description\" content=\"ORIS v0.1 — Open Radiographic Imaging Schema. The polished interactive dental-formula playground is at /play/. This page redirects there automatically.\">
<style>
  body {{ background:#0e1014;color:#e6e7eb;font-family:-apple-system,'Segoe UI',Inter,system-ui,sans-serif;
         display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center; }}
  a {{ color:#6dc4d8;font-size:18px;font-weight:600;text-decoration:none;
       padding:12px 24px;border:1px solid rgba(109,196,216,0.5);border-radius:8px;background:rgba(109,196,216,0.10); }}
  a:hover {{ background:rgba(109,196,216,0.25); }}
  p {{ color:#9aa1ad;margin-top:24px;font-size:13px; }}
</style>
</head>
<body>
<div>
  <a href=\"{PAGES_PREFIX}/play/\">🦷 Open the dental-formula playground →</a>
  <p>Redirecting automatically… If your browser does not, click the link above.</p>
</div>
</body>
</html>
"""
    (DOCS / "index.html").write_text(landing_html, encoding="utf-8")

    # 7. Preserve the older standalone IJOS-quality demo as docs/figure2.html
    # for the paper Figure-2 reproducibility path. The build script copies
    # the live reference-app/static/demo.html directly.
    src_demo = APP_DIR / "static" / "demo.html"
    if src_demo.exists():
        (DOCS / "figure2.html").write_bytes(src_demo.read_bytes())
        print(f"  ✓ {src_demo.relative_to(REPO)} → docs/figure2.html (Figure 2 source)")

    # 8. .nojekyll so GitHub Pages serves docs/ verbatim.
    (DOCS / ".nojekyll").touch()

    print("\nBuild complete.\n")
    print("Next steps:")
    print("  1. git add docs/")
    print('  2. git commit -m "Rebuild docs/ from live reference app"')
    print("  3. git push")
    print(f"  4. Verify https://zmeik.github.io{PAGES_PREFIX}/play/ ~30s after push.")


if __name__ == "__main__":
    main()
