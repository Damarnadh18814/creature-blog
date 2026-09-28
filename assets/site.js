// Theme toggle (remembered per viewer) and chart hover tooltips.
(function () {
  var root = document.documentElement;
  try {
    var saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") root.setAttribute("data-theme", saved);
  } catch (e) {}

  document.addEventListener("DOMContentLoaded", function () {
    var btn = document.querySelector(".theme-toggle");
    if (btn) {
      btn.addEventListener("click", function () {
        var dark = root.getAttribute("data-theme") === "dark" ||
          (!root.getAttribute("data-theme") && matchMedia("(prefers-color-scheme: dark)").matches);
        var next = dark ? "light" : "dark";
        root.setAttribute("data-theme", next);
        try { localStorage.setItem("theme", next); } catch (e) {}
      });
    }

    var livePanel = document.querySelector("[data-live]");
    if (livePanel) startLive(livePanel);

    document.querySelectorAll(".chart[data-points]").forEach(function (chart) {
      var pts;
      try { pts = JSON.parse(chart.getAttribute("data-points")); } catch (e) { return; }
      if (!pts.length) return;
      var svg = chart.querySelector("svg");
      var tip = chart.querySelector(".tooltip");
      var cross = svg.querySelector(".crosshair");
      var dots = svg.querySelectorAll(".dot");
      function show(i) {
        var p = pts[i];
        var box = svg.getBoundingClientRect();
        var scale = box.width / svg.viewBox.baseVal.width;
        chart.classList.add("hovering");
        cross.setAttribute("x1", p.x); cross.setAttribute("x2", p.x);
        dots.forEach(function (d, j) { d.style.opacity = j === i ? 1 : ""; });
        tip.innerHTML = "<span class='mono'>" + p.date + "</span><b>" + p.dominant + "</b> · " + p.mood +
          "<br>" + p.title;
        tip.style.left = (p.x * scale) + "px";
        tip.style.top = (p.y * scale) + "px";
        tip.style.opacity = 1;
      }
      function hide() {
        chart.classList.remove("hovering");
        tip.style.opacity = 0;
        dots.forEach(function (d) { d.style.opacity = ""; });
      }
      function nearest(evt) {
        var box = svg.getBoundingClientRect();
        var x = (evt.clientX - box.left) / box.width * svg.viewBox.baseVal.width;
        var best = 0;
        pts.forEach(function (p, i) { if (Math.abs(p.x - x) < Math.abs(pts[best].x - x)) best = i; });
        return best;
      }
      svg.addEventListener("pointermove", function (e) { show(nearest(e)); });
      svg.addEventListener("pointerleave", hide);
      svg.addEventListener("focus", function () { show(pts.length - 1); });
      svg.addEventListener("blur", hide);
    });
  });

  // ── live status: fetched from the repo's `live` branch, refreshed every minute ──
  function ago(iso) {
    var t = Date.parse(iso);
    if (!t) return "";
    var m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return "just now";
    if (m < 60) return m + " min ago";
    var h = Math.round(m / 60);
    return h < 48 ? h + " h ago" : Math.round(h / 24) + " days ago";
  }
  function hue(v) { v = Math.max(-1, Math.min(1, +v || 0)); return (255 + (v + 1) / 2 * 150) % 360; }
  function li(text, small, cls) {
    var el = document.createElement("li");
    el.textContent = text;
    if (cls) el.className = cls;
    if (small) { var s = document.createElement("small"); s.textContent = small; el.appendChild(s); }
    return el;
  }
  function render(panel, d) {
    if (!d || !d.state) return;
    var q = function (sel) { return document.querySelector(sel); };
    var stale = d.updated && (Date.now() - Date.parse(d.updated)) > 3 * 3600 * 1000 && !/asleep|resting/.test(d.state);
    panel.classList.toggle("stale", !!stale);
    q("[data-live-state]").textContent = (d.creature ? d.creature + " is " : "") + d.state;
    q("[data-live-updated]").textContent = d.updated ? "updated " + ago(d.updated) : "";
    var th = q("[data-live-threads]"), rd = q("[data-live-reading]");
    th.replaceChildren(); rd.replaceChildren();
    (d.threads || []).forEach(function (t) {
      th.appendChild(li(t.question, t.confidence ? "confidence " + Math.round(t.confidence * 100) + "%" : "", t.kind === "self" ? "self" : ""));
    });
    if (!th.children.length) th.appendChild(li("nothing right now", "", "muted"));
    (d.reading || []).forEach(function (r) { rd.appendChild(li(r.title, r.site)); });
    if (!rd.children.length) rd.appendChild(li("nothing right now", "", "muted"));
    var m = d.mood;
    if (m && m.dominant) {
      var dom = q("[data-live-dominant]"); if (dom) dom.textContent = m.dominant;
      var hero = q(".hero");
      if (hero) {
        var h = hue(m.valence), c = (0.07 + 0.09 * Math.max(0, Math.min(1, m.arousal || 0))).toFixed(3);
        hero.style.setProperty("--mood-glow", "oklch(0.88 " + c + " " + h + ")");
        hero.style.setProperty("--mood-glow-dark", "oklch(0.42 " + c + " " + h + ")");
        hero.style.setProperty("--mood-ink", "oklch(0.52 " + c + " " + h + ")");
        hero.style.setProperty("--mood-ink-dark", "oklch(0.8 " + c + " " + h + ")");
      }
      var face = document.querySelector(".hero-portrait svg");
      if (face) {  // the portrait follows the live mood: colour, eyes, mouth
        var a = Math.max(0, Math.min(1, +m.arousal || 0)), v = Math.max(-1, Math.min(1, +m.valence || 0));
        var hh = hue(m.valence);
        var set = function (sel, col) { var el = face.querySelector(sel); if (el) el.setAttribute("stop-color", col); };
        set(".s0", "oklch(0.93 0.06 " + hh + ")");
        set(".s1", "oklch(0.78 " + (0.08 + 0.08 * a).toFixed(3) + " " + hh + ")");
        set(".s2", "oklch(0.55 " + (0.09 + 0.08 * a).toFixed(3) + " " + ((hh + 20) % 360) + ")");
        var er = 7 + 5 * a + (/surprised|awe/.test(m.dominant) ? 3 : 0);
        face.querySelectorAll(".eye").forEach(function (el) { el.setAttribute("rx", (er * 0.9).toFixed(1)); el.setAttribute("ry", er.toFixed(1)); });
        var mouth = face.querySelector(".mouth");
        if (mouth) {
          var w = 13 + 6 * Math.abs(v);
          mouth.setAttribute("d", "M" + (100 - w).toFixed(1) + ",124 Q100," + (124 + 14 * v).toFixed(1) + " " + (100 + w).toFixed(1) + ",124");
        }
        face.setAttribute("aria-label", (d.creature || "The creature") + ", feeling " + m.dominant);
      }
      Object.keys(m.hormones || {}).forEach(function (k) {
        var row = document.querySelector('.hero [data-h="' + k + '"]');
        if (!row) return;
        var v = Math.max(0, Math.min(1, +m.hormones[k] || 0));
        row.querySelector("em").textContent = v.toFixed(2);
        row.querySelector("b").style.width = Math.max(2, v * 100).toFixed(0) + "%";
      });
    }
    if (d.feeling) { var f = q("[data-live-feeling]"); if (f) f.textContent = d.feeling; }
  }
  function startLive(panel) {
    var remote = panel.getAttribute("data-remote"), local = panel.getAttribute("data-local");
    function load() {
      var bust = "?t=" + Math.floor(Date.now() / 60000);
      var first = remote ? fetch(remote + bust, { cache: "no-store" }) : Promise.reject();
      first.then(function (r) { if (!r.ok) throw 0; return r.json(); })
        .catch(function () { return fetch(local + bust, { cache: "no-store" }).then(function (r) { return r.json(); }); })
        .then(function (d) { render(panel, d); })
        .catch(function () { panel.querySelector("[data-live-state]").textContent = "status unavailable right now"; });
    }
    load();
    setInterval(load, 60000);
  }
})();
