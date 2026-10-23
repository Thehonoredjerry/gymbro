// The GymBro server a phone build signs in to, set at build time (VITE_SERVER_URL). Empty means
// none: the phone app then offers openGym's own "connect to my server" onboarding instead.
import { MOBILE } from './mobile.js'

export const BUILTIN_SERVER = import.meta.env.VITE_SERVER_URL || ''
/** The built-in server this build signs in to, or '' (the web app and a build without one). */
export const builtinServer = () => (MOBILE ? BUILTIN_SERVER : '')
