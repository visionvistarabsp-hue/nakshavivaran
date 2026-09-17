(() => {
  "use strict";

  const IMG_W = 7200;
  const IMG_H = 4000;

  const STATUS = {
    available: { color: "#2fa36b", label: "Available" },
    booked:    { color: "#d96a4f", label: "Booked" },
    hold:      { color: "#e0a53a", label: "Hold" },
  };

  const $ = (id) => document.getElementById(id);
  const svgNS = "http://www.w3.org/2000/svg";

  let data = null;
  let selectedLabel = null;
  let markers = {};
  let scale = 1, tx = 0, ty = 0;

  async function init() {
    try {
      const res = await fetch("data.json", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      data = await res.json();
    } catch (e) {
      if (location.protocol === "file:") {
        toast("Open this page through a local server so data.json can load.");
      } else {
        toast("Could not load data.json (" + (e && e.message) + ")");
      }
      return;
    }
    render();
  }

  function render() {
    document.title = data.name + " -- Plot Brochure";
    const lead = $("heroLead");
    if (lead) lead.textContent = data.description || lead.textContent;
    $("statPlots").textContent = (data.plots.length + "+").replace("++", "+");
    buildMarkers();
    updateStats();
    buildAmenities();
    buildGallery();
    setContact();
    bindUI();
    $("year").textContent = String(new Date().getFullYear());
    applyTransform();
  }

  /* -------- polygon markers -------- */
  function buildMarkers() {
    const photo = $("photoSvg");
    const clean = $("cleanSvg");
    photo.innerHTML = "";
    clean.innerHTML = "";
    markers = {};

    data.plots.forEach((p) => {
      const st = STATUS[p.status] || STATUS.available;
      const poly = p.polygon;
      const cx = p.cx || p.x;
      const cy = p.cy || p.y;

      const mkGroup = (svg, showLabel) => {
        const g = document.createElementNS(svgNS, "g");
        g.setAttribute("class", "plot-marker" + (p.status && p.status !== "available" ? " t-" + p.status : ""));
        g.setAttribute("data-label", p.label);

        if (poly && poly.length >= 3) {
          // Draw real polygon
          const polygon = document.createElementNS(svgNS, "polygon");
          const ptsStr = poly.map(function(pt) { return pt[0] + "," + pt[1]; }).join(" ");
          polygon.setAttribute("points", ptsStr);
          polygon.setAttribute("fill", st.color);
          polygon.setAttribute("fill-opacity", "0.35");
          polygon.setAttribute("stroke", st.color);
          polygon.setAttribute("stroke-width", "12");
          polygon.setAttribute("stroke-opacity", "0.9");
          polygon.setAttribute("stroke-linejoin", "round");
          polygon.setAttribute("class", "plot-poly");
          g.appendChild(polygon);

          // Plot number label
          const t = document.createElementNS(svgNS, "text");
          t.textContent = p.label;
          t.setAttribute("class", "plot-label");
          t.setAttribute("x", cx);
          t.setAttribute("y", cy + 5);
          t.setAttribute("text-anchor", "middle");
          t.setAttribute("dominant-baseline", "central");
          t.setAttribute("font-size", calcFontSize(poly, p.label));
          t.setAttribute("font-weight", "700");
          t.setAttribute("fill", "#000000");
          t.setAttribute("paint-order", "stroke");
          t.setAttribute("stroke", "rgba(255,255,255,0.7)");
          t.setAttribute("stroke-width", "4");
          t.setAttribute("stroke-linejoin", "round");
          if (!showLabel) {
            t.style.display = "none";
          }
          g.appendChild(t);
        } else {
          // Fallback: small circle marker
          const circle = document.createElementNS(svgNS, "circle");
          circle.setAttribute("cx", cx);
          circle.setAttribute("cy", cy);
          circle.setAttribute("r", 40);
          circle.setAttribute("fill", st.color);
          circle.setAttribute("stroke", "#fff");
          circle.setAttribute("stroke-width", "4");
          g.appendChild(circle);

          // Plot number label
          const t2 = document.createElementNS(svgNS, "text");
          t2.textContent = p.label;
          t2.setAttribute("class", "plot-label");
          t2.setAttribute("x", cx);
          t2.setAttribute("y", cy + 4);
          t2.setAttribute("text-anchor", "middle");
          t2.setAttribute("font-size", "28");
          t2.setAttribute("font-weight", "700");
          t2.setAttribute("fill", "#000000");
          t2.setAttribute("paint-order", "stroke");
          t2.setAttribute("stroke", "rgba(255,255,255,0.7)");
          t2.setAttribute("stroke-width", "4");
          t2.setAttribute("stroke-linejoin", "round");
          g.appendChild(t2);
        }
        return g;
      };

      const gp = mkGroup(photo, false);
      const gc = mkGroup(clean, true);
      photo.appendChild(gp);
      clean.appendChild(gc);
      markers[p.label] = { photo: gp, clean: gc };
    });

    wireMarkerEvents(photo);
    wireMarkerEvents(clean);
    updateLabelVisibility();
  }

  function calcFontSize(poly, label) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    poly.forEach(function(pt) {
      if (pt[0] < minX) minX = pt[0];
      if (pt[0] > maxX) maxX = pt[0];
      if (pt[1] < minY) minY = pt[1];
      if (pt[1] > maxY) maxY = pt[1];
    });
    var w = maxX - minX;
    var h = maxY - minY;
    var minDim = Math.min(w, h);
    var fs = minDim * 0.38;
    if (label.length > 4) fs *= 0.75;
    return Math.max(14, Math.min(52, Math.round(fs)));
  }

  function wireMarkerEvents(svg) {
    svg.querySelectorAll(".plot-marker").forEach(function(g) {
      g.addEventListener("mouseenter", function(ev) { showTooltip(ev, g); });
      g.addEventListener("mousemove", function(ev) { moveTooltip(ev); });
      g.addEventListener("mouseleave", function() { hideTooltip(); });
      g.addEventListener("click", function() { selectPlot(g.getAttribute("data-label")); });
    });
  }

  /* -------- selection -------- */
  function selectPlot(label) {
    var m = markers[label];
    if (!m) return;
    selectedLabel = label;

    Object.values(markers).forEach(function(mk) {
      mk.photo.classList.remove("selected");
      mk.clean.classList.remove("selected");
    });
    m.photo.classList.add("selected");
    m.clean.classList.add("selected");

    var p = data.plots.find(function(d) { return d.label === label; });
    var st = STATUS[p.status] || STATUS.available;

    $("pdEmpty").classList.add("hidden");
    $("pdBody").classList.remove("hidden");
    $("pdLabel").textContent = p.label;
    $("pdNo").textContent = p.label;
    $("pdNo2").textContent = p.label;
    var stEl = $("pdStatus");
    stEl.textContent = st.label;
    stEl.className = "pd-status s-" + p.status;
    $("pdStatusText").textContent = st.label;
    $("pdArea").textContent = data.area_text || "On request";
    $("fPlot").value = p.label;
  }

  /* -------- tooltip -------- */
  function showTooltip(ev, g) {
    var lbl = g.getAttribute("data-label");
    var p = data.plots.find(function(d) { return d.label === lbl; });
    var st = STATUS[p.status] || STATUS.available;
    var tt = $("mapTooltip");
    tt.innerHTML =
      '<div class="tt-title">Plot ' + lbl + "</div>" +
      '<div class="tt-row"><span><span class="dot" style="background:' + st.color + '"></span>' + st.label + "</span><span>" +
      (data.area_text || "On request") + "</span></div>";
    tt.style.display = "block";
    moveTooltip(ev);
  }
  function moveTooltip(ev) {
    var tt = $("mapTooltip");
    var vp = $("mapViewport");
    var r = vp.getBoundingClientRect();
    var x = ev.clientX - r.left + 14;
    var y = ev.clientY - r.top + 14;
    if (x + 170 > r.width) x = ev.clientX - r.left - 178;
    if (y + 80 > r.height) y = ev.clientY - r.top - 70;
    tt.style.left = x + "px";
    tt.style.top = y + "px";
  }
  function hideTooltip() {
    $("mapTooltip").style.display = "none";
  }

  /* -------- stats -------- */
  function updateStats() {
    var avail = 0, booked = 0, hold = 0;
    data.plots.forEach(function(p) {
      if (p.status === "booked") booked++;
      else if (p.status === "hold") hold++;
      else avail++;
    });
    $("statTotal").textContent = data.plots.length;
    $("statAvailable").textContent = avail;
    $("miniAvail").textContent = avail;
    $("miniBooked").textContent = booked;
    $("miniHold").textContent = hold;
  }

  /* -------- amenities -------- */
  function buildAmenities() {
    var grid = $("amenGrid");
    if (!data.amenities || !data.amenities.length) return;
    var icons = {
      layout: '<path d="M3 6l9-3 9 3"/><path d="M3 6v12l9 3 9-3V6"/><path d="M12 3v18"/>',
      road: '<path d="M6 21V8a6 6 0 0 1 12 0v13"/><path d="M6 12h12"/>',
      star: '<path d="M12 2l2.5 5 5.5.8-4 3.9 1 5.5-5-2.6-5 2.6 1-5.5-4-3.9 5.5-.8z"/>',
      water: '<path d="M12 3c3 3.5 5 6.5 5 10a5 5 0 0 1-10 0c0-3.5 2-6.5 5-10z"/>',
      access: '<path d="M20 12H4"/><path d="M7 8l-3 4 3 4"/><path d="M17 8l3 4-3 4"/>',
      shield: '<path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10z"/>',
    };
    grid.innerHTML = "";
    data.amenities.forEach(function(a) {
      var d = icons[a.icon] || icons.layout;
      var el = document.createElement("div");
      el.className = "amenity";
      el.innerHTML =
        '<span class="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + d + "</svg></span>" +
        "<div><h4>" + a.name + "</h4><p>" + a.note + "</p></div>";
      grid.appendChild(el);
    });
  }

  function buildGallery() {
    var grid = $("galleryGrid");
    var items = [
      { src: data.image, cap: "Original layout plan -- full view" },
      { src: data.thumbnail, cap: "JALI layout -- overview" },
    ];
    grid.innerHTML = "";
    items.forEach(function(it) {
      var fig = document.createElement("figure");
      fig.className = "gallery-item";
      fig.innerHTML = '<img src="' + it.src + '" alt="' + it.cap + '" loading="lazy" />' +
        "<figcaption>" + it.cap + "</figcaption>";
      fig.addEventListener("click", function() {
        $("lightboxImg").src = it.src;
        $("lightbox").classList.add("open");
      });
      grid.appendChild(fig);
    });
  }

  /* -------- contact -------- */
  function setContact() {
    var c = data.contact || {};
    var ph = c.phone || "+91 90000 00000";
    var wa = c.whatsapp || c.phone || ph;
    var digits = wa.replace(/[^\d]/g, "");
    $("callBtn").setAttribute("href", "tel:" + ph.replace(/[^\d+]/g, ""));
    $("waBtn").setAttribute(
      "href",
      "https://wa.me/" + digits + "?text=" + encodeURIComponent("Hi! I'm interested in a plot in " + data.name + ".")
    );
    var f = $("enquiryForm");
    f.addEventListener("submit", function(ev) {
      ev.preventDefault();
      var name = $("fName").value.trim();
      var phone = $("fPhone").value.trim();
      if (!name || !phone) {
        $("formMsg").textContent = "Please add your name and phone number.";
        return;
      }
      var msg = $("fMsg").value.trim();
      var text =
        "New plot enquiry\nName: " + name +
        "\nPhone: " + phone +
        ($("fPlot").value.trim() ? "\nPlot: " + $("fPlot").value.trim() : "") +
        (msg ? "\nMessage: " + msg : "");
      window.open("https://wa.me/" + digits + "?text=" + encodeURIComponent(text), "_blank");
      $("formMsg").textContent = "Thanks " + name + "! Opening WhatsApp to send your enquiry...";
      f.reset();
    });
  }

  /* -------- zoom / pan -------- */
  function applyTransform() {
    var el = $("mapInner");
    el.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + scale + ")";
    $("mapViewport").style.setProperty("--scale", scale.toFixed(2));
    updateLabelVisibility();
  }

  function updateLabelVisibility() {
    var show = scale >= 1.4;
    Object.values(markers).forEach(function(m) {
      var lbl = m.photo.querySelector(".plot-label");
      if (lbl) lbl.style.display = show ? "" : "none";
    });
  }

  function clampViewport() {
    var vp = $("mapViewport");
    var w = vp.clientWidth, h = vp.clientHeight;
    var mw = w * scale, mh = h * scale;
    tx = Math.min(0, Math.max(tx, w - mw));
    ty = Math.min(0, Math.max(ty, h - mh));
  }

  function zoomAt(px, py, factor) {
    var before = scale;
    scale = Math.min(8, Math.max(1, before * factor));
    var k = scale / before;
    tx = px - (px - tx) * k;
    ty = py - (py - ty) * k;
    clampViewport();
    applyTransform();
  }

  function zoomCentered(factor) {
    var vp = $("mapViewport");
    zoomAt(vp.clientWidth / 2, vp.clientHeight / 2, factor);
  }

  function resetView() {
    scale = 1; tx = 0; ty = 0;
    applyTransform();
  }

  /* -------- UI wiring -------- */
  function bindUI() {
    var vp = $("mapViewport");

    $("viewPhoto").addEventListener("click", function() {
      vp.classList.remove("clean");
      $("viewPhoto").classList.add("active");
      $("viewClean").classList.remove("active");
    });
    $("viewClean").addEventListener("click", function() {
      vp.classList.add("clean");
      $("viewClean").classList.add("active");
      $("viewPhoto").classList.remove("active");
    });

    $("zoomIn").addEventListener("click", function() { zoomCentered(1.4); });
    $("zoomOut").addEventListener("click", function() { zoomCentered(1 / 1.4); });
    $("zoomHome").addEventListener("click", resetView);

    vp.addEventListener("wheel", function(ev) {
      ev.preventDefault();
      var r = vp.getBoundingClientRect();
      var px = ev.clientX - r.left;
      var py = ev.clientY - r.top;
      zoomAt(px, py, ev.deltaY < 0 ? 1.18 : 1 / 1.18);
    }, { passive: false });

    var dragging = false, dragSx = 0, dragSy = 0, startTx = 0, startTy = 0;
    vp.addEventListener("pointerdown", function(ev) {
      dragging = true;
      vp.classList.add("dragging");
      dragSx = ev.clientX; dragSy = ev.clientY;
      startTx = tx; startTy = ty;
      vp.setPointerCapture(ev.pointerId);
    });
    vp.addEventListener("pointermove", function(ev) {
      if (!dragging) return;
      tx = startTx + (ev.clientX - dragSx);
      ty = startTy + (ev.clientY - dragSy);
      clampViewport();
      applyTransform();
    });
    var endDrag = function() {
      dragging = false;
      vp.classList.remove("dragging");
    };
    vp.addEventListener("pointerup", endDrag);
    vp.addEventListener("pointercancel", endDrag);
    vp.addEventListener("pointerleave", hideTooltip);

    // search
    var search = $("plotSearch");
    var doSearch = function() {
      var q = search.value.trim();
      if (!q) return;
      var key = q.toLowerCase();
      var exact = data.plots.find(function(p) { return p.label.toLowerCase() === key; });
      var partial = data.plots.find(function(p) { return p.label.toLowerCase().indexOf(key) !== -1; });
      var found = exact || partial;
      if (!found) {
        toast("No plot found for \"" + q + "\".");
        return;
      }
      var sx = ((found.cx || found.x) / IMG_W) * vp.clientWidth;
      var sy = ((found.cy || found.y) / IMG_H) * vp.clientHeight;
      var target = 2.4;
      var k = target / scale;
      scale = target;
      tx = vp.clientWidth / 2 - sx * k;
      ty = vp.clientHeight / 2 - sy * k;
      clampViewport();
      applyTransform();
      selectPlot(found.label);
      var m = markers[found.label];
      if (m) {
        m.photo.classList.add("flash");
        m.clean.classList.add("flash");
        setTimeout(function() {
          m.photo.classList.remove("flash");
          m.clean.classList.remove("flash");
        }, 1400);
      }
    };
    search.addEventListener("keydown", function(ev) { if (ev.key === "Enter") doSearch(); });
    search.addEventListener("change", doSearch);

    var nav = $("nav");
    $("navToggle").addEventListener("click", function() {
      var open = nav.classList.toggle("open");
      document.getElementById("navToggle").setAttribute("aria-expanded", String(open));
    });
    nav.addEventListener("click", function(ev) { if (ev.target.tagName === "A") nav.classList.remove("open"); });

    window.addEventListener("resize", function() { clampViewport(); applyTransform(); });

    var lb = $("lightbox");
    lb.addEventListener("click", function() { lb.classList.remove("open"); });
    document.addEventListener("keydown", function(ev) { if (ev.key === "Escape") lb.classList.remove("open"); });
  }

  /* -------- toast -------- */
  var toastTimer = null;
  function toast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function() { t.classList.remove("show"); }, 3600);
  }

  init();
})();
