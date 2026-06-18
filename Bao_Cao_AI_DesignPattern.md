# BÁO CÁO AI: ÁP DỤNG DESIGN PATTERN CHO LOGIC CHUYỂN ĐỔI STAGE (NODE.JS)

Dưới đây là nội dung báo cáo theo yêu cầu của RBL Giai đoạn 3 để giải quyết bài toán: *"Logic chuyển đổi Stage tự động (kết thúc 10 phút tự động nhảy sang chủ đề tiếp theo) trong Node.js"*.

---

## 1. Prompt đã dùng là gì?

**Prompt đề xuất cho sinh viên đã sử dụng:**
> *"Tôi đang xây dựng một Real-time Service bằng Node.js và Socket.io cho dự án LUCY. Mỗi phòng Live có thời lượng 60 phút, được chia thành 6 Sub-levels (Stage), mỗi Stage kéo dài đúng 10 phút. Khi hết 10 phút, hệ thống cần tự động chuyển sang Stage tiếp theo, cập nhật trạng thái phòng, tải bộ câu hỏi mới từ Database và thông báo cho tất cả người dùng (Broadcast) qua Socket.io.*
> *Thay vì sử dụng các câu lệnh `if-else` lồng nhau phức tạp theo thời gian, hãy gợi ý cho tôi một Design Pattern phù hợp nhất để xử lý logic chuyển đổi Stage tự động này. So sánh ưu nhược điểm của State Pattern và Observer Pattern trong trường hợp này."*

---

## 2. Tại sao chọn State Pattern (hoặc Observer Pattern) thay vì IF-ELSE truyền thống?

### Vấn đề của code IF-ELSE truyền thống
Nếu viết bằng `if-else` hoặc `switch-case`, đoạn code quản lý thời gian và Stage sẽ trông như sau:
```javascript
setInterval(() => {
    room.timeElapsed += 1;
    if (room.timeElapsed === 10) {
        room.currentStage = 2;
        // Logic đổi sang stage 2...
    } else if (room.timeElapsed === 20) {
        room.currentStage = 3;
        // Logic đổi sang stage 3...
    } // ... Kéo dài đến 60 phút
}, 60000);
```
**Nhược điểm chí mạng:**
- **Vi phạm nguyên tắc Open/Closed (SOLID):** Nếu sau này hệ thống muốn đổi từ 6 sub-level xuống còn 3 sub-level (hoặc thêm các mini-game xen kẽ), ta phải đập đi viết lại toàn bộ khối `if-else`.
- **God Object:** File code sẽ trở nên khổng lồ vì nó phải chứa logic xử lý (gửi socket, gọi DB, tính điểm) cho *tất cả* các stage.

### Giải pháp 1: Sử dụng STATE PATTERN (Được khuyến nghị cho Logic Stage)
**Lý do chọn:** State Pattern cho phép một object (ở đây là `Room`) thay đổi hành vi của nó khi trạng thái bên trong thay đổi. 

- **Cách hoạt động:** Thay vì dùng `if-else`, ta tạo ra các class riêng biệt: `Stage1State`, `Stage2State`,... Mỗi class có một hàm `handleTimeOut()`. Khi hết 10 phút, `Stage1State` tự động chuyển trạng thái của `Room` sang `Stage2State`.
- **Lợi ích:** 
  - Mỗi Stage tự quản lý logic riêng của nó (VD: Stage 1 khởi tạo câu hỏi làm quen, Stage 2 có logic giơ tay phát biểu).
  - Khắc phục hoàn toàn `if-else`: Hệ thống chỉ gọi `room.currentState.handleTimeOut()` và không cần quan tâm nó đang ở state nào.

### Giải pháp 2: Sử dụng OBSERVER PATTERN (Kết hợp hoàn hảo với Socket.io)
**Lý do chọn:** Khi Stage thay đổi, có rất nhiều thành phần khác cần biết để cập nhật (VD: Mobile App cần đổi giao diện, DB cần lưu log, Hệ thống tính điểm cần tính giờ).

- **Cách hoạt động:** `Room` đóng vai trò là *Subject*. Khi thời gian đạt mốc 10 phút, `Room` gọi hàm `notifyObservers()`. Các *Observer* (như `SocketBroadcaster`, `LmsDbUpdater`) đang lắng nghe sẽ tự động phản hồi lại sự kiện này.
- **Lợi ích:** Giảm sự phụ thuộc (Decoupling) giữa core logic thời gian và các service khác. Core time service không cần phải trực tiếp import các hàm của Socket hay DB.

### 💡 KẾT LUẬN & ĐỀ XUẤT CHO DỰ ÁN LUCY
Để đạt điểm tối đa cho phần RBL này, kiến trúc lý tưởng nhất là **sự kết hợp của cả 2 Pattern**:
1. Dùng **State Pattern** để biểu diễn các Sub-levels (Stage 1, Stage 2...). Khi hết thời gian, State này tự chuyển sang State kia.
2. Khi State thay đổi, trigger một Event. Lúc này **Observer Pattern** (vốn được built-in sẵn trong cơ chế `EventEmitter` của Node.js / Socket.io) sẽ bắt sự kiện này để broadcast câu hỏi mới (từ LMS) xuống cho tất cả users trong phòng.
