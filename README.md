# Color Picker 2.0.0

The Eyecon Color Picker (Stefan Petre, www.eyecon.ro), rewritten with **no dependencies**. jQuery is now **optional**: if a page loads jQuery, the 1.x plugin API keeps working unchanged.

Drupal library fork of [jaypan/jquery_colorpicker](https://github.com/jaypan/jquery_colorpicker), used by the EBT/EPT modules. The markup, CSS, images and options are the same as in 1.x.

## Upgrading from 1.x

Replace `js/colorpicker.js`. The file name and path are unchanged, so Drupal library definitions (`/libraries/jquery-colorpicker/js/colorpicker.js`) keep working.

- **The site still loads jQuery:** nothing to change. These keep working, with the same callback arguments and `this` values as before:
  - `$(el).ColorPicker(options)`, `ColorPickerShow()`, `ColorPickerHide()`, `ColorPickerSetColor(color)`
  - `$(el).data('colorpickerId')`
  - `$(picker).data('colorpicker')`
  - events fired with `.trigger()`

  It works with jQuery 1.3.2 through 4.x.
- **The site drops jQuery:** use the native API below.

If jQuery is loaded *after* the color picker, register the plugin manually: `ColorPicker.installJQuery(jQuery)`.

## Usage without jQuery

```html
<link rel="stylesheet" href="css/colorpicker.css">
<input type="text" id="color" value="336699">
<script src="js/colorpicker.js"></script>
<script>
  var picker = new ColorPicker('#color', {
    onBeforeShow: function () { picker.setColor(this.value); },
    onSubmit: function (hsb, hex, rgb, el) { el.value = hex; picker.hide(); }
  });
</script>
```

`ColorPicker.init('input.color', options)` creates a picker for every matching element and returns an array of them. The global is `window.ColorPicker`, also exposed as `window.EyeColorPicker` (`ColorPicker` is left alone if another script already defined it). With a bundler: `const ColorPicker = require('jquery-colorpicker');`.

See `no-jquery.html` for a demo. The original demo, `index.html`, still runs on jQuery 1.3.2.

### Picker API

| 1.x (jQuery) | 2.x (native) |
| --- | --- |
| `$(el).ColorPicker(options)` | `new ColorPicker(el, options)` |
| `$(el).ColorPickerShow()` | `picker.show()` |
| `$(el).ColorPickerHide()` | `picker.hide()` |
| `$(el).ColorPickerSetColor(color)` | `picker.setColor(color)` |
| `$('#' + $(el).data('colorpickerId'))` | `picker.picker` (the picker element) |
| `$(picker).data('colorpicker')` | `picker.options` (options and state: `color`, `origColor`, `livePreview`, callbacks) |
| | `ColorPicker.getInstance(el)` |

New in 2.0:
- `picker.getColor()` returns `{hsb, hex, rgb}`.
- `picker.destroy()` (or `$(el).ColorPickerDestroy()`) removes the picker markup and every listener.
- Calling `new ColorPicker()` again on the same element returns the existing picker.
- Color helpers: `ColorPicker.hexToHsb`, `hexToRgb`, `rgbToHsb`, `rgbToHex`, `hsbToRgb`, `hsbToHex`.

### Options

Same as 1.x; defaults are in `ColorPicker.defaults`.

| Option | Default | |
| --- | --- | --- |
| `color` | `'ff0000'` | Hex string, `{r, g, b}` or `{h, s, b}`. |
| `eventName` | `'click'` | Event(s) on the element that open the picker. Several space-separated events and jQuery-style namespaces (`click.myModule`) are accepted. |
| `flat` | `false` | Render the picker inside the element, always visible. |
| `livePreview` | `true` | Update while typing/dragging instead of on change. |
| `onBeforeShow(picker)` | | `this` is the element. |
| `onShow(picker)` | | `this` is the element. Return `false` to show the picker yourself (e.g. with an animation). |
| `onHide(picker)` | | `this` is the document. Return `false` to hide the picker yourself. |
| `onChange(hsb, hex, rgb)` | | `this` is the picker element (a jQuery object of it when created with `$.fn.ColorPicker`). |
| `onSubmit(hsb, hex, rgb, el)` | | `this` is the picker (the `$(picker).data('colorpicker')` object when created with `$.fn.ColorPicker`). |

## Behaviour changes from 1.0.2

These are bug fixes. Everything else is intended to behave exactly as 1.0.2.

- Picker ids (`collorpicker_N`) are now unique. 1.x used a random number up to 1000, so two pickers could get the same id and `$('#' + id)` found the wrong one.
- With several pickers open, an outside click closes all of them, as jQuery 3/4 already did. With jQuery 1.3.2, 1.x closed only the last one.
- Showing an already open picker no longer stacks a second close handler, which used to call `onHide` twice.

## Development

```sh
npm install
npm test
```

`npm test` runs every case in `test/cases.js` in Chrome, with a real mouse and keyboard. It runs each case against the original 1.0.2 plugin (`test/original/`) on jQuery 1.3.2, 3 and 4, and against the rewrite with and without jQuery. After each step it compares field values, selector and hue positions, colors, visibility, position and the order and arguments of callback calls. It also runs the API checks in `test/api-tests.js`. It needs a local Chrome (or set `CHROME_PATH`).
