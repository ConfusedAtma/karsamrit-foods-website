document.addEventListener("DOMContentLoaded", () => {
    if (window.lucide) lucide.createIcons();

    /* =========================
       PRODUCT DATA (FIXED PATHS)
    ========================== */
    const products = [
        {
            id: 1,
            title: "Organic Handpicked Cashews",
            category: "dry-fruits",
            price: 450,
            weight: "250g",
            benefit: "Premium grade • Handpicked",
            image: "productsimg/cashews.jpg",
            tag: "Bestseller"
        },
        {
            id: 2,
            title: "Organic Handpicked Dates",
            category: "dry-fruits",
            price: 300,
            weight: "500g",
            benefit: "Naturally sweet • No added sugar",
            image: "productsimg/dates.jpg",
            tag: "Organic"
        },
        {
            id: 3,
            title: "Sundried Beetroot Chips",
            category: "snacks",
            price: 150,
            weight: "100g",
            benefit: "Sun-dried • Not fried",
            image: "productsimg/beetrootchips.jpg",
            tag: "New"
        },
        {
            id: 4,
            title: "Sundried Carrot Chips",
            category: "snacks",
            price: 140,
            weight: "100g",
            benefit: "Baked • No palm oil",
            image: "productsimg/carrotchips.jpg",
            tag: "Healthy"
        }
    ];

    /* =========================
       DOM REFERENCES
    ========================== */
    const productGrid = document.getElementById("product-grid");
    const cartCountEl = document.getElementById("cart-count");
    const navbar = document.getElementById("navbar");
    const hamburger = document.getElementById("hamburger");
    const navMenu = document.getElementById("nav-menu");
    const catDropdown = document.getElementById("cat-dropdown");
    const navLinks = document.querySelectorAll(".nav-link");

    /* =========================
       CART STATE
    ========================== */
    let cart = JSON.parse(localStorage.getItem("karsamrit_cart")) || [];
    let currentFilter = "all";

    function saveCart() {
        localStorage.setItem("karsamrit_cart", JSON.stringify(cart));
    }

    function getCartQty(id) {
        return cart.find(i => i.id === id)?.qty || 0;
    }

    function updateCartCount() {
        if (!cartCountEl) return;
        const count = cart.reduce((s, i) => s + i.qty, 0);
        cartCountEl.textContent = count;
        cartCountEl.style.display = count > 0 ? "flex" : "none";
    }

    function addToCart(id) {
        const item = cart.find(i => i.id === id);
        if (item) item.qty++;
        else cart.push({ id, qty: 1 });
        saveCart();
        updateCartCount();
    }

    function removeFromCart(id) {
        const item = cart.find(i => i.id === id);
        if (!item) return;
        if (item.qty > 1) item.qty--;
        else cart = cart.filter(i => i.id !== id);
        saveCart();
        updateCartCount();
    }

    /* =========================
       RENDER PRODUCTS
    ========================== */
    function renderProducts() {
        if (!productGrid) return;
        productGrid.innerHTML = "";

        const list =
            currentFilter === "all"
                ? products
                : products.filter(p => p.category === currentFilter);

        list.forEach(p => {
            const qty = getCartQty(p.id);

            const card = document.createElement("div");
            card.className = "product-card";
            card.innerHTML = `
                <div class="product-image">
                    <img src="${p.image}" alt="${p.title}">
                    <span class="tag">${p.tag}</span>
                </div>
                <div class="product-details">
                    <h3 class="product-title">${p.title}</h3>
                    <p class="product-meta">${p.weight}</p>
                    <p class="product-benefit">${p.benefit}</p>
                    <div class="product-bottom">
                        <span class="price">₹${p.price}</span>
                        ${
                            qty === 0
                                ? `<button class="buy-btn">Add to Cart</button>`
                                : `
                                <div class="qty-control">
                                    <button class="qty-btn minus">-</button>
                                    <span class="qty-value">${qty}</span>
                                    <button class="qty-btn plus">+</button>
                                </div>`
                        }
                    </div>
                </div>
            `;

            productGrid.appendChild(card);

            if (qty === 0) {
                card.querySelector(".buy-btn").onclick = () => {
                    addToCart(p.id);
                    renderProducts();
                };
            } else {
                card.querySelector(".qty-btn.plus").onclick = () => {
                    addToCart(p.id);
                    renderProducts();
                };
                card.querySelector(".qty-btn.minus").onclick = () => {
                    removeFromCart(p.id);
                    renderProducts();
                };
            }
        });
    }

    /* =========================
       FILTERS
    ========================== */
    window.filterProducts = function (cat) {
        currentFilter = cat;
        document.querySelectorAll(".filter-btn").forEach(btn => {
            btn.classList.toggle(
                "active",
                btn.textContent.trim().toLowerCase().includes(cat.replace("-", ""))
                || (cat === "all" && btn.textContent === "All")
            );
        });
        renderProducts();
    };

    /* =========================
       NAVBAR + MOBILE
    ========================== */
    if (navbar) {
        window.addEventListener("scroll", () => {
            navbar.classList.toggle("scrolled", window.scrollY > 50);
        });
    }

    if (hamburger && navMenu) {
        hamburger.onclick = () => navMenu.classList.toggle("active");
    }

    if (catDropdown && window.innerWidth <= 768) {
        catDropdown.onclick = () => catDropdown.classList.toggle("active");
    }

    navLinks.forEach(link => {
        const href = link.getAttribute("href");
        if (href && href.startsWith("#")) {
            link.onclick = e => {
                e.preventDefault();
                const el = document.querySelector(href);
                if (el) window.scrollTo({ top: el.offsetTop - 80, behavior: "smooth" });
                navMenu?.classList.remove("active");
            };
        }
    });

    /* =========================
       INIT
    ========================== */
    updateCartCount();
    renderProducts();
});
