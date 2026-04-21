import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

const parseEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf-8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
};

const rootDir = process.cwd();
parseEnvFile(path.join(rootDir, ".env.local"));
parseEnvFile(path.join(rootDir, ".env"));

const required = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
  "VITE_FIREBASE_DATABASE_URL",
];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing env var: ${key}`);
    process.exit(1);
  }
}

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
if (!email || !password) {
  console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD before running this script.");
  process.exit(1);
}

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  databaseURL: process.env.VITE_FIREBASE_DATABASE_URL,
};

const hashPin = (pinValue) =>
  createHash("sha256").update(String(pinValue).trim()).digest("hex");

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const credentials = await signInWithEmailAndPassword(auth, email, password);
const idToken = await credentials.user.getIdToken();

const dbUrl = process.env.VITE_FIREBASE_DATABASE_URL.replace(/\/+$/, "");

const auctionsRes = await fetch(`${dbUrl}/auctions.json?auth=${idToken}`);
if (!auctionsRes.ok) {
  console.error(`Failed to read auctions (${auctionsRes.status})`);
  process.exit(1);
}

const auctions = (await auctionsRes.json()) || {};
let migrated = 0;

for (const [auctionId, auctionData] of Object.entries(auctions)) {
  const teams = auctionData?.teams;
  if (!teams || typeof teams !== "object") continue;

  for (const [teamId, teamData] of Object.entries(teams)) {
    if (!teamData || typeof teamData !== "object") continue;
    if (teamData.pin_hash) continue;
    const legacyPin = teamData.pin;
    if (!legacyPin) continue;

    const updatedTeam = {
      ...teamData,
      pin_hash: hashPin(legacyPin),
      pin: null,
    };

    const writeRes = await fetch(
      `${dbUrl}/auctions/${auctionId}/teams/${teamId}.json?auth=${idToken}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedTeam),
      },
    );

    if (!writeRes.ok) {
      const body = await writeRes.text();
      console.error(
        `Failed migrating auction=${auctionId} team=${teamId} (${writeRes.status}): ${body}`,
      );
      process.exit(1);
    }
    migrated += 1;
  }
}

console.log(`PIN migration complete. Teams migrated: ${migrated}`);
