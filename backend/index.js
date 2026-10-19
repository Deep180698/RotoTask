import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import multer from 'multer';
import XLSX from 'xlsx';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

const { Schema } = mongoose;

const warehouseSchema = new Schema({
  code: { type: String, required: true },
  name: { type: String, required: true }
}, { timestamps: true });

warehouseSchema.index({ code: 1 }, { unique: true });

const binSchema = new Schema({
  warehouse: { type: String, required: true },
  code: { type: String, required: true },
  description: String,
  isDemo: { type: Boolean, default: false }
}, { timestamps: true });

binSchema.index({ warehouse: 1, code: 1 }, { unique: true });

const itemSchema = new Schema({
  warehouse: { type: String, required: true },
  binCode: { type: String, required: true },
  itemNumber: { type: String, required: true },
  description: String,
  systemQty: { type: Number, required: true, min: 0 },

  counts: {
    type: [{
      stage: Number,
      quantity: Number,
      countedBy: String,
      countedAt: Date,
      comment: String
    }],
    default: []
  },

  finalApprovedQty: { type: Number, default: null },
  reviewed: { type: Boolean, default: false },
  comments: String,

  sessionId: {
    type: Schema.Types.ObjectId,
    ref: 'Session',
    default: null
  },

  isDemo: { type: Boolean, default: false }
}, { timestamps: true });

itemSchema.index(
  { warehouse: 1, binCode: 1, itemNumber: 1, sessionId: 1 },
  { unique: true }
);

const sessionSchema = new Schema({
  name: { type: String, required: true },

  warehouses: [{
    type: String,
    enum: ['20', '28']
  }],

  startDate: { type: String, default: '' },

  status: {
    type: String,
    enum: [
      'Not Started',
      'In Progress',
      'Under Review',
      'Completed'
    ],
    default: 'Not Started'
  },

  isDemo: { type: Boolean, default: false }
}, { timestamps: true });

const Warehouse = mongoose.model('Warehouse', warehouseSchema);
const Bin = mongoose.model('Bin', binSchema);
const Item = mongoose.model('Item', itemSchema);
const Session = mongoose.model('Session', sessionSchema);

const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const num = (v) =>
  Number.isFinite(Number(v)) && Number(v) >= 0;

const variance = (item, stage) => {
  const c = (item.counts || []).find((x) => x.stage === stage);
  return c ? c.quantity - item.systemQty : null;
};

const statusOf = (item) => {
  const counts = [...(item.counts || [])]
    .sort((a, b) => a.stage - b.stage);

  if (item.reviewed) return 'Reviewed';

  if (
    item.finalApprovedQty !== null &&
    item.finalApprovedQty !== undefined
  ) {
    return 'Approved';
  }

  if (!counts.length) return 'Awaiting First Count';

  const last = counts[counts.length - 1];

  if (last.quantity !== item.systemQty) {
    if (last.stage === 1) return 'Second Count Required';
    if (last.stage === 2) return 'Third Count Required';
    return 'Awaiting Review';
  }

  return 'Matching';
};

const itemOut = (item) => {
  const x = item.toObject ? item.toObject() : item;

  return {
    ...x,
    status: statusOf(x),
    variance1: variance(x, 1),
    variance2: variance(x, 2),
    variance3: variance(x, 3),
    finalVariance:
      x.finalApprovedQty == null
        ? null
        : x.finalApprovedQty - x.systemQty
  };
};

// Health check and warehouses

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    database:
      mongoose.connection.readyState === 1
        ? 'connected'
        : 'disconnected'
  });
});

app.get('/api/warehouses', wrap(async (req, res) => {
  res.json(await Warehouse.find().sort({ code: 1 }));
}));

// Bin locations

app.get('/api/bins', wrap(async (req, res) => {
  const q = {};

  if (req.query.warehouse) {
    q.warehouse = req.query.warehouse;
  }

  if (req.query.search) {
    q.code = {
      $regex: String(req.query.search),
      $options: 'i'
    };
  }

  res.json(await Bin.find(q).sort({ warehouse: 1, code: 1 }));
}));

app.post('/api/bins', wrap(async (req, res) => {
  const {
    warehouse,
    code,
    description = ''
  } = req.body;

  if (
    !['20', '28'].includes(String(warehouse)) ||
    !String(code || '').trim()
  ) {
    return res.status(400).json({
      error: 'Warehouse and bin code are required.'
    });
  }

  res.status(201).json(await Bin.create({
    warehouse: String(warehouse),
    code: String(code).trim(),
    description
  }));
}));

app.put('/api/bins/:id', wrap(async (req, res) => {
  const b = await Bin.findByIdAndUpdate(
    req.params.id,
    {
      code: req.body.code,
      description: req.body.description
    },
    { new: true, runValidators: true }
  );

  if (!b) {
    return res.status(404).json({ error: 'Bin not found.' });
  }

  res.json(b);
}));

// Inventory sessions

app.get('/api/sessions', wrap(async (req, res) => {
  res.json(await Session.find().sort({ createdAt: -1 }));
}));

app.post('/api/sessions', wrap(async (req, res) => {
  const {
    name,
    warehouses = ['20', '28'],
    startDate = ''
  } = req.body;

  if (!String(name || '').trim()) {
    return res.status(400).json({
      error: 'Session name is required.'
    });
  }

  res.status(201).json(await Session.create({
    name: String(name).trim(),
    warehouses,
    startDate
  }));
}));

app.patch('/api/sessions/:id', wrap(async (req, res) => {
  const s = await Session.findByIdAndUpdate(
    req.params.id,
    { status: req.body.status },
    { new: true, runValidators: true }
  );

  if (!s) {
    return res.status(404).json({ error: 'Session not found.' });
  }

  res.json(s);
}));

// Inventory items

app.get('/api/items', wrap(async (req, res) => {
  const q = {};

  if (req.query.warehouse) {
    q.warehouse = String(req.query.warehouse);
  }

  if (req.query.sessionId) {
    q.sessionId = req.query.sessionId;
  }

  if (req.query.binCode) {
    q.binCode = String(req.query.binCode);
  }

  if (req.query.search) {
    q.$or = [
      {
        itemNumber: {
          $regex: String(req.query.search),
          $options: 'i'
        }
      },
      {
        binCode: {
          $regex: String(req.query.search),
          $options: 'i'
        }
      },
      {
        description: {
          $regex: String(req.query.search),
          $options: 'i'
        }
      }
    ];
  }

  const items = await Item.find(q)
    .sort({ warehouse: 1, binCode: 1, itemNumber: 1 });

  res.json(items.map(itemOut));
}));

app.post('/api/items', wrap(async (req, res) => {
  const b = req.body;

  if (
    !['20', '28'].includes(String(b.warehouse)) ||
    !String(b.binCode || '').trim() ||
    !String(b.itemNumber || '').trim() ||
    !num(b.systemQty)
  ) {
    return res.status(400).json({
      error:
        'Warehouse, bin, item number and a valid non-negative system quantity are required.'
    });
  }

  const bin = await Bin.findOne({
    warehouse: String(b.warehouse),
    code: String(b.binCode).trim()
  });

  if (!bin) {
    return res.status(400).json({
      error: 'Create this bin location before adding the item.'
    });
  }

  const item = await Item.create({
    warehouse: String(b.warehouse),
    binCode: String(b.binCode).trim(),
    itemNumber: String(b.itemNumber).trim(),
    description: b.description || '',
    systemQty: Number(b.systemQty),
    sessionId: b.sessionId || null,
    comments: b.comments || ''
  });

  res.status(201).json(itemOut(item));
}));

// Save first, second or third count

app.post('/api/items/:id/count', wrap(async (req, res) => {
  const stage = Number(req.body.stage);
  const quantity = Number(req.body.quantity);

  if (![1, 2, 3].includes(stage) || !num(quantity)) {
    return res.status(400).json({
      error:
        'Select count stage 1, 2 or 3 and enter a valid non-negative quantity.'
    });
  }

  const item = await Item.findById(req.params.id);

  if (!item) {
    return res.status(404).json({ error: 'Item not found.' });
  }

  const existing = item.counts.find((c) => c.stage === stage);

  if (existing) {
    return res.status(409).json({
      error:
        `Count ${stage} already exists. Existing counts are protected from accidental overwrites.`
    });
  }

  if (
    stage > 1 &&
    !item.counts.some((c) => c.stage === stage - 1)
  ) {
    return res.status(400).json({
      error: `Record count ${stage - 1} before count ${stage}.`
    });
  }

  item.counts.push({
    stage,
    quantity,
    countedBy: String(
      req.body.countedBy || 'Warehouse User'
    ).trim(),
    countedAt: new Date(),
    comment: req.body.comment || ''
  });

  if (item.sessionId) {
    await Session.findByIdAndUpdate(
      item.sessionId,
      { status: 'In Progress' }
    );
  }

  await item.save();

  res.status(201).json(itemOut(item));
}));

// Approve final quantity

app.patch('/api/items/:id/review', wrap(async (req, res) => {
  const item = await Item.findById(req.params.id);

  if (!item) {
    return res.status(404).json({ error: 'Item not found.' });
  }

  if (
    req.body.finalApprovedQty === '' ||
    req.body.finalApprovedQty == null ||
    !num(req.body.finalApprovedQty)
  ) {
    return res.status(400).json({
      error: 'Enter a valid final approved quantity.'
    });
  }

  item.finalApprovedQty = Number(req.body.finalApprovedQty);
  item.reviewed = true;

  if (req.body.comments !== undefined) {
    item.comments = req.body.comments;
  }

  await item.save();

  res.json(itemOut(item));
}));

// Import CSV or Excel inventory

app.post(
  '/api/import',
  upload.single('file'),
  wrap(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        error: 'Choose a CSV or Excel file.'
      });
    }

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });

    const rows = XLSX.utils.sheet_to_json(
      wb.Sheets[wb.SheetNames[0]],
      { defval: '' }
    );

    const norm = (s) =>
      String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

    const get = (r, names) => {
      const k = Object.keys(r).find(
        (key) => names.includes(norm(key))
      );

      return k === undefined ? '' : r[k];
    };

    let imported = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];

      const warehouse = String(
        get(r, ['warehouse', 'warehousenumber', 'whse'])
      ).replace(/^Warehouse\s*/i, '').trim();

      const binCode = String(
        get(r, ['binlocation', 'bin', 'location', 'bincode'])
      ).trim();

      const itemNumber = String(
        get(r, ['itemnumber', 'partnumber', 'item', 'part', 'sku'])
      ).trim();

      const description = String(
        get(r, [
          'description',
          'itemdescription',
          'partdescription'
        ])
      ).trim();

      const rawQty = get(r, [
        'systemquantity',
        'systemqty',
        'quantity',
        'qty',
        'onhand'
      ]);

      if (
        !['20', '28'].includes(warehouse) ||
        !binCode ||
        !itemNumber ||
        rawQty === '' ||
        !num(rawQty)
      ) {
        errors.push(
          `Row ${i + 2}: check Warehouse (20/28), Bin Location, Item Number and System Quantity.`
        );
        continue;
      }

      await Bin.updateOne(
        { warehouse, code: binCode },
        { $setOnInsert: { warehouse, code: binCode } },
        { upsert: true }
      );

      try {
        await Item.create({
          warehouse,
          binCode,
          itemNumber,
          description,
          systemQty: Number(rawQty)
        });

        imported++;
      } catch (e) {
        errors.push(
          `Row ${i + 2}: ${itemNumber} could not be imported (possibly duplicate).`
        );
      }
    }

    res.json({ imported, errors });
  })
);

// Export inventory count results to Excel

app.get('/api/export', wrap(async (req, res) => {
  const q = {};

  if (req.query.warehouse) {
    q.warehouse = String(req.query.warehouse);
  }

  if (req.query.sessionId) {
    q.sessionId = req.query.sessionId;
  }

  const items = (await Item.find(q)
    .sort({ warehouse: 1, binCode: 1, itemNumber: 1 }))
    .map(itemOut);

  const rows = items.map((x) => ({
    'Inventory Session': x.sessionId ? String(x.sessionId) : '',
    'Warehouse': x.warehouse,
    'Bin Location': x.binCode,
    'Item Number': x.itemNumber,
    'Description': x.description || '',
    'System Quantity': x.systemQty,

    'First Count':
      x.counts.find((c) => c.stage === 1)?.quantity ?? '',

    'First Count Variance': x.variance1 ?? '',

    'Second Count':
      x.counts.find((c) => c.stage === 2)?.quantity ?? '',

    'Second Count Variance': x.variance2 ?? '',

    'Third Count':
      x.counts.find((c) => c.stage === 3)?.quantity ?? '',

    'Third Count Variance': x.variance3 ?? '',

    'Final Approved Quantity': x.finalApprovedQty ?? '',
    'Final Variance': x.finalVariance ?? '',
    'Count Status': x.status,

    'Counted By': x.counts
      .map((c) => `C${c.stage}: ${c.countedBy}`)
      .join('; '),

    'Count Date': x.counts
      .map((c) =>
        `C${c.stage}: ${
          c.countedAt ? new Date(c.countedAt).toISOString() : ''
        }`
      )
      .join('; '),

    'Comments':
      x.comments ||
      x.counts.map((c) => c.comment).filter(Boolean).join('; ')
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  ws['!cols'] = Object.keys(
    rows[0] || { 'Warehouse': '' }
  ).map((k) => ({
    wch: Math.min(32, Math.max(14, k.length + 3))
  }));

  ws['!autofilter'] = { ref: ws['!ref'] || 'A1:A1' };
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  XLSX.utils.book_append_sheet(wb, ws, 'Inventory Results');

  const out = XLSX.write(wb, {
    type: 'buffer',
    bookType: 'xlsx'
  });

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );

  res.setHeader(
    'Content-Disposition',
    'attachment; filename="inventory-count-results.xlsx"'
  );

  res.send(out);
}));

// Load demonstration records

app.post('/api/demo', wrap(async (req, res) => {
  const exists = await Item.findOne({ isDemo: true });

  if (exists) {
    return res.json({
      message: 'Demo data is already loaded.'
    });
  }

  await Warehouse.bulkWrite([
    {
      updateOne: {
        filter: { code: '20' },
        update: {
          $set: { code: '20', name: 'Warehouse 20' }
        },
        upsert: true
      }
    },
    {
      updateOne: {
        filter: { code: '28' },
        update: {
          $set: { code: '28', name: 'Warehouse 28' }
        },
        upsert: true
      }
    }
  ]);

  const session = await Session.create({
    name: 'Annual Inventory Count 2026 — DEMO',
    warehouses: ['20', '28'],
    startDate: new Date().toISOString().slice(0, 10),
    status: 'In Progress',
    isDemo: true
  });

  const samples = [
    [
      '20', '2001101', 'BRG-6204',
      'Deep Groove Ball Bearing', 24,
      [{ stage: 1, quantity: 24, countedBy: 'Demo User', countedAt: new Date() }]
    ],
    [
      '20', '2001101', 'SHF-1008',
      'Stainless Steel Shaft', 100,
      [{ stage: 1, quantity: 95, countedBy: 'Demo User', countedAt: new Date() }]
    ],
    [
      '20', '2002102', 'SCR-M6-20',
      'Socket Head Screw M6 x 20', 500,
      [
        { stage: 1, quantity: 490, countedBy: 'Demo User', countedAt: new Date() },
        { stage: 2, quantity: 492, countedBy: 'Demo User', countedAt: new Date() }
      ]
    ],
    [
      '20', '2003104', 'SPC-12',
      'Precision Spacer 12 mm', 0, []
    ],
    [
      '28', '2801101', 'MTR-075',
      'Electric Motor 0.75 kW', 8,
      [{ stage: 1, quantity: 8, countedBy: 'Demo User', countedAt: new Date() }]
    ],
    [
      '28', '2802103', 'BLT-40',
      'Timing Belt 40 mm', 12,
      [
        { stage: 1, quantity: 10, countedBy: 'Demo User', countedAt: new Date() },
        { stage: 2, quantity: 10, countedBy: 'Demo User', countedAt: new Date() },
        { stage: 3, quantity: 11, countedBy: 'Demo User', countedAt: new Date() }
      ]
    ],
    [
      '28', '2803102', 'FAN-KIT-01',
      'Cooling Fan Kit', 6,
      [
        { stage: 1, quantity: 5, countedBy: 'Demo User', countedAt: new Date() },
        { stage: 2, quantity: 5, countedBy: 'Demo User', countedAt: new Date() },
        { stage: 3, quantity: 5, countedBy: 'Demo User', countedAt: new Date() }
      ]
    ]
  ];

  for (const [warehouse, code] of [
    ['20', '2001101'],
    ['20', '2002102'],
    ['20', '2003104'],
    ['28', '2801101'],
    ['28', '2802103'],
    ['28', '2803102']
  ]) {
    await Bin.updateOne(
      { warehouse, code },
      { $set: { warehouse, code, isDemo: true } },
      { upsert: true }
    );
  }

  for (const [
    warehouse,
    binCode,
    itemNumber,
    description,
    systemQty,
    counts
  ] of samples) {
    await Item.create({
      warehouse,
      binCode,
      itemNumber,
      description,
      systemQty,
      counts,
      sessionId: session._id,
      isDemo: true,
      comments: 'Demo record — not actual company inventory'
    });
  }

  res.json({
    message: 'Demo data loaded.',
    sessionId: session._id
  });
}));

// Remove demo records only

app.delete('/api/demo', wrap(async (req, res) => {
  await Item.deleteMany({ isDemo: true });
  await Bin.deleteMany({ isDemo: true });
  await Session.deleteMany({ isDemo: true });

  res.json({
    message: 'Demo records removed. Non-demo records were not changed.'
  });
}));

// Error handler

app.use((err, req, res, next) => {
  console.error(err);

  if (err.code === 11000) {
    return res.status(409).json({
      error: 'A record with these details already exists.'
    });
  }

  res.status(500).json({
    error: err.message || 'Unexpected server error.'
  });
});

// Connect to MongoDB and start API

const port = process.env.PORT || 4000;

mongoose.connect(
  process.env.MONGODB_URI ||
  'mongodb://127.0.0.1:27017/warehouse_inventory'
)
  .then(async () => {
    await Warehouse.bulkWrite([
      {
        updateOne: {
          filter: { code: '20' },
          update: {
            $setOnInsert: {
              code: '20',
              name: 'Warehouse 20'
            }
          },
          upsert: true
        }
      },
      {
        updateOne: {
          filter: { code: '28' },
          update: {
            $setOnInsert: {
              code: '28',
              name: 'Warehouse 28'
            }
          },
          upsert: true
        }
      }
    ]);

    app.listen(port, () => {
      console.log(`Inventory API running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });