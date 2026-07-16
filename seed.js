const bcrypt = require('bcryptjs');
const db = require('./database');

async function seedData() {
  console.log('--- Starting Database Seeding ---');
  
  // Make sure tables exist
  await db.initDatabase();

  try {
    // 1. Check if demo user already exists
    const existingUser = await db.get('SELECT id FROM users WHERE username = ?', ['demo']);
    
    let userId;
    if (existingUser) {
      console.log('Demo user already exists. Cleaning up old transactions/budgets for seeding fresh...');
      userId = existingUser.id;
      // Clear previous transactions and budgets to seed fresh data
      await db.run('DELETE FROM transactions WHERE user_id = ?', [userId]);
      await db.run('DELETE FROM budgets WHERE user_id = ?', [userId]);
    } else {
      console.log('Creating demo user...');
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('password123', salt);
      
      const result = await db.run(
        'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
        ['demo', 'demo@example.com', passwordHash]
      );
      userId = result.id;
      console.log(`Demo user created with ID: ${userId}`);
    }

    // 2. Seed Budgets
    console.log('Seeding demo budgets...');
    const budgets = [
      { category: 'Food & Dining', limit_amount: 400 },
      { category: 'Shopping', limit_amount: 300 },
      { category: 'Entertainment', limit_amount: 150 },
      { category: 'Utilities', limit_amount: 250 },
      { category: 'Rent & Housing', limit_amount: 1200 },
      { category: 'Travel', limit_amount: 200 }
    ];

    for (const budget of budgets) {
      await db.run(
        'INSERT INTO budgets (user_id, category, limit_amount) VALUES (?, ?, ?)',
        [userId, budget.category, budget.limit_amount]
      );
    }
    console.log(`Successfully seeded ${budgets.length} budgets.`);

    // 3. Seed Transactions (Spread across March, April, and May 2026)
    console.log('Seeding historical transactions...');
    const transactions = [
      // --- MARCH 2026 ---
      { type: 'income', category: 'Salary', amount: 3500, description: 'Monthly Corporate Salary', date: '2026-03-01' },
      { type: 'income', category: 'Freelance', amount: 450, description: 'Website Redesign Project', date: '2026-03-12' },
      
      { type: 'expense', category: 'Rent & Housing', amount: 1200, description: 'Monthly Apartment Rent', date: '2026-03-02' },
      { type: 'expense', category: 'Utilities', amount: 185.50, description: 'Electricity & Internet', date: '2026-03-04' },
      { type: 'expense', category: 'Food & Dining', amount: 65.20, description: 'Weekly Groceries at Costco', date: '2026-03-05' },
      { type: 'expense', category: 'Food & Dining', amount: 45.00, description: 'Dinner with friends', date: '2026-03-08' },
      { type: 'expense', category: 'Shopping', amount: 120.00, description: 'Spring clothing', date: '2026-03-10' },
      { type: 'expense', category: 'Entertainment', amount: 55.00, description: 'Movie night & snacks', date: '2026-03-15' },
      { type: 'expense', category: 'Food & Dining', amount: 72.80, description: 'Groceries', date: '2026-03-18' },
      { type: 'expense', category: 'Travel', amount: 80.00, description: 'Gas refill', date: '2026-03-20' },
      { type: 'expense', category: 'Food & Dining', amount: 110.00, description: 'Sushi dinner date', date: '2026-03-24' },
      { type: 'expense', category: 'Shopping', amount: 45.00, description: 'Novel books', date: '2026-03-27' },
      
      // --- APRIL 2026 ---
      { type: 'income', category: 'Salary', amount: 3500, description: 'Monthly Corporate Salary', date: '2026-04-01' },
      { type: 'income', category: 'Freelance', amount: 600, description: 'API Development contract', date: '2026-04-18' },
      { type: 'income', category: 'Investments', amount: 120, description: 'Stock Dividends payout', date: '2026-04-25' },
      
      { type: 'expense', category: 'Rent & Housing', amount: 1200, description: 'Monthly Apartment Rent', date: '2026-04-02' },
      { type: 'expense', category: 'Utilities', amount: 210.40, description: 'Electricity, Water & Internet', date: '2026-04-04' },
      { type: 'expense', category: 'Food & Dining', amount: 84.60, description: 'Organic Groceries WholeFoods', date: '2026-04-06' },
      { type: 'expense', category: 'Entertainment', amount: 120.00, description: 'Concert ticket', date: '2026-04-10' },
      { type: 'expense', category: 'Shopping', amount: 280.00, description: 'New Mechanical Keyboard & mouse', date: '2026-04-12' },
      { type: 'expense', category: 'Food & Dining', amount: 55.30, description: 'Midweek food delivery', date: '2026-04-15' },
      { type: 'expense', category: 'Travel', amount: 150.00, description: 'Weekend getaway fuel & tolls', date: '2026-04-19' },
      { type: 'expense', category: 'Food & Dining', amount: 92.10, description: 'Weekly Groceries Costco', date: '2026-04-22' },
      { type: 'expense', category: 'Shopping', amount: 85.00, description: 'Running shoes', date: '2026-04-26' },
      
      // --- MAY 2026 ---
      { type: 'income', category: 'Salary', amount: 3500, description: 'Monthly Corporate Salary', date: '2026-05-01' },
      
      { type: 'expense', category: 'Rent & Housing', amount: 1200, description: 'Monthly Apartment Rent', date: '2026-05-02' },
      { type: 'expense', category: 'Utilities', amount: 195.00, description: 'Electricity & Gas bills', date: '2026-05-03' },
      { type: 'expense', category: 'Food & Dining', amount: 115.50, description: 'Bulk grocery shopping', date: '2026-05-04' },
      { type: 'expense', category: 'Food & Dining', amount: 88.00, description: 'Dinner with coworkers', date: '2026-05-08' },
      { type: 'expense', category: 'Shopping', amount: 190.00, description: 'Home decor & kitchen items', date: '2026-05-11' },
      // This will push shopping budget exactly to its limit or over if they add more (limit is 300)
      { type: 'expense', category: 'Shopping', amount: 130.00, description: 'Birthday gifts', date: '2026-05-14' }, 
      { type: 'expense', category: 'Entertainment', amount: 45.00, description: 'Museum tickets', date: '2026-05-15' },
      // Food dining sum is currently: 115.5 + 88 = 203.5. Let's add some more to show budget close to limit (limit is 400)
      { type: 'expense', category: 'Food & Dining', amount: 120.00, description: 'Steakhouse celebrations', date: '2026-05-17' },
      { type: 'expense', category: 'Travel', amount: 70.00, description: 'Car Wash & gas refill', date: '2026-05-19' }
    ];

    for (const tx of transactions) {
      await db.run(
        'INSERT INTO transactions (user_id, type, category, amount, description, date) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, tx.type, tx.category, tx.amount, tx.description, tx.date]
      );
    }
    console.log(`Successfully seeded ${transactions.length} transactions.`);
    console.log('--- Database Seeding Completed Successfully! ---');
    console.log('Test Account Credentials:');
    console.log('Username: demo');
    console.log('Password: password123');
    process.exit(0);
  } catch (error) {
    console.error('Seeding process encountered an error:', error);
    process.exit(1);
  }
}

seedData();
