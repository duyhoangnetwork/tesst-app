const STORAGE_KEY = "tom_shipper_orders_v1";
const MAX_STORAGE_DAYS = 180;

let currentTab = "home";
let currentStep = 1;
let pendingConfirmAction = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function localDateString(date = new Date()) {
  const timezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(`${dateString}T00:00:00`));
}

function formatCurrency(value) {
  return `${new Intl.NumberFormat("vi-VN").format(Number(value || 0))} ₫`;
}

function cleanPhone(phone) {
  return String(phone || "").replace(/[^\d+]/g, "");
}

function parseAmount(value) {
  if (!value) return 0;

  const cleaned = String(value).replace(/[^\d]/g, "");
  return Number(cleaned) || 0;
}

function getOrders() {
  try {
    const orders = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(orders) ? orders : [];
  } catch {
    return [];
  }
}

function saveOrders(orders) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
}

function cleanupOldOrders() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_STORAGE_DAYS);
  cutoff.setHours(0, 0, 0, 0);

  const cleanOrders = getOrders().filter((order) => {
    const orderDate = new Date(`${order.date}T00:00:00`);
    return orderDate >= cutoff;
  });

  saveOrders(cleanOrders);
}

function createId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function addOrder(orderData) {
  const order = {
    id: createId(),
    customerName: orderData.customerName.trim(),
    phone: cleanPhone(orderData.phone),
    detail: orderData.detail.trim(),
    address: orderData.address.trim(),
    note: orderData.note.trim(),
    amount: parseAmount(orderData.amount),
    paymentMethod: "bank",
    status: "pending",
    date: localDateString(),
    createdAt: new Date().toISOString(),
    completedAt: null
  };

  const orders = getOrders();
  orders.unshift(order);
  saveOrders(orders);
  renderAll();
  showToast("Đã thêm đơn hàng mới.");
}

function updateOrder(id, updates) {
  const orders = getOrders().map((order) => {
    if (order.id !== id) return order;
    return { ...order, ...updates };
  });

  saveOrders(orders);
  renderAll();
}

function getTodayOrders() {
  const today = localDateString();
  return getOrders().filter((order) => order.date === today);
}

function getStatusInfo(status) {
  const info = {
    pending: { text: "Đang giao", className: "status-pending" },
    completed: { text: "Hoàn thành", className: "status-completed" },
    cancelled: { text: "Đã hủy", className: "status-cancelled" }
  };

  return info[status] || info.pending;
}

function escapeHTML(value = "") {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  };

  return String(value).replace(/[&<>"']/g, (char) => map[char]);
}

function createOrderCard(order, historyMode = false) {
  const status = getStatusInfo(order.status);
  const isFinished = order.status !== "pending";
  const isCod = order.paymentMethod === "cod";
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}`;
  const telLink = `tel:${encodeURIComponent(order.phone)}`;

  return `
    <article class="order-card ${order.status}" data-order-id="${order.id}">
      <div class="order-main">
        <div class="customer-row">
          <div>
            <h3 class="customer-name">${escapeHTML(order.customerName)}</h3>
            <a class="customer-phone" href="${telLink}">📞 ${escapeHTML(order.phone || "Chưa có số")}</a>
          </div>
          <span class="status-badge ${status.className}">${status.text}</span>
        </div>

        <p class="order-detail">${escapeHTML(order.detail)}</p>

        <div class="address-line">
          <svg><use href="#icon-map"></use></svg>
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

        <div class="order-payment">
          <div class="payment-label">
            <svg><use href="#${isCod ? "icon-money" : "icon-bank"}"></use></svg>
            <span>${isCod ? "Tiền mặt (COD)" : "Chuyển khoản (Bank)"}</span>
          </div>

          ${order.amount > 0 ? `<strong class="order-amount">${formatCurrency(order.amount)}</strong>` : ""}

          ${
            !isFinished
              ? `
                <button class="payment-switch ${isCod ? "cod" : ""}" data-action="toggle-payment" data-id="${order.id}">
                  ${isCod ? "Đổi sang Bank" : "Khách trả tiền mặt"}
                </button>
              `
              : ""
          }
        </div>
      </div>

      ${
        !historyMode && !isFinished
          ? `
            <div class="quick-actions">
              <a class="quick-action call" href="${telLink}" aria-label="Gọi ${escapeHTML(order.customerName)}">
                <svg><use href="#icon-phone"></use></svg>
                <span>Gọi ngay</span>
              </a>
              <a class="quick-action map" href="${mapUrl}" target="_blank" rel="noopener" aria-label="Mở bản đồ">
                <svg><use href="#icon-map"></use></svg>
                <span>Bản đồ</span>
              </a>
              <button class="quick-action complete" data-action="complete" data-id="${order.id}">
                <svg><use href="#icon-check"></use></svg>
                <span>Hoàn thành</span>
              </button>
              <button class="quick-action cancel" data-action="cancel" data-id="${order.id}">
                <svg><use href="#icon-close"></use></svg>
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
  const todayOrders = getTodayOrders();
  const activeOrders = todayOrders.filter((order) => order.status === "pending");

  $("#todayLabel").textContent = formatDate(localDateString());
  $("#todayCount").textContent = `${activeOrders.length} đơn`;

  $("#orderList").innerHTML = activeOrders.map((order) => createOrderCard(order)).join("");
  $("#emptyHome").classList.toggle("hidden", activeOrders.length > 0);
}

function renderStats() {
  const todayOrders = getTodayOrders();

  const pendingCodOrders = todayOrders.filter(
    (order) => order.status === "pending" && order.paymentMethod === "cod"
  );

  const successfulOrders = todayOrders.filter((order) => order.status === "completed");

  const successfulBankOrders = successfulOrders.filter(
    (order) => order.paymentMethod === "bank"
  );

  const codTotal = pendingCodOrders.reduce((total, order) => total + Number(order.amount || 0), 0);
  const bankTotal = successfulBankOrders.reduce((total, order) => total + Number(order.amount || 0), 0);
  const revenueTotal = successfulOrders.reduce((total, order) => total + Number(order.amount || 0), 0);

  $("#statsDateLabel").textContent = formatDate(localDateString());
  $("#codTotal").textContent = formatCurrency(codTotal);
  $("#bankTotal").textContent = formatCurrency(bankTotal);
  $("#revenueTotal").textContent = formatCurrency(revenueTotal);
  $("#codCount").textContent = `${pendingCodOrders.length} đơn đang giao`;
  $("#bankCount").textContent = `${successfulBankOrders.length} đơn thành công`;
  $("#completedSummary").textContent = `${successfulOrders.length} đơn đã hoàn thành`;
}

function renderHistory() {
  const selectedDate = $("#historyDate").value || localDateString();
  const historyOrders = getOrders()
    .filter((order) => order.date === selectedDate)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  $("#historyList").innerHTML = historyOrders
    .map((order) => createOrderCard(order, true))
    .join("");

  $("#emptyHistory").classList.toggle("hidden", historyOrders.length > 0);
}

function renderAll() {
  cleanupOldOrders();
  renderHome();
  renderStats();
  renderHistory();
}

function switchTab(tabName) {
  currentTab = tabName;

  $$(".tab-content").forEach((tab) => tab.classList.remove("active"));
  $$(".nav-item").forEach((item) => item.classList.remove("active"));

  $(`#${tabName}Tab`).classList.add("active");
  $(`.nav-item[data-tab="${tabName}"]`).classList.add("active");

  if (tabName === "history") renderHistory();
  if (tabName === "stats") renderStats();
}

function showModal() {
  resetOrderModal();
  $("#orderModal").classList.remove("hidden");
  document.body.style.overflow = "hidden";

  setTimeout(() => $("#customerName").focus(), 180);
}

function hideModal() {
  $("#orderModal").classList.add("hidden");
  document.body.style.overflow = "";
}

function resetOrderModal() {
  currentStep = 1;
  $("#manualOrderForm").reset();
  $("#pasteOrderForm").reset();

  setInputMode("manual");
  updateWizard();
}

function setInputMode(mode) {
  $$(".mode-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });

  $("#manualOrderForm").classList.toggle("hidden", mode !== "manual");
  $("#pasteOrderForm").classList.toggle("hidden", mode !== "paste");
}

function updateWizard() {
  $$(".form-step").forEach((step) => {
    step.classList.toggle("active", Number(step.dataset.step) === currentStep);
  });

  $("#stepProgressText").textContent = `Bước ${currentStep}/5`;
  $("#progressBar").style.width = `${currentStep * 20}%`;
  $("#prevStepBtn").classList.toggle("hidden", currentStep === 1);
  $("#nextStepBtn").classList.toggle("hidden", currentStep === 5);
  $("#saveManualBtn").classList.toggle("hidden", currentStep !== 5);

  const currentInput = $(`.form-step[data-step="${currentStep}"] input, .form-step[data-step="${currentStep}"] textarea`);

  setTimeout(() => currentInput?.focus(), 100);
}

function validateCurrentStep() {
  const step = $(`.form-step[data-step="${currentStep}"]`);
  const requiredInput = step.querySelector("[required]");

  if (!requiredInput || requiredInput.value.trim()) return true;

  requiredInput.focus();
  showToast("Vui lòng nhập thông tin trước khi tiếp tục.");
  return false;
}

function openConfirm({ title, message, type = "danger", onAccept }) {
  pendingConfirmAction = onAccept;

  $("#confirmTitle").textContent = title;
  $("#confirmMessage").textContent = message;
  $("#confirmAcceptBtn").textContent = type === "success" ? "Hoàn thành" : "Xác nhận";
  $("#confirmAcceptBtn").className = type === "success" ? "primary-btn" : "danger-btn";

  $("#confirmIcon").innerHTML =
    type === "success"
      ? '<svg><use href="#icon-check"></use></svg>'
      : '<svg><use href="#icon-close"></use></svg>';

  $("#confirmModal").classList.remove("hidden");
}

function closeConfirm() {
  $("#confirmModal").classList.add("hidden");
  pendingConfirmAction = null;
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.remove("hidden");

  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => {
    toast.classList.add("hidden");
  }, 2600);
}

function normalizeKey(key) {
  return key
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

function parseRawOrder(text) {
  const result = {
    customerName: "",
    phone: "",
    detail: "",
    address: "",
    note: "",
    amount: 0
  };

  const aliases = {
    customerName: ["ten", "khachhang", "tenkhach", "nguoinhan", "name"],
    phone: ["sdt", "sodienthoai", "dienthoai", "phone", "tel"],
    detail: ["don", "chitietdon", "sanpham", "mon", "hang", "order"],
    address: ["diachi", "dc", "address"],
    note: ["ghichu", "note"],
    amount: ["tien", "sotien", "thanhtien", "gia", "tong"]
  };

  const fields = text
    .replace(/\r/g, "")
    .split(/,|\n/)
    .map((part) => part.trim())
    .filter(Boolean);

  fields.forEach((field) => {
    const colonIndex = field.indexOf(":");
    if (colonIndex === -1) return;

    const rawKey = normalizeKey(field.slice(0, colonIndex));
    const value = field.slice(colonIndex + 1).trim();

    Object.entries(aliases).forEach(([property, names]) => {
      if (names.includes(rawKey) && value) {
        result[property] = property === "amount" ? parseAmount(value) : value;
      }
    });
  });

  return result;
}

function handleOrderAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const { action, id } = button.dataset;
  const order = getOrders().find((item) => item.id === id);
  if (!order) return;

  if (action === "toggle-payment") {
    const nextPayment = order.paymentMethod === "bank" ? "cod" : "bank";
    updateOrder(id, { paymentMethod: nextPayment });
    showToast(nextPayment === "cod" ? "Đã chuyển sang tiền mặt COD." : "Đã chuyển sang chuyển khoản.");
  }

  if (action === "complete") {
    openConfirm({
      title: "Hoàn thành đơn?",
      message: `Xác nhận đã giao thành công cho ${order.customerName}.`,
      type: "success",
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
      type: "danger",
      onAccept: () => {
        updateOrder(id, { status: "cancelled" });
        showToast("Đơn hàng đã được hủy.");
      }
    });
  }
}

function initEvents() {
  $$(".nav-item").forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
  });

  ["#addOrderHeaderBtn", "#emptyAddOrderBtn", "#fabAddOrder"].forEach((selector) => {
    $(selector).addEventListener("click", showModal);
  });

  $("#closeModalBtn").addEventListener("click", hideModal);

  $("#orderModal").addEventListener("click", (event) => {
    if (event.target === $("#orderModal")) hideModal();
  });

  $$(".mode-btn").forEach((button) => {
    button.addEventListener("click", () => setInputMode(button.dataset.mode));
  });

  $("#nextStepBtn").addEventListener("click", () => {
    if (!validateCurrentStep()) return;
    currentStep = Math.min(5, currentStep + 1);
    updateWizard();
  });

  $("#prevStepBtn").addEventListener("click", () => {
    currentStep = Math.max(1, currentStep - 1);
    updateWizard();
  });

  $("#manualOrderForm").addEventListener("submit", (event) => {
    event.preventDefault();

    if (!validateCurrentStep()) return;

    addOrder({
      customerName: $("#customerName").value,
      phone: $("#customerPhone").value,
      detail: $("#orderDetail").value,
      address: $("#customerAddress").value,
      note: $("#orderNote").value,
      amount: $("#orderAmount").value
    });

    hideModal();
  });

  $("#pasteOrderForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const rawText = $("#rawOrderText").value.trim();

    if (!rawText) {
      showToast("Vui lòng dán nội dung đơn hàng.");
      return;
    }

    const parsedOrder = parseRawOrder(rawText);

    if (!parsedOrder.customerName || !parsedOrder.phone || !parsedOrder.detail || !parsedOrder.address) {
      showToast("Không đủ dữ liệu. Cần có Tên, SĐT, Đơn và Địa chỉ.");
      return;
    }

    addOrder(parsedOrder);
    hideModal();
  });

  $("#historyDate").addEventListener("change", renderHistory);

  $("#orderList").addEventListener("click", handleOrderAction);
  $("#historyList").addEventListener("click", handleOrderAction);

  $("#confirmCancelBtn").addEventListener("click", closeConfirm);

  $("#confirmAcceptBtn").addEventListener("click", () => {
    if (typeof pendingConfirmAction === "function") {
      pendingConfirmAction();
    }
    closeConfirm();
  });

  $("#confirmModal").addEventListener("click", (event) => {
    if (event.target === $("#confirmModal")) closeConfirm();
  });
}

function initializeApp() {
  cleanupOldOrders();
  $("#historyDate").value = localDateString();
  initEvents();
  renderAll();
}

document.addEventListener("DOMContentLoaded", initializeApp);
