import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  TrendingUp, DollarSign, Calendar, BarChart3,
  Search, Printer, Download, FileText, FileSpreadsheet,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  AlertCircle, RefreshCw, ArrowUpRight, Clock, CheckCircle,
  XCircle, CreditCard, Table, PieChart, ShieldOff
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { SkeletonStatsGrid, SkeletonTable } from './SkeletonLoader';
import ErrorState from './ErrorState';
import './Revenue.css';

// ─── Chart.js (loaded from CDN gracefully) ───────────────────
let Chart;
const loadChart = () =>
  new Promise((resolve) => {
    if (window.Chart) { resolve(window.Chart); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
    s.onload = () => resolve(window.Chart);
    document.head.appendChild(s);
  });

// ─── Helpers ─────────────────────────────────────────────────
const fmt = (n) =>
  `${Number(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} ETB`;

const fmtCount = (n) => (n || 0).toLocaleString('en-US');

const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const formatAxisDate = (dateStr) => {
  const d = new Date(dateStr);
  return `${months[d.getMonth()]} ${d.getDate()}`;
};
const formatAxisMonth = (key) => {
  const [y, m] = key.split('-');
  return `${months[parseInt(m,10)-1]} ${y}`;
};

const CHART_COLORS = [
  '#6366f1','#10b981','#f59e0b','#ef4444',
  '#8b5cf6','#06b6d4','#ec4899','#84cc16'
];

// ─── Mini Line Chart ─────────────────────────────────────────
const LineChartCanvas = ({ data, label, color }) => {
  const ref = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!ref.current || !data?.length) return;
    let cancelled = false;
    loadChart().then((ChartLib) => {
      if (cancelled || !ref.current) return;
      if (chartRef.current) chartRef.current.destroy();

      const ctx = ref.current.getContext('2d');
      chartRef.current = new ChartLib(ctx, {
        type: 'line',
        data: {
          labels: data.map(d => d.label),
          datasets: [{
            label,
            data: data.map(d => d.amount),
            borderColor: color || '#6366f1',
            backgroundColor: (color || '#6366f1') + '18',
            borderWidth: 2.5,
            pointRadius: data.length > 20 ? 0 : 3,
            pointHoverRadius: 5,
            fill: true,
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => ` ${ctx.raw.toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB`
              }
            }
          },
          scales: {
            x: {
              ticks: { maxTicksLimit: 8, font: { size: 10 } },
              grid: { display: false }
            },
            y: {
              ticks: {
                font: { size: 10 },
                callback: v => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v
              },
              grid: { color: 'rgba(0,0,0,0.05)' }
            }
          }
        }
      });
    });
    return () => { cancelled = true; };
  }, [data, label, color]);

  return <canvas ref={ref} />;
};

// ─── Donut / Pie Chart ────────────────────────────────────────
const PieChartCanvas = ({ data, type = 'doughnut' }) => {
  const ref = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!ref.current || !data?.length) return;
    let cancelled = false;
    loadChart().then((ChartLib) => {
      if (cancelled || !ref.current) return;
      if (chartRef.current) chartRef.current.destroy();

      const ctx = ref.current.getContext('2d');
      chartRef.current = new ChartLib(ctx, {
        type,
        data: {
          labels: data.map(d => d.label),
          datasets: [{
            data: data.map(d => d.value),
            backgroundColor: CHART_COLORS.slice(0, data.length),
            borderWidth: 2,
            borderColor: 'var(--bg-card, #fff)'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: type === 'doughnut' ? '65%' : 0,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => ` ${ctx.raw.toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB`
              }
            }
          }
        }
      });
    });
    return () => { cancelled = true; };
  }, [data, type]);

  return <canvas ref={ref} />;
};

// ─── Main Revenue Component ───────────────────────────────────
const Revenue = () => {
  const { currentUser } = useAuth();
  const role = currentUser?.role;

  // ── Permission Guard ──────────────────────────────────────
  const ALLOWED = ['admin', 'manager', 'coder'];
  if (!ALLOWED.includes(role)) {
    return (
      <div className="revenue-page">
        <div className="rev-access-denied">
          <ShieldOff size={56} style={{ color: '#ef4444', opacity: 0.5 }} />
          <h2>Access Denied</h2>
          <p>You do not have permission to view the Revenue page.</p>
        </div>
      </div>
    );
  }

  // ── State ─────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('list'); // list | analytics
  const [summary, setSummary] = useState(null);
  const [revenueList, setRevenueList] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState({ summary: true, list: true, analytics: true });
  const [error, setError] = useState({ summary: null, list: null, analytics: null });

  // Filters
  const [dateFilter, setDateFilter] = useState('all');
  const [exactDate, setExactDate] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // List controls
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);

  // Chart period
  const [chartPeriod, setChartPeriod] = useState('monthly'); // daily | weekly | monthly | yearly

  // ── API Params ────────────────────────────────────────────
  const buildParams = useCallback(() => {
    const p = { sortBy, sortOrder, page, limit: 20 };
    if (search) p.search = search;
    if (dateFilter && dateFilter !== 'all') {
      p.filter = dateFilter;
      if (dateFilter === 'exact' && exactDate) p.exact = exactDate;
      if (dateFilter === 'custom') {
        if (fromDate) p.from = fromDate;
        if (toDate) p.to = toDate;
      }
    }
    return p;
  }, [search, sortBy, sortOrder, page, dateFilter, exactDate, fromDate, toDate]);

  // ── Fetch Summary ─────────────────────────────────────────
  const fetchSummary = useCallback(async () => {
    setLoading(l => ({ ...l, summary: true }));
    setError(e => ({ ...e, summary: null }));
    try {
      const data = await api.getRevenueSummary();
      setSummary(data);
    } catch {
      setError(e => ({ ...e, summary: 'Failed to load revenue summary.' }));
    } finally {
      setLoading(l => ({ ...l, summary: false }));
    }
  }, []);

  // ── Fetch List ────────────────────────────────────────────
  const fetchList = useCallback(async () => {
    setLoading(l => ({ ...l, list: true }));
    setError(e => ({ ...e, list: null }));
    try {
      const data = await api.getRevenueList(buildParams());
      setRevenueList(data.data || []);
      setPagination(data.pagination || {});
    } catch {
      setError(e => ({ ...e, list: 'Failed to load revenue list.' }));
    } finally {
      setLoading(l => ({ ...l, list: false }));
    }
  }, [buildParams]);

  // ── Fetch Analytics ───────────────────────────────────────
  const fetchAnalytics = useCallback(async () => {
    setLoading(l => ({ ...l, analytics: true }));
    setError(e => ({ ...e, analytics: null }));
    try {
      const data = await api.getRevenueAnalytics();
      setAnalytics(data);
    } catch {
      setError(e => ({ ...e, analytics: 'Failed to load analytics.' }));
    } finally {
      setLoading(l => ({ ...l, analytics: false }));
    }
  }, []);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);
  useEffect(() => { fetchList(); }, [fetchList]);
  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, dateFilter, exactDate, fromDate, toDate]);

  // ── Sort Handler ──────────────────────────────────────────
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const SortIcon = ({ field }) => {
    if (sortBy !== field) return <ChevronDown size={12} className="sort-icon" />;
    return sortOrder === 'asc'
      ? <ChevronUp size={12} className="sort-icon" />
      : <ChevronDown size={12} className="sort-icon" />;
  };

  // ── Export Helpers ────────────────────────────────────────
  const handlePrint = () => window.print();

  const downloadFile = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const headers = ['Invoice #','Repair Order','Customer','Plate','Model','Payment Method','Amount (ETB)','Status','Payment Date','Cashier'];
    const rows = revenueList.map(r => [
      r.invoiceNumber, r.repairOrderNumber, r.customerName,
      r.vehiclePlate, r.vehicleModel, r.paymentMethod,
      r.amount, r.status,
      new Date(r.paymentDate).toLocaleDateString(),
      r.cashier
    ]);
    const csv = [headers, ...rows].map(row =>
      row.map(v => `"${String(v || '').replace(/"/g,'""')}"`).join(',')
    ).join('\n');
    downloadFile(csv, `revenue_${new Date().toISOString().slice(0,10)}.csv`, 'text/csv');
  };

  const handleExportExcel = () => {
    // Simple TSV (Excel-compatible)
    const headers = ['Invoice #','Repair Order','Customer','Plate','Model','Payment Method','Amount (ETB)','Status','Payment Date','Cashier'];
    const rows = revenueList.map(r => [
      r.invoiceNumber, r.repairOrderNumber, r.customerName,
      r.vehiclePlate, r.vehicleModel, r.paymentMethod,
      r.amount, r.status,
      new Date(r.paymentDate).toLocaleDateString(),
      r.cashier
    ]);
    const tsv = [headers, ...rows].map(row => row.join('\t')).join('\n');
    downloadFile(tsv, `revenue_${new Date().toISOString().slice(0,10)}.xls`, 'application/vnd.ms-excel');
  };

  const handleExportPDF = () => {
    const win = window.open('', '_blank');
    const rows = revenueList.map(r => `
      <tr>
        <td>${r.invoiceNumber}</td>
        <td>${r.repairOrderNumber}</td>
        <td>${r.customerName}</td>
        <td>${r.vehiclePlate}</td>
        <td>${r.vehicleModel}</td>
        <td>${r.paymentMethod}</td>
        <td style="text-align:right">${Number(r.amount).toLocaleString('en-US',{minimumFractionDigits:2})}</td>
        <td>${r.status}</td>
        <td>${new Date(r.paymentDate).toLocaleDateString()}</td>
        <td>${r.cashier}</td>
      </tr>`).join('');
    win.document.write(`
      <!DOCTYPE html><html><head>
      <title>Revenue Report</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 11px; padding: 20px; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        p { color:#666; margin:0 0 16px; }
        table { width: 100%; border-collapse: collapse; }
        th { background:#6366f1; color:white; padding:7px 8px; text-align:left; font-size:10px; }
        td { padding:6px 8px; border-bottom:1px solid #eee; }
        tr:nth-child(even) td { background:#f9fafb; }
      </style></head><body>
      <h1>Revenue Report</h1>
      <p>Generated: ${new Date().toLocaleString()} &nbsp;|&nbsp; Total Records: ${pagination.total}</p>
      <table>
        <thead><tr>
          <th>Invoice #</th><th>Repair Order</th><th>Customer</th><th>Plate</th>
          <th>Model</th><th>Payment Method</th><th>Amount (ETB)</th><th>Status</th>
          <th>Date</th><th>Cashier</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      </body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  // ── Chart Data Memoization ────────────────────────────────
  const chartData = useMemo(() => {
    if (!analytics) return null;

    const daily = (analytics.daily || []).map(d => ({
      label: formatAxisDate(d.date),
      amount: d.amount
    }));

    const weekly = (analytics.weekly || []).map(d => ({
      label: `Week of ${formatAxisDate(d.date)}`,
      amount: d.amount
    }));

    const monthly = (analytics.monthly || []).map(d => ({
      label: formatAxisMonth(d.date),
      amount: d.amount
    }));

    const yearly = (analytics.yearly || []).map(d => ({
      label: String(d.year),
      amount: d.amount
    }));

    const paymentMethods = (analytics.paymentMethods || [])
      .filter(m => m.amount > 0)
      .map((m, i) => ({
        label: m.method,
        value: m.amount,
        color: CHART_COLORS[i % CHART_COLORS.length]
      }));

    const paidVsUnpaid = analytics.paidVsUnpaid
      ? [
          { label: 'Paid', value: analytics.paidVsUnpaid.paid, color: '#10b981' },
          { label: 'Unpaid', value: analytics.paidVsUnpaid.unpaid, color: '#ef4444' }
        ]
      : [];

    const periodMap = { daily, weekly, monthly, yearly };

    return { periodMap, paymentMethods, paidVsUnpaid };
  }, [analytics]);

  // ── Summary Cards ─────────────────────────────────────────
  const renderSummary = () => {
    const cards = [
      { key: 'today',        label: 'Today\'s Revenue',     type: 'today',  value: summary?.today,        icon: <Clock size={18} />,        isAmount: true  },
      { key: 'week',         label: 'Weekly Revenue',       type: 'week',   value: summary?.week,         icon: <Calendar size={18} />,     isAmount: true  },
      { key: 'month',        label: 'Monthly Revenue',      type: 'month',  value: summary?.month,        icon: <TrendingUp size={18} />,   isAmount: true  },
      { key: 'year',         label: 'Yearly Revenue',       type: 'year',   value: summary?.year,         icon: <BarChart3 size={18} />,    isAmount: true  },
      { key: 'total',        label: 'Total Revenue',        type: 'total',  value: summary?.total,        icon: <DollarSign size={18} />,   isAmount: true  },
      { key: 'paidInvoices', label: 'Total Paid Invoices',  type: 'paid',   value: summary?.paidInvoices, icon: <CheckCircle size={18} />,  isAmount: false },
      { key: 'unpaidInvoices',label: 'Total Unpaid Invoices',type: 'unpaid', value: summary?.unpaidInvoices,icon: <XCircle size={18} />,    isAmount: false }
    ];

    if (loading.summary) {
      return <SkeletonStatsGrid count={7} />;
    }

    if (error.summary) {
      return <ErrorState message={error.summary} onRetry={fetchSummary} inline />;
    }

    return (
      <div className="revenue-summary-grid">
        {cards.map(c => (
          <div key={c.key} className={`rev-summary-card ${c.type}`}>
            <div className="rev-card-icon">{c.icon}</div>
            <div className="rev-card-label">{c.label}</div>
            <div className="rev-card-value">
              {c.isAmount
                ? fmt(c.value)
                : <>{fmtCount(c.value)} <small>invoices</small></>
              }
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ── Filter Bar ────────────────────────────────────────────
  const filterOptions = [
    { id: 'all',        label: 'All Time'    },
    { id: 'today',      label: 'Today'       },
    { id: 'yesterday',  label: 'Yesterday'   },
    { id: 'this_week',  label: 'This Week'   },
    { id: 'this_month', label: 'This Month'  },
    { id: 'this_year',  label: 'This Year'   },
    { id: 'exact',      label: 'Specific Day'},
    { id: 'custom',     label: 'Custom Range'}
  ];

  const renderFilters = () => (
    <div className="revenue-filter-bar">
      <label>Filter:</label>
      <div className="filter-btn-group">
        {filterOptions.map(f => (
          <button
            key={f.id}
            className={`filter-btn ${dateFilter === f.id ? 'active' : ''}`}
            onClick={() => setDateFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>
      {dateFilter === 'exact' && (
        <div className="filter-date-inputs">
          <input
            type="date"
            value={exactDate}
            onChange={e => setExactDate(e.target.value)}
          />
        </div>
      )}
      {dateFilter === 'custom' && (
        <div className="filter-date-inputs">
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>From</span>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>To</span>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
        </div>
      )}
      <button
        className="rev-export-btn"
        style={{ marginLeft: 'auto', color: 'var(--primary)', borderColor: 'var(--primary)' }}
        onClick={() => { fetchSummary(); fetchList(); fetchAnalytics(); }}
        title="Refresh data"
      >
        <RefreshCw size={14} />
        <span>Refresh</span>
      </button>
    </div>
  );

  // ── Revenue List ──────────────────────────────────────────
  const renderList = () => (
    <>
      {/* Controls */}
      <div className="revenue-controls">
        <div className="rev-search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search invoice, customer, plate, order..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="rev-export-group">
          <button className="rev-export-btn print" onClick={handlePrint}>
            <Printer size={14} /><span>Print</span>
          </button>
          <button className="rev-export-btn pdf" onClick={handleExportPDF}>
            <FileText size={14} /><span>PDF</span>
          </button>
          <button className="rev-export-btn excel" onClick={handleExportExcel}>
            <FileSpreadsheet size={14} /><span>Excel</span>
          </button>
          <button className="rev-export-btn csv" onClick={handleExportCSV}>
            <Download size={14} /><span>CSV</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="revenue-table-wrapper">
        {loading.list ? (
          <div className="rev-loading-state">
            <div className="loader-spinner" />
            <p>Loading revenue data…</p>
          </div>
        ) : error.list ? (
          <div className="rev-error-state">
            <AlertCircle size={40} />
            <p>{error.list}</p>
            <button className="btn-primary" onClick={fetchList}>Retry</button>
          </div>
        ) : revenueList.length === 0 ? (
          <div className="rev-empty-state">
            <DollarSign size={56} />
            <p>No revenue records found for the selected period.</p>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="revenue-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('orderId')} className={sortBy === 'orderId' ? 'sorted' : ''}>
                      Invoice # <SortIcon field="orderId" />
                    </th>
                    <th>Repair Order #</th>
                    <th onClick={() => handleSort('customerName')} className={sortBy === 'customerName' ? 'sorted' : ''}>
                      Customer <SortIcon field="customerName" />
                    </th>
                    <th>Plate No.</th>
                    <th>Vehicle Model</th>
                    <th>Payment Method</th>
                    <th onClick={() => handleSort('totalAmount')} className={sortBy === 'totalAmount' ? 'sorted' : ''} style={{ textAlign: 'right' }}>
                      Amount (ETB) <SortIcon field="totalAmount" />
                    </th>
                    <th>Status</th>
                    <th onClick={() => handleSort('createdAt')} className={sortBy === 'createdAt' ? 'sorted' : ''}>
                      Payment Date <SortIcon field="createdAt" />
                    </th>
                    <th>Cashier</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueList.map((r, idx) => (
                    <tr key={r.id || idx}>
                      <td className="invoice-id-cell">{r.invoiceNumber}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{r.repairOrderNumber}</td>
                      <td style={{ fontWeight: 600 }}>{r.customerName}</td>
                      <td>{r.vehiclePlate}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{r.vehicleModel}</td>
                      <td>
                        <span className="rev-payment-badge">
                          <CreditCard size={10} />
                          {r.paymentMethod}
                        </span>
                      </td>
                      <td className="amount-cell" style={{ textAlign: 'right' }}>
                        {Number(r.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td>
                        <span className="rev-status-badge paid">
                          <CheckCircle size={10} style={{ marginRight: 4 }} />
                          Paid
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                        {new Date(r.paymentDate).toLocaleDateString('en-US', {
                          year: 'numeric', month: 'short', day: 'numeric'
                        })}
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{r.cashier}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="rev-pagination">
              <span className="rev-pagination-info">
                Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} records
              </span>
              <div className="rev-pagination-controls">
                <button
                  className="rev-page-btn"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
                  const p = i + Math.max(1, pagination.page - 3);
                  if (p > pagination.totalPages) return null;
                  return (
                    <button
                      key={p}
                      className={`rev-page-btn ${pagination.page === p ? 'active' : ''}`}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  className="rev-page-btn"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );

  // ── Analytics Tab ─────────────────────────────────────────
  const renderAnalytics = () => {
    if (loading.analytics) {
      return (
        <div className="rev-loading-state">
          <div className="loader-spinner" />
          <p>Loading analytics…</p>
        </div>
      );
    }
    if (error.analytics) {
      return (
        <div className="rev-error-state">
          <AlertCircle size={40} />
          <p>{error.analytics}</p>
          <button className="btn-primary" onClick={fetchAnalytics}>Retry</button>
        </div>
      );
    }
    if (!chartData) return null;

    const currentChartData = chartData.periodMap[chartPeriod] || [];

    return (
      <>
        {/* Revenue trend chart */}
        <div className="rev-chart-card" style={{ marginBottom: 20 }}>
          <h3><TrendingUp size={16} /> Revenue Trend</h3>
          <div className="chart-period-tabs">
            {['daily','weekly','monthly','yearly'].map(p => (
              <button
                key={p}
                className={`chart-period-btn ${chartPeriod === p ? 'active' : ''}`}
                onClick={() => setChartPeriod(p)}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          <div className="rev-chart-canvas-wrapper">
            {currentChartData.length === 0 ? (
              <div className="rev-empty-state" style={{ padding: '24px' }}>
                <BarChart3 size={36} />
                <p>No revenue data for this period.</p>
              </div>
            ) : (
              <LineChartCanvas
                key={chartPeriod}
                data={currentChartData}
                label="Revenue (ETB)"
                color="#6366f1"
              />
            )}
          </div>
        </div>

        {/* Pie + Donut */}
        <div className="revenue-analytics-grid">
          <div className="rev-chart-card">
            <h3><PieChart size={16} /> Payment Method Breakdown</h3>
            <div className="rev-chart-canvas-wrapper" style={{ height: 200 }}>
              {(chartData.paymentMethods || []).length === 0 ? (
                <div className="rev-empty-state" style={{ padding: '16px' }}>
                  <PieChart size={28} />
                  <p>No payment data.</p>
                </div>
              ) : (
                <PieChartCanvas data={chartData.paymentMethods} type="pie" />
              )}
            </div>
            {chartData.paymentMethods.length > 0 && (
              <div className="rev-chart-legend">
                {chartData.paymentMethods.map((m, i) => (
                  <div key={m.label} className="rev-legend-item">
                    <span className="rev-legend-dot" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span>{m.label}</span>
                    <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {Number(m.value).toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rev-chart-card">
            <h3><ArrowUpRight size={16} /> Paid vs Unpaid</h3>
            <div className="rev-chart-canvas-wrapper" style={{ height: 200 }}>
              {(chartData.paidVsUnpaid || []).every(d => d.value === 0) ? (
                <div className="rev-empty-state" style={{ padding: '16px' }}>
                  <BarChart3 size={28} />
                  <p>No invoice data.</p>
                </div>
              ) : (
                <PieChartCanvas data={chartData.paidVsUnpaid} type="doughnut" />
              )}
            </div>
            {(chartData.paidVsUnpaid || []).length > 0 && (
              <div className="rev-chart-legend">
                {chartData.paidVsUnpaid.map((m) => (
                  <div key={m.label} className="rev-legend-item">
                    <span className="rev-legend-dot" style={{ background: m.color }} />
                    <span>{m.label}</span>
                    <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {Number(m.value).toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </>
    );
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="revenue-page">
      {/* Header */}
      <div className="revenue-header">
        <div className="revenue-header-left">
          <h1>Revenue</h1>
          <p>Track income, invoices, and financial performance across all periods.</p>
        </div>
        <div className="revenue-header-right">
          <button
            className={`rev-tab ${activeTab === 'list' ? 'active' : ''}`}
            onClick={() => setActiveTab('list')}
          >
            <Table size={16} /> Revenue List
          </button>
          <button
            className={`rev-tab ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <BarChart3 size={16} /> Analytics
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {renderSummary()}

      {/* Date Filters */}
      {renderFilters()}

      {/* Tab Content */}
      {activeTab === 'list' ? renderList() : renderAnalytics()}
    </div>
  );
};

export default Revenue;
