# yuminmusic

Discord music bot สำหรับ VTuber สาวไทย **yuminyui (ยุย)** — ควบคุมผ่าน embed message แบบ persistent ในช่อง text channel กดปุ่มเพื่อเปิดเพลงจาก YouTube / Spotify / SoundCloud มีระบบคิว โหวตข้ามเพลง และข้อความน่ารัก ๆ สไตล์ยุย

## Features

- 🎵 เล่นเพลงจาก **YouTube, Spotify (แปลงเป็น YT), SoundCloud, Apple Music**
- 🖱️ ควบคุมทุกอย่างผ่าน **button + modal** (ไม่ต้องพิมพ์ command)
- 📜 ระบบคิว in-memory พร้อมแสดงเพลงถัดไป
- 🗳️ โหวตข้ามเพลง (admin / DJ / คนขอ force skip ได้)
- 🔁 Loop off / track / queue
- 💤 Disconnect อัตโนมัติเมื่อ idle
- 🇹🇭 ข้อความภาษาไทยน่ารัก ๆ
- 🐳 Docker-first — รันบน VPS สเปคต่ำได้ (~250–400MB RAM)

## Quick Start

### 1. สร้าง Discord Application

1. ไปที่ https://discord.com/developers/applications → **New Application**
2. ตั้งชื่อ `yuminmusic` → ไปแท็บ **Bot** → **Reset Token** → copy token
3. ไปแท็บ **Installation** → ตั้ง **Install Link** = None (จะเชิญเอง)
4. ใน **OAuth2 → URL Generator** เลือก scope: `bot`, `applications.commands`
5. Bot permissions: `View Channels`, `Send Messages`, `Embed Links`, `Attach Files`, `Read Message History`, `Use External Emojis`, `Connect`, `Speak`
6. Copy URL ที่ได้ → เปิดในเบราว์เซอร์ → เลือก guild → Authorize

### 2. Setup Environment

```bash
cp .env.example .env
```

แก้ค่าใน `.env`:
- `DISCORD_TOKEN` — จาก Bot tab
- `DISCORD_CLIENT_ID` — จาก General Information
- `GUILD_ID` — คลิกขวา server → Copy Server ID (เปิด Developer Mode ใน Discord Settings ก่อน)
- `ADMIN_ROLE_ID`, `DJ_ROLE_ID` — คลิกขวา role → Copy Role ID

### 3. วางไฟล์ asset ของยุย

ดูที่ [`assets/README.md`](assets/README.md)

### 4. รันแบบ local (ต้องมี Node 20+ และ ffmpeg)

```bash
npm install
npm run dev
```

### 5. รันบน Docker (แนะนำ — OrbStack ตอนเทส, VPS ตอน production)

**Test local (OrbStack):** uncomment ส่วน `build:` ใน `docker-compose.yml` แล้ว comment บรรทัด `image:`

```bash
docker compose up --build
```

**Deploy บน VPS** (pull image จาก GHCR):

```bash
# 1. ตั้งค่า VPS ให้ login GHCR (ใช้ PAT ที่มี read:packages)
echo $GHCR_TOKEN | docker login ghcr.io -u <github-username> --password-stdin

# 2. copy ไฟล์ที่จำเป็นขึ้น VPS
scp .env user@vps:/opt/yuminmusic/.env
scp docker-compose.yml user@vps:/opt/yuminmusic/
scp -r assets/ user@vps:/opt/yuminmusic/

# 3. pull + start
ssh user@vps "cd /opt/yuminmusic && docker compose pull && docker compose up -d"
```

### 6. ใช้งาน

1. Invite bot → server
2. พิมพ์ `/setup` ในช่อง text ที่อยากให้มี panel (ต้องเป็น admin)
3. Bot จะส่ง embed พร้อมปุ่มควบคุม
4. เข้า voice channel → กด ▶️ **เล่นเพลง** → วาง URL หรือพิมพ์ชื่อเพลง

## Slash Commands

| Command | สิทธิ์ | คำอธิบาย |
|---|---|---|
| `/setup` | admin | สร้าง panel ในช่องปัจจุบัน |
| `/reload` | admin | สร้าง panel ใหม่ |
| `/disconnect` | admin | บังคับออกจาก voice |

## Buttons (อยู่บน panel)

| ปุ่ม | สิทธิ์ | ทำอะไร |
|---|---|---|
| ▶️ เล่นเพลง | ทุกคน | เปิด modal ขอ URL/keyword |
| ⏸️ หยุดชั่วคราว | ทุกคน | toggle pause/resume |
| ⏭️ ข้ามเพลง | ทุกคน | เริ่มโหวต (admin/DJ/คนขอ = force) |
| 📜 คิว | ทุกคน | ephemeral queue list |
| 🔁 ลูป | DJ+ | off → track → queue |
| 🛑 หยุด | DJ+ | stop + clear queue + disconnect |

## Env Reference

| Var | Default | คำอธิบาย |
|---|---|---|
| `DISCORD_TOKEN` | — | **required** |
| `DISCORD_CLIENT_ID` | — | **required** |
| `GUILD_ID` | — | **required** — slash command จะลงเฉพาะ guild นี้ |
| `ADMIN_ROLE_ID` | "" | role ที่มีอำนาจเต็ม |
| `DJ_ROLE_ID` | "" | role ที่คุม playback ได้ |
| `SKIP_VOTE_RATIO` | 0.5 | 0-1 สัดส่วนโหวตที่ต้องการ |
| `IDLE_DISCONNECT_MS` | 300000 | disconnect หลัง idle (ms) |
| `DEFAULT_VOLUME` | 50 | 0-100 |
| `PANEL_BANNER_PATH` | ./assets/banner.png | path รูป banner |
| `PANEL_GIF_PATH` | ./assets/yui-idle.gif | path gif thumbnail |
| `LOG_LEVEL` | info | trace \| debug \| info \| warn \| error \| fatal |

## Architecture

```
src/
├── index.ts              # bootstrap
├── config.ts             # zod env validation
├── logger.ts             # pino
├── client.ts             # discord.js Client
├── player/               # discord-player + events + skip vote
├── commands/             # /setup /reload /disconnect
├── interactions/         # router + buttons + modals
├── ui/                   # embed builders + message bank
└── auth/                 # role checks
```

## License

MIT — ดู [LICENSE](LICENSE)
