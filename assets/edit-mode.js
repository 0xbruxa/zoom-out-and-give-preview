/* Edit mode for the review link only. It is added to the review copy when it is pushed and never ships to Netlify.
   Open any page with ?edit=1, click any text and type over it. Buttons open a box instead.
   "Copy my changes" lists every before and after, on all three pages, ready to paste back to Claude.
   Edits stay in this browser until "Undo this page". */
(() => {
  const KEY = "zog2026-copy-edits";
  const PAGES = ["Main page", "Claim page", "Thanks page"];
  const me = document.currentScript;
  const root = me ? me.src.replace(/assets\/edit-mode\.js.*$/, "") : new URL(".", location.href).href;
  const rel = location.pathname.slice(new URL(root).pathname.length);
  const page = rel.startsWith("claim") ? "Claim page" : rel.startsWith("thanks") ? "Thanks page" : "Main page";
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const save = all => { try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) {} };
  const withEdit = (href, on) => { const u = new URL(href, location.href); if (on) u.searchParams.set("edit", "1"); else u.searchParams.delete("edit"); return u.href; };

  /* Not editing: offer the switch in the yellow preview bar */
  if (!new URLSearchParams(location.search).has("edit")) {
    const bar = document.getElementById("preview-bar");
    if (bar) {
      const a = document.createElement("a");
      a.href = withEdit(location.href, true);
      a.textContent = "Edit the copy";
      a.style.cssText = "color:inherit;font-weight:700;text-decoration:underline;margin-left:8px";
      bar.appendChild(a);
    }
    return;
  }

  const css = document.createElement("style");
  css.textContent = `
    [data-zog-edit]{outline:1px dashed rgba(39,89,197,.45);outline-offset:2px;border-radius:2px;cursor:text}
    [data-zog-edit]:hover{outline-color:#2759C5}
    [data-zog-edit]:focus{outline:2px solid #2759C5}
    [data-zog-edit].zog-changed{outline:2px solid #F5B400}
    button[data-zog-edit]{cursor:pointer}
    body{padding-bottom:110px}
    #zog-edit-bar{position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483000;display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;justify-content:space-between;
      background:#0B2765;color:#fff;padding:12px 16px;border-radius:16px;font:500 14px/1.4 "Helvetica Neue",Arial,sans-serif;box-shadow:0 14px 40px rgba(3,14,45,.35)}
    #zog-edit-bar a{color:#C8E3FF}
    #zog-edit-bar .here{color:#fff;font-weight:700;text-decoration:none}
    #zog-edit-bar .acts{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
    #zog-edit-bar button,#zog-edit-panel button{font:600 14px/1 "Helvetica Neue",Arial,sans-serif;border:0;border-radius:999px;padding:10px 16px;cursor:pointer;background:#fff;color:#0B2765}
    #zog-edit-bar button.ghost{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.5)}
    #zog-edit-panel{position:fixed;inset:0;z-index:2147483001;background:rgba(3,14,45,.55);display:flex;align-items:center;justify-content:center;padding:16px}
    #zog-edit-panel .box{background:#fff;border-radius:16px;width:min(100%,680px);padding:22px;font:400 15px/1.5 "Helvetica Neue",Arial,sans-serif;color:#0B2765}
    #zog-edit-panel h3{margin:0 0 4px;font-size:22px}
    #zog-edit-panel textarea{width:100%;height:50vh;margin-top:12px;padding:12px;border:1px solid #ADBACC;border-radius:10px;font:13px/1.5 Menlo,Consolas,monospace;color:#0B2765}
    #zog-edit-panel .row{display:flex;justify-content:flex-end;margin-top:12px}`;
  document.head.appendChild(css);

  /* Pick every piece of visible copy. Loose words inside a label with a checkbox get their own span, so the box stays put. */
  const SKIP = "script,style,noscript,textarea,select,option,svg,template,iframe,input,#preview-bar";
  const hasText = el => Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim());
  const targets = [];
  (function walk(el) {
    for (const c of Array.from(el.children)) {
      if (c.matches(SKIP)) continue;
      if (!hasText(c)) { walk(c); continue; }
      if (c.matches("button")) { targets.push(c); continue; }
      if (c.querySelector("input,textarea,select")) {
        Array.from(c.childNodes).forEach(n => {
          if (n.nodeType !== 3 || !n.textContent.trim()) return;
          const s = document.createElement("span"); n.replaceWith(s); s.appendChild(n); targets.push(s);
        });
        continue;
      }
      targets.push(c);
    }
  })(document.body);

  const norm = s => s.replace(/ /g, " ").replace(/[ \t]+/g, " ").replace(/ *\n[\s]*/g, "\n").trim();
  const textOf = el => norm(el.innerText || el.textContent || "");
  const orig = [];
  document.querySelectorAll("details").forEach(d => { d.open = true; });
  targets.forEach((el, i) => {
    el.dataset.zogEdit = i;
    orig[i] = textOf(el);
    if (!el.matches("button")) { el.contentEditable = "true"; el.spellcheck = true; }
  });
  const origOf = el => (el && el.dataset.zogEdit != null ? orig[el.dataset.zogEdit] : el ? textOf(el) : "");

  function whereOf(el) {
    if (el.closest(".site-head")) return "Header";
    if (el.closest(".site-foot")) return "Footer";
    if (el.closest(".hero")) return "Top of the page";
    if (el.closest(".email-self")) return "Email step";
    if (el.closest(".ws-actions")) return "Below the worksheet";
    const parts = [];
    const sec = el.closest("section");
    if (sec) {
      const h = page === "Main page" ? sec.querySelector(".eyebrow") || sec.querySelector("h2") : sec.querySelector("h2, h1");
      if (h) parts.push(origOf(h));
    }
    const sub = el.closest(".ws-section, fieldset, details, li");
    if (sub) {
      const h = sub.querySelector("h3, legend, summary");
      if (h && h !== el && !h.contains(el)) parts.push(origOf(h));
    }
    return parts.join(", ") || page;
  }

  /* Bring back what was typed earlier in this browser, as long as the original copy hasn't moved */
  const all0 = load(), mine0 = all0[page] || {};
  Object.keys(mine0).forEach(i => {
    const el = targets[i], it = mine0[i];
    if (el && orig[i] === it.before) { el.innerHTML = it.html; el.classList.add("zog-changed"); }
    else delete mine0[i];
  });
  save(all0);

  function record(el) {
    const i = el.dataset.zogEdit, now = textOf(el), all = load(), mine = all[page] || (all[page] = {});
    if (now === orig[i]) { delete mine[i]; el.classList.remove("zog-changed"); }
    else { mine[i] = { before: orig[i], after: now, html: el.innerHTML, where: whereOf(el) }; el.classList.add("zog-changed"); }
    save(all); updateCount();
  }

  /* Editing, not using: links, labels, buttons and forms stand still */
  document.addEventListener("click", e => {
    if (e.target.closest("#zog-edit-bar, #zog-edit-panel")) return;
    const btn = e.target.closest("button[data-zog-edit]");
    if (btn) {
      e.preventDefault(); e.stopPropagation();
      const v = prompt("Button text:", textOf(btn));
      if (v != null && v.trim()) { btn.textContent = v.trim(); record(btn); }
      return;
    }
    if (e.target.closest("a, label, summary, button")) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  document.addEventListener("submit", e => { e.preventDefault(); e.stopPropagation(); }, true);
  const ONE_LINE = "h1,h2,h3,h4,a,span,label,legend,summary,th,strong,em,i,b,small,figcaption";
  document.addEventListener("keydown", e => {
    const el = e.target.closest && e.target.closest("[data-zog-edit][contenteditable=true]");
    if (!el) return;
    if (e.key === "Enter" && el.matches(ONE_LINE)) { e.preventDefault(); el.blur(); }
    else if (e.key === " " && el.closest("summary")) { e.preventDefault(); document.execCommand("insertText", false, " "); }
  }, true);
  document.addEventListener("paste", e => {
    if (!e.target.closest || !e.target.closest("[data-zog-edit]")) return;
    e.preventDefault();
    document.execCommand("insertText", false, (e.clipboardData || window.clipboardData).getData("text/plain"));
  }, true);
  document.addEventListener("input", e => {
    const el = e.target.closest && e.target.closest("[data-zog-edit]");
    if (el) record(el);
  }, true);

  /* The bar at the bottom */
  const bar = document.createElement("div");
  bar.id = "zog-edit-bar";
  const links = [["Main page", root], ["Claim page", root + "claim/"], ["Thanks page", root + "thanks/?preview=1"]]
    .map(([name, href]) => name === page ? `<span class="here">${name}</span>` : `<a href="${withEdit(href, true)}">${name}</a>`).join(" · ");
  bar.innerHTML = `<span><strong>Edit mode.</strong> Click any text and type. Changed copy turns yellow.</span>
    <span>${links}</span>
    <span class="acts"><span id="zog-count"></span><button type="button" id="zog-copy">Copy my changes</button><button type="button" class="ghost" id="zog-undo">Undo this page</button><a href="${withEdit(location.href, false)}">Exit</a></span>`;
  document.body.appendChild(bar);
  const count = bar.querySelector("#zog-count");
  function updateCount() {
    const n = Object.values(load()).reduce((s, m) => s + Object.keys(m || {}).length, 0);
    count.textContent = n === 1 ? "1 change" : n + " changes";
  }
  updateCount();

  function buildText() {
    const all = load(), out = ["Copy edits from the Zoom Out & Give review link", ""];
    let n = 0;
    PAGES.forEach(pg => {
      const m = all[pg] || {}, keys = Object.keys(m).sort((a, b) => a - b);
      if (!keys.length) return;
      out.push(pg.toUpperCase());
      keys.forEach(k => {
        n++;
        out.push(`${n}. ${m[k].where}`, `   Before: ${m[k].before.replace(/\n/g, " / ")}`, `   After: ${m[k].after.replace(/\n/g, " / ")}`, "");
      });
    });
    if (!n) out.push("No changes yet.");
    return out.join("\n");
  }
  function showPanel(text, copied) {
    let p = document.getElementById("zog-edit-panel");
    if (!p) { p = document.createElement("div"); p.id = "zog-edit-panel"; document.body.appendChild(p); }
    p.innerHTML = `<div class="box" role="dialog" aria-modal="true" aria-labelledby="zog-panel-h"><h3 id="zog-panel-h"></h3><p></p><textarea readonly></textarea><div class="row"><button type="button">Close</button></div></div>`;
    p.querySelector("h3").textContent = copied ? "Copied" : "Copy this";
    p.querySelector("p").textContent = copied ? "Your changes are on the clipboard. Paste them into the chat with Claude." : "Select all, copy, then paste it into the chat with Claude.";
    const ta = p.querySelector("textarea"); ta.value = text;
    p.querySelector("button").addEventListener("click", () => p.remove());
    p.addEventListener("click", e => { if (e.target === p) p.remove(); });
    ta.focus(); ta.select();
  }
  bar.querySelector("#zog-copy").addEventListener("click", async () => {
    const text = buildText();
    let copied = false;
    try { await navigator.clipboard.writeText(text); copied = true; } catch (e) {}
    showPanel(text, copied);
  });
  bar.querySelector("#zog-undo").addEventListener("click", () => {
    if (!confirm("Undo every change on this page?")) return;
    const all = load(); delete all[page]; save(all); location.reload();
  });
})();
