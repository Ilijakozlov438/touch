(function () {
  'use strict';
  // Keep links from the previous #services / #contacts site working after publication.
  function routeLegacyHash() {
    var legacy = window.location.hash.slice(1);
    if (['home', 'about', 'services', 'reviews', 'contacts'].indexOf(legacy) === -1) return false;
    var target = document.querySelector('[data-nav="' + legacy + '"]');
    if (target && target.pathname !== window.location.pathname) {
      window.location.replace(target.href);
      return true;
    }
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    return false;
  }
  if (routeLegacyHash()) return;
  window.addEventListener('hashchange', routeLegacyHash);
  var nav = document.getElementById('nav');
  var burger = document.getElementById('burger');
  var header = document.getElementById('siteHeader');
  function closeMenu() {
    nav.classList.remove('is-open');
    burger.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('no-scroll');
  }
  burger.addEventListener('click', function () {
    var open = nav.classList.toggle('is-open');
    burger.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('no-scroll', open);
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
  document.getElementById('year').textContent = new Date().getFullYear();
  var revealEls = document.querySelectorAll('.reveal');
  function onScroll() {
    header.classList.toggle('is-scrolled', window.scrollY > 20);
    revealEls.forEach(function (el) {
      if (el.getBoundingClientRect().top < window.innerHeight - 70) el.classList.add('is-visible');
    });
  }
  onScroll();
  document.documentElement.classList.add('js');
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () {
    if (window.innerWidth > 900) closeMenu();
    onScroll();
  });
  document.querySelectorAll('.salon-carousel').forEach(function (carousel) {
    var slides = carousel.querySelectorAll('.salon-slide');
    var dots = carousel.querySelectorAll('.carousel-dot');
    var status = carousel.querySelector('.carousel-status');
    var current = 0;
    var touchStart = null;
    function goToSlide(index) {
      current = (index + slides.length) % slides.length;
      slides.forEach(function (slide, i) {
        slide.classList.toggle('is-active', i === current);
        slide.setAttribute('aria-hidden', String(i !== current));
      });
      dots.forEach(function (dot, i) {
        if (i === current) dot.setAttribute('aria-current', 'true');
        else dot.removeAttribute('aria-current');
      });
      status.textContent = (current + 1) + ' / ' + slides.length;
    }
    carousel.querySelector('.carousel-prev').addEventListener('click', function () { goToSlide(current - 1); });
    carousel.querySelector('.carousel-next').addEventListener('click', function () { goToSlide(current + 1); });
    dots.forEach(function (dot, i) { dot.addEventListener('click', function () { goToSlide(i); }); });
    carousel.addEventListener('keydown', function (e) {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(e.key) === -1) return;
      e.preventDefault();
      if (e.key === 'Home') goToSlide(0);
      else if (e.key === 'End') goToSlide(slides.length - 1);
      else goToSlide(current + (e.key === 'ArrowRight' ? 1 : -1));
    });
    carousel.addEventListener('touchstart', function (e) {
      touchStart = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
    }, { passive: true });
    carousel.addEventListener('touchend', function (e) {
      if (!touchStart || !e.changedTouches.length) return;
      var dx = e.changedTouches[0].clientX - touchStart.x;
      var dy = e.changedTouches[0].clientY - touchStart.y;
      touchStart = null;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) goToSlide(current + (dx < 0 ? 1 : -1));
    }, { passive: true });
    carousel.addEventListener('touchcancel', function () { touchStart = null; }, { passive: true });
  });
})();
