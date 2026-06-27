// Tiny classnames helper (avoids an extra dependency).
export function clsx(...args) {
  return args.filter(Boolean).join(' ');
}
