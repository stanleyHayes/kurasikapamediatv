import type { Route } from 'next'

/**
 * A redirect target that belongs to the OTHER deployment.
 *
 * `typedRoutes` types `redirect()`'s argument as a route this app declares —
 * exactly right for internal navigation, and exactly wrong for the only two
 * destinations that leave the studio: the public site's sign-in, and its
 * homepage for a signed-in reader who may not draft. Both are absolute URLs
 * built from `web-kit/composition/origins`, and neither is a route the
 * studio's router has ever heard of.
 *
 * The cast lives here, in one function with one reason, rather than at each
 * call site — `as Route` sprinkled through page code would eventually hide a
 * genuine typo in an internal path, which is the bug typedRoutes exists to
 * catch.
 */
export const externalRoute = (url: string): Route => url as Route
