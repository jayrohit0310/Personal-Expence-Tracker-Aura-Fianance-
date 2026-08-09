require('dotenv').config();

const bcrypt = require('bcryptjs');
const { User, Budget, Transaction, initDatabase, closeDatabase } = require('./database');

async function seedData() {
  console.log('--- Starting Database Seeding ---');

  await initDatabase();

  try {
    let user = await User.findOne({ username: 'demo' });

    if (user) {
      console.log('Demo user already exists. Cleaning up old transactions/budgets for seeding fresh...');
      await Transaction.deleteMany({ user_id: user._id });
      await Budget.deleteMany({ user_id: user._id });
    } else {
      console.log('Creating demo user...');
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('password123', salt);

      user = await User.create({
        username: 'demo',
        email: 'demo@example.com',
        password_hash: passwordHash
      });
      console.log(`Demo user created with ID: ${user._id.toString()}`);
    }

    const userId = user._id;

    console.log('Seeding demo budgets...');
    const budgets = [
      { category: 'Food & Dining', limit_amount: 400 },
      { category: 'Shopping', limit_amount: 300 },
      { category: 'Entertainment', limit_amount: 150 },
      { category: 'Utilities', limit_amount: 250 },
      { category: 'Rent & Housing', limit_amount: 1200 },
      { category: 'Travel', limit_amount: 200 }
    ];

    await Budget.insertMany(
      budgets.map((budget) => ({ user_id: userId, ...budget }))
    );
    console.log(`Successfully seeded ${budgets.length} budgets.`);

    console.log('Seeding historical transactions...');
    const transactions = [
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

      { type: 'income', category: 'Salary', amount: 3500, description: 'Monthly Corporate Salary', date: '2026-05-01' },

      { type: 'expense', category: 'Rent & Housing', amount: 1200, description: 'Monthly Apartment Rent', date: '2026-05-02' },
      { type: 'expense', category: 'Utilities', amount: 195.00, description: 'Electricity & Gas bills', date: '2026-05-03' },
      { type: 'expense', category: 'Food & Dining', amount: 115.50, description: 'Bulk grocery shopping', date: '2026-05-04' },
      { type: 'expense', category: 'Food & Dining', amount: 88.00, description: 'Dinner with coworkers', date: '2026-05-08' },
      { type: 'expense', category: 'Shopping', amount: 190.00, description: 'Home decor & kitchen items', date: '2026-05-11' },
      { type: 'expense', category: 'Shopping', amount: 130.00, description: 'Birthday gifts', date: '2026-05-14' },
      { type: 'expense', category: 'Entertainment', amount: 45.00, description: 'Museum tickets', date: '2026-05-15' },
      { type: 'expense', category: 'Food & Dining', amount: 120.00, description: 'Steakhouse celebrations', date: '2026-05-17' },
      { type: 'expense', category: 'Travel', amount: 70.00, description: 'Car Wash & gas refill', date: '2026-05-19' }
    ];

    await Transaction.insertMany(
      transactions.map((tx) => ({ user_id: userId, ...tx }))
    );
    console.log(`Successfully seeded ${transactions.length} transactions.`);
    console.log('--- Database Seeding Completed Successfully! ---');
    console.log('Test Account Credentials:');
    console.log('Username: demo');
    console.log('Password: password123');
  } catch (error) {
    console.error('Seeding process encountered an error:', error);
    process.exitCode = 1;
  } finally {
    await closeDatabase();
    process.exit(process.exitCode || 0);
  }
}

seedData();
