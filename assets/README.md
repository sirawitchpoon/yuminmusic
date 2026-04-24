# Assets

วางไฟล์ banner และ gif ของยุยที่นี่ ชื่อตาม path ที่ตั้งใน `.env`:

| ไฟล์ | ค่า default ใน `.env` | ใช้ที่ |
|---|---|---|
| `banner.png` | `PANEL_BANNER_PATH=./assets/banner.png` | รูปใหญ่บน panel embed |
| `yui-idle.gif` | `PANEL_GIF_PATH=./assets/yui-idle.gif` | thumbnail เล็กบน panel |

## คำแนะนำ

- **banner.png**: แนะนำ aspect 3:1 หรือ 16:9 ขนาด ~900x300 หรือ 1200x400 px
- **yui-idle.gif**: ขนาดเล็ก 256x256 หรือ 320x320 px, ไฟล์ไม่เกิน 2MB
- ถ้าไม่วางไฟล์ bot จะโพสต์ panel โดยไม่มีรูป (ใช้แค่ emoji + ข้อความแทน)
- Docker build จะ copy โฟลเดอร์นี้เข้า image — วางก่อน build

## หมายเหตุ

ไฟล์ใน repo ตอนนี้เป็น placeholder เท่านั้น — แทนที่ด้วยไฟล์จริงได้เลยโดยไม่ต้องแก้ code
