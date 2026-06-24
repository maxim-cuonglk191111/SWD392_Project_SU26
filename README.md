# BẢN MÔ TẢ CHI TIẾT DỰ ÁN PHẦN MỀM LUCY

## 1. Tổng quan dự án
- **Tên dự án:** LUCY (Language Unity & Collaborative Youth)
- **Mô hình:** Mạng xã hội âm thanh kết hợp EdTech (Học tập qua giao tiếp).
- **Mục tiêu:** Xây dựng môi trường giao tiếp ngôn ngữ (Anh - Trung - Nhật) real-time, giảm áp lực tâm lý qua cơ chế ẩn danh và chuẩn hóa lộ trình học tập qua hệ thống LMS.

## 2. Phân tầng người dùng và Tính năng
**LUCY (Người dùng Ẩn danh)**
- Đối tượng: Gen Z, người mới bắt đầu học ngôn ngữ, người ngại giao tiếp.
- Cơ chế ẩn danh: Sử dụng Avatar Persona ảo, không hiển thị danh tính thật.
- Tính năng: Tham gia phòng theo Level, giơ tay phát biểu, tặng quà ảo cho Mentor.

**LUCY Pro (Mentor/Hiện danh)**
- Đối tượng: Chuyên gia, giáo viên, người có trình độ ngôn ngữ cao.
- Tính năng: Tạo phòng dạy học dựa trên giáo trình (LISA, Chinese, Japanese), ghim tài liệu học tập, quản lý lộ trình học.
- Monetization: Nhận quà từ học viên, xây dựng uy tín cá nhân trên bảng xếp hạng.

**LUCY Super (Content Creator)**
- Đối tượng: Influencer, người sáng tạo nội dung chuyên sâu.
- Tính năng: Bao gồm quyền Pro + ghi âm buổi Live thành Podcast, tạo chuỗi nội dung thu phí (Premium Content).

## 3. Kiến trúc kỹ thuật (Microservices)
| Thành phần | Công nghệ | Vai trò |
| --- | --- | --- |
| **Real-time Service** | Node.js (NJS) | Xử lý Audio (Agora SDK), Socket.io điều phối phòng. |
| **Content & LMS** | Java (Spring) | Số hóa 100 level ngôn ngữ, quản lý giáo trình và logic học tập. |
| **User & Payment** | .NET Core | Quản lý Identity, ví điện tử, quà tặng và bảo mật danh tính. |
| **Mobile App** | Flutter | Ứng dụng đa nền tảng (iOS/Android) với trải nghiệm mượt mà. |

## 4. Kế hoạch triển khai 10 tuần (Team 5 Dev)
- **Tuần 1-2:** Thiết lập hạ tầng, số hóa tài liệu từ 8 file Word (LISA/Chinese/Japanese) vào Database Java.
- **Tuần 3-5:** Xây dựng core Real-time Audio (NJS + Agora). Mobile tích hợp tính năng phòng cơ bản.
- **Tuần 6-7:** Phát triển công cụ LMS cho Pro (Java) và tính năng Record Podcast cho Super (NJS).
- **Tuần 8-9:** Tích hợp hệ thống thanh toán, quà tặng (.NET) và hiệu ứng tương tác Mobile.
- **Tuần 10:** Stress test hệ thống, fix bug và chuẩn bị bản Beta Launch.

## 5. Cấu trúc nội dung (Dữ liệu cốt lõi)
Hệ thống tự động hóa việc đưa nội dung từ các file tài liệu vào phòng Live:
- Cấp độ: Chia làm 3 Stage (Sơ cấp, Trung cấp, Cao cấp).
- Cấu trúc phòng: Mỗi phòng 60-120 phút, chia nhỏ thành các chặng 10-20 phút (Sub-levels).
- AI Support: Gợi ý câu hỏi thảo luận lên màn hình của Moderator dựa trên tài liệu LISA/Chinese/Japanese đã upload.

## 6. Quản lý rủi ro
1. **Độ trễ âm thanh:** Sử dụng Agora thay vì tự xây dựng Server để đảm bảo ổn định quốc tế.
2. **Rò rỉ danh tính:** Hệ thống định danh được cô lập hoàn toàn trong .NET Service, chỉ trả về Token ẩn danh cho Node.js.
3. **Xung đột API:** Dùng Swagger làm tài liệu chung cho 5 Dev, cập nhật hàng ngày.

Link demo: https://swd392-project-su26.onrender.com
