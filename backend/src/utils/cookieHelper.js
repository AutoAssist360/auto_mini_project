
import { IS_PRODUCTION } from "../../config.js";

const accessCookieOptions = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: IS_PRODUCTION ? "none" : "lax",
  maxAge: 2 * 60 * 60 * 1000, // 2 hours (must exceed the 1h JWT expiry)
};

const refreshCookieOptions = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: IS_PRODUCTION ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: "/auth/refresh",
};

export const setAuthCookies = (
  res,
  accessToken,
  refreshToken
) => {
  res.cookie("accessToken", accessToken, accessCookieOptions);
  res.cookie("refreshToken", refreshToken, {
    ...refreshCookieOptions,
    path: "/", // also accessible for /auth/refresh
  });
};

export const clearAuthCookies = (res) => {
  // When clearing cross-domain cookies, you MUST provide the exact same options (secure, sameSite, path) 
  // that you used to set them, otherwise the browser won't delete them.
  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: IS_PRODUCTION ? "none" : "lax"
  });
  
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: IS_PRODUCTION ? "none" : "lax",
    path: "/"
  });
  
  res.clearCookie("authcookie");
};