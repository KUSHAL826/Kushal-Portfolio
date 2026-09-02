/* =====================================================================
   ambient.js — cinematic background / lighting controller
   Visual layer only: builds the background layers, the photo mount,
   pointer parallax and scroll reveal. No content or logic is changed.
   Loaded from <head> so the reveal state applies before first paint.
   ===================================================================== */
(function () {
    'use strict';

    var root = document.documentElement;
    var reduceMotion = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var canObserve = 'IntersectionObserver' in window;

    /* Arm the pre-paint reveal state only if we can actually reveal later. */
    if (canObserve && !reduceMotion) {
        root.classList.add('js-reveal');
    }

    function onReady(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn, { once: true });
        } else {
            fn();
        }
    }

    function el(cls) {
        var d = document.createElement('div');
        d.className = cls;
        return d;
    }

    /* ------------------- background construction ------------------- */

    function buildStage() {
        /* Not every page includes the base layer — keep all pages cohesive. */
        if (!document.querySelector('.bg')) {
            document.body.insertBefore(el('bg'), document.body.firstChild);
        }

        if (document.querySelector('.ambient')) return;

        var small = window.innerWidth < 700;
        var stage = el('ambient');
        stage.setAttribute('aria-hidden', 'true');

        stage.appendChild(el('ambient-hairlines'));

        /* dust sits low so the glows wash over it */
        stage.appendChild(buildDust('far', small ? 45 : 110, 1.6));
        stage.appendChild(buildDust('near', small ? 18 : 45, 2.6));

        stage.appendChild(el('ambient-cursor'));

        ['g1', 'g2', 'g3', 'g4'].forEach(function (n) {
            stage.appendChild(el('ambient-glow ' + n));
        });

        ['r1', 'r2', 'r3'].forEach(function (n) {
            stage.appendChild(el('ambient-ray ' + n));
        });

        stage.appendChild(buildMotes());

        stage.appendChild(el('ambient-sweep'));
        stage.appendChild(el('ambient-sweep s2'));

        stage.appendChild(el('ambient-horizon'));
        stage.appendChild(el('ambient-vignette'));

        if (!reduceMotion) {
            stage.appendChild(el('ambient-grain'));
        }

        document.body.insertBefore(stage, document.body.firstChild);
    }

    /* Dust field: a single tiny dot cloned via box-shadow, so hundreds of
       specks cost one element. Positions use vw/vh to survive resizing. */
    function buildDust(variant, count, dotSize) {
        var layer = el('ambient-dust ' + variant);
        var shadows = [];

        for (var i = 0; i < count; i++) {
            var x = (Math.random() * 118 - 9).toFixed(2);
            var y = (Math.random() * 118 - 9).toFixed(2);
            var alpha = (0.26 + Math.random() * 0.60).toFixed(2);
            var spread = Math.random() < 0.15 ? '0.7px' : '0';

            shadows.push(x + 'vw ' + y + 'vh 0 ' + spread +
                ' rgba(214, 236, 255, ' + alpha + ')');
        }

        layer.style.width = dotSize + 'px';
        layer.style.height = dotSize + 'px';
        layer.style.boxShadow = shadows.join(', ');
        return layer;
    }

    /* Rising motes — deliberately sparse, for depth rather than confetti. */
    function buildMotes() {
        var frag = document.createDocumentFragment();
        if (reduceMotion) return frag;

        var w = window.innerWidth;
        var count = w < 600 ? 6 : (w < 1100 ? 10 : 15);

        /* cycle the accent hues so the motes are not single-colour */
        var tints = ['56, 189, 248', '34, 211, 238', '167, 139, 250', '45, 212, 191'];

        for (var i = 0; i < count; i++) {
            var mote = el('ambient-mote');
            var size = 3 + Math.random() * 6;

            mote.style.setProperty('--p-tint', tints[i % tints.length]);
            mote.style.setProperty('--p-x', (Math.random() * 100).toFixed(2) + 'vw');
            mote.style.setProperty('--p-y', (58 + Math.random() * 46).toFixed(2) + 'vh');
            mote.style.setProperty('--p-size', size.toFixed(1) + 'px');
            mote.style.setProperty('--p-dur', (28 + Math.random() * 26).toFixed(1) + 's');
            mote.style.setProperty('--p-delay', (-Math.random() * 32).toFixed(1) + 's');
            mote.style.setProperty('--p-dx', ((Math.random() - 0.5) * 14).toFixed(2) + 'vw');
            mote.style.setProperty('--p-op', (0.30 + Math.random() * 0.34).toFixed(2));

            frag.appendChild(mote);
        }
        return frag;
    }

    /* ---------------------- photo mount ---------------------- */

    /* Builds .photo-frame > .photo-inner > img so the outer element can
       carry the offset rule and corner brackets while the inner clips. */
    function buildPhotoMount() {
        var img = document.querySelector('.profile-card img') ||
                  document.querySelector('.profile img');

        if (!img || !img.parentNode) return;
        if (img.closest && img.closest('.photo-frame')) return;

        var frame = document.createElement('div');
        frame.className = 'photo-frame';

        var inner = document.createElement('div');
        inner.className = 'photo-inner';

        img.parentNode.insertBefore(frame, img);
        frame.appendChild(inner);
        inner.appendChild(img);
    }

    /* ---------------- pointer parallax (rAF throttled) ---------------- */

    function initParallax() {
        var fine = window.matchMedia &&
            window.matchMedia('(hover: hover) and (pointer: fine)').matches;
        if (!fine || reduceMotion) return;

        var tx = 0, ty = 0, cx = 0, cy = 0, ticking = false;

        function frame() {
            /* ease toward the pointer so the movement stays slow and filmic */
            cx += (tx - cx) * 0.06;
            cy += (ty - cy) * 0.06;

            root.style.setProperty('--mx', cx.toFixed(4));
            root.style.setProperty('--my', cy.toFixed(4));

            if (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) {
                requestAnimationFrame(frame);
            } else {
                ticking = false;
            }
        }

        window.addEventListener('pointermove', function (e) {
            tx = (e.clientX / window.innerWidth) * 2 - 1;
            ty = (e.clientY / window.innerHeight) * 2 - 1;
            if (!ticking) {
                ticking = true;
                requestAnimationFrame(frame);
            }
        }, { passive: true });
    }

    /* ---------------------- scroll reveal ---------------------- */

    function initReveal() {
        if (!root.classList.contains('js-reveal')) return;

        var targets = document.querySelectorAll(
            '.profile-card, .big-card, .project-card, .problem-box, .journey-box'
        );

        if (!targets.length) {
            root.classList.remove('js-reveal');
            return;
        }

        function show(node, delay) {
            setTimeout(function () {
                node.classList.add('c-in');
                setTimeout(function () {
                    node.classList.add('c-done');
                }, 1000);
            }, delay);
        }

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                observer.unobserve(entry.target);
                show(entry.target, Number(entry.target.dataset.cDelay || 0));
            });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

        Array.prototype.forEach.call(targets, function (node, i) {
            /* gentle stagger for whatever is already in the first viewport */
            var top = node.getBoundingClientRect().top;
            node.dataset.cDelay = top < window.innerHeight
                ? String(Math.min(i, 5) * 110)
                : '0';
            observer.observe(node);
        });

        /* Failsafe: never leave content hidden. */
        setTimeout(function () {
            Array.prototype.forEach.call(targets, function (node) {
                node.classList.add('c-in');
            });
        }, 3500);
    }

    /* -------------------------- boot -------------------------- */

    onReady(function () {
        buildStage();
        buildPhotoMount();
        initParallax();
        initReveal();

        /* Rebuild mote density only on significant viewport changes. */
        var lastW = window.innerWidth;
        var resizeTimer;

        window.addEventListener('resize', function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () {
                if (Math.abs(window.innerWidth - lastW) < 220) return;
                lastW = window.innerWidth;

                var stage = document.querySelector('.ambient');
                if (!stage) return;

                Array.prototype.forEach.call(
                    stage.querySelectorAll('.ambient-mote'),
                    function (m) { m.remove(); }
                );
                stage.insertBefore(buildMotes(), stage.querySelector('.ambient-sweep'));
            }, 300);
        }, { passive: true });
    });
})();
