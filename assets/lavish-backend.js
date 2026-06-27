(function () {
  const cfg = window.LAVISH_BACKEND_CONFIG || {};
  const hasConfig = cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase;
  if (!hasConfig) return;

  const db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

  function clean(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeProduct(row) {
    return {
      id: row.id,
      name: row.name || "",
      price: row.price || "",
      cat: row.cat || "other",
      tag: row.tag || row.cat || "",
      desc: row.description || "",
      image: row.image_url || "",
      mark: row.mark || (row.name || "L").charAt(0),
      flavors: row.flavors || "",
      flavorStock: row.flavor_stock || {},
      active: row.active !== false,
      soldOut: row.sold_out === true,
      sortOrder: Number(row.sort_order) || 0,
      stock: row.stock != null ? Number(row.stock) : null
    };
  }

  function normalizeSection(row, index) {
    return {
      id: row.id || `section-${index + 1}`,
      title: row.title || `Section ${index + 1}`,
      sub: row.sub || "",
      aliases: Array.isArray(row.aliases) && row.aliases.length ? row.aliases : [row.id],
      sortOrder: Number(row.sort_order) || index + 1
    };
  }

  function readEmbeddedSiteConfig() {
    try {
      const el = document.getElementById("lvsh-site-config");
      return el ? JSON.parse(el.textContent || "{}") : {};
    } catch (error) {
      return {};
    }
  }

  function liveValue(value, fallback = "") {
    if (value === undefined || value === null) return fallback;
    const text = String(value).trim();
    return text.startsWith("PUT_") ? "" : text;
  }

  function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object || {}, key);
  }

  function copyValue(object, key, fallback = "") {
    return hasOwn(object, key) ? String(object[key] ?? "") : fallback;
  }

  function mergeSiteConfig(settings) {
    const embedded = readEmbeddedSiteConfig();
    const embeddedSettings = embedded.settings || {};
    const dbData = settings?.data || {};
    const data = {
      ...embeddedSettings,
      ...dbData,
      orderLink: embeddedSettings.orderLink || liveValue(dbData.orderLink, "https://t.me/+1SnsQKmp1ulmOWQ5"),
      supportLink: liveValue(dbData.supportLink, embeddedSettings.supportLink || embeddedSettings.orderLink || "https://t.me/OfficialLavishz"),
      discordUsername: liveValue(dbData.discordUsername, embeddedSettings.discordUsername || "")
    };
    const nextConfig = {
      ...embedded,
      settings: data,
      hero: {
        ...(embedded.hero || {}),
        ...(dbData.hero || {})
      }
    };
    const el = document.getElementById("lvsh-site-config");
    if (el) el.textContent = JSON.stringify(nextConfig);

    // Also patch lvsh-cart-config so packaging/shipping read from Supabase
    const cartEl = document.getElementById("lvsh-cart-config");
    if (cartEl) {
      try {
        const existing = JSON.parse(cartEl.textContent || "{}");
        const patch = {};
        if (Array.isArray(data.packagingOptions)) { patch.packagingOptions = data.packagingOptions; patch.packaging = data.packagingOptions; }
        if (Array.isArray(data.shippingOptions))  { patch.shippingOptions  = data.shippingOptions;  patch.shipping  = data.shippingOptions; }
        if (Object.keys(patch).length) cartEl.textContent = JSON.stringify({ ...existing, ...patch });
      } catch (e) { /* leave unchanged */ }
    }

    window.dispatchEvent(new CustomEvent("lavish:site-config-updated", { detail: nextConfig }));
    return nextConfig;
  }

  function getDiscordLink(settings) {
    const value = String(settings?.discordUsername || "").trim();
    if (!value) return "";
    if (/^https?:\/\//i.test(value)) return value;
    return "https://discord.com/users/" + encodeURIComponent(value.replace(/^@+/, ""));
  }

  function setText(selector, value) {
    const el = document.querySelector(selector);
    if (el && value !== undefined && value !== null) el.textContent = value;
  }

  function loadFont(name) {
    const fontName = String(name || "").trim();
    if (!fontName) return;
    const id = "gf-adv-" + fontName.replace(/\s+/g, "-");
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=" + encodeURIComponent(fontName).replace(/%20/g, "+") + ":wght@300;400;500;700&display=swap";
    document.head.appendChild(link);
  }

  function applyAdvanced(settings) {
    const footer = document.querySelector(".footer");
    if (footer && hasOwn(settings, "footer")) {
      footer.firstChild.textContent = settings.footer || "";
    }

    const advanced = settings.advanced || {};
    if (advanced.displayFont) {
      loadFont(advanced.displayFont);
      document.documentElement.style.setProperty("--font-display", `'${advanced.displayFont}', serif`);
    }
    if (advanced.bodyFont) {
      loadFont(advanced.bodyFont);
      document.documentElement.style.setProperty("--font-body", `'${advanced.bodyFont}', sans-serif`);
    }

    const socials = [
      { url: advanced.instagram, label: "Instagram" },
      { url: advanced.tiktok, label: "TikTok" },
      { url: advanced.twitter, label: "X" }
    ].filter(item => item.url);
    if (footer) {
      footer.querySelector(".social-links")?.remove();
      if (socials.length) {
        const socialDiv = document.createElement("div");
        socialDiv.className = "social-links";
        socialDiv.style.cssText = "display:flex;justify-content:center;gap:1.2rem;margin-top:.6rem;opacity:.55";
        socialDiv.innerHTML = socials.map(item => `<a href="${clean(item.url)}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none">${clean(item.label)}</a>`).join("");
        footer.appendChild(socialDiv);
      }
    }
  }

  function productBelongsToSection(product, section) {
    const aliases = new Set([section.id, ...(section.aliases || [])].map(String));
    return aliases.has(String(product.cat || ""));
  }

  function productCard(product, orderLink, copy = {}) {
    const soldOut = product.soldOut === true;
    const clickAttrs = soldOut ? `disabled aria-disabled="true"` : `onclick="showFlavorPopup(this)" data-section="${clean(product.cat)}"`;
    const soldOutText = copyValue(copy, "soldOut", "Sold Out");
    const addToCartText = copyValue(copy, "addToCart", "Add to Cart");
    const stock = product.stock != null ? Number(product.stock) : null;
    const flavorStockJson = JSON.stringify(product.flavorStock || {});
    const soldBadge = soldOut
      ? `<span class="product-stock product-stock--out">${clean(soldOutText)}</span>`
      : stock != null && stock <= 25
        ? `<span class="product-stock product-stock--low">${stock} left</span>`
        : `<span class="product-stock product-stock--in">In Stock</span>`;
    const mark = product.mark || product.name?.charAt(0) || "L";
    const media = product.image
      ? `<img src="${clean(product.image)}" alt="${clean(product.name)}">`
      : `<div class="product-emoji">${clean(mark)}</div>`;
    return `
      <div class="product-card${soldOut ? " is-sold-out" : ""}">
        <div class="product-image"><button class="product-image-btn" ${clickAttrs} data-name="${clean(product.name)}" data-price="${clean(product.price)}" data-tag="${clean(product.tag || product.cat)}" data-img="${clean(product.image)}" data-mark="${clean(mark)}" data-emoji="${clean(mark)}" data-flavors="${clean(product.flavors || "")}" data-flavor-stock='${clean(flavorStockJson)}'>${media}${soldBadge}</button></div>
        <div class="product-body">
          <div class="product-top">
            <h4 class="product-name">${clean(product.name)}</h4>
            <div class="product-price">${clean(product.price)}</div>
          </div>
          <p class="product-desc">${clean(product.desc)}</p>
          <div class="product-bottom">
            <span class="product-tag">${clean(product.tag || product.cat)}</span>
            <a class="order-small" href="${clean(orderLink)}">Order</a>
          </div>
          <button class="atc-btn" ${soldOut ? "disabled" : `onclick="this.closest('.product-card').querySelector('.product-image-btn').click()"`}>
            ${clean(soldOut ? soldOutText : addToCartText)}
          </button>
        </div>
      </div>`;
  }

  let _dealTimerIv = null;

  function renderDealBanner(data) {
    const banner = document.getElementById("deal-banner");
    if (!banner) return;
    if (_dealTimerIv) { clearInterval(_dealTimerIv); _dealTimerIv = null; }
    const deal = data.deal || {};
    const expires = deal.expiresAt ? new Date(deal.expiresAt) : null;
    const now = new Date();
    const isActive = deal.enabled === true && (!expires || now < expires);
    if (!isActive) { banner.hidden = true; return; }
    const countdown = banner.querySelector(".deal-countdown") || document.createElement("span");
    countdown.className = "deal-countdown";
    banner.innerHTML = [
      `<span class="deal-label">${clean(deal.label || "24HR DEAL")}</span>`,
      deal.productName ? `<span class="deal-product">${clean(deal.productName)}</span>` : "",
      (deal.originalPrice || deal.dealPrice) ? `<span class="deal-prices">${deal.originalPrice ? `<span class="deal-orig">${clean(deal.originalPrice)}</span>` : ""}${deal.dealPrice ? `<span class="deal-price">${clean(deal.dealPrice)}</span>` : ""}</span>` : "",
      expires ? `<span class="deal-countdown"></span>` : ""
    ].filter(Boolean).join("");
    banner.hidden = false;
    if (expires) {
      const cd = banner.querySelector(".deal-countdown");
      function tick() {
        const diff = expires - new Date();
        if (diff <= 0) { banner.hidden = true; clearInterval(_dealTimerIv); _dealTimerIv = null; return; }
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        if (cd) cd.textContent = `ends in ${h}h ${m}m ${s}s`;
      }
      tick();
      _dealTimerIv = setInterval(tick, 1000);
    }
  }

  function renderStore(settings, sections, products) {
    window._lavishProducts = products;
    const siteConfig = mergeSiteConfig(settings);
    const data = siteConfig.settings || {};
    if (data.deal?.expiresAt) window._lavishDealExpiry = data.deal.expiresAt;
    const hero = siteConfig.hero || {};
    const orderLink = getDiscordLink(data) || data.orderLink || "";

    if (data.name !== undefined && data.name !== null) document.title = data.name || "";
    setText(".logo", data.name);
    setText(".hero-title", hero.title);
    setText(".hero-sub", hero.sub);
    setText(".hero-note", hero.note);
    applyAdvanced(data);
    renderDealBanner(data);

    document.querySelectorAll(".nav-order, .order-small").forEach(link => link.setAttribute("href", orderLink));
    const heroButtons = document.querySelectorAll(".hero-btn");
    if (heroButtons[0] && hasOwn(hero, "btn1")) heroButtons[0].textContent = hero.btn1 || "";
    if (heroButtons[1]) {
      if (hasOwn(hero, "btn2")) heroButtons[1].textContent = hero.btn2 || "";
      heroButtons[1].setAttribute("href", orderLink || data.supportLink || "");
    }

    const categoryNav = document.querySelector(".category-nav");
    if (categoryNav) {
      categoryNav.innerHTML = [
        `<button type="button" class="category-filter active" data-section-filter="all">All</button>`,
        ...sections.map(section => `<button type="button" class="category-filter" data-section-filter="${clean(section.id)}">${clean(section.title)}</button>`)
      ].join("");
    }

    const menuWrap = document.querySelector(".menu-wrap");
    if (!menuWrap) return;
    menuWrap.innerHTML = sections.map(section => {
      const sectionProducts = products
        .filter(product => product.active !== false)
        .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0))
        .filter(product => productBelongsToSection(product, section));
      if (!sectionProducts.length) return "";
      return `
        <div class="menu-section" id="${clean(section.id)}">
          <div class="menu-section-title">
            <h3>${clean(section.title)}</h3>
            <span>${clean(section.sub)}</span>
          </div>
          <div class="product-grid">
            ${sectionProducts.map(product => productCard(product, orderLink, data.copy || {})).join("")}
          </div>
        </div>`;
    }).join("");

    if (typeof window.initMenuCategoryFilters === "function") {
      window.initMenuCategoryFilters();
    }
    ["applyCartCopy", "applyThemeAndCopy", "renderFAQ", "renderCart", "renderTrustSection", "reinitBackground"].forEach(name => {
      if (typeof window[name] === "function") window[name]();
    });
  }

  async function loadStore() {
    if (new URLSearchParams(location.search).get("draft") === "1") {
      try {
        const draft = JSON.parse(localStorage.getItem("lavish_draft_v1") || "null");
        if (draft) {
          renderStore(
            { data: draft.settings },
            (draft.sections || []).map(normalizeSection),
            (draft.products || []).filter(p => p.active !== false).map(normalizeProduct)
          );
          const badge = document.createElement("div");
          badge.style.cssText = "position:fixed;bottom:1rem;right:1rem;z-index:9999;background:rgba(255,160,0,.88);color:#000;font-size:.68rem;letter-spacing:.14em;text-transform:uppercase;padding:.38rem .75rem;border-radius:4px;font-weight:700;pointer-events:none";
          badge.textContent = "DRAFT PREVIEW";
          document.body.appendChild(badge);
          return;
        }
      } catch(e) {}
    }
    const [{ data: settings }, { data: sectionRows }, { data: productRows, error }, { data: shipOpts }] = await Promise.all([
      db.from("site_settings").select("data").eq("id", "main").maybeSingle(),
      db.from("menu_sections").select("*").order("sort_order", { ascending: true }),
      db.from("products").select("*").eq("active", true).order("sort_order", { ascending: true }),
      db.from("shipping_options").select("*").eq("active", true).order("sort_order", { ascending: true })
    ]);
    if (error) throw error;
    if (shipOpts && shipOpts.length) {
      window.lavishShippingOptions = shipOpts.map(r => ({
        id: r.id,
        name: r.name,
        fee: Number(r.fee) || 0,
        eta: r.eta || ""
      }));
      if (typeof window.renderShipSpeedOptions === "function") window.renderShipSpeedOptions();
    }
    renderStore(
      settings || {},
      (sectionRows || []).map(normalizeSection),
      (productRows || []).map(normalizeProduct)
    );
  }

  loadStore()
    .then(() => console.log("[Lavish] Backend loaded from Supabase"))
    .catch(error => {
      console.error("[Lavish] Backend load failed — live site using embedded data:", error?.message || error);
    });

  window.lavishCheckRegion = async function(country, state) {
    try {
      const { data } = await db.from("restricted_regions").select("type,code,reason");
      if (!data || !data.length) return { blocked: false };
      const norm = s => String(s || "").toLowerCase().trim();
      const c = norm(country), st = norm(state);
      const hit = data.find(row => {
        const code = norm(row.code);
        if (row.type === "country" && c) return c.includes(code) || code.includes(c);
        if (row.type === "state" && st) return st.includes(code) || code.includes(st);
        return false;
      });
      return hit ? { blocked: true, reason: hit.reason || "We're unable to ship to your location." } : { blocked: false };
    } catch (e) {
      return { blocked: false };
    }
  };
})();
