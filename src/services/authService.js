"use strict";

const crypto = require("crypto");

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 210000, 32, "sha256").toString("hex");
  return `pbkdf2_sha256$${salt}$${hash}`;
}

function verifyPassword(password, encoded) {
  const [scheme, salt, expectedHash] = encoded.split("$");
  if (scheme !== "pbkdf2_sha256" || !salt || !expectedHash) return false;
  const actual = hashPassword(password, salt).split("$")[2];
  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expectedHash, "hex"));
}

function makeFriendCode(store) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const code = `BBY-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    if (!store.profilesByFriendCode.has(code)) return code;
  }
  throw new Error("Unable to allocate friend code.");
}

function sanitizeProfile(profile) {
  return {
    userId: profile.userId,
    displayName: profile.displayName,
    friendCode: profile.friendCode,
    coins: profile.coins,
    selectedCoreCardId: profile.selectedCoreCardId,
    tutorialState: profile.tutorialState,
    freePacks: profile.freePacks || {},
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt
  };
}

function createAuthService(store) {
  function register({ email, password, displayName }) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail.includes("@")) throw Object.assign(new Error("Valid email is required."), { status: 400 });
    if (String(password || "").length < 8) throw Object.assign(new Error("Password must be at least 8 characters."), { status: 400 });
    if (!displayName || String(displayName).trim().length < 2) throw Object.assign(new Error("Display name is required."), { status: 400 });
    if (store.usersByEmail.has(normalizedEmail)) throw Object.assign(new Error("Email is already registered."), { status: 409 });

    const { user, profile } = store.createUser({
      email: normalizedEmail,
      passwordHash: hashPassword(password),
      displayName: String(displayName).trim(),
      friendCode: makeFriendCode(store)
    });
    const token = createSession(user.id);
    return { token, user: { id: user.id, email: user.email }, profile: sanitizeProfile(profile) };
  }

  function createSession(userId) {
    const token = crypto.randomBytes(32).toString("hex");
    store.sessions.set(token, { userId, createdAt: new Date().toISOString() });
    return token;
  }

  function login({ email, password }) {
    const user = store.usersByEmail.get(String(email || "").trim().toLowerCase());
    if (!user || !verifyPassword(String(password || ""), user.passwordHash)) {
      throw Object.assign(new Error("Invalid email or password."), { status: 401 });
    }
    const token = createSession(user.id);
    return { token, user: { id: user.id, email: user.email }, profile: sanitizeProfile(store.profiles.get(user.id)) };
  }

  function authenticate(headers) {
    const header = headers.authorization || "";
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) throw Object.assign(new Error("Bearer token is required."), { status: 401 });
    const session = store.sessions.get(match[1]);
    if (!session) throw Object.assign(new Error("Invalid session."), { status: 401 });
    const user = store.users.get(session.userId);
    if (!user) throw Object.assign(new Error("Invalid session."), { status: 401 });
    return user;
  }

  return { register, login, authenticate, sanitizeProfile };
}

module.exports = { createAuthService, hashPassword, verifyPassword };
