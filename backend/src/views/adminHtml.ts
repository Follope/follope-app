export function getAdminHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Follope Admin Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
    [x-cloak] { display: none !important; }
  </style>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            brand: {
              50: '#FFF7ED',
              100: '#FFEDD5',
              500: '#FF7A00',
              600: '#EA580C',
              700: '#C2410C',
              dark: '#0F172A',
            }
          }
        }
      }
    }
  </script>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen antialiased flex flex-col">

  <!-- TOP NAV -->
  <header class="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-40">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-400 flex items-center justify-center font-bold text-white shadow-lg shadow-orange-500/20 text-lg">
          F
        </div>
        <div>
          <span class="text-lg font-bold tracking-tight text-white">Follope</span>
          <span class="ml-2 px-2 py-0.5 text-xs font-semibold rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">Admin Panel</span>
        </div>
      </div>

      <div id="authHeaderControls" class="flex items-center space-x-4 hidden">
        <span id="apiStatusBadge" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <span class="w-1.5 h-1.5 mr-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Connected
        </span>
        <button onclick="logoutAdmin()" class="text-xs font-medium text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 transition">
          Sign Out
        </button>
      </div>
    </div>
  </header>

  <!-- LOGIN OVERLAY -->
  <div id="loginSection" class="flex-1 flex items-center justify-center p-4">
    <div class="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
      <div class="text-center mb-8">
        <div class="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-500 flex items-center justify-center mx-auto mb-4 font-black text-xl">
          ⚡
        </div>
        <h2 class="text-2xl font-bold text-white tracking-tight">Admin Authentication</h2>
        <p class="text-sm text-slate-400 mt-2">Enter the Follope Master Secret Key to manage subscriptions, quotas, and users.</p>
      </div>

      <form id="loginForm" onsubmit="handleLogin(event)" class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Master Key</label>
          <input 
            type="password" 
            id="adminKeyInput" 
            placeholder="••••••••••••••••" 
            required 
            class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm font-mono transition"
          >
        </div>
        <div id="loginError" class="hidden text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg p-3"></div>
        <button 
          type="submit" 
          id="loginBtn"
          class="w-full py-3 px-4 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl text-sm transition shadow-lg shadow-orange-500/25 flex items-center justify-center"
        >
          <span>Access Control Center</span>
        </button>
      </form>
    </div>
  </div>

  <!-- MAIN APP (Shown after authentication) -->
  <div id="appSection" class="flex-1 hidden max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col space-y-6">
    
    <!-- NAVIGATION TABS -->
    <div class="flex border-b border-slate-800 space-x-1 sm:space-x-4 overflow-x-auto pb-px">
      <button onclick="switchTab('metrics')" id="tab-metrics" class="tab-btn px-4 py-3 text-sm font-semibold border-b-2 border-orange-500 text-orange-400 flex items-center space-x-2">
        <span>📊 Metrics & Overview</span>
      </button>
      <button onclick="switchTab('config')" id="tab-config" class="tab-btn px-4 py-3 text-sm font-semibold border-b-2 border-transparent text-slate-400 hover:text-slate-200 flex items-center space-x-2">
        <span>⚙️ Plan & Quota Rules</span>
      </button>
      <button onclick="switchTab('users')" id="tab-users" class="tab-btn px-4 py-3 text-sm font-semibold border-b-2 border-transparent text-slate-400 hover:text-slate-200 flex items-center space-x-2">
        <span>👥 Users & Subscriptions</span>
      </button>
      <button onclick="switchTab('coupons')" id="tab-coupons" class="tab-btn px-4 py-3 text-sm font-semibold border-b-2 border-transparent text-slate-400 hover:text-slate-200 flex items-center space-x-2">
        <span>🎟️ Coupon Codes</span>
      </button>
      <button onclick="switchTab('referrals')" id="tab-referrals" class="tab-btn px-4 py-3 text-sm font-semibold border-b-2 border-transparent text-slate-400 hover:text-slate-200 flex items-center space-x-2">
        <span>🤝 Referrals</span>
      </button>
      <button onclick="switchTab('exports')" id="tab-exports" class="tab-btn px-4 py-3 text-sm font-semibold border-b-2 border-transparent text-slate-400 hover:text-slate-200 flex items-center space-x-2">
        <span>📁 CSV Exports</span>
      </button>
    </div>

    <!-- NOTIFICATION TOAST CONTAINER -->
    <div id="toast" class="fixed bottom-6 right-6 z-50 hidden max-w-sm w-full bg-slate-900 border border-slate-700 text-white p-4 rounded-xl shadow-2xl flex items-center space-x-3 transition"></div>

    <!-- TAB 1: METRICS -->
    <section id="content-metrics" class="space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Users</span>
          <div class="flex items-baseline justify-between mt-2">
            <span id="m-totalUsers" class="text-3xl font-extrabold text-white">...</span>
            <span id="m-proUsers" class="text-xs font-semibold px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">... Pro</span>
          </div>
          <div class="text-xs text-slate-500 mt-2" id="m-freeUsers">... Free users</div>
        </div>

        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Invoices Generated</span>
          <div class="flex items-baseline justify-between mt-2">
            <span id="m-totalInvoices" class="text-3xl font-extrabold text-white">...</span>
            <span id="m-paidInvoices" class="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">... Paid</span>
          </div>
          <div class="text-xs text-slate-500 mt-2" id="m-overdueInvoices">... Overdue</div>
        </div>

        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Volume Invoiced</span>
          <div class="mt-2">
            <span id="m-billedAmount" class="text-3xl font-extrabold text-white">₹0</span>
          </div>
          <div class="text-xs text-emerald-400 mt-2" id="m-collectedAmount">₹0 collected</div>
        </div>

        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Growth & Viral</span>
          <div class="flex items-baseline justify-between mt-2">
            <span id="m-totalReferrals" class="text-3xl font-extrabold text-white">...</span>
            <span id="m-couponsCount" class="text-xs font-semibold px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">... Coupons</span>
          </div>
          <div class="text-xs text-slate-500 mt-2" id="m-rewardedReferrals">... Successful referrals</div>
        </div>
      </div>

      <!-- RECENT ACTIVITY TABLES -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 class="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center justify-between">
            <span>Recent User Signups</span>
            <button onclick="switchTab('users')" class="text-xs font-medium text-orange-400 hover:underline">View All →</button>
          </h3>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="text-slate-400 border-b border-slate-800 pb-2">
                <tr>
                  <th class="py-2">User</th>
                  <th class="py-2">Plan</th>
                  <th class="py-2">Invoices</th>
                  <th class="py-2">Joined</th>
                </tr>
              </thead>
              <tbody id="recentUsersBody" class="divide-y divide-slate-800/60 text-slate-300">
                <tr><td colspan="4" class="py-4 text-center text-slate-500">Loading...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 class="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center justify-between">
            <span>Recent Invoices</span>
            <button onclick="switchTab('exports')" class="text-xs font-medium text-orange-400 hover:underline">Export CSV →</button>
          </h3>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="text-slate-400 border-b border-slate-800 pb-2">
                <tr>
                  <th class="py-2">Number</th>
                  <th class="py-2">Freelancer</th>
                  <th class="py-2">Amount</th>
                  <th class="py-2">Status</th>
                </tr>
              </thead>
              <tbody id="recentInvoicesBody" class="divide-y divide-slate-800/60 text-slate-300">
                <tr><td colspan="4" class="py-4 text-center text-slate-500">Loading...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>

    <!-- TAB 2: CONFIGURATION -->
    <section id="content-config" class="space-y-6 hidden">
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div class="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
          <div>
            <h2 class="text-lg font-bold text-white">Global Plan & Access Rules</h2>
            <p class="text-sm text-slate-400 mt-1">Changes take effect immediately across all users without restarting the server.</p>
          </div>
          <button onclick="savePlanConfig()" class="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl shadow-lg shadow-orange-500/20 transition flex items-center space-x-2">
            <span>Save Configuration</span>
          </button>
        </div>

        <form id="configForm" class="space-y-6">
          <!-- FREE TIER RULES (CORE USER REQUIREMENT) -->
          <div class="bg-slate-950/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 class="text-sm font-bold text-orange-400 uppercase tracking-wider flex items-center">
              <span class="mr-2">🛡️</span> Free Tier Quota Limits
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-slate-300 mb-1">
                  Free Lifetime Invoices Total
                </label>
                <input 
                  type="number" 
                  id="cfg-freeInvoiceLimit" 
                  min="1" 
                  max="1000"
                  class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm font-mono focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  value="3"
                >
                <p class="text-[11px] text-slate-500 mt-1">Strict lifetime limit (not reset monthly). Default: 3.</p>
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-300 mb-1">
                  Max Free Invoice Edits (Revisions)
                </label>
                <input 
                  type="number" 
                  id="cfg-maxInvoiceEdits" 
                  min="0" 
                  max="100"
                  class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm font-mono focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  value="1"
                >
                <p class="text-[11px] text-slate-500 mt-1">Number of times a free invoice can be edited before locking. Default: 1.</p>
              </div>
            </div>
          </div>

          <!-- REFERRAL PROGRAM SETTINGS -->
          <div class="bg-slate-950/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 class="text-sm font-bold text-purple-400 uppercase tracking-wider flex items-center">
              <span class="mr-2">🎁</span> Referral Engine Rewards
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-slate-300 mb-1">
                  Reward Months Granted (Both Users)
                </label>
                <input 
                  type="number" 
                  id="cfg-referralRewardMonths" 
                  min="1" 
                  max="12"
                  class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm font-mono focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  value="1"
                >
                <p class="text-[11px] text-slate-500 mt-1">Months of free Pro given when a referee creates their 1st invoice. Default: 1.</p>
              </div>
            </div>
          </div>

          <!-- PRICING TIERS -->
          <div class="bg-slate-950/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 class="text-sm font-bold text-emerald-400 uppercase tracking-wider flex items-center">
              <span class="mr-2">💳</span> Subscription Pricing (INR)
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label class="block text-xs font-semibold text-slate-300 mb-1">Pro Monthly (₹)</label>
                <input 
                  type="number" 
                  id="cfg-proMonthlyPrice" 
                  class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm font-mono focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  value="299"
                >
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-300 mb-1">Pro Annual (₹)</label>
                <input 
                  type="number" 
                  id="cfg-proAnnualPrice" 
                  class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm font-mono focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  value="2499"
                >
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-300 mb-1">Lifetime Pass (₹)</label>
                <input 
                  type="number" 
                  id="cfg-lifetimePrice" 
                  class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm font-mono focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  value="4999"
                >
              </div>
            </div>
          </div>

          <!-- SYSTEM BROADCAST BANNER -->
          <div class="bg-slate-950/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center">
                <span class="mr-2">📢</span> Global Notice Banner
              </h3>
              <label class="inline-flex items-center cursor-pointer">
                <input type="checkbox" id="cfg-bannerActive" class="sr-only peer">
                <div class="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                <span class="ml-2 text-xs font-medium text-slate-300">Active</span>
              </label>
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-300 mb-1">Banner Announcement Text</label>
              <input 
                type="text" 
                id="cfg-bannerNotice" 
                placeholder="e.g. Welcome to Follope v1.0! Get 50% off Pro with coupon LAUNCH50." 
                class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
              >
            </div>
          </div>
        </form>
      </div>
    </section>

    <!-- TAB 3: USERS & SUBSCRIPTIONS -->
    <section id="content-users" class="space-y-6 hidden">
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-4">
          <div>
            <h2 class="text-lg font-bold text-white">User Accounts & Subscriptions</h2>
            <p class="text-sm text-slate-400 mt-1">Search users, view quotas, grant Pro access, or suspend abusive accounts.</p>
          </div>
          <div class="flex items-center space-x-2">
            <input 
              type="text" 
              id="userSearchInput" 
              placeholder="Search name, email, referral..." 
              onkeyup="if(event.key==='Enter') loadUsers(1)"
              class="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none w-64"
            >
            <select id="userTierFilter" onchange="loadUsers(1)" class="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none">
              <option value="">All Tiers</option>
              <option value="FREE">Free</option>
              <option value="PRO_MONTHLY">Pro Monthly</option>
              <option value="PRO_ANNUAL">Pro Annual</option>
              <option value="LIFETIME">Lifetime</option>
            </select>
            <button onclick="loadUsers(1)" class="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-semibold text-white transition">
              Search
            </button>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="text-slate-400 border-b border-slate-800">
              <tr>
                <th class="py-3 px-3">User</th>
                <th class="py-3 px-3">Role</th>
                <th class="py-3 px-3">Subscription</th>
                <th class="py-3 px-3">Expires</th>
                <th class="py-3 px-3">Invoices</th>
                <th class="py-3 px-3">Referral Code</th>
                <th class="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody id="usersTableBody" class="divide-y divide-slate-800/60 text-slate-300">
              <tr><td colspan="7" class="py-8 text-center text-slate-500">Loading users...</td></tr>
            </tbody>
          </table>
        </div>

        <!-- PAGINATION -->
        <div class="flex items-center justify-between border-t border-slate-800 pt-4 mt-4">
          <span id="userPaginationInfo" class="text-xs text-slate-400">Showing page 1</span>
          <div class="flex items-center space-x-2">
            <button id="prevPageBtn" onclick="prevUserPage()" class="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-xs text-slate-400 hover:text-white disabled:opacity-50">Previous</button>
            <button id="nextPageBtn" onclick="nextUserPage()" class="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-xs text-slate-400 hover:text-white disabled:opacity-50">Next</button>
          </div>
        </div>
      </div>
    </section>

    <!-- TAB 4: COUPONS -->
    <section id="content-coupons" class="space-y-6 hidden">
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div class="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
          <div>
            <h2 class="text-lg font-bold text-white">Coupon & Promo Engine</h2>
            <p class="text-sm text-slate-400 mt-1">Create promotional codes for free Pro months or launch discounts.</p>
          </div>
          <button onclick="openCreateCouponModal()" class="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-xl shadow-lg shadow-orange-500/20 transition flex items-center space-x-1.5">
            <span>+ Create Promo Code</span>
          </button>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="text-slate-400 border-b border-slate-800">
              <tr>
                <th class="py-3 px-3">Code</th>
                <th class="py-3 px-3">Benefit</th>
                <th class="py-3 px-3">Usage</th>
                <th class="py-3 px-3">Status</th>
                <th class="py-3 px-3">Expires</th>
                <th class="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody id="couponsTableBody" class="divide-y divide-slate-800/60 text-slate-300">
              <tr><td colspan="6" class="py-8 text-center text-slate-500">Loading coupons...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- TAB 5: REFERRALS -->
    <section id="content-referrals" class="space-y-6 hidden">
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div class="border-b border-slate-800 pb-4 mb-4">
          <h2 class="text-lg font-bold text-white">Referral Program Activity</h2>
          <p class="text-sm text-slate-400 mt-1">Track users inviting friends and automatic 1st-invoice rewards.</p>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="text-slate-400 border-b border-slate-800">
              <tr>
                <th class="py-3 px-3">Referrer</th>
                <th class="py-3 px-3">Code</th>
                <th class="py-3 px-3">Invited User (Referee)</th>
                <th class="py-3 px-3">Referee Invoices</th>
                <th class="py-3 px-3">Reward Status</th>
                <th class="py-3 px-3">Date</th>
              </tr>
            </thead>
            <tbody id="referralsTableBody" class="divide-y divide-slate-800/60 text-slate-300">
              <tr><td colspan="6" class="py-8 text-center text-slate-500">Loading referrals...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- TAB 6: EXPORTS -->
    <section id="content-exports" class="space-y-6 hidden">
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div class="border-b border-slate-800 pb-4 mb-6">
          <h2 class="text-lg font-bold text-white">1-Click CSV Data Export</h2>
          <p class="text-sm text-slate-400 mt-1">Download complete database records formatted for spreadsheet analysis or backup.</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="bg-slate-950 border border-slate-800 rounded-xl p-6 flex flex-col justify-between">
            <div>
              <div class="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center font-bold text-lg mb-3">👥</div>
              <h3 class="text-base font-bold text-white">Users & Subscriptions CSV</h3>
              <p class="text-xs text-slate-400 mt-2">
                Exports all registered accounts with user IDs, emails, roles, current subscription tier, expiry dates, and total invoices generated.
              </p>
            </div>
            <button onclick="downloadCsv('/v1/admin/export/users.csv')" class="mt-6 w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition border border-slate-700 flex items-center justify-center space-x-2">
              <span>📥 Download Users CSV</span>
            </button>
          </div>

          <div class="bg-slate-950 border border-slate-800 rounded-xl p-6 flex flex-col justify-between">
            <div>
              <div class="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-lg mb-3">📄</div>
              <h3 class="text-base font-bold text-white">Invoices Master Ledger CSV</h3>
              <p class="text-xs text-slate-400 mt-2">
                Exports all invoices across the platform with invoice number, client name, status, total amount, balance due, and issue/due dates.
              </p>
            </div>
            <button onclick="downloadCsv('/v1/admin/export/invoices.csv')" class="mt-6 w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition border border-slate-700 flex items-center justify-center space-x-2">
              <span>📥 Download Invoices CSV</span>
            </button>
          </div>
        </div>
      </div>
    </section>

  </div>

  <!-- MODAL: GRANT PLAN -->
  <div id="grantPlanModal" class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm hidden flex items-center justify-center p-4">
    <div class="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
      <div class="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3 class="text-base font-bold text-white">Manage User Subscription</h3>
        <button onclick="closeGrantPlanModal()" class="text-slate-400 hover:text-white text-lg">&times;</button>
      </div>

      <div class="space-y-4">
        <input type="hidden" id="modalUserId">
        <div>
          <span class="text-xs text-slate-400">Target User:</span>
          <div id="modalUserName" class="text-sm font-semibold text-white mt-0.5">...</div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1">Select Tier</label>
          <select id="modalPlanTier" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:ring-2 focus:ring-orange-500">
            <option value="PRO_MONTHLY">Pro Monthly (30 Days)</option>
            <option value="PRO_ANNUAL">Pro Annual (365 Days)</option>
            <option value="LIFETIME">Lifetime Pro (Permanent)</option>
            <option value="FREE">Reset to Free Tier</option>
          </select>
        </div>

        <div id="modalMonthsContainer">
          <label class="block text-xs font-semibold text-slate-300 mb-1">Custom Duration (Months)</label>
          <input type="number" id="modalCustomMonths" min="1" max="120" value="1" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm font-mono focus:ring-2 focus:ring-orange-500">
        </div>
      </div>

      <div class="flex justify-end space-x-3 pt-2">
        <button onclick="closeGrantPlanModal()" class="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:bg-slate-800">Cancel</button>
        <button onclick="submitGrantPlan()" class="px-5 py-2 rounded-xl text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20">Apply Changes</button>
      </div>
    </div>
  </div>

  <!-- MODAL: CREATE COUPON -->
  <div id="createCouponModal" class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm hidden flex items-center justify-center p-4">
    <div class="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
      <div class="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3 class="text-base font-bold text-white">Create New Coupon Code</h3>
        <button onclick="closeCreateCouponModal()" class="text-slate-400 hover:text-white text-lg">&times;</button>
      </div>

      <div class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1">Coupon Code (Uppercase)</label>
          <input type="text" id="cpnCode" placeholder="e.g. LAUNCHPRO, VIP100" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm font-mono uppercase focus:ring-2 focus:ring-orange-500">
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Benefit Type</label>
            <select id="cpnType" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-orange-500">
              <option value="FREE_PRO_MONTHS">Free Pro Months</option>
              <option value="PERCENTAGE">Discount %</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Value</label>
            <input type="number" id="cpnValue" value="1" min="1" max="100" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono focus:ring-2 focus:ring-orange-500">
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Max Redemptions</label>
            <input type="number" id="cpnMaxUses" placeholder="Unlimited if blank" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono focus:ring-2 focus:ring-orange-500">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Expiry Date</label>
            <input type="date" id="cpnExpires" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-orange-500">
          </div>
        </div>
      </div>

      <div class="flex justify-end space-x-3 pt-2">
        <button onclick="closeCreateCouponModal()" class="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:bg-slate-800">Cancel</button>
        <button onclick="submitCreateCoupon()" class="px-5 py-2 rounded-xl text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20">Generate Coupon</button>
      </div>
    </div>
  </div>

  <script>
    let adminToken = localStorage.getItem('follope_admin_token') || '';
    let currentUserPage = 1;

    // Initialize state
    window.addEventListener('DOMContentLoaded', () => {
      if (adminToken) {
        verifyAndShowApp();
      } else {
        showLogin();
      }
    });

    function showLogin() {
      document.getElementById('loginSection').classList.remove('hidden');
      document.getElementById('appSection').classList.add('hidden');
      document.getElementById('authHeaderControls').classList.add('hidden');
    }

    function showApp() {
      document.getElementById('loginSection').classList.add('hidden');
      document.getElementById('appSection').classList.remove('hidden');
      document.getElementById('authHeaderControls').classList.remove('hidden');
      loadMetrics();
      loadPlanConfig();
    }

    function logoutAdmin() {
      localStorage.removeItem('follope_admin_token');
      adminToken = '';
      showLogin();
    }

    async function handleLogin(e) {
      e.preventDefault();
      const secret = document.getElementById('adminKeyInput').value.trim();
      const errBox = document.getElementById('loginError');
      errBox.classList.add('hidden');

      try {
        const res = await fetch('/v1/admin/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error?.message || 'Unauthorized');
        }

        adminToken = data.data.token;
        localStorage.setItem('follope_admin_token', adminToken);
        showApp();
      } catch (err) {
        errBox.textContent = err.message || 'Invalid master key';
        errBox.classList.remove('hidden');
      }
    }

    async function verifyAndShowApp() {
      try {
        const res = await fetch('/v1/admin/metrics', {
          headers: { 'x-admin-key': adminToken }
        });
        if (res.ok) {
          showApp();
        } else {
          logoutAdmin();
        }
      } catch {
        logoutAdmin();
      }
    }

    function switchTab(tabId) {
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('border-orange-500', 'text-orange-400');
        btn.classList.add('border-transparent', 'text-slate-400');
      });
      document.getElementById('tab-' + tabId)?.classList.add('border-orange-500', 'text-orange-400');
      document.getElementById('tab-' + tabId)?.classList.remove('border-transparent', 'text-slate-400');

      ['metrics', 'config', 'users', 'coupons', 'referrals', 'exports'].forEach(id => {
        document.getElementById('content-' + id)?.classList.add('hidden');
      });
      document.getElementById('content-' + tabId)?.classList.remove('hidden');

      if (tabId === 'metrics') loadMetrics();
      if (tabId === 'config') loadPlanConfig();
      if (tabId === 'users') loadUsers(currentUserPage);
      if (tabId === 'coupons') loadCoupons();
      if (tabId === 'referrals') loadReferrals();
    }

    function showToast(message, isError = false) {
      const toast = document.getElementById('toast');
      toast.innerHTML = \`<span class="\${isError ? 'text-rose-400' : 'text-emerald-400'} font-bold">\${isError ? '❌' : '✅'}</span> <span class="text-xs text-white">\${message}</span>\`;
      toast.classList.remove('hidden');
      setTimeout(() => toast.classList.add('hidden'), 3500);
    }

    async function loadMetrics() {
      try {
        const res = await fetch('/v1/admin/metrics', { headers: { 'x-admin-key': adminToken } });
        const { data } = await res.json();
        if (!data) return;

        document.getElementById('m-totalUsers').textContent = data.users.total;
        document.getElementById('m-proUsers').textContent = \`\${data.users.pro} Pro\`;
        document.getElementById('m-freeUsers').textContent = \`\${data.users.free} Free accounts\`;

        document.getElementById('m-totalInvoices').textContent = data.invoices.total;
        document.getElementById('m-paidInvoices').textContent = \`\${data.invoices.paid} Paid\`;
        document.getElementById('m-overdueInvoices').textContent = \`\${data.invoices.overdue} Overdue\`;

        document.getElementById('m-billedAmount').textContent = '₹' + (data.invoices.totalBilledPaise / 100).toLocaleString('en-IN');
        document.getElementById('m-collectedAmount').textContent = '₹' + (data.invoices.totalCollectedPaise / 100).toLocaleString('en-IN') + ' collected';

        document.getElementById('m-totalReferrals').textContent = data.referrals.total;
        document.getElementById('m-couponsCount').textContent = \`\${data.coupons.total} Coupons\`;
        document.getElementById('m-rewardedReferrals').textContent = \`\${data.referrals.rewarded} Completed rewards\`;

        // Render Recent Users
        const userTbody = document.getElementById('recentUsersBody');
        userTbody.innerHTML = (data.recentUsers || []).map(u => \`
          <tr class="hover:bg-slate-800/30">
            <td class="py-2.5">
              <div class="font-medium text-white">\${escapeHtml(u.name || 'Anonymous')}</div>
              <div class="text-[11px] text-slate-500 font-mono">\${escapeHtml(u.email)}</div>
            </td>
            <td class="py-2.5"><span class="px-2 py-0.5 rounded text-[10px] font-semibold \${getBadgeClass(u.subscription?.tier)}">\${u.subscription?.tier || 'FREE'}</span></td>
            <td class="py-2.5 text-slate-400 font-mono">\${u._count?.invoices || 0}</td>
            <td class="py-2.5 text-slate-500">\${formatDate(u.createdAt)}</td>
          </tr>
        \`).join('') || '<tr><td colspan="4" class="py-4 text-center text-slate-500">No users yet</td></tr>';

        // Render Recent Invoices
        const invTbody = document.getElementById('recentInvoicesBody');
        invTbody.innerHTML = (data.recentInvoices || []).map(inv => \`
          <tr class="hover:bg-slate-800/30">
            <td class="py-2.5 font-mono text-orange-400 font-semibold">#\${escapeHtml(inv.invoiceNumber)}</td>
            <td class="py-2.5 text-slate-300">\${escapeHtml(inv.user?.name || inv.user?.email || 'N/A')}</td>
            <td class="py-2.5 font-mono text-white">₹\${(inv.totalPaise / 100).toLocaleString('en-IN')}</td>
            <td class="py-2.5"><span class="px-2 py-0.5 rounded text-[10px] font-semibold \${getStatusBadgeClass(inv.status)}">\${inv.status}</span></td>
          </tr>
        \`).join('') || '<tr><td colspan="4" class="py-4 text-center text-slate-500">No invoices yet</td></tr>';
      } catch (err) {
        console.error('Failed to load metrics:', err);
      }
    }

    async function loadPlanConfig() {
      try {
        const res = await fetch('/v1/admin/config', { headers: { 'x-admin-key': adminToken } });
        const { data } = await res.json();
        if (!data) return;

        document.getElementById('cfg-freeInvoiceLimit').value = data.freeInvoiceLimit;
        document.getElementById('cfg-maxInvoiceEdits').value = data.maxInvoiceEdits;
        document.getElementById('cfg-referralRewardMonths').value = data.referralRewardMonths;
        document.getElementById('cfg-proMonthlyPrice').value = Math.round(data.proMonthlyPricePaise / 100);
        document.getElementById('cfg-proAnnualPrice').value = Math.round(data.proAnnualPricePaise / 100);
        document.getElementById('cfg-lifetimePrice').value = Math.round(data.lifetimePricePaise / 100);
        document.getElementById('cfg-bannerActive').checked = Boolean(data.bannerNoticeActive);
        document.getElementById('cfg-bannerNotice').value = data.bannerNotice || '';
      } catch (err) {
        console.error('Failed to load config:', err);
      }
    }

    async function savePlanConfig() {
      const payload = {
        freeInvoiceLimit: Number(document.getElementById('cfg-freeInvoiceLimit').value),
        maxInvoiceEdits: Number(document.getElementById('cfg-maxInvoiceEdits').value),
        referralRewardMonths: Number(document.getElementById('cfg-referralRewardMonths').value),
        proMonthlyPricePaise: Number(document.getElementById('cfg-proMonthlyPrice').value) * 100,
        proAnnualPricePaise: Number(document.getElementById('cfg-proAnnualPrice').value) * 100,
        lifetimePricePaise: Number(document.getElementById('cfg-lifetimePrice').value) * 100,
        bannerNoticeActive: document.getElementById('cfg-bannerActive').checked,
        bannerNotice: document.getElementById('cfg-bannerNotice').value.trim() || null,
      };

      try {
        const res = await fetch('/v1/admin/config', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-key': adminToken,
          },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to update config');
        showToast('Plan configuration saved and broadcasted!');
      } catch (err) {
        showToast(err.message, true);
      }
    }

    async function loadUsers(page = 1) {
      currentUserPage = page;
      const search = document.getElementById('userSearchInput').value.trim();
      const tier = document.getElementById('userTierFilter').value;
      const url = \`/v1/admin/users?page=\${page}&limit=15&search=\${encodeURIComponent(search)}&tier=\${encodeURIComponent(tier)}\`;

      try {
        const res = await fetch(url, { headers: { 'x-admin-key': adminToken } });
        const { data } = await res.json();
        if (!data) return;

        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = (data.users || []).map(u => \`
          <tr class="hover:bg-slate-800/30">
            <td class="py-3 px-3">
              <div class="font-medium text-white flex items-center space-x-2">
                <span>\${escapeHtml(u.name || 'Anonymous')}</span>
                \${u.isBanned ? '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">BANNED</span>' : ''}
              </div>
              <div class="text-[11px] text-slate-500 font-mono">\${escapeHtml(u.email)}</div>
            </td>
            <td class="py-3 px-3"><span class="text-slate-400 font-mono">\${u.role}</span></td>
            <td class="py-3 px-3"><span class="px-2 py-0.5 rounded text-[10px] font-semibold \${getBadgeClass(u.subscription?.tier)}">\${u.subscription?.tier || 'FREE'}</span></td>
            <td class="py-3 px-3 text-slate-400 font-mono">\${u.subscription?.expiresAt ? formatDate(u.subscription.expiresAt) : 'Never'}</td>
            <td class="py-3 px-3 text-slate-300 font-mono">\${u._count?.invoices || 0}</td>
            <td class="py-3 px-3 text-slate-400 font-mono text-[11px]">\${u.referralCode || '-'}</td>
            <td class="py-3 px-3 text-right space-x-1">
              <button onclick="openGrantPlanModal('\${u.id}', '\${escapeHtml(u.name || u.email)}', '\${u.subscription?.tier || 'FREE'}')" class="px-2 py-1 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 rounded text-[11px] font-semibold border border-orange-500/30">
                Grant Pro
              </button>
              <button onclick="toggleBan('\${u.id}', \${!u.isBanned})" class="px-2 py-1 \${u.isBanned ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'} rounded text-[11px] font-semibold border">
                \${u.isBanned ? 'Unban' : 'Ban'}
              </button>
            </td>
          </tr>
        \`).join('') || '<tr><td colspan="7" class="py-8 text-center text-slate-500">No users match query</td></tr>';

        document.getElementById('userPaginationInfo').textContent = \`Page \${data.pagination.page} of \${data.pagination.totalPages || 1} (\${data.pagination.total} total)\`;
        document.getElementById('prevPageBtn').disabled = data.pagination.page <= 1;
        document.getElementById('nextPageBtn').disabled = data.pagination.page >= data.pagination.totalPages;
      } catch (err) {
        console.error('Failed to load users:', err);
      }
    }

    function prevUserPage() {
      if (currentUserPage > 1) loadUsers(currentUserPage - 1);
    }

    function nextUserPage() {
      loadUsers(currentUserPage + 1);
    }

    function openGrantPlanModal(id, name, currentTier) {
      document.getElementById('modalUserId').value = id;
      document.getElementById('modalUserName').textContent = name;
      document.getElementById('modalPlanTier').value = currentTier !== 'FREE' ? currentTier : 'PRO_MONTHLY';
      document.getElementById('grantPlanModal').classList.remove('hidden');
    }

    function closeGrantPlanModal() {
      document.getElementById('grantPlanModal').classList.add('hidden');
    }

    async function submitGrantPlan() {
      const id = document.getElementById('modalUserId').value;
      const tier = document.getElementById('modalPlanTier').value;
      const months = Number(document.getElementById('modalCustomMonths').value) || 1;

      try {
        const res = await fetch(\`/v1/admin/users/\${id}/plan\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-key': adminToken },
          body: JSON.stringify({ tier, months }),
        });
        if (!res.ok) throw new Error('Failed to update plan');
        closeGrantPlanModal();
        showToast('User plan updated successfully!');
        loadUsers(currentUserPage);
      } catch (err) {
        showToast(err.message, true);
      }
    }

    async function toggleBan(id, isBanned) {
      if (!confirm(\`Are you sure you want to \${isBanned ? 'BAN' : 'UNBAN'} this user?\`)) return;
      try {
        const res = await fetch(\`/v1/admin/users/\${id}/ban\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-key': adminToken },
          body: JSON.stringify({ isBanned }),
        });
        if (!res.ok) throw new Error('Failed to toggle ban');
        showToast(\`User \${isBanned ? 'banned' : 'unbanned'}.\`);
        loadUsers(currentUserPage);
      } catch (err) {
        showToast(err.message, true);
      }
    }

    async function loadCoupons() {
      try {
        const res = await fetch('/v1/admin/coupons', { headers: { 'x-admin-key': adminToken } });
        const { data } = await res.json();
        const tbody = document.getElementById('couponsTableBody');
        tbody.innerHTML = (data || []).map(c => \`
          <tr class="hover:bg-slate-800/30">
            <td class="py-3 px-3 font-mono font-bold text-orange-400">\${escapeHtml(c.code)}</td>
            <td class="py-3 px-3 text-white">\${c.discountType === 'FREE_PRO_MONTHS' ? \`+\${c.discountValue} Month(s) Pro\` : \`\${c.discountValue}% OFF\`}</td>
            <td class="py-3 px-3 font-mono text-slate-400">\${c.usedCount} / \${c.maxUses ?? '∞'}</td>
            <td class="py-3 px-3">
              <span class="px-2 py-0.5 rounded text-[10px] font-semibold \${c.isActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'}">
                \${c.isActive ? 'Active' : 'Disabled'}
              </span>
            </td>
            <td class="py-3 px-3 text-slate-400 font-mono">\${c.expiresAt ? formatDate(c.expiresAt) : 'Never'}</td>
            <td class="py-3 px-3 text-right space-x-1">
              <button onclick="toggleCoupon('\${c.id}')" class="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px]">
                \${c.isActive ? 'Disable' : 'Enable'}
              </button>
              <button onclick="deleteCoupon('\${c.id}')" class="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded text-[11px] border border-rose-500/30">
                Delete
              </button>
            </td>
          </tr>
        \`).join('') || '<tr><td colspan="6" class="py-8 text-center text-slate-500">No promo codes created yet</td></tr>';
      } catch (err) {
        console.error('Failed to load coupons:', err);
      }
    }

    function openCreateCouponModal() {
      document.getElementById('createCouponModal').classList.remove('hidden');
    }

    function closeCreateCouponModal() {
      document.getElementById('createCouponModal').classList.add('hidden');
    }

    async function submitCreateCoupon() {
      const code = document.getElementById('cpnCode').value.trim();
      const discountType = document.getElementById('cpnType').value;
      const discountValue = Number(document.getElementById('cpnValue').value) || 1;
      const maxUses = document.getElementById('cpnMaxUses').value ? Number(document.getElementById('cpnMaxUses').value) : null;
      const expiresAt = document.getElementById('cpnExpires').value || null;

      if (!code) {
        showToast('Coupon code is required', true);
        return;
      }

      try {
        const res = await fetch('/v1/admin/coupons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-key': adminToken },
          body: JSON.stringify({ code, discountType, discountValue, maxUses, expiresAt }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || 'Failed to create coupon');
        closeCreateCouponModal();
        showToast(\`Coupon \${code.toUpperCase()} created!\`);
        loadCoupons();
      } catch (err) {
        showToast(err.message, true);
      }
    }

    async function toggleCoupon(id) {
      try {
        const res = await fetch(\`/v1/admin/coupons/\${id}/toggle\`, {
          method: 'PATCH',
          headers: { 'x-admin-key': adminToken },
        });
        if (!res.ok) throw new Error('Failed to toggle coupon');
        showToast('Coupon status updated.');
        loadCoupons();
      } catch (err) {
        showToast(err.message, true);
      }
    }

    async function deleteCoupon(id) {
      if (!confirm('Are you sure you want to permanently delete this coupon?')) return;
      try {
        const res = await fetch(\`/v1/admin/coupons/\${id}\`, {
          method: 'DELETE',
          headers: { 'x-admin-key': adminToken },
        });
        if (!res.ok) throw new Error('Failed to delete coupon');
        showToast('Coupon deleted.');
        loadCoupons();
      } catch (err) {
        showToast(err.message, true);
      }
    }

    async function loadReferrals() {
      try {
        const res = await fetch('/v1/admin/referrals', { headers: { 'x-admin-key': adminToken } });
        const { data } = await res.json();
        const tbody = document.getElementById('referralsTableBody');
        tbody.innerHTML = (data || []).map(r => \`
          <tr class="hover:bg-slate-800/30">
            <td class="py-3 px-3">
              <div class="font-medium text-white">\${escapeHtml(r.referrer?.name || 'N/A')}</div>
              <div class="text-[11px] text-slate-500 font-mono">\${escapeHtml(r.referrer?.email || '')}</div>
            </td>
            <td class="py-3 px-3 font-mono font-bold text-purple-400">\${escapeHtml(r.codeUsed)}</td>
            <td class="py-3 px-3">
              <div class="font-medium text-white">\${escapeHtml(r.referee?.name || 'N/A')}</div>
              <div class="text-[11px] text-slate-500 font-mono">\${escapeHtml(r.referee?.email || '')}</div>
            </td>
            <td class="py-3 px-3 font-mono text-slate-300">\${r.referee?._count?.invoices || 0} invoice(s)</td>
            <td class="py-3 px-3">
              <span class="px-2 py-0.5 rounded text-[10px] font-semibold \${r.rewardGranted ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}">
                \${r.rewardGranted ? '🎉 Rewarded (1 mo Pro)' : '⏳ Awaiting 1st Invoice'}
              </span>
            </td>
            <td class="py-3 px-3 text-slate-400 font-mono">\${formatDate(r.createdAt)}</td>
          </tr>
        \`).join('') || '<tr><td colspan="6" class="py-8 text-center text-slate-500">No referral activity recorded yet</td></tr>';
      } catch (err) {
        console.error('Failed to load referrals:', err);
      }
    }

    function downloadCsv(url) {
      window.open(\`\${url}?adminKey=\${encodeURIComponent(adminToken)}\`, '_blank');
    }

    function getBadgeClass(tier) {
      switch (tier) {
        case 'LIFETIME': return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
        case 'PRO_ANNUAL': return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
        case 'PRO_MONTHLY': return 'bg-orange-500/10 text-orange-400 border border-orange-500/20';
        default: return 'bg-slate-800 text-slate-400 border border-slate-700';
      }
    }

    function getStatusBadgeClass(status) {
      switch (status) {
        case 'PAID': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
        case 'OVERDUE': return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
        case 'SENT': return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
        default: return 'bg-slate-800 text-slate-400 border border-slate-700';
      }
    }

    function formatDate(d) {
      if (!d) return '-';
      const date = new Date(d);
      return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
  </script>
</body>
</html>`;
}
