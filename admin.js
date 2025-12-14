document.addEventListener("DOMContentLoaded", () => {
    const API_BASE = "https://karsamrit-backend.onrender.com";

    const loginBox = document.getElementById("admin-login");
    const loginForm = document.getElementById("admin-login-form");
    const usernameInput = document.getElementById("admin-username");
    const passwordInput = document.getElementById("admin-password");
    const loginErrorEl = document.getElementById("admin-login-error");

    const adminPanel = document.getElementById("admin-panel");
    const adminUserLabel = document.getElementById("admin-username-label");
    const logoutBtn = document.getElementById("admin-logout-btn");
    const refreshBtn = document.getElementById("admin-refresh-btn");

    const ordersTbody = document.getElementById("orders-body");
    const ordersEmpty = document.getElementById("orders-empty");

    const sortSelect = document.getElementById("order-sort");
    const productFilterSelect = document.getElementById("product-filter");
    const searchInput = document.getElementById("order-search");
    const statusFilterSelect = document.getElementById("status-filter");

    const statTodayOrdersEl = document.getElementById("stat-today-orders");
    const statTodayRevenueEl = document.getElementById("stat-today-revenue");
    const statPendingEl = document.getElementById("stat-pending-deliveries");


    let adminToken = null;
    let allOrders = [];
    let currentSort = "created_desc";
    let currentProductFilter = "all";
    let currentSearch = "";
    let currentStatusFilter = "all";


    // --- HELPERS ---

    function updateAdminStats() {
        if (!allOrders || !allOrders.length) {
            if (statTodayOrdersEl) statTodayOrdersEl.textContent = "0";
            if (statTodayRevenueEl) statTodayRevenueEl.textContent = "0";
            if (statPendingEl) statPendingEl.textContent = "0";
            return;
        }

        const now = new Date();
        const todayY = now.getFullYear();
        const todayM = now.getMonth();
        const todayD = now.getDate();

        let todayOrdersCount = 0;
        let todayRevenue = 0;
        let pendingDeliveries = 0;

        allOrders.forEach(order => {
            // pending deliveries: anything not delivered
            const status = order.status || "placed";
            if (status !== "delivered") {
                pendingDeliveries += 1;
            }

            // createdAt date check
            if (order.createdAt) {
                const d = new Date(order.createdAt);
                if (
                    d.getFullYear() === todayY &&
                    d.getMonth() === todayM &&
                    d.getDate() === todayD
                ) {
                    todayOrdersCount += 1;

                    const itemsTotal = order.itemsTotal ?? 0;
                    const shipping = order.shipping ?? 0;
                    const grand = order.grandTotal ?? (itemsTotal + shipping);
                    todayRevenue += grand;
                }
            }
        });

        if (statTodayOrdersEl) {
            statTodayOrdersEl.textContent = todayOrdersCount.toString();
        }
        if (statTodayRevenueEl) {
            statTodayRevenueEl.textContent = todayRevenue.toString();
        }
        if (statPendingEl) {
            statPendingEl.textContent = pendingDeliveries.toString();
        }
    }

    function formatPrice(n) {
        return "₹" + n.toString();
    }

    function formatDate(d) {
        const date = new Date(d);
        if (isNaN(date.getTime())) return "";
        return date.toLocaleDateString("en-IN", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    function formatShortDate(d) {
        const date = new Date(d);
        if (isNaN(date.getTime())) return "-";
        return date.toLocaleDateString("en-IN", {
            weekday: "short",
            day: "numeric",
            month: "short"
        });
    }

    function formatAddress(addr) {
        if (!addr) return "";
        const parts = [
            addr.house,
            addr.street,
            addr.area,
            addr.city,
            addr.state,
            addr.pincode ? `PIN: ${addr.pincode}` : null
        ].filter(Boolean);
        return parts.join(", ");
    }

    function formatItems(items) {
        if (!items || !items.length) return "";
        return items.map(i => `${i.qty}× ${i.title}`).join(" | ");
    }

    function parseDateSafe(val) {
        if (!val) return null;
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    }

    function getStatusLabel(status) {
        switch (status) {
            case "packed":
                return "Packed";
            case "shipped":
                return "Shipped";
            case "delivered":
                return "Delivered";
            case "placed":
            default:
                return "Placed";
        }
    }

    function showLogin() {
        loginBox.style.display = "block";
        adminPanel.style.display = "none";
        loginErrorEl.textContent = "";
    }

    function showPanel(username) {
        loginBox.style.display = "none";
        adminPanel.style.display = "block";
        if (adminUserLabel) adminUserLabel.textContent = username || "";
    }

    function saveToken(token) {
        adminToken = token;
        localStorage.setItem("karsamrit_admin_token", token);
    }

    function clearToken() {
        adminToken = null;
        localStorage.removeItem("karsamrit_admin_token");
    }

    // --- FILTER OPTIONS (product list) ---
    function buildProductFilterOptions() {
        if (!productFilterSelect) return;
        const titles = new Set();

        allOrders.forEach(order => {
            if (!order.items) return;
            order.items.forEach(it => {
                if (it.title) {
                    titles.add(it.title);
                }
            });
        });

        productFilterSelect.innerHTML = "";
        const optAll = document.createElement("option");
        optAll.value = "all";
        optAll.textContent = "All products";
        productFilterSelect.appendChild(optAll);

        Array.from(titles).sort().forEach(title => {
            const opt = document.createElement("option");
            opt.value = title;
            opt.textContent = title;
            productFilterSelect.appendChild(opt);
        });
    }

    // --- STATUS UPDATE CALL ---
    async function updateOrderStatus(orderId, newStatus) {
        if (!adminToken) return;

        try {
            const res = await fetch(`${API_BASE}/api/admin/orders/${orderId}/status`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "X-Admin-Token": adminToken
                },
                body: JSON.stringify({ status: newStatus })
            });

            const data = await res.json();

            if (!res.ok || !data || !data.order) {
                console.error("Failed to update status:", data);
                alert(data.error || "Failed to update order status.");
                return;
            }

            const updated = data.order;
            const idx = allOrders.findIndex(o => o._id === updated._id);
            if (idx !== -1) {
                allOrders[idx] = updated;
            }
            renderOrdersTable();
        } catch (err) {
            console.error("Error updating status:", err);
            alert("Network error while updating status.");
        }
    }

    // --- APPLY SORT + FILTER + RENDER ---
    function renderOrdersTable() {
        ordersTbody.innerHTML = "";
        ordersEmpty.style.display = "none";

        if (!allOrders || !allOrders.length) {
            ordersEmpty.style.display = "block";
            ordersEmpty.textContent = "No orders found.";
            return;
        }

        // Filter by product
        let filtered = allOrders;

        // product filter
        if (currentProductFilter !== "all") {
            filtered = filtered.filter(order =>
                (order.items || []).some(it => it.title === currentProductFilter)
            );
        }

        // status filter
        if (currentStatusFilter !== "all") {
            filtered = filtered.filter(order => {
                const st = order.status || "placed";
                return st === currentStatusFilter;
            });
        }

        // search filter (name / phone)
        if (currentSearch && currentSearch.trim() !== "") {
            const q = currentSearch.trim().toLowerCase();
            filtered = filtered.filter(order => {
                const name = (order.name || "").toLowerCase();
                const phone = (order.phone || "");
                return name.includes(q) || phone.includes(q);
            });
        }


        if (!filtered.length) {
            ordersEmpty.style.display = "block";
            ordersEmpty.textContent = "No orders match this filter.";
            return;
        }

        // Sorting
        const sorted = [...filtered].sort((a, b) => {
            const aCreated = parseDateSafe(a.createdAt);
            const bCreated = parseDateSafe(b.createdAt);
            const aDel = parseDateSafe(a.estimatedDelivery);
            const bDel = parseDateSafe(b.estimatedDelivery);

            switch (currentSort) {
                case "created_asc":
                    if (!aCreated || !bCreated) return 0;
                    return aCreated - bCreated;
                case "created_desc":
                    if (!aCreated || !bCreated) return 0;
                    return bCreated - aCreated;
                case "delivery_asc":
                    if (!aDel || !bDel) return 0;
                    return aDel - bDel;
                case "delivery_desc":
                    if (!aDel || !bDel) return 0;
                    return bDel - aDel;
                default:
                    return 0;
            }
        });

        sorted.forEach(order => {
            const tr = document.createElement("tr");

            const itemsTotal = order.itemsTotal ?? 0;
            const shipping = order.shipping ?? 0;
            const grandTotal = order.grandTotal ?? (itemsTotal + shipping);

            const status = order.status || "placed";
            const statusLabel = getStatusLabel(status);

            let actionsHtml = "";
            if (status === "placed") {
                actionsHtml = `
        <div class="status-actions">
            <button class="status-btn" data-action="packed">Mark as Packed</button>
        </div>
    `;
            } else if (status === "packed") {
                actionsHtml = `
        <div class="status-actions">
            <button class="status-btn" data-action="shipped">Mark as Shipped</button>
        </div>
    `;
            } else if (status === "shipped") {
                actionsHtml = `
        <div class="status-actions">
            <button class="status-btn" data-action="delivered">Mark as Delivered</button>
        </div>
    `;
            } else {
                actionsHtml = ""; // delivered -> no actions
            }


            tr.innerHTML = `
                <td>${order._id}</td>
                <td>${order.createdAt ? formatDate(order.createdAt) : ""}</td>
                <td>${order.name || ""}</td>
                <td>${order.phone || ""}</td>
                <td>${formatAddress(order.address)}</td>
                <td>${formatItems(order.items)}</td>
                <td>${formatPrice(itemsTotal)}</td>
                <td>${formatPrice(shipping)}</td>
                <td>${formatPrice(grandTotal)}</td>
                <td>${order.estimatedDelivery ? formatShortDate(order.estimatedDelivery) : "-"}</td>
                <td>
                    <span class="status-badge status-${status}">${statusLabel}</span>
                    ${actionsHtml}
                </td>
                <td>${(order.paymentMethod || "COD").toUpperCase()}<br><small>${order.paymentStatus || "pending"}</small></td>
            `;

            // Attach status button handlers
            const statusButtons = tr.querySelectorAll(".status-btn");
            statusButtons.forEach(btn => {
                btn.addEventListener("click", () => {
                    const action = btn.getAttribute("data-action");
                    updateOrderStatus(order._id, action);
                });
            });

            ordersTbody.appendChild(tr);
        });
    }

    async function loadOrders() {
        if (!adminToken) return;

        ordersTbody.innerHTML = "";
        ordersEmpty.style.display = "none";

        try {
            const res = await fetch(`${API_BASE}/api/admin/orders`, {
                headers: {
                    "X-Admin-Token": adminToken
                }
            });

            if (res.status === 401) {
                clearToken();
                showLogin();
                return;
            }

            if (!res.ok) {
                ordersEmpty.style.display = "block";
                ordersEmpty.textContent = "Failed to load orders.";
                return;
            }

            const orders = await res.json();
            allOrders = Array.isArray(orders) ? orders : [];

            if (!allOrders.length) {
                ordersEmpty.style.display = "block";
                ordersEmpty.textContent = "No orders found.";

                updateAdminStats(); // zero show karega
                return;
            }

            buildProductFilterOptions();
            renderOrdersTable();
            updateAdminStats();

        } catch (err) {
            console.error("Error loading orders:", err);
            ordersEmpty.style.display = "block";
            ordersEmpty.textContent = "Error loading orders.";
        }
    }

    // --- LOGIN HANDLER ---
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            loginErrorEl.textContent = "";

            const username = usernameInput.value.trim();
            const password = passwordInput.value.trim();

            if (!username || !password) {
                loginErrorEl.textContent = "Username and password are required.";
                return;
            }

            try {
                const res = await fetch(`${API_BASE}/api/admin/login`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ username, password })
                });

                const data = await res.json();

                if (!res.ok) {
                    if (res.status === 401) {
                        loginErrorEl.textContent = data.error || "Invalid credentials.";
                    } else if (res.status === 429) {
                        loginErrorEl.textContent = data.error || "Admin user limit exceeded. Please try again later.";
                    } else {
                        loginErrorEl.textContent = data.error || "Login failed. Please try again.";
                    }
                    return;
                }

                if (data && data.token) {
                    saveToken(data.token);
                    showPanel(username);
                    await loadOrders();
                } else {
                    loginErrorEl.textContent = "Unexpected response from server.";
                }
            } catch (err) {
                console.error("Login error:", err);
                loginErrorEl.textContent = "Network error. Please try again.";
            }
        });
    }

    // --- LOGOUT ---
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
            try {
                if (adminToken) {
                    await fetch(`${API_BASE}/api/admin/logout`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "X-Admin-Token": adminToken
                        },
                        body: JSON.stringify({ token: adminToken })
                    });
                }
            } catch (err) {
                console.error("Logout error:", err);
            } finally {
                clearToken();
                showLogin();
            }
        });
    }

    // --- REFRESH BUTTON ---
    if (refreshBtn) {
        refreshBtn.addEventListener("click", () => {
            loadOrders();
        });
    }

    // --- SORT / FILTER EVENT LISTENERS ---
    if (sortSelect) {
        sortSelect.addEventListener("change", () => {
            currentSort = sortSelect.value;
            renderOrdersTable();
        });
    }

    if (productFilterSelect) {
        productFilterSelect.addEventListener("change", () => {
            currentProductFilter = productFilterSelect.value;
            renderOrdersTable();
        });
    }
    if (searchInput) {
        searchInput.addEventListener("input", () => {
            currentSearch = searchInput.value || "";
            renderOrdersTable();
        });
    }

    if (statusFilterSelect) {
        statusFilterSelect.addEventListener("change", () => {
            currentStatusFilter = statusFilterSelect.value || "all";
            renderOrdersTable();
        });
    }


    // --- AUTO LOGIN IF TOKEN EXISTS ---
    const savedToken = localStorage.getItem("karsamrit_admin_token");
    if (savedToken) {
        adminToken = savedToken;
        fetch(`${API_BASE}/api/admin/session`, {
            headers: {
                "X-Admin-Token": adminToken
            }
        })
            .then(res => res.json())
            .then(async data => {
                if (data && data.active) {
                    showPanel(data.username || "Admin");
                    await loadOrders();
                } else {
                    clearToken();
                    showLogin();
                }
            })
            .catch(err => {
                console.error("Session check error:", err);
                clearToken();
                showLogin();
            });
    } else {
        showLogin();
    }
});
