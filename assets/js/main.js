/* =========================================================
   WealthPay — interactions
   Vanilla JS, no dependencies.
   ========================================================= */
(function () {
    "use strict";

    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var $ = function (sel, ctx) {
        return (ctx || document).querySelector(sel);
    };
    var $$ = function (sel, ctx) {
        return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
    };

    /* ---------------------------------------------------------
       Sticky navigation + scroll progress
       --------------------------------------------------------- */
    function initChrome() {
        var nav = $(".nav");
        var bar = $(".scroll-bar");

        function onScroll() {
            var y = window.pageYOffset;
            if (nav) nav.classList.toggle("is-stuck", y > 20);
            if (bar) {
                var max = document.documentElement.scrollHeight - window.innerHeight;
                bar.style.width = (max > 0 ? (y / max) * 100 : 0) + "%";
            }
        }

        window.addEventListener("scroll", onScroll, { passive: true });
        onScroll();
    }

    /* ---------------------------------------------------------
       Mobile menu
       --------------------------------------------------------- */
    function initMenu() {
        var toggle = $(".nav-toggle");
        var menu = $(".mobile-menu");
        if (!toggle || !menu) return;

        function setOpen(open) {
            toggle.classList.toggle("is-open", open);
            menu.classList.toggle("is-open", open);
            document.body.classList.toggle("is-locked", open);
            toggle.setAttribute("aria-expanded", String(open));
            toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
        }

        function close() {
            setOpen(false);
        }

        toggle.addEventListener("click", function () {
            setOpen(!menu.classList.contains("is-open"));
        });

        $$("a", menu).forEach(function (a) {
            a.addEventListener("click", close);
        });

        window.addEventListener("keydown", function (e) {
            if (e.key === "Escape") close();
        });

        /* the panel only exists under the breakpoint; leaving it open while
           the layout switches back would lock the page scroll. */
        window.addEventListener("resize", function () {
            if (window.innerWidth > 860) close();
        });
    }

    /* ---------------------------------------------------------
       Scroll reveal
       --------------------------------------------------------- */
    function initReveal() {
        var items = $$("[data-reveal]");
        var pipes = $$(".pipe");
        var all = items.concat(pipes);
        if (!all.length) return;

        if (reduced || !("IntersectionObserver" in window)) {
            all.forEach(function (el) {
                el.classList.add("is-in");
            });
            return;
        }

        var io = new IntersectionObserver(
            function (entries) {
                entries.forEach(function (entry) {
                    if (!entry.isIntersecting) return;
                    var el = entry.target;
                    var delay = parseInt(el.getAttribute("data-delay") || "0", 10);
                    setTimeout(function () {
                        el.classList.add("is-in");
                    }, delay);
                    io.unobserve(el);
                });
            },
            { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
        );

        all.forEach(function (el) {
            io.observe(el);
        });
    }

    /* ---------------------------------------------------------
       Animated counters
       --------------------------------------------------------- */
    function initCounters() {
        var nodes = $$("[data-count]");
        if (!nodes.length) return;

        var DURATION = 1600;
        /* counting restarts when the number comes back, so it needs a low
           threshold to arm again and a full exit to disarm. */
        var ENTER = 0.45;

        function format(el, value) {
            var decimals = parseInt(el.getAttribute("data-decimals") || "0", 10);
            var prefix = el.getAttribute("data-prefix") || "";
            var suffix = el.getAttribute("data-suffix") || "";
            return (
                prefix +
                Number(value.toFixed(decimals)).toLocaleString("en-US", {
                    minimumFractionDigits: decimals,
                    maximumFractionDigits: decimals
                }) +
                suffix
            );
        }

        function stop(el) {
            if (el.countFrame) {
                cancelAnimationFrame(el.countFrame);
                el.countFrame = null;
            }
        }

        function reset(el) {
            stop(el);
            el.textContent = format(el, 0);
        }

        function run(el) {
            var target = parseFloat(el.getAttribute("data-count"));

            if (reduced) {
                el.textContent = format(el, target);
                return;
            }

            stop(el);
            var start = null;

            function frame(ts) {
                if (start === null) start = ts;
                var p = Math.min((ts - start) / DURATION, 1);
                var eased = 1 - Math.pow(1 - p, 3);
                el.textContent = format(el, target * eased);
                el.countFrame = p < 1 ? requestAnimationFrame(frame) : null;
            }

            el.countFrame = requestAnimationFrame(frame);
        }

        if (!("IntersectionObserver" in window)) {
            nodes.forEach(run);
            return;
        }

        var io = new IntersectionObserver(
            function (entries) {
                entries.forEach(function (entry) {
                    var el = entry.target;
                    if (entry.isIntersecting && entry.intersectionRatio >= ENTER) {
                        if (el.countArmed) return;
                        el.countArmed = true;
                        run(el);
                    } else if (!entry.isIntersecting && el.countArmed) {
                        el.countArmed = false;
                        reset(el);
                    }
                });
            },
            { threshold: [0, ENTER] }
        );

        nodes.forEach(function (el) {
            reset(el);
            io.observe(el);
        });
    }

    /* ---------------------------------------------------------
       Pointer glow on cards
       --------------------------------------------------------- */
    function initCardGlow() {
        if (reduced) return;
        $$(".card").forEach(function (card) {
            card.addEventListener("mousemove", function (e) {
                var r = card.getBoundingClientRect();
                card.style.setProperty("--mx", e.clientX - r.left + "px");
                card.style.setProperty("--my", e.clientY - r.top + "px");
            });
        });
    }

    /* ---------------------------------------------------------
       Card brand detection
       --------------------------------------------------------- */
    var BRANDS = [
        { id: "elo", label: "Elo", test: /^(4011|4312|4389|4576|5041|5066|5090|6277|6363|650)/ },
        { id: "amex", label: "American Express", test: /^3[47]/, gaps: [4, 10], length: 15, cvc: 4 },
        { id: "diners", label: "Diners Club", test: /^3(?:0[0-59]|[689])/, gaps: [4, 10], length: 14, cvc: 3 },
        { id: "jcb", label: "JCB", test: /^(?:2131|1800|35)/ },
        { id: "unionpay", label: "UnionPay", test: /^62/ },
        { id: "discover", label: "Discover", test: /^(?:6011|64[4-9]|65)/ },
        { id: "mastercard", label: "Mastercard", test: /^(?:5[1-5]|2[2-7])/ },
        { id: "visa", label: "Visa", test: /^4/ }
    ];

    function detectBrand(digits) {
        for (var i = 0; i < BRANDS.length; i++) {
            if (BRANDS[i].test.test(digits)) return BRANDS[i];
        }
        return null;
    }

    function formatNumber(digits, brand) {
        var gaps = (brand && brand.gaps) || [4, 8, 12];
        var out = "";
        for (var i = 0; i < digits.length; i++) {
            if (gaps.indexOf(i) > -1) out += " ";
            out += digits[i];
        }
        return out;
    }

    /* ---------------------------------------------------------
       Checkout simulator
       --------------------------------------------------------- */
    function initSimulator() {
        var form = $("#pay-form");
        if (!form) return;

        var numberInput = $("#cc-number");
        var expiryInput = $("#cc-expiry");
        var cvcInput = $("#cc-cvc");
        var nameInput = $("#cc-name");
        var submit = $("#pay-submit");
        var submitLabel = $("#pay-submit-label");
        var visual = $(".credit-card");
        var visualNumber = $("#cc-visual-number");
        var visualName = $("#cc-visual-name");
        var visualExpiry = $("#cc-visual-expiry");
        var visualBrand = $("#cc-visual-brand");
        var inputBrand = $("#cc-input-brand");
        var steps = $$(".flow-step");
        var result = $("#flow-result");
        var resultTitle = $("#flow-result-title");
        var resultMeta = $("#flow-result-meta");
        var flowStatus = $("#flow-status");
        var tiles = $$(".brand-tile");
        var running = false;

        var MASK = "•••• •••• •••• ••••";

        function markBrand(brand) {
            tiles.forEach(function (tile) {
                tile.classList.toggle("is-active", !!brand && tile.getAttribute("data-brand") === brand.id);
            });

            var mark = brand ? $('.brand-tile[data-brand="' + brand.id + '"] svg', document) : null;
            if (mark) {
                inputBrand.innerHTML = mark.outerHTML;
                inputBrand.classList.add("is-on");
                visualBrand.innerHTML = mark.outerHTML;
            } else {
                inputBrand.classList.remove("is-on");
                visualBrand.innerHTML = "";
            }
        }

        function syncVisual() {
            var digits = numberInput.value.replace(/\D/g, "");
            var brand = detectBrand(digits);
            var pretty = formatNumber(digits, brand);
            visualNumber.textContent = pretty ? pretty + MASK.slice(pretty.length) : MASK;
            markBrand(brand);
            cvcInput.setAttribute("maxlength", brand && brand.cvc === 4 ? "4" : "3");
        }

        numberInput.addEventListener("input", function () {
            var digits = numberInput.value.replace(/\D/g, "").slice(0, 19);
            var brand = detectBrand(digits);
            if (brand && brand.length) digits = digits.slice(0, brand.length);
            else digits = digits.slice(0, 16);
            numberInput.value = formatNumber(digits, brand);
            syncVisual();
        });

        expiryInput.addEventListener("input", function () {
            var digits = expiryInput.value.replace(/\D/g, "").slice(0, 4);
            if (digits.length > 2) digits = digits.slice(0, 2) + "/" + digits.slice(2);
            expiryInput.value = digits;
            visualExpiry.textContent = digits || "MM/YY";
        });

        cvcInput.addEventListener("input", function () {
            cvcInput.value = cvcInput.value.replace(/\D/g, "");
            if (visual) visual.classList.add("is-flipped");
        });

        cvcInput.addEventListener("blur", function () {
            if (visual) visual.classList.remove("is-flipped");
        });

        nameInput.addEventListener("input", function () {
            visualName.textContent = nameInput.value.toUpperCase() || "YOUR NAME HERE";
        });

        tiles.forEach(function (tile) {
            tile.addEventListener("click", function () {
                var samples = {
                    visa: "4242424242424242",
                    mastercard: "5555555555554444",
                    amex: "378282246310005",
                    discover: "6011111111111117",
                    diners: "30569309025904",
                    jcb: "3566002020360505",
                    elo: "6363689999999999",
                    unionpay: "6200000000000005"
                };
                var digits = samples[tile.getAttribute("data-brand")];
                if (!digits) return;
                var brand = detectBrand(digits);
                numberInput.value = formatNumber(digits, brand);
                syncVisual();
            });
        });

        function resetFlow() {
            steps.forEach(function (step) {
                step.classList.remove("is-active", "is-done");
                var t = $(".flow-time", step);
                if (t) t.textContent = "--";
            });
            result.classList.remove("is-on", "is-error");
        }

        function wait(ms) {
            return new Promise(function (resolve) {
                setTimeout(resolve, reduced ? 60 : ms);
            });
        }

        function authCode() {
            var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
            var out = "";
            for (var i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
            return out;
        }

        form.addEventListener("submit", function (e) {
            e.preventDefault();
            if (running) return;

            var digits = numberInput.value.replace(/\D/g, "");
            if (digits.length < 13) {
                numberInput.focus();
                return;
            }

            running = true;
            resetFlow();
            submit.disabled = true;
            submitLabel.textContent = "Processing…";
            if (flowStatus) flowStatus.textContent = "Running";

            /* 4000 0000 0000 0002 is the classic "declined" test number. */
            var declined = digits === "4000000000000002";
            var total = 0;

            var chain = Promise.resolve();

            steps.forEach(function (step, index) {
                chain = chain.then(function () {
                    step.classList.add("is-active");
                    /* the animation is slowed down so the flow can be followed;
                       the latency reported is the one a real authorization takes. */
                    var ms = 220 + Math.round(Math.random() * 260);
                    var latency = 18 + Math.round(Math.random() * 44);
                    return wait(ms).then(function () {
                        total += latency;
                        step.classList.remove("is-active");
                        step.classList.add("is-done");
                        var t = $(".flow-time", step);
                        if (t) t.textContent = latency + "ms";
                        if (declined && index === steps.length - 1) {
                            step.classList.remove("is-done");
                        }
                    });
                });
            });

            chain.then(function () {
                running = false;
                submit.disabled = false;
                submitLabel.textContent = "Pay $249.00";

                if (declined) {
                    result.classList.add("is-on", "is-error");
                    resultTitle.textContent = "Authorization declined by the issuer";
                    resultMeta.textContent = "code: do_not_honor · retry routing available";
                    if (flowStatus) flowStatus.textContent = "Declined";
                } else {
                    result.classList.add("is-on");
                    resultTitle.textContent = "Payment approved";
                    resultMeta.textContent =
                        "auth: " + authCode() + " · " + total + "ms · settlement in D+1";
                    if (flowStatus) flowStatus.textContent = "Approved";
                }
            });
        });

        syncVisual();
    }

    /* ---------------------------------------------------------
       FAQ accordion
       --------------------------------------------------------- */
    function initFaq() {
        var items = $$(".faq-item");
        items.forEach(function (item) {
            var q = $(".faq-q", item);
            var a = $(".faq-a", item);
            if (!q || !a) return;

            q.addEventListener("click", function () {
                var open = item.classList.contains("is-open");

                items.forEach(function (other) {
                    other.classList.remove("is-open");
                    var oa = $(".faq-a", other);
                    if (oa) oa.style.maxHeight = null;
                    var oq = $(".faq-q", other);
                    if (oq) oq.setAttribute("aria-expanded", "false");
                });

                if (!open) {
                    item.classList.add("is-open");
                    a.style.maxHeight = a.scrollHeight + "px";
                    q.setAttribute("aria-expanded", "true");
                }
            });
        });
    }

    /* ---------------------------------------------------------
       Code tabs + copy
       --------------------------------------------------------- */
    function initCode() {
        var wrap = $(".code-wrap");
        if (!wrap) return;

        var tabs = $$(".code-tab", wrap);
        var panes = $$("pre", wrap);
        var copy = $(".code-copy", wrap);

        tabs.forEach(function (tab) {
            tab.addEventListener("click", function () {
                var target = tab.getAttribute("data-lang");
                tabs.forEach(function (t) {
                    t.classList.toggle("is-active", t === tab);
                });
                panes.forEach(function (p) {
                    p.hidden = p.getAttribute("data-lang") !== target;
                });
            });
        });

        if (copy) {
            copy.addEventListener("click", function () {
                var visible = panes.filter(function (p) {
                    return !p.hidden;
                })[0];
                if (!visible) return;
                var text = visible.innerText;
                var done = function () {
                    var label = $("span", copy);
                    if (!label) return;
                    label.textContent = "Copied";
                    setTimeout(function () {
                        label.textContent = "Copy";
                    }, 1800);
                };
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text).then(done, function () {});
                }
            });
        }
    }

    /* ---------------------------------------------------------
       Legal page: table of contents scrollspy
       --------------------------------------------------------- */
    function initToc() {
        var toc = $(".legal-toc");
        if (!toc || !("IntersectionObserver" in window)) return;

        var links = $$("a", toc);
        var sections = links
            .map(function (a) {
                return document.getElementById(a.getAttribute("href").slice(1));
            })
            .filter(Boolean);

        var io = new IntersectionObserver(
            function (entries) {
                entries.forEach(function (entry) {
                    if (!entry.isIntersecting) return;
                    links.forEach(function (a) {
                        a.classList.toggle("is-current", a.getAttribute("href") === "#" + entry.target.id);
                    });
                });
            },
            { rootMargin: "-15% 0px -70% 0px" }
        );

        sections.forEach(function (s) {
            io.observe(s);
        });
    }

    /* ---------------------------------------------------------
       Misc
       --------------------------------------------------------- */
    function initYear() {
        $$("[data-year]").forEach(function (el) {
            el.textContent = String(new Date().getFullYear());
        });
    }

    document.addEventListener("DOMContentLoaded", function () {
        initChrome();
        initMenu();
        initReveal();
        initCounters();
        initCardGlow();
        initSimulator();
        initFaq();
        initCode();
        initToc();
        initYear();
    });
})();
