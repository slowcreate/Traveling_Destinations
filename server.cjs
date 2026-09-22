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

app.get('/', (req, res) => {
  res.send('Travel Destinations API');
});

// Register a new user
app.post('/register', async (req, res) => {
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

    if (password.length < 12) {
      return res.status(400).json({
        message: 'Password must contain at least 12 characters',
      });
    }

    const normalizedEmail = normalizeEmail(email);

    // Convert the real password into a secure, irreversible hash.
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

// Check a user's login details
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

    // Compare the entered password with the stored Argon2 hash.
    const passwordIsCorrect = await argon2.verify(
      user.password_hash,
      password
    );

    if (!passwordIsCorrect) {
      return res.status(401).json({
        message: 'Invalid email or password',
      });
    }

    return res.status(200).json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Login error:', error);

    return res.status(500).json({
      message: 'Could not log in',
    });
  }
});

// Get all destinations
app.get('/destinations', async (req, res) => {
  try {
    const result = await pool.query(
      `
        SELECT id, country, city
        FROM public.traveldestinations
        ORDER BY id
      `
    );

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Get destinations error:', error);

    return res.status(500).json({
      message: 'Could not retrieve destinations',
    });
  }
});

// Create a destination
app.post('/destinations', async (req, res) => {
  try {
    const { country, city } = req.body;

    if (
      typeof country !== 'string' ||
      typeof city !== 'string' ||
      !country.trim() ||
      !city.trim()
    ) {
      return res.status(400).json({
        message: 'Country and city are required',
      });
    }

    const result = await pool.query(
      `
        INSERT INTO public.traveldestinations (country, city)
        VALUES ($1, $2)
        RETURNING id, country, city
      `,
      [country.trim(), city.trim()]
    );

    return res.status(201).json({
      message: 'Destination created',
      destination: result.rows[0],
    });
  } catch (error) {
    console.error('Create destination error:', error);

    return res.status(500).json({
      message: 'Could not create destination',
    });
  }
});

// Delete a destination
app.delete('/destinations/:id', async (req, res) => {
  try {
    const destinationId = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(destinationId)) {
      return res.status(400).json({
        message: 'Invalid destination ID',
      });
    }

    const result = await pool.query(
      `
        DELETE FROM public.traveldestinations
        WHERE id = $1
        RETURNING id, country, city
      `,
      [destinationId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({
        message: 'Destination not found',
      });
    }

    return res.status(200).json({
      message: 'Destination deleted',
      destination: result.rows[0],
    });
  } catch (error) {
    console.error('Delete destination error:', error);

    return res.status(500).json({
      message: 'Could not delete destination',
    });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});