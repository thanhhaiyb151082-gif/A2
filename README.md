# QUIZ SURVIVAL – AI CHALLENGE

Ứng dụng trò chơi trắc nghiệm loại dần theo thời gian thực, sử dụng **Node.js, Express và Socket.IO**.

## 1. Chức năng

- 8 câu hỏi chủ đề Trí tuệ nhân tạo (AI).
- 30 giây cho mỗi câu hỏi.
- Giới hạn số người đi tiếp: **50, 40, 30, 20, 10, 6, 3, 1**.
- Chỉ đáp án đúng mới được xếp hạng; xếp theo thời gian server nhận đáp án.
- Mỗi người chỉ được gửi một đáp án trong mỗi vòng.
- Người bị loại chuyển sang chế độ theo dõi và vẫn nhận cập nhật.
- Trang quản trị có mật khẩu, cho phép bắt đầu, chuyển vòng và đặt lại.
- Trạng thái chính của game lưu trong RAM của một tiến trình Node.js.
- Có endpoint kiểm tra sức khỏe `/health`.

> **Lưu ý về dữ liệu:** Đây là phiên bản RAM-first. Nếu tiến trình khởi động lại, dữ liệu người chơi và trạng thái đang chạy sẽ mất. Không triển khai nhiều instance/replica cho phiên bản này. Bản sao lưu kết quả vào file JSON chưa được bật trong mã nguồn cơ sở; muốn bảo toàn dữ liệu qua lần khởi động lại cần bổ sung persistent storage hoặc database.

## 2. Cấu trúc thư mục

```text
quiz-survival/
├── package.json
├── server.js
├── .env.example
├── .gitignore
├── README.md
├── config/
│   └── game.config.js
├── data/
│   └── questions.json
├── src/
│   ├── core/
│   │   ├── gameState.js
│   │   ├── gameEngine.js
│   │   ├── timerEngine.js
│   │   ├── answerEngine.js
│   │   └── rankingEngine.js
│   └── socket/
│       └── index.js
└── public/
    ├── index.html
    ├── admin.html
    ├── css/
    │   ├── style.css
    │   └── admin.css
    └── js/
        ├── player.js
        └── admin.js
```

## 3. Chạy thử trên máy tính

### Yêu cầu

- Node.js 20 trở lên.
- npm.

### Các bước

1. Giải nén thư mục dự án.
2. Mở Terminal/Command Prompt tại thư mục `quiz-survival`.
3. Cài thư viện:

```bash
npm install
```

4. Tạo file `.env` từ `.env.example`.

macOS/Linux:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

5. Mở `.env`, thay mật khẩu quản trị:

```env
PORT=3000
NODE_ENV=development
ADMIN_PASSWORD=thay-bang-mat-khau-rieng-dai-va-kho-doan
```

Không chia sẻ mật khẩu này cho người chơi và không đưa file `.env` lên GitHub.

6. Khởi chạy:

```bash
npm start
```

Mở:

- Người chơi: http://localhost:3000/
- Quản trị: http://localhost:3000/admin
- Kiểm tra server: http://localhost:3000/health

Để dừng server, nhấn `Ctrl + C`.

## 4. Upload dự án lên GitHub

### Cách A – Upload bằng giao diện website GitHub

1. Đăng nhập GitHub.
2. Chọn **New repository**.
3. Đặt tên, ví dụ `quiz-survival`.
4. Chọn Public hoặc Private tùy nhu cầu.
5. Không cần tạo README, `.gitignore` hoặc license mới nếu dự án đã có các file này.
6. Tạo repository.
7. Trong repository, chọn **Add file → Upload files**.
8. Kéo thả các thư mục và file của dự án vào vùng upload. Đảm bảo giữ nguyên cấu trúc thư mục.
9. Không upload `node_modules/` và `.env`.
10. Nhập nội dung commit, ví dụ `Initial Quiz Survival project`, rồi chọn **Commit changes**.

GitHub hướng dẫn thao tác tại:
https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository

### Cách B – Upload bằng Git trên máy tính

Mở Terminal tại thư mục dự án:

```bash
git init
git add .
git commit -m "Initial Quiz Survival project"
git branch -M main
git remote add origin https://github.com/USERNAME/quiz-survival.git
git push -u origin main
```

Thay `USERNAME` bằng tên tài khoản GitHub và kiểm tra URL repository trước khi chạy lệnh.

Nếu Git yêu cầu đăng nhập, hoàn tất bước xác thực theo hướng dẫn của GitHub.

## 5. Triển khai lên Render

Render chạy ứng dụng Express dưới dạng **Web Service**, không phải Static Site, vì ứng dụng cần Node.js và WebSocket.

Tài liệu chính thức:
- https://render.com/docs/deploy-node-express-app
- https://render.com/docs/web-services
- https://render.com/docs/free

### Các bước

1. Đăng nhập https://render.com/
2. Kết nối tài khoản GitHub.
3. Chọn **New → Web Service**.
4. Chọn repository `quiz-survival`.
5. Cấu hình:

| Trường | Giá trị |
|---|---|
| Name | `quiz-survival-ai` |
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Health Check Path | `/health` |

6. Chọn gói dịch vụ phù hợp. Nếu chỉ thử nghiệm, kiểm tra xem Free instance có đang được cung cấp cho tài khoản và khu vực của bạn hay không.
7. Trong phần **Environment Variables**, thêm:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `ADMIN_PASSWORD` | Mật khẩu quản trị riêng, dài và khó đoán |

Không cần tự đặt `PORT`; Render cấp biến này cho ứng dụng.

8. Chọn **Create Web Service** và chờ quá trình build/deploy hoàn tất.
9. Render cấp địa chỉ dạng:

```text
https://quiz-survival-ai.onrender.com
```

Đây là ví dụ minh họa; tên miền thật do Render cấp.

10. Truy cập:
    - Trang người chơi: `https://TEN-MIEN-RENDER/`
    - Trang quản trị: `https://TEN-MIEN-RENDER/admin`
    - Health check: `https://TEN-MIEN-RENDER/health`

Sau khi kết nối GitHub, các lần push lên nhánh đã liên kết có thể kích hoạt tự động deploy.

### Lưu ý rất quan trọng khi dùng Render Free

- Free Web Service có thể tự sleep sau thời gian không có hoạt động và cần thời gian khởi động lại khi có lượt truy cập mới.
- Tiến trình khởi động lại sẽ làm mất trạng thái đang lưu trong RAM.
- Không nên dùng gói miễn phí làm hạ tầng duy nhất cho một sự kiện quan trọng cần hoạt động liên tục.
- Nếu tổ chức sự kiện trực tiếp, nên cân nhắc instance luôn hoạt động, thử nghiệm trước và có phương án dự phòng.

## 6. Triển khai lên Railway

Tài liệu chính thức:
- https://docs.railway.com/quick-start
- https://railway.com/guides/express

### Các bước

1. Đăng nhập https://railway.com/
2. Tạo Project mới.
3. Chọn **Deploy from GitHub Repo**.
4. Kết nối GitHub nếu Railway yêu cầu.
5. Chọn repository `quiz-survival`.
6. Railway tự nhận diện ứng dụng Node.js từ `package.json`.
7. Mở phần **Variables** của service và thêm:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `ADMIN_PASSWORD` | Mật khẩu quản trị riêng |

Không cần tự đặt `PORT` nếu Railway đã cấp biến này.

8. Chờ Railway build và deploy.
9. Mở phần **Settings → Networking** của service.
10. Chọn **Generate Domain** để tạo URL public.
11. Truy cập domain vừa tạo:
    - Người chơi: `https://TEN-MIEN-RAILWAY/`
    - Quản trị: `https://TEN-MIEN-RAILWAY/admin`

Kiểm tra log nếu deployment thất bại. Đảm bảo lệnh start là `npm start`.

### Chi phí Railway

Railway có thể yêu cầu gói dịch vụ hoặc thanh toán theo mức sử dụng. Chính sách, credit dùng thử và giá có thể thay đổi; hãy kiểm tra trang Pricing trước khi triển khai:
https://railway.com/pricing

## 7. Cách vận hành trò chơi

1. Ban tổ chức mở `/admin`, nhập mật khẩu quản trị.
2. Người chơi quét QR hoặc mở URL trang chủ.
3. Người chơi nhập họ tên và lớp/đơn vị.
4. Ban tổ chức kiểm tra danh sách người tham gia.
5. Nhấn **Bắt đầu vòng 1**.
6. Mỗi câu có 30 giây; server tự động đóng câu khi hết giờ.
7. Server lọc đáp án đúng, xếp theo thời gian nhận ở server và chọn Top-N.
8. Người không vượt qua chuyển sang chế độ theo dõi.
9. Ban tổ chức nhấn **Chuyển vòng tiếp theo** sau khi xem kết quả.
10. Sau câu 8, hệ thống công bố Quán quân nếu có người trả lời đúng.

## 8. Quy tắc thời gian và công bằng

- Thời gian phản hồi được đo bằng đồng hồ đơn điệu `performance.now()` tại server.
- Thời điểm nhận thực tế được lưu bằng `Date.now()` tại server.
- Đồng hồ ở trình duyệt chỉ phục vụ hiển thị; server quyết định thời hạn.
- Nếu hai người có cùng thời gian làm tròn đến mili-giây, hệ thống ưu tiên yêu cầu được server tiếp nhận trước.
- Tốc độ mạng vẫn có thể ảnh hưởng đến thời điểm server nhận đáp án. Nên sử dụng Wi-Fi ổn định và kiểm thử tại địa điểm tổ chức.

## 9. Các giới hạn của phiên bản hiện tại

1. Trạng thái game lưu trong RAM; restart/redeploy làm mất phiên đang chạy.
2. Chỉ nên chạy một instance/replica.
3. Đăng ký người chơi mới khóa khi trò chơi đã bắt đầu; người đã có mã kết nối có thể reconnect khi tiến trình vẫn còn.
4. Chưa có database hoặc hệ thống lưu lịch sử lâu dài.
5. Chưa có trang trình chiếu riêng; có thể trình chiếu trang quản trị hoặc phát triển thêm `screen.html`.
6. Bộ câu hỏi mẫu nằm trong `data/questions.json`; cần kiểm tra và thay nội dung phù hợp với chương trình sự kiện trước khi sử dụng.

## 10. Checklist trước ngày tổ chức

- [ ] Đã triển khai thành công và mở được URL public.
- [ ] Đã đổi mật khẩu quản trị.
- [ ] Đã kiểm tra trên điện thoại Android và iPhone.
- [ ] Đã thử đăng ký nhiều người chơi.
- [ ] Đã thử trả lời đúng, sai và không trả lời.
- [ ] Đã kiểm tra thời hạn 30 giây.
- [ ] Đã kiểm tra tự động loại và chế độ theo dõi.
- [ ] Đã kiểm tra kết nối lại.
- [ ] Đã thử tải với số lượng người dự kiến.
- [ ] Đã có mạng Internet và phương án dự phòng.

**Khuyến nghị:** Không thử nghiệm lần đầu ngay trong sự kiện. Hãy tổ chức một buổi chạy thử với số lượng thiết bị tương đương số người chơi thực tế.

## 11. Đăng nhập quản trị và xử lý lỗi mật khẩu

Từ phiên bản này, trang `/admin` gửi mật khẩu bằng `POST /api/admin/login` (HTTPS), nhận lại một mã phiên (8 giờ) rồi mới kết nối Socket.IO. Mật khẩu không còn đi qua Socket.IO.

- Mật khẩu đọc từ biến môi trường `ADMIN_PASSWORD` (Render: **Environment**). Khoảng trắng/xuống dòng thừa và dấu nháy bao quanh được tự loại bỏ.
- Mở `/health`: trường `adminPasswordConfigured` là `true` nghĩa là server đã nhận được biến (không hiển thị giá trị).
- **Nếu trang admin báo "Máy chủ chưa có biến ADMIN_PASSWORD"** (trên Render):
  1. Vào dịch vụ → **Environment** → **Add Environment Variable**: Key `ADMIN_PASSWORD`, Value là mật khẩu bạn chọn.
  2. Bấm **Save, rebuild, and deploy** (hoặc **Manual Deploy → Deploy latest commit**) và chờ trạng thái **Live**.
  3. Mở `https://TEN-MIEN-RENDER/health`, thấy `"adminPasswordConfigured": true` là xong, rồi đăng nhập `/admin`.
  Tên biến phải viết đúng `ADMIN_PASSWORD`; file `.env` chỉ có tác dụng khi chạy trên máy tính, không được đưa lên GitHub nên Render không đọc được.
- Tối đa 10 lần thử đăng nhập / 15 phút / IP.
- Khởi động lại server thì mã phiên mất, cần đăng nhập lại.
