/* @ds-bundle: {"format":3,"namespace":"BlazeMasterDesignSystem_412648","components":[{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Tag","sourcePath":"components/core/Tag.jsx"}],"sourceHashes":{"components/core/Badge.jsx":"0cdfc842cbc0","components/core/Button.jsx":"ee2bc7ca8347","components/core/Card.jsx":"202d6f045d19","components/core/Tag.jsx":"5139d908f421"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.BlazeMasterDesignSystem_412648 = window.BlazeMasterDesignSystem_412648 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * BlazeMaster Badge — small status or count indicator.
 * Used for certification marks, count overlays, status chips.
 */
function Badge({
  children,
  variant = 'brand',
  size = 'md',
  pill = true,
  ...rest
}) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Roboto', sans-serif",
    fontWeight: 500,
    letterSpacing: '0.04em',
    borderRadius: pill ? '9999px' : '2px',
    lineHeight: 1,
    whiteSpace: 'nowrap'
  };
  const sizes = {
    sm: {
      padding: '2px 8px',
      fontSize: '10px'
    },
    md: {
      padding: '4px 10px',
      fontSize: '11px'
    },
    lg: {
      padding: '5px 14px',
      fontSize: '13px'
    }
  };
  const variants = {
    brand: {
      background: 'var(--color-blaze-red, #a8003b)',
      color: '#fff'
    },
    dark: {
      background: 'var(--color-gray-90, #333)',
      color: '#fff'
    },
    outline: {
      background: 'transparent',
      color: 'var(--color-blaze-red, #a8003b)',
      border: '1px solid var(--color-blaze-red, #a8003b)'
    },
    subtle: {
      background: 'rgba(168,0,59,0.08)',
      color: 'var(--color-blaze-red, #a8003b)'
    },
    neutral: {
      background: 'var(--color-gray-10, #f0f0f0)',
      color: 'var(--color-gray-90, #333)'
    }
  };
  const style = {
    ...base,
    ...sizes[size],
    ...variants[variant]
  };
  return /*#__PURE__*/React.createElement("span", _extends({
    style: style
  }, rest), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * BlazeMaster Button — primary action component.
 * Supports primary (solid red), secondary (outlined), and ghost variants.
 */
function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
  href,
  type = 'button',
  fullWidth = false,
  ...rest
}) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontFamily: "'Roboto', 'Helvetica Neue', Arial, sans-serif",
    fontWeight: 500,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    textDecoration: 'none',
    border: 'none',
    borderRadius: '2px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'background 150ms ease, color 150ms ease, border-color 150ms ease',
    width: fullWidth ? '100%' : 'auto',
    whiteSpace: 'nowrap',
    outline: 'none'
  };
  const sizes = {
    sm: {
      padding: '7px 16px',
      fontSize: '12px'
    },
    md: {
      padding: '10px 24px',
      fontSize: '13px'
    },
    lg: {
      padding: '14px 32px',
      fontSize: '14px'
    }
  };
  const variants = {
    primary: {
      background: disabled ? '#b3b3b3' : 'var(--color-blaze-red, #a8003b)',
      color: '#ffffff',
      border: 'none'
    },
    secondary: {
      background: 'transparent',
      color: disabled ? '#b3b3b3' : 'var(--color-blaze-red, #a8003b)',
      border: `1.5px solid ${disabled ? '#b3b3b3' : 'var(--color-blaze-red, #a8003b)'}`
    },
    ghost: {
      background: 'transparent',
      color: disabled ? '#b3b3b3' : 'var(--color-blaze-red, #a8003b)',
      border: 'none'
    }
  };
  const style = {
    ...base,
    ...sizes[size],
    ...variants[variant]
  };
  if (href && !disabled) {
    return /*#__PURE__*/React.createElement("a", _extends({
      href: href,
      style: style
    }, rest), children);
  }
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    disabled: disabled,
    onClick: onClick,
    style: style
  }, rest), children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * BlazeMaster Card — content container for product specs, features, resources.
 * Near-square corners, subtle shadow, optional top-rule accent.
 */
function Card({
  children,
  accent = false,
  elevated = false,
  padding = 'md',
  onClick,
  style: styleProp,
  ...rest
}) {
  const paddings = {
    sm: '16px',
    md: '24px',
    lg: '32px'
  };
  const style = {
    background: '#ffffff',
    borderRadius: '2px',
    border: '1px solid var(--color-border, #b3b3b3)',
    boxShadow: elevated ? 'var(--shadow-md, 0 4px 12px rgba(0,0,0,0.10))' : 'var(--shadow-card, 0 2px 8px rgba(0,0,0,0.08))',
    padding: paddings[padding],
    position: 'relative',
    cursor: onClick ? 'pointer' : 'default',
    transition: elevated ? 'none' : 'box-shadow 150ms ease',
    ...(accent && {
      borderTop: '3px solid var(--color-blaze-red, #a8003b)'
    }),
    ...styleProp
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    style: style,
    onClick: onClick
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Tag.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * BlazeMaster Tag — product category label, filter chip, or classification marker.
 * Pill-shaped for compact filtering UI.
 */
function Tag({
  children,
  variant = 'default',
  removable = false,
  onRemove,
  ...rest
}) {
  const variants = {
    default: {
      background: 'var(--color-gray-10, #f0f0f0)',
      color: 'var(--color-gray-90, #333333)',
      border: '1px solid var(--color-border, #b3b3b3)'
    },
    brand: {
      background: 'rgba(168,0,59,0.08)',
      color: 'var(--color-blaze-red, #a8003b)',
      border: '1px solid rgba(168,0,59,0.25)'
    },
    dark: {
      background: 'var(--color-gray-90, #333)',
      color: '#fff',
      border: 'none'
    },
    warm: {
      background: 'var(--color-warm-cream, #ebe6d4)',
      color: 'var(--color-gray-90, #333)',
      border: '1px solid #d5cdb5'
    }
  };
  const style = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontFamily: "'Roboto', sans-serif",
    fontSize: '12px',
    fontWeight: 500,
    letterSpacing: '0.04em',
    padding: '4px 12px',
    borderRadius: '9999px',
    lineHeight: 1,
    whiteSpace: 'nowrap',
    ...variants[variant]
  };
  return /*#__PURE__*/React.createElement("span", _extends({
    style: style
  }, rest), children, removable && /*#__PURE__*/React.createElement("button", {
    onClick: onRemove,
    style: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: 0,
      lineHeight: 1,
      color: 'inherit',
      opacity: 0.6,
      fontSize: '14px'
    },
    "aria-label": "Remove"
  }, "\xD7"));
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tag.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Tag = __ds_scope.Tag;

})();
