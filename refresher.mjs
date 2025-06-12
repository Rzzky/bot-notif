import axios from 'axios';
import fs from 'fs/promises';
import { CookieJar, Cookie } from 'tough-cookie';

const COOKIE_FILE = './cookies.json';
const TARGET_URL = 'https://chatgpt.com/api/auth/session';
const BOT_TOKEN = 'BOT_TOKEN';
const CHAT_ID = 'CHAT_ID';

async function sendTelegram(message) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  try {
    await axios.post(url, {
      chat_id: CHAT_ID,
      text: message,
      parse_mode: "Markdown"
    });
  } catch (err) {
    console.error("❌ ERROR:", err.message);
  }
}

async function loadAndConvertCookies() {
  const raw = JSON.parse(await fs.readFile(COOKIE_FILE, 'utf-8'));
  const converted = raw.map(c => ({
    key: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path || '/',
    httpOnly: !!c.httpOnly,
    secure: !!c.secure,
    expires: c.expirationDate
      ? new Date(c.expirationDate * 1000).toISOString()
      : undefined
  }));

  const jar = new CookieJar();
  for (const c of converted) {
    const cookie = Cookie.fromJSON(c);
    if (cookie) jar.setCookieSync(cookie, TARGET_URL);
  }

  const cookieHeader = await jar.getCookieString(TARGET_URL);
  return { jar, cookieHeader };
}

async function saveCookiesToJSON(jar) {
  const cookies = await jar.getCookies(TARGET_URL);
  const formatted = cookies.map(c => ({
    domain: c.domain,
    expirationDate: c.expires ? new Date(c.expires).getTime() / 1000 : undefined,
    httpOnly: c.httpOnly,
    name: c.key,
    path: c.path,
    sameSite: "lax",
    secure: c.secure,
    session: !c.expires,
    storeId: null,
    value: c.value
  }));

  await fs.writeFile(COOKIE_FILE, JSON.stringify(formatted, null, 2));
}

export async function refreshSession() {
  try {
    const { jar, cookieHeader } = await loadAndConvertCookies();

    const res = await axios.get(TARGET_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Cookie': cookieHeader,
        'Referer': 'https://chatgpt.com/',
        'Origin': 'https://chatgpt.com',
        'Accept': 'application/json'
      }
    });

    const now = new Date().toLocaleString();

    if (res.status === 200 && res.data?.user?.email) {
      const email = res.data.user.email;
      const exp = res.data.expires;
      console.log(`✅ Session valid`);
      await sendTelegram(`✅ *ChatGPT session still valid*\n👤 *${email}*\n🕒 *Expires at:* \`${exp}\`\n📅 Checked: ${now}`);
    } else if (res.status === 200 && Object.keys(res.data).length === 0) {
      console.log("⚠️ Session responded");
      await sendTelegram(`⚠️ *Session ping success*, but *user data missing*`);
    } else {
      console.log("❌ SESSION EXPIRED");
      await sendTelegram(`❌ *SESSION EXPIRED*\n🕒 ${now}`);
    }

    await saveCookiesToJSON(jar);

  } catch (err) {
    const now = new Date().toLocaleString();
    console.error("❌ FAILED:", err.message);
    await sendTelegram(`❌ *FAILED* (${now})\n\`${err.message}\``);
  }
}
