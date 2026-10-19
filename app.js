const STORAGE_KEY = "tom_shipper_orders_v2";
const MAX_STORAGE_DAYS = 180;

let pendingConfirmAction = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function getLocalDate(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(`${dateString}T00:00:00`));
}

function createId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };

    return entities[character];
  });
}

function cleanPhone(value = "") {
  return String(value).replace(/[^\d+]/g, "");
}

function getOrders() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveOrders(orders) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
}

function cleanOldOrders() {
  const limitDate = new Date();
  limitDate.setDate(limitDate.getDate() - MAX_STORAGE_DAYS);
  limitDate.setHours(0, 0, 0, 0);

  const validOrders = getOrders().filter((order) => {
    return new Date(`${order.date}T00:00:00`) >= limitDate;
  });

  saveOrders(validOrders);
}

function saveNewOrders(newOrders) {
  if (!newOrders.length) return;

  const allOrders = getOrders();
  allOrders.unshift(...newOrders);
  saveOrders(allOrders);
  renderAll();
}

function createOrder(data) {
  return {
    id: createId(),
    customerName: data.customerName.trim(),
    phone: cleanPhone(data.phone),
    detail: data.detail.trim(),
    address: data.address.trim(),
    note: data.note.trim(),
    paymentMethod: data.paymentMethod || "bank",
    status: "pending",
    date: getLocalDate(),
    createdAt: new Date().toISOString(),
    completedAt: null
  };
}

function updateOrder(id, updates) {
  const orders = getOrders().map((order) => {
    return order.id === id ? { ...order, ...updates } : order;
  });

  saveOrders(orders);
  renderAll();
}

function getStatus(status) {
  const statuses = {
    pending: {
      label: "Đang giao",
      className: "status-pending"
    },
    completed: {
      label: "Hoàn thành",
      className: "status-completed"
    },
    cancelled: {
      label: "Đã hủy",
      className: "status-cancelled"
    }
  };

  return statuses[status] || statuses.pending;
}

function buildOrderCard(order, isHistory = false) {
  const status = getStatus(order.status);
  const isPending = order.status === "pending";
  const isCash = order.paymentMethod === "cod";
  const telUrl = `tel:${encodeURIComponent(order.phone)}`;
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}`;

  return `
    <article class="order-card ${order.status}">
      <div class="order-main">
        <div class="customer-row">
          <div>
            <h3 class="customer-name">${escapeHTML(order.customerName)}</h3>
            <a class="customer-phone" href="${telUrl}">
              📞 ${escapeHTML(order.phone || "Chưa có số điện thoại")}
            </a>
          </div>
          <span class="status-badge ${status.className}">${status.label}</span>
        </div>

        <p class="order-detail">${escapeHTML(order.detail)}</p>

        <div class="address-line">
          <svg><use href="#i-map"></use></svg>
          <span>${escapeHTML(order.address)}</span>
        </div>

        ${
          order.note
            ? `
              <div class="note-line">
                <span>📝</span>
                <span>${escapeHTML(order.note)}</span>
              </div>
            `
            : ""
        }

        <div class="payment-row">
          <div class="payment-type">
            <svg><use href="#${isCash ? "i-card" : "i-bank"}"></use></svg>
            <span>${isCash ? "Tiền mặt (COD)" : "Chuyển khoản (Bank)"}</span>
          </div>

          ${
            isPending
              ? `
                <button
                  class="payment-toggle ${isCash ? "cod" : ""}"
                  data-action="toggle-payment"
                  data-id="${order.id}"
                >
                  ${isCash ? "Đổi sang Bank" : "Khách trả tiền mặt"}
                </button>
              `
              : ""
          }
        </div>
      </div>

      ${
        isPending && !isHistory
          ? `
            <div class="quick-actions">
              <a class="quick-action call" href="${telUrl}">
                <svg><use href="#i-phone"></use></svg>
                <span>Gọi ngay</span>
              </a>

              <a class="quick-action map" href="${mapUrl}" target="_blank" rel="noopener">
                <svg><use href="#i-map"></use></svg>
                <span>Bản đồ</span>
              </a>

              <button class="quick-action complete" data-action="complete" data-id="${order.id}">
                <svg><use href="#i-check"></use></svg>
                <span>Hoàn thành</span>
              </button>

              <button class="quick-action cancel" data-action="cancel" data-id="${order.id}">
                <svg><use href="#i-close"></use></svg>
                <span>Hủy đơn</span>
              </button>
            </div>
          `
          : ""
      }
    </article>
  `;
}

function renderHome() {
  const today = getLocalDate();
  const pendingOrders = getOrders().filter(
    (order) => order.date === today && order.status === "pending"
  );

  $("#todayLabel").textContent = formatDate(today);
  $("#pendingCountBadge").textContent = `${pendingOrders.length} đơn`;
  $("#orderList").innerHTML = pendingOrders.map((order) => buildOrderCard(order)).join("");
  $("#homeEmpty").classList.toggle("hidden", pendingOrders.length > 0);
}

function renderStats() {
  const today = getLocalDate();
  const orders = getOrders().filter((order) => order.date === today);

  const completed = orders.filter((order) => order.status === "completed").length;
  const pending = orders.filter((order) => order.status === "pending").length;
  const cancelled = orders.filter((order) => order.status === "cancelled").length;

  $("#statsDateLabel").textContent = formatDate(today);
  $("#completedCount").textContent = completed;
  $("#pendingCount").textContent = pending;
  $("#cancelledCount").textContent = cancelled;
}

function renderHistory() {
  const selectedDate = $("#historyDate").value || getLocalDate();

  const orders = getOrders()
    .filter((order) => order.date === selectedDate)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  $("#historyList").innerHTML = orders
    .map((order) => buildOrderCard(order, true))
    .join("");

  $("#historyEmpty").classList.toggle("hidden", orders.length > 0);
}

function renderAll() {
  cleanOldOrders();
  renderHome();
  renderStats();
  renderHistory();
}

function changeTab(tabName) {
  $$(".tab-content").forEach((element) => element.classList.remove("active"));
  $$(".nav-item").forEach((element) => element.classList.remove("active"));

  $(`#${tabName}Tab`).classList.add("active");
  $(`.nav-item[data-tab="${tabName}"]`).classList.add("active");

  if (tabName === "history") renderHistory();
  if (tabName === "stats") renderStats();
}

function showOrderModal() {
  resetOrderForm();
  $("#orderModal").classList.remove("hidden");
  document.body.style.overflow = "hidden";

  setTimeout(() => $("#customerName").focus(), 150);
}

function closeOrderModal() {
  $("#orderModal").classList.add("hidden");
  document.body.style.overflow = "";
}

function resetOrderForm() {
  $("#manualForm").reset();
  $("#bulkForm").reset();
  setInputMode("manual");
}

function setInputMode(mode) {
  $$(".input-mode").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });

  $("#manualForm").classList.toggle("hidden", mode !== "manual");
  $("#bulkForm").classList.toggle("hidden", mode !== "bulk");
}

function openConfirm({ title, message, type, onAccept }) {
  pendingConfirmAction = onAccept;

  $("#confirmTitle").textContent = title;
  $("#confirmMessage").textContent = message;
  $("#confirmAccept").textContent = type === "complete" ? "Hoàn thành" : "Xác nhận";
  $("#confirmAccept").className = type === "complete" ? "primary-button" : "danger-button";

  $("#confirmIcon").innerHTML =
    type === "complete"
      ? '<svg><use href="#i-check"></use></svg>'
      : '<svg><use href="#i-close"></use></svg>';

  $("#confirmModal").classList.remove("hidden");
}

function closeConfirm() {
  pendingConfirmAction = null;
  $("#confirmModal").classList.add("hidden");
}

function showToast(message) {
  const toast = $("#toast");

  toast.textContent = message;
  toast.classList.remove("hidden");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.classList.add("hidden");
  }, 2600);
}

function handleCardAction(event) {
  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;

  const { action, id } = actionButton.dataset;
  const order = getOrders().find((item) => item.id === id);

  if (!order) return;

  if (action === "toggle-payment") {
    const paymentMethod = order.paymentMethod === "cod" ? "bank" : "cod";

    updateOrder(id, { paymentMethod });

    showToast(
      paymentMethod === "cod"
        ? "Đã chọn khách trả tiền mặt."
        : "Đã chuyển sang thanh toán Bank."
    );
  }

  if (action === "complete") {
    openConfirm({
      title: "Hoàn thành đơn?",
      message: `Xác nhận đã giao thành công cho ${order.customerName}.`,
      type: "complete",
      onAccept: () => {
        updateOrder(id, {
          status: "completed",
          completedAt: new Date().toISOString()
        });

        showToast("Đơn hàng đã hoàn thành.");
      }
    });
  }

  if (action === "cancel") {
    openConfirm({
      title: "Hủy đơn hàng?",
      message: `Đơn của ${order.customerName} sẽ được chuyển sang trạng thái đã hủy.`,
      type: "cancel",
      onAccept: () => {
        updateOrder(id, { status: "cancelled" });
        showToast("Đơn hàng đã được hủy.");
      }
    });
  }
}

function addManualOrder(event) {
  event.preventDefault();

  const customerName = $("#customerName").value.trim();
  const phone = $("#customerPhone").value.trim();
  const detail = $("#orderDetail").value.trim();
  const address = $("#customerAddress").value.trim();
  const note = $("#orderNote").value.trim();

  if (!customerName || !phone || !detail || !address) {
    showToast("Vui lòng nhập đầy đủ thông tin bắt buộc.");
    return;
  }

  saveNewOrders([
    createOrder({
      customerName,
      phone,
      detail,
      address,
      note,
      paymentMethod: $("#cashPayment").checked ? "cod" : "bank"
    })
  ]);

  closeOrderModal();
  showToast("Đã thêm đơn hàng.");
}

function addBulkOrders(event) {
  event.preventDefault();

  const rawText = $("#bulkOrderText").value.trim();

  if (!rawText) {
    showToast("Vui lòng nhập danh sách đơn hàng.");
    return;
  }

  const lines = rawText.split("\n").map((line) => line.trim()).filter(Boolean);
  const newOrders = [];
  let invalidLines = 0;

  lines.forEach((line) => {
    // Chỉ tách theo dấu gạch ngang có khoảng trắng hai bên để tránh cắt nhầm
    // dữ liệu như mã đơn hoặc nội dung có dấu gạch ngang liền nhau.
    const parts = line.split(/\s*-\s*/).map((part) => part.trim());

    if (parts.length < 2) {
      invalidLines += 1;
      return;
    }

    const customerName = parts[0] || "";
    const detail = parts[1] || "";
    const phone = parts[2] || "";
    const address = parts[3] || "";
    const note = parts.slice(4).join(" - ").trim();

    if (!customerName || !detail) {
      invalidLines += 1;
      return;
    }

    newOrders.push(
      createOrder({
        customerName,
        detail,
        phone,
        address,
        note,
        paymentMethod: "bank"
      })
    );
  });

  if (!newOrders.length) {
    showToast("Không có dòng nào đúng định dạng.");
    return;
  }

  saveNewOrders(newOrders);
  closeOrderModal();

  const message =
    invalidLines > 0
      ? `Đã thêm ${newOrders.length} đơn. Bỏ qua ${invalidLines} dòng lỗi.`
      : `Đã thêm thành công ${newOrders.length} đơn hàng.`;

  showToast(message);
}

function setupEnterNavigation() {
  const fields = [
    $("#customerName"),
    $("#customerPhone"),
    $("#orderDetail"),
    $("#customerAddress"),
    $("#orderNote")
  ];

  fields.forEach((field, index) => {
    field.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.shiftKey) return;

      event.preventDefault();

      const nextField = fields[index + 1];

      if (nextField) {
        nextField.focus();
      } else {
        $("#manualForm").requestSubmit();
      }
    });
  });
}

function initEvents() {
  $$(".nav-item").forEach((button) => {
    button.addEventListener("click", () => changeTab(button.dataset.tab));
  });

  ["#headerAddButton", "#emptyAddButton"].forEach((selector) => {
    $(selector).addEventListener("click", showOrderModal);
  });

  $("#closeOrderModal").addEventListener("click", closeOrderModal);

  $("#orderModal").addEventListener("click", (event) => {
    if (event.target === $("#orderModal")) closeOrderModal();
  });

  $$(".input-mode").forEach((button) => {
    button.addEventListener("click", () => setInputMode(button.dataset.mode));
  });

  $("#manualForm").addEventListener("submit", addManualOrder);
  $("#bulkForm").addEventListener("submit", addBulkOrders);

  $("#historyDate").addEventListener("change", renderHistory);

  $("#orderList").addEventListener("click", handleCardAction);
  $("#historyList").addEventListener("click", handleCardAction);

  $("#confirmCancel").addEventListener("click", closeConfirm);

  $("#confirmAccept").addEventListener("click", () => {
    if (typeof pendingConfirmAction === "function") {
      pendingConfirmAction();
    }

    closeConfirm();
  });

  $("#confirmModal").addEventListener("click", (event) => {
    if (event.target === $("#confirmModal")) closeConfirm();
  });

  $("#deleteTodayOrders").addEventListener("click", () => {
    const today = getLocalDate();
    const count = getOrders().filter((order) => order.date === today).length;
    if (!count) {
      showToast("Hôm nay chưa có đơn hàng để xóa.");
      return;
    }
    openConfirm({
      title: "Xóa tất cả đơn hôm nay?",
      message: `Thao tác này sẽ xóa ${count} đơn được tạo hôm nay. Dữ liệu ngày khác vẫn được giữ lại. Bạn có chắc chắn không?`,
      type: "cancel",
      onAccept: () => {
        saveOrders(getOrders().filter((order) => order.date !== today));
        renderAll();
        showToast("Đã xóa toàn bộ đơn hàng hôm nay.");
      }
    });
  });

  $("#resetAllOrders").addEventListener("click", () => {
    const count = getOrders().length;
    if (!count) {
      showToast("Dữ liệu đã trống, không cần đặt lại.");
      return;
    }
    openConfirm({
      title: "Đặt lại toàn bộ dữ liệu?",
      message: `Thao tác này sẽ xóa toàn bộ ${count} đơn hàng đã lưu trên thiết bị, bao gồm cả lịch sử các ngày trước. Không thể hoàn tác. Bạn có muốn bắt đầu lại từ đầu?`,
      type: "cancel",
      onAccept: () => {
        saveOrders([]);
        renderAll();
        showToast("Đã đặt lại dữ liệu. Sẵn sàng cho ca làm mới.");
      }
    });
  });

  setupEnterNavigation();
}

function initializeApp() {
  cleanOldOrders();
  $("#historyDate").value = getLocalDate();

  initEvents();
  renderAll();

  const splash = $("#splashScreen");
  window.setTimeout(() => {
    splash?.classList.add("splash-hidden");
    window.setTimeout(() => splash?.remove(), 450);
  }, 1700);
}

document.addEventListener("DOMContentLoaded", initializeApp);
