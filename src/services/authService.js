"use strict";

const crypto = require("crypto");
const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,16}$/;

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

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

function validateUsername(username) {
  const value = String(username || "").trim();
  if (!USERNAME_PATTERN.test(value)) {
    const error = new Error("Username must be 3-16 characters and use only letters, numbers, and underscores.");
    error.status = 400;
    throw error;
  }
  return value;
}

function deriveUsername(value) {
  const cleaned = String(value || "player").split("@")[0].replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || "player";
  return (cleaned.length < 3 ? `${cleaned}___`.slice(0, 3) : cleaned).slice(0, 16);
}

function allocateUsername(store, requested) {
  const seed = deriveUsername(requested);
  let candidate = seed;
  let suffix = 1;
  while (store.usersByUsername?.has(normalizeUsername(candidate))) {
    const tag = String(suffix);
    candidate = `${seed.slice(0, Math.max(3, 16 - tag.length))}${tag}`;
    suffix += 1;
  }
  return candidate;
}

function sanitizeProfile(profile) {
  const settings = profile.settings || {};
  return {
    userId: profile.userId,
    username: profile.username || profile.displayName,
    normalizedUsername: profile.normalizedUsername || normalizeUsername(profile.username || profile.displayName),
    usernameLastChangedAt: profile.usernameLastChangedAt || null,
    displayName: profile.username || profile.displayName,
    friendCode: profile.friendCode,
    coins: profile.coins,
    selectedCoreCardId: profile.selectedCoreCardId,
    tutorialState: profile.tutorialState,
    settings: {
      font: settings.font || "poppins"
    },
    freePacks: profile.freePacks || {},
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt
  };
}

function createAuthService(store) {
  function register({ email, password, username, displayName }) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const cleanUsername = username ? validateUsername(username) : allocateUsername(store, displayName || normalizedEmail);
    const normalizedUsername = normalizeUsername(cleanUsername);
    if (!normalizedEmail.includes("@")) throw Object.assign(new Error("Valid email is required."), { status: 400 });
    if (String(password || "").length < 8) throw Object.assign(new Error("Password must be at least 8 characters."), { status: 400 });
    if (store.usersByEmail.has(normalizedEmail)) throw Object.assign(new Error("Email is already registered."), { status: 409 });
    if (store.usersByUsername?.has(normalizedUsername)) throw Object.assign(new Error("Username is already taken."), { status: 409 });

    const { user, profile } = store.createUser({
      email: normalizedEmail,
      passwordHash: hashPassword(password),
      username: cleanUsername,
      normalizedUsername,
      friendCode: makeFriendCode(store)
    });
    const token = createSession(user.id);
    return { token, user: { id: user.id, email: user.email, username: user.username }, profile: sanitizeProfile(profile) };
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
    return { token, user: { id: user.id, email: user.email, username: user.username }, profile: sanitizeProfile(store.profiles.get(user.id)) };
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

module.exports = { createAuthService, hashPassword, normalizeUsername, validateUsername, verifyPassword };
