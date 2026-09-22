const express = require('express');
const argon2 = require('argon2');
const pool = require('./db.cjs');

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

// Register a new user
app.post('/register', async (req, res) => {
  try {
    const { email, password, confirmPassword } = req.body;

    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      typeof confirmPassword !== 'string' ||
      !email.trim() ||
      !password ||
      !confirmPassword
    ) {
      return res.status(400).json({
        message: 'Email and password are required',
      });
    }

    if (password.length < 12) {
      return res.status(400).json({
        message: 'Password must contain at least 12 characters',
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        message: 'Passwords do not match',
      });
    }

    const normalizedEmail = normalizeEmail(email);

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    const result = await pool.query(
      `
        INSERT INTO public.users (email, password_hash)
        VALUES ($1, $2)
        RETURNING id, email, created_at
      `,
      [normalizedEmail, passwordHash]
    );

    return res.status(201).json({
      message: 'User created successfully',
      user: result.rows[0],
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        message: 'An account with this email already exists',
      });
    }

    console.error('Registration error:', error);

    return res.status(500).json({
      message: 'Could not create user',
    });
  }
});

// Log in an existing user
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: 'Email and password are required',
      });
    }

    const normalizedEmail = normalizeEmail(email);

    const result = await pool.query(
      `
        SELECT id, email, password_hash
        FROM public.users
        WHERE email = $1
      `,
      [normalizedEmail]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({
        message: 'Invalid email or password',
      });
    }

    const passwordIsCorrect = await argon2.verify(
      user.password_hash,
      password
    );

    if (!passwordIsCorrect) {
      return res.status(401).json({
        message: 'Invalid email or password',
      });
    }

    // Password was correct: go to src/pages/index.astro
    return res.redirect('http://localhost:4322/');
  } catch (error) {
    console.error('Login error:', error);

    return res.status(500).json({
      message: 'Could not log in',
    });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});