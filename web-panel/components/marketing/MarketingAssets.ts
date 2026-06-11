export const mobileShots = Array.from(
  { length: 46 },
  (_, index) => `/landing/mobile/mobile-${String(index + 1).padStart(2, "0")}.jpeg`,
);

export const webShots = Array.from(
  { length: 26 },
  (_, index) => `/landing/web/web-${String(index + 1).padStart(2, "0")}.jpg`,
);
