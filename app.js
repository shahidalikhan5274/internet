/**
 * NETHISAB PRO - ISP BILLING & PARTNERSHIP SETTLEMENT SYSTEM
 * Multi-Month Auto-Rollover & Dynamic Financial Engine
 */

class NetHisabApp {
  constructor() {
    this.storageKey = 'nethisab_isp_data_v3';
    this.cloudKey = 'nethisab_firebase_cloud_config';
    this.currentMonth = this.getInitialMonth();
    this.activeTab = 'dashboard';
    this.activePaymentUser = null;
    this.activePaymentMonth = null;
    this.activeHistoryUserId = null;
    
    // Cloud sync state
    this.firebaseDb = null;
    this.cloudConfig = null;
    this.isCloudSyncActive = false;
    this.isReceivingRemoteUpdate = false;
    this.lastLocalSaveTimestamp = null;
    this.syncDebounceTimer = null;
    
    // In-memory data store
    this.data = {
      settings: {
        partner1Name: "Shahid",
        partner2Name: "Adnan",
        splitRatio: "50-50",
        currency: "Rs."
      },
      users: [],
      bills: {}, // { "YYYY-MM": { "userId": { paidAmount, collector, date, method, notes } } }
      expenses: {}, // { "YYYY-MM": [ { id, title, category, amount, paidBy, date } ] }
      settlements: {}, // { "YYYY-MM": [ { id, payer, receiver, amount, date, method, notes } ] }
      extraIncome: {} // { "YYYY-MM": [ { id, type, title, amount, collector, customerId, customerName, date, notes } ] }
    };

    this.monthNames = {
      '01': 'January (جنوری)',
      '02': 'February (فروری)',
      '03': 'March (مارچ)',
      '04': 'April (اپریل)',
      '05': 'May (مئی)',
      '06': 'June (جون)',
      '07': 'July (جولائی)',
      '08': 'August (اگست)',
      '09': 'September (ستمبر)',
      '10': 'October (اکتوبر)',
      '11': 'November (نومبر)',
      '12': 'December (دسمبر)'
    };

    this.init();
  }

  getInitialMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  init() {
    this.registerServiceWorker();
    this.loadData();
    this.bindEvents();
    this.syncMonthSelectors();
    this.initCloudSync();
    this.initTableHorizontalScrollControllers();
    this.renderAll();
  }

  /* ===================================================================
     DATA PERSISTENCE & INITIALIZATION
     =================================================================== */
  loadData() {
    let saved = localStorage.getItem(this.storageKey);
    let loadedFromSaved = false;

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Check if saved data has old dummy users (like Chaudhry Farooq or less than 50 users)
        const hasDummy = parsed.users && (parsed.users.some(u => u.name === 'Chaudhry Farooq') || parsed.users.length < 50);
        if (!hasDummy && parsed.users && parsed.users.length > 50) {
          this.data = parsed;
          loadedFromSaved = true;
        }
      } catch (e) {
        console.error("Failed to parse saved data, initializing real register data", e);
      }
    }

    if (!loadedFromSaved) {
      this.loadSampleData();
    }

    // Auto-migrate partner name if previously set to placeholder
    if (this.data.settings) {
      if (!this.data.settings.partner2Name || 
          this.data.settings.partner2Name.includes('Dost') || 
          this.data.settings.partner2Name.includes('Partner')) {
        this.data.settings.partner2Name = "Adnan";
      }
    }
    if (!this.data.settlements) this.data.settlements = {};
    if (!this.data.extraIncome) this.data.extraIncome = {};
    this.saveData();
  }

  saveData(skipCloud = false) {
    localStorage.setItem(this.storageKey, JSON.stringify(this.data));
    
    // Automatically sync to Cloud if connected and not applying inbound remote data
    if (!skipCloud && this.isCloudSyncActive && this.firebaseDb && !this.isReceivingRemoteUpdate) {
      this.debouncePushToCloud();
    }
  }

  loadSampleData() {
    if (window.SAMPLE_ISP_DATA) {
      this.data = JSON.parse(JSON.stringify(window.SAMPLE_ISP_DATA));
      this.saveData();
    }
  }

  /* ===================================================================
     MONTH NAVIGATION & SELECTORS
     =================================================================== */
  syncMonthSelectors() {
    const [year, month] = this.currentMonth.split('-');
    const selectMonth = document.getElementById('selectMonthName');
    const selectYear = document.getElementById('selectYear');

    if (selectMonth) selectMonth.value = month;
    if (selectYear) {
      let opt = Array.from(selectYear.options).find(o => o.value === year);
      if (!opt) {
        opt = document.createElement('option');
        opt.value = year;
        opt.textContent = year;
        selectYear.appendChild(opt);
      }
      selectYear.value = year;
    }
  }

  setMonthYear(year, month) {
    this.currentMonth = `${year}-${month}`;
    this.syncMonthSelectors();
    this.renderAll();
    const monthText = this.monthNames[month] || month;
    this.showToast(`Billing Month: ${monthText} ${year}`);
  }

  navigateMonth(direction) {
    let [year, month] = this.currentMonth.split('-').map(Number);
    if (direction === 'prev') {
      month -= 1;
      if (month < 1) { month = 12; year -= 1; }
    } else if (direction === 'next') {
      month += 1;
      if (month > 12) { month = 1; year += 1; }
    }
    const formattedMonth = String(month).padStart(2, '0');
    this.setMonthYear(String(year), formattedMonth);
  }

  getPreviousMonthKey(monthKey) {
    let [y, m] = monthKey.split('-').map(Number);
    m -= 1;
    if (m < 1) { m = 12; y -= 1; }
    return `${y}-${String(m).padStart(2, '0')}`;
  }

  /* ===================================================================
     DYNAMIC MULTI-MONTH ARREARS / CARRY-FORWARD ENGINE
     =================================================================== */
  /**
   * Computes the opening arrears for a user in a given month.
   * If previous months exist in bills, it rolls forward the unpaid balance!
   */
  getUserArrearsForMonth(userId, targetMonth) {
    if (!this._userMap) {
      this._userMap = new Map(this.data.users.map(u => [u.id, u]));
    }
    const user = this._userMap.get(userId);
    if (!user) return 0;

    const allMonths = Object.keys(this.data.bills).sort();
    const priorMonths = allMonths.filter(m => m < targetMonth);
    if (priorMonths.length === 0) {
      return Number(user.initialArrears) || 0;
    }

    // BILLING-START RULE (2026-11-05): kisi user se sirf us waqt se bill
    // manga jata hai jab se wo customer hai:
    //  - Jo user Nov 2025–Mar 2026 wali purani register (list) mein hai,
    //    uska hisab register ke pehle mahine (Nov 2025) se shuru hota
    //    hai — khaali mahine ka matlab "bill nahi aya" hai, pending
    //    banta hai (jese Waqas1 ka Nov: 1200 pending).
    //  - Jo user us list mein hai hi nahi (April ke baad join hua, jese
    //    Amiradacolony 23 April), uska hisab uski pehli bill entry
    //    wale mahine se shuru hota hai — warna usko Nov–Mar ka ghalat
    //    baqaya dikhne lagta (e.g. Amiradacolony ko April mein Rs 25,000).
    const firstBillMonth = allMonths.find(m => this.data.bills[m] && this.data.bills[m][userId]);
    const registerStart = allMonths[0]; // '2025-11' — purani register ka pehla mahina
    const inOldRegister = allMonths.some(m => m < '2026-04' && this.data.bills[m] && this.data.bills[m][userId]);
    const billingStart = inOldRegister ? registerStart : firstBillMonth;
    if (!billingStart) {
      return Number(user.initialArrears) || 0;
    }

    // MONTH-RANGE FIX (2026-11-05): pehle sirf wo mahine gine jate the
    // jin ki bills mein key mojood thi. Jis mahine kisi user ka bhi bill
    // nahi bana (jese Sep/Oct/Nov 2026 — kisi ne pay nahi kia, to key hi
    // nahi hai), wo mahina hisab se nikal jata tha aur baqaya wahin ruk
    // jata tha (Allied-abid USR-003 ka pending Oct/Nov mein 13,500 pe
    // atka hua). Ab billingStart se targetMonth se pehle tak ke HAR
    // calendar mahine ka hisab hota hai; jis mahine ki entry nahi, us
    // mein user ki base fee lagti hai aur paid 0 hota hai — baqaya har
    // month barhta rehta hai (3000 wala: 6000, phir 9000, phir 12000...).
    const billableMonths = [];
    let _m = billingStart;
    while (_m < targetMonth) {
      billableMonths.push(_m);
      const _y = Number(_m.slice(0, 4));
      const _mo = Number(_m.slice(5, 7));
      _m = _mo === 12 ? `${_y + 1}-01` : `${_y}-${String(_mo + 1).padStart(2, '0')}`;
    }
    if (billableMonths.length === 0) {
      return Number(user.initialArrears) || 0;
    }

    let runningBalance = Number(user.initialArrears) || 0;
    billableMonths.forEach(m => {
      const bill = this.data.bills[m] && this.data.bills[m][userId];
      const mFee = (bill && bill.monthlyFee !== undefined && bill.monthlyFee !== null && bill.monthlyFee !== '')
        ? Number(bill.monthlyFee)
        : (Number(user.monthlyFee) || 0);
      const due = mFee + runningBalance;
      const paid = bill ? (Number(bill.paidAmount) || 0) : 0;
      runningBalance = Math.max(0, due - paid);
    });

    return runningBalance;
  }

  getUserMonthSummary(userId, month) {
    if (!this._summaryCache) this._summaryCache = {};
    const cacheKey = `${userId}_${month}`;
    if (this._summaryCache[cacheKey]) {
      return this._summaryCache[cacheKey];
    }

    if (!this._userMap) {
      this._userMap = new Map(this.data.users.map(u => [u.id, u]));
    }
    const user = this._userMap.get(userId);
    if (!user) return null;

    const bill = this.data.bills[month] && this.data.bills[month][userId];
    const monthlyFee = (bill && bill.monthlyFee !== undefined && bill.monthlyFee !== null && bill.monthlyFee !== '')
      ? Number(bill.monthlyFee)
      : (Number(user.monthlyFee) || 0);
    const openingArrears = this.getUserArrearsForMonth(userId, month);
    const totalDue = monthlyFee + openingArrears;

    const paid = bill ? (Number(bill.paidAmount) || 0) : 0;
    const collector = bill ? bill.collector : null;
    const closingBalance = Math.max(0, totalDue - paid);

    let status = 'unpaid';
    if (paid >= totalDue) status = 'paid';
    else if (paid > 0) status = 'partial';

    const res = {
      monthlyFee,
      openingArrears,
      totalDue,
      paid,
      collector,
      closingBalance,
      status,
      date: bill?.date || '',
      method: bill?.method || '',
      notes: bill?.notes || ''
    };
    this._summaryCache[cacheKey] = res;
    return res;
  }

  /* ===================================================================
     EVENT BINDINGS
     =================================================================== */
  bindEvents() {
    // Navigation Tabs
    document.querySelectorAll('.nav-item').forEach(button => {
      button.addEventListener('click', () => {
        const tab = button.dataset.tab;
        this.switchTab(tab);
      });
    });

    // Month & Year Dropdowns
    const selectMonth = document.getElementById('selectMonthName');
    const selectYear = document.getElementById('selectYear');
    if (selectMonth && selectYear) {
      selectMonth.addEventListener('change', () => {
        this.setMonthYear(selectYear.value, selectMonth.value);
      });
      selectYear.addEventListener('change', () => {
        this.setMonthYear(selectYear.value, selectMonth.value);
      });
    }

    // Previous & Next Month buttons
    document.getElementById('btnPrevMonth')?.addEventListener('click', () => this.navigateMonth('prev'));
    document.getElementById('btnNextMonth')?.addEventListener('click', () => this.navigateMonth('next'));

    // Mobile Sidebar Toggle
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    if (sidebarToggle && sidebar) {
      sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-open');
      });
    }

    // Quick Add User Button
    document.getElementById('btnQuickAddUser')?.addEventListener('click', () => this.openUserModal());
    document.getElementById('btnQuickAddExtraIncome')?.addEventListener('click', () => this.openExtraIncomeModal());

    // Modal Close Buttons
    document.getElementById('btnCloseUserModal')?.addEventListener('click', () => this.closeModals());
    document.getElementById('btnCancelUser')?.addEventListener('click', () => this.closeModals());
    document.getElementById('btnClosePayModal')?.addEventListener('click', () => this.closePaymentModal());
    document.getElementById('btnCancelPay')?.addEventListener('click', () => this.closePaymentModal());
    document.getElementById('btnCloseHistoryModal')?.addEventListener('click', () => this.closeModals());
    document.getElementById('btnCloseToggleStatusModal')?.addEventListener('click', () => this.closeModals());
    document.getElementById('btnCancelToggleStatus')?.addEventListener('click', () => this.closeModals());
    document.getElementById('btnCloseSettlementModal')?.addEventListener('click', () => this.closeModals());
    document.getElementById('btnCancelSettlement')?.addEventListener('click', () => this.closeModals());
    document.getElementById('btnCloseProfModal')?.addEventListener('click', () => this.closeModals());
    document.getElementById('btnCloseExtraIncomeModal')?.addEventListener('click', () => this.closeModals());
    document.getElementById('btnCancelExtraIncome')?.addEventListener('click', () => this.closeModals());

    // Khata Toolbar: Add Month Bill & Year Filter
    document.getElementById('btnKhataAddMonthBill')?.addEventListener('click', () => {
      if (this.activeHistoryUserId) {
        const yr = document.getElementById('khataSelectYear')?.value || '2026';
        const mo = document.getElementById('khataSelectMonth')?.value || '10';
        this.openPaymentModal(this.activeHistoryUserId, `${yr}-${mo}`);
      }
    });

    document.getElementById('khataSelectYear')?.addEventListener('change', (e) => {
      if (this.activeHistoryUserId) {
        this.openCustomerHistoryModal(this.activeHistoryUserId, e.target.value);
      }
    });

    // Extra Income Form Submit
    document.getElementById('formExtraIncome')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSaveExtraIncome();
    });

    // Settlement Form Submit & Full Button
    document.getElementById('formSettlementTransfer')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSaveSettlement();
    });
    document.getElementById('btnSettleFullAmount')?.addEventListener('click', () => {
      const f = this.calculateFinancials();
      if (f.netRemaining > 0) {
        document.getElementById('settleAmount').value = f.netRemaining;
        this.updateSettlementLiveCalculation();
      }
    });

    // Toggle Status Form Submit
    document.getElementById('formToggleStatus')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleConfirmToggleStatus();
    });

    // User Form Submit
    document.getElementById('formUser')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSaveUser();
    });

    // Payment Form Submit
    document.getElementById('formCollectPayment')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSavePayment();
    });

    // Payment Amount Real-time Live Calculation
    const payAmountInput = document.getElementById('payAmount');
    if (payAmountInput) {
      payAmountInput.addEventListener('input', () => {
        this.updatePaymentLiveCalculation();
      });
    }

    const payMonthlyFeeInput = document.getElementById('payMonthlyFee');
    if (payMonthlyFeeInput) {
      payMonthlyFeeInput.addEventListener('input', () => {
        this.updatePaymentLiveCalculation();
      });
    }

    // Pay Full Bill Button
    document.getElementById('btnPayFull')?.addEventListener('click', () => {
      if (this.activePaymentUser) {
        const m = this.activePaymentMonth || this.currentMonth;
        const sum = this.getUserMonthSummary(this.activePaymentUser.id, m);
        const feeInput = document.getElementById('payMonthlyFee');
        const fee = feeInput ? (Number(feeInput.value) || 0) : sum.monthlyFee;
        const totalDue = fee + sum.openingArrears;
        this.setQuickPayAmount(totalDue);
      }
    });

    // Expense Form Submit
    document.getElementById('addExpenseForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleAddExpense();
    });

    // Settings Form Submit
    document.getElementById('settingsPartnersForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSaveSettings();
    });

    // Search and Filter Listeners
    document.getElementById('userSearchInput')?.addEventListener('input', () => this.renderCustomersTable());
    document.getElementById('filterStatus')?.addEventListener('change', () => this.renderCustomersTable());
    document.getElementById('filterConnection')?.addEventListener('change', () => this.renderCustomersTable());
    document.getElementById('filterCollector')?.addEventListener('change', () => this.renderCustomersTable());
    document.getElementById('filterArea')?.addEventListener('change', () => this.renderCustomersTable());

    // Export CSV
    document.getElementById('btnExportUsersCsv')?.addEventListener('click', () => this.exportUsersToCsv());

    // Data Backup / Restore Buttons
    document.getElementById('btnBackupData')?.addEventListener('click', () => this.downloadBackupJson());
    document.getElementById('btnDownloadBackupJson')?.addEventListener('click', () => this.downloadBackupJson());
    document.getElementById('btnLoadDemoData')?.addEventListener('click', () => {
      if (confirm("Kya aap WhatsApp register ka asal 245 users aur bills wala record load karna chahte hain?")) {
        this.loadSampleData();
        this.renderAll();
        this.showToast("WhatsApp register ke tamam 245 users aur bills kamyabi se load ho gaye!");
      }
    });

    document.getElementById('btnResetAllData')?.addEventListener('click', () => {
      if (confirm("Khabardar! Kya aap waqayi tamam users aur bills delete karna chahte hain?")) {
        this.data = {
          settings: { partner1Name: "Shahid", partner2Name: "Dost", splitRatio: "50-50", currency: "Rs." },
          users: [],
          bills: {},
          expenses: {}
        };
        this.saveData();
        this.renderAll();
        this.showToast("Tamam data reset ho chuka hai.", "danger");
      }
    });

    const fileRestoreInput = document.getElementById('fileRestoreInput');
    if (fileRestoreInput) {
      fileRestoreInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const imported = JSON.parse(event.target.result);
            if (imported.users && imported.settings) {
              this.data = imported;
              this.saveData();
              this.renderAll();
              this.showToast("Backup file kamyabi se restore ho gayi!");
            } else {
              alert("Ghalat file format!");
            }
          } catch (err) {
            alert("File read karne me masla hua: " + err.message);
          }
        };
        reader.readAsText(file);
      });
    }

    // Topbar Cloud Status Pill click -> Jump to Settings
    document.getElementById('btnCloudStatusPill')?.addEventListener('click', () => {
      this.switchTab('settings');
      setTimeout(() => {
        document.querySelector('.card-cloud-sync-container')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });

    // Cloud Sync Settings Form & Action Buttons
    document.getElementById('formCloudSyncConfig')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSaveCloudConfig();
    });
    document.getElementById('btnForcePushToCloud')?.addEventListener('click', () => this.forcePushToCloud());
    document.getElementById('btnForcePullFromCloud')?.addEventListener('click', () => this.forcePullFromCloud());
    document.getElementById('btnDisconnectCloud')?.addEventListener('click', () => this.disconnectCloud());
  }

  /* ===================================================================
     TABLE HORIZONTAL SCROLLBAR & CONTROLLER ENGINE
     =================================================================== */
  initTableHorizontalScrollControllers() {
    const setupController = (containerId, btnLeftId, btnRightId, trackId, thumbId) => {
      const container = document.getElementById(containerId);
      const btnLeft = document.getElementById(btnLeftId);
      const btnRight = document.getElementById(btnRightId);
      const track = document.getElementById(trackId);
      const thumb = document.getElementById(thumbId);

      if (!container) return;

      const updateThumb = () => {
        if (!track || !thumb) return;
        const maxScroll = container.scrollWidth - container.clientWidth;
        if (maxScroll <= 0) {
          thumb.style.width = '100%';
          thumb.style.left = '0%';
          return;
        }
        const visibleRatio = Math.max(0.18, container.clientWidth / container.scrollWidth);
        thumb.style.width = `${visibleRatio * 100}%`;
        const scrollRatio = container.scrollLeft / maxScroll;
        const availableTrack = 100 - (visibleRatio * 100);
        thumb.style.left = `${scrollRatio * availableTrack}%`;
      };

      container.addEventListener('scroll', updateThumb);
      window.addEventListener('resize', updateThumb);
      setTimeout(updateThumb, 350);

      btnLeft?.addEventListener('click', () => {
        container.scrollBy({ left: -280, behavior: 'smooth' });
      });

      btnRight?.addEventListener('click', () => {
        container.scrollBy({ left: 280, behavior: 'smooth' });
      });

      track?.addEventListener('click', (e) => {
        const rect = track.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const ratio = Math.max(0, Math.min(1, clickX / rect.width));
        const maxScroll = container.scrollWidth - container.clientWidth;
        container.scrollTo({ left: ratio * maxScroll, behavior: 'smooth' });
      });

      // Desktop mouse drag-to-scroll
      let isDown = false;
      let startX = 0;
      let scrollLeftStart = 0;

      container.addEventListener('mousedown', (e) => {
        if (e.target.closest('button, a, input, select')) return;
        isDown = true;
        startX = e.pageX - container.offsetLeft;
        scrollLeftStart = container.scrollLeft;
      });

      document.addEventListener('mouseup', () => {
        if (isDown) isDown = false;
      });

      container.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - container.offsetLeft;
        const walk = (x - startX) * 1.4;
        container.scrollLeft = scrollLeftStart - walk;
      });
    };

    setupController('customersTableContainer', 'btnScrollTableLeft', 'btnScrollTableRight', 'tableTopScrollTrack', 'tableTopScrollThumb');
    setupController('defaultersTableContainer', 'btnScrollDefaultersLeft', 'btnScrollDefaultersRight', 'defaultersTopScrollTrack', 'defaultersTopScrollThumb');
  }

  /* ===================================================================
     NAVIGATION & UI HELPERS
     =================================================================== */
  switchTab(tabId) {
    this.activeTab = tabId;

    // Update nav buttons
    document.querySelectorAll('.nav-item').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tabId);
    });

    // Update views
    document.querySelectorAll('.tab-view').forEach(v => {
      v.classList.toggle('active', v.id === `view-${tabId}`);
    });

    // Update Page Header Title
    const [year, month] = this.currentMonth.split('-');
    const mName = this.monthNames[month] || month;

    const titles = {
      dashboard: `Dashboard - خلاصہ (${mName} ${year})`,
      customers: `Users & Bills - صارفین کا کھاتہ (${mName} ${year})`,
      partnership: `Partnership Split - شراکت داری اور منافع (${mName} ${year})`,
      defaulters: `Defaulters & Arrears - بقایا جات لسٹ (${mName} ${year})`,
      expenses: `Monthly Expenses - ماہانہ اخراجات (${mName} ${year})`,
      settings: `Partners & Settings - سیٹنگز`
    };

    const titleEl = document.getElementById('pageTitle');
    if (titleEl) titleEl.textContent = titles[tabId] || "NetHisab Pro";

    // Close mobile sidebar if open
    document.getElementById('sidebar')?.classList.remove('mobile-open');

    // Trigger tab specific renders
    if (tabId === 'customers') {
      this.renderCustomersTable();
      setTimeout(() => {
        document.getElementById('customersTableContainer')?.dispatchEvent(new Event('scroll'));
      }, 50);
    }
    if (tabId === 'defaulters') {
      this.renderDefaultersTable();
      setTimeout(() => {
        document.getElementById('defaultersTableContainer')?.dispatchEvent(new Event('scroll'));
      }, 50);
    }
    if (tabId === 'partnership') this.renderPartnershipSettlement();
    if (tabId === 'expenses') this.renderExpenses();
    if (tabId === 'settings') {
      this.populateSettingsForm();
      this.populateCloudSyncForm();
    }
  }

  showToast(msg, type = "success") {
    const toast = document.getElementById('appToast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = `toast show ${type === 'danger' ? 'toast-danger' : 'toast-success'}`;
    setTimeout(() => {
      toast.className = 'toast';
    }, 3200);
  }

  closeModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    this.activePaymentUser = null;
    this.activePaymentMonth = null;
    this.activeHistoryUserId = null;
  }

  closePaymentModal() {
    document.getElementById('modalPayment')?.classList.remove('active');
    this.activePaymentUser = null;
    this.activePaymentMonth = null;
  }

  formatMoney(num) {
    const curr = (this.data.settings && this.data.settings.currency) || "Rs.";
    return `${curr} ${(Number(num) || 0).toLocaleString('en-PK')}`;
  }

  /* ===================================================================
     BUSINESS LOGIC & FINANCIAL CALCULATIONS
     =================================================================== */
  calculateFinancials() {
    const month = this.currentMonth;
    const monthBills = this.data.bills[month] || {};
    const monthExpenses = this.data.expenses[month] || [];

    let totalExpectedBill = 0;
    let totalCollected = 0;
    let p1Collected = 0; // Shahid
    let p2Collected = 0; // Partner
    let unpaidCount = 0;
    let totalPendingArrears = 0;
    let overdueUsersList = [];

    // Calculate Customers & Bills for the selected month
    this.data.users.forEach(user => {
      if (user.status === 'suspended') return;

      const sum = this.getUserMonthSummary(user.id, month);
      totalExpectedBill += sum.totalDue;
      totalCollected += sum.paid;

      if (sum.collector === 'p1') {
        p1Collected += sum.paid;
      } else if (sum.collector === 'p2') {
        p2Collected += sum.paid;
      }

      if (sum.closingBalance > 0) {
        unpaidCount++;
        totalPendingArrears += sum.closingBalance;
        overdueUsersList.push({
          user,
          monthlyFee: sum.monthlyFee,
          arrears: sum.openingArrears,
          paid: sum.paid,
          totalDue: sum.totalDue,
          pending: sum.closingBalance
        });
      }
    });

    // Calculate New Installation Fees for current month
    let totalInstallFees = 0;
    let p1InstallFees = 0;
    let p2InstallFees = 0;

    this.data.users.forEach(u => {
      if (u.installStatus === 'paid' && Number(u.installFee) > 0) {
        const feeDate = u.installDate || u.connectionDate || '';
        const feeMonth = feeDate.substring(0, 7);
        if (feeMonth === month) {
          const amt = Number(u.installFee) || 0;
          totalInstallFees += amt;
          if (u.installCollector === 'p1') p1InstallFees += amt;
          if (u.installCollector === 'p2') p2InstallFees += amt;
        }
      }
    });

    // Add installation revenue to collections and partner accounts
    totalCollected += totalInstallFees;
    p1Collected += p1InstallFees;
    p2Collected += p2InstallFees;

    // Calculate Extra Income (Chargers, Complaint visits, Fiber splicing) for current month
    const monthExtra = (this.data.extraIncome && this.data.extraIncome[month]) || [];
    let totalExtraIncome = 0;
    let p1ExtraIncome = 0;
    let p2ExtraIncome = 0;

    monthExtra.forEach(item => {
      const amt = Number(item.amount) || 0;
      totalExtraIncome += amt;
      if (item.collector === 'p1') p1ExtraIncome += amt;
      if (item.collector === 'p2') p2ExtraIncome += amt;
    });

    // Add extra income to collections and partner accounts
    totalCollected += totalExtraIncome;
    p1Collected += p1ExtraIncome;
    p2Collected += p2ExtraIncome;

    // Calculate Expenses
    let totalExpenses = 0;
    let p1ExpensesPaid = 0;
    let p2ExpensesPaid = 0;

    monthExpenses.forEach(exp => {
      const amt = Number(exp.amount) || 0;
      totalExpenses += amt;
      if (exp.paidBy === 'p1') p1ExpensesPaid += amt;
      if (exp.paidBy === 'p2') p2ExpensesPaid += amt;
      if (exp.paidBy === 'shared') {
        p1ExpensesPaid += amt / 2;
        p2ExpensesPaid += amt / 2;
      }
    });

    // Net Profit
    const netProfit = totalCollected - totalExpenses;

    // Split Calculation
    const ratioStr = (this.data.settings && this.data.settings.splitRatio) || '50-50';
    let p1Ratio = 0.5;
    let p2Ratio = 0.5;
    if (ratioStr === '60-40') { p1Ratio = 0.6; p2Ratio = 0.4; }
    if (ratioStr === '40-60') { p1Ratio = 0.4; p2Ratio = 0.6; }
    if (ratioStr === '70-30') { p1Ratio = 0.7; p2Ratio = 0.3; }

    const p1Share = Math.round(netProfit * p1Ratio);
    const p2Share = Math.round(netProfit * p2Ratio);

    // Cash in Hand
    const p1CashInHand = p1Collected - p1ExpensesPaid;
    const p2CashInHand = p2Collected - p2ExpensesPaid;

    // Settlement difference before inter-partner transfers:
    const p1SettlementDiff = p1CashInHand - p1Share;

    // Calculate Inter-Partner Settlements (Cash already given between partners this month)
    const monthSettlements = (this.data.settlements && this.data.settlements[month]) || [];
    let p1PaidToP2 = 0;
    let p2PaidToP1 = 0;

    monthSettlements.forEach(s => {
      const amt = Number(s.amount) || 0;
      if (s.payer === 'p1' && s.receiver === 'p2') p1PaidToP2 += amt;
      if (s.payer === 'p2' && s.receiver === 'p1') p2PaidToP1 += amt;
    });

    let netRemaining = 0;
    let payerKey = null; // 'p1' or 'p2'
    let receiverKey = null; // 'p2' or 'p1'
    let isSettled = false;
    let totalDueToClear = 0;
    let alreadyTransferred = 0;

    if (p1SettlementDiff > 0) {
      payerKey = 'p1';
      receiverKey = 'p2';
      totalDueToClear = p1SettlementDiff;
      alreadyTransferred = p1PaidToP2 - p2PaidToP1;
      netRemaining = totalDueToClear - alreadyTransferred;
      if (netRemaining <= 0) isSettled = true;
    } else if (p1SettlementDiff < 0) {
      payerKey = 'p2';
      receiverKey = 'p1';
      totalDueToClear = Math.abs(p1SettlementDiff);
      alreadyTransferred = p2PaidToP1 - p1PaidToP2;
      netRemaining = totalDueToClear - alreadyTransferred;
      if (netRemaining <= 0) isSettled = true;
    } else {
      isSettled = true;
    }

    // Net physical cash remaining in hand after all expenses and partner transfers:
    const p1NetCashInHand = p1CashInHand - p1PaidToP2 + p2PaidToP1;
    const p2NetCashInHand = p2CashInHand - p2PaidToP1 + p1PaidToP2;

    // Remaining Payable excess cash that belongs to partner (Baqaya Dena):
    const p1RemainingPayable = (payerKey === 'p1') ? Math.max(0, netRemaining) : 0;
    const p2RemainingPayable = (payerKey === 'p2') ? Math.max(0, netRemaining) : 0;

    return {
      totalExpectedBill,
      totalCollected,
      p1Collected,
      p2Collected,
      totalPendingArrears,
      unpaidCount,
      activeUsersCount: this.data.users.filter(u => u.status === 'active').length,
      totalExpenses,
      p1ExpensesPaid,
      p2ExpensesPaid,
      netProfit,
      p1Share,
      p2Share,
      p1CashInHand,
      p2CashInHand,
      p1NetCashInHand,
      p2NetCashInHand,
      p1RemainingPayable,
      p2RemainingPayable,
      p1PaidToP2,
      p2PaidToP1,
      p1SettlementDiff,
      rawP1Diff: p1SettlementDiff,
      netRemaining,
      isSettled,
      totalDueToClear,
      alreadyTransferred,
      payerKey,
      receiverKey,
      monthSettlements,
      totalInstallFees,
      p1InstallFees,
      p2InstallFees,
      totalExtraIncome,
      p1ExtraIncome,
      p2ExtraIncome,
      monthExtraIncome: monthExtra,
      overdueUsersList
    };
  }

  /* ===================================================================
     RENDER FUNCTIONS
     =================================================================== */
  renderAll() {
    this._summaryCache = {};
    this._userMap = null;
    this.updatePartnerLabels();
    this.renderDashboard();
    if (this.activeTab === 'customers') {
      this.renderCustomersTable();
    } else if (this.activeTab === 'partnership') {
      this.renderPartnershipSettlement();
    } else if (this.activeTab === 'defaulters') {
      this.renderDefaultersTable();
    } else if (this.activeTab === 'expenses') {
      this.renderExpenses();
    }
    this.populateAreaFilter();
  }

  updatePartnerLabels() {
    const p1 = this.data.settings.partner1Name || "Shahid";
    const p2 = this.data.settings.partner2Name || "Adnan";

    document.getElementById('partner1NameLabel').textContent = p1;
    document.getElementById('partner2NameLabel').textContent = p2;
    document.getElementById('avatarP1').textContent = p1.charAt(0).toUpperCase();
    document.getElementById('avatarP2').textContent = p2.charAt(0).toUpperCase();
    document.getElementById('dashP1Title').textContent = p1;
    document.getElementById('dashP2Title').textContent = p2;

    if (document.getElementById('optPayP1')) document.getElementById('optPayP1').textContent = `${p1} (Shahid ke paas gye)`;
    if (document.getElementById('optPayP2')) document.getElementById('optPayP2').textContent = `${p2} (Adnan ke paas gye)`;
    if (document.getElementById('optExtraP1')) document.getElementById('optExtraP1').textContent = `${p1} (Shahid ke paas gye)`;
    if (document.getElementById('optExtraP2')) document.getElementById('optExtraP2').textContent = `${p2} (Adnan ke paas gye)`;
  }

  renderDashboard() {
    const f = this.calculateFinancials();
    const p1 = this.data.settings.partner1Name || "Shahid";
    const p2 = this.data.settings.partner2Name || "Partner";

    // KPIs
    document.getElementById('kpiExpectedBill').textContent = this.formatMoney(f.totalExpectedBill);
    const disabledCount = this.data.users.filter(u => u.status === 'disabled').length;
    document.getElementById('kpiActiveUsersCount').textContent = `${f.activeUsersCount} Active (${disabledCount} Band)`;

    document.getElementById('kpiTotalCollected').textContent = this.formatMoney(f.totalCollected);
    const billsOnly = f.totalCollected - f.totalInstallFees - f.totalExtraIncome;
    const rate = f.totalExpectedBill > 0 ? Math.round((billsOnly / f.totalExpectedBill) * 100) : 0;
    
    let extraParts = [];
    if (f.totalInstallFees > 0) extraParts.push(`${this.formatMoney(f.totalInstallFees)} Install`);
    if (f.totalExtraIncome > 0) extraParts.push(`${this.formatMoney(f.totalExtraIncome)} Extra`);

    if (extraParts.length > 0) {
      document.getElementById('kpiCollectionRate').textContent = `${rate}% Bills Wasool + (${extraParts.join(' + ')})`;
    } else {
      document.getElementById('kpiCollectionRate').textContent = `${rate}% Wasool Shuda`;
    }

    document.getElementById('kpiTotalPending').textContent = this.formatMoney(f.totalPendingArrears);
    document.getElementById('kpiUnpaidUsersCount').textContent = `${f.unpaidCount} Users Unpaid`;

    document.getElementById('kpiNetProfit').textContent = this.formatMoney(f.netProfit);
    document.getElementById('kpiTotalExpenseSub').textContent = `Total Kharche: ${this.formatMoney(f.totalExpenses)}`;

    // Badges
    document.getElementById('totalUsersBadge').textContent = this.data.users.length;
    document.getElementById('defaulterCountBadge').textContent = f.overdueUsersList.length;

    // Live Settlement Hero
    document.getElementById('dashP1Collected').textContent = this.formatMoney(f.p1Collected);
    document.getElementById('dashP2Collected').textContent = this.formatMoney(f.p2Collected);

    const dashP1Foot = document.getElementById('dashP1Foot');
    const dashP2Foot = document.getElementById('dashP2Foot');
    if (dashP1Foot && dashP2Foot) {
      if (f.p1RemainingPayable > 0) {
        dashP1Foot.innerHTML = `<span style="color:#ef4444; font-weight:700;">⚠️ ${p2} ko ${this.formatMoney(f.p1RemainingPayable)} dena baqi</span>`;
        dashP2Foot.innerHTML = `<span style="color:#06b6d4; font-weight:700;">💰 ${p1} se ${this.formatMoney(f.p1RemainingPayable)} lena hai</span>`;
      } else if (f.p2RemainingPayable > 0) {
        dashP2Foot.innerHTML = `<span style="color:#ef4444; font-weight:700;">⚠️ ${p1} ko ${this.formatMoney(f.p2RemainingPayable)} dena baqi</span>`;
        dashP1Foot.innerHTML = `<span style="color:#06b6d4; font-weight:700;">💰 ${p2} se ${this.formatMoney(f.p2RemainingPayable)} lena hai</span>`;
      } else {
        dashP1Foot.innerHTML = `<span style="color:#10b981; font-weight:700;">✅ Cash in Hand = 0 Baqi (Clear)</span>`;
        dashP2Foot.innerHTML = `<span style="color:#10b981; font-weight:700;">✅ Cash in Hand = 0 Baqi (Clear)</span>`;
      }
    }

    // Settlement Verdict
    const verdictMain = document.getElementById('dashVerdictMain');
    const verdictDetail = document.getElementById('dashVerdictDetail');
    const dashSettleBtn = document.getElementById('btnDashSettlePay');

    const payerName = f.payerKey === 'p1' ? p1 : p2;
    const receiverName = f.receiverKey === 'p1' ? p1 : p2;

    if (f.totalCollected === 0) {
      verdictMain.textContent = "Is mahine abhi tak koi bill wasool nahi hua.";
      verdictDetail.textContent = "Users se bill collect karein, hisab khud ba khud nikal aayega.";
      if (dashSettleBtn) dashSettleBtn.style.display = 'none';
    } else if (f.isSettled) {
      verdictMain.textContent = `✨ Mubarak ho! Dono partners ka hisab bilkul CLEAR (Rs. 0 Balance) hai!`;
      verdictDetail.textContent = f.alreadyTransferred > 0 
        ? `${payerName} ne ${receiverName} ko ${this.formatMoney(f.alreadyTransferred)} ada kar diye — Ab ${payerName} ke hath me Baqaya = Rs. 0 (Zero Balance)!`
        : `Dono partners ka hisab barabar hai. Kisi ne koi raqam nahi deni.`;
      if (dashSettleBtn) dashSettleBtn.style.display = 'none';
    } else {
      verdictMain.textContent = `⚖️ ${payerName} ko ${this.formatMoney(f.netRemaining)} cash ${receiverName} ko dena hai!`;
      verdictDetail.textContent = f.alreadyTransferred > 0
        ? `Kul hisab ${this.formatMoney(f.totalDueToClear)} tha, jis me se ${this.formatMoney(f.alreadyTransferred)} ada ho chuka hai. Baqaya sirf ${this.formatMoney(f.netRemaining)} dena baqi hai taake baqaya 0 ho jaye.`
        : `Ye raqam ${payerName}, ${receiverName} ko de kar hisab 0 (barabar) kar sakta hai.`;
      if (dashSettleBtn) {
        dashSettleBtn.style.display = 'inline-flex';
        dashSettleBtn.textContent = `💸 ${payerName} ➔ ${receiverName} Ko ${this.formatMoney(f.netRemaining)} De Kar 0 Karein`;
      }
    }

    // Dashboard Quick Defaulters List
    const quickDefaultersEl = document.getElementById('quickDefaultersList');
    if (quickDefaultersEl) {
      if (f.overdueUsersList.length === 0) {
        quickDefaultersEl.innerHTML = `<tr><td colspan="5" class="text-center" style="padding:20px; color: var(--text-dim);">Koi defaulter nahi hai, shabash!</td></tr>`;
      } else {
        const top5 = f.overdueUsersList.slice(0, 5);
        quickDefaultersEl.innerHTML = top5.map(item => `
          <tr>
            <td>
              <div class="user-name-cell">
                <strong>${item.user.name}</strong>
                <span>${item.user.id}</span>
              </div>
            </td>
            <td>
              <div class="user-area-cell">
                <div>${item.user.area}</div>
                <small style="color:var(--text-dim);">${item.user.phone}</small>
              </div>
            </td>
            <td class="text-danger font-weight-bold">${this.formatMoney(item.arrears)}</td>
            <td><strong>${this.formatMoney(item.pending)}</strong></td>
            <td>
              <div class="row-actions">
                <button class="btn-collect" onclick="app.openPaymentModal('${item.user.id}')">Wasool</button>
                <a href="${this.getWhatsAppReminderLink(item.user, item.monthlyFee, item.arrears, item.pending)}" target="_blank" class="btn-wa-reminder" title="WhatsApp Reminder">
                  WA
                </a>
              </div>
            </td>
          </tr>
        `).join('');
      }
    }

    // Recent Payments
    const recentPaymentsEl = document.getElementById('recentPaymentsList');
    if (recentPaymentsEl) {
      const monthBills = this.data.bills[this.currentMonth] || {};
      const paidUserIds = Object.keys(monthBills);
      if (paidUserIds.length === 0) {
        recentPaymentsEl.innerHTML = `<tr><td colspan="4" class="text-center" style="padding:20px; color: var(--text-dim);">Abhi is mahine koi payment record nahi hui.</td></tr>`;
      } else {
        const recent = paidUserIds.slice(-5).reverse();
        recentPaymentsEl.innerHTML = recent.map(uid => {
          const u = this.data.users.find(usr => usr.id === uid) || { name: 'Unknown User' };
          const b = monthBills[uid];
          const collectorName = b.collector === 'p1' ? p1 : p2;
          const collectorClass = b.collector === 'p1' ? 'badge-collector-p1' : 'badge-collector-p2';
          return `
            <tr>
              <td><strong>${u.name}</strong></td>
              <td class="text-success font-weight-bold">${this.formatMoney(b.paidAmount)}</td>
              <td><span class="${collectorClass}">${collectorName}</span></td>
              <td style="color: var(--text-dim); font-size: 0.8rem;">${b.date || '-'}</td>
            </tr>
          `;
        }).join('');
      }
    }

    // Render Charger & Complaint Extra Income table on Dashboard
    this.renderDashboardExtraIncome();
  }

  /* ===================================================================
     CUSTOMERS & BILLS TABLE
     =================================================================== */
  renderCustomersTable() {
    const tbody = document.getElementById('customersTableBody');
    if (!tbody) return;

    const searchTerm = (document.getElementById('userSearchInput')?.value || '').toLowerCase().trim();
    const statusFilter = document.getElementById('filterStatus')?.value || 'all';
    const connFilter = document.getElementById('filterConnection')?.value || 'all';
    const collectorFilter = document.getElementById('filterCollector')?.value || 'all';
    const areaFilter = document.getElementById('filterArea')?.value || 'all';

    const p1 = this.data.settings.partner1Name || "Shahid";
    const p2 = this.data.settings.partner2Name || "Adnan";

    const userSummaries = new Map();
    this.data.users.forEach(u => {
      userSummaries.set(u.id, this.getUserMonthSummary(u.id, this.currentMonth));
    });

    let visibleUsers = this.data.users.filter(user => {
      // Search
      const matchSearch = !searchTerm ||
        user.name.toLowerCase().includes(searchTerm) ||
        user.id.toLowerCase().includes(searchTerm) ||
        user.phone.toLowerCase().includes(searchTerm) ||
        user.area.toLowerCase().includes(searchTerm);
      if (!matchSearch) return false;

      // Connection Filter
      if (connFilter === 'active' && user.status === 'disabled') return false;
      if (connFilter === 'disabled' && user.status !== 'disabled') return false;

      // Area
      if (areaFilter !== 'all' && user.area !== areaFilter) return false;

      const sum = userSummaries.get(user.id);
      if (!sum) return false;

      // Status Filter
      if (statusFilter === 'paid' && sum.status !== 'paid') return false;
      if (statusFilter === 'unpaid' && sum.status !== 'unpaid') return false;
      if (statusFilter === 'partial' && sum.status !== 'partial') return false;
      if (statusFilter === 'arrears' && sum.openingArrears <= 0) return false;

      // Collector Filter
      if (collectorFilter === 'p1' && sum.collector !== 'p1') return false;
      if (collectorFilter === 'p2' && sum.collector !== 'p2') return false;
      if (collectorFilter === 'unassigned' && sum.collector) return false;

      return true;
    });

    document.getElementById('usersTableCountInfo').textContent = `Showing ${visibleUsers.length} of ${this.data.users.length} total users`;

    if (visibleUsers.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding: 30px; color: var(--text-dim);">Koi user match nahi hua. Search ya Filter tabdeel karein.</td></tr>`;
      return;
    }

    tbody.innerHTML = visibleUsers.map(user => {
      const sum = userSummaries.get(user.id);

      let statusBadge = `<span class="badge-status badge-unpaid">Unpaid (Rs. ${sum.closingBalance})</span>`;
      if (sum.status === 'paid') {
        statusBadge = `<span class="badge-status badge-paid">Paid (Rs. ${sum.paid})</span>`;
      } else if (sum.status === 'partial') {
        statusBadge = `<span class="badge-status badge-partial">Partial (Paid Rs. ${sum.paid})</span>`;
      }

      let collectorBadge = `<span class="badge-collector-none">— Baqi Hai —</span>`;
      if (sum.collector === 'p1') {
        collectorBadge = `<span class="badge-collector-p1">${p1}</span>`;
      } else if (sum.collector === 'p2') {
        collectorBadge = `<span class="badge-collector-p2">${p2}</span>`;
      }

      return `
        <tr style="${user.status === 'disabled' ? 'opacity: 0.78; background: rgba(239, 68, 68, 0.03);' : ''}">
          <td>
            <div class="user-name-cell">
              <strong>${user.name}</strong>
              <span>${user.id} ${user.ip ? `• ${user.ip}` : ''}</span>
            </div>
          </td>
          <td>
            <div class="user-area-cell">
              <div>${user.area}</div>
              <small style="color:var(--text-dim);">${user.phone}</small>
            </div>
          </td>
          <td>
            ${user.status === 'disabled' ? `
              <div class="badge-conn-disabled">
                <strong><span class="status-dot dot-red"></span> Band (Disabled)</strong>
                <small>Tareekh: ${user.disabledDate || '-'}</small>
                ${user.disabledReason ? `<small style="color:var(--text-dim);" title="${user.disabledReason}">(${user.disabledReason.substring(0, 16)}...)</small>` : ''}
              </div>
            ` : `
              <div class="badge-conn-active">
                <strong><span class="status-dot dot-green"></span> Chalu (Active)</strong>
                ${user.enabledDate ? `<small>Chalu: ${user.enabledDate}</small>` : '<small>Active</small>'}
              </div>
            `}
          </td>
          <td>
            <div><strong>${this.formatMoney(sum.monthlyFee)}</strong></div>
            <small style="color:var(--text-dim);">${user.package || 'Internet'}</small>
          </td>
          <td>
            ${sum.openingArrears > 0 ? `<span class="text-danger font-weight-bold">${this.formatMoney(sum.openingArrears)}</span>` : '<span style="color:var(--text-dim)">0</span>'}
          </td>
          <td>
            <strong>${this.formatMoney(sum.totalDue)}</strong>
          </td>
          <td>${statusBadge}</td>
          <td>${collectorBadge}</td>
          <td class="text-right">
            <div class="row-actions">
              <button class="btn-collect" onclick="app.openPaymentModal('${user.id}')" title="Bill Wasool Karein">
                ${sum.paid > 0 ? 'Edit Pay' : 'Wasool'}
              </button>

              <button class="btn-profile-data" onclick="app.openUserProfileModal('${user.id}')" title="Customer Ka Pura Data (CNIC, Date, Installation) Dekhein">
                👤 Data
              </button>

              ${user.status === 'disabled' ? `
                <button class="btn-enable-user" onclick="app.openToggleStatusModal('${user.id}', 'enable')" title="User Connection Chalu Karein">
                  🟢 Chalu
                </button>
              ` : `
                <button class="btn-disable-user" onclick="app.openToggleStatusModal('${user.id}', 'disable')" title="User Connection Band Karein">
                  🔴 Band
                </button>
              `}

              <button class="btn-history" onclick="app.openCustomerHistoryModal('${user.id}')" title="Pura Mahana Khata Dekhein">
                📅 Khata
              </button>
              <button class="btn-wa-reminder" onclick="app.sendWhatsAppMessage('${user.id}')" title="WhatsApp Message Bhejein">
                WA
              </button>
              <button class="btn btn-sm btn-outline" onclick="app.openUserModal('${user.id}')" title="User Edit">
                ✏️
              </button>
              <button class="btn-delete-user" onclick="app.deleteUser('${user.id}')" title="User Delete / Remove Karein">
                🗑️ Delete
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    setTimeout(() => {
      document.getElementById('customersTableContainer')?.dispatchEvent(new Event('scroll'));
    }, 50);
  }

  populateAreaFilter() {
    const areaSelect = document.getElementById('filterArea');
    if (!areaSelect) return;
    const areas = [...new Set(this.data.users.map(u => u.area).filter(Boolean))].sort();
    const currentVal = areaSelect.value;
    areaSelect.innerHTML = `<option value="all">Tamam Areas (${areas.length})</option>` +
      areas.map(a => `<option value="${a}">${a}</option>`).join('');
    areaSelect.value = currentVal || 'all';
  }

  /* ===================================================================
     PARTNERSHIP DETAILED SETTLEMENT VIEW
     =================================================================== */
  renderPartnershipSettlement() {
    const f = this.calculateFinancials();
    const p1 = this.data.settings.partner1Name || "Shahid";
    const p2 = this.data.settings.partner2Name || "Partner";
    const ratio = this.data.settings.splitRatio || "50-50";

    document.getElementById('displaySplitRatio').textContent = `${ratio} Split`;
    document.getElementById('colP1Name').textContent = p1;
    document.getElementById('colP2Name').textContent = p2;
    document.getElementById('avatarColP1').textContent = p1.charAt(0).toUpperCase();
    document.getElementById('avatarColP2').textContent = p2.charAt(0).toUpperCase();

    // Month Bills Counts
    let p1Count = 0;
    let p2Count = 0;
    this.data.users.forEach(u => {
      const sum = this.getUserMonthSummary(u.id, this.currentMonth);
      if (sum.collector === 'p1' && sum.paid > 0) p1Count++;
      if (sum.collector === 'p2' && sum.paid > 0) p2Count++;
    });

    // P1 Stats
    document.getElementById('statP1BillsCount').textContent = `${p1Count} Users`;
    let p1Parts = [];
    const p1BillsOnly = f.p1Collected - f.p1InstallFees - f.p1ExtraIncome;
    p1Parts.push(`Bills: ${this.formatMoney(p1BillsOnly)}`);
    if (f.p1InstallFees > 0) p1Parts.push(`Install: ${this.formatMoney(f.p1InstallFees)}`);
    if (f.p1ExtraIncome > 0) p1Parts.push(`Charger/Complain: ${this.formatMoney(f.p1ExtraIncome)}`);

    if (f.p1InstallFees > 0 || f.p1ExtraIncome > 0) {
      document.getElementById('statP1CashTotal').innerHTML = `${this.formatMoney(f.p1Collected)} <small style="display:block; font-size:0.75rem; color:var(--accent-cyan); font-weight:normal;">(${p1Parts.join(' + ')})</small>`;
    } else {
      document.getElementById('statP1CashTotal').textContent = this.formatMoney(f.p1Collected);
    }
    document.getElementById('statP1ExpensesPaid').textContent = this.formatMoney(f.p1ExpensesPaid);
    
    // Transfers & Baqaya Dena (Payable in Hand)
    const transP1Label = document.getElementById('statP1TransferredLabel');
    if (transP1Label) transP1Label.textContent = `${p2} Ko Ada Kiye:`;
    const transP1 = document.getElementById('statP1Transferred');
    if (transP1) transP1.textContent = this.formatMoney(f.p1PaidToP2);

    const dueP1 = document.getElementById('statP1PayableDue');
    if (dueP1) {
      if (f.p1RemainingPayable > 0) {
        dueP1.textContent = `${this.formatMoney(f.p1RemainingPayable)} (Dena Hai)`;
        dueP1.className = "text-danger font-weight-bold";
      } else {
        dueP1.textContent = "Rs. 0 (Clear!)";
        dueP1.className = "text-success font-weight-bold";
      }
    }
    document.getElementById('statP1NetInHand').textContent = this.formatMoney(f.p1NetCashInHand);

    // P2 Stats
    document.getElementById('statP2BillsCount').textContent = `${p2Count} Users`;
    let p2Parts = [];
    const p2BillsOnly = f.p2Collected - f.p2InstallFees - f.p2ExtraIncome;
    p2Parts.push(`Bills: ${this.formatMoney(p2BillsOnly)}`);
    if (f.p2InstallFees > 0) p2Parts.push(`Install: ${this.formatMoney(f.p2InstallFees)}`);
    if (f.p2ExtraIncome > 0) p2Parts.push(`Charger/Complain: ${this.formatMoney(f.p2ExtraIncome)}`);

    if (f.p2InstallFees > 0 || f.p2ExtraIncome > 0) {
      document.getElementById('statP2CashTotal').innerHTML = `${this.formatMoney(f.p2Collected)} <small style="display:block; font-size:0.75rem; color:var(--accent-cyan); font-weight:normal;">(${p2Parts.join(' + ')})</small>`;
    } else {
      document.getElementById('statP2CashTotal').textContent = this.formatMoney(f.p2Collected);
    }
    document.getElementById('statP2ExpensesPaid').textContent = this.formatMoney(f.p2ExpensesPaid);

    // Transfers & Baqaya Lena (Receivable in Hand)
    const transP2Label = document.getElementById('statP2TransferredLabel');
    if (transP2Label) transP2Label.textContent = `${p1} Se Wasool Kiye:`;
    const transP2 = document.getElementById('statP2Transferred');
    if (transP2) transP2.textContent = this.formatMoney(f.p1PaidToP2);

    const dueP2 = document.getElementById('statP2ReceivableDue');
    if (dueP2) {
      if (f.p2RemainingPayable > 0) {
        dueP2.textContent = `${this.formatMoney(f.p2RemainingPayable)} (Dena Hai)`;
        dueP2.className = "text-danger font-weight-bold";
      } else {
        dueP2.textContent = "Rs. 0 (Clear!)";
        dueP2.className = "text-success font-weight-bold";
      }
    }
    document.getElementById('statP2NetInHand').textContent = this.formatMoney(f.p2NetCashInHand);

    // Business Summary
    let netParts = [];
    const netBillsOnly = f.totalCollected - f.totalInstallFees - f.totalExtraIncome;
    netParts.push(`Bills: ${this.formatMoney(netBillsOnly)}`);
    if (f.totalInstallFees > 0) netParts.push(`Install: ${this.formatMoney(f.totalInstallFees)}`);
    if (f.totalExtraIncome > 0) netParts.push(`Charger/Complain: ${this.formatMoney(f.totalExtraIncome)}`);

    if (f.totalInstallFees > 0 || f.totalExtraIncome > 0) {
      document.getElementById('statNetTotalCollected').innerHTML = `${this.formatMoney(f.totalCollected)} <small style="display:block; font-size:0.75rem; color:var(--accent-cyan); font-weight:normal;">(${netParts.join(' + ')})</small>`;
    } else {
      document.getElementById('statNetTotalCollected').textContent = this.formatMoney(f.totalCollected);
    }
    document.getElementById('statNetTotalExpenses').textContent = this.formatMoney(f.totalExpenses);
    document.getElementById('statNetBusinessProfit').textContent = this.formatMoney(f.netProfit);
    document.getElementById('statPerPartnerShare').textContent = `${p1}: ${this.formatMoney(f.p1Share)} | ${p2}: ${this.formatMoney(f.p2Share)}`;

    // Final Verdict
    const headline = document.getElementById('finalSettlementHeadline');
    const instruction = document.getElementById('finalSettlementInstructions');
    const mainBanner = document.getElementById('mainVerdictBanner');
    const mainIcon = document.getElementById('mainVerdictIcon');
    const openSettleText = document.getElementById('btnOpenSettlementText');

    const payerName = f.payerKey === 'p1' ? p1 : p2;
    const receiverName = f.receiverKey === 'p1' ? p1 : p2;

    if (f.totalCollected === 0) {
      headline.textContent = "Hisab Bilkul Fresh Hai";
      instruction.textContent = "Is mahine jab aap ya aapka dost users se bills collect karenge to ye hisab automatically calculate hota jayega.";
      if (mainBanner) { mainBanner.style.background = ''; mainBanner.style.borderColor = ''; }
      if (mainIcon) mainIcon.textContent = '💰';
      if (openSettleText) openSettleText.textContent = "💸 Hisab Clear / Pay Karein";
    } else if (f.isSettled) {
      headline.textContent = `✨ Mubarak ho! Hisab Bilkul CLEAR (Rs. 0 Balance) Hai!`;
      instruction.innerHTML = f.alreadyTransferred > 0
        ? `Dono partners ka hisab barabar ho chuka hai. <strong>${payerName}</strong> ne <strong>${receiverName}</strong> ko <strong>${this.formatMoney(f.alreadyTransferred)}</strong> ada kar diye hain. Ab kisi partner ne kisi ko koi raqam nahi deni!`
        : `Dono partners ne bilkul barabar raqam wasool ki hai aur kharche nikal kar hisab 0 ho chuka hai.`;
      
      if (mainBanner) {
        mainBanner.style.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(6, 182, 212, 0.18))';
        mainBanner.style.borderColor = 'rgba(16, 185, 129, 0.6)';
      }
      if (mainIcon) mainIcon.textContent = '✅';
      if (openSettleText) openSettleText.textContent = "💸 Mazeed Payment Record";
    } else {
      headline.textContent = `👉 ${payerName} ko ${this.formatMoney(f.netRemaining)} Cash ${receiverName} ko ada karna hai!`;
      instruction.innerHTML = f.alreadyTransferred > 0
        ? `Kul settlement <strong>${this.formatMoney(f.totalDueToClear)}</strong> banti thi, jis me se <strong>${this.formatMoney(f.alreadyTransferred)}</strong> ada ho chuka hai. Baqaya sirf <strong>${this.formatMoney(f.netRemaining)}</strong> ada karna baqi hai taake hisab 0 ho jaye.`
        : `<strong>Tafseel:</strong> ${payerName} ke paas wasooli aur kharche nikal kar ziyada cash hai jabkay hissa kam banta hai. Lehaza izafi <strong>${this.formatMoney(f.netRemaining)}</strong> jab ${payerName}, ${receiverName} ko de dega to hisab 0 (barabar) ho jayega.`;

      if (mainBanner) { mainBanner.style.background = ''; mainBanner.style.borderColor = ''; }
      if (mainIcon) mainIcon.textContent = '💰';
      if (openSettleText) openSettleText.textContent = `💸 ${payerName} ➔ ${receiverName} Ko Pay Karein`;
    }

    // Render Settlement Transfers History List Card
    const transfersCard = document.getElementById('settlementTransfersCard');
    const transfersTbody = document.getElementById('settlementTransfersTableBody');
    const totalPaidTag = document.getElementById('settlementTotalPaidTag');

    if (transfersCard && transfersTbody) {
      if (f.monthSettlements.length > 0) {
        transfersCard.style.display = 'block';
        if (totalPaidTag) totalPaidTag.textContent = `${this.formatMoney(f.alreadyTransferred)} Ada Shuda`;

        transfersTbody.innerHTML = f.monthSettlements.map((item, idx) => {
          const pName = item.payer === 'p1' ? p1 : p2;
          const rName = item.receiver === 'p1' ? p1 : p2;
          return `
            <tr>
              <td><strong>${pName}</strong></td>
              <td><strong>${rName}</strong></td>
              <td class="text-success font-weight-bold" style="font-size:0.95rem;">${this.formatMoney(item.amount)}</td>
              <td><span class="badge" style="background:var(--bg-card);">${item.method || 'Cash'}</span></td>
              <td style="color:var(--text-dim); font-size:0.8rem;">${item.date || '-'}</td>
              <td style="color:var(--text-muted); font-size:0.8rem;">${item.notes || '-'}</td>
              <td class="text-right">
                <button class="btn btn-sm btn-outline text-danger" onclick="app.deleteSettlement(${idx})" title="Transfer Delete / Undo Karein">
                  🗑️
                </button>
              </td>
            </tr>
          `;
        }).join('');
      } else {
        transfersCard.style.display = 'none';
      }
    }
  }

  /* ===================================================================
     DEFAULTERS VIEW
     =================================================================== */
  renderDefaultersTable() {
    const tbody = document.getElementById('defaultersTableBody');
    if (!tbody) return;

    const f = this.calculateFinancials();
    document.getElementById('totalOverdueAmount').textContent = this.formatMoney(f.totalPendingArrears);

    if (f.overdueUsersList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center" style="padding: 30px; color: var(--text-dim);">Koi defaulter ya overdue user nahi hai! Tamam bills clear hain.</td></tr>`;
      return;
    }

    tbody.innerHTML = f.overdueUsersList.map(item => {
      const monthsCount = item.monthlyFee > 0 ? (item.pending / item.monthlyFee).toFixed(1) : 1;

      return `
        <tr>
          <td>
            <div class="user-name-cell">
              <strong>${item.user.name}</strong>
              <span>${item.user.id}</span>
            </div>
          </td>
          <td>${item.user.phone}</td>
          <td>${item.user.area}</td>
          <td>${item.user.package}</td>
          <td class="text-danger font-weight-bold">${this.formatMoney(item.arrears)}</td>
          <td>${this.formatMoney(item.monthlyFee)}</td>
          <td><strong class="text-danger" style="font-size:1rem;">${this.formatMoney(item.pending)}</strong></td>
          <td>
            <span class="badge badge-danger">${monthsCount} Mahine</span>
          </td>
          <td>
            <div class="row-actions">
              <button class="btn-collect" onclick="app.openPaymentModal('${item.user.id}')">Wasool</button>
              <button class="btn-history" onclick="app.openCustomerHistoryModal('${item.user.id}')">📅 Khata</button>
              <button class="btn-wa-reminder" onclick="app.sendWhatsAppMessage('${item.user.id}')">WhatsApp</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    setTimeout(() => {
      document.getElementById('defaultersTableContainer')?.dispatchEvent(new Event('scroll'));
    }, 50);
  }

  /* ===================================================================
     EXPENSES VIEW
     =================================================================== */
  renderExpenses() {
    const tbody = document.getElementById('expenseTableBody');
    if (!tbody) return;

    const monthExp = this.data.expenses[this.currentMonth] || [];
    const p1 = this.data.settings.partner1Name || "Shahid";
    const p2 = this.data.settings.partner2Name || "Partner";

    let total = 0;
    monthExp.forEach(e => total += Number(e.amount) || 0);
    document.getElementById('expenseTotalSumDisplay').textContent = this.formatMoney(total);
    document.getElementById('expenseMonthSubtitle').textContent = `Month: ${this.currentMonth}`;

    if (monthExp.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="padding: 24px; color: var(--text-dim);">Is mahine abhi koi kharcha darj nahi kia gya.</td></tr>`;
      return;
    }

    tbody.innerHTML = monthExp.map((exp, index) => {
      let payerName = "Shared / Common Pool";
      if (exp.paidBy === 'p1') payerName = `${p1} (Apni Jeb Se)`;
      if (exp.paidBy === 'p2') payerName = `${p2} (Apni Jeb Se)`;

      return `
        <tr>
          <td><strong>${exp.title}</strong></td>
          <td><span class="badge" style="background:var(--bg-surface);">${exp.category}</span></td>
          <td class="text-danger font-weight-bold">${this.formatMoney(exp.amount)}</td>
          <td>${payerName}</td>
          <td style="color:var(--text-dim);">${exp.date || '-'}</td>
          <td class="text-right">
            <button class="btn btn-sm btn-outline text-danger" onclick="app.deleteExpense(${index})" title="Delete">
              🗑️
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  handleAddExpense() {
    const title = document.getElementById('expenseTitle').value.trim();
    const category = document.getElementById('expenseCategory').value;
    const amount = Number(document.getElementById('expenseAmount').value) || 0;
    const paidBy = document.getElementById('expensePayer').value;
    const date = document.getElementById('expenseDate').value || new Date().toISOString().split('T')[0];

    if (!title || amount <= 0) {
      alert("Baraye meharbani kharche ki tafseel aur raqam sahi likhein.");
      return;
    }

    if (!this.data.expenses[this.currentMonth]) {
      this.data.expenses[this.currentMonth] = [];
    }

    this.data.expenses[this.currentMonth].push({
      id: `EXP-${Date.now()}`,
      title,
      category,
      amount,
      paidBy,
      date
    });

    this.saveData();
    this.renderAll();
    this.showToast("Kharcha kamyabi se save ho gya!");
    document.getElementById('addExpenseForm').reset();
  }

  deleteExpense(index) {
    if (confirm("Kya aap waqayi ye kharcha delete karna chahte hain?")) {
      this.data.expenses[this.currentMonth].splice(index, 1);
      this.saveData();
      this.renderAll();
      this.showToast("Kharcha delete ho gya.", "danger");
    }
  }

  /* ===================================================================
     EXTRA INCOME (CHARGER, COMPLAINT VISITS, FIBER REPAIRS)
     =================================================================== */
  openExtraIncomeModal(preSelectedCustomerId = null) {
    const modal = document.getElementById('modalExtraIncome');
    const form = document.getElementById('formExtraIncome');
    if (!modal || !form) return;
    form.reset();

    const editIdInput = document.getElementById('editExtraIncomeId');
    if (editIdInput) editIdInput.value = '';

    const p1 = this.data.settings.partner1Name || "Shahid";
    const p2 = this.data.settings.partner2Name || "Adnan";

    const optP1 = document.getElementById('optExtraP1');
    const optP2 = document.getElementById('optExtraP2');
    if (optP1) optP1.textContent = `${p1} (Shahid ke paas gye)`;
    if (optP2) optP2.textContent = `${p2} (Adnan ke paas gye)`;

    // Populate Customer Dropdown
    const custSelect = document.getElementById('extraIncomeCustomer');
    if (custSelect) {
      custSelect.innerHTML = `<option value="">— Aam / Bahar Ka Customer (Walk-in/General) —</option>` +
        this.data.users.map(u => `<option value="${u.id}">${u.name} (${u.id} - ${u.area})</option>`).join('');
      
      if (preSelectedCustomerId) {
        custSelect.value = preSelectedCustomerId;
      }
    }

    // Default Date to Today
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('extraIncomeDate');
    if (dateInput) dateInput.value = today;

    // Default Type to Charger
    const typeSelect = document.getElementById('extraIncomeType');
    if (typeSelect) typeSelect.value = 'Charger';

    // Default title suggestion
    const titleInput = document.getElementById('extraIncomeTitle');
    if (titleInput) titleInput.value = 'Router Charger Sale';

    if (typeSelect && titleInput) {
      typeSelect.onchange = () => {
        if (typeSelect.value === 'Charger') titleInput.value = 'Router Charger Sale';
        else if (typeSelect.value === 'Complaint') titleInput.value = 'Complaint Visit / Repair Fee';
        else if (typeSelect.value === 'Fiber/Wire') titleInput.value = 'Fiber Wire / Patch Cord';
        else if (typeSelect.value === 'New Router') titleInput.value = 'New Router Sale';
        else titleInput.value = 'Extra Service';
      };
    }

    modal.classList.add('active');
    setTimeout(() => {
      document.getElementById('extraIncomeAmount')?.focus();
    }, 150);
  }

  handleSaveExtraIncome() {
    const editId = document.getElementById('editExtraIncomeId')?.value;
    const type = document.getElementById('extraIncomeType').value;
    const amount = Number(document.getElementById('extraIncomeAmount').value) || 0;
    const collector = document.getElementById('extraIncomeCollector').value;
    const customerId = document.getElementById('extraIncomeCustomer').value;
    const title = document.getElementById('extraIncomeTitle').value.trim() || `${type} Collection`;
    const date = document.getElementById('extraIncomeDate').value || new Date().toISOString().split('T')[0];
    const notes = document.getElementById('extraIncomeNotes').value.trim();

    if (amount <= 0) {
      alert("Baraye meharbani sahi raqam darj karein.");
      return;
    }

    let customerName = "Aam Customer (Walk-in)";
    if (customerId) {
      const u = this.data.users.find(usr => usr.id === customerId);
      if (u) customerName = u.name;
    }

    if (!this.data.extraIncome) {
      this.data.extraIncome = {};
    }
    if (!this.data.extraIncome[this.currentMonth]) {
      this.data.extraIncome[this.currentMonth] = [];
    }

    const p1 = this.data.settings.partner1Name || "Shahid";
    const p2 = this.data.settings.partner2Name || "Adnan";
    const collectorName = collector === 'p1' ? p1 : p2;

    if (editId) {
      const existing = this.data.extraIncome[this.currentMonth].find(item => item.id === editId);
      if (existing) {
        existing.type = type;
        existing.amount = amount;
        existing.collector = collector;
        existing.customerId = customerId;
        existing.customerName = customerName;
        existing.title = title;
        existing.date = date;
        existing.notes = notes;
      }
      this.showToast(`Extra income update ho gayi!`, 'success');
    } else {
      const newId = `INC-${Date.now()}`;
      this.data.extraIncome[this.currentMonth].push({
        id: newId,
        type,
        title,
        amount,
        collector,
        customerId,
        customerName,
        date,
        notes
      });
      this.showToast(`Rs. ${amount} (${type}) wasool shuda (${collectorName}) ke khate me save ho gya!`, 'success');
    }

    this.saveData();
    this.closeModals();
    this.renderAll();
  }

  deleteExtraIncome(index) {
    if (confirm("Kya aap waqayi ye entry delete / undo karna chahte hain?")) {
      if (this.data.extraIncome && this.data.extraIncome[this.currentMonth]) {
        this.data.extraIncome[this.currentMonth].splice(index, 1);
        this.saveData();
        this.renderAll();
        this.showToast("Extra income entry delete ho gayi.", "danger");
      }
    }
  }

  renderDashboardExtraIncome() {
    const tbody = document.getElementById('dashExtraIncomeTableBody');
    const badge = document.getElementById('dashExtraIncomeTotalBadge');
    if (!tbody) return;

    const monthList = (this.data.extraIncome && this.data.extraIncome[this.currentMonth]) || [];
    const p1 = this.data.settings.partner1Name || "Shahid";
    const p2 = this.data.settings.partner2Name || "Adnan";

    let total = 0;
    monthList.forEach(item => total += Number(item.amount) || 0);
    if (badge) badge.textContent = `Total: ${this.formatMoney(total)}`;

    if (monthList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="padding: 24px; color: var(--text-dim);">Is mahine abhi tak koi charger ya complain fees darj nahi hui. Nayi wasooli add karne ke liye upar button dabayein.</td></tr>`;
      return;
    }

    tbody.innerHTML = monthList.map((item, idx) => {
      const collectorName = item.collector === 'p1' ? p1 : p2;
      const collectorClass = item.collector === 'p1' ? 'badge-collector-p1' : 'badge-collector-p2';

      let catBadge = `<span class="badge-cat-charger">🔌 Charger</span>`;
      if (item.type === 'Complaint') catBadge = `<span class="badge-cat-complaint">🛠️ Complain</span>`;
      else if (item.type === 'Fiber/Wire') catBadge = `<span class="badge-cat-fiber">🧵 Fiber/Wire</span>`;
      else if (item.type === 'New Router') catBadge = `<span class="badge-cat-charger">📡 Router Sale</span>`;
      else if (item.type === 'Other') catBadge = `<span class="badge" style="background:var(--bg-surface);">✨ Extra</span>`;

      return `
        <tr>
          <td>${catBadge}</td>
          <td>
            <strong>${item.title || item.type}</strong>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
              Customer: <strong>${item.customerName || 'Aam Customer'}</strong> ${item.customerId ? `(${item.customerId})` : ''}
              ${item.notes ? ` • Note: ${item.notes}` : ''}
            </div>
          </td>
          <td><strong class="text-warning" style="font-size:1rem; color:var(--accent-warning);">${this.formatMoney(item.amount)}</strong></td>
          <td><span class="${collectorClass}">${collectorName}</span></td>
          <td style="color:var(--text-dim); font-size:0.82rem;">${item.date || '-'}</td>
          <td class="text-right">
            <button class="btn btn-sm btn-outline text-danger" onclick="app.deleteExtraIncome(${idx})" title="Delete / Undo">
              🗑️
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  /* ===================================================================
     MODALS: USER MANAGEMENT & PAYMENT COLLECTION
     =================================================================== */
  openUserModal(userId = null) {
    const modal = document.getElementById('modalUser');
    const form = document.getElementById('formUser');
    form.reset();

    const titleEl = document.getElementById('userModalTitle');
    const editIdInput = document.getElementById('editUserId');
    const btnDeleteModal = document.getElementById('btnDeleteUserModal');

    if (userId) {
      const user = this.data.users.find(u => u.id === userId);
      if (!user) return;
      titleEl.textContent = `User Edit Karein: ${user.name}`;
      editIdInput.value = user.id;

      if (btnDeleteModal) {
        btnDeleteModal.style.display = 'inline-flex';
        btnDeleteModal.onclick = () => this.deleteUser(user.id);
      }

      document.getElementById('userName').value = user.name;
      document.getElementById('userPhone').value = user.phone;
      document.getElementById('userArea').value = user.area;
      document.getElementById('userPackage').value = user.package;
      document.getElementById('userMonthlyFee').value = user.monthlyFee;
      document.getElementById('userInitialArrears').value = user.initialArrears || 0;
      document.getElementById('userCnic').value = user.cnic || '';
      document.getElementById('userConnectionDate').value = user.connectionDate || '';
      document.getElementById('userInstallFee').value = user.installFee !== undefined ? user.installFee : 0;
      document.getElementById('userInstallStatus').value = user.installStatus || 'paid';
      document.getElementById('userInstallCollector').value = user.installCollector || 'p2';
      document.getElementById('userDefaultCollector').value = user.defaultCollector || 'p2';
      document.getElementById('userStatus').value = user.status || 'active';
      document.getElementById('userIpOrMac').value = user.ip || '';
    } else {
      titleEl.textContent = "Naya Customer Shamil Karein";
      editIdInput.value = "";
      if (btnDeleteModal) {
        btnDeleteModal.style.display = 'none';
      }
      document.getElementById('userInitialArrears').value = "0";
      document.getElementById('userMonthlyFee').value = "2000";
      document.getElementById('userCnic').value = "";
      document.getElementById('userConnectionDate').value = new Date().toISOString().split('T')[0];
      document.getElementById('userInstallFee').value = "5000";
      document.getElementById('userInstallStatus').value = "paid";
      document.getElementById('userInstallCollector').value = "p2";
    }

    modal.classList.add('active');
  }

  handleSaveUser() {
    const editId = document.getElementById('editUserId').value;
    const name = document.getElementById('userName').value.trim();
    const phone = document.getElementById('userPhone').value.trim();
    const area = document.getElementById('userArea').value.trim();
    const pkg = document.getElementById('userPackage').value;
    const monthlyFee = Number(document.getElementById('userMonthlyFee').value) || 0;
    const initialArrears = Number(document.getElementById('userInitialArrears').value) || 0;
    const cnic = document.getElementById('userCnic').value.trim();
    const connectionDate = document.getElementById('userConnectionDate').value;
    const installFee = Number(document.getElementById('userInstallFee').value) || 0;
    const installStatus = document.getElementById('userInstallStatus').value;
    const installCollector = document.getElementById('userInstallCollector').value;
    const defaultCollector = document.getElementById('userDefaultCollector').value;
    const status = document.getElementById('userStatus').value;
    const ip = document.getElementById('userIpOrMac').value.trim();

    if (editId) {
      const user = this.data.users.find(u => u.id === editId);
      if (user) {
        user.name = name;
        user.phone = phone;
        user.area = area;
        user.package = pkg;
        user.monthlyFee = monthlyFee;
        user.initialArrears = initialArrears;
        user.cnic = cnic;
        user.connectionDate = connectionDate;
        user.installFee = installFee;
        user.installStatus = installStatus;
        user.installCollector = installCollector;
        user.defaultCollector = defaultCollector;
        user.status = status;
        user.ip = ip;
      }
      this.showToast("User record update ho gya!");
    } else {
      const newId = `USR-${100 + this.data.users.length + 1}`;
      this.data.users.push({
        id: newId,
        name,
        phone,
        area,
        package: pkg,
        monthlyFee,
        initialArrears,
        cnic,
        connectionDate,
        installFee,
        installStatus,
        installCollector,
        installDate: connectionDate,
        defaultCollector,
        status,
        ip
      });
      this.showToast(`Naya user (${name}) add ho gya!`);
    }

    this.saveData();
    this.closeModals();
    this.renderAll();
  }

  deleteUser(userId) {
    const user = this.data.users.find(u => u.id === userId);
    if (!user) return;

    const confirmMsg = `Kya aap waqayi "${user.name}" (${user.id}) ko mukammal delete / remove karna chahte hain?\n\nKhabardar: Is user ka tamam mahana record aur bills delete ho jayenge!`;
    if (!confirm(confirmMsg)) {
      return;
    }

    const userName = user.name;

    // 1. Remove from users list
    this.data.users = this.data.users.filter(u => u.id !== userId);

    // 2. Remove bills across all months
    if (this.data.bills) {
      Object.keys(this.data.bills).forEach(m => {
        if (this.data.bills[m] && this.data.bills[m][userId]) {
          delete this.data.bills[m][userId];
        }
      });
    }

    // 3. Close modals if open for this user
    document.getElementById('modalUser')?.classList.remove('active');
    document.getElementById('modalUserProfile')?.classList.remove('active');
    document.getElementById('modalPayment')?.classList.remove('active');
    document.getElementById('modalCustomerHistory')?.classList.remove('active');

    // 4. Save to local storage and sync to Firebase Cloud
    this.saveData();
    this.renderAll();
    this.showToast(`User "${userName}" ko kamyabi se remove kar diya gya.`, 'danger');
  }

  openPaymentModal(userId, targetMonth = null) {
    const user = this.data.users.find(u => u.id === userId);
    if (!user) return;

    this.activePaymentUser = user;
    this.activePaymentMonth = targetMonth || this.currentMonth;
    const modal = document.getElementById('modalPayment');
    const sum = this.getUserMonthSummary(user.id, this.activePaymentMonth);

    const [year, month] = this.activePaymentMonth.split('-');
    const mName = this.monthNames[month] || month;

    document.getElementById('payUserId').value = user.id;
    const payTargetMonthInput = document.getElementById('payTargetMonth');
    if (payTargetMonthInput) payTargetMonthInput.value = this.activePaymentMonth;

    const payTargetMonthLabel = document.getElementById('payTargetMonthLabel');
    if (payTargetMonthLabel) payTargetMonthLabel.textContent = `${mName} ${year}`;

    document.getElementById('payModalUserTitle').textContent = `Bill Wasooli & Update: ${user.name}`;
    document.getElementById('payModalUserSub').textContent = `Mahina: ${mName} ${year} | Area: ${user.area} | Phone: ${user.phone}`;

    // Monthly Fee
    const feeInput = document.getElementById('payMonthlyFee');
    if (feeInput) feeInput.value = sum.monthlyFee;

    document.getElementById('paySummaryCurrentBill').textContent = this.formatMoney(sum.monthlyFee);
    document.getElementById('paySummaryArrears').textContent = this.formatMoney(sum.openingArrears);
    document.getElementById('paySummaryTotalDue').textContent = this.formatMoney(sum.totalDue);

    // Default amount to existing payment if recorded, or full due
    const inputAmount = document.getElementById('payAmount');
    inputAmount.value = sum.paid > 0 ? sum.paid : sum.totalDue;
    
    document.getElementById('payCollector').value = sum.collector || (user.defaultCollector || 'p2');
    document.getElementById('payMethod').value = sum.method || 'Cash';
    document.getElementById('payDate').value = sum.date || new Date().toISOString().split('T')[0];
    document.getElementById('payNotes').value = sum.notes || '';

    // Delete record button visibility
    const btnDelete = document.getElementById('btnDeleteMonthBill');
    if (btnDelete) {
      const hasRecord = this.data.bills[this.activePaymentMonth] && this.data.bills[this.activePaymentMonth][user.id];
      btnDelete.style.display = hasRecord ? 'inline-block' : 'none';
    }

    // Update Live Calculation
    this.updatePaymentLiveCalculation();

    modal.classList.add('active');
    setTimeout(() => {
      inputAmount.focus();
      inputAmount.select();
    }, 150);
  }

  setQuickPayAmount(amount) {
    const input = document.getElementById('payAmount');
    if (input) {
      input.value = amount;
      this.updatePaymentLiveCalculation();
    }
  }

  updatePaymentLiveCalculation() {
    if (!this.activePaymentUser) return;
    const m = this.activePaymentMonth || this.currentMonth;
    const sum = this.getUserMonthSummary(this.activePaymentUser.id, m);
    
    const feeInput = document.getElementById('payMonthlyFee');
    const fee = feeInput ? (Number(feeInput.value) || 0) : sum.monthlyFee;
    const totalDue = fee + sum.openingArrears;

    const currentBillEl = document.getElementById('paySummaryCurrentBill');
    if (currentBillEl) currentBillEl.textContent = this.formatMoney(fee);

    const totalDueEl = document.getElementById('paySummaryTotalDue');
    if (totalDueEl) totalDueEl.textContent = this.formatMoney(totalDue);

    const entered = Number(document.getElementById('payAmount').value) || 0;
    const remaining = totalDue - entered;

    const wasoolEl = document.getElementById('calcWasoolText');
    const remLabel = document.getElementById('calcRemainingLabel');
    const remEl = document.getElementById('calcRemainingText');

    if (wasoolEl) wasoolEl.textContent = this.formatMoney(entered);

    if (remaining > 0) {
      if (remLabel) remLabel.textContent = "Baqaya Reh Jayega:";
      if (remEl) {
        remEl.className = "text-danger";
        remEl.textContent = this.formatMoney(remaining);
      }
    } else if (remaining === 0) {
      if (remLabel) remLabel.textContent = "Status:";
      if (remEl) {
        remEl.className = "text-success";
        remEl.textContent = "Pura Bill Ada!";
      }
    } else {
      if (remLabel) remLabel.textContent = "Advance Jama:";
      if (remEl) {
        remEl.className = "text-blue";
        remEl.textContent = this.formatMoney(Math.abs(remaining));
      }
    }
  }

  handleSavePayment() {
    const userId = document.getElementById('payUserId').value;
    const targetMonth = document.getElementById('payTargetMonth')?.value || this.activePaymentMonth || this.currentMonth;
    const monthlyFeeInput = document.getElementById('payMonthlyFee');
    const monthlyFee = monthlyFeeInput ? Number(monthlyFeeInput.value) : undefined;
    const amount = Number(document.getElementById('payAmount').value) || 0;
    const collector = document.getElementById('payCollector').value;
    const method = document.getElementById('payMethod').value;
    const date = document.getElementById('payDate').value;
    const notes = document.getElementById('payNotes').value.trim();

    if (!this.data.bills[targetMonth]) {
      this.data.bills[targetMonth] = {};
    }

    this.data.bills[targetMonth][userId] = {
      monthlyFee: isNaN(monthlyFee) ? undefined : monthlyFee,
      paidAmount: amount,
      collector,
      method,
      date,
      notes
    };

    const collectorName = collector === 'p1' ? this.data.settings.partner1Name : this.data.settings.partner2Name;
    this.saveData();

    // Check if History modal was open
    const histModal = document.getElementById('modalCustomerHistory');
    const wasHistoryOpen = histModal && histModal.classList.contains('active');

    this.closePaymentModal();

    if (wasHistoryOpen && this.activeHistoryUserId) {
      this.openCustomerHistoryModal(this.activeHistoryUserId);
    } else {
      this.closeModals();
    }

    this.renderAll();

    const [yr, mo] = targetMonth.split('-');
    const mTitle = `${this.monthNames[mo] || mo} ${yr}`;
    this.showToast(`Rs. ${amount} (${mTitle}) wasool shuda (${collectorName}) ke khate me save ho gya!`);
  }

  handleDeleteMonthBill() {
    if (!this.activePaymentUser || !this.activePaymentMonth) return;
    const user = this.activePaymentUser;
    const [year, month] = this.activePaymentMonth.split('-');
    const mName = this.monthNames[month] || month;

    if (confirm(`Kya aap waqayi ${user.name} ka (${mName} ${year}) ka bill / payment record khatam (delete) karna chahte hain?`)) {
      if (this.data.bills[this.activePaymentMonth]) {
        delete this.data.bills[this.activePaymentMonth][user.id];
      }
      this.saveData();

      const histModal = document.getElementById('modalCustomerHistory');
      const wasHistoryOpen = histModal && histModal.classList.contains('active');

      this.closePaymentModal();

      if (wasHistoryOpen && this.activeHistoryUserId) {
        this.openCustomerHistoryModal(this.activeHistoryUserId);
      } else {
        this.closeModals();
      }

      this.renderAll();
      this.showToast(`${user.name} ka ${mName} ${year} ka bill record delete ho gya.`, 'danger');
    }
  }

  /* ===================================================================
     CUSTOMER MULTI-MONTH LEDGER / HISTORY MODAL
     =================================================================== */
  openCustomerHistoryModal(userId, selectedYear = null) {
    const user = this.data.users.find(u => u.id === userId);
    if (!user) return;

    this.activeHistoryUserId = user.id;

    const modal = document.getElementById('modalCustomerHistory');
    const title = document.getElementById('historyModalTitle');
    const sub = document.getElementById('historyModalSub');
    const tbody = document.getElementById('customerHistoryTableBody');

    title.textContent = `Mahana Khata: ${user.name} (${user.id})`;
    sub.textContent = `Package: ${user.package} | Mahana: Rs. ${user.monthlyFee} | Area: ${user.area}`;

    // Target year
    const [defYear, defMonth] = this.currentMonth.split('-');
    const targetYear = selectedYear || defYear;

    const yearSelect = document.getElementById('khataSelectYear');
    const monthSelect = document.getElementById('khataSelectMonth');
    if (yearSelect) yearSelect.value = targetYear;
    if (monthSelect) monthSelect.value = defMonth;

    // Show all 12 months for selected year + any recorded months in that year
    const yearMonths = Array.from({ length: 12 }, (_, i) => `${targetYear}-${String(i + 1).padStart(2, '0')}`);
    const recordedMonths = Object.keys(this.data.bills).filter(m => m.startsWith(`${targetYear}-`));
    const allMonthsSet = new Set([...yearMonths, ...recordedMonths]);
    const monthKeys = Array.from(allMonthsSet).sort();

    const p1 = this.data.settings.partner1Name || "Shahid";
    const p2 = this.data.settings.partner2Name || "Adnan";

    tbody.innerHTML = monthKeys.map(m => {
      const sum = this.getUserMonthSummary(user.id, m);
      const [yr, mo] = m.split('-');
      const monthTitle = `${this.monthNames[mo] || mo} ${yr}`;
      const isCurrent = m === this.currentMonth;

      let collectorBadge = "—";
      if (sum.collector === 'p1') collectorBadge = `<span class="badge-collector-p1">${p1}</span>`;
      if (sum.collector === 'p2') collectorBadge = `<span class="badge-collector-p2">${p2}</span>`;

      return `
        <tr style="${isCurrent ? 'background: rgba(59, 130, 246, 0.08); font-weight:600;' : ''}">
          <td>
            <strong>${monthTitle}</strong>
            ${isCurrent ? '<span class="badge" style="background:var(--accent-primary); margin-left:6px; font-size:0.68rem;">Current</span>' : ''}
          </td>
          <td>${this.formatMoney(sum.monthlyFee)}</td>
          <td>${sum.openingArrears > 0 ? `<span class="text-danger font-weight-bold">${this.formatMoney(sum.openingArrears)}</span>` : '0'}</td>
          <td><strong>${this.formatMoney(sum.totalDue)}</strong></td>
          <td class="text-success font-weight-bold">${sum.paid > 0 ? this.formatMoney(sum.paid) : '0'}</td>
          <td>${collectorBadge}</td>
          <td>
            ${sum.closingBalance > 0 ? `<strong class="text-danger">${this.formatMoney(sum.closingBalance)}</strong>` : '<span class="text-success">Clear</span>'}
          </td>
          <td class="text-right">
            <button class="btn btn-sm ${sum.paid > 0 ? 'btn-outline' : 'btn-collect'}" style="padding:5px 12px; font-size:0.75rem; font-weight:700;" onclick="app.openPaymentModal('${user.id}', '${m}')" title="${monthTitle} ka bill add ya update karein">
              ${sum.paid > 0 ? '✏️ Bill Update' : '➕ Bill Darj'}
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Connection History Timeline (Band / Chalu Record)
    const connListEl = document.getElementById('customerConnHistoryList');
    if (connListEl) {
      const history = user.statusHistory || [];
      if (history.length === 0) {
        connListEl.innerHTML = `<li style="color:var(--text-dim); font-size:0.82rem; padding:6px 0;">Abhi koi band ya chalu karne ka record nahi hai (Connection shuru se active hai).</li>`;
      } else {
        connListEl.innerHTML = history.map(item => `
          <li class="conn-history-item ${item.action === 'disabled' ? 'item-disabled' : 'item-enabled'}">
            <div>
              <strong>${item.action === 'disabled' ? '🔴 Band Kiya Gya (Disabled)' : '🟢 Wapas Chalu Kiya Gya (Enabled)'}</strong>
              <p style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">Waja / Note: ${item.reason || 'Koyi waja darj nahi ki'}</p>
            </div>
            <div style="font-size:0.82rem; font-weight:700; color:var(--text-main);">
              Tareekh: ${item.date}
            </div>
          </li>
        `).join('');
      }
    }

    modal.classList.add('active');
  }

  /* ===================================================================
     CUSTOMER PROFILE & COMPLETE DATA MODAL (CNIC, DATE, INSTALLATION)
     =================================================================== */
  openUserProfileModal(userId) {
    const user = this.data.users.find(u => u.id === userId);
    if (!user) return;

    const p1 = this.data.settings.partner1Name || "Shahid";
    const p2 = this.data.settings.partner2Name || "Adnan";

    // Set Avatar and Header Info
    const avatarEl = document.getElementById('profAvatar');
    if (avatarEl) avatarEl.textContent = user.name ? user.name.charAt(0).toUpperCase() : 'U';

    const nameEl = document.getElementById('profName');
    if (nameEl) nameEl.textContent = user.name;

    const idEl = document.getElementById('profId');
    if (idEl) idEl.textContent = user.id;

    const areaEl = document.getElementById('profArea');
    if (areaEl) areaEl.textContent = user.area || 'Unknown Area';

    // Status Badge
    const statusBadgeEl = document.getElementById('profStatusBadge');
    if (statusBadgeEl) {
      if (user.status === 'disabled') {
        statusBadgeEl.innerHTML = `<span style="color:#ef4444; font-weight:700;">🔴 Band (${user.disabledDate || 'Disabled'})</span>`;
      } else {
        statusBadgeEl.innerHTML = `<span style="color:#10b981; font-weight:700;">🟢 Chalu (Active)</span>`;
      }
    }

    // Contact & Identity
    const phoneEl = document.getElementById('profPhone');
    if (phoneEl) phoneEl.textContent = user.phone || 'N/A';

    const cnicEl = document.getElementById('profCnic');
    if (cnicEl) cnicEl.textContent = user.cnic || 'Nahi likha gya (Not set)';

    const connDateEl = document.getElementById('profConnDate');
    if (connDateEl) connDateEl.textContent = user.connectionDate ? user.connectionDate : 'Purana Connection';

    const pkgEl = document.getElementById('profPackage');
    if (pkgEl) pkgEl.textContent = `${user.package || 'Internet'} (${this.formatMoney(user.monthlyFee)}/Mahana)`;

    // Installation Fee Info
    const installFee = Number(user.installFee) || 0;
    const installStatus = user.installStatus || 'paid';
    const collectorName = user.installCollector === 'p1' ? p1 : p2;

    const installFeeEl = document.getElementById('profInstallFee');
    if (installFeeEl) installFeeEl.textContent = this.formatMoney(installFee);

    let statusText = 'Paid (Ada Shuda)';
    if (installStatus === 'unpaid') statusText = 'Unpaid (Baqaya Hai)';
    if (installStatus === 'free') statusText = 'Free / Maaf (Rs. 0)';

    const installStatusEl = document.getElementById('profInstallStatus');
    if (installStatusEl) {
      installStatusEl.textContent = `Status: ${statusText} • Wasool Karinda: ${collectorName}`;
    }

    // Technical Info
    const routerEl = document.getElementById('profRouter');
    if (routerEl) routerEl.textContent = user.ip || 'Nahi likha gya (Not set)';

    // Render Charger & Complaint fees for this user
    const userExtraListEl = document.getElementById('profExtraList');
    if (userExtraListEl) {
      let userExtras = [];
      Object.keys(this.data.extraIncome || {}).forEach(m => {
        (this.data.extraIncome[m] || []).forEach(inc => {
          if (inc.customerId === user.id) {
            userExtras.push({ ...inc, month: m });
          }
        });
      });

      if (userExtras.length === 0) {
        userExtraListEl.innerHTML = `<span style="color:var(--text-dim);">Is customer se abhi tak koi charger ya complain fees nahi li gayi.</span>`;
      } else {
        userExtraListEl.innerHTML = `
          <ul style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:6px;">
            ${userExtras.map(item => {
              const cName = item.collector === 'p1' ? p1 : p2;
              return `
                <li style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.25); padding:6px 10px; border-radius:6px; border:1px solid var(--border-subtle);">
                  <div>
                    <strong>${item.title || item.type}</strong>
                    <div style="font-size:0.75rem; color:var(--text-muted);">${item.date || item.month} • Wasool: <span style="color:var(--accent-cyan); font-weight:600;">${cName}</span> ${item.notes ? `(${item.notes})` : ''}</div>
                  </div>
                  <strong style="color:var(--accent-warning); font-size:0.95rem;">${this.formatMoney(item.amount)}</strong>
                </li>
              `;
            }).join('')}
          </ul>
        `;
      }
    }

    // Add Extra button inside profile
    const addExtraBtn = document.getElementById('profBtnAddExtra');
    if (addExtraBtn) {
      addExtraBtn.onclick = () => {
        this.closeModals();
        this.openExtraIncomeModal(user.id);
      };
    }

    // Edit button inside profile card
    const editBtn = document.getElementById('profBtnEdit');
    if (editBtn) {
      editBtn.onclick = () => {
        this.closeModals();
        this.openUserModal(user.id);
      };
    }

    document.getElementById('modalUserProfile')?.classList.add('active');
  }

  /* ===================================================================
     TOGGLE STATUS: DISABLE / ENABLE CUSTOMER CONNECTION
     =================================================================== */
  openToggleStatusModal(userId, targetAction) {
    const user = this.data.users.find(u => u.id === userId);
    if (!user) return;

    document.getElementById('toggleStatusUserId').value = user.id;
    document.getElementById('toggleStatusTargetAction').value = targetAction;

    const titleEl = document.getElementById('toggleStatusModalTitle');
    const subEl = document.getElementById('toggleStatusModalSub');
    const labelEl = document.getElementById('toggleStatusActionLabel');
    const iconEl = document.getElementById('previewActionIcon');
    const headlineEl = document.getElementById('previewActionHeadline');
    const banner = document.getElementById('statusActionPreviewBanner');
    const submitBtn = document.getElementById('btnSubmitToggleStatus');
    const submitBtnText = document.getElementById('btnSubmitToggleStatusText');

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('toggleStatusDate').value = today;
    document.getElementById('toggleStatusReason').value = '';

    if (targetAction === 'disable') {
      titleEl.textContent = `Connection Band Karein: ${user.name}`;
      subEl.textContent = `User ID: ${user.id} | Area: ${user.area} | Phone: ${user.phone}`;
      labelEl.textContent = "Band";
      iconEl.textContent = "🔴";
      headlineEl.textContent = `User (${user.name}) Ka Internet Band Kiya Ja Raha Hai`;
      banner.className = "status-action-preview-banner banner-disable";
      submitBtn.className = "btn btn-danger";
      submitBtnText.textContent = "🔴 Connection Band Karein";
    } else {
      titleEl.textContent = `Connection Chalu Karein: ${user.name}`;
      subEl.textContent = `User ID: ${user.id} | Area: ${user.area} | Phone: ${user.phone}`;
      labelEl.textContent = "Chalu";
      iconEl.textContent = "🟢";
      headlineEl.textContent = `User (${user.name}) Ka Internet Wapas Chalu Kiya Ja Raha Hai`;
      banner.className = "status-action-preview-banner banner-enable";
      submitBtn.className = "btn btn-success";
      submitBtnText.textContent = "🟢 Connection Chalu Karein";
    }

    document.getElementById('modalToggleStatus')?.classList.add('active');
  }

  handleConfirmToggleStatus() {
    const userId = document.getElementById('toggleStatusUserId').value;
    const targetAction = document.getElementById('toggleStatusTargetAction').value; // 'enable' or 'disable'
    const date = document.getElementById('toggleStatusDate').value;
    const reason = document.getElementById('toggleStatusReason').value.trim();

    const user = this.data.users.find(u => u.id === userId);
    if (!user) return;

    if (!user.statusHistory) user.statusHistory = [];

    if (targetAction === 'disable') {
      user.status = 'disabled';
      user.disabledDate = date;
      user.disabledReason = reason;
      user.statusHistory.unshift({
        action: 'disabled',
        date: date,
        reason: reason || 'Koyi waja darj nahi ki'
      });
      this.showToast(`User (${user.name}) band kar diya gaya (Tareekh: ${date})`, 'danger');
    } else {
      user.status = 'active';
      user.enabledDate = date;
      user.enabledReason = reason;
      user.statusHistory.unshift({
        action: 'enabled',
        date: date,
        reason: reason || 'Connection wapas chalu'
      });
      this.showToast(`User (${user.name}) wapas chalu ho gya (Tareekh: ${date})`, 'success');
    }

    this.saveData();
    this.closeModals();
    this.renderAll();
  }

  /* ===================================================================
     PARTNER SETTLEMENT TRANSFERS (CLEARING HISAB TO ZERO)
     =================================================================== */
  openSettlementModal() {
    const f = this.calculateFinancials();
    const p1 = this.data.settings.partner1Name || "Shahid";
    const p2 = this.data.settings.partner2Name || "Adnan";

    const payerKey = f.payerKey || 'p1';
    const receiverKey = f.receiverKey || 'p2';

    document.getElementById('settlePayerKey').value = payerKey;
    document.getElementById('settleReceiverKey').value = receiverKey;

    const optP1P2 = document.getElementById('optDirP1ToP2');
    const optP2P1 = document.getElementById('optDirP2ToP1');
    if (optP1P2) optP1P2.textContent = `${p1} ne ${p2} ko diye (${p1} ➔ ${p2})`;
    if (optP2P1) optP2P1.textContent = `${p2} ne ${p1} ko diye (${p2} ➔ ${p1})`;

    const dirSelect = document.getElementById('settleDirectionSelect');
    if (dirSelect) {
      dirSelect.value = payerKey === 'p1' ? 'p1_to_p2' : 'p2_to_p1';
      dirSelect.onchange = () => {
        const val = dirSelect.value;
        if (val === 'p1_to_p2') {
          document.getElementById('settlePayerKey').value = 'p1';
          document.getElementById('settleReceiverKey').value = 'p2';
        } else {
          document.getElementById('settlePayerKey').value = 'p2';
          document.getElementById('settleReceiverKey').value = 'p1';
        }
        this.updateSettlementLiveCalculation();
      };
    }

    document.getElementById('settleSuggestedTotal').textContent = this.formatMoney(f.totalDueToClear);
    document.getElementById('settleAlreadyPaid').textContent = this.formatMoney(f.alreadyTransferred);
    document.getElementById('settleRemainingDue').textContent = this.formatMoney(f.netRemaining > 0 ? f.netRemaining : 0);

    // Default amount to remaining amount due or suggested total
    const defaultAmt = f.netRemaining > 0 ? f.netRemaining : f.totalDueToClear;
    const amountInput = document.getElementById('settleAmount');
    if (amountInput) {
      amountInput.value = defaultAmt > 0 ? defaultAmt : 0;
      amountInput.oninput = () => this.updateSettlementLiveCalculation();
    }
    document.getElementById('settleDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('settleNotes').value = '';

    this.updateSettlementLiveCalculation();
    document.getElementById('modalSettlement')?.classList.add('active');
  }

  updateSettlementLiveCalculation() {
    const f = this.calculateFinancials();
    const p1 = this.data.settings.partner1Name || "Shahid";
    const p2 = this.data.settings.partner2Name || "Adnan";

    const dirVal = document.getElementById('settleDirectionSelect')?.value || 'p1_to_p2';
    const payerName = dirVal === 'p1_to_p2' ? p1 : p2;
    const receiverName = dirVal === 'p1_to_p2' ? p2 : p1;

    const entered = Number(document.getElementById('settleAmount')?.value) || 0;
    const currentRemaining = f.netRemaining > 0 ? f.netRemaining : 0;
    const newRemaining = currentRemaining - entered;

    const previewEl = document.getElementById('settlePreviewBaqayaText');
    if (previewEl) {
      if (newRemaining <= 0) {
        previewEl.innerHTML = `💡 <strong>Nateeja:</strong> ${payerName} ke ${this.formatMoney(entered)} ada karne ke baad, ${payerName} ka ${receiverName} ko baqaya = <strong class="text-success font-weight-bold" style="font-size:1rem;">Rs. 0 (Mubarak ho! Cash in Hand = 0 / Pura Hisab Clear!)</strong>`;
      } else {
        previewEl.innerHTML = `💡 <strong>Nateeja:</strong> ${payerName} ke ${this.formatMoney(entered)} ada karne ke baad baqaya reh jayega = <strong class="text-danger font-weight-bold">${this.formatMoney(newRemaining)}</strong>`;
      }
    }
  }

  handleSaveSettlement() {
    const dirVal = document.getElementById('settleDirectionSelect')?.value || 'p1_to_p2';
    const payer = dirVal === 'p1_to_p2' ? 'p1' : 'p2';
    const receiver = dirVal === 'p1_to_p2' ? 'p2' : 'p1';
    const amount = Number(document.getElementById('settleAmount').value) || 0;
    const method = document.getElementById('settleMethod').value;
    const date = document.getElementById('settleDate').value || new Date().toISOString().split('T')[0];
    const notes = document.getElementById('settleNotes').value.trim();

    if (amount <= 0) {
      alert("Baraye meharbani sahi raqam likhein.");
      return;
    }

    if (!this.data.settlements[this.currentMonth]) {
      this.data.settlements[this.currentMonth] = [];
    }

    this.data.settlements[this.currentMonth].push({
      id: `SETTLE-${Date.now()}`,
      payer,
      receiver,
      amount,
      method,
      date,
      notes
    });

    const p1 = this.data.settings.partner1Name || "Shahid";
    const p2 = this.data.settings.partner2Name || "Adnan";
    const payerName = payer === 'p1' ? p1 : p2;
    const receiverName = receiver === 'p1' ? p1 : p2;

    this.saveData();
    this.closeModals();
    this.renderAll();
    this.showToast(`Mubarak ho! ${payerName} ne ${receiverName} ko Rs. ${amount} ada kar diye. Ab ${payerName} ke hath me baqaya Rs. 0 (Clear) ho gya!`, 'success');
  }

  deleteSettlement(index) {
    if (confirm("Kya aap waqayi ye settlement transfer delete / undo karna chahte hain?")) {
      if (this.data.settlements && this.data.settlements[this.currentMonth]) {
        this.data.settlements[this.currentMonth].splice(index, 1);
        this.saveData();
        this.renderAll();
        this.showToast("Settlement payment delete ho gayi.", "danger");
      }
    }
  }

  /* ===================================================================
     SETTINGS & CONFIG
     =================================================================== */
  populateSettingsForm() {
    document.getElementById('cfgPartner1Name').value = this.data.settings.partner1Name || "Shahid";
    document.getElementById('cfgPartner2Name').value = this.data.settings.partner2Name || "Adnan";
    document.getElementById('cfgPartnerRatio').value = this.data.settings.splitRatio || "50-50";
    document.getElementById('cfgCurrency').value = this.data.settings.currency || "Rs.";
  }

  handleSaveSettings() {
    this.data.settings.partner1Name = document.getElementById('cfgPartner1Name').value.trim() || "Shahid";
    this.data.settings.partner2Name = document.getElementById('cfgPartner2Name').value.trim() || "Adnan";
    this.data.settings.splitRatio = document.getElementById('cfgPartnerRatio').value;
    this.data.settings.currency = document.getElementById('cfgCurrency').value.trim() || "Rs.";

    this.saveData();
    this.renderAll();
    this.showToast("Settings kamyabi se save ho gayin!");
  }

  /* ===================================================================
     WHATSAPP INTEGRATION & CSV EXPORT
     =================================================================== */
  getWhatsAppReminderLink(user, monthlyFee, arrears, totalDue) {
    let cleanPhone = (user.phone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '92' + cleanPhone.substring(1);

    const p1 = this.data.settings.partner1Name;
    const p2 = this.data.settings.partner2Name;
    const [yr, mo] = this.currentMonth.split('-');
    const mName = this.monthNames[mo] || mo;

    const msg = `السلام علیکم ${user.name} صاحب!\n\n` +
      `آپ کے انٹرنیٹ کنکشن کا ماہانہ بل برائے (${mName} ${yr}):\n` +
      `• کرنٹ بل: Rs. ${monthlyFee}\n` +
      (arrears > 0 ? `• پچھلا بقایا: Rs. ${arrears}\n` : '') +
      `• کل واجب الادا: Rs. ${totalDue}\n\n` +
      `برائے مہربانی اپنا بل جلد از جلد ادا فرمائیں تاکہ سروس میں خلل نہ آئے۔ شکریہ!\n\n` +
      `منجانب: ${p1} & ${p2} انٹرنیٹ نیٹ ورک`;

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
  }

  getWhatsAppReceiptLink(user, paidAmount, collectorName) {
    let cleanPhone = (user.phone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '92' + cleanPhone.substring(1);
    const [yr, mo] = this.currentMonth.split('-');
    const mName = this.monthNames[mo] || mo;

    const msg = `السلام علیکم ${user.name} صاحب!\n\n` +
      `آپ کے انٹرنیٹ کنکشن کا بل بمبلغ Rs. ${paidAmount} موصول ہو چکا ہے۔\n` +
      `وصول کنندہ: ${collectorName}\n` +
      `مہینہ: ${mName} ${yr}\n\n` +
      `بروقت ادائیگی کا بہت شکریہ!\n` +
      `منجانب: نیٹ ورک ایڈمن`;

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
  }

  sendWhatsAppMessage(userId) {
    if (!this._userMap) this._userMap = new Map(this.data.users.map(u => [u.id, u]));
    const user = this._userMap.get(userId);
    if (!user) return;
    const sum = this.getUserMonthSummary(user.id, this.currentMonth);
    const p1 = this.data.settings.partner1Name || "Shahid";
    const p2 = this.data.settings.partner2Name || "Adnan";
    const link = (sum.status === 'paid')
      ? this.getWhatsAppReceiptLink(user, sum.paid, sum.collector === 'p1' ? p1 : p2)
      : this.getWhatsAppReminderLink(user, sum.monthlyFee, sum.openingArrears, sum.closingBalance);
    window.open(link, '_blank');
  }

  exportUsersToCsv() {
    const p1 = this.data.settings.partner1Name;
    const p2 = this.data.settings.partner2Name;

    let csv = "User ID,Customer Name,Phone,Area,Package,Monthly Fee,Opening Arrears,Total Due,Paid Amount,Closing Balance,Status,Collector,Payment Date\n";

    this.data.users.forEach(u => {
      const sum = this.getUserMonthSummary(u.id, this.currentMonth);
      let colName = sum.collector === 'p1' ? p1 : (sum.collector === 'p2' ? p2 : "Unassigned");

      csv += `"${u.id}","${u.name}","${u.phone}","${u.area}","${u.package}",${sum.monthlyFee},${sum.openingArrears},${sum.totalDue},${sum.paid},${sum.closingBalance},"${sum.status}","${colName}","${sum.date}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `NetHisab_Users_${this.currentMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  downloadBackupJson() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.data, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `NetHisab_Backup_${this.currentMonth}_${Date.now()}.json`);
    dlAnchorElem.click();
  }

  /* ===================================================================
     REAL-TIME CLOUD SYNC & PWA ENGINE (FIREBASE REALTIME DB)
     =================================================================== */
  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then(reg => console.log('NetHisab PWA Service Worker Registered:', reg.scope))
          .catch(err => console.log('SW Note:', err));
      });
    }
  }

  loadCloudConfig() {
    const saved = localStorage.getItem(this.cloudKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    // Default pre-configured cloud database for Shahid & Adnan
    return {
      databaseURL: "https://net-hisab-7fe4a-default-rtdb.firebaseio.com",
      projectId: "net-hisab-7fe4a"
    };
  }

  initCloudSync() {
    this.cloudConfig = this.loadCloudConfig();
    this.populateCloudSyncForm();

    if (this.cloudConfig && this.cloudConfig.databaseURL) {
      this.connectFirebase(this.cloudConfig);
    } else {
      this.updateCloudStatusUI('offline', 'Local Mode (Offline)');
    }
  }

  connectFirebase(config) {
    if (typeof firebase === 'undefined') {
      console.warn('Firebase SDK not loaded.');
      this.updateCloudStatusUI('offline', 'Local Mode (Offline)');
      return;
    }

    try {
      let appInstance;
      const existingApps = firebase.apps.map(a => a.name);
      const cleanDbUrl = (config.databaseURL || '').trim().replace(/\/$/, '');

      if (!existingApps.includes('nethisab_sync_app')) {
        const fbConfig = {
          databaseURL: cleanDbUrl
        };
        if (config.apiKey) fbConfig.apiKey = config.apiKey.trim();
        if (config.projectId) fbConfig.projectId = config.projectId.trim();

        appInstance = firebase.initializeApp(fbConfig, 'nethisab_sync_app');
      } else {
        appInstance = firebase.app('nethisab_sync_app');
      }

      this.firebaseDb = appInstance.database();
      this.isCloudSyncActive = true;

      // Online / Offline connection listener
      this.firebaseDb.ref('.info/connected').on('value', (snap) => {
        if (snap.val() === true) {
          this.updateCloudStatusUI('connected', 'Live Cloud Sync 🟢');
        } else {
          this.updateCloudStatusUI('offline', 'Offline (Local Mode) 🟡');
        }
      });

      // Realtime listener for data changes across mobile devices
      const dataRef = this.firebaseDb.ref('nethisab_shared_data');
      dataRef.on('value', (snapshot) => {
        const remoteData = snapshot.val();
        if (remoteData && remoteData.users) {
          this.handleRemoteDataUpdate(remoteData);
        }
      }, (err) => {
        console.error('Firebase DB read error:', err);
        this.updateCloudStatusUI('offline', 'Rules / Permission Error ⚠️');
        this.showToast('Firebase Rules Error! Console me Realtime DB rules: "read, write: true" karein.', 'danger');
      });

      this.updateCloudStatusUI('connected', 'Live Cloud Sync 🟢');
    } catch (err) {
      console.error('Failed to init Firebase:', err);
      this.updateCloudStatusUI('offline', 'Connection Error');
    }
  }

  debouncePushToCloud() {
    clearTimeout(this.syncDebounceTimer);
    this.updateCloudStatusUI('syncing', 'Syncing... ☁️');

    this.syncDebounceTimer = setTimeout(() => {
      if (!this.firebaseDb) return;
      const timestamp = Date.now();
      this.lastLocalSaveTimestamp = timestamp;

      const payload = JSON.parse(JSON.stringify(this.data));
      payload._lastSyncTime = timestamp;
      payload._lastUpdatedBy = this.data.settings?.partner1Name || 'Partner';

      this.firebaseDb.ref('nethisab_shared_data').set(payload)
        .then(() => {
          this.updateCloudStatusUI('connected', 'Live Cloud Sync 🟢');
          this.updateLastSyncTimeDisplay(timestamp);
        })
        .catch((err) => {
          console.error('Cloud push failed:', err);
          this.updateCloudStatusUI('connected', 'Cloud Connected (Retry on save)');
        });
    }, 400);
  }

  handleRemoteDataUpdate(remoteData) {
    if (!remoteData || !remoteData.users) return;

    // Reject old dummy demo data (less than 50 users or containing Chaudhry Farooq)
    const isOldDummy = remoteData.users.some(u => u.name === 'Chaudhry Farooq') || remoteData.users.length < 50;
    const localHasRealUsers = this.data && this.data.users && this.data.users.length >= 50 && !this.data.users.some(u => u.name === 'Chaudhry Farooq');

    if (isOldDummy) {
      console.warn("Ignoring cloud update because Firebase contains old dummy users!");
      // Overwrite Firebase only once to prevent infinite loop
      if (!this._isFixingDummyData) {
        this._isFixingDummyData = true;
        if (localHasRealUsers) {
          this.forcePushToCloud(true);
        } else {
          this.loadSampleData();
          this.forcePushToCloud(true);
        }
        setTimeout(() => { this._isFixingDummyData = false; }, 5000);
      }
      return;
    }

    // Skip if this update was pushed by this exact client instance
    if (remoteData._lastSyncTime && remoteData._lastSyncTime === this.lastLocalSaveTimestamp) {
      return;
    }

    this.isReceivingRemoteUpdate = true;
    const syncTime = remoteData._lastSyncTime || Date.now();
    const updatedBy = remoteData._lastUpdatedBy || 'Partner';

    // Clone data and strip metadata
    const cleanData = JSON.parse(JSON.stringify(remoteData));
    delete cleanData._lastSyncTime;
    delete cleanData._lastUpdatedBy;

    this.data = cleanData;
    this.saveData(true); // Save to local storage without re-triggering cloud push
    this.renderAll();

    this.updateLastSyncTimeDisplay(syncTime);
    this.showToast(`☁️ Cloud Sync: ${updatedBy} ne data update kiya (Real-time Synced!)`, 'success');

    setTimeout(() => {
      this.isReceivingRemoteUpdate = false;
    }, 400);
  }

  updateCloudStatusUI(status, labelText) {
    const pill = document.getElementById('btnCloudStatusPill');
    const pillText = document.getElementById('cloudStatusText');
    const sidebarDot = document.getElementById('sidebarSyncDot');
    const sidebarLabel = document.getElementById('sidebarSyncLabel');
    const badge = document.getElementById('cloudStatusBadgeDisplay');
    const badgeText = document.getElementById('cloudBadgeText');
    const bannerIcon = document.getElementById('cloudBannerIcon');
    const bannerTitle = document.getElementById('cloudBannerTitle');

    if (pill) {
      pill.className = `cloud-sync-pill ${status}`;
    }
    if (pillText) {
      pillText.textContent = labelText;
    }
    if (sidebarDot && sidebarLabel) {
      sidebarDot.style.background = status === 'connected' ? 'var(--accent-success)' : (status === 'syncing' ? 'var(--accent-primary)' : 'var(--accent-warning)');
      sidebarLabel.textContent = status === 'connected' ? 'Cloud Synced (Live)' : (status === 'syncing' ? 'Syncing...' : 'Local Mode');
    }
    if (badge && badgeText) {
      badge.className = `cloud-status-badge ${status}`;
      badgeText.textContent = status === 'connected' ? 'Live Cloud Connected 🟢' : (status === 'syncing' ? 'Syncing to Cloud... ☁️' : 'Local Storage Mode (Offline)');
    }
    if (bannerIcon && bannerTitle) {
      if (status === 'connected') {
        bannerIcon.textContent = '🟢';
        bannerTitle.textContent = 'Shahid & Adnan Dono Ke Mobile Par Real-Time Sync Chalu Hai!';
      } else if (status === 'syncing') {
        bannerIcon.textContent = '☁️';
        bannerTitle.textContent = 'Data Cloud Par Bheja Ja Raha Hai...';
      } else {
        bannerIcon.textContent = '📱';
        bannerTitle.textContent = 'Local Storage Mode (Abhi Sirf Is Device Par Save Hai)';
      }
    }
  }

  updateLastSyncTimeDisplay(timestamp) {
    const el = document.getElementById('cloudLastSyncTime');
    if (el) {
      const timeStr = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      el.textContent = `Last Synced: Aaj ${timeStr}`;
    }
  }

  handleSaveCloudConfig() {
    let dbUrl = document.getElementById('cfgFirebaseDbUrl')?.value.trim() || '';
    let projId = document.getElementById('cfgFirebaseProjectId')?.value.trim() || '';
    let apiKey = document.getElementById('cfgFirebaseApiKey')?.value.trim() || '';

    // Smart JSON parser in case user pasted the whole firebase config object
    if (dbUrl.startsWith('{') && dbUrl.endsWith('}')) {
      try {
        const parsed = JSON.parse(dbUrl);
        if (parsed.databaseURL) dbUrl = parsed.databaseURL;
        if (parsed.projectId) projId = parsed.projectId;
        if (parsed.apiKey) apiKey = parsed.apiKey;
      } catch (e) {
        console.warn('Config JSON parse exception:', e);
      }
    }

    if (!dbUrl) {
      alert("Barah-e-karam Firebase Realtime Database URL darj karein!\n(Jaise: https://apna-project-default-rtdb.firebaseio.com)");
      return;
    }

    const config = { databaseURL: dbUrl, projectId: projId, apiKey: apiKey };
    localStorage.setItem(this.cloudKey, JSON.stringify(config));
    this.cloudConfig = config;
    this.connectFirebase(config);
    this.showToast("Cloud config save ho gayi! Connection joda ja raha hai...");
  }

  forcePushToCloud(silent = false) {
    if (!this.firebaseDb) {
      if (!silent) alert("Pehle Firebase Database URL daal kar 'Cloud Connect' karein!");
      return;
    }

    const doPush = () => {
      const payload = JSON.parse(JSON.stringify(this.data));
      const timestamp = Date.now();
      this.lastLocalSaveTimestamp = timestamp;
      payload._lastSyncTime = timestamp;
      payload._lastUpdatedBy = this.data.settings?.partner1Name || 'RegisterSync';

      this.firebaseDb.ref('nethisab_shared_data').set(payload)
        .then(() => {
          this.showToast("Tamam 245 صارفین aur bills Cloud (Firebase) par save ho gaye!", "success");
          this.updateLastSyncTimeDisplay(timestamp);
        })
        .catch((err) => {
          console.error("Cloud push failed:", err);
          if (!silent) alert("Upload me masla hua: " + err.message);
        });
    };

    if (silent) {
      doPush();
    } else {
      if (confirm("Kya aap waqayi is device ka tamam data Cloud par upload karna chahte hain?")) {
        doPush();
      }
    }
  }

  forcePullFromCloud() {
    if (!this.firebaseDb) {
      alert("Pehle Firebase Database URL daal kar 'Cloud Connect' karein!");
      return;
    }
    if (confirm("Kya aap Cloud se taza data is device par download karna chahte hain? (Local data replace ho jayega)")) {
      this.firebaseDb.ref('nethisab_shared_data').once('value')
        .then((snap) => {
          const val = snap.val();
          if (val && val.users) {
            this.handleRemoteDataUpdate(val);
            this.showToast("Cloud se taza data download ho gaya!");
          } else {
            alert("Cloud database me abhi koi data nahi mila. Pehle 'Upload Local Data' karein.");
          }
        })
        .catch((err) => {
          alert("Data download me masla hua: " + err.message);
        });
    }
  }

  disconnectCloud() {
    if (confirm("Kya aap Cloud Sync disconnect karna chahte hain?")) {
      localStorage.removeItem(this.cloudKey);
      this.cloudConfig = null;
      this.isCloudSyncActive = false;
      if (this.firebaseDb) {
        this.firebaseDb.ref('nethisab_shared_data').off();
        this.firebaseDb = null;
      }
      this.populateCloudSyncForm();
      this.updateCloudStatusUI('offline', 'Local Mode (Offline)');
      this.showToast("Cloud Sync disconnect ho gaya.", "danger");
    }
  }

  populateCloudSyncForm() {
    if (this.cloudConfig) {
      if (document.getElementById('cfgFirebaseDbUrl')) document.getElementById('cfgFirebaseDbUrl').value = this.cloudConfig.databaseURL || '';
      if (document.getElementById('cfgFirebaseProjectId')) document.getElementById('cfgFirebaseProjectId').value = this.cloudConfig.projectId || '';
      if (document.getElementById('cfgFirebaseApiKey')) document.getElementById('cfgFirebaseApiKey').value = this.cloudConfig.apiKey || '';
    } else {
      if (document.getElementById('cfgFirebaseDbUrl')) document.getElementById('cfgFirebaseDbUrl').value = '';
      if (document.getElementById('cfgFirebaseProjectId')) document.getElementById('cfgFirebaseProjectId').value = '';
      if (document.getElementById('cfgFirebaseApiKey')) document.getElementById('cfgFirebaseApiKey').value = '';
    }
  }
}

// Global App Instance
document.addEventListener('DOMContentLoaded', () => {
  window.app = new NetHisabApp();
});
