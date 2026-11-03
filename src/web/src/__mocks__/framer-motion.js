// Automatic jest mock for framer-motion (applies to every test suite).
//
// In jsdom, framer-motion's <AnimatePresence mode="wait"> never completes the
// exit animation, so the outgoing child stays mounted and the incoming one is
// never rendered (tab/section switches silently do nothing in tests). Render
// motion.* as their plain DOM elements and AnimatePresence as a fragment.
const React = require('react');

const MOTION_PROPS = [
  'initial', 'animate', 'exit', 'transition', 'variants', 'layout', 'layoutId',
  'whileHover', 'whileTap', 'whileFocus', 'whileDrag', 'whileInView', 'viewport',
  'drag', 'dragConstraints', 'dragElastic', 'dragMomentum', 'dragListener', 'dragControls',
  'onAnimationStart', 'onAnimationComplete', 'onDragStart', 'onDragEnd', 'onDrag',
  'onHoverStart', 'onHoverEnd', 'onTap', 'onTapStart', 'onTapCancel', 'onViewportEnter', 'onViewportLeave',
  'custom', 'inherit', 'transformTemplate', 'layoutScroll', 'layoutDependency',
  // Reorder
  'axis', 'values', 'onReorder', 'value', 'as',
];

// Layout-relevant `animate` targets are rendered as the element's settled
// inline style (e.g. a sidebar animating width 240 <-> 72), so tests can assert
// the end state. Transform-ish keys (x, y, scale, rotate) are ignored.
const STYLE_KEYS = ['width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight', 'opacity', 'backgroundColor', 'color'];
const PX_KEYS = ['width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight'];

const strip = (props) => {
  const out = { ...props };
  const { animate } = props;
  if (animate && typeof animate === 'object' && !Array.isArray(animate)) {
    const style = {};
    STYLE_KEYS.forEach((k) => {
      if (animate[k] === undefined || Array.isArray(animate[k])) return;
      style[k] = PX_KEYS.includes(k) && typeof animate[k] === 'number' ? `${animate[k]}px` : animate[k];
    });
    if (Object.keys(style).length) out.style = { ...style, ...(props.style || {}) };
  }
  MOTION_PROPS.forEach((k) => { delete out[k]; });
  return out;
};

const cache = {};
// One stable component per tag: a new component type each render would
// remount the subtree (losing input focus/state).
const make = (tag) => {
  if (!cache[tag]) {
    const C = React.forwardRef(({ children, ...props }, ref) => React.createElement(tag, { ref, ...strip(props) }, children));
    C.displayName = `motion.${String(tag)}`;
    cache[tag] = C;
  }
  return cache[tag];
};

const motion = new Proxy(function motionFactory(Component) { return Component; }, {
  get: (target, tag) => (typeof tag === 'string' ? make(tag) : target[tag]),
  apply: (target, thisArg, [Component]) => Component,
});

const AnimatePresence = ({ children }) => React.createElement(React.Fragment, null, children);
const LayoutGroup = ({ children }) => React.createElement(React.Fragment, null, children);
const MotionConfig = ({ children }) => React.createElement(React.Fragment, null, children);

const ReorderGroup = React.forwardRef(({ children, as = 'ul', ...props }, ref) => React.createElement(as, { ref, ...strip(props) }, children));
const ReorderItem = React.forwardRef(({ children, as = 'li', ...props }, ref) => React.createElement(as, { ref, ...strip(props) }, children));
const Reorder = { Group: ReorderGroup, Item: ReorderItem };

const motionValue = (v) => ({ get: () => v, set: () => {}, on: () => () => {}, onChange: () => () => {}, destroy: () => {} });
const noopControls = () => ({ start: () => Promise.resolve(), stop: () => {}, set: () => {} });

module.exports = {
  __esModule: true,
  motion,
  m: motion,
  AnimatePresence,
  LayoutGroup,
  MotionConfig,
  Reorder,
  useAnimation: noopControls,
  useAnimationControls: noopControls,
  useMotionValue: motionValue,
  useTransform: () => motionValue(0),
  useSpring: (v) => motionValue(v),
  useScroll: () => ({ scrollX: motionValue(0), scrollY: motionValue(0), scrollXProgress: motionValue(0), scrollYProgress: motionValue(0) }),
  useInView: () => true,
  useReducedMotion: () => true,
  useDragControls: () => ({ start: () => {} }),
  useIsPresent: () => true,
  usePresence: () => [true, null],
};
