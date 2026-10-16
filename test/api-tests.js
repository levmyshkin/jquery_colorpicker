/* global $, ColorPicker */
// Checks for behaviour that only exists in the rewrite. Run by test/run.js
// with and without jQuery.
(function () {
  'use strict';

  var useJQ = window.JQ !== 'none';
  var stage = document.getElementById('stage');

  function assert(cond, msg) { if (!cond) { throw new Error(msg); } }
  function input(id) { return '<p><input class="target" id="' + id + '"></p>'; }
  function click(el) { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); }
  function mousedown(el) { el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })); }
  function shown(p) { return getComputedStyle(p.picker).display !== 'none'; }
  function cleanup() {
    document.querySelectorAll('.colorpicker').forEach(function (p) { p.remove(); });
    stage.innerHTML = '';
  }

  var tests = {
    'globals and color helpers': async function () {
      assert(window.EyeColorPicker === ColorPicker && window.ColorPicker === ColorPicker, 'globals');
      assert(ColorPicker.hsbToHex(ColorPicker.hexToHsb('#336699')) === '336699', 'round trip');
      assert(ColorPicker.rgbToHex({ r: 255, g: 0, b: 16 }) === 'ff0010', 'rgbToHex');
    },

    'native API: show, hide, setColor, getColor, callbacks': async function () {
      cleanup();
      stage.innerHTML = input('a');
      var a = document.getElementById('a');
      var got = {};
      var p = new ColorPicker('#a', {
        color: { r: 0, g: 128, b: 255 },
        onChange: function (hsb, hex) { got.changeThis = this; got.hex = hex; },
        onSubmit: function (hsb, hex, rgb, el) { got.submitThis = this; got.el = el; }
      });
      assert(ColorPicker.getInstance(a) === p && new ColorPicker(a) === p, 'instance registry');
      assert(p.getColor().hex === '0080ff', 'initial color ' + p.getColor().hex);
      assert(!shown(p), 'visible before show');
      click(a);
      assert(shown(p) && p.picker.style.top !== '', 'click did not show');
      mousedown(document.body);
      assert(!shown(p), 'outside mousedown did not hide');
      p.show();
      assert(shown(p), 'show()');
      p.hide();
      assert(!shown(p), 'hide()');
      p.setColor('#ff0000');
      assert(p.getColor().hex === 'ff0000' && p.fields[0].value === 'ff0000', 'setColor');
      p.fields[0].value = '00ff00';
      p.fields[0].dispatchEvent(new Event('change'));
      assert(got.hex === '00ff00', 'onChange hex');
      if (!useJQ) { assert(got.changeThis === p.picker, 'onChange this'); }
      click(p.picker.querySelector('.colorpicker_submit'));
      assert(got.el === a && p.options.origColor === p.options.color, 'onSubmit el/origColor');
      if (!useJQ) { assert(got.submitThis === p, 'onSubmit this'); }
    },

    'invalid colors': async function () {
      cleanup();
      stage.innerHTML = input('a');
      var threw = false;
      try { new ColorPicker('#a', { color: [1, 2] }); } catch (e) { threw = true; }
      assert(threw, 'constructor accepted invalid color');
      assert(ColorPicker.init('#a', { color: null }).length === 0, 'init() with invalid color');
      assert(!document.querySelector('.colorpicker'), 'picker created');
      var p = new ColorPicker('#a', { color: undefined });
      p.setColor(42);
      assert(p.getColor().hex === 'ff0000', 'invalid setColor changed the color');
    },

    'destroy removes markup and listeners': async function () {
      cleanup();
      stage.innerHTML = input('a') + '<div id="h"></div>';
      var a = document.getElementById('a');
      var p = new ColorPicker(a);
      var flat = new ColorPicker('#h', { flat: true });
      click(a);
      p.destroy();
      flat.destroy();
      assert(!document.querySelector('.colorpicker'), 'picker markup left');
      assert(ColorPicker.getInstance(a) === undefined, 'still registered');
      click(a);
      mousedown(document.body);
      if (useJQ) { assert($.data(a, 'colorpickerId') === undefined, 'jQuery data left'); }
      var again = new ColorPicker(a);
      assert(again !== p, 're-init');
    },

    'eventName supports several events and namespaces': async function () {
      cleanup();
      stage.innerHTML = input('a');
      var a = document.getElementById('a');
      var p = new ColorPicker(a, { eventName: 'dblclick.myPlugin focus' });
      click(a);
      assert(!shown(p), 'opened on click');
      a.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      assert(shown(p), 'did not open on dblclick');
    },

    'unique picker ids': async function () {
      cleanup();
      var html = '';
      for (var i = 0; i < 60; i++) { html += input('i' + i); }
      stage.innerHTML = html;
      var ids = ColorPicker.init('input.target').map(function (p) { return p.picker.id; });
      assert(new Set(ids).size === 60, 'duplicate ids');
      assert(document.querySelectorAll('.colorpicker').length === 60, 'pickers');
    }
  };

  if (useJQ) {
    Object.assign(tests, {
      'jQuery: colorpickerId and the colorpicker data object': async function () {
        cleanup();
        stage.innerHTML = input('a');
        var calls = [];
        $('#a').ColorPicker({ onChange: function (hsb, hex) { calls.push(hex); } });
        var cal = $('#' + $('#a').data('colorpickerId'));
        assert(cal.length === 1 && cal.hasClass('colorpicker'), 'picker not found by colorpickerId');
        var data = cal.data('colorpicker');
        assert(data.fields.jquery && data.fields.length === 7 && data.fields.eq(0).val() === 'ff0000', 'fields');
        assert(data.el === $('#a')[0] && data.selector.jquery && data.hue.jquery, 'element props');
        data.onChange = function (hsb, hex) { calls.push('replaced:' + hex); };
        data.fields.eq(0).val('0000ff').trigger('change');
        assert(calls.join() === 'replaced:0000ff' && data.color.h === 240, 'data object not live: ' + calls);
        data.livePreview = false;
        assert(ColorPicker.getInstance('#a').options.livePreview === false, 'livePreview not shared');
      },
      'jQuery: ColorPickerDestroy and re-init': async function () {
        cleanup();
        stage.innerHTML = input('a');
        $('#a').ColorPicker().ColorPickerDestroy();
        assert(!document.querySelector('.colorpicker') && $('#a').data('colorpickerId') === undefined, 'destroy');
        $('#a').ColorPicker({ color: '#00ff00' });
        assert(ColorPicker.getInstance('#a').getColor().hex === '00ff00', 're-init');
      },
      'jQuery: chaining and calls on elements without a picker': async function () {
        cleanup();
        stage.innerHTML = input('a') + input('b');
        var $a = $('#a');
        assert($a.ColorPicker() === $a && $a.ColorPickerShow() === $a && $a.ColorPickerHide() === $a && $a.ColorPickerSetColor('#fff') === $a, 'chaining');
        $('#b').ColorPickerShow().ColorPickerHide().ColorPickerSetColor('#000');
        assert(document.querySelectorAll('.colorpicker').length === 1, 'picker created for #b');
      },
      'jQuery: plugin can be installed after ColorPicker loaded': async function () {
        var fake = function (sel) { return $(sel); };
        fake.fn = { extend: function (o) { Object.assign(fake.fn, o); } };
        ColorPicker.installJQuery(fake);
        assert(typeof fake.fn.ColorPicker === 'function' && typeof fake.fn.ColorPickerSetColor === 'function', 'not installed');
        ColorPicker.installJQuery($);
        assert($.fn.ColorPicker.vanilla === true, 'bridge flag');
      }
    });
  }

  window.API_TESTS = tests;
}());
