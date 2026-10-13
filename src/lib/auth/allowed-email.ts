export const isAllowedEmail = (email: string) =>
  /^[^@\s]+@umak\.edu\.ph$/i.test(email.trim());
