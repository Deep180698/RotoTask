import React, { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard, ClipboardList, ScanLine, MapPin, Package,
  Repeat2, FileSpreadsheet, Settings, Search, Plus, RefreshCw,
  Download, Upload, Warehouse, CheckCircle2, AlertTriangle,
  Boxes, Save
} from 'lucide-react';
import * as XLSX from 'xlsx';

const API = '/api';

async function request(path, options = {}) {
  const response = await fetch(API + path, options);

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Request failed: ${response.status}`);
  }

  if (
    (response.headers.get('content-type') || '').includes(
      'spreadsheet'
    )
  ) {
    return response.blob();
  }

  return response.json();
}

const number = (value) =>
  value == null ? '—' : Number(value).toLocaleString();

const navigation = [
  ['Dashboard', LayoutDashboard],
  ['Inventory Sessions', ClipboardList],
  ['Count Inventory', ScanLine],
  ['Bin Locations', MapPin],
  ['Inventory Items', Package],
  ['Recount Queue', Repeat2],
  ['Reports & Excel', FileSpreadsheet],
  ['Settings', Settings]
];

function statusFor(item) {
  if (item.reviewed) return 'Reviewed';

  if (item.finalApprovedQty != null) return 'Approved';

  const counts = item.counts || [];
  if (!counts.length) return 'Awaiting First Count';

  const last = counts.find(
    (count) =>
      count.stage === Math.max(...counts.map((c) => c.stage))
  );

  if (last.quantity === item.systemQty) return 'Matching';
  if (last.stage === 1) return 'Second Count Required';
  if (last.stage === 2) return 'Third Count Required';

  return 'Awaiting Review';
}

export default function App() {
  const [page, setPage] = useState('Dashboard');
  const [warehouse, setWarehouse] = useState('all');
  const [sessionId, setSessionId] = useState('');
  const [search, setSearch] = useState('');

  const [items, setItems] = useState([]);
  const [bins, setBins] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [apiStatus, setApiStatus] = useState('Checking');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [countStage, setCountStage] = useState('1');
  const [countedBy, setCountedBy] = useState('Warehouse User');
  const [selectedBin, setSelectedBin] = useState('');

  const [showItemForm, setShowItemForm] = useState(false);
  const [showBinForm, setShowBinForm] = useState(false);
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [reviewItem, setReviewItem] = useState(null);

  const [itemForm, setItemForm] = useState({
    warehouse: '20',
    binCode: '',
    itemNumber: '',
    description: '',
    systemQty: '',
    sessionId: ''
  });

  const [binForm, setBinForm] = useState({
    warehouse: '20',
    code: '',
    description: ''
  });

  const [sessionForm, setSessionForm] = useState({
    name: 'Annual Inventory Count 2026',
    startDate: new Date().toISOString().slice(0, 10),
    warehouses: ['20', '28']
  });

  const [countInputs, setCountInputs] = useState({});
  const [comments, setComments] = useState({});
  const [finalQty, setFinalQty] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [importResult, setImportResult] = useState(null);

  async function load() {
    setLoading(true);
    setError('');

    try {
      const [warehouseData, binData, itemData, sessionData, health] =
        await Promise.all([
          request('/warehouses'),
          request('/bins'),
          request('/items'),
          request('/sessions'),
          request('/health')
        ]);

      setBins(binData);
      setItems(itemData);
      setSessions(sessionData);
      setApiStatus(health.database);

      if (!sessionId && sessionData.length) {
        setSessionId(String(sessionData[0]._id));
      }
    } catch (err) {
      setError(err.message);
      setApiStatus('disconnected');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesWarehouse =
        warehouse === 'all' || item.warehouse === warehouse;

      const matchesSession =
        !sessionId ||
        !item.sessionId ||
        String(item.sessionId) === sessionId;

      const text = [
        item.itemNumber,
        item.binCode,
        item.description
      ].join(' ').toLowerCase();

      return (
        matchesWarehouse &&
        matchesSession &&
        text.includes(search.toLowerCase())
      );
    });
  }, [items, warehouse, sessionId, search]);

  const counted = items.filter(
    (item) => item.counts?.some((count) => count.stage === 1)
  ).length;

  const progress = items.length
    ? Math.round((counted / items.length) * 100)
    : 0;

  const recountItems = filteredItems.filter((item) =>
    [
      'Second Count Required',
      'Third Count Required',
      'Awaiting Review'
    ].includes(statusFor(item))
  );

  const visibleBins = bins.filter((bin) => {
    return (
      (warehouse === 'all' || bin.warehouse === warehouse) &&
      bin.code.toLowerCase().includes(search.toLowerCase())
    );
  });

  const binItems = filteredItems.filter(
    (item) =>
      item.binCode === selectedBin &&
      (warehouse === 'all' || item.warehouse === warehouse)
  );

  async function perform(action, successMessage) {
    try {
      await action();
      setError('');
      setMessage(successMessage);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function createSession() {
    await perform(async () => {
      const session = await request('/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionForm)
      });

      setSessions((old) => [session, ...old]);
      setSessionId(String(session._id));
      setShowSessionForm(false);
    }, 'Inventory session created.');
  }

  async function createBin() {
    await perform(async () => {
      const bin = await request('/bins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(binForm)
      });

      setBins((old) => [...old, bin]);
      setSelectedBin(bin.code);
      setBinForm({
        warehouse: binForm.warehouse,
        code: '',
        description: ''
      });
      setShowBinForm(false);
    }, 'Bin location created.');
  }

  async function createItem() {
    await perform(async () => {
      const data = {
        ...itemForm,
        sessionId: itemForm.sessionId || sessionId || null
      };

      await request('/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      setShowItemForm(false);
      setItemForm({
        warehouse: '20',
        binCode: '',
        itemNumber: '',
        description: '',
        systemQty: '',
        sessionId: ''
      });
    }, 'Inventory item created.');
  }

  async function saveCount(item) {
    const quantity = countInputs[item._id];

    if (
      quantity === '' ||
      quantity == null ||
      !Number.isFinite(Number(quantity)) ||
      Number(quantity) < 0
    ) {
      setError('Enter a valid, non-negative physical quantity.');
      return;
    }

    await perform(async () => {
      await request(`/items/${item._id}/count`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: Number(countStage),
          quantity: Number(quantity),
          countedBy,
          comment: comments[item._id] || ''
        })
      });

      setCountInputs((old) => ({
        ...old,
        [item._id]: ''
      }));
    }, `Count ${countStage} saved.`);
  }

  async function approveQuantity() {
    if (
      finalQty === '' ||
      !Number.isFinite(Number(finalQty)) ||
      Number(finalQty) < 0
    ) {
      setError('Enter a valid approved quantity.');
      return;
    }

    await perform(async () => {
      await request(`/items/${reviewItem._id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          finalApprovedQty: Number(finalQty),
          comments: reviewComment
        })
      });

      setReviewItem(null);
    }, 'Final quantity approved.');
  }

  async function importInventory(file) {
    if (!file) return;

    await perform(async () => {
      const form = new FormData();
      form.append('file', file);

      const result = await request('/import', {
        method: 'POST',
        body: form
      });

      setImportResult(result);
    }, 'Import finished.');
  }

  async function loadDemo() {
    await perform(
      () => request('/demo', { method: 'POST' }),
      'Demo data loaded.'
    );
  }

  async function resetDemo() {
    if (!window.confirm('Delete demo records only?')) return;

    await perform(
      () => request('/demo', { method: 'DELETE' }),
      'Demo records removed.'
    );
  }

  async function exportExcel() {
    try {
      const query = new URLSearchParams();

      if (warehouse !== 'all') query.set('warehouse', warehouse);
      if (sessionId) query.set('sessionId', sessionId);

      const blob = await request('/export?' + query.toString());
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = 'inventory-count-results.xlsx';
      link.click();

      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  }

  function exportFilteredExcel() {
    const rows = filteredItems.map((item) => ({
      Warehouse: item.warehouse,
      'Bin Location': item.binCode,
      'Item Number': item.itemNumber,
      Description: item.description || '',
      'System Quantity': item.systemQty,
      'First Count':
        item.counts?.find((c) => c.stage === 1)?.quantity ?? '',
      'Second Count':
        item.counts?.find((c) => c.stage === 2)?.quantity ?? '',
      'Third Count':
        item.counts?.find((c) => c.stage === 3)?.quantity ?? '',
      'Final Approved Quantity': item.finalApprovedQty ?? '',
      Status: statusFor(item)
    }));

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(rows),
      'Inventory'
    );

    XLSX.writeFile(workbook, 'inventory-filtered-results.xlsx');
  }

  function button(label, action, primary = false) {
    return (
      <button
        className={`btn ${primary ? 'primary' : ''}`}
        onClick={action}
      >
        {label}
      </button>
    );
  }

  function filters() {
    return (
      <div className="toolbar">
        <select
          value={warehouse}
          onChange={(event) => setWarehouse(event.target.value)}
        >
          <option value="all">Both warehouses</option>
          <option value="20">Warehouse 20</option>
          <option value="28">Warehouse 28</option>
        </select>

        <select
          value={sessionId}
          onChange={(event) => setSessionId(event.target.value)}
        >
          <option value="">All sessions / unassigned</option>
          {sessions.map((session) => (
            <option key={session._id} value={session._id}>
              {session.name}
            </option>
          ))}
        </select>

        <label className="searchbox">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search item, description or bin"
          />
        </label>
      </div>
    );
  }

  function itemTable(rows) {
    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Warehouse / Bin</th>
              <th>Item</th>
              <th>System Qty</th>
              <th>Count 1</th>
              <th>Count 2</th>
              <th>Count 3</th>
              <th>Status</th>
              <th>Review</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item._id}>
                <td>
                  WH {item.warehouse}
                  <small>{item.binCode}</small>
                </td>
                <td>
                  <b>{item.itemNumber}</b>
                  <small>{item.description}</small>
                </td>
                <td>{number(item.systemQty)}</td>
                {[1, 2, 3].map((stage) => (
                  <td key={stage}>
                    {item.counts?.find((c) => c.stage === stage)
                      ?.quantity ?? '—'}
                  </td>
                ))}
                <td>
                  <span className="status">
                    {statusFor(item)}
                  </span>
                </td>
                <td>
                  <button
                    className="btn small"
                    onClick={() => {
                      setReviewItem(item);
                      setFinalQty(
                        String(
                          item.finalApprovedQty ??
                          item.counts?.at(-1)?.quantity ??
                          item.systemQty
                        )
                      );
                      setReviewComment(item.comments || '');
                    }}
                  >
                    Review
                  </button>
                </td>
              </tr>
            ))}

            {!rows.length && (
              <tr>
                <td colSpan="8" className="empty">
                  No inventory records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  function countCards(rows) {
    return rows.map((item) => {
      const savedCount = item.counts?.find(
        (count) => count.stage === Number(countStage)
      );

      return (
        <div className="panel count-card" key={item._id}>
          <div className="between">
            <div>
              <span className="muted">
                Warehouse {item.warehouse} · Bin {item.binCode}
              </span>
              <h3>{item.itemNumber}</h3>
              <p>{item.description}</p>
            </div>

            <span className="status">{statusFor(item)}</span>
          </div>

          <p>
            System quantity: <b>{number(item.systemQty)}</b>
          </p>

          <p>
            Previous counts:{' '}
            {item.counts?.length
              ? item.counts
                  .map((c) => `C${c.stage}: ${c.quantity}`)
                  .join(' · ')
              : 'None'}
          </p>

          <div className="count-entry">
            <label>
              Physical count {countStage}
              <input
                type="number"
                min="0"
                step="any"
                disabled={Boolean(savedCount)}
                value={
                  savedCount
                    ? savedCount.quantity
                    : countInputs[item._id] ?? ''
                }
                onChange={(event) =>
                  setCountInputs({
                    ...countInputs,
                    [item._id]: event.target.value
                  })
                }
              />
            </label>

            <label>
              Counted by
              <input
                value={countedBy}
                onChange={(event) => setCountedBy(event.target.value)}
                disabled={Boolean(savedCount)}
              />
            </label>

            <label>
              Comments
              <input
                value={comments[item._id] || ''}
                onChange={(event) =>
                  setComments({
                    ...comments,
                    [item._id]: event.target.value
                  })
                }
                disabled={Boolean(savedCount)}
              />
            </label>

            <button
              className="btn primary"
              disabled={Boolean(savedCount)}
              onClick={() => saveCount(item)}
            >
              <Save size={15} />
              {savedCount ? 'Count saved' : 'Save count'}
            </button>
          </div>
        </div>
      );
    });
  }

  let content;

  if (page === 'Dashboard') {
    content = (
      <>
        <div className="page-heading">
          <div>
            <h1>Inventory Dashboard</h1>
            <p>Annual physical inventory count overview.</p>
          </div>
          {button('New session', () => setShowSessionForm(true), true)}
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <Warehouse />
            <span>Warehouses</span>
            <strong>2</strong>
            <small>Warehouse 20 and 28</small>
          </div>

          <div className="stat-card">
            <MapPin />
            <span>Bin locations</span>
            <strong>{bins.length}</strong>
          </div>

          <div className="stat-card">
            <Boxes />
            <span>Inventory items</span>
            <strong>{items.length}</strong>
          </div>

          <div className="stat-card">
            <CheckCircle2 />
            <span>First count complete</span>
            <strong>{progress}%</strong>
            <small>{counted} of {items.length} items</small>
          </div>
        </div>

        <div className="panel">
          <h2>Counting progress</h2>
          <div className="progress">
            <span style={{ width: `${progress}%` }} />
          </div>
          <p>{progress}% of inventory items have a first count.</p>
        </div>

        <div className="panel">
          <h2>Items needing attention</h2>
          <p>
            <AlertTriangle size={16} /> {recountItems.length} items
            need a recount or review.
          </p>
          {button('Open recount queue', () => setPage('Recount Queue'))}
        </div>

        {filters()}
        <div className="panel">
          <h2>Inventory items</h2>
          {itemTable(filteredItems.slice(0, 10))}
        </div>
      </>
    );
  } else if (page === 'Inventory Sessions') {
    content = (
      <>
        <div className="page-heading">
          <h1>Inventory Sessions</h1>
          {button('Create session', () => setShowSessionForm(true), true)}
        </div>

        {sessions.map((session) => (
          <div className="panel" key={session._id}>
            <h3>{session.name}</h3>
            <p>
              Start date: {session.startDate || 'Not set'} ·
              Warehouses: {session.warehouses?.join(', ')}
            </p>
            <p>Status: {session.status}</p>
            <button
              className="btn primary"
              onClick={() => {
                setSessionId(String(session._id));
                setPage('Count Inventory');
              }}
            >
              Open count
            </button>
          </div>
        ))}
      </>
    );
  } else if (page === 'Count Inventory') {
    content = (
      <>
        <div className="page-heading">
          <div>
            <h1>Count Inventory</h1>
            <p>Record physical quantities by bin location.</p>
          </div>
          {button('Add bin', () => setShowBinForm(true))}
        </div>

        {filters()}

        <div className="toolbar">
          <label>
            Count stage
            <select
              value={countStage}
              onChange={(event) => setCountStage(event.target.value)}
            >
              <option value="1">First Count</option>
              <option value="2">Second Count</option>
              <option value="3">Third Count</option>
            </select>
          </label>
        </div>

        <div className="count-layout">
          <div className="panel">
            <h2>Bin locations</h2>

            {visibleBins.map((bin) => (
              <button
                className={`bin-option ${
                  selectedBin === bin.code ? 'active' : ''
                }`}
                key={bin._id}
                onClick={() => setSelectedBin(bin.code)}
              >
                <MapPin size={16} />
                Warehouse {bin.warehouse} · {bin.code}
              </button>
            ))}
          </div>

          <div>
            <div className="panel">
              <h2>Bin {selectedBin || '—'}</h2>
              {button('Add item', () => {
                const bin = bins.find((b) => b.code === selectedBin);
                setItemForm({
                  ...itemForm,
                  warehouse: bin?.warehouse || '20',
                  binCode: selectedBin,
                  sessionId
                });
                setShowItemForm(true);
              })}
            </div>

            {countCards(binItems)}
          </div>
        </div>
      </>
    );
  } else if (page === 'Bin Locations') {
    content = (
      <>
        <div className="page-heading">
          <h1>Bin Locations</h1>
          {button('Add bin', () => setShowBinForm(true), true)}
        </div>
        {filters()}
        <div className="panel">
          {visibleBins.map((bin) => (
            <p key={bin._id}>
              Warehouse {bin.warehouse} · {bin.code}
              {bin.description ? ` — ${bin.description}` : ''}
            </p>
          ))}
        </div>
      </>
    );
  } else if (page === 'Inventory Items') {
    content = (
      <>
        <div className="page-heading">
          <h1>Inventory Items</h1>
          {button('Add item', () => setShowItemForm(true), true)}
        </div>
        {filters()}
        <div className="panel">{itemTable(filteredItems)}</div>
      </>
    );
  } else if (page === 'Recount Queue') {
    content = (
      <>
        <div className="page-heading">
          <h1>Recount Queue</h1>
          <p>Items with discrepancies or awaiting review.</p>
        </div>
        {filters()}
        <div className="panel">{itemTable(recountItems)}</div>
      </>
    );
  } else if (page === 'Reports & Excel') {
    content = (
      <>
        <div className="page-heading">
          <h1>Reports & Excel</h1>
          {button('Export full report', exportExcel, true)}
        </div>

        <div className="panel">
          <h2>Import inventory spreadsheet</h2>
          <p>
            Required columns: Warehouse, Bin Location, Item Number,
            and System Quantity. Description is optional.
          </p>

          <label>
            Select Excel or CSV file
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(event) =>
                importInventory(event.target.files?.[0])
              }
            />
          </label>

          {importResult && (
            <p>
              Imported {importResult.imported} rows.
              {importResult.errors?.length
                ? ` ${importResult.errors.length} row(s) need attention.`
                : ''}
            </p>
          )}
        </div>

        <div className="panel">
          <h2>Export filtered items</h2>
          <button className="btn" onClick={exportFilteredExcel}>
            <Download size={15} /> Export filtered Excel
          </button>
        </div>
      </>
    );
  } else {
    content = (
      <>
        <div className="page-heading">
          <h1>Settings</h1>
        </div>

        <div className="panel">
          <p>Database status: <b>{apiStatus}</b></p>
          <button className="btn" onClick={load}>
            <RefreshCw size={15} /> Refresh connection
          </button>
        </div>

        <div className="panel">
          <h2>Demo data</h2>
          <button className="btn primary" onClick={loadDemo}>
            Load demo data
          </button>
          <button className="btn" onClick={resetDemo}>
            Reset demo data
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <Boxes size={25} />
          <div>
            <b>StockCount</b>
            <small>WAREHOUSE CONTROL</small>
          </div>
        </div>

        <nav>
          {navigation.map(([label, Icon]) => (
            <button
              key={label}
              className={`nav-item ${page === label ? 'selected' : ''}`}
              onClick={() => {
                setPage(label);
                setSearch('');
              }}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <small>Database: {apiStatus}</small>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <span>Warehouse Operations / {page}</span>
          <span className="demo-pill">INVENTORY BETA</span>
        </header>

        <div className="page-content">
          {error && (
            <div className="alert error">
              {error}
              <button onClick={() => setError('')}>×</button>
            </div>
          )}

          {message && (
            <div className="alert success">
              {message}
              <button onClick={() => setMessage('')}>×</button>
            </div>
          )}

          {loading ? <p>Loading inventory data…</p> : content}
        </div>

        <footer>
          StockCount · Annual Inventory Count · MongoDB
        </footer>
      </main>

      {showSessionForm && (
        <div className="modal-backdrop">
          <form
            className="modal"
            onSubmit={(event) => {
              event.preventDefault();
              createSession();
            }}
          >
            <h2>Create inventory session</h2>

            <label>
              Session name
              <input
                required
                value={sessionForm.name}
                onChange={(event) =>
                  setSessionForm({
                    ...sessionForm,
                    name: event.target.value
                  })
                }
              />
            </label>

            <label>
              Start date
              <input
                type="date"
                value={sessionForm.startDate}
                onChange={(event) =>
                  setSessionForm({
                    ...sessionForm,
                    startDate: event.target.value
                  })
                }
              />
            </label>

            <div className="modal-actions">
              <button type="button" onClick={() => setShowSessionForm(false)}>
                Cancel
              </button>
              <button type="submit" className="primary">
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {showBinForm && (
        <div className="modal-backdrop">
          <form
            className="modal"
            onSubmit={(event) => {
              event.preventDefault();
              createBin();
            }}
          >
            <h2>Add bin location</h2>

            <label>
              Warehouse
              <select
                value={binForm.warehouse}
                onChange={(event) =>
                  setBinForm({
                    ...binForm,
                    warehouse: event.target.value
                  })
                }
              >
                <option value="20">Warehouse 20</option>
                <option value="28">Warehouse 28</option>
              </select>
            </label>

            <label>
              Bin code
              <input
                required
                value={binForm.code}
                onChange={(event) =>
                  setBinForm({
                    ...binForm,
                    code: event.target.value
                  })
                }
              />
            </label>

            <label>
              Description
              <input
                value={binForm.description}
                onChange={(event) =>
                  setBinForm({
                    ...binForm,
                    description: event.target.value
                  })
                }
              />
            </label>

            <div className="modal-actions">
              <button type="button" onClick={() => setShowBinForm(false)}>
                Cancel
              </button>
              <button type="submit" className="primary">
                Save bin
              </button>
            </div>
          </form>
        </div>
      )}

      {showItemForm && (
        <div className="modal-backdrop">
          <form
            className="modal"
            onSubmit={(event) => {
              event.preventDefault();
              createItem();
            }}
          >
            <h2>Add inventory item</h2>

            <label>
              Warehouse
              <select
                value={itemForm.warehouse}
                onChange={(event) =>
                  setItemForm({
                    ...itemForm,
                    warehouse: event.target.value,
                    binCode: ''
                  })
                }
              >
                <option value="20">Warehouse 20</option>
                <option value="28">Warehouse 28</option>
              </select>
            </label>

            <label>
              Bin location
              <select
                required
                value={itemForm.binCode}
                onChange={(event) =>
                  setItemForm({
                    ...itemForm,
                    binCode: event.target.value
                  })
                }
              >
                <option value="">Select a bin</option>
                {bins
                  .filter((bin) => bin.warehouse === itemForm.warehouse)
                  .map((bin) => (
                    <option key={bin._id} value={bin.code}>
                      {bin.code}
                    </option>
                  ))}
              </select>
            </label>

            <label>
              Item number
              <input
                required
                value={itemForm.itemNumber}
                onChange={(event) =>
                  setItemForm({
                    ...itemForm,
                    itemNumber: event.target.value
                  })
                }
              />
            </label>

            <label>
              Description
              <input
                value={itemForm.description}
                onChange={(event) =>
                  setItemForm({
                    ...itemForm,
                    description: event.target.value
                  })
                }
              />
            </label>

            <label>
              System quantity
              <input
                required
                type="number"
                min="0"
                step="any"
                value={itemForm.systemQty}
                onChange={(event) =>
                  setItemForm({
                    ...itemForm,
                    systemQty: event.target.value
                  })
                }
              />
            </label>

            <label>
              Session
              <select
                value={itemForm.sessionId}
                onChange={(event) =>
                  setItemForm({
                    ...itemForm,
                    sessionId: event.target.value
                  })
                }
              >
                <option value="">Use selected session</option>
                {sessions.map((session) => (
                  <option key={session._id} value={session._id}>
                    {session.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="modal-actions">
              <button type="button" onClick={() => setShowItemForm(false)}>
                Cancel
              </button>
              <button type="submit" className="primary">
                Save item
              </button>
            </div>
          </form>
        </div>
      )}

      {reviewItem && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>Review final quantity</h2>
            <p>
              {reviewItem.itemNumber} · Warehouse {reviewItem.warehouse}
              {' · '}Bin {reviewItem.binCode}
            </p>
            <p>System quantity: {reviewItem.systemQty}</p>

            <label>
              Final approved physical quantity
              <input
                type="number"
                min="0"
                value={finalQty}
                onChange={(event) => setFinalQty(event.target.value)}
              />
            </label>

            <label>
              Review comments
              <textarea
                rows="3"
                value={reviewComment}
                onChange={(event) => setReviewComment(event.target.value)}
              />
            </label>

            <div className="modal-actions">
              <button onClick={() => setReviewItem(null)}>Cancel</button>
              <button className="primary" onClick={approveQuantity}>
                Approve quantity
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}