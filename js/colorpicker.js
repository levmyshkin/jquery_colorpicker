/**
 *
 * Color picker 2.0.0 - dependency-free
 * Author: Stefan Petre www.eyecon.ro
 * Rewritten without jQuery. jQuery is optional: when it is present,
 * $(el).ColorPicker(), ColorPickerShow/Hide/SetColor keep working unchanged.
 *
 * Dual licensed under the MIT and GPL licenses
 *
 */
(function (root, factory) {
	if (typeof module === 'object' && module.exports) {
		module.exports = factory(root);
	} else {
		var ColorPicker = factory(root);
		root.EyeColorPicker = ColorPicker;
		if (!root.ColorPicker) {
			root.ColorPicker = ColorPicker;
		}
	}
}(typeof window !== 'undefined' ? window : this, function (window) {
	'use strict';

	var document = window.document,
		instances = new WeakMap(),
		// Hooks set by the jQuery bridge.
		bridge = {},
		uid = 0,
		charMin = 65,
		tpl = '<div class="colorpicker"><div class="colorpicker_color"><div><div></div></div></div><div class="colorpicker_hue"><div></div></div><div class="colorpicker_new_color"></div><div class="colorpicker_current_color"></div><div class="colorpicker_hex"><input type="text" maxlength="6" size="6" /></div><div class="colorpicker_rgb_r colorpicker_field"><input type="text" maxlength="3" size="3" /><span></span></div><div class="colorpicker_rgb_g colorpicker_field"><input type="text" maxlength="3" size="3" /><span></span></div><div class="colorpicker_rgb_b colorpicker_field"><input type="text" maxlength="3" size="3" /><span></span></div><div class="colorpicker_hsb_h colorpicker_field"><input type="text" maxlength="3" size="3" /><span></span></div><div class="colorpicker_hsb_s colorpicker_field"><input type="text" maxlength="3" size="3" /><span></span></div><div class="colorpicker_hsb_b colorpicker_field"><input type="text" maxlength="3" size="3" /><span></span></div><div class="colorpicker_submit"></div></div>',
		defaults = {
			eventName: 'click',
			onShow: function () {},
			onBeforeShow: function(){},
			onHide: function () {},
			onChange: function () {},
			onSubmit: function () {},
			color: 'ff0000',
			livePreview: true,
			flat: false
		};

	// -------------------------------------------------------------------------
	// Color conversion (unchanged from 1.x)
	// -------------------------------------------------------------------------

	var fixHSB = function (hsb) {
			return {
				h: Math.min(360, Math.max(0, hsb.h)),
				s: Math.min(100, Math.max(0, hsb.s)),
				b: Math.min(100, Math.max(0, hsb.b))
			};
		},
		fixRGB = function (rgb) {
			return {
				r: Math.min(255, Math.max(0, rgb.r)),
				g: Math.min(255, Math.max(0, rgb.g)),
				b: Math.min(255, Math.max(0, rgb.b))
			};
		},
		fixHex = function (hex) {
			var len = 6 - hex.length;
			if (len > 0) {
				var o = [];
				for (var i=0; i<len; i++) {
					o.push('0');
				}
				o.push(hex);
				hex = o.join('');
			}
			return hex;
		},
		HexToRGB = function (hex) {
			hex = parseInt(((hex.indexOf('#') > -1) ? hex.substring(1) : hex), 16);
			return {r: hex >> 16, g: (hex & 0x00FF00) >> 8, b: (hex & 0x0000FF)};
		},
		RGBToHSB = function (rgb) {
			var hsb = {
				h: 0,
				s: 0,
				b: 0
			};
			var min = Math.min(rgb.r, rgb.g, rgb.b);
			var max = Math.max(rgb.r, rgb.g, rgb.b);
			var delta = max - min;
			hsb.b = max;
			hsb.s = max != 0 ? 255 * delta / max : 0;
			if (hsb.s != 0) {
				if (rgb.r == max) {
					hsb.h = (rgb.g - rgb.b) / delta;
				} else if (rgb.g == max) {
					hsb.h = 2 + (rgb.b - rgb.r) / delta;
				} else {
					hsb.h = 4 + (rgb.r - rgb.g) / delta;
				}
			} else {
				hsb.h = -1;
			}
			hsb.h *= 60;
			if (hsb.h < 0) {
				hsb.h += 360;
			}
			hsb.s *= 100/255;
			hsb.b *= 100/255;
			return hsb;
		},
		HexToHSB = function (hex) {
			return RGBToHSB(HexToRGB(hex));
		},
		HSBToRGB = function (hsb) {
			var rgb = {};
			var h = Math.round(hsb.h);
			var s = Math.round(hsb.s*255/100);
			var v = Math.round(hsb.b*255/100);
			if(s == 0) {
				rgb.r = rgb.g = rgb.b = v;
			} else {
				var t1 = v;
				var t2 = (255-s)*v/255;
				var t3 = (t1-t2)*(h%60)/60;
				if(h==360) h = 0;
				if(h<60) {rgb.r=t1;	rgb.b=t2; rgb.g=t2+t3}
				else if(h<120) {rgb.g=t1; rgb.b=t2;	rgb.r=t1-t3}
				else if(h<180) {rgb.g=t1; rgb.r=t2;	rgb.b=t2+t3}
				else if(h<240) {rgb.b=t1; rgb.r=t2;	rgb.g=t1-t3}
				else if(h<300) {rgb.b=t1; rgb.g=t2;	rgb.r=t2+t3}
				else if(h<360) {rgb.r=t1; rgb.g=t2;	rgb.b=t1-t3}
				else {rgb.r=0; rgb.g=0;	rgb.b=0}
			}
			return {r:Math.round(rgb.r), g:Math.round(rgb.g), b:Math.round(rgb.b)};
		},
		RGBToHex = function (rgb) {
			var hex = [
				rgb.r.toString(16),
				rgb.g.toString(16),
				rgb.b.toString(16)
			];
			hex.forEach(function (val, nr) {
				if (val.length == 1) {
					hex[nr] = '0' + val;
				}
			});
			return hex.join('');
		},
		HSBToHex = function (hsb) {
			return RGBToHex(HSBToRGB(hsb));
		},
		// Accepts a hex string, {r, g, b} or {h, s, b}; null when invalid.
		toHSB = function (col) {
			if (typeof col == 'string') {
				return HexToHSB(col);
			} else if (col && col.r != undefined && col.g != undefined && col.b != undefined) {
				return RGBToHSB(col);
			} else if (col && col.h != undefined && col.s != undefined && col.b != undefined) {
				return fixHSB(col);
			}
			return null;
		};

	// -------------------------------------------------------------------------
	// DOM helpers
	// -------------------------------------------------------------------------

	// Like $.extend({}, ...): shallow merge that skips undefined values.
	function extend(target) {
		for (var i = 1; i < arguments.length; i++) {
			var src = arguments[i] || {};
			for (var key in src) {
				if (Object.prototype.hasOwnProperty.call(src, key) && src[key] !== undefined) { target[key] = src[key]; }
			}
		}
		return target;
	}

	function resolve(target) {
		if (!target) { return []; }
		if (typeof target === 'string') { return Array.prototype.slice.call(document.querySelectorAll(target)); }
		if (target.nodeType) { return [target]; }
		if (typeof target.length === 'number') {
			return Array.prototype.filter.call(target, function (node) { return node && node.nodeType === 1; });
		}
		return [];
	}

	function offset(el) {
		var rect = el.getBoundingClientRect();
		return { top: rect.top + window.pageYOffset, left: rect.left + window.pageXOffset };
	}

	function getViewport() {
		var m = document.compatMode == 'CSS1Compat';
		return {
			l : window.pageXOffset || (m ? document.documentElement.scrollLeft : document.body.scrollLeft),
			t : window.pageYOffset || (m ? document.documentElement.scrollTop : document.body.scrollTop),
			w : window.innerWidth || (m ? document.documentElement.clientWidth : document.body.clientWidth),
			h : window.innerHeight || (m ? document.documentElement.clientHeight : document.body.clientHeight)
		};
	}

	// Same as $(el).show() / .hide() for the picker <div>.
	function showElement(el) {
		if (el.style.display === 'none') { el.style.display = ''; }
		if (window.getComputedStyle(el).display === 'none') { el.style.display = 'block'; }
	}

	function hideElement(el) {
		el.style.display = 'none';
	}

	// jQuery handlers returning false prevent the default action and stop
	// propagation; keep that for the ported handlers.
	function cancel(ev) {
		ev.preventDefault();
		ev.stopPropagation();
		return false;
	}

	// "click.myNamespace focus" -> ["click", "focus"]
	function eventTypes(names) {
		return String(names).split(/\s+/).filter(Boolean).map(function (name) { return name.split('.')[0]; });
	}

	// -------------------------------------------------------------------------
	// ColorPicker
	// -------------------------------------------------------------------------

	/**
	 * @param {Element|string} element  Element (or selector, first match) that
	 *                                  opens the picker, or holds it when flat.
	 * @param {Object} [opt]            See ColorPicker.defaults.
	 */
	function ColorPicker(element, opt) {
		if (!(this instanceof ColorPicker)) { return new ColorPicker(element, opt); }
		var el = resolve(element)[0];
		if (!el) { throw new Error('ColorPicker: element not found'); }
		if (instances.has(el)) { return instances.get(el); }

		opt = extend({}, ColorPicker.defaults, opt);
		var color = toHSB(opt.color);
		if (!color) { throw new Error('ColorPicker: invalid color'); }

		var picker = this,
			id = 'collorpicker_' + (++uid),
			listeners = [],
			docListeners = [],
			cal;

		// Options and state live together, like the object 2.x stored in
		// $(cal).data('colorpicker'): callbacks, color, origColor, livePreview...
		var options = picker.options = extend({}, opt);
		options.color = color;
		options.origColor = color;

		cal = document.createElement('div');
		cal.innerHTML = tpl;
		cal = cal.firstChild;
		cal.id = id;

		picker.el = el;
		picker.picker = cal;
		picker.id = id;
		// The value of `this` in onChange (the jQuery bridge swaps in $(cal)).
		picker.changeContext = cal;
		// The value of `this` in onSubmit (the jQuery bridge swaps in its view).
		picker.submitContext = picker;

		if (options.flat) {
			el.appendChild(cal);
			showElement(cal);
		} else {
			document.body.appendChild(cal);
		}

		// Adds a listener; returns a function that removes it.
		function listen(target, type, handler) {
			target.addEventListener(type, handler);
			var offBridge = bridge.listen ? bridge.listen(target, type, handler) : null;
			return function () {
				target.removeEventListener(type, handler);
				if (offBridge) { offBridge(); }
			};
		}

		function on(target, type, handler) {
			listeners.push(listen(target, type, handler));
		}

		// Document handlers active during a drag or while the picker is open.
		function onDocument(type, handler) {
			docListeners.push([handler, listen(document, type, handler)]);
		}

		function offDocument(handler) {
			for (var i = docListeners.length - 1; i >= 0; i--) {
				if (docListeners[i][0] === handler) {
					docListeners[i][1]();
					docListeners.splice(i, 1);
				}
			}
		}

		function q(selector) { return cal.querySelector(selector); }

		picker.fields = Array.prototype.slice.call(cal.querySelectorAll('input'));
		picker.selector = q('div.colorpicker_color');
		picker.selectorIndic = picker.selector.querySelector(':scope div div');
		picker.hue = q(':scope div.colorpicker_hue div');
		picker.newColor = q(':scope div.colorpicker_new_color');
		picker.currentColor = q('div.colorpicker_current_color');

		var fields = picker.fields;

		var fillRGBFields = function (hsb) {
				var rgb = HSBToRGB(hsb);
				fields[1].value = rgb.r;
				fields[2].value = rgb.g;
				fields[3].value = rgb.b;
			},
			fillHSBFields = function (hsb) {
				fields[4].value = hsb.h;
				fields[5].value = hsb.s;
				fields[6].value = hsb.b;
			},
			fillHexFields = function (hsb) {
				fields[0].value = HSBToHex(hsb);
			},
			setSelector = function (hsb) {
				picker.selector.style.backgroundColor = '#' + HSBToHex({h: hsb.h, s: 100, b: 100});
				picker.selectorIndic.style.left = parseInt(150 * hsb.s/100, 10) + 'px';
				picker.selectorIndic.style.top = parseInt(150 * (100-hsb.b)/100, 10) + 'px';
			},
			setHue = function (hsb) {
				picker.hue.style.top = parseInt(150 - 150 * hsb.h/360, 10) + 'px';
			},
			setCurrentColor = function (hsb) {
				picker.currentColor.style.backgroundColor = '#' + HSBToHex(hsb);
			},
			setNewColor = function (hsb) {
				picker.newColor.style.backgroundColor = '#' + HSBToHex(hsb);
			},
			setAll = function (col) {
				fillRGBFields(col);
				fillHSBFields(col);
				fillHexFields(col);
				setHue(col);
				setSelector(col);
				setCurrentColor(col);
				setNewColor(col);
			},
			// field.focus() that still runs the focus handler when the field is
			// already focused, like jQuery's .focus().
			focusField = function (field) {
				if (document.activeElement === field) {
					focus.call(field);
				} else {
					field.focus();
				}
			},
			keyDown = function (ev) {
				var pressedKey = ev.charCode || ev.keyCode || -1;
				if ((pressedKey > charMin && pressedKey <= 90) || pressedKey == 32) {
					return cancel(ev);
				}
				if (options.livePreview === true) {
					change.apply(this);
				}
			},
			change = function (ev) {
				var col;
				if (this.parentNode.className.indexOf('_hex') > 0) {
					options.color = col = HexToHSB(fixHex(this.value));
				} else if (this.parentNode.className.indexOf('_hsb') > 0) {
					options.color = col = fixHSB({
						h: parseInt(fields[4].value, 10),
						s: parseInt(fields[5].value, 10),
						b: parseInt(fields[6].value, 10)
					});
				} else {
					options.color = col = RGBToHSB(fixRGB({
						r: parseInt(fields[1].value, 10),
						g: parseInt(fields[2].value, 10),
						b: parseInt(fields[3].value, 10)
					}));
				}
				if (ev) {
					fillRGBFields(col);
					fillHexFields(col);
					fillHSBFields(col);
				}
				setSelector(col);
				setHue(col);
				setNewColor(col);
				options.onChange.apply(picker.changeContext, [col, HSBToHex(col), HSBToRGB(col)]);
			},
			blur = function () {
				fields.forEach(function (field) { field.parentNode.classList.remove('colorpicker_focus'); });
			},
			focus = function () {
				charMin = this.parentNode.className.indexOf('_hex') > 0 ? 70 : 65;
				fields.forEach(function (field) { field.parentNode.classList.remove('colorpicker_focus'); });
				this.parentNode.classList.add('colorpicker_focus');
			},
			downIncrement = function (ev) {
				var field = this.parentNode.querySelector('input');
				focusField(field);
				var current = {
					el: this.parentNode,
					max: this.parentNode.className.indexOf('_hsb_h') > 0 ? 360 : (this.parentNode.className.indexOf('_hsb') > 0 ? 100 : 255),
					y: ev.pageY,
					field: field,
					val: parseInt(field.value, 10),
					preview: options.livePreview
				};
				current.el.classList.add('colorpicker_slider');
				var moveIncrement = function (ev) {
					current.field.value = Math.max(0, Math.min(current.max, parseInt(current.val + ev.pageY - current.y, 10)));
					if (current.preview) {
						change.apply(current.field, [true]);
					}
					return cancel(ev);
				};
				var upIncrement = function (ev) {
					change.apply(current.field, [true]);
					current.el.classList.remove('colorpicker_slider');
					focusField(current.el.querySelector('input'));
					offDocument(upIncrement);
					offDocument(moveIncrement);
					return cancel(ev);
				};
				onDocument('mouseup', upIncrement);
				onDocument('mousemove', moveIncrement);
			},
			downHue = function () {
				var current = {
					y: offset(this).top,
					preview: options.livePreview
				};
				var moveHue = function (ev) {
					fields[4].value = parseInt(360*(150 - Math.max(0,Math.min(150,(ev.pageY - current.y))))/150, 10);
					change.apply(fields[4], [current.preview]);
					return cancel(ev);
				};
				var upHue = function (ev) {
					fillRGBFields(options.color);
					fillHexFields(options.color);
					offDocument(upHue);
					offDocument(moveHue);
					return cancel(ev);
				};
				onDocument('mouseup', upHue);
				onDocument('mousemove', moveHue);
			},
			downSelector = function () {
				var current = {
					pos: offset(this),
					preview: options.livePreview
				};
				var moveSelector = function (ev) {
					fields[6].value = parseInt(100*(150 - Math.max(0,Math.min(150,(ev.pageY - current.pos.top))))/150, 10);
					fields[5].value = parseInt(100*(Math.max(0,Math.min(150,(ev.pageX - current.pos.left))))/150, 10);
					change.apply(fields[5], [current.preview]);
					return cancel(ev);
				};
				var upSelector = function (ev) {
					fillRGBFields(options.color);
					fillHexFields(options.color);
					offDocument(upSelector);
					offDocument(moveSelector);
					return cancel(ev);
				};
				onDocument('mouseup', upSelector);
				onDocument('mousemove', moveSelector);
			},
			clickSubmit = function () {
				var col = options.color;
				options.origColor = col;
				setCurrentColor(col);
				options.onSubmit.call(picker.submitContext, col, HSBToHex(col), HSBToRGB(col), el);
			},
			show = function (ev) {
				options.onBeforeShow.apply(el, [cal]);
				var pos = offset(el);
				var viewPort = getViewport();
				var top = pos.top + el.offsetHeight;
				var left = pos.left;
				if (top + 176 > viewPort.t + viewPort.h) {
					top -= el.offsetHeight + 176;
				}
				if (left + 356 > viewPort.l + viewPort.w) {
					left -= 356;
				}
				cal.style.left = left + 'px';
				cal.style.top = top + 'px';
				if (options.onShow.apply(el, [cal]) != false) {
					showElement(cal);
				}
				offDocument(hide);
				onDocument('mousedown', hide);
				if (ev) { cancel(ev); }
				return false;
			},
			hide = function (ev) {
				if (!cal.contains(ev.target)) {
					if (options.onHide.apply(document, [cal]) != false) {
						hideElement(cal);
					}
					offDocument(hide);
				}
			},
			restoreOriginal = function () {
				var col = options.origColor;
				options.color = col;
				fillRGBFields(col);
				fillHexFields(col);
				fillHSBFields(col);
				setSelector(col);
				setHue(col);
				setNewColor(col);
			};

		fields.forEach(function (field) {
			on(field, 'keyup', keyDown);
			on(field, 'change', change);
			on(field, 'blur', blur);
			on(field, 'focus', focus);
		});
		Array.prototype.forEach.call(cal.querySelectorAll('span'), function (span) {
			on(span, 'mousedown', downIncrement);
		});
		on(picker.currentColor, 'click', restoreOriginal);
		on(picker.selector, 'mousedown', downSelector);
		on(q('div.colorpicker_hue'), 'mousedown', downHue);
		var submit = q('div.colorpicker_submit');
		on(submit, 'mouseenter', function () { submit.classList.add('colorpicker_focus'); });
		on(submit, 'mouseleave', function () { submit.classList.remove('colorpicker_focus'); });
		on(submit, 'click', clickSubmit);

		setAll(color);

		if (options.flat) {
			cal.style.position = 'relative';
			cal.style.display = 'block';
		} else {
			eventTypes(options.eventName).forEach(function (type) { on(el, type, show); });
		}

		instances.set(el, picker);
		picker._teardown = [];

		/** Opens the picker next to its element (no-op for flat pickers' position). */
		picker.show = function () {
			show();
			return picker;
		};

		/** Hides the picker without calling onHide (like ColorPickerHide). */
		picker.hide = function () {
			hideElement(cal);
			return picker;
		};

		/** Sets the current and original color; doesn't call onChange. */
		picker.setColor = function (col) {
			col = toHSB(col);
			if (col) {
				options.color = col;
				options.origColor = col;
				setAll(col);
			}
			return picker;
		};

		/** @return {{hsb: Object, hex: string, rgb: Object}} */
		picker.getColor = function () {
			return { hsb: options.color, hex: HSBToHex(options.color), rgb: HSBToRGB(options.color) };
		};

		/** Removes the picker markup and every listener. */
		picker.destroy = function () {
			listeners.forEach(function (off) { off(); });
			docListeners.forEach(function (l) { l[1](); });
			listeners.length = docListeners.length = 0;
			if (cal.parentNode) { cal.parentNode.removeChild(cal); }
			picker._teardown.forEach(function (fn) { fn(); });
			instances.delete(el);
		};
	}

	ColorPicker.defaults = defaults;
	ColorPicker.version = '2.0.0';

	/** Returns the picker attached to an element (or selector). */
	ColorPicker.getInstance = function (element) {
		var el = resolve(element)[0];
		return el ? instances.get(el) : undefined;
	};

	/** Creates a picker for every matching element. Returns the pickers. */
	ColorPicker.init = function (target, opt) {
		if (!toHSB(extend({}, ColorPicker.defaults, opt).color)) { return []; }
		return resolve(target).map(function (el) { return new ColorPicker(el, opt); });
	};

	// Color conversion helpers.
	ColorPicker.hexToHsb = HexToHSB;
	ColorPicker.hexToRgb = HexToRGB;
	ColorPicker.rgbToHsb = RGBToHSB;
	ColorPicker.rgbToHex = RGBToHex;
	ColorPicker.hsbToRgb = HSBToRGB;
	ColorPicker.hsbToHex = HSBToHex;

	// -------------------------------------------------------------------------
	// jQuery bridge: $(el).ColorPicker(), ColorPickerShow, ColorPickerHide,
	// ColorPickerSetColor, $(el).data('colorpickerId') and
	// $(picker).data('colorpicker') keep working for existing sites.
	// -------------------------------------------------------------------------

	// Element properties that 1.x stored as jQuery objects.
	var ELEMENT_PROPS = { fields: 1, selector: 1, selectorIndic: 1, hue: 1, newColor: 1, currentColor: 1 };

	ColorPicker.installJQuery = function ($) {
		if (!$ || !$.fn || ($.fn.ColorPicker && $.fn.ColorPicker.vanilla)) { return; }

		// The object 1.x kept in $(cal).data('colorpicker'): options + state,
		// with the picker parts as jQuery objects.
		function dataView(picker) {
			return new Proxy(picker.options, {
				get: function (target, key) {
					if (ELEMENT_PROPS[key]) { return $(picker[key]); }
					if (key === 'el') { return picker.el; }
					return target[key];
				},
				set: function (target, key, value) {
					if (ELEMENT_PROPS[key] || key === 'el') {
						picker[key] = value && value.jquery ? (key === 'fields' ? Array.prototype.slice.call(value) : value[0]) : value;
					} else {
						target[key] = value;
					}
					return true;
				}
			});
		}

		function attach(el, opt) {
			var picker = new ColorPicker(el, opt);
			var view = dataView(picker);
			picker.changeContext = $(picker.picker);
			picker.submitContext = view;
			$.data(el, 'colorpickerId', picker.id);
			$.data(picker.picker, 'colorpicker', view);
			picker._teardown.push(function () { $.removeData(el, 'colorpickerId'); });
		}

		// 1.x bound its handlers with jQuery, so events fired with
		// $(el).trigger() reached them. Native listeners only see real events,
		// so mirror each one with a jQuery handler for triggered events.
		// Events with a native method (click, focus, blur) are skipped there:
		// trigger() also calls the method, which fires the native listener.
		bridge.listen = function (target, type, handler) {
			var mirror = function (ev) {
				if (ev.originalEvent || typeof target[type] === 'function') { return; }
				return handler.call(this, ev);
			};
			$(target).bind(type, mirror);
			return function () { $(target).unbind(type, mirror); };
		};

		function find(el) {
			return $.data(el, 'colorpickerId') ? ColorPicker.getInstance(el) : undefined;
		}

		$.fn.extend({
			ColorPicker: function (opt) {
				if (!toHSB(extend({}, ColorPicker.defaults, opt).color)) {
					return this;
				}
				return this.each(function () {
					if (!$.data(this, 'colorpickerId') && !instances.has(this)) {
						attach(this, opt);
					}
				});
			},
			ColorPickerHide: function () {
				return this.each(function () {
					var picker = find(this);
					if (picker) { picker.hide(); }
				});
			},
			ColorPickerShow: function () {
				return this.each(function () {
					var picker = find(this);
					if (picker) { picker.show(); }
				});
			},
			ColorPickerSetColor: function (col) {
				if (!toHSB(col)) {
					return this;
				}
				return this.each(function () {
					var picker = find(this);
					if (picker) { picker.setColor(col); }
				});
			},
			ColorPickerDestroy: function () {
				return this.each(function () {
					var picker = ColorPicker.getInstance(this);
					if (picker) { picker.destroy(); }
				});
			}
		});
		$.fn.ColorPicker.vanilla = true;
	};

	if (window.jQuery) { ColorPicker.installJQuery(window.jQuery); }

	return ColorPicker;
}));
