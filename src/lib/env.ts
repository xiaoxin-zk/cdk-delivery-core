export const env = {
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  jwtSecret: process.env.JWT_SECRET ?? "",
  appSecret: process.env.APP_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  redisUrl: process.env.REDIS_URL ?? "",
  nodeEnv: process.env.NODE_ENV ?? "development"
};

export function requireSecret(name: "JWT_SECRET" | "APP_SECRET") {
  const value = name === "JWT_SECRET" ? env.jwtSecret : env.appSecret;
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}
