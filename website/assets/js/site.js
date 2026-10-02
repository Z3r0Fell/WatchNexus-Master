/* WatchNexus — site interactions. No dependencies. */
(function () {
  "use strict";
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Nav: scrolled state + mobile toggle */
  var nav = document.querySelector(".nav");
  if (nav) {
    var onScroll = function () { nav.classList.toggle("scrolled", window.scrollY > 8); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    var toggle = nav.querySelector(".nav-toggle");
    if (toggle) {
      toggle.addEventListener("click", function () {
        var open = nav.classList.toggle("open");
        toggle.setAttribute("aria-expanded", String(open));
        toggle.innerHTML = open ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-bars"></i>';
      });
    }
  }

  /* Products dropdown */
  document.querySelectorAll(".dropdown").forEach(function (dd) {
    var btn = dd.querySelector("button");
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = dd.classList.toggle("open");
      btn.setAttribute("aria-expanded", String(open));
    });
  });
  document.addEventListener("click", function (e) {
    document.querySelectorAll(".dropdown.open").forEach(function (dd) {
      if (!dd.contains(e.target)) {
        dd.classList.remove("open");
        dd.querySelector("button").setAttribute("aria-expanded", "false");
      }
    });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    document.querySelectorAll(".dropdown.open").forEach(function (dd) {
      dd.classList.remove("open");
      dd.querySelector("button").setAttribute("aria-expanded", "false");
    });
  });

  /* Scroll reveal */
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }

  /* Hero stage: un-tilt as you scroll */
  var frame = document.querySelector(".stage-frame");
  if (frame && !reduceMotion) {
    var ticking = false;
    var update = function () {
      var r = frame.getBoundingClientRect();
      var vh = window.innerHeight;
      var p = Math.min(Math.max((vh - r.top) / (vh * 0.9), 0), 1);
      frame.style.setProperty("--tilt", (18 * (1 - p)).toFixed(2) + "deg");
      ticking = false;
    };
    update();
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
  }

  /* Screenshot showcase tabs */
  document.querySelectorAll("[data-showcase]").forEach(function (root) {
    var img = root.querySelector(".showcase-frame img");
    var cap = root.querySelector(".showcase-caption");
    var tabs = root.querySelectorAll(".tab");
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        tabs.forEach(function (t) { t.setAttribute("aria-selected", "false"); });
        tab.setAttribute("aria-selected", "true");
        img.style.opacity = "0";
        setTimeout(function () {
          img.src = tab.dataset.src;
          img.alt = tab.dataset.alt || tab.textContent;
          if (cap) cap.textContent = tab.dataset.caption || "";
          img.onload = function () { img.style.opacity = "1"; };
        }, 180);
      });
    });
  });

  /* Terminal tabs */
  document.querySelectorAll(".terminal").forEach(function (term) {
    var tabs = term.querySelectorAll(".ttab");
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        tabs.forEach(function (t) {
          t.setAttribute("aria-selected", String(t === tab));
          var panel = term.querySelector("#" + t.getAttribute("aria-controls"));
          if (panel) panel.hidden = t !== tab;
        });
      });
    });
  });

  /* Copy buttons: copies the visible <pre> in the same terminal, minus prompts/comments */
  document.querySelectorAll(".copy-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var term = btn.closest(".terminal");
      var pre = term.querySelector("pre:not([hidden])");
      var clone = pre.cloneNode(true);
      clone.querySelectorAll(".tok-p").forEach(function (n) { n.remove(); });
      var text = clone.textContent.replace(/\n{3,}/g, "\n\n").trim() + "\n";
      var done = function () {
        btn.classList.add("copied");
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied';
        setTimeout(function () {
          btn.classList.remove("copied");
          btn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy';
        }, 1800);
      };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done, function () { fallback(text); done(); });
      } else { fallback(text); done(); }
    });
  });
  function fallback(text) {
    var ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "absolute"; ta.style.left = "-9999px";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
  }

  /* Footer year */
  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
