/**
 * bootbox.js [master branch]
 *
 * http://bootboxjs.com/license.txt
 */

// @see https://github.com/makeusabrew/bootbox/issues/180
// @see https://github.com/makeusabrew/bootbox/issues/186
(function (root, factory) {

  "use strict";
  if (typeof define === "function" && define.amd) {
    // AMD. Register as an anonymous module.
    define(["jquery"], factory);
  } else if (typeof exports === "object") {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.

    if (typeof $ === "undefined") {
      module.exports = factory(require("jquery"));
    } else {
      module.exports = factory($); // jshint ignore:line
    }

  } else {
    // Browser globals (root is window)
    root.bootbox = factory(root.jQuery);
  }

}(this, function init($, undefined) {

  "use strict";

  // the base DOM structure needed to create a modal
  var templates = {
    dialog:
      "<div class='bootbox modal' tabindex='-1' role='dialog' aria-hidden='true'>" +
        "<div class='modal-dialog'>" +
          "<div class='modal-content'>" +
            "<div class='modal-body'><div class='bootbox-body'></div></div>" +
          "</div>" +
        "</div>" +
      "</div>",
    header:
      "<div class='modal-header'>" +
        "<h4 class='modal-title'></h4>" +
      "</div>",
    footer:
      "<div class='modal-footer'></div>",
    closeButton:
      "<button type='button' class='bootbox-close-button close' aria-hidden='true'>&times;</button>",
    form:
      "<form class='bootbox-form'></form>",
    inputLabel:
      "<label class='form-control-label'></label>",
    inputs: {
      text:
        "<input class='bootbox-input bootbox-input-text form-control' autocomplete=off type=text />",
      textarea:
        "<textarea class='bootbox-input bootbox-input-textarea form-control'></textarea>",
      email:
        "<input class='bootbox-input bootbox-input-email form-control' autocomplete='off' type='email' />",
      select:
        "<select class='bootbox-input bootbox-input-select form-control'></select>",
      checkbox:
        "<div class='checkbox'><label><input class='bootbox-input bootbox-input-checkbox' type='checkbox' /></label></div>",
      radio:
        "<div class='radio'><label><input class='bootbox-input bootbox-input-radio' type='radio' /></label></div>",
      boolean:
        "<input class='bootbox-input bootbox-input-checkbox' type='checkbox' />",
      date:
        "<input class='bootbox-input bootbox-input-date form-control' autocomplete=off type='date' />",
      time:
        "<input class='bootbox-input bootbox-input-time form-control' autocomplete=off type='time' />",
      number:
        "<input class='bootbox-input bootbox-input-number form-control' autocomplete=off type='number' />",
      password:
        "<input class='bootbox-input bootbox-input-password form-control' autocomplete='off' type='password' />"
    }
  };

  var defaults = {
    // default language
    locale: "en",
    // show backdrop or not. Default to static so user has to interact with dialog
    backdrop: "static",
    // animate the modal in/out
    animate: true,
    // additional class string applied to the top level dialog
    className: null,
    // whether or not to include a close button
    closeButton: true,
    // show the dialog immediately by default
    show: true,
    // dialog container
    container: "body"
  };

  // our public object; augmented after our private API
  var exports = {};

  /**
   * @private
   */
  function _t(key) {
    var locale = locales[defaults.locale];
    return locale ? locale[key] : locales.en[key];
  }

  function processCallback(e, dialog, callback) {
    e.stopPropagation();
    e.preventDefault();

    // by default we assume a callback will get rid of the dialog,
    // although it is given the opportunity to override this

    // so, if the callback can be invoked and it *explicitly returns false*
    // then we'll set a flag to keep the dialog active...
    var preserveDialog = $.isFunction(callback) && callback.call(dialog, e) === false;

    // ... otherwise we'll bin it
    if (!preserveDialog) {
      dialog.modal("hide");
    }
  }

  // Bootstrap 3.x supports back to IE8 on Windows (http://getbootstrap.com/getting-started/#support)
  // so unfortunately we can't just get away with assuming Object.keys exists
  function getKeyLength(obj) {
    if (Object.keys) {
      return Object.keys(obj).length;
    }

    var k, t = 0;
    for (k in obj) {
      t ++;
    }
    return t;
  }

  // tiny wrapper function around jQuery.each; just adds index as the third parameter
  function each(collection, iterator) {
    var index = 0;
    $.each(collection, function(key, value) {
      iterator(key, value, index++);
    });
  }

  // dec2hex :: Integer -> String
  function dec2hex (dec) {
    return ('0' + dec.toString(16)).substr(-2);
  }

  // generateId :: Integer -> String
  function generateId (len) {
    var arr = new Uint8Array((len || 40) / 2);
    window.crypto.getRandomValues(arr);
    return Array.from(arr, dec2hex).join('');
  }

  /**
   * Filter and tidy up any user supplied parameters to this dialog.
   * Also looks for any shorthands used and ensures that the options
   * which are returned are all normalized properly
   */
  function sanitize(options) {
    var buttons;
    var total;

    if (typeof options !== "object") {
      throw new Error("Please supply an object of options");
    }

    if (!options.message) {
      throw new Error("Please specify a message");
    }

    // make sure any supplied options take precedence over defaults
    options = $.extend({}, defaults, options);

    // no buttons is still a valid dialog but it's cleaner  toalways have
    // a buttons object to iterate over, even if it's empty
    if (!options.buttons) {
      options.buttons = {};
    }

    buttons = options.buttons;

    total = getKeyLength(buttons);

    each(buttons, function(key, button, index) {
      var isLast = index === total-1;

      if ($.isFunction(button)) {
        // short form, assume value is our callback. Since button
        // isn't an object it isn't a reference either so re-assign it
        button = buttons[key] = {
          callback: button
        };
      }

      // before any further checks make sure by now button is the correct type
      if ($.type(button) !== "object") {
        throw new Error("button with key " + key + " must be an object");
      }

      if (!button.label) {
        // the lack of an explicit label means we'll assume the key is good enough
        button.label = key;
      }

      if (!button.className) {
        if (total <= 2 && isLast) {
          // always add a primary to the main option in a one or two-button dialog
          button.className = "btn-primary";
        } else {
          button.className = "btn-default";
        }
      }
    });

    return options;
  }

  /**
   * map a flexible set of arguments into a single returned object
   * if args.length is already one just return it, otherwise
   * use the properties argument to map the unnamed args to
   * object properties
   * so in the latter case:
   * mapArguments(["foo", $.noop], ["message", "callback"])
   * -> { message: "foo", callback: $.noop }
   */
  function mapArguments(args, properties) {
    var argn = args.length;
    var options = {};

    if (argn < 1 || argn > 2) {
      throw new Error("Invalid argument length");
    }

    if (argn === 2 || typeof args[0] === "string") {
      options[properties[0]] = args[0];
      options[properties[1]] = args[1];
    } else {
      options = args[0];
    }

    return options;
  }

  /**
   * merge a set of default dialog options with user supplied arguments
   */
  function mergeArguments(defaults, args, properties) {
    return $.extend(
      // deep merge
      true,
      // ensure the target is an empty, unreferenced object
      {},
      // the base options object for this type of dialog (often just buttons)
      defaults,
      // args could be an object or array; if it's an array properties will
      // map it to a proper options object
      mapArguments(
        args,
        properties
      )
    );
  }

  /**
   * this entry-level method makes heavy use of composition to take a simple
   * range of inputs and return valid options suitable for passing to bootbox.dialog
   */
  function mergeDialogOptions(className, labels, properties, args) {
    //  build up a base set of dialog properties
    var baseOptions = {
      className: "bootbox-" + className,
      buttons: createLabels.apply(null, labels)
    };

    // ensure the buttons properties generated, *after* merging
    // with user args are still valid against the supplied labels
    return validateButtons(
      // merge the generated base properties with user supplied arguments
      mergeArguments(
        baseOptions,
        args,
        // if args.length > 1, properties specify how each arg maps to an object key
        properties
      ),
      labels
    );
  }

  /**
   * from a given list of arguments return a suitable object of button labels
   * all this does is normalise the given labels and translate them where possible
   * e.g. "ok", "confirm" -> { ok: "OK", cancel: "Annuleren" }
   */
  function createLabels() {
    var buttons = {};

    for (var i = 0, j = arguments.length; i < j; i++) {
      var argument = arguments[i];
      var key = argument.toLowerCase();
      var value = argument.toUpperCase();

      buttons[key] = {
        label: _t(value)
      };
    }

    return buttons;
  }

  function validateButtons(options, buttons) {
    var allowedButtons = {};
    each(buttons, function(key, value) {
      allowedButtons[value] = true;
    });

    each(options.buttons, function(key) {
      if (allowedButtons[key] === undefined) {
        throw new Error("button key " + key + " is not allowed (options are " + buttons.join("\n") + ")");
      }
    });

    return options;
  }

  exports.alert = function() {
    var options;

    options = mergeDialogOptions("alert", ["ok"], ["message", "callback"], arguments);

    // @TODO: can this move inside exports.dialog when we're iterating over each
    // button and checking its button.callback value instead?
    if (options.callback && !$.isFunction(options.callback)) {
      throw new Error("alert requires callback property to be a function when provided");
    }

    /**
     * override the ok and escape callback to make sure they just invoke
     * the single user-supplied one (if provided)
     */
    options.buttons.ok.callback = options.onEscape = function() {
      if ($.isFunction(options.callback)) {
        return options.callback.call(this);
      }
      return true;
    };

    return exports.dialog(options);
  };

  exports.confirm = function() {
    var options;

    options = mergeDialogOptions("confirm", ["cancel", "confirm"], ["message", "callback"], arguments);

    // confirm specific validation; they don't make sense without a callback so make
    // sure it's present
    if (!$.isFunction(options.callback)) {
      throw new Error("confirm requires a callback");
    }

    /**
     * overrides; undo anything the user tried to set they shouldn't have
     */
    options.buttons.cancel.callback = options.onEscape = function() {
      return options.callback.call(this, false);
    };

    options.buttons.confirm.callback = function() {
      return options.callback.call(this, true);
    };

    return exports.dialog(options);
  };

  exports.form = function() {
    var options;
    var defaults;
    var dialog;
    var form;
    var input;
    var shouldShow;
    var inputOptions;
    var inputs = [];

    // we have to create our form first otherwise
    // its value is undefined when gearing up our options
    // @TODO this could be solved by allowing message to
    // be a function instead...
    form = $(templates.form);

    // prompt defaults are more complex than others in that
    // users can override more defaults
    // @TODO I don't like that prompt has to do a lot of heavy
    // lifting which mergeDialogOptions can *almost* support already
    // just because of 'value' and 'inputType' - can we refactor?
    defaults = {
      className: "bootbox-prompt",
      buttons: createLabels("cancel", "confirm"),
      inputs: [{
        value: "",
        inputType: "text"
      }]
    };

    options = validateButtons(
      mergeArguments(defaults, arguments, ["title", "callback"]),
      ["cancel", "confirm"]
    );

    // capture the user's show value; we always set this to false before
    // spawning the dialog to give us a chance to attach some handlers to
    // it, but we need to make sure we respect a preference not to show it
    shouldShow = (options.show === undefined) ? true : options.show;

    /**
     * overrides; undo anything the user tried to set they shouldn't have
     */
    options.message = form;

    options.buttons.cancel.callback = options.onEscape = function() {
      return options.callback.call(this, null);
    };

    var isPrompt = (options.inputs.length === 1 && options.type === 'prompt');
    options.buttons.confirm.callback = function() {
      var values = [];
      var value;

      for (var i = 0; i < options.inputs.length; i++) {
        var current_options = options.inputs[i];
        if (current_options.inputType === "checkbox") {
          value = inputs[i].find("input:checked").map(function() {
            return $(this).val();
          }).get();
        } else if (current_options.inputType === "boolean") {
          value = inputs[i].prop("checked");
        } else if (current_options.inputType === "radio") {
          value = inputs[i].find("input:checked").val();
        } else if (current_options.inputType === "select" && current_options.customInput) {
          value = inputs[i].find("select").val();
          if (value == current_options.customInput.value) {
            value = current_options.customInput.input.val();
          }
        } else {
          value = inputs[i].val();
          if (current_options.inputType === "number") {
            value = parseFloat(value);
          } else if (current_options.parse) {
            value = current_options.parse(value);
          }
        }
        values.push(value);
      }

      value = isPrompt? values[0] : values;
      return options.callback.call(this, value);
    };

    options.show = false;

    // form specific validation
    if (!options.title) {
      throw new Error("form requires a title");
    }

    if (!$.isFunction(options.callback)) {
      throw new Error("form requires a callback");
    }

    var form_name = options.name || 'form_' + generateId(5);
    for (var i = 0; i < options.inputs.length; i++) {
      var current_options = options.inputs[i];
      if (!templates.inputs[current_options.inputType]) {
        throw new Error("invalid prompt type");
      }

      // create the input based on the supplied type
      input = $(templates.inputs[current_options.inputType]);

      switch (current_options.inputType) {
        case "text":
        case "textarea":
        case "email":
        case "date":
        case "time":
        case "number":
        case "password":
          input.val(current_options.value);
          break;
        case "boolean":
          input.prop("checked", current_options.value);
          break;

        case "select":
          var groups = {};
          inputOptions = current_options.inputOptions || [];

          if (!$.isArray(inputOptions)) {
            throw new Error("Please pass an array of input options");
          }

          if (!inputOptions.length) {
            throw new Error("prompt with select requires options");
          }

          each(inputOptions, function(_, option) {

            // assume the element to attach to is the input...
            var elem = input;

            if (option.value === undefined || option.text === undefined) {
              throw new Error("each option needs a `value` and a `text` property");
            }

            // ... but override that element if this option sits in a group

            if (option.group) {
              // initialise group if necessary
              if (!groups[option.group]) {
                groups[option.group] = $("<optgroup/>").attr("label", option.group);
              }

              elem = groups[option.group];
            }

            elem.append("<option value='" + option.value + "'>" + option.text + "</option>");
          });

          each(groups, function(_, group) {
            input.append(group);
          });

          // safe to set a select's value as per a normal input
          input.val(current_options.value);

          if (current_options.customInput) {
            // select with customValue
            var s = current_options.customInput;
            var select = input;
            input = $("<div/>");
            input.append(select);
            input.append("<br/>");
            var customInputType = s.inputType || 'textarea';
            var customInput = $(templates.inputs[customInputType]);
            input.append(customInput);

            if (s.placeholder) {
              customInput.attr("placeholder", s.placeholder);
            }
            if (s.maxlength) {
              customInput.attr("maxlength", s.maxlength);
            }
            select.change(function(sel, customValue, customInput) {
              return function() {
                if (sel.val() == customValue) {
                  customInput.show();
                } else {
                  customInput.hide();
                }
              }}(select, s.value, customInput)
            );
            if (current_options.value === s.value) {
              customInput.show();
            } else {
              customInput.hide();
            }
            current_options.customInput.input = customInput;
          }

          break;

        case "checkbox":
          var values   = $.isArray(current_options.value) ? current_options.value : [current_options.value];
          inputOptions = current_options.inputOptions || [];

          if (!inputOptions.length) {
            throw new Error("prompt with checkbox requires options");
          }

          for (var oi = 0; oi < inputOptions.length; oi++) {
            if (inputOptions[oi].value == undefined || inputOptions[oi].text == undefined) {
              throw new Error("each option needs a `value` and a `text` property");
            }
          }

          // checkboxes have to nest within a containing element, so
          // they break the rules a bit and we end up re-assigning
          // our 'input' element to this container instead
          input = $("<div/>");

          each(inputOptions, function(_, option) {
            var checkbox = $(templates.inputs[current_options.inputType]);

            checkbox.find("input").attr("value", option.value);
            checkbox.find("label").append(option.text);

            // we've ensured values is an array so we can always iterate over it
            each(values, function(_, value) {
              if (value === option.value) {
                checkbox.find("input").prop("checked", true);
              }
            });

            input.append(checkbox);
          });
          break;

        case "radio":
          var value = current_options.value;
          inputOptions = current_options.inputOptions || [];
          if (current_options.name == undefined) {
            current_options.name = form_name + '_input_' + i;
          }

          if (!inputOptions.length) {
            throw new Error("prompt with radio requires options");
          }

          for (var oi = 0; oi < inputOptions.length; oi++) {
            if (inputOptions[oi].value == undefined || inputOptions[oi].text == undefined) {
              throw new Error("each option needs a `value` and a `text` property");
            }
          }

          // radio buttons have to nest within a containing element, so
          // they break the rules a bit and we end up re-assigning
          // our 'input' element to this container instead
          input = $("<div/>");

          var radioInputs = [];
          each(inputOptions, function(_, option, optionIndex) {
            var radio = $(templates.inputs[current_options.inputType]);

            radio.find("input").attr("value", option.value).attr("name", current_options.name);
            if (current_options.useNumberShortcuts) {
              radio.find("label").append((optionIndex+1) + '.&nbsp;');
            }
            radio.find("label").append(option.text);

            if (value === option.value) {
              radio.find("input").prop("checked", true);
            }

            input.append(radio);
            radioInputs.push(radio.find("input"));
          });
          if (current_options.useNumberShortcuts) {
            input.on('keypress', function(e) {
              var keyCount = e.which - 48; // subtract ascii for "0" key number
              if (keyCount >= 1 && keyCount <= inputOptions.length) {
                var button = radioInputs[keyCount-1];
                if (button) {
                  button.focus();
                  button.click();
                  return false;
                }
              }
            });
          }
          break;
      }

      // @TODO provide an attributes option instead
      // and simply map that as keys: vals
      if (current_options.placeholder) {
        input.attr("placeholder", current_options.placeholder);
      }

      if (current_options.pattern) {
        input.attr("pattern", current_options.pattern);
      }

      if (current_options.maxlength) {
        input.attr("maxlength", current_options.maxlength);
      }

      // now place it in our form
      if (i > 0) {
        form.append('<br/>');
      }
      if (current_options.messageBefore) {
        form.append(current_options.messageBefore);
      }
      if (!isPrompt && current_options.title) {
        var inputLabel = $(templates.inputLabel);
        inputLabel.text(current_options.title);
        form.append(inputLabel);
      }
      form.append(input);
      if (current_options.messageAfter) {
        form.append(current_options.messageAfter);
      }
      inputs.push(input);
    }

    form.on("submit", function(e) {
      e.preventDefault();
      // Fix for SammyJS (or similar JS routing library) hijacking the form post.
      e.stopPropagation();
      // @TODO can we actually click *the* button object instead?
      // e.g. buttons.confirm.click() or similar
      dialog.find(".btn-primary").click();
    });

    dialog = exports.dialog(options);

    if (inputs.length) {
      // clear the existing handler focusing the submit button...
      dialog.off("shown.bs.modal");

      // ...and replace it with one focusing our input, if possible
      dialog.on("shown.bs.modal", function() {
        // need the closure here since input isn't
        // an object otherwise
        var elements = inputs[0].find('input');
        if (elements.length) {
          elements[0].focus();
        } else {
          inputs[0].focus();
        }
      });
    }

    if (shouldShow === true) {
      dialog.modal("show");
    }

    return dialog;
  };

  exports.prompt = function() {
    var defaults = {
      className: "bootbox-prompt",
      buttons: createLabels("cancel", "confirm"),
      value: "",
      inputType: "text",
      type: "prompt"
    };

    var options = validateButtons(
      mergeArguments(defaults, arguments, ["title", "callback"]),
      ["cancel", "confirm"]
    );

    // prompt specific validation
    if (!options.title) {
      throw new Error("prompt requires a title");
    }

    if (!$.isFunction(options.callback)) {
      throw new Error("prompt requires a callback");
    }

    var input = {};
    var inputFields = ['value', 'inputType', 'inputOptions', 
      'placeholder', 'pattern', 'maxlength', 'customInput',
      'useNumberShortcuts', 'messageBefore', 'messageAfter'];
    each(inputFields, function(_, x) {
      input[x] = options[x];
      delete options[x];
    });
    options.inputs = [input];

    var dialog = exports.form(options);
    return dialog;
  };


  exports.dialog = function(options) {
    options = sanitize(options);

    var dialog = $(templates.dialog);
    var innerDialog = dialog.find(".modal-dialog");
    var body = dialog.find(".modal-body");
    var buttons = options.buttons;
    var buttonStr = "";
    var callbacks = {
      onEscape: options.onEscape
    };

    if ($.fn.modal === undefined) {
      throw new Error(
        "$.fn.modal is not defined; please double check you have included " +
        "the Bootstrap JavaScript library. See http://getbootstrap.com/javascript/ " +
        "for more details."
      );
    }

    each(buttons, function(key, button) {

      // @TODO I don't like this string appending to itself; bit dirty. Needs reworking
      // can we just build up button elements instead? slower but neater. Then button
      // can just become a template too
      buttonStr += "<button data-bb-handler='" + key + "' type='button' class='btn " + button.className + "'>" + button.label + "</button>";
      callbacks[key] = button.callback;
    });

    body.find(".bootbox-body").html(options.message);

    if (options.animate === true) {
      dialog.addClass("fade");
    }

    if (options.className) {
      dialog.addClass(options.className);
    }

    if (options.size === "large") {
      innerDialog.addClass("modal-lg");
    } else if (options.size === "small") {
      innerDialog.addClass("modal-sm");
    }

    if (options.title) {
      body.before(templates.header);
    }

    if (options.closeButton) {
      var closeButton = $(templates.closeButton);

      if (options.title) {
        dialog.find(".modal-header").prepend(closeButton);
      } else {
        closeButton.css("margin-top", "-2px").prependTo(body);
      }
    }

    if (options.title) {
      dialog.find(".modal-title").html(options.title);
    }

    if (buttonStr.length) {
      body.after(templates.footer);
      dialog.find(".modal-footer").html(buttonStr);
    }


    /**
     * Bootstrap event listeners; these handle extra
     * setup & teardown required after the underlying
     * modal has performed certain actions
     */

    // make sure we unbind any listeners once the dialog has definitively been dismissed
    dialog.one("hide.bs.modal", function() {
      dialog.off("escape.close.bb");
      dialog.off("click");
    });

    dialog.one("hidden.bs.modal", function(e) {
      // ensure we don't accidentally intercept hidden events triggered
      // by children of the current dialog. We shouldn't anymore now BS
      // namespaces its events; but still worth doing
      if (e.target === this) {
        dialog.remove();
      }
    });

    /*
    dialog.on("show.bs.modal", function() {
      // sadly this doesn't work; show is called *just* before
      // the backdrop is added so we'd need a setTimeout hack or
      // otherwise... leaving in as would be nice
      if (options.backdrop) {
        dialog.next(".modal-backdrop").addClass("bootbox-backdrop");
      }
    });
    */

    dialog.one("shown.bs.modal", function() {
      dialog.find(".btn-primary:first").focus();
    });

    /**
     * Bootbox event listeners; used to decouple some
     * behaviours from their respective triggers
     */

    if (options.backdrop !== "static") {
      // A boolean true/false according to the Bootstrap docs
      // should show a dialog the user can dismiss by clicking on
      // the background.
      // We always only ever pass static/false to the actual
      // $.modal function because with `true` we can't trap
      // this event (the .modal-backdrop swallows it)
      // However, we still want to sort of respect true
      // and invoke the escape mechanism instead
      dialog.on("click.dismiss.bs.modal", function(e) {
        // @NOTE: the target varies in >= 3.3.x releases since the modal backdrop
        // moved *inside* the outer dialog rather than *alongside* it
        if (dialog.children(".modal-backdrop").length) {
          e.currentTarget = dialog.children(".modal-backdrop").get(0);
        }

        if (e.target !== e.currentTarget) {
          return;
        }

        dialog.trigger("escape.close.bb");
      });
    }

    dialog.on("escape.close.bb", function(e) {
      // the if statement looks redundant but it isn't; without it
      // if we *didn't* have an onEscape handler then processCallback
      // would automatically dismiss the dialog
      if (callbacks.onEscape) {
        processCallback(e, dialog, callbacks.onEscape);
      }
    });

    /**
     * Standard jQuery event listeners; used to handle user
     * interaction with our dialog
     */

    dialog.on("click", ".modal-footer button", function(e) {
      var callbackKey = $(this).data("bb-handler");

      processCallback(e, dialog, callbacks[callbackKey]);
    });

    dialog.on("click", ".bootbox-close-button", function(e) {
      // onEscape might be falsy but that's fine; the fact is
      // if the user has managed to click the close button we
      // have to close the dialog, callback or not
      processCallback(e, dialog, callbacks.onEscape);
    });

    dialog.on("keyup", function(e) {
      if (e.which === 27) {
        dialog.trigger("escape.close.bb");
      }
    });

    if (!options.propagateKeys) {
      dialog.on("keypress", function(e) {
        e.stopPropagation();
      });
      dialog.on("keyup", function(e) {
        e.stopPropagation();
      });
      dialog.on("keydown", function(e) {
        e.stopPropagation();
      });
    }

    // the remainder of this method simply deals with adding our
    // dialog to the DOM, augmenting it with Bootstrap's modal
    // functionality and then giving the resulting object back
    // to our caller

    $(options.container).append(dialog);

    dialog.modal({
      backdrop: options.backdrop ? "static": false,
      keyboard: false,
      show: false
    });

    if (options.show) {
      dialog.modal("show");
    }

    // @TODO should we return the raw element here or should
    // we wrap it in an object on which we can expose some neater
    // methods, e.g. var d = bootbox.alert(); d.hide(); instead
    // of d.modal("hide");

   /*
    function BBDialog(elem) {
      this.elem = elem;
    }

    BBDialog.prototype = {
      hide: function() {
        return this.elem.modal("hide");
      },
      show: function() {
        return this.elem.modal("show");
      }
    };
    */

    return dialog;

  };

  exports.setDefaults = function() {
    var values = {};

    if (arguments.length === 2) {
      // allow passing of single key/value...
      values[arguments[0]] = arguments[1];
    } else {
      // ... and as an object too
      values = arguments[0];
    }

    $.extend(defaults, values);
  };

  exports.hideAll = function() {
    $(".bootbox").modal("hide");

    return exports;
  };


  /**
   * standard locales. Please add more according to ISO 639-1 standard. Multiple language variants are
   * unlikely to be required. If this gets too large it can be split out into separate JS files.
   */
  var locales = {
    ar : {
      OK      : "موافق",
      CANCEL  : "الغاء",
      CONFIRM : "تأكيد"
    },
    bg_BG : {
      OK      : "Ок",
      CANCEL  : "Отказ",
      CONFIRM : "Потвърждавам"
    },
    br : {
      OK      : "OK",
      CANCEL  : "Cancelar",
      CONFIRM : "Sim"
    },
    cs : {
      OK      : "OK",
      CANCEL  : "Zrušit",
      CONFIRM : "Potvrdit"
    },
    da : {
      OK      : "OK",
      CANCEL  : "Annuller",
      CONFIRM : "Accepter"
    },
    de : {
      OK      : "OK",
      CANCEL  : "Abbrechen",
      CONFIRM : "Akzeptieren"
    },
    el : {
      OK      : "Εντάξει",
      CANCEL  : "Ακύρωση",
      CONFIRM : "Επιβεβαίωση"
    },
    en : {
      OK      : "OK",
      CANCEL  : "Cancel",
      CONFIRM : "OK"
    },
    es : {
      OK      : "OK",
      CANCEL  : "Cancelar",
      CONFIRM : "Aceptar"
    },
    eu : {
      OK      : "OK",
      CANCEL  : "Ezeztatu",
      CONFIRM : "Onartu"
    },
    et : {
      OK      : "OK",
      CANCEL  : "Katkesta",
      CONFIRM : "OK"
    },
    fa : {
      OK      : "قبول",
      CANCEL  : "لغو",
      CONFIRM : "تایید"
    },
    fi : {
      OK      : "OK",
      CANCEL  : "Peruuta",
      CONFIRM : "OK"
    },
    fr : {
      OK      : "OK",
      CANCEL  : "Annuler",
      CONFIRM : "Confirmer"
    },
    he : {
      OK      : "אישור",
      CANCEL  : "ביטול",
      CONFIRM : "אישור"
    },
    hu : {
      OK      : "OK",
      CANCEL  : "Mégsem",
      CONFIRM : "Megerősít"
    },
    hr : {
      OK      : "OK",
      CANCEL  : "Odustani",
      CONFIRM : "Potvrdi"
    },
    id : {
      OK      : "OK",
      CANCEL  : "Batal",
      CONFIRM : "OK"
    },
    it : {
      OK      : "OK",
      CANCEL  : "Annulla",
      CONFIRM : "Conferma"
    },
    ja : {
      OK      : "OK",
      CANCEL  : "キャンセル",
      CONFIRM : "確認"
    },
    lt : {
      OK      : "Gerai",
      CANCEL  : "Atšaukti",
      CONFIRM : "Patvirtinti"
    },
    lv : {
      OK      : "Labi",
      CANCEL  : "Atcelt",
      CONFIRM : "Apstiprināt"
    },
    nl : {
      OK      : "OK",
      CANCEL  : "Annuleren",
      CONFIRM : "Accepteren"
    },
    no : {
      OK      : "OK",
      CANCEL  : "Avbryt",
      CONFIRM : "OK"
    },
    pl : {
      OK      : "OK",
      CANCEL  : "Anuluj",
      CONFIRM : "Potwierdź"
    },
    pt : {
      OK      : "OK",
      CANCEL  : "Cancelar",
      CONFIRM : "Confirmar"
    },
    ru : {
      OK      : "OK",
      CANCEL  : "Отмена",
      CONFIRM : "Применить"
    },
    sk : {
      OK      : "OK",
      CANCEL  : "Zrušiť",
      CONFIRM : "Potvrdiť"
    },
    sl : {
      OK : "OK",
      CANCEL : "Prekliči",
      CONFIRM : "Potrdi"
    },
    sq : {
      OK : "OK",
      CANCEL : "Anulo",
      CONFIRM : "Prano"
    },
    sv : {
      OK      : "OK",
      CANCEL  : "Avbryt",
      CONFIRM : "OK"
    },
    th : {
      OK      : "ตกลง",
      CANCEL  : "ยกเลิก",
      CONFIRM : "ยืนยัน"
    },
    tr : {
      OK      : "Tamam",
      CANCEL  : "İptal",
      CONFIRM : "Onayla"
    },
    zh_CN : {
      OK      : "OK",
      CANCEL  : "取消",
      CONFIRM : "确认"
    },
    zh_TW : {
      OK      : "OK",
      CANCEL  : "取消",
      CONFIRM : "確認"
    }
  };

  exports.addLocale = function(name, values) {
    $.each(["OK", "CANCEL", "CONFIRM"], function(_, v) {
      if (!values[v]) {
        throw new Error("Please supply a translation for '" + v + "'");
      }
    });

    locales[name] = {
      OK: values.OK,
      CANCEL: values.CANCEL,
      CONFIRM: values.CONFIRM
    };

    return exports;
  };

  exports.removeLocale = function(name) {
    delete locales[name];

    return exports;
  };

  exports.setLocale = function(name) {
    return exports.setDefaults("locale", name);
  };

  exports.init = function(_$) {
    return init(_$ || $);
  };

  return exports;
}));
