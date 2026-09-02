/* =====================================================================
   ambient.js — cinematic background / lighting controller
   Visual layer only: injects background layers, mouse parallax and
   scroll reveal. Touches no content, navigation or business logic.
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

    /* ---------------- background layer construction ---------------- */

    function el(cls) {
        var d = document.createElement('div');
        d.className = cls;
        return d;
    }

    function buildStage() {
        /* Some pages don't include the photo base layer — keep all pages cohesive. */
        if (!document.querySelector('.bg')) {
            document.body.insertBefore(el('bg'), document.body.firstChild);
        }

        if (document.querySelector('.ambient')) return;

        var stage = el('ambient');
        stage.setAttribute('aria-hidden', 'true');

        var small = window.innerWidth < 700;

        stage.appendChild(el('ambient-grid'));

        /* starfield sits low so the glows wash over it */
        stage.appendChild(buildStars('far', small ? 45 : 110, 1.6));
        stage.appendChild(buildStars('near', small ? 18 : 45, 2.6));

        stage.appendChild(el('ambient-cursor'));

        ['o1', 'o2', 'o3', 'o4'].forEach(function (n) {
            stage.appendChild(el('ambient-orb ' + n));
        });

        ['b1', 'b2', 'b3'].forEach(function (n) {
            stage.appendChild(el('ambient-beam ' + n));
        });

        if (!reduceMotion) {
            ['m1', 'm2', 'm3'].forEach(function (n) {
                stage.appendChild(el('ambient-meteor ' + n));
            });
        }

        stage.appendChild(buildParticles());

        stage.appendChild(el('ambient-sweep'));
        stage.appendChild(el('ambient-sweep s2'));

        stage.appendChild(el('ambient-horizon'));
        stage.appendChild(el('ambient-tint'));
        stage.appendChild(el('ambient-vignette'));

        document.body.insertBefore(stage, document.body.firstChild);
    }

    /* Starfield: a single tiny dot cloned hundreds of times via box-shadow.
       Positions use vw/vh so the field stays correct on resize. */
    function buildStars(variant, count, dotSize) {
        var layer = el('ambient-stars ' + variant);
        var shadows = [];

        for (var i = 0; i < count; i++) {
            var x = (Math.random() * 118 - 9).toFixed(2);
            var y = (Math.random() * 118 - 9).toFixed(2);
            var alpha = (0.30 + Math.random() * 0.62).toFixed(2);
            /* a few stars get a slight spread so they read as brighter */
            var spread = Math.random() < 0.15 ? '0.7px' : '0';

            shadows.push(x + 'vw ' + y + 'vh 0 ' + spread +
                ' rgba(228, 243, 255, ' + alpha + ')');
        }

        layer.style.width = dotSize + 'px';
        layer.style.height = dotSize + 'px';
        layer.style.boxShadow = shadows.join(', ');
        return layer;
    }

    /* Wrap the portrait so the animated ring/bezel frame can be applied. */
    function frameProfilePhoto() {
        var img = document.querySelector('.profile-card img') ||
                  document.querySelector('.profile img');

        if (!img || !img.parentNode) return;
        if (img.parentNode.classList.contains('photo-frame')) return;

        var frame = document.createElement('div');
        frame.className = 'photo-frame';
        img.parentNode.insertBefore(frame, img);
        frame.appendChild(img);
    }

    function buildParticles() {
        var frag = document.createDocumentFragment();
        if (reduceMotion) return frag;

        var w = window.innerWidth;
        /* Deliberately sparse — depth, not confetti. */
        var count = w < 600 ? 6 : (w < 1100 ? 10 : 15);

        for (var i = 0; i < count; i++) {
            var p = el('ambient-particle');
            var size = 3 + Math.random() * 6;

            p.style.setProperty('--p-x', (Math.random() * 100).toFixed(2) + 'vw');
            p.style.setProperty('--p-y', (55 + Math.random() * 50).toFixed(2) + 'vh');
            p.style.setProperty('--p-size', size.toFixed(1) + 'px');
            p.style.setProperty('--p-dur', (26 + Math.random() * 26).toFixed(1) + 's');
            p.style.setProperty('--p-delay', (-Math.random() * 30).toFixed(1) + 's');
            p.style.setProperty('--p-dx', ((Math.random() - 0.5) * 14).toFixed(2) + 'vw');
            p.style.setProperty('--p-op', (0.28 + Math.random() * 0.34).toFixed(2));

            frag.appendChild(p);
        }
        return frag;
    }

    /* ---------------- mouse parallax (rAF throttled) ---------------- */

    function initParallax() {
        var fine = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
        if (!fine || reduceMotion) return;

        var tx = 0, ty = 0, cx = 0, cy = 0, ticking = false;

        function frame() {
            /* ease toward the pointer so movement stays slow and filmic */
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

    /* ---------------- scroll reveal ---------------- */

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
                node.classList.add('amb-in');
                /* restore the original hover transition once the reveal finishes */
                setTimeout(function () {
                    node.classList.add('amb-done');
                }, 1000);
            }, delay);
        }

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                var node = entry.target;
                observer.unobserve(node);
                show(node, Number(node.dataset.ambDelay || 0));
            });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

        Array.prototype.forEach.call(targets, function (node, i) {
            /* gentle stagger for cards already in the first viewport */
            var top = node.getBoundingClientRect().top;
            node.dataset.ambDelay = top < window.innerHeight ? String(Math.min(i, 5) * 110) : '0';
            observer.observe(node);
        });

        /* Failsafe: never leave content hidden. */
        setTimeout(function () {
            Array.prototype.forEach.call(targets, function (node) {
                node.classList.add('amb-in');
            });
        }, 3500);
    }

    /* ---------------- boot ---------------- */

    onReady(function () {
        buildStage();
        frameProfilePhoto();
        initParallax();
        initReveal();

        /* Rebuild particle density on significant viewport changes only. */
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
                    stage.querySelectorAll('.ambient-particle'),
                    function (p) { p.remove(); }
                );
                stage.insertBefore(buildParticles(), stage.querySelector('.ambient-sweep'));
            }, 300);
        }, { passive: true });
    });
})();
