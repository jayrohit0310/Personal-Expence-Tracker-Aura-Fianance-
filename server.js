const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup Session Management
app.use(session({
  secret: process.env.SESSION_SECRET || 'personal-expense-tracker-super-secret-key-12345',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 24 hours
    secure: false, // Set to true if using HTTPS
    sameSite: 'lax'
  }
}));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Authentication check middleware
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }
  next();
};

// ==========================================
// 1. AUTHENTICATION API ROUTES
// ==========================================

// Register a new user
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields (username, email, password) are required.' });
  }

  try {
    // Check if user already exists
    const existingUser = await db.get(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username.trim(), email.trim().toLowerCase()]
    );

    if (existingUser) {
      return res.status(400).json({ error: 'Username or Email is already registered.' });
    }

    // Hash Password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user into DB
    const result = await db.run(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username.trim(), email.trim().toLowerCase(), passwordHash]
    );

    // Set user session automatically
    req.session.userId = result.id;
    req.session.username = username.trim();

    return res.status(201).json({
      message: 'Registration successful!',
      user: { id: result.id, username: username.trim(), email: email.trim().toLowerCase() }
    });
  } catch (err) {
    console.error('Registration failed:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// User login
app.post('/api/auth/login', async (req, res) => {
  const { credential, password } = req.body; // credential can be username or email

  if (!credential || !password) {
    return res.status(400).json({ error: 'Username/Email and password are required.' });
  }

  try {
    // Find user in DB
    const user = await db.get(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [credential.trim(), credential.trim().toLowerCase()]
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials. User not found.' });
    }

    // Match password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials. Incorrect password.' });
    }

    // Establish Session
    req.session.userId = user.id;
    req.session.username = user.username;

    return res.json({
      message: 'Login successful!',
      user: { id: user.id, username: user.username, email: user.email }
    });
  } catch (err) {
    console.error('Login failed:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get currently logged-in user profile
app.get('/api/auth/me', async (req, res) => {
  if (!req.session.userId) {
    return res.json({ loggedIn: false });
  }

  try {
    const user = await db.get('SELECT id, username, email, created_at FROM users WHERE id = ?', [req.session.userId]);
    if (!user) {
      req.session.destroy();
      return res.json({ loggedIn: false });
    }
    return res.json({ loggedIn: true, user });
  } catch (err) {
    console.error('Fetch profile failed:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Logout user session
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout session destroy failed:', err);
      return res.status(500).json({ error: 'Could not log out. Please try again.' });
    }
    res.clearCookie('connect.sid');
    return res.json({ message: 'Logout successful' });
  });
});


// ==========================================
// 2. TRANSACTIONS API ROUTES (CRUD)
// ==========================================

// Get all transactions for logged in user
app.get('/api/transactions', requireAuth, async (req, res) => {
  try {
    const transactions = await db.all(
      'SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, id DESC',
      [req.session.userId]
    );
    res.json(transactions);
  } catch (err) {
    console.error('Fetch transactions failed:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Add a transaction
app.post('/api/transactions', requireAuth, async (req, res) => {
  const { type, category, amount, description, date } = req.body;

  if (!type || !category || !amount || !date) {
    return res.status(400).json({ error: 'Missing required transaction details.' });
  }

  if (type !== 'income' && type !== 'expense') {
    return res.status(400).json({ error: 'Invalid transaction type.' });
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number.' });
  }

  try {
    const result = await db.run(
      'INSERT INTO transactions (user_id, type, category, amount, description, date) VALUES (?, ?, ?, ?, ?, ?)',
      [req.session.userId, type, category.trim(), parsedAmount, description ? description.trim() : '', date]
    );

    const newTransaction = {
      id: result.id,
      user_id: req.session.userId,
      type,
      category: category.trim(),
      amount: parsedAmount,
      description: description ? description.trim() : '',
      date
    };

    res.status(201).json(newTransaction);
  } catch (err) {
    console.error('Add transaction failed:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Update a transaction
app.put('/api/transactions/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { type, category, amount, description, date } = req.body;

  if (!type || !category || !amount || !date) {
    return res.status(400).json({ error: 'Missing required transaction details.' });
  }

  if (type !== 'income' && type !== 'expense') {
    return res.status(400).json({ error: 'Invalid transaction type.' });
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number.' });
  }

  try {
    // Check ownership first
    const tx = await db.get('SELECT id FROM transactions WHERE id = ? AND user_id = ?', [id, req.session.userId]);
    if (!tx) {
      return res.status(404).json({ error: 'Transaction not found or unauthorized.' });
    }

    await db.run(
      'UPDATE transactions SET type = ?, category = ?, amount = ?, description = ?, date = ? WHERE id = ?',
      [type, category.trim(), parsedAmount, description ? description.trim() : '', date, id]
    );

    res.json({ message: 'Transaction updated successfully.', transaction: { id, type, category, amount: parsedAmount, description, date } });
  } catch (err) {
    console.error('Update transaction failed:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Delete a transaction
app.delete('/api/transactions/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    // Check ownership
    const tx = await db.get('SELECT id FROM transactions WHERE id = ? AND user_id = ?', [id, req.session.userId]);
    if (!tx) {
      return res.status(404).json({ error: 'Transaction not found or unauthorized.' });
    }

    await db.run('DELETE FROM transactions WHERE id = ?', [id]);
    res.json({ message: 'Transaction deleted successfully.' });
  } catch (err) {
    console.error('Delete transaction failed:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// ==========================================
// 3. BUDGETS API ROUTES
// ==========================================

// Get all budgets for user
app.get('/api/budgets', requireAuth, async (req, res) => {
  try {
    const budgets = await db.all('SELECT * FROM budgets WHERE user_id = ?', [req.session.userId]);
    res.json(budgets);
  } catch (err) {
    console.error('Fetch budgets failed:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Create or update a budget limit (Upsert: ON CONFLICT sqlite)
app.post('/api/budgets', requireAuth, async (req, res) => {
  const { category, limit_amount } = req.body;

  if (!category || !limit_amount) {
    return res.status(400).json({ error: 'Category and budget limit amount are required.' });
  }

  const parsedLimit = parseFloat(limit_amount);
  if (isNaN(parsedLimit) || parsedLimit <= 0) {
    return res.status(400).json({ error: 'Budget limit must be a positive number.' });
  }

  try {
    // SQLite upsert syntax
    await db.run(
      `INSERT INTO budgets (user_id, category, limit_amount) 
       VALUES (?, ?, ?) 
       ON CONFLICT(user_id, category) 
       DO UPDATE SET limit_amount = excluded.limit_amount`,
      [req.session.userId, category.trim(), parsedLimit]
    );

    const budget = await db.get(
      'SELECT * FROM budgets WHERE user_id = ? AND category = ?',
      [req.session.userId, category.trim()]
    );

    res.status(201).json({ message: 'Budget set successfully.', budget });
  } catch (err) {
    console.error('Set budget failed:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Delete a budget category limit
app.delete('/api/budgets/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    // Check ownership
    const budget = await db.get('SELECT id FROM budgets WHERE id = ? AND user_id = ?', [id, req.session.userId]);
    if (!budget) {
      return res.status(404).json({ error: 'Budget not found or unauthorized.' });
    }

    await db.run('DELETE FROM budgets WHERE id = ?', [id]);
    res.json({ message: 'Budget deleted successfully.' });
  } catch (err) {
    console.error('Delete budget failed:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// ==========================================
// 4. STATS & ANALYTICS REPORTS API
// ==========================================

// Get dashboard main summary metrics & progress on budgets (filtered by optional month parameter YYYY-MM)
app.get('/api/stats/summary', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const { month } = req.query; // YYYY-MM format

  try {
    // 1. Total Income Query
    let incomeSql = `SELECT SUM(amount) as total FROM transactions WHERE user_id = ? AND type = 'income'`;
    let incomeParams = [userId];
    if (month) {
      incomeSql += ` AND strftime('%Y-%m', date) = ?`;
      incomeParams.push(month);
    }
    const incomeRow = await db.get(incomeSql, incomeParams);
    const totalIncome = incomeRow.total || 0;

    // 2. Total Expense Query
    let expenseSql = `SELECT SUM(amount) as total FROM transactions WHERE user_id = ? AND type = 'expense'`;
    let expenseParams = [userId];
    if (month) {
      expenseSql += ` AND strftime('%Y-%m', date) = ?`;
      expenseParams.push(month);
    }
    const expenseRow = await db.get(expenseSql, expenseParams);
    const totalExpense = expenseRow.total || 0;

    // 3. Budgets list joined with matching transactions from the selected month
    let budgetsSql = `
      SELECT b.id, b.category, b.limit_amount, 
             COALESCE(SUM(t.amount), 0) as spent
      FROM budgets b
      LEFT JOIN transactions t ON b.user_id = t.user_id 
                              AND b.category = t.category 
                              AND t.type = 'expense'
                              ${month ? "AND strftime('%Y-%m', t.date) = ?" : ""}
      WHERE b.user_id = ?
      GROUP BY b.id
    `;
    let budgetsParams = month ? [month, userId] : [userId];
    const budgetsStatus = await db.all(budgetsSql, budgetsParams);

    res.json({
      totalIncome,
      totalExpense,
      netBalance: totalIncome - totalExpense,
      budgetsStatus
    });
  } catch (err) {
    console.error('Fetch dashboard stats failed:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Category expense breakdown for Doughnut chart
app.get('/api/stats/category-breakdown', requireAuth, async (req, res) => {
  try {
    const categories = await db.all(
      `SELECT category, SUM(amount) as total 
       FROM transactions 
       WHERE user_id = ? AND type = 'expense' 
       GROUP BY category 
       ORDER BY total DESC`,
      [req.session.userId]
    );
    res.json(categories);
  } catch (err) {
    console.error('Fetch category breakdown failed:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Monthly trends for Line chart (last 6 months of data)
app.get('/api/stats/monthly-trends', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  try {
    // Aggregate income and expense by Month
    // date standard: YYYY-MM-DD
    const trends = await db.all(
      `SELECT strftime('%Y-%m', date) as month,
              SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
              SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
       FROM transactions
       WHERE user_id = ?
       GROUP BY month
       ORDER BY month ASC
       LIMIT 6`,
      [userId]
    );
    res.json(trends);
  } catch (err) {
    console.error('Fetch monthly trends failed:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Default path fallback: Serve SPA index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server and Initialize Database
function startServer(port) {
  const server = app.listen(port, async () => {
    console.log(`Server is running at: http://localhost:${port}`);
    await db.initDatabase();
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is already in use. Trying alternative port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server execution error:', err);
    }
  });
}

startServer(PORT);
