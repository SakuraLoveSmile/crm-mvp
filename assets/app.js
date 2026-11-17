(function () {
  'use strict';

  /* ==================================================================
   * CRM MVP —— 单页应用，零依赖，数据存 localStorage
   * 数据模型对应《建设方案》主链路：客户 → 商机 → 合同 → 回款计划 → 回款记录
   * ================================================================== */

  var KEY = 'crm-mvp-v1';

  /* ---------------- 基础工具 ---------------- */
  function $(s) { return document.querySelector(s); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function parseISO(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function daysBetween(a, b) { return Math.round((b.getTime() - a.getTime()) / 86400000); }
  var escMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return escMap[c]; }); }
  function money(n) {
    n = Number(n) || 0;
    var sign = n < 0 ? '-' : '';
    var a = Math.abs(n);
    if (a >= 10000) {
      if (a % 10000 === 0) return sign + '¥' + (a / 10000) + ' 万';
      return sign + '¥' + (a / 10000).toFixed(1) + ' 万';
    }
    return sign + '¥' + a.toLocaleString('zh-CN');
  }
  function pct(v) { return Math.round(v * 100) + '%'; }
  function firstDayOfMonth() { var d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; }

  /* ---------------- 常量 ---------------- */
  var STAGES = ['初步接触', '需求确认', '方案报价', '商务谈判', '赢单', '输单'];
  var RATE = { '初步接触': 0.1, '需求确认': 0.3, '方案报价': 0.5, '商务谈判': 0.7, '赢单': 1, '输单': 0 };
  var OPEN_STAGES = ['初步接触', '需求确认', '方案报价', '商务谈判'];
  var INDUSTRIES = ['制造业', '互联网与软件', '金融', '医疗健康', '教育', '政府与公共事业', '能源', '零售消费', '其他'];
  var REGIONS = ['华东', '华南', '华北', '华中', '西南', '西北', '东北', '海外'];
  var LEVELS = ['A', 'B', 'C', 'D'];
  var SOURCES = ['官网表单', '展会活动', '老客户转介绍', '电话拓客', '渠道伙伴', '广告投放', '其他'];
  var OWNERS = ['张伟', '李娜', '王强'];
  var PAY_METHODS = ['银行转账', '银行承兑', '商业承兑', '现金', '在线支付'];

  var ROLES = {
    admin: {
      key: 'admin', label: '管理员 · 王敏', user: '王敏', scope: 'all', hideCost: false, readonly: false,
      note: '全部数据可读写，可查看合同成本与毛利率。'
    },
    sales: {
      key: 'sales', label: '销售 · 张伟', user: '张伟', scope: 'own', hideCost: true, readonly: false,
      note: '仅可见本人负责的客户、商机与合同；成本、毛利字段被隐藏；回款数据只读。'
    },
    finance: {
      key: 'finance', label: '财务 · 李静', user: '李静', scope: 'all', hideCost: false, readonly: false,
      note: '合同与回款全部可编辑；商机只读；可查看成本与毛利率。'
    },
    viewer: {
      key: 'viewer', label: '只读 · 访客', user: '访客', scope: 'all', hideCost: true, readonly: true,
      note: '全部数据只读，成本与毛利字段隐藏，用于对外演示。'
    }
  };

  /* ---------------- 演示数据 ---------------- */
  function seed() {
    var t = today();
    function D(n) { return iso(addDays(t, n)); }

    var customers = [
      { id: 'c1', code: 'KH-2026-0001', name: '华兴精密制造股份有限公司', short: '华兴', industry: '制造业', region: '华东', level: 'A', source: '老客户转介绍', owner: '张伟', phone: '138****2011', status: '已成交', createdAt: D(-430) },
      { id: 'c2', code: 'KH-2026-0002', name: '云图数据科技有限公司', short: '云图', industry: '互联网与软件', region: '华南', level: 'B', source: '官网表单', owner: '张伟', phone: '139****8821', status: '已成交', createdAt: D(-120) },
      { id: 'c3', code: 'KH-2026-0003', name: '恒瑞医疗器械集团', short: '恒瑞', industry: '医疗健康', region: '华北', level: 'A', source: '展会活动', owner: '李娜', phone: '137****6602', status: '已成交', createdAt: D(-380) },
      { id: 'c4', code: 'KH-2026-0004', name: '北辰教育集团', short: '北辰', industry: '教育', region: '华北', level: 'C', source: '电话拓客', owner: '李娜', phone: '136****3355', status: '跟进中', createdAt: D(-95) },
      { id: 'c5', code: 'KH-2026-0005', name: '中远智慧物流有限公司', short: '中远', industry: '其他', region: '华东', level: 'B', source: '渠道伙伴', owner: '张伟', phone: '135****9087', status: '已成交', createdAt: D(-300) },
      { id: 'c6', code: 'KH-2026-0006', name: '星辰零售连锁', short: '星辰', industry: '零售消费', region: '西南', level: 'B', source: '广告投放', owner: '王强', phone: '133****4412', status: '已成交', createdAt: D(-70) },
      { id: 'c7', code: 'KH-2026-0007', name: '拓维新能源集团', short: '拓维', industry: '能源', region: '西北', level: 'A', source: '展会活动', owner: '王强', phone: '132****7788', status: '已成交', createdAt: D(-140) },
      { id: 'c8', code: 'KH-2026-0008', name: '明德管理咨询', short: '明德', industry: '其他', region: '华中', level: 'D', source: '官网表单', owner: '李娜', phone: '131****2266', status: '跟进中', createdAt: D(-40) },
      { id: 'c9', code: 'KH-2026-0009', name: '蓝海融资租赁', short: '蓝海', industry: '金融', region: '华东', level: 'A', source: '老客户转介绍', owner: '王强', phone: '130****1199', status: '已成交', createdAt: D(-260) },
      { id: 'c10', code: 'KH-2026-0010', name: '千寻文化传媒', short: '千寻', industry: '零售消费', region: '华南', level: 'C', source: '官网表单', owner: '张伟', phone: '188****5533', status: '潜在', createdAt: D(-12) }
    ];

    var deals = [
      { id: 'd1', code: 'SJ-2026-0101', name: '华兴-ERP实施-2026', customerId: 'c1', stage: '赢单', amount: 480000, expected: D(-250), product: 'ERP 实施', owner: '张伟', stageSince: D(-250) },
      { id: 'd2', code: 'SJ-2026-0102', name: '云图-数据平台SaaS-2026', customerId: 'c2', stage: '赢单', amount: 168000, expected: D(-90), product: 'SaaS 订阅', owner: '张伟', stageSince: D(-90) },
      { id: 'd3', code: 'SJ-2026-0103', name: '恒瑞-定制开发-2026', customerId: 'c3', stage: '赢单', amount: 320000, expected: D(-120), product: '定制开发', owner: '李娜', stageSince: D(-120) },
      { id: 'd4', code: 'SJ-2026-0104', name: '中远-运维服务-2026', customerId: 'c5', stage: '赢单', amount: 96000, expected: D(-210), product: '运维服务', owner: '张伟', stageSince: D(-210) },
      { id: 'd5', code: 'SJ-2026-0105', name: '星辰-门店数字化-2026', customerId: 'c6', stage: '赢单', amount: 240000, expected: D(-30), product: '定制开发', owner: '王强', stageSince: D(-30) },
      { id: 'd6', code: 'SJ-2026-0106', name: '拓维-能源管理平台-2026', customerId: 'c7', stage: '赢单', amount: 560000, expected: D(-70), product: 'ERP 实施', owner: '王强', stageSince: D(-70) },
      { id: 'd7', code: 'SJ-2026-0107', name: '蓝海-风控咨询-2026', customerId: 'c9', stage: '赢单', amount: 180000, expected: D(-200), product: '咨询培训', owner: '王强', stageSince: D(-200) },
      { id: 'd8', code: 'SJ-2026-0108', name: '北辰-教务系统-2026', customerId: 'c4', stage: '方案报价', amount: 120000, expected: D(25), product: '定制开发', owner: '李娜', stageSince: D(-32) },
      { id: 'd9', code: 'SJ-2026-0109', name: '明德-知识库-2026', customerId: 'c8', stage: '需求确认', amount: 68000, expected: D(45), product: 'SaaS 订阅', owner: '李娜', stageSince: D(-9) },
      { id: 'd10', code: 'SJ-2026-0110', name: '千寻-营销中台-2026', customerId: 'c10', stage: '初步接触', amount: 45000, expected: D(70), product: 'SaaS 订阅', owner: '张伟', stageSince: D(-4) },
      { id: 'd11', code: 'SJ-2026-0111', name: '华兴-二期扩展-2027', customerId: 'c1', stage: '商务谈判', amount: 260000, expected: D(30), product: 'ERP 实施', owner: '张伟', stageSince: D(-12) },
      { id: 'd12', code: 'SJ-2026-0112', name: '云图-数据治理-2027', customerId: 'c2', stage: '方案报价', amount: 98000, expected: D(40), product: '咨询培训', owner: '张伟', stageSince: D(-20) },
      { id: 'd13', code: 'SJ-2026-0113', name: '中远-调度系统-2027', customerId: 'c5', stage: '需求确认', amount: 150000, expected: D(60), product: '定制开发', owner: '张伟', stageSince: D(-6) },
      { id: 'd14', code: 'SJ-2026-0114', name: '恒瑞-数据看板-2026', customerId: 'c3', stage: '输单', amount: 90000, expected: D(-40), product: '定制开发', owner: '李娜', stageSince: D(-50) }
    ];

    var contracts = [
      { id: 'ct1', code: 'HT-2026-0001', name: '华兴精密 ERP 实施服务合同', customerId: 'c1', dealId: 'd1', amount: 480000, cost: 336000, signDate: D(-247), start: D(-240), end: D(25), payMethod: '分期付款（3 期）', status: '执行中', owner: '张伟' },
      { id: 'ct2', code: 'HT-2026-0002', name: '云图数据平台年度订阅合同', customerId: 'c2', dealId: 'd2', amount: 168000, cost: 92000, signDate: D(-85), start: D(-80), end: D(285), payMethod: '一次性付清', status: '已完成', owner: '张伟' },
      { id: 'ct3', code: 'HT-2026-0003', name: '恒瑞医疗器械定制开发合同', customerId: 'c3', dealId: 'd3', amount: 320000, cost: 210000, signDate: D(-115), start: D(-108), end: D(200), payMethod: '分期付款（3 期）', status: '执行中', owner: '李娜' },
      { id: 'ct4', code: 'HT-2026-0004', name: '中远智慧物流运维服务合同', customerId: 'c5', dealId: 'd4', amount: 96000, cost: 48000, signDate: D(-205), start: D(-200), end: D(160), payMethod: '一次性付清', status: '执行中', owner: '张伟' },
      { id: 'ct5', code: 'HT-2026-0005', name: '星辰零售门店数字化合同', customerId: 'c6', dealId: 'd5', amount: 240000, cost: 150000, signDate: D(-6), start: D(-4), end: D(350), payMethod: '分期付款（3 期）', status: '执行中', owner: '王强' },
      { id: 'ct6', code: 'HT-2026-0006', name: '拓维新能源管理平台建设合同', customerId: 'c7', dealId: 'd6', amount: 560000, cost: 380000, signDate: D(-65), start: D(-58), end: D(310), payMethod: '分期付款（3 期）', status: '执行中', owner: '王强' },
      { id: 'ct7', code: 'HT-2026-0007', name: '蓝海融资租赁风控咨询合同', customerId: 'c9', dealId: 'd7', amount: 180000, cost: 96000, signDate: D(-195), start: D(-190), end: D(-5), payMethod: '一次性付清', status: '已完成', owner: '王强' }
    ];

    var plans = [
      { id: 'p1', code: 'HKJH-000001', contractId: 'ct1', term: '首付款', dueDate: D(-237), amount: 144000 },
      { id: 'p2', code: 'HKJH-000002', contractId: 'ct1', term: '进度款', dueDate: D(-30), amount: 192000 },
      { id: 'p3', code: 'HKJH-000003', contractId: 'ct1', term: '尾款', dueDate: D(20), amount: 144000 },
      { id: 'p4', code: 'HKJH-000004', contractId: 'ct2', term: '一次性付清', dueDate: D(-55), amount: 168000 },
      { id: 'p5', code: 'HKJH-000005', contractId: 'ct3', term: '首付款', dueDate: D(-100), amount: 96000 },
      { id: 'p6', code: 'HKJH-000006', contractId: 'ct3', term: '进度款', dueDate: D(8), amount: 128000 },
      { id: 'p7', code: 'HKJH-000007', contractId: 'ct3', term: '尾款', dueDate: D(180), amount: 96000 },
      { id: 'p8', code: 'HKJH-000008', contractId: 'ct4', term: '一次性付清', dueDate: D(-7), amount: 96000 },
      { id: 'p9', code: 'HKJH-000009', contractId: 'ct5', term: '首付款', dueDate: D(18), amount: 72000 },
      { id: 'p10', code: 'HKJH-000010', contractId: 'ct5', term: '进度款', dueDate: D(48), amount: 96000 },
      { id: 'p11', code: 'HKJH-000011', contractId: 'ct5', term: '尾款', dueDate: D(100), amount: 72000 },
      { id: 'p12', code: 'HKJH-000012', contractId: 'ct6', term: '首付款', dueDate: D(3), amount: 168000 },
      { id: 'p13', code: 'HKJH-000013', contractId: 'ct6', term: '进度款', dueDate: D(95), amount: 224000 },
      { id: 'p14', code: 'HKJH-000014', contractId: 'ct6', term: '尾款', dueDate: D(310), amount: 168000 },
      { id: 'p15', code: 'HKJH-000015', contractId: 'ct7', term: '一次性付清', dueDate: D(-180), amount: 180000 }
    ];

    var payments = [
      { id: 'pay1', contractId: 'ct1', planId: 'p1', amount: 144000, date: D(-236), method: '银行转账', status: '已核销' },
      { id: 'pay2', contractId: 'ct2', planId: 'p4', amount: 168000, date: D(-52), method: '银行转账', status: '已核销' },
      { id: 'pay3', contractId: 'ct3', planId: 'p5', amount: 96000, date: D(-99), method: '银行转账', status: '已核销' },
      { id: 'pay4', contractId: 'ct4', planId: 'p8', amount: 50000, date: D(-20), method: '银行承兑', status: '已核销' },
      { id: 'pay5', contractId: 'ct7', planId: 'p15', amount: 180000, date: D(-178), method: '银行转账', status: '已核销' }
    ];

    return {
      customers: customers, deals: deals, contracts: contracts,
      plans: plans, payments: payments,
      seq: { c: 10, d: 14, ct: 7, p: 15, pay: 5 }
    };
  }

  /* ---------------- 读写 ---------------- */
  var S = null;

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) { S = JSON.parse(raw); return; }
    } catch (e) { }
    S = seed();
    save();
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { }
  }

  /* ---------------- 领域计算 ---------------- */
  function byId(arr, id) { for (var i = 0; i < arr.length; i++) { if (arr[i].id === id) return arr[i]; } return null; }
  function customer(id) { return byId(S.customers, id); }
  function contractOf(id) { return byId(S.contracts, id); }
  function dealOf(id) { return byId(S.deals, id); }

  function planPaid(plan) {
    var sum = 0;
    S.payments.forEach(function (p) {
      if (p.planId === plan.id && p.status === '已核销') sum += Number(p.amount);
    });
    return sum;
  }
  function contractPaid(ct) {
    var sum = 0;
    S.payments.forEach(function (p) {
      if (p.contractId === ct.id && p.status === '已核销') sum += Number(p.amount);
    });
    return sum;
  }
  function contractPlanTotal(ct) {
    var sum = 0;
    S.plans.forEach(function (p) { if (p.contractId === ct.id) sum += Number(p.amount); });
    return sum;
  }
  function planState(plan) {
    var paid = planPaid(plan);
    if (paid >= plan.amount - 0.5) return '已回款';
    if (parseISO(plan.dueDate) < today()) return '逾期';
    if (paid > 0) return '部分回款';
    return '未到期';
  }
  function overdueDays(plan) {
    if (planState(plan) !== '逾期') return 0;
    return daysBetween(parseISO(plan.dueDate), today());
  }
  function dueInDays(plan) { return daysBetween(today(), parseISO(plan.dueDate)); }
  function weightOf(deal) { return Math.round(deal.amount * RATE[deal.stage]); }
  function stayDays(deal) { return daysBetween(parseISO(deal.stageSince), today()); }
  function isOpen(deal) { return OPEN_STAGES.indexOf(deal.stage) >= 0; }

  /* ---------------- 权限 ---------------- */
  var role = ROLES.admin;

  function setRole(key) { role = ROLES[key] || ROLES.admin; }

  function visible(obj) {
    if (!obj) return false;
    if (role.scope === 'own' && obj.owner !== role.user) return false;
    return true;
  }
  function visibleCustomers() { return S.customers.filter(visible); }
  function visibleDeals() { return S.deals.filter(visible); }
  function visibleContracts() { return S.contracts.filter(visible); }
  function visiblePlans() {
    var cts = visibleContracts().map(function (c) { return c.id; });
    return S.plans.filter(function (p) { return cts.indexOf(p.contractId) >= 0; });
  }
  function canCreate(obj) {
    if (role.readonly) return false;
    if (obj === 'customer' || obj === 'deal') return role.key === 'admin' || role.key === 'sales';
    if (obj === 'payment') return role.key === 'admin' || role.key === 'finance';
    return false;
  }
  function canAdvance(deal) {
    if (role.readonly) return false;
    if (role.key === 'admin') return true;
    if (role.key === 'sales') return deal.owner === role.user;
    return false;
  }

  /* ---------------- 提醒（对应方案的自动化规则） ---------------- */
  function buildAlerts() {
    var out = [];
    var t = today();
    visiblePlans().forEach(function (p) {
      var st = planState(p);
      var ct = contractOf(p.contractId);
      var c = ct ? customer(ct.customerId) : null;
      if (!ct || !c) return;
      if (st === '逾期') {
        out.push({
          level: 'red', icon: '!',
          title: c.short + ' 回款逾期 ' + overdueDays(p) + ' 天',
          desc: ct.code + ' · ' + p.term + ' · ' + money(p.amount) + '（已收 ' + money(planPaid(p)) + '）',
          link: '#/payments'
        });
      } else if (st !== '已回款' && dueInDays(p) >= 0 && dueInDays(p) <= 7) {
        out.push({
          level: 'amber', icon: '!',
          title: c.short + ' 回款 ' + dueInDays(p) + ' 天后到期',
          desc: ct.code + ' · ' + p.term + ' · ' + money(p.amount) + ' · 到期日 ' + p.dueDate,
          link: '#/payments'
        });
      }
    });
    visibleDeals().forEach(function (d) {
      if (isOpen(d) && stayDays(d) > 15) {
        var c = customer(d.customerId);
        out.push({
          level: 'blue', icon: '!',
          title: (c ? c.short : '') + ' 商机停滞 ' + stayDays(d) + ' 天',
          desc: d.name + ' · ' + d.stage + ' · ' + money(d.amount) + ' · 负责人 ' + d.owner,
          link: '#/deals'
        });
      }
    });
    visibleContracts().forEach(function (ct) {
      if (ct.status !== '执行中') return;
      var left = daysBetween(t, parseISO(ct.end));
      if (left >= 0 && left <= 30) {
        var c = customer(ct.customerId);
        out.push({
          level: 'amber', icon: '!',
          title: (c ? c.short : '') + ' 合同 ' + left + ' 天后到期',
          desc: ct.code + ' · 未回款 ' + money(Math.max(0, ct.amount - contractPaid(ct))),
          link: '#/contracts'
        });
      }
    });
    var order = { red: 0, amber: 1, blue: 2 };
    out.sort(function (a, b) { return order[a.level] - order[b.level]; });
    return out;
  }

  /* ---------------- 通用片段 ---------------- */
  function pageHead(title, desc, actions) {
    return '<div class="page-head"><div><div class="page-title">' + esc(title) + '</div>' +
      '<div class="page-desc">' + esc(desc) + '</div></div>' +
      '<div class="page-actions">' + (actions || '') + '</div></div>';
  }
  function stagePill(stage) {
    var map = {
      '初步接触': 'gray', '需求确认': 'blue', '方案报价': 'blue',
      '商务谈判': 'amber', '赢单': 'green', '输单': 'red'
    };
    return '<span class="pill ' + (map[stage] || 'gray') + '">' + esc(stage) + '</span>';
  }
  function statePill(st) {
    var map = { '已回款': 'green', '部分回款': 'amber', '逾期': 'red', '未到期': 'gray' };
    return '<span class="pill ' + (map[st] || 'gray') + '">' + esc(st) + '</span>';
  }
  function statusPill(st) {
    var map = { '执行中': 'blue', '已完成': 'green', '已终止': 'red', '草稿': 'gray' };
    return '<span class="pill ' + (map[st] || 'gray') + '">' + esc(st) + '</span>';
  }
  function emptyRow(cols, text) {
    return '<tr><td colspan="' + cols + '"><div class="empty">' + esc(text || '暂无数据') + '</div></td></tr>';
  }
  function bar(ratio, level) {
    var w = Math.max(0, Math.min(1, ratio)) * 100;
    return '<div class="progress ' + (level || '') + '"><i style="width:' + w.toFixed(1) + '%"></i></div>';
  }

  /* ---------------- 页面：仪表盘 ---------------- */
  function pageDash() {
    var deals = visibleDeals();
    var open = deals.filter(isOpen);
    var pipe = open.reduce(function (s, d) { return s + d.amount; }, 0);
    var weighted = open.reduce(function (s, d) { return s + weightOf(d); }, 0);
    var mStart = firstDayOfMonth();
    var signed = visibleContracts().filter(function (c) {
      return parseISO(c.signDate) >= mStart && c.status !== '已终止';
    }).reduce(function (s, c) { return s + c.amount; }, 0);
    var overdueAmt = 0, overdueCnt = 0;
    visiblePlans().forEach(function (p) {
      if (planState(p) === '逾期') { overdueAmt += p.amount; overdueCnt++; }
    });
    var alerts = buildAlerts();

    var html = pageHead('仪表盘', '四个指标看当月，一张漏斗看管道，右侧提醒驱动动作', '');
    html += '<div class="grid k4">';
    html += '<div class="card kpi accent"><div class="label">在谈管道</div><div class="value">' + money(pipe) +
      '</div><div class="foot">' + open.length + ' 个在谈商机（不含赢单/输单）</div></div>';
    html += '<div class="card kpi"><div class="label">加权管道</div><div class="value">' + money(weighted) +
      '</div><div class="foot">按阶段赢率折算的预测值</div></div>';
    html += '<div class="card kpi ok"><div class="label">本月签约</div><div class="value">' + money(signed) +
      '</div><div class="foot">按签订日期归属当月</div></div>';
    html += '<div class="card kpi danger"><div class="label">逾期金额</div><div class="value">' + money(overdueAmt) +
      '</div><div class="foot">' + overdueCnt + ' 期逾期未收</div></div>';
    html += '</div>';

    html += '<div class="grid k2" style="margin-top:16px">';
    html += '<div class="card funnel-card"><div class="card-head"><div class="card-title">销售漏斗（按商机数）</div>' +
      '<div class="card-sub">赢单与输单单独统计</div></div><div class="funnel">';
    var openMax = 1;
    OPEN_STAGES.forEach(function (s) {
      var n = deals.filter(function (d) { return d.stage === s; }).length;
      if (n > openMax) openMax = n;
    });
    OPEN_STAGES.forEach(function (s) {
      var list = deals.filter(function (d) { return d.stage === s; });
      var amt = list.reduce(function (a, d) { return a + d.amount; }, 0);
      var w = Math.max(8, Math.round(list.length / openMax * 100));
      html += '<div class="funnel-row"><div class="funnel-lab">' + esc(s) + '</div>' +
        '<div class="funnel-bar" style="width:' + w + '%"></div>' +
        '<div class="funnel-val">' + list.length + ' 个 · ' + money(amt) + '</div></div>';
    });
    var wonList = deals.filter(function (d) { return d.stage === '赢单'; });
    var lostList = deals.filter(function (d) { return d.stage === '输单'; });
    var closed = wonList.length + lostList.length;
    var openStay = open.length ? Math.round(open.reduce(function (a, d) { return a + stayDays(d); }, 0) / open.length) : 0;
    var openAvg = open.length ? Math.round(pipe / open.length) : 0;
    html += '</div><div class="mini">' +
      '<div><div class="k">赢单率（已结案）</div><div class="v">' + (closed ? pct(wonList.length / closed) : '—') + '</div></div>' +
      '<div><div class="k">在谈平均停留</div><div class="v">' + openStay + ' 天</div></div>' +
      '<div><div class="k">在谈平均金额</div><div class="v">' + money(openAvg) + '</div></div>' +
      '</div></div>';

    html += '<div class="card"><div class="card-head"><div class="card-title">今日提醒</div>' +
      '<div class="card-sub"><a href="#/alerts">查看全部 ' + alerts.length + ' 条</a></div></div>';
    if (!alerts.length) {
      html += '<div class="empty">没有需要处理的事项</div>';
    } else {
      alerts.slice(0, 4).forEach(function (a) {
        html += '<div class="alert ' + a.level + '"><div class="ico">' + a.icon + '</div><div class="body">' +
          '<div class="title">' + esc(a.title) + '</div><div class="desc">' + esc(a.desc) + '</div></div></div>';
      });
    }
    html += '</div></div>';

    // 逾期清单
    var over = visiblePlans().filter(function (p) { return planState(p) === '逾期'; })
      .sort(function (a, b) { return overdueDays(b) - overdueDays(a); }).slice(0, 6);
    html += '<div class="card" style="margin-top:16px"><div class="card-head"><div class="card-title">逾期回款清单</div>' +
      '<div class="card-sub">按逾期天数降序，点击进入回款台</div></div><div class="table-wrap" style="border:none">' +
      '<table><thead><tr><th>客户</th><th>合同</th><th>期次</th><th class="right">金额</th><th class="right">逾期</th></tr></thead><tbody>';
    if (!over.length) html += emptyRow(5, '暂无逾期回款');
    over.forEach(function (p) {
      var ct = contractOf(p.contractId); var c = ct ? customer(ct.customerId) : null;
      html += '<tr class="clickable" data-act="goto" data-href="#/payments"><td>' + esc(c ? c.short : '—') + '</td>' +
        '<td>' + esc(ct ? ct.code : '—') + '</td><td>' + esc(p.term) + '</td>' +
        '<td class="right num">' + money(p.amount) + '</td>' +
        '<td class="right"><span class="pill red">' + overdueDays(p) + ' 天</span></td></tr>';
    });
    html += '</tbody></table></div></div>';
    return html;
  }

  /* ---------------- 页面：客户 ---------------- */
  var custQuery = '';

  function pageCustomers() {
    var list = visibleCustomers().filter(function (c) {
      if (!custQuery) return true;
      var q = custQuery.toLowerCase();
      return (c.name + c.short + c.code + c.industry + c.owner).toLowerCase().indexOf(q) >= 0;
    });
    var html = pageHead('客户', '一客一档；客户是全系统的主数据，商机与合同都挂在客户下',
      '<div class="search"><span style="color:#7A8598">🔍</span><input id="custSearch" placeholder="搜索客户 / 编号 / 行业" value="' + esc(custQuery) + '"></div>' +
      (canCreate('customer') ? '<button class="btn primary" data-act="new-customer">+ 新增客户</button>' : ''));

    html += '<div class="table-wrap"><table><thead><tr>' +
      '<th>编号</th><th>客户</th><th>行业</th><th>区域</th><th>等级</th><th>负责人</th>' +
      '<th class="right">商机数</th><th class="right">合同金额</th><th>状态</th></tr></thead><tbody>';

    if (!list.length) html += emptyRow(9, '没有匹配的客户');
    list.forEach(function (c) {
      var ds = S.deals.filter(function (d) { return d.customerId === c.id; });
      var amt = S.contracts.filter(function (ct) { return ct.customerId === c.id; })
        .reduce(function (s, ct) { return s + ct.amount; }, 0);
      html += '<tr class="clickable" data-act="open-customer" data-id="' + c.id + '">' +
        '<td style="color:#7A8598;font-size:12px">' + esc(c.code) + '</td>' +
        '<td><b>' + esc(c.short) + '</b> <span style="color:#7A8598;font-size:12px">' + esc(c.name) + '</span></td>' +
        '<td>' + esc(c.industry) + '</td><td>' + esc(c.region) + '</td>' +
        '<td><span class="pill ' + (c.level === 'A' ? 'blue' : (c.level === 'B' ? 'amber' : 'gray')) + '">' + esc(c.level) + '</span></td>' +
        '<td>' + esc(c.owner) + '</td>' +
        '<td class="right num">' + ds.length + '</td>' +
        '<td class="right num">' + money(amt) + '</td>' +
        '<td><span class="pill ' + (c.status === '已成交' ? 'green' : (c.status === '跟进中' ? 'blue' : 'gray')) + '">' + esc(c.status) + '</span></td>' +
        '</tr>';
    });
    html += '</tbody></table></div>';
    html += '<div class="hint" style="margin-top:10px">共 ' + list.length + ' 家客户。点击任意一行查看客户详情、关联商机与合同。</div>';
    return html;
  }

  /* ---------------- 页面：商机 ---------------- */
  var dealView = 'kanban';

  function pageDeals() {
    var deals = visibleDeals();
    var html = pageHead('商机', '阶段即流程：每推进一次阶段，停留天数重新计时',
      '<button class="btn ' + (dealView === 'kanban' ? 'primary' : '') + '" data-act="deal-view" data-v="kanban">看板</button>' +
      '<button class="btn ' + (dealView === 'table' ? 'primary' : '') + '" data-act="deal-view" data-v="table">表格</button>' +
      (canCreate('deal') ? '<button class="btn primary" data-act="new-deal">+ 新增商机</button>' : ''));

    if (dealView === 'kanban') {
      html += '<div class="kanban">';
      STAGES.forEach(function (stage) {
        var list = deals.filter(function (d) { return d.stage === stage; });
        var sum = list.reduce(function (s, d) { return s + d.amount; }, 0);
        html += '<div class="kcol"><div class="kcol-head"><span>' + esc(stage) + '</span>' +
          '<span class="kcol-count">' + list.length + ' · ' + money(sum) + '</span></div>';
        if (!list.length) html += '<div class="empty" style="padding:18px 4px">—</div>';
        list.forEach(function (d) {
          var c = customer(d.customerId);
          var stay = stayDays(d);
          var warn = isOpen(d) && stay > 15;
          html += '<div class="kcard" data-act="open-deal" data-id="' + d.id + '">' +
            '<div class="t">' + esc(d.name) + '</div>' +
            '<div class="m"><span>' + esc(c ? c.short : '—') + ' · ' + esc(d.owner) + '</span>' +
            '<span class="amt">' + money(d.amount) + '</span></div>' +
            '<div class="m" style="margin-top:4px"><span>停留 ' + stay + ' 天</span>' +
            (warn ? '<span class="pill red" style="font-size:10.5px;padding:0 6px">停滞</span>' : '') +
            '</div>' +
            (canAdvance(d) && stage !== '赢单' && stage !== '输单'
              ? '<div class="acts"><button class="btn sm" data-act="advance" data-id="' + d.id + '">推进 →</button></div>' : '') +
            '</div>';
        });
        html += '</div>';
      });
      html += '</div>';
      html += '<div class="hint" style="margin-top:12px">看板按销售阶段分组；停留超过 15 天的在谈商机会标红，对应方案里的「停滞商机」视图与周会复盘。</div>';
    } else {
      html += '<div class="table-wrap"><table><thead><tr><th>编号</th><th>商机</th><th>客户</th><th>阶段</th>' +
        '<th class="right">金额</th><th class="right">赢率</th><th class="right">加权</th>' +
        '<th>预计成交</th><th class="right">停留</th><th>负责人</th></tr></thead><tbody>';
      if (!deals.length) html += emptyRow(10);
      deals.forEach(function (d) {
        var c = customer(d.customerId);
        html += '<tr class="clickable" data-act="open-deal" data-id="' + d.id + '">' +
          '<td style="color:#7A8598;font-size:12px">' + esc(d.code) + '</td>' +
          '<td>' + esc(d.name) + '</td><td>' + esc(c ? c.short : '—') + '</td>' +
          '<td>' + stagePill(d.stage) + '</td>' +
          '<td class="right num">' + money(d.amount) + '</td>' +
          '<td class="right num">' + pct(RATE[d.stage]) + '</td>' +
          '<td class="right num">' + money(weightOf(d)) + '</td>' +
          '<td>' + esc(d.expected) + '</td>' +
          '<td class="right num">' + stayDays(d) + ' 天</td>' +
          '<td>' + esc(d.owner) + '</td></tr>';
      });
      html += '</tbody></table></div>';
    }
    return html;
  }

  /* ---------------- 页面：合同 ---------------- */
  function pageContracts() {
    var list = visibleContracts();
    var html = pageHead('合同', '合同是回款的上游：只有「执行中」的合同才生成回款计划',
      '<button class="btn" data-act="export">导出 CSV</button>');
    html += '<div class="table-wrap"><table><thead><tr><th>编号</th><th>合同</th><th>客户</th>' +
      '<th class="right">金额</th>' +
      (role.hideCost ? '' : '<th class="right">毛利率</th>') +
      '<th>签订日</th><th>回款进度</th><th>状态</th><th>负责人</th></tr></thead><tbody>';
    if (!list.length) html += emptyRow(role.hideCost ? 8 : 9);
    list.forEach(function (ct) {
      var c = customer(ct.customerId);
      var paid = contractPaid(ct);
      var ratio = ct.amount ? paid / ct.amount : 0;
      var level = ratio >= 0.999 ? '' : (parseISO(ct.end) < today() ? 'bad' : 'warn');
      html += '<tr class="clickable" data-act="open-contract" data-id="' + ct.id + '">' +
        '<td style="color:#7A8598;font-size:12px">' + esc(ct.code) + '</td>' +
        '<td>' + esc(ct.name) + '</td><td>' + esc(c ? c.short : '—') + '</td>' +
        '<td class="right num">' + money(ct.amount) + '</td>' +
        (role.hideCost ? '' : '<td class="right num">' + pct((ct.amount - ct.cost) / ct.amount) + '</td>') +
        '<td>' + esc(ct.signDate) + '</td>' +
        '<td><div class="progress-cell">' + bar(ratio, level) + '<span class="progress-txt">' + pct(ratio) + '</span></div></td>' +
        '<td>' + statusPill(ct.status) + '</td><td>' + esc(ct.owner) + '</td></tr>';
    });
    html += '</tbody></table></div>';
    html += '<div class="hint" style="margin-top:10px">' +
      (role.hideCost ? '当前角色看不到「合同成本 / 毛利率」两列 —— 这是方案里的字段级权限。' : '毛利率 =（合同金额 − 合同成本）/ 合同金额。') +
      '</div>';
    return html;
  }

  /* ---------------- 页面：回款 ---------------- */
  var payFilter = 'all';
  var ALL_PLANS_RECENT = null;

  function pagePayments() {
    var plans = visiblePlans();
    var counts = { all: plans.length, overdue: 0, soon: 0, done: 0 };
    plans.forEach(function (p) {
      var st = planState(p);
      if (st === '逾期') counts.overdue++;
      if (st === '已回款') counts.done++;
      if (st !== '已回款' && dueInDays(p) >= 0 && dueInDays(p) <= 7) counts.soon++;
    });
    var filtered = plans.filter(function (p) {
      var st = planState(p);
      if (payFilter === 'all') return true;
      if (payFilter === 'overdue') return st === '逾期';
      if (payFilter === 'soon') return st !== '已回款' && dueInDays(p) >= 0 && dueInDays(p) <= 7;
      if (payFilter === 'done') return st === '已回款';
      return true;
    }).sort(function (a, b) {
      var sa = a.dueDate, sb = b.dueDate;
      return sa < sb ? -1 : (sa > sb ? 1 : 0);
    });

    var html = pageHead('回款', '回款状态由公式算出：已回款 / 逾期 / 部分回款 / 未到期，不接受人工填写',
      (canCreate('payment') ? '<span class="hint">财务可在合同详情内登记回款</span>' : ''));

    html += '<div class="chips">' +
      chip('all', '全部', counts.all) + chip('overdue', '逾期', counts.overdue) +
      chip('soon', '7 天内到期', counts.soon) + chip('done', '已回款', counts.done) + '</div>';

    html += '<div class="table-wrap"><table><thead><tr><th>客户</th><th>合同</th><th>期次</th>' +
      '<th>计划回款日</th><th class="right">计划金额</th><th class="right">已收</th>' +
      '<th>状态</th><th class="right">逾期天数</th><th></th></tr></thead><tbody>';
    if (!filtered.length) html += emptyRow(9, '没有符合条件的回款计划');
    filtered.forEach(function (p) {
      var ct = contractOf(p.contractId);
      var c = ct ? customer(ct.customerId) : null;
      var st = planState(p);
      var od = overdueDays(p);
      html += '<tr><td>' + esc(c ? c.short : '—') + '</td>' +
        '<td style="font-size:12px;color:#7A8598">' + esc(ct ? ct.code : '—') + '</td>' +
        '<td>' + esc(p.term) + '</td><td>' + esc(p.dueDate) + '</td>' +
        '<td class="right num">' + money(p.amount) + '</td>' +
        '<td class="right num">' + money(planPaid(p)) + '</td>' +
        '<td>' + statePill(st) + '</td>' +
        '<td class="right num">' + (od ? '<span class="pill red">' + od + '</span>' : '—') + '</td>' +
        '<td>' + (canCreate('payment') && st !== '已回款'
          ? '<button class="btn sm" data-act="pay" data-id="' + p.id + '">登记回款</button>' : '') + '</td></tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }
  function chip(key, label, n) {
    return '<button class="chip ' + (payFilter === key ? 'active' : '') + '" data-act="pay-filter" data-v="' + key + '">' +
      esc(label) + '<span class="n">' + n + '</span></button>';
  }

  /* ---------------- 页面：提醒 ---------------- */
  function pageAlerts() {
    var alerts = buildAlerts();
    var html = pageHead('提醒', '对应方案里的自动化规则：逾期催收、到期前 7 天、商机停滞、合同到期');
    html += '<div class="card">';
    if (!alerts.length) html += '<div class="empty">没有需要处理的事项</div>';
    alerts.forEach(function (a) {
      html += '<div class="alert ' + a.level + '"><div class="ico">' + a.icon + '</div><div class="body">' +
        '<div class="title">' + esc(a.title) + '</div><div class="desc">' + esc(a.desc) + '</div></div>' +
        '<a class="btn sm" href="' + a.link + '">处理</a></div>';
    });
    html += '</div>';
    html += '<div class="hint" style="margin-top:10px">演示版为打开页面时实时计算；正式系统中的对应实现是「定时触发 + 查找记录 + 发送消息」。</div>';
    return html;
  }

  /* ---------------- 页面：关于 ---------------- */
  function pageAbout() {
    var html = pageHead('关于这个 MVP', '把《飞书多维表格销售运营管理信息系统 建设方案》的主链路做成了一个能点的版本');
    html += '<div class="about-grid">';
    html += '<div class="card"><div class="card-title" style="margin-bottom:8px">做了什么</div><ul>' +
      '<li>5 张表：客户、商机、合同、回款计划、回款记录</li>' +
      '<li>4 类视图：看板（商机）、表格（客户 / 合同 / 回款）、漏斗、提醒</li>' +
      '<li>看板与仪表盘：管道金额、加权管道、本月签约、逾期金额</li>' +
      '<li>提醒规则 4 条：逾期、7 天内到期、商机停滞、合同到期</li>' +
      '<li>权限演示：4 个角色切换，记录可见范围 + 字段隐藏 + 操作权限</li>' +
      '</ul></div>';
    html += '<div class="card"><div class="card-title" style="margin-bottom:8px">怎么做的</div><ul>' +
      '<li>纯静态：<code class="k">index.html</code> + <code class="k">assets/app.js</code>，没有任何依赖与构建</li>' +
      '<li>数据存浏览器 <code class="k">localStorage</code>，刷新不丢；右上角「重置」可恢复演示数据</li>' +
      '<li>数据层单独封装（load / save / seed），换成后端 API 只需改这一层</li>' +
      '<li>所有金额、逾期天数、加权金额都是实时计算的派生值，不存储冗余字段</li>' +
      '</ul></div>';
    html += '</div>';
    html += '<div class="card" style="margin-top:16px"><div class="card-title" style="margin-bottom:8px">与飞书方案的对应关系</div>' +
      '<div class="table-wrap" style="border:none"><table><thead><tr><th>本 MVP</th><th>飞书多维表格</th><th>说明</th></tr></thead><tbody>' +
      '<tr><td>表格视图</td><td>多维表格视图（表格 / 看板 / 日历）</td><td>同一份数据的多种呈现</td></tr>' +
      '<tr><td>提醒面板</td><td>自动化（定时 + 查找记录 + 发消息）</td><td>本 MVP 打开页面时实时计算</td></tr>' +
      '<tr><td>角色切换</td><td>高级权限（角色 + 记录范围 + 字段权限）</td><td>记录范围按负责人，字段按成本类隐藏</td></tr>' +
      '<tr><td>localStorage</td><td>多维表格数据表</td><td>真实场景应换成数据库 + 登录</td></tr>' +
      '</tbody></table></div></div>';
    html += '<div class="card" style="margin-top:16px"><div class="card-title" style="margin-bottom:8px">下一步</div><ul>' +
      '<li>接后端：Node/Python + SQLite，把数据层换成 REST API</li>' +
      '<li>登录与审计：飞书扫码登录，操作日志</li>' +
      '<li>导入导出：Excel 模板导入客户与合同</li>' +
      '<li>完整方案：<a href="docs/飞书多维表格销售运营管理系统_建设方案.docx">建设方案.docx</a> · ' +
      '<a href="docs/飞书多维表格销售运营管理系统_实施配置手册.xlsx">实施配置手册.xlsx</a></li>' +
      '</ul></div>';
    return html;
  }

  /* ---------------- 导航与外壳 ---------------- */
  var NAV = [
    { id: 'dash', label: '仪表盘' },
    { id: 'customers', label: '客户' },
    { id: 'deals', label: '商机' },
    { id: 'contracts', label: '合同' },
    { id: 'payments', label: '回款' },
    { id: 'alerts', label: '提醒', badge: true },
    { id: 'about', label: '关于' }
  ];
  var route = 'dash';

  function renderNav() {
    var n = buildAlerts().length;
    var html = '<div class="nav-caption">工作台</div>';
    NAV.forEach(function (item) {
      html += '<div class="nav-item ' + (route === item.id ? 'active' : '') + '" data-act="nav" data-v="' + item.id + '">' +
        '<span>' + esc(item.label) + '</span>' +
        (item.badge && n ? '<span class="badge">' + n + '</span>' : '') + '</div>';
    });
    html += '<div class="nav-sep"></div><div class="nav-caption">数据</div>';
    html += '<div class="nav-item" data-act="export"><span>导出合同 CSV</span></div>';
    html += '<div class="nav-item" data-act="reset"><span>恢复演示数据</span></div>';
    $('#nav').innerHTML = html;
  }

  function bannerHtml() {
    if (role.key === 'admin') return '';
    var cls = role.key === 'viewer' ? ' warn' : '';
    return '<div class="banner' + cls + '"><div>👤</div><div><b>当前角色：' + esc(role.label) + '</b> —— ' +
      esc(role.note) + '</div></div>';
  }

  var PAGES = { dash: pageDash, customers: pageCustomers, deals: pageDeals, contracts: pageContracts, payments: pagePayments, alerts: pageAlerts, about: pageAbout };

  function render() {
    var hash = (location.hash || '#/dash').replace('#/', '');
    if (!PAGES[hash]) hash = 'dash';
    route = hash;
    try {
      $('#view').innerHTML = PAGES[route]();
      $('#banner').innerHTML = bannerHtml();
      renderNav();
      if (route === 'customers') {
        var inp = $('#custSearch');
        if (inp) {
          inp.addEventListener('input', function (e) {
            custQuery = e.target.value;
            var pos = e.target.selectionStart;
            render();
            var again = $('#custSearch');
            if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (err) { } }
          });
        }
      }
    } catch (err) {
      document.getElementById('view').innerHTML = '<div class="card">渲染出错：' + esc(err && err.message ? err.message : err) + '</div>';
      window.__errs = window.__errs || [];
      window.__errs.push(String(err && err.stack ? err.stack : err));
    }
  }

  /* ---------------- 弹窗 ---------------- */
  function openModal(title, bodyHtml, footHtml) {
    $('#modalRoot').innerHTML = '<div class="modal-mask" data-act="mask">' +
      '<div class="modal"><div class="modal-head"><div class="modal-title">' + esc(title) + '</div>' +
      '<button class="close" data-act="close">×</button></div>' +
      '<div class="modal-body">' + bodyHtml + '</div>' +
      (footHtml ? '<div class="modal-foot">' + footHtml + '</div>' : '') +
      '</div></div>';
    var first = $('#modalRoot input, #modalRoot select');
    if (first) first.focus();
  }
  function closeModal() { $('#modalRoot').innerHTML = ''; }

  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el.__t);
    el.__t = setTimeout(function () { el.classList.remove('show'); }, 1800);
  }

  function field(label, inner, full) {
    return '<div class="field' + (full ? ' full' : '') + '"><label>' + esc(label) + '</label>' + inner + '</div>';
  }
  function select(id, options, value) {
    var h = '<select id="' + id + '">';
    options.forEach(function (o) {
      h += '<option value="' + esc(o) + '"' + (o === value ? ' selected' : '') + '>' + esc(o) + '</option>';
    });
    return h + '</select>';
  }

  /* ---------------- 客户详情 ---------------- */
  function openCustomer(id) {
    var c = customer(id);
    if (!c) return;
    var ds = S.deals.filter(function (d) { return d.customerId === id; });
    var cts = S.contracts.filter(function (x) { return x.customerId === id; });
    var amt = cts.reduce(function (s, x) { return s + x.amount; }, 0);
    var paid = cts.reduce(function (s, x) { return s + contractPaid(x); }, 0);
    var body = '<div class="kv">' +
      kv('客户编号', c.code) + kv('客户名称', c.name) + kv('行业', c.industry) + kv('区域', c.region) +
      kv('等级', c.level) + kv('来源', c.source) + kv('负责人', c.owner) + kv('联系电话', c.phone) +
      kv('建档日期', c.createdAt) + kv('状态', c.status) +
      '</div>';
    body += '<div class="subhead">商机 ' + ds.length + ' 个 · 合计 ' + money(ds.reduce(function (s, d) { return s + d.amount; }, 0)) + '</div>';
    body += '<div class="table-wrap" style="border:none"><table><thead><tr><th>商机</th><th>阶段</th><th class="right">金额</th><th class="right">停留</th></tr></thead><tbody>';
    if (!ds.length) body += emptyRow(4);
    ds.forEach(function (d) {
      body += '<tr><td>' + esc(d.name) + '</td><td>' + stagePill(d.stage) + '</td>' +
        '<td class="right num">' + money(d.amount) + '</td><td class="right num">' + stayDays(d) + ' 天</td></tr>';
    });
    body += '</tbody></table></div>';
    body += '<div class="subhead">合同 ' + cts.length + ' 份 · 合同金额 ' + money(amt) + ' · 已回款 ' + money(paid) + '</div>';
    body += '<div class="table-wrap" style="border:none"><table><thead><tr><th>合同</th><th class="right">金额</th><th>回款率</th><th>状态</th></tr></thead><tbody>';
    if (!cts.length) body += emptyRow(4);
    cts.forEach(function (x) {
      body += '<tr><td>' + esc(x.code) + ' ' + esc(x.name) + '</td><td class="right num">' + money(x.amount) + '</td>' +
        '<td>' + pct(contractPaid(x) / x.amount) + '</td><td>' + statusPill(x.status) + '</td></tr>';
    });
    body += '</tbody></table></div>';
    openModal('客户详情 · ' + c.short, body, '<button class="btn" data-act="close">关闭</button>');
  }
  function kv(k, v) { return '<div><div class="k">' + esc(k) + '</div><div class="v">' + esc(v == null ? '—' : v) + '</div></div>'; }

  /* ---------------- 商机详情 ---------------- */
  function openDeal(id) {
    var d = dealOf(id);
    if (!d) return;
    var c = customer(d.customerId);
    var body = '<div class="kv">' +
      kv('商机编号', d.code) + kv('客户', c ? c.short : '—') + kv('产品线', d.product) +
      kv('阶段', d.stage) + kv('预计金额', money(d.amount)) + kv('赢率', pct(RATE[d.stage])) +
      kv('加权金额', money(weightOf(d))) + kv('预计成交', d.expected) +
      kv('负责人', d.owner) + kv('停留天数', stayDays(d) + ' 天') +
      '</div>';
    if (isOpen(d) && stayDays(d) > 15) {
      body += '<div class="banner">该商机已在「' + esc(d.stage) + '」停留 ' + stayDays(d) + ' 天，建议本周内补齐推进动作或直接输单。</div>';
    }
    var foot = '<button class="btn" data-act="close">关闭</button>';
    if (canAdvance(d) && isOpen(d)) {
      foot = '<button class="btn" data-act="advance" data-id="' + d.id + '">推进到下一阶段</button>' + foot;
    }
    openModal('商机详情', body, foot);
  }

  /* ---------------- 合同详情 ---------------- */
  function openContract(id) {
    var ct = contractOf(id);
    if (!ct) return;
    var c = customer(ct.customerId);
    var plans = S.plans.filter(function (p) { return p.contractId === id; });
    var pays = S.payments.filter(function (p) { return p.contractId === id; });
    var paid = contractPaid(ct);
    var body = '<div class="kv">' +
      kv('合同编号', ct.code) + kv('客户', c ? c.name : '—') +
      kv('合同金额', money(ct.amount)) +
      (role.hideCost ? '' : kv('毛利率', pct((ct.amount - ct.cost) / ct.amount))) +
      kv('签订日期', ct.signDate) + kv('服务期', ct.start + ' ~ ' + ct.end) +
      kv('付款方式', ct.payMethod) + kv('状态', ct.status) +
      kv('已回款', money(paid)) + kv('回款完成率', pct(paid / ct.amount)) +
      '</div>';
    body += '<div class="subhead">回款计划 ' + plans.length + ' 期</div>';
    body += '<div class="table-wrap" style="border:none"><table><thead><tr><th>期次</th><th>计划日</th>' +
      '<th class="right">金额</th><th class="right">已收</th><th>状态</th><th></th></tr></thead><tbody>';
    if (!plans.length) body += emptyRow(6, '尚未生成回款计划');
    plans.forEach(function (p) {
      var st = planState(p);
      body += '<tr><td>' + esc(p.term) + '</td><td>' + esc(p.dueDate) + '</td>' +
        '<td class="right num">' + money(p.amount) + '</td>' +
        '<td class="right num">' + money(planPaid(p)) + '</td>' +
        '<td>' + statePill(st) + '</td>' +
        '<td>' + (canCreate('payment') && st !== '已回款'
          ? '<button class="btn sm" data-act="pay" data-id="' + p.id + '">登记</button>' : '') + '</td></tr>';
    });
    body += '</tbody></table></div>';
    body += '<div class="subhead">回款记录 ' + pays.length + ' 笔</div>';
    body += '<div class="table-wrap" style="border:none"><table><thead><tr><th>日期</th><th class="right">金额</th><th>方式</th><th>状态</th></tr></thead><tbody>';
    if (!pays.length) body += emptyRow(4, '暂无回款记录');
    pays.forEach(function (p) {
      body += '<tr><td>' + esc(p.date) + '</td><td class="right num">' + money(p.amount) + '</td>' +
        '<td>' + esc(p.method) + '</td><td><span class="pill green">' + esc(p.status) + '</span></td></tr>';
    });
    body += '</tbody></table></div>';
    openModal('合同详情 · ' + ct.code, body, '<button class="btn" data-act="close">关闭</button>');
  }

  /* ---------------- 表单：新增客户 / 商机 / 回款 ---------------- */
  function newCustomer() {
    var body = '<div class="form-grid">' +
      field('客户名称 *', '<input id="f_name" placeholder="与营业执照一致">', true) +
      field('客户简称 *', '<input id="f_short" placeholder="看板与关联字段显示名">') +
      field('所属行业', select('f_ind', INDUSTRIES, '制造业')) +
      field('所属区域', select('f_reg', REGIONS, '华东')) +
      field('客户等级', select('f_lvl', LEVELS, 'C')) +
      field('客户来源', select('f_src', SOURCES, '官网表单')) +
      field('负责人', select('f_owner', OWNERS, role.key === 'sales' ? role.user : '张伟')) +
      field('联系电话', '<input id="f_phone" placeholder="选填">') +
      '</div><div class="hint" style="margin-top:12px">保存后自动生成客户编号，并出现在「客户」列表顶部。</div>';
    openModal('新增客户', body,
      '<button class="btn" data-act="close">取消</button><button class="btn primary" data-act="save-customer">保存</button>');
  }
  function saveCustomer() {
    var name = ($('#f_name') || {}).value || '';
    if (!name.trim()) { toast('请填写客户名称'); return; }
    S.seq.c += 1;
    var code = 'KH-2026-' + String(S.seq.c).padStart(4, '0');
    S.customers.unshift({
      id: 'c' + Date.now(),
      code: code,
      name: name.trim(),
      short: (($('#f_short') || {}).value || name).trim(),
      industry: $('#f_ind').value,
      region: $('#f_reg').value,
      level: $('#f_lvl').value,
      source: $('#f_src').value,
      owner: $('#f_owner').value,
      phone: ($('#f_phone') || {}).value || '—',
      status: '潜在',
      createdAt: iso(today())
    });
    save(); closeModal(); render(); toast('客户已创建');
  }

  function newDeal() {
    var cs = visibleCustomers();
    if (!cs.length) { toast('没有可用的客户'); return; }
    var body = '<div class="form-grid">' +
      field('所属客户 *', select('f_cust', cs.map(function (c) { return c.short + '（' + c.code + '）'; }), ''), true) +
      field('商机名称 *', '<input id="f_dname" placeholder="客户简称-产品-年份">', true) +
      field('销售阶段', select('f_stage', OPEN_STAGES, '初步接触')) +
      field('预计金额（元）*', '<input id="f_amt" type="number" min="0" step="1000" placeholder="如 120000">') +
      field('预计成交日', '<input id="f_exp" type="date" value="' + iso(addDays(today(), 30)) + '">') +
      field('负责人', select('f_downer', OWNERS, role.key === 'sales' ? role.user : '张伟')) +
      '</div>';
    openModal('新增商机', body,
      '<button class="btn" data-act="close">取消</button><button class="btn primary" data-act="save-deal">保存</button>');
  }
  function saveDeal() {
    var custLabel = ($('#f_cust') || {}).value || '';
    var c = S.customers.filter(function (x) { return custLabel.indexOf(x.code) >= 0; })[0];
    var name = ($('#f_dname') || {}).value || '';
    var amt = Number(($('#f_amt') || {}).value || 0);
    if (!c) { toast('请选择客户'); return; }
    if (!name.trim()) { toast('请填写商机名称'); return; }
    if (!amt) { toast('请填写预计金额'); return; }
    S.seq.d += 1;
    S.deals.unshift({
      id: 'd' + Date.now(),
      code: 'SJ-2026-' + String(1000 + S.seq.d),
      name: name.trim(),
      customerId: c.id,
      stage: $('#f_stage').value,
      amount: amt,
      expected: $('#f_exp').value || iso(addDays(today(), 30)),
      product: 'SaaS 订阅',
      owner: $('#f_downer').value,
      stageSince: iso(today())
    });
    save(); closeModal(); render(); toast('商机已创建');
  }

  function openPay(planId) {
    var p = byId(S.plans, planId);
    if (!p) return;
    var ct = contractOf(p.contractId);
    var c = customer(ct.customerId);
    var rest = Math.max(0, p.amount - planPaid(p));
    var body = '<div class="kv">' + kv('客户', c.name) + kv('合同', ct.code) +
      kv('期次', p.term) + kv('计划金额', money(p.amount)) + kv('已收', money(planPaid(p))) +
      kv('待收', money(rest)) + '</div>' +
      '<div class="form-grid">' +
      field('回款金额（元）*', '<input id="f_pay" type="number" min="0" step="100" value="' + rest + '">') +
      field('回款日期 *', '<input id="f_pdate" type="date" value="' + iso(today()) + '">') +
      field('回款方式', select('f_pmethod', PAY_METHODS, '银行转账')) +
      field('核销状态', select('f_pstatus', ['已核销', '待核销'], '已核销')) +
      '</div><div class="hint" style="margin-top:12px">演示版默认直接核销；正式系统里财务先登记「待核销」，复核后再核销。</div>';
    openModal('登记回款', body,
      '<button class="btn" data-act="close">取消</button><button class="btn primary" data-act="save-pay" data-id="' + p.id + '">保存</button>');
  }
  function savePay(planId) {
    var p = byId(S.plans, planId);
    if (!p) return;
    var amt = Number(($('#f_pay') || {}).value || 0);
    if (!amt || amt <= 0) { toast('请填写回款金额'); return; }
    S.payments.push({
      id: 'pay' + Date.now(),
      contractId: p.contractId,
      planId: p.id,
      amount: amt,
      date: $('#f_pdate').value || iso(today()),
      method: $('#f_pmethod').value,
      status: $('#f_pstatus').value
    });
    save(); closeModal(); render(); toast('回款已登记，状态已自动更新');
  }

  /* ---------------- 动作 ---------------- */
  function advanceDeal(id) {
    var d = dealOf(id);
    if (!d) return;
    var i = STAGES.indexOf(d.stage);
    if (i < 0 || i >= 4) { toast('已到终态或不可推进'); return; }
    d.stage = STAGES[i + 1];
    d.stageSince = iso(today());
    save(); closeModal(); render(); toast('已推进到「' + d.stage + '」');
  }

  function exportCsv() {
    var rows = [['合同编号', '合同名称', '客户', '合同金额', '签订日期', '状态', '负责人']];
    visibleContracts().forEach(function (ct) {
      var c = customer(ct.customerId);
      rows.push([ct.code, ct.name, c ? c.name : '', ct.amount, ct.signDate, ct.status, ct.owner]);
    });
    var csv = rows.map(function (r) {
      return r.map(function (x) {
        var s = String(x == null ? '' : x);
        return '"' + s.replace(/"/g, '""') + '"';
      }).join(',');
    }).join('\r\n');
    var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'contracts-' + iso(today()) + '.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    toast('已导出 ' + (rows.length - 1) + ' 条合同');
  }

  function resetData() {
    if (!confirm('将清除本地修改并恢复演示数据，确定吗？')) return;
    try { localStorage.removeItem(KEY); } catch (e) { }
    S = seed(); save(); closeModal(); render(); toast('已恢复演示数据');
  }

  /* ---------------- 事件 ---------------- */
  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!el) return;
    var act = el.getAttribute('data-act');
    var id = el.getAttribute('data-id');
    if (act === 'mask') { if (e.target === el) closeModal(); return; }
    if (act === 'close') { closeModal(); return; }
    if (act === 'nav') { location.hash = '#/' + el.getAttribute('data-v'); return; }
    if (act === 'goto') { location.hash = el.getAttribute('data-href'); return; }
    if (act === 'reset') { resetData(); return; }
    if (act === 'export') { exportCsv(); return; }
    if (act === 'new-customer') { newCustomer(); return; }
    if (act === 'save-customer') { saveCustomer(); return; }
    if (act === 'new-deal') { newDeal(); return; }
    if (act === 'save-deal') { saveDeal(); return; }
    if (act === 'open-customer') { openCustomer(id); return; }
    if (act === 'open-deal') { openDeal(id); return; }
    if (act === 'open-contract') { openContract(id); return; }
    if (act === 'advance') { advanceDeal(id); return; }
    if (act === 'pay') { openPay(id); return; }
    if (act === 'save-pay') { savePay(id); return; }
    if (act === 'deal-view') { dealView = el.getAttribute('data-v'); render(); return; }
    if (act === 'pay-filter') { payFilter = el.getAttribute('data-v'); render(); return; }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModal();
  });

  $('#roleSelect').addEventListener('change', function (e) {
    setRole(e.target.value);
    render();
    toast('已切换为：' + role.label);
  });

  window.addEventListener('error', function (e) {
    window.__errs = window.__errs || [];
    window.__errs.push(String(e.message || e));
  });

  /* ---------------- 启动 ---------------- */
  function init() {
    load();
    var sel = $('#roleSelect');
    sel.innerHTML = Object.keys(ROLES).map(function (k) {
      return '<option value="' + k + '">' + esc(ROLES[k].label) + '</option>';
    }).join('');
    sel.value = 'admin';
    setRole('admin');
    var m = (location.search || '').match(/role=(admin|sales|finance|viewer)/);
    if (m) { sel.value = m[1]; setRole(m[1]); }
    window.addEventListener('hashchange', render);
    render();
  }

  init();
})();
