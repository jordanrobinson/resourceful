/*
 * Copyright (C) 2007-2012 Diego Perini
 * All rights reserved.
 *
 * nwmatcher.js - A fast CSS selector engine and matcher
 *
 * Author: Diego Perini <diego.perini at gmail com>
 * Version: 1.2.5
 * Created: 20070722
 * Release: 20120101
 *
 * License:
 *  http://javascript.nwbox.com/NWMatcher/MIT-LICENSE
 * Download:
 *  http://javascript.nwbox.com/NWMatcher/nwmatcher.js
 */

(function(global) {

  var version = 'nwmatcher-1.2.5',

  // export the public API for CommonJS implementations,
  // for headless JS engines or for standard web browsers
  Dom =
    // as CommonJS/NodeJS module
    typeof exports == 'object' ? exports :
    // create or extend NW namespace
    ((global.NW || (global.NW = { })) &&
    (global.NW.Dom || (global.NW.Dom = { }))),

  // processing context & root element
  doc = global.document,
  root = doc.documentElement,

  // save utility methods references
  slice = [ ].slice,
  string = { }.toString,

  // persist previous parsed data
  isSingleMatch,
  isSingleSelect,

  lastSlice,
  lastContext,
  lastPosition,

  lastMatcher,
  lastSelector,

  lastPartsMatch,
  lastPartsSelect,

  // accepted prefix identifiers
  // (id, class & pseudo-class)
  prefixes = '[#.:]?',

  // accepted attribute operators
  operators = '([~*^$|!]?={1})',

  // accepted whitespace characters
  whitespace = '[\\x20\\t\\n\\r\\f]*',

  // 4 combinators F E, F>E, F+E, F~E
  combinators = '[\\x20]|[>+~][^>+~]',

  // an+b format params for pseudo-classes
  pseudoparms = '[-+]?\\d*n?[-+]?\\d*',

  // CSS quoted string values
  quotedvalue = '"[^"]*"' + "|'[^']*'",

  // skip group of round brackets
  skipround = '\\([^()]+\\)|\\(.*\\)',
  // skip group of curly brackets
  skipcurly = '\\{[^{}]+\\}|\\{.*\\}',
  // skip group of square brackets
  skipsquare = '\\[[^[\\]]*\\]|\\[.*\\]',

  // skip [ ], ( ), { } groups in token tails
  skipgroup = '\\[.*\\]|\\(.*\\)|\\{.*\\}',

  // http://www.w3.org/TR/css3-syntax/#characters
  // unicode/ISO 10646 characters 161 and higher
  // NOTE: Safari 2.0.x crashes with escaped (\\)
  // Unicode ranges in regular expressions so we
  // use a negated character range class instead
  encoding = '(?:[-\\w]|[^\\x00-\\xa0]|\\\\.)',

  // CSS identifier syntax
  identifier = '(?:-?[_a-zA-Z]{1}[-\\w]*|[^\\x00-\\xa0]+|\\\\.+)+',

  // build attribute string
  attrcheck = '(' + quotedvalue + '|' + identifier + ')',
  attributes = whitespace + '(' + encoding + '+:?' + encoding + '+)' +
    whitespace + '(?:' + operators + whitespace + attrcheck + ')?' + whitespace,
  attrmatcher = attributes.replace(attrcheck, '([\\x22\\x27]*)((?:\\\\?.)*?)\\3'),

  // build pseudoclass string
  pseudoclass = '((?:' +
    // an+b parameters or quoted string
    pseudoparms + '|' + quotedvalue + '|' +
    // id, class, pseudo-class selector
    prefixes + '|' + encoding + '+|' +
    // nested HTML attribute selector
    '\\[' + attributes + '\\]|' +
    // nested pseudo-class selector
    '\\(.+\\)|' + whitespace + '|' +
    // nested pseudos/separators
    ',)+)',

  // placeholder for extensions
  extensions = '.+',

  // CSS3: syntax scanner and
  // one pass validation only
  // using regular expression
  standardValidator =
    // discard start
    '(?=[\\x20\\t\\n\\r\\f]*[^>+~(){}<>])' +
    // open match group
    '(' +
    //universal selector
    '\\*' +
    // id/class/tag/pseudo-class identifier
    '|(?:' + prefixes + identifier + ')' +
    // combinator selector
    '|' + combinators +
    // HTML attribute selector
    '|\\[' + attributes + '\\]' +
    // pseudo-classes parameters
    '|\\(' + pseudoclass + '\\)' +
    // dom properties selector (extension)
    '|\\{' + extensions + '\\}' +
    // selector group separator (comma)
    '|,' +
    // close match group
    ')+',

  // validator for complex selectors in ':not()' pseudo-classes
  extendedValidator = standardValidator.replace(pseudoclass, '.*'),

  // validator for standard selectors as default
  reValidator = new RegExp(standardValidator, 'g'),

  // whitespace is any combination of these 5 character [\x20\t\n\r\f]
  // http://www.w3.org/TR/css3-selectors/#selector-syntax
  reTrimSpaces = new RegExp('^' +
    whitespace + '|' + whitespace + '$', 'g'),

  // only allow simple selectors nested in ':not()' pseudo-classes
  reSimpleNot = new RegExp('^(' +
    '(?!:not)' +
    '(' + prefixes +
    '|' + identifier +
    '|\\([^()]*\\))+' +
    '|\\[' + attributes + '\\]' +
    ')$'),

  // split comma groups, exclude commas from
  // quotes '' "" and from brackets () [] {}
  reSplitGroup = new RegExp('(' +
    '[^,\\\\\\[\\]]+' +
    '|' + skipsquare +
    '|' + skipround +
    '|' + skipcurly +
    '|\\\\.' +
    ')+', 'g'),

  // split last, right most, selector group token
  reSplitToken = new RegExp('(' +
    '\\[' + attributes + '\\]|' +
    '\\(' + pseudoclass + '\\)|' +
    '[^\\x20>+~]|\\\\.)+', 'g'),

  // for in excess whitespace removal
  reWhiteSpace = /[\x20\t\n\r\f]+/g,

  reOptimizeSelector = new RegExp(identifier + '|^$'),

  /*----------------------------- FEATURE TESTING ----------------------------*/

  // detect native methods
  isNative = (function() {
    var s = (doc.appendChild + '').replace(/appendChild/g, '');
    return function(object, method) {
      var m = object && object[method] || false;
      return m && typeof m != 'string' &&
        s == (m + '').replace(new RegExp(method, 'g'), '');
    };
  })(),

  // NATIVE_XXXXX true if method exist and is callable
  // detect if DOM methods are native in browsers
  NATIVE_FOCUS = isNative(doc, 'hasFocus'),
  NATIVE_QSAPI = isNative(doc, 'querySelector'),
  NATIVE_GEBID = isNative(doc, 'getElementById'),
  NATIVE_GEBTN = isNative(root, 'getElementsByTagName'),
  NATIVE_GEBCN = isNative(root, 'getElementsByClassName'),

  // detect native getAttribute/hasAttribute methods,
  // frameworks extend these to elements, but it seems
  // this does not work for XML namespaced attributes,
  // used to check both getAttribute/hasAttribute in IE
  NATIVE_GET_ATTRIBUTE = isNative(root, 'getAttribute'),
  NATIVE_HAS_ATTRIBUTE = isNative(root, 'hasAttribute'),

  // check if slice() can convert nodelist to array
  // see http://yura.thinkweb2.com/cft/
  NATIVE_SLICE_PROTO =
    (function() {
      var isBuggy = false, id = root.id;
      root.id = 'length';
      try {
        isBuggy = !!slice.call(doc.childNodes, 0)[0];
      } catch(e) { }
      root.id = id;
      return isBuggy;
    })(),

  // supports the new traversal API
  NATIVE_TRAVERSAL_API =
    'nextElementSibling' in root && 'previousElementSibling' in root,

  // BUGGY_XXXXX true if method is feature tested and has known bugs
  // detect buggy gEBID
  BUGGY_GEBID = NATIVE_GEBID ?
    (function() {
      var isBuggy = true, x = 'x' + String(+new Date),
        a = doc.createElementNS ? 'a' : '<a name="' + x + '">';
      (a = doc.createElement(a)).name = x;
      root.insertBefore(a, root.firstChild);
      isBuggy = !!doc.getElementById(x);
      root.removeChild(a);
      return isBuggy;
    })() :
    true,

  // detect IE gEBTN comment nodes bug
  BUGGY_GEBTN = NATIVE_GEBTN ?
    (function() {
      var div = doc.createElement('div');
      div.appendChild(doc.createComment(''));
      return !!div.getElementsByTagName('*')[0];
    })() :
    true,

  // detect Opera gEBCN second class and/or UTF8 bugs as well as Safari 3.2
  // caching class name results and not detecting when changed,
  // tests are based on the jQuery selector test suite
  BUGGY_GEBCN = NATIVE_GEBCN ?
    (function() {
      var isBuggy, div = doc.createElement('div'), test = '\u53f0\u5317';

      // Opera tests
      div.appendChild(doc.createElement('span')).
        setAttribute('class', test + 'abc ' + test);
      div.appendChild(doc.createElement('span')).
        setAttribute('class', 'x');

      isBuggy = !div.getElementsByClassName(test)[0];

      // Safari test
      div.lastChild.className = test;
      return isBuggy || div.getElementsByClassName(test).length != 2;
    })() :
    true,

  // detect IE bug with dynamic attributes
  BUGGY_GET_ATTRIBUTE = NATIVE_GET_ATTRIBUTE ?
    (function() {
      var input = doc.createElement('input');
      input.setAttribute('value', 5);
      return input.defaultValue != 5;
    })() :
    true,

  // detect IE bug with non-standard boolean attributes
  BUGGY_HAS_ATTRIBUTE = NATIVE_HAS_ATTRIBUTE ?
    (function() {
      var option = doc.createElement('option');
      option.setAttribute('selected', 'selected');
      return !option.hasAttribute('selected');
    })() :
    true,

  // detect Safari bug with selected option elements
  BUGGY_SELECTED =
    (function() {
      var select = doc.createElement('select');
      select.appendChild(doc.createElement('option'));
      return !select.firstChild.selected;
    })(),

  // initialized with the loading context
  // and reset for each different context
  BUGGY_QUIRKS_GEBCN,
  BUGGY_QUIRKS_QSAPI,

  QUIRKS_MODE,
  XML_DOCUMENT,

  // detect Opera browser
  OPERA = /opera/i.test(string.call(global.opera)),

  // skip simpe selector optimizations for Opera >= 11
  OPERA_QSAPI = OPERA && parseFloat(opera.version()) >= 11,

  // check Seletor API implementations
  RE_BUGGY_QSAPI = NATIVE_QSAPI ?
    (function() {
      var pattern = [ ], div = doc.createElement('div'), element,

      expect = function(selector, context, element, n) {
        var result = false;
        context.appendChild(element);
        try { result = context.querySelectorAll(selector).length == n; } catch(e) { }
        while (context.firstChild) { context.removeChild(context.firstChild); }
        return result;
      };

      // ^= $= *= operators bugs whith empty values (Opera 10 / IE8)
      element = doc.createElement('p');
      element.setAttribute('class', '');
      expect('[class^=""]', div, element, 1) &&
        pattern.push('[*^$]=[\\x20\\t\\n\\r\\f]*(?:""|' + "'')");

      // :checked bug with option elements (Firefox 3.6.x)
      // it wrongly includes 'selected' options elements
      // HTML5 rules says selected options also match
      element = doc.createElement('option');
      element.setAttribute('selected', 'selected');
      expect(':checked', div, element, 0) &&
        pattern.push(':checked');

      // :enabled :disabled bugs with hidden fields (Firefox 3.5 QSA bug)
      // http://www.w3.org/TR/html5/interactive-elements.html#selector-enabled
      // IE8 QSA has problems too and throws error with these dynamic pseudos
      element = doc.createElement('input');
      element.setAttribute('type', 'hidden');
      expect(':enabled', div, element, 1) &&
        pattern.push(':enabled', ':disabled');

      // :link bugs with hyperlinks matching (Firefox/Safari)
      element = doc.createElement('link');
      element.setAttribute('href', 'x');
      expect(':link', div, element, 1) ||
        pattern.push(':link');

      // avoid attribute selectors for IE QSA
      if (BUGGY_HAS_ATTRIBUTE) {
        // IE fails in reading:
        // - original values for input/textarea
        // - original boolean values for controls
        pattern.push('\\[[\\x20\\t\\n\\r\\f]*(?:checked|disabled|ismap|multiple|readonly|selected|value)');
      }

      return pattern.length ?
        new RegExp(pattern.join('|')) :
        { 'test': function() { return false; } };

    })() :
    true,

  // matches class selectors
  RE_CLASS = new RegExp('(?:\\[[\\x20\\t\\n\\r\\f]*class\\b|\\.' + identifier + ')'),

  // matches simple id, tag & class selectors
  RE_SIMPLE_SELECTOR = new RegExp(
    !(BUGGY_GEBTN && BUGGY_GEBCN) ? !OPERA ?
      '^(?:\\*|[.#]?-?[_a-zA-Z]{1}' + encoding + '*)$' :
      '^(?:\\*|#-?[_a-zA-Z]{1}' + encoding + '*)$' :
      '^#?-?[_a-zA-Z]{1}' + encoding + '*$'),

  /*----------------------------- LOOKUP OBJECTS -----------------------------*/

  LINK_NODES = { 'a': 1, 'A': 1, 'area': 1, 'AREA': 1, 'link': 1, 'LINK': 1 },

  // boolean attributes should return attribute name instead of true/false
  ATTR_BOOLEAN = {
    'checked': 1, 'disabled': 1, 'ismap': 1,
    'multiple': 1, 'readonly': 1, 'selected': 1
  },

  // dynamic attributes that needs to be checked against original HTML value
  ATTR_DEFAULT = {
    value: 'defaultValue',
    checked: 'defaultChecked',
    selected: 'defaultSelected'
  },

  // attribute referencing URI data values need special treatment in IE
  ATTR_URIDATA = {
    'action': 2, 'cite': 2, 'codebase': 2, 'data': 2, 'href': 2,
    'longdesc': 2, 'lowsrc': 2, 'src': 2, 'usemap': 2
  },

  // HTML 5 draft specifications
  // http://www.whatwg.org/specs/web-apps/current-work/#selectors
  HTML_TABLE = {
    // class attribute must be treated case-insensitive in HTML quirks mode
    // initialized by default to Standard Mode (case-sensitive),
    // set dynamically by the attribute resolver
    'class': 0,
    'accept': 1, 'accept-charset': 1, 'align': 1, 'alink': 1, 'axis': 1,
    'bgcolor': 1, 'charset': 1, 'checked': 1, 'clear': 1, 'codetype': 1, 'color': 1,
    'compact': 1, 'declare': 1, 'defer': 1, 'dir': 1, 'direction': 1, 'disabled': 1,
    'enctype': 1, 'face': 1, 'frame': 1, 'hreflang': 1, 'http-equiv': 1, 'lang': 1,
    'language': 1, 'link': 1, 'media': 1, 'method': 1, 'multiple': 1, 'nohref': 1,
    'noresize': 1, 'noshade': 1, 'nowrap': 1, 'readonly': 1, 'rel': 1, 'rev': 1,
    'rules': 1, 'scope': 1, 'scrolling': 1, 'selected': 1, 'shape': 1, 'target': 1,
    'text': 1, 'type': 1, 'valign': 1, 'valuetype': 1, 'vlink': 1
  },

  // the following attributes must be treated case-insensitive in XHTML mode
  // Niels Leenheer http://rakaz.nl/item/css_selector_bugs_case_sensitivity
  XHTML_TABLE = {
    'accept': 1, 'accept-charset': 1, 'alink': 1, 'axis': 1,
    'bgcolor': 1, 'charset': 1, 'codetype': 1, 'color': 1,
    'enctype': 1, 'face': 1, 'hreflang': 1, 'http-equiv': 1,
    'lang': 1, 'language': 1, 'link': 1, 'media': 1, 'rel': 1,
    'rev': 1, 'target': 1, 'text': 1, 'type': 1, 'vlink': 1
  },

  /*-------------------------- REGULAR EXPRESSIONS ---------------------------*/

  // placeholder to add functionalities
  Selectors = {
    // as a simple example this will check
    // for chars not in standard ascii table
    //
    // 'mySpecialSelector': {
    //  'Expression': /\u0080-\uffff/,
    //  'Callback': mySelectorCallback
    // }
    //
    // 'mySelectorCallback' will be invoked
    // only after passing all other standard
    // checks and only if none of them worked
  },

  // attribute operators
  Operators = {
     '=': "n=='%m'",
    '^=': "n.indexOf('%m')==0",
    '*=': "n.indexOf('%m')>-1",
    '|=': "(n+'-').indexOf('%m-')==0",
    '~=': "(' '+n+' ').indexOf(' %m ')>-1",
    '$=': "n.substr(n.length-'%m'.length)=='%m'"
  },

  // optimization expressions
  Optimize = {
    ID: new RegExp('^\\*?#(' + encoding + '+)|' + skipgroup),
    TAG: new RegExp('^(' + encoding + '+)|' + skipgroup),
    CLASS: new RegExp('^\\*?\\.(' + encoding + '+$)|' + skipgroup)
  },

  // precompiled Regular Expressions
  Patterns = {
    // structural pseudo-classes and child selectors
    spseudos: /^\:((root|empty|nth-)?(?:(first|last|only)-)?(child)?-?(of-type)?)(?:\(([^\x29]*)\))?(.*)/,
    // uistates + dynamic + negation pseudo-classes
    dpseudos: /^\:(link|visited|target|lang|not|active|focus|hover|checked|disabled|enabled|selected)(?:\((["']*)(.*?(\(.*\))?[^'"()]*?)\2\))?(.*)/,
    // element attribute matcher
    attribute: new RegExp('^\\[' + attrmatcher + '\\](.*)'),
    // E > F
    children: /^[\x20\t\n\r\f]*\>[\x20\t\n\r\f]*(.*)/,
    // E + F
    adjacent: /^[\x20\t\n\r\f]*\+[\x20\t\n\r\f]*(.*)/,
    // E ~ F
    relative: /^[\x20\t\n\r\f]*\~[\x20\t\n\r\f]*(.*)/,
    // E F
    ancestor: /^[\x20\t\n\r\f]+(.*)/,
    // all
    universal: /^\*(.*)/,
    // id
    id: new RegExp('^#(' + encoding + '+)(.*)'),
    // tag
    tagName: new RegExp('^(' + encoding + '+)(.*)'),
    // class
    className: new RegExp('^\\.(' + encoding + '+)(.*)')
  },

  /*------------------------------ UTIL METHODS ------------------------------*/

  // concat elements to data
  concatList =
    function(data, elements) {
      var i = -1, element;
      if (!data.length && Array.slice)
        return Array.slice(elements);
      while ((element = elements[++i]))
        data[data.length] = element;
      return data;
    },

  // concat elements to data and callback
  concatCall =
    function(data, elements, callback) {
      var i = -1, element;
      while ((element = elements[++i])) {
        if (false === callback(data[data.length] = element)) { break; }
      }
      return data;
    },

  // change context specific variables
  switchContext =
    function(from, force) {
      var div, oldDoc = doc;
      // save passed context
      lastContext = from;
      // set new context document
      doc = from.ownerDocument || from;
      if (force || oldDoc !== doc) {
        // set document root
        root = doc.documentElement;
        // set host environment flags
        XML_DOCUMENT = doc.createElement('DiV').nodeName == 'DiV';

        // In quirks mode css class names are case insensitive.
        // In standards mode they are case sensitive. See docs:
        // https://developer.mozilla.org/en/Mozilla_Quirks_Mode_Behavior
        // http://www.whatwg.org/specs/web-apps/current-work/#selectors
        QUIRKS_MODE = !XML_DOCUMENT &&
          typeof doc.compatMode == 'string' ?
          doc.compatMode.indexOf('CSS') < 0 :
          (function() {
            var style = doc.createElement('div').style;
            return style && (style.width = 1) && style.width == '1px';
          })();

        div = doc.createElement('div');
        div.appendChild(doc.createElement('p')).setAttribute('class', 'xXx');
        div.appendChild(doc.createElement('p')).setAttribute('class', 'xxx');

        // GEBCN buggy in quirks mode, match count is:
        // Firefox 3.0+ [xxx = 1, xXx = 1]
        // Opera 10.63+ [xxx = 0, xXx = 2]
        BUGGY_QUIRKS_GEBCN =
          !XML_DOCUMENT && NATIVE_GEBCN && QUIRKS_MODE &&
          (div.getElementsByClassName('xxx').length != 2 ||
          div.getElementsByClassName('xXx').length != 2);

        // QSAPI buggy in quirks mode, match count is:
        // At least Chrome 4+, Firefox 3.5+, Opera 10.x+, Safari 4+ [xxx = 1, xXx = 2]
        // Safari 3.2 QSA doesn't work with mixedcase in quirksmode [xxx = 1, xXx = 0]
        // https://bugs.webkit.org/show_bug.cgi?id=19047
        // must test the attribute selector '[class~=xxx]'
        // before '.xXx' or the bug may not present itself
        BUGGY_QUIRKS_QSAPI =
          !XML_DOCUMENT && NATIVE_QSAPI && QUIRKS_MODE &&
          (div.querySelectorAll('[class~=xxx]').length != 2 ||
          div.querySelectorAll('.xXx').length != 2);

        Config.CACHING && Dom.setCache(true, doc);
      }
    },

  /*------------------------------ DOM METHODS -------------------------------*/

  // element by id (raw)
  // @return reference or null
  byIdRaw =
    function(id, elements) {
      var i = -1, element = null;
      while ((element = elements[++i])) {
        if (element.getAttribute('id') == id) {
          break;
        }
      }
      return element;
    },

  // element by id
  // @return reference or null
  _byId = !BUGGY_GEBID ?
    function(id, from) {
      id = id.replace(/\\/g, '');
      return from.getElementById && from.getElementById(id) ||
        byIdRaw(id, from.getElementsByTagName('*'));
    } :
    function(id, from) {
      var element = null;
      id = id.replace(/\\/g, '');
      if (XML_DOCUMENT || from.nodeType != 9) {
        return byIdRaw(id, from.getElementsByTagName('*'));
      }
      if ((element = from.getElementById(id)) &&
        element.name == id && from.getElementsByName) {
        return byIdRaw(id, from.getElementsByName(id));
      }
      return element;
    },

  // publicly exposed byId
  // @return reference or null
  byId =
    function(id, from) {
      switchContext(from || (from = doc));
      return _byId(id, from);
    },

  // elements by tag (raw)
  // @return array
  byTagRaw =
    function(tag, from) {
      var any = tag == '*', element = from, elements = [ ], next = element.firstChild;
      any || (tag = tag.toUpperCase());
      while ((element = next)) {
        if (element.tagName > '@' && (any || element.tagName.toUpperCase() == tag)) {
          elements[elements.length] = element;
        }
        if ((next = element.firstChild || element.nextSibling)) continue;
        while (!next && (element = element.parentNode) && element !== from) {
          next = element.nextSibling;
        }
      }
      return elements;
    },

  // elements by tag
  // @return array
  _byTag = !BUGGY_GEBTN && NATIVE_SLICE_PROTO ?
    function(tag, from) {
      return XML_DOCUMENT || from.nodeType == 11 ? byTagRaw(tag, from) :
        slice.call(from.getElementsByTagName(tag), 0);
    } :
    function(tag, from) {
      var i = -1, j = i, data = [ ],
        element, elements = from.getElementsByTagName(tag);
      if (tag == '*') {
        while ((element = elements[++i])) {
          if (element.nodeName > '@')
            data[++j] = element;
        }
      } else {
        while ((element = elements[++i])) {
          data[i] = element;
        }
      }
      return data;
    },

  // publicly exposed byTag
  // @return array
  byTag =
    function(tag, from) {
      switchContext(from || (from = doc));
      return _byTag(tag, from);
    },

  // publicly exposed byName
  // @return array
  byName =
    function(name, from) {
      return select('[name="' + name.replace(/\\/g, '') + '"]', from);
    },

  // elements by class (raw)
  // @return array
  byClassRaw =
    function(name, from) {
      var i = -1, j = i, data = [ ], element, elements = _byTag('*', from), n;
      name = ' ' + (QUIRKS_MODE ? name.toLowerCase() : name).replace(/\\/g, '') + ' ';
      while ((element = elements[++i])) {
        n = XML_DOCUMENT ? element.getAttribute('class') : element.className;
        if (n && n.length && (' ' + (QUIRKS_MODE ? n.toLowerCase() : n).
          replace(reWhiteSpace, ' ') + ' ').indexOf(name) > -1) {
          data[++j] = element;
        }
      }
      return data;
    },

  // elements by class
  // @return array
  _byClass =
    function(name, from) {
      return (BUGGY_GEBCN || BUGGY_QUIRKS_GEBCN || XML_DOCUMENT || !from.getElementsByClassName) ?
        byClassRaw(name, from) : slice.call(from.getElementsByClassName(name.replace(/\\/g, '')), 0);
    },

  // publicly exposed byClass
  // @return array
  byClass =
    function(name, from) {
      switchContext(from || (from = doc));
      return _byClass(name, from);
    },

  // check element is descendant of container
  // @return boolean
  contains = 'compareDocumentPosition' in root ?
    function(container, element) {
      return (container.compareDocumentPosition(element) & 16) == 16;
    } : 'contains' in root ?
    function(container, element) {
      return container !== element && container.contains(element);
    } :
    function(container, element) {
      while ((element = element.parentNode)) {
        if (element === container) return true;
      }
      return false;
    },

  // attribute value
  // @return string
  getAttribute = !BUGGY_GET_ATTRIBUTE ?
    function(node, attribute) {
      return node.getAttribute(attribute) || '';
    } :
    function(node, attribute) {
      attribute = attribute.toLowerCase();
      if (ATTR_DEFAULT[attribute]) {
        return node[ATTR_DEFAULT[attribute]] || '';
      }
      return (
        // specific URI data attributes (parameter 2 to fix IE bug)
        ATTR_URIDATA[attribute] ? node.getAttribute(attribute, 2) || '' :
        // boolean attributes should return name instead of true/false
        ATTR_BOOLEAN[attribute] ? node.getAttribute(attribute) ? attribute : '' :
          ((node = node.getAttributeNode(attribute)) && node.value) || '');
    },

  // attribute presence
  // @return boolean
  hasAttribute = !BUGGY_HAS_ATTRIBUTE ?
    function(node, attribute) {
      return XML_DOCUMENT ?
        !!node.getAttribute(attribute) :
        node.hasAttribute(attribute);
    } :
    function(node, attribute) {
      attribute = attribute.toLowerCase();
      if (ATTR_DEFAULT[attribute]) {
        return !!node[ATTR_DEFAULT[attribute]];
      }
      // need to get at AttributeNode first on IE
      node = node.getAttributeNode(attribute);
      // use both "specified" & "nodeValue" properties
      return !!(node && (node.specified || node.nodeValue));
    },

  // check node emptyness
  // @return boolean
  isEmpty =
    function(node) {
      node = node.firstChild;
      while (node) {
        if (node.nodeType == 3 || node.nodeName > '@') return false;
        node = node.nextSibling;
      }
      return true;
    },

  // check if element matches the :link pseudo
  // @return boolean
  isLink =
    function(element) {
      return hasAttribute(element,'href') && LINK_NODES[element.nodeName];
    },

  // child position by nodeType
  // @return number
  nthElement =
    function(element, last) {
      var count = 1, succ = last ? 'nextSibling' : 'previousSibling';
      while ((element = element[succ])) {
        if (element.nodeName > '@') ++count;
      }
      return count;
    },

  // child position by nodeName
  // @return number
  nthOfType =
    function(element, last) {
      var count = 1, succ = last ? 'nextSibling' : 'previousSibling', type = element.nodeName;
      while ((element = element[succ])) {
        if (element.nodeName == type) ++count;
      }
      return count;
    },

  /*------------------------------- DEBUGGING --------------------------------*/

  // set working mode
  configure =
    function(options) {
      for (var i in options) {
        Config[i] = !!options[i];
        if (i == 'SIMPLENOT') {
          matchContexts = { };
          matchResolvers = { };
          selectContexts = { };
          selectResolvers = { };
          Config['USE_QSAPI'] = false;
          reValidator = new RegExp(extendedValidator, 'g');
        } else if (i == 'USE_QSAPI') {
          Config[i] = !!options[i] && NATIVE_QSAPI;
          reValidator = new RegExp(standardValidator, 'g');
        }
      }
    },

  // control user notifications
  emit =
    function(message) {
      message = 'SYNTAX_ERR: ' + message + ' ';
      if (Config.VERBOSITY) {
        // FF/Safari/Opera DOMException.SYNTAX_ERR = 12
        if (typeof global.DOMException != 'undefined') {
          throw { code: 12, message: message };
        } else {
          throw new Error(12, message);
        }
      } else {
        if (global.console && global.console.log) {
          global.console.log(message);
        } else {
          global.status += message;
        }
      }
    },

  Config = {

    // used to enable/disable caching of result sets
    CACHING: false,

    // by default do not add missing left/right context
    // to selector string shortcuts like "+div" or "ul>"
    // callable Dom.shortcuts method has to be available
    SHORTCUTS: false,

    // by default disable complex selectors nested in
    // ':not()' pseudo-classes, as for specifications
    SIMPLENOT: true,

    // HTML5 handling for the ":checked" pseudo-class
    USE_HTML5: false,

    // controls enabling the Query Selector API branch
    USE_QSAPI: NATIVE_QSAPI,

    // controls the engine error/warning notifications
    VERBOSITY: true

  },

  /*---------------------------- COMPILER METHODS ----------------------------*/

  // code string reused to build compiled functions
  ACCEPT_NODE = 'r[r.length]=c[k];if(f&&false===f(c[k]))break;else continue main;',

  // compile a comma separated group of selector
  // @mode boolean true for select, false for match
  // return a compiled function
  compile =
    function(selector, source, mode) {

      var parts = typeof selector == 'string' ? selector.match(reSplitGroup) : selector;

      // ensures that source is a string
      typeof source == 'string' || (source = '');

      if (parts.length == 1) {
        source += compileSelector(parts[0], mode ? ACCEPT_NODE : 'f&&f(k);return true;');
      } else {
        // for each selector in the group
        var i = -1, seen = { }, token;
        while ((token = parts[++i])) {
          token = token.replace(reTrimSpaces, '');
          // avoid repeating the same token
          // in comma separated group (p, p)
          if (!seen[token] && (seen[token] = true)) {
            source += compileSelector(token, mode ? ACCEPT_NODE : 'f&&f(k);return true;');
          }
        }
      }

      if (mode) {
        // for select method
        return new Function('c,s,r,d,h,g,f',
          'var N,n,x=0,k=-1,e;main:while((e=c[++k])){' + source + '}return r;');
      } else {
        // for match method
        return new Function('e,s,r,d,h,g,f',
          'var N,n,x=0,k=e;' + source + 'return false;');
      }
    },

  // compile a CSS3 string selector into ad-hoc javascript matching function
  // @return string (to be compiled)
  compileSelector =
    function(selector, source) {

      var a, b, n, k = 0, expr, match, result, status, test, type;

      while (selector) {

        k++;

        // *** Universal selector
        // * match all (empty block, do not remove)
        if ((match = selector.match(Patterns.universal))) {
          // do nothing, handled in the compiler where
          // BUGGY_GEBTN return comment nodes (ex: IE)
          expr = '';
        }

        // *** ID selector
        // #Foo Id case sensitive
        else if ((match = selector.match(Patterns.id))) {
          // document can contain conflicting elements (id/name)
          // prototype selector unit need this method to recover bad HTML forms
          source = 'if(' + (XML_DOCUMENT ?
            's.getAttribute(e,"id")' :
            '(e.submit?s.getAttribute(e,"id"):e.id)') +
            '=="' + match[1] + '"' +
            '){' + source + '}';
        }

        // *** Type selector
        // Foo Tag (case insensitive)
        else if ((match = selector.match(Patterns.tagName))) {
          // both tagName and nodeName properties may be upper/lower case
          // depending on their creation NAMESPACE in createElementNS()
          source = 'if(e.nodeName' + (XML_DOCUMENT ?
            '=="' + match[1] + '"' : '.toUpperCase()' +
            '=="' + match[1].toUpperCase() + '"') +
            '){' + source + '}';
        }

        // *** Class selector
        // .Foo Class (case sensitive)
        else if ((match = selector.match(Patterns.className))) {
          // W3C CSS3 specs: element whose "class" attribute has been assigned a
          // list of whitespace-separated values, see section 6.4 Class selectors
          // and notes at the bottom; explicitly non-normative in this specification.
          source = 'if((n=' + (XML_DOCUMENT ?
            's.getAttribute(e,"class")' : 'e.className') +
            ')&&n.length&&(" "+' + (QUIRKS_MODE ? 'n.toLowerCase()' : 'n') +
            '.replace(' + reWhiteSpace + '," ")+" ").indexOf(" ' +
            (QUIRKS_MODE ? match[1].toLowerCase() : match[1]) + ' ")>-1' +
            '){' + source + '}';
        }

        // *** Attribute selector
        // [attr] [attr=value] [attr="value"] [attr='value'] and !=, *=, ~=, |=, ^=, $=
        // case sensitivity is treated differently depending on the document type (see map)
        else if ((match = selector.match(Patterns.attribute))) {

          // xml namespaced attribute ?
          expr = match[1].split(':');
          expr = expr.length == 2 ? expr[1] : expr[0] + '';

          if (match[2] && !Operators[match[2]]) {
            emit('Unsupported operator in attribute selectors "' + selector + '"');
            return '';
          }

          test = false;
          type = 'false';

          // replace Operators parameter if needed
          if (match[2] && match[4] && (type = Operators[match[2]])) {
            // case treatment depends on document
            HTML_TABLE['class'] = QUIRKS_MODE ? 1 : 0;
            // replace escaped values and HTML entities
            match[4] = match[4].replace(/\\([0-9a-f]{2,2})/, '\\x$1');
            test = (XML_DOCUMENT ? XHTML_TABLE : HTML_TABLE)[expr.toLowerCase()];
            type = type.replace(/\%m/g, test ? match[4].toLowerCase() : match[4]);
          } else if (match[2] == '!=' || match[2] == '=') {
            type = 'n' + match[2] + '="' + match[4] + '"';
          }

          // build expression for has/getAttribute
          expr = 'n=s.' + (match[2] ? 'get' : 'has') +
            'Attribute(e,"' + match[1] + '")' +
            (test ? '.toLowerCase();' : ';');

          source = expr + 'if(' + (match[2] ? type : 'n') + '){' + source + '}';
        }

        // *** Adjacent sibling combinator
        // E + F (F adiacent sibling of E)
        else if ((match = selector.match(Patterns.adjacent))) {
          source = NATIVE_TRAVERSAL_API ?
            'var N' + k + '=e;if(e&&(e=e.previousElementSibling)){' + source + '}e=N' + k + ';' :
            'var N' + k + '=e;while(e&&(e=e.previousSibling)){if(e.nodeName>"@"){' + source + 'break;}}e=N' + k + ';';
        }

        // *** General sibling combinator
        // E ~ F (F relative sibling of E)
        else if ((match = selector.match(Patterns.relative))) {
          source = NATIVE_TRAVERSAL_API ?
            ('var N' + k + '=e;e=e.parentNode.firstElementChild;' +
            'while(e&&e!==N' + k + '){' + source + 'e=e.nextElementSibling;}e=N' + k + ';') :
            ('var N' + k + '=e;e=e.parentNode.firstChild;' +
            'while(e&&e!==N' + k + '){if(e.nodeName>"@"){' + source + '}e=e.nextSibling;}e=N' + k + ';');
        }

        // *** Child combinator
        // E > F (F children of E)
        else if ((match = selector.match(Patterns.children))) {
          source = 'var N' + k + '=e;if(e&&e!==h&&e!==g&&(e=e.parentNode)){' + source + '}e=N' + k + ';';
        }

        // *** Descendant combinator
        // E F (E ancestor of F)
        else if ((match = selector.match(Patterns.ancestor))) {
          source = 'var N' + k + '=e;while(e&&e!==h&&e!==g&&(e=e.parentNode)){' + source + '}e=N' + k + ';';
        }

        // *** Structural pseudo-classes
        // :root, :empty,
        // :first-child, :last-child, :only-child,
        // :first-of-type, :last-of-type, :only-of-type,
        // :nth-child(), :nth-last-child(), :nth-of-type(), :nth-last-of-type()
        else if ((match = selector.match(Patterns.spseudos)) && match[1]) {

          switch (match[2]) {

            case 'root':
              // element root of the document
              if (match[7]) {
                source = 'if(e===h||s.contains(h,e)){' + source + '}';
              } else {
                source = 'if(e===h){' + source + '}';
              }
              break;

            case 'empty':
              // element that has no children
              source = 'if(s.isEmpty(e)){' + source + '}';
              break;

            default:
              if (match[2] && match[6]) {
                if (match[6] == 'n') {
                  source = 'if(e!==h){' + source + '}';
                  break;
                } else if (match[6] == 'even') {
                  a = 2;
                  b = 0;
                } else if (match[6] == 'odd') {
                  a = 2;
                  b = 1;
                } else {
                  // assumes correct "an+b" format, "b" before "a" to keep "n" values
                  b = ((n = match[6].match(/(-?\d+)$/)) ? parseInt(n[1], 10) : 0);
                  a = ((n = match[6].match(/(-?\d*)n/)) ? parseInt(n[1], 10) : 0);
                  if (n && n[1] == '-') a = -1;
                }

                // build test expression out of structural pseudo (an+b) parameters
                // see here: http://www.w3.org/TR/css3-selectors/#nth-child-pseudo
                test =  b < 1 && a > 1 ? '(n-(' + b + '))%' + a + '==0' : a > +1 ?
                  (match[3] == 'last') ? '(n-(' + b + '))%' + a + '==0' :
                  'n>=' + b + '&&(n-(' + b + '))%' + a + '==0' : a < -1 ?
                  (match[3] == 'last') ? '(n-(' + b + '))%' + a + '==0' :
                  'n<=' + b + '&&(n-(' + b + '))%' + a + '==0' : a=== 0 ?
                  'n==' + b :
                  (match[3] == 'last') ?
                    a == -1 ? 'n>=' + b : 'n<=' + b :
                    a == -1 ? 'n<=' + b : 'n>=' + b;

                // 4 cases: 1 (nth) x 4 (child, of-type, last-child, last-of-type)
                source =
                  'if(e!==h){' +
                    'n=s[' + (match[5] ? '"nthOfType"' : '"nthElement"') + ']' +
                      '(e,' + (match[3] == 'last' ? 'true' : 'false') + ');' +
                    'if(' + test + '){' + source + '}' +
                  '}';

              } else {
                // 6 cases: 3 (first, last, only) x 1 (child) x 2 (-of-type)
                a = match[3] == 'first' ? 'previous' : 'next';
                n = match[3] == 'only' ? 'previous' : 'next';
                b = match[3] == 'first' || match[3] == 'last';

                type = match[5] ? '&&n.nodeName!=e.nodeName' : '&&n.nodeName<"@"';

                source = 'if(e!==h){' +
                  ( 'n=e;while((n=n.' + a + 'Sibling)' + type + ');if(!n){' + (b ? source :
                    'n=e;while((n=n.' + n + 'Sibling)' + type + ');if(!n){' + source + '}') + '}' ) + '}';
              }
              break;
          }

        }

        // *** negation, user action and target pseudo-classes
        // *** UI element states and dynamic pseudo-classes
        // CSS3 :not, :checked, :enabled, :disabled, :target
        // CSS3 :active, :hover, :focus
        // CSS3 :link, :visited
        else if ((match = selector.match(Patterns.dpseudos)) && match[1]) {

          switch (match[1]) {
            // CSS3 negation pseudo-class
            case 'not':
              // compile nested selectors, DO NOT pass the callback parameter
              // SIMPLENOT allow disabling complex selectors nested
              // in ':not()' pseudo-classes, breaks some test units
              expr = match[3].replace(reTrimSpaces, '');

              if (Config.SIMPLENOT && !reSimpleNot.test(expr)) {
                // see above, log error but continue execution
                emit('Negation pseudo-class only accepts simple selectors "' + selector + '"');
                return '';
              } else {
                if ('compatMode' in doc) {
                  source = 'if(!' + compile([expr], '', false) + '(e,s,r,d,h,g)){' + source + '}';
                } else {
                  source = 'if(!s.match(e, "' + expr.replace(/\x22/g, '\\"') + '",g)){' + source +'}';
                }
              }
              break;

            // CSS3 UI element states
            case 'checked':
              // for radio buttons checkboxes (HTML4) and options (HTML5)
              test = 'if((typeof e.form!="undefined"&&(/^(?:radio|checkbox)$/i).test(e.type)&&e.checked)';
              source = (Config.USE_HTML5 ? test + '||(/^option$/i.test(e.nodeName)&&e.selected)' : test) + '){' + source + '}';
              break;
            case 'disabled':
              // does not consider hidden input fields
              source = 'if(((typeof e.form!="undefined"&&!(/^hidden$/i).test(e.type))||s.isLink(e))&&e.disabled){' + source + '}';
              break;
            case 'enabled':
              // does not consider hidden input fields
              source = 'if(((typeof e.form!="undefined"&&!(/^hidden$/i).test(e.type))||s.isLink(e))&&!e.disabled){' + source + '}';
              break;

            // CSS3 lang pseudo-class
            case 'lang':
              test = '';
              if (match[3]) test = match[3].substr(0, 2) + '-';
              source = 'do{(n=e.lang||"").toLowerCase();' +
                'if((n==""&&h.lang=="' + match[3].toLowerCase() + '")||' +
                '(n&&(n=="' + match[3].toLowerCase() +
                '"||n.substr(0,3)=="' + test.toLowerCase() + '")))' +
                '{' + source + 'break;}}while((e=e.parentNode)&&e!==g);';
              break;

            // CSS3 target pseudo-class
            case 'target':
              n = doc.location ? doc.location.hash : '';
              if (n) {
                source = 'if(e.id=="' + n.slice(1) + '"){' + source + '}';
              }
              break;

            // CSS3 dynamic pseudo-classes
            case 'link':
              source = 'if(s.isLink(e)&&!e.visited){' + source + '}';
              break;
            case 'visited':
              source = 'if(s.isLink(e)&&e.visited){' + source + '}';
              break;

            // CSS3 user action pseudo-classes IE & FF3 have native support
            // these capabilities may be emulated by some event managers
            case 'active':
              if (XML_DOCUMENT) break;
              source = 'if(e===d.activeElement){' + source + '}';
              break;
            case 'hover':
              if (XML_DOCUMENT) break;
              source = 'if(e===d.hoverElement){' + source + '}';
              break;
            case 'focus':
              if (XML_DOCUMENT) break;
              source = NATIVE_FOCUS ?
                'if(e===d.activeElement&&d.hasFocus()&&(e.type||e.href)){' + source + '}' :
                'if(e===d.activeElement&&(e.type||e.href)){' + source + '}';
              break;

            // CSS2 selected pseudo-classes, not part of current CSS3 drafts
            // the 'selected' property is only available for option elements
            case 'selected':
              // fix Safari selectedIndex property bug
              expr = BUGGY_SELECTED ? '||(n=e.parentNode)&&n.options[n.selectedIndex]===e' : '';
              source = 'if(/^option$/i.test(e.nodeName)&&(e.selected' + expr + ')){' + source + '}';
              break;

            default:
              break;
          }

        }

        else {

          // this is where external extensions are
          // invoked if expressions match selectors
          expr = false;
          status = true;

          for (expr in Selectors) {
            if ((match = selector.match(Selectors[expr].Expression)) && match[1]) {
              result = Selectors[expr].Callback(match, source);
              source = result.source;
              status = result.status;
              if (status) break;
            }
          }

          // if an extension fails to parse the selector
          // it must return a false boolean in "status"
          if (!status) {
            // log error but continue execution, don't throw real exceptions
            // because blocking following processes maybe is not a good idea
            emit('Unknown pseudo-class selector "' + selector + '"');
            return '';
          }

          if (!expr) {
            // see above, log error but continue execution
            emit('Unknown token in selector "' + selector + '"');
            return '';
          }

        }

        // error if no matches found by the pattern scan
        if (!match) {
          emit('Invalid syntax in selector "' + selector + '"');
          return '';
        }

        // ensure "match" is not null or empty since
        // we do not throw real DOMExceptions above
        selector = match && match[match.length - 1];
      }

      return source;
    },

  /*----------------------------- QUERY METHODS ------------------------------*/

  // match element with selector
  // @return boolean
  match =
    function(element, selector, from, callback) {

      var parts;

      if (!(element && element.nodeName > '@')) {
        emit('Invalid element argument');
        return false;
      } else if (!selector || typeof selector != 'string') {
        emit('Invalid selector argument');
        return false;
      } else if (from && from.nodeType == 1 && !contains(from, element)) {
        return false;
      } else if (lastContext !== from) {
        // reset context data when it changes
        // and ensure context is set to a default
        switchContext(from || (from = element.ownerDocument));
      }

      selector = selector.replace(reTrimSpaces, '');

      Config.SHORTCUTS && (selector = NW.Dom.shortcuts(selector, element, from));

      if (lastMatcher != selector) {
        // process valid selector strings
        if ((parts = selector.match(reValidator)) && parts[0] == selector) {
          isSingleMatch = (parts = selector.match(reSplitGroup)).length < 2;
          // save passed selector
          lastMatcher = selector;
          lastPartsMatch = parts;
        } else {
          emit('The string "' + selector + '", is not a valid CSS selector');
          return false;
        }
      } else parts = lastPartsMatch;

      // compile matcher resolver if necessary
      if (!matchResolvers[selector] || matchContexts[selector] !== from) {
        matchResolvers[selector] = compile(isSingleMatch ? [selector] : parts, '', false);
        matchContexts[selector] = from;
      }

      return matchResolvers[selector](element, Snapshot, [ ], doc, root, from, callback);
    },

  // select only the first element
  // matching selector (document ordered)
  first =
    function(selector, from) {
      return select(selector, from, function() { return false; })[0] || null;
    },

  // select elements matching selector
  // using new Query Selector API
  // or cross-browser client API
  // @return array
  select =
    function(selector, from, callback) {

      var i, changed, element, elements, parts, token, original = selector;

      if (arguments.length === 0) {
        emit('Missing required selector parameters');
        return [ ];
      } else if (selector === '') {
        emit('Empty selector string');
        return [ ];
      } else if (typeof selector != 'string') {
        return [ ];
      } else if (from && !(/1|9|11/).test(from.nodeType)) {
        emit('Invalid context element');
        return [ ];
      } else if (lastContext !== from) {
        // reset context data when it changes
        // and ensure context is set to a default
        switchContext(from || (from = doc));
      }

      if (Config.CACHING && (elements = Dom.loadResults(original, from, doc, root))) {
        return callback ? concatCall([ ], elements, callback) : elements;
      }

      if (!OPERA_QSAPI && RE_SIMPLE_SELECTOR.test(selector)) {
        switch (selector.charAt(0)) {
          case '#':
            if ((element = _byId(selector.slice(1), from))) {
              elements = [ element ];
            } else elements = [ ];
            break;
          case '.':
            elements = _byClass(selector.slice(1), from);
            break;
          default:
            elements = _byTag(selector, from);
            break;
        }
      }

      else if (!XML_DOCUMENT && Config.USE_QSAPI &&
        !(BUGGY_QUIRKS_QSAPI && RE_CLASS.test(selector)) &&
        !RE_BUGGY_QSAPI.test(selector)) {
        try {
          elements = from.querySelectorAll(selector);
        } catch(e) { }
      }

      if (elements) {
        elements = callback ? concatCall([ ], elements, callback) :
          NATIVE_SLICE_PROTO ? slice.call(elements) : concatList([ ], elements);
        Config.CACHING && Dom.saveResults(original, from, doc, elements);
        return elements;
      }

      selector = selector.replace(reTrimSpaces, '');

      Config.SHORTCUTS && (selector = NW.Dom.shortcuts(selector, from));

      if ((changed = lastSelector != selector)) {
        // process valid selector strings
        if ((parts = selector.match(reValidator)) && parts[0] == selector) {
          isSingleSelect = (parts = selector.match(reSplitGroup)).length < 2;
          // save passed selector
          lastSelector = selector;
          lastPartsSelect = parts;
        } else {
          emit('The string "' + selector + '", is not a valid CSS selector');
          return [ ];
        }
      } else parts = lastPartsSelect;

      // commas separators are treated sequentially to maintain order
      if (from.nodeType == 11) {

        elements = from.childNodes;

      } else if (!XML_DOCUMENT && isSingleSelect) {

        if (changed) {
          // get right most selector token
          parts = selector.match(reSplitToken);
          token = parts[parts.length - 1];

          // only last slice before :not rules
          lastSlice = token.split(':not')[0];

          // position where token was found
          lastPosition = selector.length - token.length;
        }

        // ID optimization RTL, to reduce number of elements to visit
        if ((parts = lastSlice.match(Optimize.ID)) && (token = parts[1])) {
          if ((element = _byId(token, from))) {
            if (match(element, selector)) {
              callback && callback(element);
              elements = [ element ];
            } else elements = [ ];
          }
        }

        // ID optimization LTR, to reduce selection context searches
        else if ((parts = selector.match(Optimize.ID)) && (token = parts[1])) {
          if ((element = _byId(token, doc))) {
            if ('#' + token == selector) {
              callback && callback(element);
              elements = [ element ];
            }
            if (/[>+~]/.test(selector)) {
              from = element.parentNode;
            } else {
              selector = selector.replace('#' + token, '*');
              lastPosition -= token.length + 1;
              from = element;
            }
          } else elements = [ ];
        }

        if (elements) {
          Config.CACHING && Dom.saveResults(original, from, doc, elements);
          return elements;
        }

        if (!NATIVE_GEBCN && (parts = lastSlice.match(Optimize.TAG)) && (token = parts[1])) {
          if ((elements = _byTag(token, from)).length === 0) { return [ ]; }
          selector = selector.slice(0, lastPosition) + selector.slice(lastPosition).replace(token, '*');
        }

        else if ((parts = lastSlice.match(Optimize.CLASS)) && (token = parts[1])) {
          if ((elements = _byClass(token, from)).length === 0) { return [ ]; }
          if (reOptimizeSelector.test(selector.charAt(selector.indexOf(token) - 1))) {
            selector = selector.slice(0, lastPosition) + selector.slice(lastPosition).replace('.' + token, '');
          } else {
            selector = selector.slice(0, lastPosition) + selector.slice(lastPosition).replace('.' + token, '*');
          }
        }

        else if ((parts = selector.match(Optimize.CLASS)) && (token = parts[1])) {
          if ((elements = _byClass(token, from)).length === 0) { return [ ]; }
          for (i = 0, els = [ ]; elements.length > i; ++i) {
            els = concatList(els, elements[i].getElementsByTagName('*'));
          }
          elements = els;
          if (reOptimizeSelector.test(selector.charAt(selector.indexOf(token) - 1))) {
            selector = selector.slice(0, lastPosition) + selector.slice(lastPosition).replace('.' + token, '');
          } else {
            selector = selector.slice(0, lastPosition) + selector.slice(lastPosition).replace('.' + token, '*');
          }
        }

        else if (NATIVE_GEBCN && (parts = lastSlice.match(Optimize.TAG)) && (token = parts[1])) {
          if ((elements = _byTag(token, from)).length === 0) { return [ ]; }
          selector = selector.slice(0, lastPosition) + selector.slice(lastPosition).replace(token, '*');
        }

      }

      if (!elements) {
        elements = /^(?:applet|object)$/i.test(from.nodeName) ? from.childNodes : _byTag('*', from);
      }
      // end of prefiltering pass

      // compile selector resolver if necessary
      if (!selectResolvers[selector] || selectContexts[selector] !== from) {
        selectResolvers[selector] = compile(isSingleSelect ? [selector] : parts, '', true);
        selectContexts[selector] = from;
      }

      elements = selectResolvers[selector](elements, Snapshot, [ ], doc, root, from, callback);

      Config.CACHING && Dom.saveResults(original, from, doc, elements);

      return elements;
    },

  /*-------------------------------- STORAGE ---------------------------------*/

  // compiled match functions returning booleans
  matchContexts = { },
  matchResolvers = { },

  // compiled select functions returning collections
  selectContexts = { },
  selectResolvers = { },

  // used to pass methods to compiled functions
  Snapshot = {

    // element indexing methods
    nthElement: nthElement,
    nthOfType: nthOfType,

    // element inspection methods
    getAttribute: getAttribute,
    hasAttribute: hasAttribute,

    // element selection methods
    byClass: _byClass,
    byName: byName,
    byTag: _byTag,
    byId: _byId,

    // helper/check methods
    contains: contains,
    isEmpty: isEmpty,
    isLink: isLink,

    // selection/matching
    select: select,
    match: match
  };

  Tokens = {
    prefixes: prefixes,
    encoding: encoding,
    operators: operators,
    whitespace: whitespace,
    identifier: identifier,
    attributes: attributes,
    combinators: combinators,
    pseudoclass: pseudoclass,
    pseudoparms: pseudoparms,
    quotedvalue: quotedvalue
  };

  /*------------------------------- PUBLIC API -------------------------------*/

  // code referenced by extensions
  Dom.ACCEPT_NODE = ACCEPT_NODE;

  // log resolvers errors/warnings
  Dom.emit = emit;

  // retrieve element by id attr
  Dom.byId = byId;

  // retrieve elements by tag name
  Dom.byTag = byTag;

  // retrieve elements by name attr
  Dom.byName = byName;

  // retrieve elements by class name
  Dom.byClass = byClass;

  // read the value of the attribute
  // as was in the original HTML code
  Dom.getAttribute = getAttribute;

  // check for the attribute presence
  // as was in the original HTML code
  Dom.hasAttribute = hasAttribute;

  // element match selector, return boolean true/false
  Dom.match = match;

  // first element match only, return element or null
  Dom.first = first;

  // elements matching selector, starting from element
  Dom.select = select;

  // compile selector into ad-hoc javascript resolver
  Dom.compile = compile;

  // check that two elements are ancestor/descendant
  Dom.contains = contains;

  // handle selector engine configuration settings
  Dom.configure = configure;

  // initialize caching for each document
  Dom.setCache = function() { return; };

  // load previously collected result set
  Dom.loadResults = function() { return; };

  // save previously collected result set
  Dom.saveResults = function() { return; };

  // handle missing context in selector strings
  Dom.shortcuts = function(x) { return x; };

  // options enabing specific engine functionality
  Dom.Config = Config;

  // pass methods references to compiled resolvers
  Dom.Snapshot = Snapshot;

  // operators descriptor
  // for attribute operators extensions
  Dom.Operators = Operators;

  // selectors descriptor
  // for pseudo-class selectors extensions
  Dom.Selectors = Selectors;

  // export string patterns
  Dom.Tokens = Tokens;

  // add or overwrite user defined operators
  Dom.registerOperator =
    function(symbol, resolver) {
      Operators[symbol] || (Operators[symbol] = resolver);
    };

  // add selector patterns for user defined callbacks
  Dom.registerSelector =
    function(name, rexp, func) {
      Selectors[name] || (Selectors[name] = {
        Expression: rexp,
        Callback: func
      });
    };

  /*---------------------------------- INIT ----------------------------------*/

  // init context specific variables
  switchContext(doc, true);

})(this);

/*!
selectivizr v1.0.4b - (c) Keith Clark, freely distributable under the terms
of the MIT license.

selectivizr.com

Notes about this source
-----------------------

 * The #DEBUG_START and #DEBUG_END comments are used to mark blocks of code
   that will be removed prior to building a final release version (using a
   pre-compression script)


References:
-----------

 * CSS Syntax          : http://www.w3.org/TR/2003/WD-css3-syntax-20030813/#style
 * Selectors           : http://www.w3.org/TR/css3-selectors/#selectors
 * IE Compatability    : http://msdn.microsoft.com/en-us/library/cc351024(VS.85).aspx
 * W3C Selector Tests  : http://www.w3.org/Style/CSS/Test/CSS3/Selectors/current/html/tests/

*/

(function(win) {

	// Determine IE version and stop execution if browser isn't IE. This
	// handles the script being loaded by non IE browsers because the
	// developer didn't use conditional comments.
	var result = navigator.userAgent.match(/MSIE (\d+)/);
	if (result) var ieVersion = result[1]; else return;

	// =========================== Init Objects ============================

	var doc = document;
	var root = doc.documentElement;
	var xhr = getXHRObject();

	// If were not in standards mode, IE is too old / new or we can't create
	// an XMLHttpRequest object then we should get out now.
	if (doc.compatMode != 'CSS1Compat' || ieVersion<6 || ieVersion>8 || !xhr) {
		return;
	}


	// ========================= Common Objects ============================

	// Compatiable selector engines in order of CSS3 support. Note: '*' is
	// a placholder for the object key name. (basically, crude compression)
	var selectorEngines = {
		"NW"								: "*.Dom.select",
		"MooTools"							: "$$",
		"DOMAssistant"						: "*.$",
		"Prototype"							: "$$",
		"YAHOO"								: "*.util.Selector.query",
		"Sizzle"							: "*",
		"jQuery"							: "*",
		"dojo"								: "*.query"
	};

	var selectorMethod;
	var enabledWatchers 					= [];     // array of :enabled/:disabled elements to poll
	var domPatches							= [];
	var ie6PatchID 							= 0;      // used to solve ie6's multiple class bug
	var patchIE6MultipleClasses				= true;   // if true adds class bloat to ie6
	var namespace 							= "slvzr";

	// Stylesheet parsing regexp's
	var RE_COMMENT							= /(\/\*[^*]*\*+([^\/][^*]*\*+)*\/)\s*?/g;
	var RE_IMPORT							= /@import\s*(?:(?:(?:url\(\s*(['"]?)(.*)\1)\s*\))|(?:(['"])(.*)\3))\s*([^;]*);/g;
	var RE_ASSET_URL 						= /(behavior\s*?:\s*)?\burl\(\s*(["']?)(?!data:)([^"')]+)\2\s*\)/g;
	var RE_PSEUDO_STRUCTURAL				= /^:(empty|(first|last|only|nth(-last)?)-(child|of-type))$/;
	var RE_PSEUDO_ELEMENTS					= /:(:first-(?:line|letter))/g;
	var RE_SELECTOR_GROUP					= /((?:^|(?:\s*})+)(?:\s*@media[^{]+{)?)\s*([^\{]*?[\[:][^{]+)/g;
	var RE_SELECTOR_PARSE					= /([ +~>])|(:[a-z-]+(?:\(.*?\)+)?)|(\[.*?\])/g;
	var RE_LIBRARY_INCOMPATIBLE_PSEUDOS		= /(:not\()?:(hover|enabled|disabled|focus|checked|target|active|visited|first-line|first-letter)\)?/g;
	var RE_PATCH_CLASS_NAME_REPLACE			= /[^\w-]/g;

	// HTML UI element regexp's
	var RE_INPUT_ELEMENTS					= /^(INPUT|SELECT|TEXTAREA|BUTTON)$/;
	var RE_INPUT_CHECKABLE_TYPES			= /^(checkbox|radio)$/;

	// Broken attribute selector implementations (IE7/8 native [^=""], [$=""] and [*=""])
	var BROKEN_ATTR_IMPLEMENTATIONS			= ieVersion>6 ? /[\$\^*]=(['"])\1/ : null;

	// Whitespace normalization regexp's
	var RE_TIDY_TRAILING_WHITESPACE			= /([(\[+~])\s+/g;
	var RE_TIDY_LEADING_WHITESPACE			= /\s+([)\]+~])/g;
	var RE_TIDY_CONSECUTIVE_WHITESPACE		= /\s+/g;
	var RE_TIDY_TRIM_WHITESPACE				= /^\s*((?:[\S\s]*\S)?)\s*$/;

	// String constants
	var EMPTY_STRING						= "";
	var SPACE_STRING						= " ";
	var PLACEHOLDER_STRING					= "$1";

	// =========================== Patching ================================

	// --[ patchStyleSheet() ]----------------------------------------------
	// Scans the passed cssText for selectors that require emulation and
	// creates one or more patches for each matched selector.
	function patchStyleSheet( cssText ) {
		return cssText.replace(RE_PSEUDO_ELEMENTS, PLACEHOLDER_STRING).
			replace(RE_SELECTOR_GROUP, function(m, prefix, selectorText) {
    			var selectorGroups = selectorText.split(",");
    			for (var c = 0, cs = selectorGroups.length; c < cs; c++) {
    				var selector = normalizeSelectorWhitespace(selectorGroups[c]) + SPACE_STRING;
    				var patches = [];
    				selectorGroups[c] = selector.replace(RE_SELECTOR_PARSE,
    					function(match, combinator, pseudo, attribute, index) {
    						if (combinator) {
    							if (patches.length>0) {
    								domPatches.push( { selector: selector.substring(0, index), patches: patches } )
    								patches = [];
    							}
    							return combinator;
    						}
    						else {
    							var patch = (pseudo) ? patchPseudoClass( pseudo ) : patchAttribute( attribute );
    							if (patch) {
    								patches.push(patch);
    								return "." + patch.className;
    							}
    							return match;
    						}
    					}
    				);
    			}
    			return prefix + selectorGroups.join(",");
    		});
	};

	// --[ patchAttribute() ]-----------------------------------------------
	// returns a patch for an attribute selector.
	function patchAttribute( attr ) {
		return (!BROKEN_ATTR_IMPLEMENTATIONS || BROKEN_ATTR_IMPLEMENTATIONS.test(attr)) ?
			{ className: createClassName(attr), applyClass: true } : null;
	};

	// --[ patchPseudoClass() ]---------------------------------------------
	// returns a patch for a pseudo-class
	function patchPseudoClass( pseudo ) {

		var applyClass = true;
		var className = createClassName(pseudo.slice(1));
		var isNegated = pseudo.substring(0, 5) == ":not(";
		var activateEventName;
		var deactivateEventName;

		// if negated, remove :not()
		if (isNegated) {
			pseudo = pseudo.slice(5, -1);
		}

		// bracket contents are irrelevant - remove them
		var bracketIndex = pseudo.indexOf("(")
		if (bracketIndex > -1) {
			pseudo = pseudo.substring(0, bracketIndex);
		}

		// check we're still dealing with a pseudo-class
		if (pseudo.charAt(0) == ":") {
			switch (pseudo.slice(1)) {

				case "root":
					applyClass = function(e) {
						return isNegated ? e != root : e == root;
					}
					break;

				case "target":
					// :target is only supported in IE8
					if (ieVersion == 8) {
						applyClass = function(e) {
							var handler = function() {
								var hash = location.hash;
								var hashID = hash.slice(1);
								return isNegated ? (hash == EMPTY_STRING || e.id != hashID) : (hash != EMPTY_STRING && e.id == hashID);
							};
							addEvent( win, "hashchange", function() {
								toggleElementClass(e, className, handler());
							})
							return handler();
						}
						break;
					}
					return false;

				case "checked":
					applyClass = function(e) {
						if (RE_INPUT_CHECKABLE_TYPES.test(e.type)) {
							addEvent( e, "propertychange", function() {
								if (event.propertyName == "checked") {
									toggleElementClass( e, className, e.checked !== isNegated );
								}
							})
						}
						return e.checked !== isNegated;
					}
					break;

				case "disabled":
					isNegated = !isNegated;

				case "enabled":
					applyClass = function(e) {
						if (RE_INPUT_ELEMENTS.test(e.tagName)) {
							addEvent( e, "propertychange", function() {
								if (event.propertyName == "$disabled") {
									toggleElementClass( e, className, e.$disabled === isNegated );
								}
							});
							enabledWatchers.push(e);
							e.$disabled = e.disabled;
							return e.disabled === isNegated;
						}
						return pseudo == ":enabled" ? isNegated : !isNegated;
					}
					break;

				case "focus":
					activateEventName = "focus";
					deactivateEventName = "blur";

				case "hover":
					if (!activateEventName) {
						activateEventName = "mouseenter";
						deactivateEventName = "mouseleave";
					}
					applyClass = function(e) {
						addEvent( e, isNegated ? deactivateEventName : activateEventName, function() {
							toggleElementClass( e, className, true );
						})
						addEvent( e, isNegated ? activateEventName : deactivateEventName, function() {
							toggleElementClass( e, className, false );
						})
						return isNegated;
					}
					break;

				// everything else
				default:
					// If we don't support this pseudo-class don't create
					// a patch for it
					if (!RE_PSEUDO_STRUCTURAL.test(pseudo)) {
						return false;
					}
					break;
			}
		}
		return { className: className, applyClass: applyClass };
	};

	// --[ applyPatches() ]-------------------------------------------------
	function applyPatches() {
		var elms, selectorText, patches, domSelectorText;

		for (var c=0; c<domPatches.length; c++) {
			selectorText = domPatches[c].selector;
			patches = domPatches[c].patches;

			// Although some selector libraries can find :checked :enabled etc.
			// we need to find all elements that could have that state because
			// it can be changed by the user.
			domSelectorText = selectorText.replace(RE_LIBRARY_INCOMPATIBLE_PSEUDOS, EMPTY_STRING);

			// If the dom selector equates to an empty string or ends with
			// whitespace then we need to append a universal selector (*) to it.
			if (domSelectorText == EMPTY_STRING || domSelectorText.charAt(domSelectorText.length - 1) == SPACE_STRING) {
				domSelectorText += "*";
			}

			// Ensure we catch errors from the selector library
			try {
				elms = selectorMethod( domSelectorText );
			} catch (ex) {
				// #DEBUG_START
				log( "Selector '" + selectorText + "' threw exception '" + ex + "'" );
				// #DEBUG_END
			}


			if (elms) {
				for (var d = 0, dl = elms.length; d < dl; d++) {
					var elm = elms[d];
					var cssClasses = elm.className;
					for (var f = 0, fl = patches.length; f < fl; f++) {
						var patch = patches[f];
						if (!hasPatch(elm, patch)) {
							if (patch.applyClass && (patch.applyClass === true || patch.applyClass(elm) === true)) {
								cssClasses = toggleClass(cssClasses, patch.className, true );
							}
						}
					}
					elm.className = cssClasses;
				}
			}
		}
	};

	// --[ hasPatch() ]-----------------------------------------------------
	// checks for the exsistence of a patch on an element
	function hasPatch( elm, patch ) {
		return new RegExp("(^|\\s)" + patch.className + "(\\s|$)").test(elm.className);
	};


	// =========================== Utility =================================

	function createClassName( className ) {
		return namespace + "-" + ((ieVersion == 6 && patchIE6MultipleClasses) ?
			ie6PatchID++
		:
			className.replace(RE_PATCH_CLASS_NAME_REPLACE, function(a) { return a.charCodeAt(0) }));
	};

	// --[ log() ]----------------------------------------------------------
	// #DEBUG_START
	function log( message ) {
		if (win.console) {
			win.console.log(message);
		}
	};
	// #DEBUG_END

	// --[ trim() ]---------------------------------------------------------
	// removes leading, trailing whitespace from a string
	function trim( text ) {
		return text.replace(RE_TIDY_TRIM_WHITESPACE, PLACEHOLDER_STRING);
	};

	// --[ normalizeWhitespace() ]------------------------------------------
	// removes leading, trailing and consecutive whitespace from a string
	function normalizeWhitespace( text ) {
		return trim(text).replace(RE_TIDY_CONSECUTIVE_WHITESPACE, SPACE_STRING);
	};

	// --[ normalizeSelectorWhitespace() ]----------------------------------
	// tidies whitespace around selector brackets and combinators
	function normalizeSelectorWhitespace( selectorText ) {
		return normalizeWhitespace(selectorText.
			replace(RE_TIDY_TRAILING_WHITESPACE, PLACEHOLDER_STRING).
			replace(RE_TIDY_LEADING_WHITESPACE, PLACEHOLDER_STRING)
		);
	};

	// --[ toggleElementClass() ]-------------------------------------------
	// toggles a single className on an element
	function toggleElementClass( elm, className, on ) {
		var oldClassName = elm.className;
		var newClassName = toggleClass(oldClassName, className, on);
		if (newClassName != oldClassName) {
			elm.className = newClassName;
			elm.parentNode.className += EMPTY_STRING;
		}
	};

	// --[ toggleClass() ]--------------------------------------------------
	// adds / removes a className from a string of classNames. Used to
	// manage multiple class changes without forcing a DOM redraw
	function toggleClass( classList, className, on ) {
		var re = RegExp("(^|\\s)" + className + "(\\s|$)");
		var classExists = re.test(classList);
		if (on) {
			return classExists ? classList : classList + SPACE_STRING + className;
		} else {
			return classExists ? trim(classList.replace(re, PLACEHOLDER_STRING)) : classList;
		}
	};

	// --[ addEvent() ]-----------------------------------------------------
	function addEvent(elm, eventName, eventHandler) {
		elm.attachEvent("on" + eventName, eventHandler);
	};

	// --[ getXHRObject() ]-------------------------------------------------
	function getXHRObject() {
		if (win.XMLHttpRequest) {
			return new XMLHttpRequest;
		}
		try	{
			return new ActiveXObject('Microsoft.XMLHTTP');
		} catch(e) {
			return null;
		}
	};

	// --[ loadStyleSheet() ]-----------------------------------------------
	function loadStyleSheet( url ) {
		xhr.open("GET", url, false);
		xhr.send();
		return (xhr.status==200) ? xhr.responseText : EMPTY_STRING;
	};

	// --[ resolveUrl() ]---------------------------------------------------
	// Converts a URL fragment to a fully qualified URL using the specified
	// context URL. Returns null if same-origin policy is broken
	function resolveUrl( url, contextUrl, ignoreSameOriginPolicy ) {

		function getProtocol( url ) {
			return url.substring(0, url.indexOf("//"));
		};

		function getProtocolAndHost( url ) {
			return url.substring(0, url.indexOf("/", 8));
		};

		if (!contextUrl) {
			contextUrl = baseUrl;
		}

		// protocol-relative path
		if (url.substring(0,2)=="//") {
			url = getProtocol(contextUrl) + url;
		}

		// absolute path
		if (/^https?:\/\//i.test(url)) {
			return !ignoreSameOriginPolicy && getProtocolAndHost(contextUrl) != getProtocolAndHost(url) ? null : url ;
		}

		// root-relative path
		if (url.charAt(0)=="/")	{
			return getProtocolAndHost(contextUrl) + url;
		}

		// relative path
		var contextUrlPath = contextUrl.split(/[?#]/)[0]; // ignore query string in the contextUrl
		if (url.charAt(0) != "?" && contextUrlPath.charAt(contextUrlPath.length - 1) != "/") {
			contextUrlPath = contextUrlPath.substring(0, contextUrlPath.lastIndexOf("/") + 1);
		}

		return contextUrlPath + url;
	};

	// --[ parseStyleSheet() ]----------------------------------------------
	// Downloads the stylesheet specified by the URL, removes it's comments
	// and recursivly replaces @import rules with their contents, ultimately
	// returning the full cssText.
	function parseStyleSheet( url ) {
		if (url && url.indexOf(".css") !== -1) {
			return loadStyleSheet(url).replace(RE_COMMENT, EMPTY_STRING).
			replace(RE_IMPORT, function( match, quoteChar, importUrl, quoteChar2, importUrl2, media ) {
				var cssText = parseStyleSheet(resolveUrl(importUrl || importUrl2, url));
				return (media) ? "@media " + media + " {" + cssText + "}" : cssText;
			}).
			replace(RE_ASSET_URL, function( match, isBehavior, quoteChar, assetUrl ) {
				quoteChar = quoteChar || EMPTY_STRING;
				return isBehavior ? match : " url(" + quoteChar + resolveUrl(assetUrl, url, true) + quoteChar + ") ";
			});
		}
		return EMPTY_STRING;
	};

	// --[ getStyleSheets() ]-----------------------------------------------
	function getStyleSheets() {
		var url, stylesheet;
		for (var c = 0; c < doc.styleSheets.length; c++) {
			stylesheet = doc.styleSheets[c];
			if (stylesheet.href != EMPTY_STRING) {
				url = resolveUrl(stylesheet.href);

				var attr = 'data-youshallnotparse';

				if (stylesheet.href != EMPTY_STRING && (typeof stylesheet.owningElement.getAttribute(attr) === "undefined" || stylesheet.owningElement.getAttribute(attr) !== "true" )) {

					stylesheet.cssText = stylesheet["rawCssText"] = patchStyleSheet( parseStyleSheet( url ) );
				}
			}
		}
	};

	// --[ init() ]---------------------------------------------------------
	function init() {
		applyPatches();

		// :enabled & :disabled polling script (since we can't hook
		// onpropertychange event when an element is disabled)
		if (enabledWatchers.length > 0) {
			setInterval( function() {
				for (var c = 0, cl = enabledWatchers.length; c < cl; c++) {
					var e = enabledWatchers[c];
					if (e.disabled !== e.$disabled) {
						if (e.disabled) {
							e.disabled = false;
							e.$disabled = true;
							e.disabled = true;
						}
						else {
							e.$disabled = e.disabled;
						}
					}
				}
			}, 250)
		}
	};

	// Determine the baseUrl and download the stylesheets
	var baseTags = doc.getElementsByTagName("BASE");
	var baseUrl = (baseTags.length > 0) ? baseTags[0].href : doc.location.href;
	getStyleSheets();

	// Bind selectivizr to the ContentLoaded event.
	ContentLoaded(win, function() {
		// Determine the "best fit" selector engine
		for (var engine in selectorEngines) {
			var members, member, context = win;
			if (win[engine]) {
				members = selectorEngines[engine].replace("*", engine).split(".");
				while ((member = members.shift()) && (context = context[member])) {}
				if (typeof context == "function") {
					selectorMethod = context;
					init();
					return;
				}
			}
		}
	});



	/*!
	 * ContentLoaded.js by Diego Perini, modified for IE<9 only (to save space)
	 *
	 * Author: Diego Perini (diego.perini at gmail.com)
	 * Summary: cross-browser wrapper for DOMContentLoaded
	 * Updated: 20101020
	 * License: MIT
	 * Version: 1.2
	 *
	 * URL:
	 * http://javascript.nwbox.com/ContentLoaded/
	 * http://javascript.nwbox.com/ContentLoaded/MIT-LICENSE
	 *
	 */

	// @w window reference
	// @f function reference
	function ContentLoaded(win, fn) {

		var done = false, top = true,
		init = function(e) {
			if (e.type == "readystatechange" && doc.readyState != "complete") return;
			(e.type == "load" ? win : doc).detachEvent("on" + e.type, init, false);
			if (!done && (done = true)) fn.call(win, e.type || e);
		},
		poll = function() {
			try { root.doScroll("left"); } catch(e) { setTimeout(poll, 50); return; }
			init('poll');
		};

		if (doc.readyState == "complete") fn.call(win, EMPTY_STRING);
		else {
			if (doc.createEventObject && root.doScroll) {
				try { top = !win.frameElement; } catch(e) { }
				if (top) poll();
			}
			addEvent(doc,"readystatechange", init);
			addEvent(win,"load", init);
		}
	};
})(this);
