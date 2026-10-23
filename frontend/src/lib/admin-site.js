// GymBro: the web build is only the admin panel (VITE_ADMIN_SITE=1, set on the web service). Friends
// use the phone app; the website opens with the admin password (views/AdminLogin.jsx).
export const ADMIN_SITE = import.meta.env.VITE_ADMIN_SITE === '1'
