# 🏗️ System Architecture: MyStore OS

This document outlines the technical architecture of the MyStore OS platform, designed to scale across thousands of local shops, customers, and distributors.

## 📊 1. Core Stack
* **Frontend Framework:** React (via Vite)
* **Routing:** React Router v6
* **Styling:** Vanilla CSS Modules with Premium Glassmorphism UI
* **Icons:** Lucide-React
* **Mock Backend:** Custom asynchronous LocalStorage wrapper (designed as a drop-in replacement for Supabase)
* **Intended Production Backend:** Supabase (PostgreSQL, Auth, Realtime)

## 🔄 2. Role-Based Architecture
The system supports four distinct roles, all operating within the same Single Page Application (SPA):

### A. Super Admin (`/admin`)
* **Purpose:** Global oversight of platform metrics.
* **Capabilities:** View total GMV, Active Credits, transaction volumes, and manage all Shops, Distributors, and Customers.

### B. Distributor (`/distributor`)
* **Purpose:** Wholesale inventory and credit management.
* **Capabilities:** Add credit to shops, track outstanding dues, mark payments as received.

### C. Shopkeeper (`/shop`)
* **Purpose:** Daily retail operations.
* **Capabilities:** Add inventory, manage customer orders, track pending distributor payments, and provide a Scanner QR code to customers.

### D. Customer (`/user`)
* **Purpose:** End-user purchasing.
* **Capabilities:** Scan shop QR codes, view digital storefronts, add items to cart, and generate WhatsApp checkout links.

## 💾 3. Database Schema Design (For Supabase Migration)

When migrating to Supabase, the following tables should be created:

* **Users Table** (`id`, `phone`, `role`, `name`, `created_at`)
* **Products Table** (`id`, `shop_id`, `name`, `price`, `stock`, `created_at`)
* **Orders Table** (`id`, `user_id`, `shop_id`, `total`, `status`, `created_at`)
* **Order_Items Table** (`id`, `order_id`, `product_id`, `quantity`, `price_at_time`)
* **Credits Table** (`id`, `from_id`, `to_shop_id`, `desc`, `amount`, `is_paid`, `created_at`)

## 📶 4. Offline Strategy
Currently, the mock API utilizes `localStorage`, making the app fully offline-capable. 
When moving to production, Service Workers (PWA) and IndexedDB should be utilized alongside `supabase.channel()` to sync queued transactions when `navigator.onLine` returns to true.
