document.addEventListener("DOMContentLoaded", () => {
    if (window.lucide) lucide.createIcons();

    const API_BASE = "http://localhost:5000";

    /* =====================
       PRODUCTS (SOURCE OF TRUTH)
    ===================== */
    const products = [
        { id: 1, title: "Organic Handpicked Cashews", price: 450, image: "productsimg/cashews.jpg" },
        { id: 2, title: "Organic Handpicked Dates", price: 300, image: "productsimg/dates.jpg" },
        { id: 3, title: "Sundried Beetroot Chips", price: 150, image: "productsimg/beetrootchips.jpg" },
        { id: 4, title: "Sundried Carrot Chips", price: 140, image: "productsimg/carrotchips.jpg" }
    ];

    /* =====================
       DOM REFS
    ===================== */
    const cartItemsEl = document.getElementById("cart-items");
    const emptyCartEl = document.getElementById("empty-cart");

    const itemsTotalEl = document.getElementById("items-total");
    const shippingEl = document.getElementById("shipping-amount");
    const grandTotalEl = document.getElementById("grand-total");
    const freeNoteEl = document.getElementById("free-delivery-note");

    const checkoutForm = document.getElementById("checkout-form");
    const checkoutBtn = document.getElementById("checkout-btn");
    const checkoutErrorEl = document.getElementById("checkout-error");

    const checkoutWrapper = document.getElementById("checkout-wrapper");
    const successSection = document.getElementById("order-success");

    const successItemsBody = document.getElementById("success-items-body");
    const successItemsTotalEl = document.getElementById("success-items-total");
    const successShippingEl = document.getElementById("success-shipping");
    const successGrandTotalEl = document.getElementById("success-grand-total");
    const successOrderIdEl = document.getElementById("success-order-id");
    const successDeliveryEl = document.getElementById("success-delivery-date");
    const successAddressEl = document.getElementById("success-address");
    const successBackBtn = document.getElementById("success-back-btn");

    let cart = [];

    /* =====================
       HELPERS
    ===================== */
    const formatPrice = n => "₹" + n;

    const getProduct = id => products.find(p => p.id === id);

    function saveCart() {
        localStorage.setItem("karsamrit_cart", JSON.stringify(cart));
    }

    function loadCart() {
        cart = JSON.parse(localStorage.getItem("karsamrit_cart")) || [];
    }

    function setState(state) {
        if (state === "EMPTY") {
            checkoutWrapper.style.display = "block";
            cartItemsEl.style.display = "none";
            checkoutForm.style.display = "none";
            emptyCartEl.style.display = "block";
            successSection.style.display = "none";
        }

        if (state === "FORM") {
            checkoutWrapper.style.display = "block";
            cartItemsEl.style.display = "block";
            checkoutForm.style.display = "block";
            emptyCartEl.style.display = "none";
            successSection.style.display = "none";
        }

        if (state === "SUCCESS") {
            checkoutWrapper.style.display = "none";
            successSection.style.display = "block";
        }
    }

    /* =====================
       RENDER CART (FULL FEATURED)
    ===================== */
    function renderCart() {
        cartItemsEl.innerHTML = "";

        if (!cart.length) {
            setState("EMPTY");
            itemsTotalEl.textContent = "₹0";
            shippingEl.textContent = "₹0";
            grandTotalEl.textContent = "₹0";
            return;
        }

        setState("FORM");

        let itemsTotal = 0;

        cart.forEach(item => {
            const p = getProduct(item.id);
            if (!p) return;

            const lineTotal = p.price * item.qty;
            itemsTotal += lineTotal;

            const row = document.createElement("div");
            row.className = "cart-item-row";

            row.innerHTML = `
                <div class="cart-item-left">
                    <div class="cart-item-image">
                        <img src="${p.image}" alt="${p.title}">
                    </div>
                    <div class="cart-item-info">
                        <h4>${p.title}</h4>
                        <p>Unit Price: ${formatPrice(p.price)}</p>
                    </div>
                </div>

                <div class="cart-item-right">
                    <div class="qty-control">
                        <button class="qty-btn minus">-</button>
                        <span class="qty-value">${item.qty}</span>
                        <button class="qty-btn plus">+</button>
                    </div>
                    <div class="line-total">${formatPrice(lineTotal)}</div>
                    <button class="remove-item">Remove</button>
                </div>
            `;

            row.querySelector(".qty-btn.plus").onclick = () => {
                item.qty++;
                saveCart();
                renderCart();
            };

            row.querySelector(".qty-btn.minus").onclick = () => {
                if (item.qty > 1) item.qty--;
                else cart = cart.filter(c => c.id !== item.id);
                saveCart();
                renderCart();
            };

            row.querySelector(".remove-item").onclick = () => {
                cart = cart.filter(c => c.id !== item.id);
                saveCart();
                renderCart();
            };

            cartItemsEl.appendChild(row);
        });

        let shipping = itemsTotal < 500 ? 99 : 0;

        itemsTotalEl.textContent = formatPrice(itemsTotal);
        shippingEl.textContent = formatPrice(shipping);
        grandTotalEl.textContent = formatPrice(itemsTotal + shipping);

        if (freeNoteEl) {
            if (itemsTotal < 500) {
                freeNoteEl.textContent = `*Add ${formatPrice(500 - itemsTotal)} more for free delivery`;
                freeNoteEl.style.display = "block";
            } else {
                freeNoteEl.style.display = "none";
            }
        }
    }

    /* =====================
       ORDER SUCCESS BACK
    ===================== */
    if (successBackBtn) {
        successBackBtn.onclick = () => {
            window.location.href = "index.html#products";
        };
    }

    /* =====================
       INIT
    ===================== */
    loadCart();
    renderCart();
});
