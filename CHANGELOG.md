# Changelog

## 2.0.0 - 2026-10-16

- Rewritten without jQuery. jQuery is optional: when present, `$.fn.ColorPicker`,
  `ColorPickerShow/Hide/SetColor`, `$(el).data('colorpickerId')` and
  `$(picker).data('colorpicker')` keep working unchanged (jQuery 1.3.2 - 4.x).
- New native API: `new ColorPicker(el, options)`, `ColorPicker.init()`,
  `ColorPicker.getInstance()`, `show()`, `hide()`, `setColor()`, `getColor()`,
  `destroy()` (also `$(el).ColorPickerDestroy()`), color conversion helpers.
- `eventName` accepts several events and jQuery-style namespaces.
- Fixes: duplicate picker ids, duplicate close handlers.
- Adds a test suite comparing the rewrite with 1.0.2 in Chrome (`npm test`).
- Adds `no-jquery.html` demo.

## 1.0.2

- Last jQuery-based release.
