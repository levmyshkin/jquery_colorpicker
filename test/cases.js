/* global $, ColorPicker */
// Test cases shared by every implementation. test/run.js performs the
// actions with a real mouse/keyboard and compares snapshots between the
// original jQuery plugin and the rewrite.
(function () {
  'use strict';

  var useJQ = window.JQ !== 'none';
  var stage = document.getElementById('stage');
  var log = [];
  var probes = [];

  function r(n) { return Math.round(n * 100) / 100; }
  function hsbStr(h) { return h ? [r(h.h), r(h.s), r(h.b)].join('/') : String(h); }

  function callbacks(id, extra) {
    extra = extra || {};
    return {
      onBeforeShow: function (cal) {
        log.push(id + ':beforeShow:' + this.id + ':' + cal.className);
        if (extra.onBeforeShow) { return extra.onBeforeShow.apply(this, arguments); }
      },
      onShow: function (cal) {
        log.push(id + ':show:' + this.id + ':' + cal.className);
        if (extra.onShow) { return extra.onShow.apply(this, arguments); }
      },
      onHide: function (cal) {
        log.push(id + ':hide:' + (this === document) + ':' + cal.className);
        if (extra.onHide) { return extra.onHide.apply(this, arguments); }
      },
      onChange: function (hsb, hex, rgb) {
        log.push(id + ':change:' + hsbStr(hsb) + ':' + hex + ':' + [rgb.r, rgb.g, rgb.b].join(','));
        probes.push(id + ':changeThis:' + (useJQ ? (this.jquery ? 'jq:' + this[0].className + ':' + (this.data('colorpicker').el.id) : 'not-jq') : this.className));
        if (extra.onChange) { return extra.onChange.apply(this, arguments); }
      },
      onSubmit: function (hsb, hex, rgb, el) {
        log.push(id + ':submit:' + hsbStr(hsb) + ':' + hex + ':' + [rgb.r, rgb.g, rgb.b].join(',') + ':' + el.id);
        probes.push(id + ':submitThis:' + (useJQ ? [typeof this.fields.eq, this.fields.length, this.el.id, hsbStr(this.color), hsbStr(this.origColor), this.livePreview].join(',') : 'n/a'));
        if (extra.onSubmit) { return extra.onSubmit.apply(this, arguments); }
      }
    };
  }

  var inputs = '<p><input class="target" id="a" value=""></p><p><input class="target" id="b" value="00ff00"></p>';

  var common = [
    { click: '#a' },
    { drag: 'color', from: [10, 10], to: [120, 40] },
    { drag: 'hue', from: [10, 20], to: [10, 90] },
    { drag: 'span:1', from: [2, 2], to: [2, 30] },
    { drag: 'span:4', from: [2, 2], to: [2, -40] },
    { type: 0, text: '3366cc' },
    { type: 0, text: 'abc', key: 'Tab' },
    { type: 2, text: '200', key: 'Tab' },
    { type: 4, text: '120', key: 'Tab' },
    { type: 1, text: 'zz' },
    { part: 'submit' },
    { drag: 'color', from: [70, 70], to: [20, 20] },
    { part: 'current' },
    { hover: 'submit' },
    { outside: true },
    { click: '#b' },
    { click: '#a' },
    { outside: true }
  ];

  var cases = {
    basic: {
      html: inputs,
      init: [{ sel: '#a, #b' }],
      actions: common
    },
    colorFormats: {
      html: '<p><input class="target" id="a"></p><p><input class="target" id="b"></p><p><input class="target" id="c"></p><p><input class="target" id="d"></p><p><input class="target" id="e"></p>',
      init: [
        { sel: '#a', opts: { color: '#336699' } },
        { sel: '#b', opts: { color: { r: 10, g: 200, b: 30 } } },
        { sel: '#c', opts: { color: { h: 400, s: 50, b: -5 } } },
        { sel: '#d', opts: { color: [1, 2, 3] } },
        { sel: '#e', opts: { color: 'abc' } }
      ],
      actions: [{ click: '#a' }, { outside: true }, { click: '#b' }, { outside: true }, { click: '#c' }, { outside: true }, { click: '#d' }, { outside: true }, { click: '#e' }, { outside: true }]
    },
    noLivePreview: {
      html: inputs,
      init: [{ sel: '#a', opts: { livePreview: false } }],
      actions: [{ click: '#a' }, { type: 0, text: '112233' }, { key: 'Tab' }, { drag: 'color', from: [10, 10], to: [100, 100] },
        { drag: 'span:5', from: [2, 2], to: [2, 20] }, { drag: 'hue', from: [5, 5], to: [5, 60] }]
    },
    flat: {
      html: '<div class="holder" id="h1"></div><div class="holder" id="h2"></div>',
      init: [{ sel: '#h1', opts: { flat: true } }, { sel: '#h2', opts: { flat: true, color: '#00ff00' } }],
      actions: [{ drag: 'color', picker: 1, from: [10, 10], to: [60, 80] }, { part: 'submit', picker: 1 }, { part: 'current', picker: 0 },
        { type: 0, picker: 0, text: 'ff00ff', key: 'Tab' }, { outside: true }]
    },
    positionFlip: {
      html: '<input class="target" id="corner">',
      init: [{ sel: '#corner' }],
      actions: [{ click: '#corner' }, { outside: true }, { scroll: 400 }, { click: '#corner' }, { outside: true }]
    },
    focusEvent: {
      // jQuery 1.3.2 keeps one binding per handler function, so with two
      // pickers open the original only closes the last one there.
      skipJq: ['1'],
      html: inputs,
      init: [{ sel: '#a, #b', opts: { eventName: 'focus' } }],
      actions: [{ click: '#a' }, { key: 'Tab' }, { outside: true }]
    },
    api: {
      html: inputs,
      init: [{ sel: '#a, #b' }],
      actions: [{ call: 'setColor', sel: '#a', arg: '#123456' }, { call: 'show', sel: '#a' }, { call: 'setColor', sel: '#a', arg: { r: 255, g: 0, b: 128 } },
        { call: 'setColor', sel: '#a', arg: 42 }, { call: 'hide', sel: '#a' }, { outside: true }, { call: 'show', sel: '#b' },
        { call: 'setColor', sel: '#b', arg: { h: 90, s: 50, b: 50 } }, { part: 'submit' }, { outside: true }]
    },
    doubleInit: {
      html: inputs,
      init: [{ sel: '#a' }, { sel: '#a', opts: { color: '#0000ff' } }],
      actions: [{ click: '#a' }, { outside: true }]
    },
    showReturnsFalse: {
      html: inputs,
      init: [{ sel: '#a', extra: 'noShow' }],
      actions: [{ click: '#a' }, { outside: true }, { click: '#a' }]
    },
    drupalFade: {
      // How the EBT/EPT core modules use the plugin.
      jqOnly: true,
      html: inputs,
      init: [{ sel: '#a', extra: 'drupal' }],
      actions: [{ click: '#a', wait: 600 }, { drag: 'color', from: [20, 20], to: [100, 50] }, { outside: true, wait: 600 }, { click: '#a', wait: 600 }]
    },
    jqTriggers: {
      // Events fired through jQuery instead of real input.
      jqOnly: true,
      html: inputs,
      init: [{ sel: '#a, #b' }],
      actions: [
        { js: "$('#a').trigger('click')" },
        { js: "$('.colorpicker').eq(0).find('input').eq(0).val('123abc').trigger('change')" },
        { js: "$('.colorpicker').eq(0).find('input').eq(1).val('9').trigger('keyup')" },
        { js: "$('.colorpicker').eq(0).find('input').eq(5).val('20').change()" },
        { js: "$('.colorpicker').eq(0).find('.colorpicker_current_color').click()" },
        { js: "$('.colorpicker').eq(0).find('input').eq(0).val('aa0000').trigger('change')" },
        { js: "$('.colorpicker').eq(0).find('.colorpicker_submit').trigger('click')" },
        { js: "$(document).trigger('mousedown')" },
        { js: "$('#b').click()" },
        { js: "$(document).mousedown()" },
        { js: "$('#a').ColorPickerShow(); $('.colorpicker').eq(0).trigger('mousedown')" },
        { js: "$('#a').trigger('focus')" },
        { js: "$('body').trigger('mousedown')" }
      ]
    },
    selection: {
      html: inputs,
      init: [{ sel: '#a' }],
      actions: [{ click: '#a' }, { drag: 'color', from: [140, 140], to: [400, 400] }, { drag: 'color', from: [20, 20], to: [-200, -200] },
        { drag: 'hue', from: [5, 5], to: [5, 500] }, { drag: 'span:6', from: [2, 2], to: [2, -500] }]
    }
  };

  var extras = {
    noShow: { onShow: function () { return false; } },
    drupal: {
      onBeforeShow: function () {
        var color = $('#a').val();
        if (color !== undefined && color !== '') {
          color = '#' + color.replace('#', '');
          $(this).ColorPickerSetColor(color);
        }
      },
      onShow: function (colpkr) { $(colpkr).fadeIn(300); return false; },
      onHide: function (colpkr) { $(colpkr).fadeOut(300); return false; },
      onChange: function (hsb, hex) { $('#a').val('#' + hex); }
    }
  };

  function els(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  function init(sel, opts) {
    if (useJQ) {
      $(sel).ColorPicker(opts);
    } else {
      try { ColorPicker.init(sel, opts); } catch (e) { log.push('init error: ' + e.message); }
    }
  }

  function pickers() { return els('.colorpicker'); }

  function visiblePicker() {
    var list = pickers().filter(function (p) { return getComputedStyle(p).display !== 'none' && p.parentNode === document.body; });
    return list[list.length - 1];
  }

  function snapPicker(p) {
    var cs = getComputedStyle(p);
    var q = function (s) { return p.querySelector(s); };
    var bg = function (s) { return getComputedStyle(q(s)).backgroundColor; };
    return {
      parent: p.parentNode === document.body ? 'body' : p.parentNode.id,
      display: cs.display, position: cs.position, left: p.style.left, top: p.style.top,
      opacity: Math.round(parseFloat(cs.opacity) * 10) / 10,
      selector: bg('.colorpicker_color'), indic: [q('.colorpicker_color div div').style.left, q('.colorpicker_color div div').style.top].join(','),
      hue: q('.colorpicker_hue div').style.top, newColor: bg('.colorpicker_new_color'), current: bg('.colorpicker_current_color'),
      fields: Array.prototype.map.call(p.querySelectorAll('input'), function (i) { return i.value; }).join('|'),
      classes: Array.prototype.map.call(p.querySelectorAll('div'), function (d) { return d.className; }).filter(function (c) { return /focus|slider/.test(c); }).join(' '),
      active: document.activeElement && p.contains(document.activeElement) ? document.activeElement.parentNode.className : null
    };
  }

  window.T = {
    cases: cases,
    probes: probes,
    setup: function (name) {
      var c = cases[name];
      stage.innerHTML = c.html;
      c.init.forEach(function (i) {
        var opts = Object.assign({}, i.opts || {}, callbacks(i.sel, i.extra && extras[i.extra]));
        init(i.sel, opts);
      });
      return c.actions;
    },
    snap: function () {
      return { pickers: pickers().map(snapPicker), log: log.splice(0), inputs: els('input.target').map(function (i) { return i.value; }).join('|') };
    },
    // Page coordinates of a point inside a picker part.
    point: function (a) {
      var p = a.picker !== undefined ? pickers()[a.picker] : visiblePicker();
      if (!p) { return null; }
      var part = a.drag || a.part || a.hover;
      var node = part === 'color' ? p.querySelector('.colorpicker_color') :
        part === 'hue' ? p.querySelector('.colorpicker_hue') :
        part === 'submit' ? p.querySelector('.colorpicker_submit') :
        part === 'current' ? p.querySelector('.colorpicker_current_color') :
        part.indexOf('span:') === 0 ? p.querySelectorAll('span')[+part.slice(5) - 1] :
        part.indexOf('field:') === 0 ? p.querySelectorAll('input')[+part.slice(6)] : null;
      var rect = node.getBoundingClientRect();
      var from = a.from || [rect.width / 2, rect.height / 2];
      return { x: rect.left + from[0], y: rect.top + from[1] };
    },
    call: function (a) {
      if (useJQ) {
        var m = { setColor: 'ColorPickerSetColor', show: 'ColorPickerShow', hide: 'ColorPickerHide' }[a.call];
        $(a.sel)[m](a.arg);
      } else {
        els(a.sel).forEach(function (el) {
          var p = ColorPicker.getInstance(el);
          if (p) { p[a.call](a.arg); }
        });
      }
    }
  };
}());
