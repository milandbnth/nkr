
const { Pool } = require('pg');
const nodemailer = require('nodemailer');


const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

function generateRef() {
  return 'FR-' + Math.floor(100000 + Math.random() * 900000);
}

module.exports = async (req, res) => {

  // POST request
  if (req.method === 'POST') {

    const {
      fname,
      lname,
      phone,
      email,
      appliance,
      pdate,
      issue
    } = req.body;

    if (!fname || !phone || !email || !appliance) {
      return res.status(400).json({
        error: 'Missing required fields'
      });
    }

    const ref = generateRef();


    // 1. Save to DB
    await pool.query(
      `INSERT INTO leads
        (ref, fname, lname, phone, email, appliance, pdate, issue)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        ref,
        fname,
        lname || '',
        phone,
        email,
        appliance,
        pdate || null,
        issue || ''
      ]
    );

    // 2. Send email (safe)
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.NOTIFY_EMAILS,
        subject: `New Lead - ${ref}`,
        html: `
    <h2>New Lead Received</h2>

    <p><b>Reference:</b> ${ref}</p>
    <p><b>First Name:</b> ${fname}</p>
    <p><b>Last Name:</b> ${lname || ''}</p>
    <p><b>Phone:</b> ${phone}</p>
    <p><b>Email:</b> ${email}</p>
    <p><b>Appliance:</b> ${appliance}</p>
    <p><b>Preferred Date:</b> ${pdate || ''}</p>
    <p><b>Issue:</b> ${issue || ''}</p>
  `
      });
    } catch (emailErr) {
      console.error("Email failed:", emailErr.message);
    }

    // 3. Respond to user
    return res.status(201).json({ success: true, ref });


  }

  // GET request
  if (req.method === 'GET') {

    const adminKey = req.headers['x-admin-key'];

    if (adminKey !== process.env.ADMIN_KEY) {
      return res.status(401).json({
        error: 'Unauthorized'
      });
    }

    try {

      const result = await pool.query(
        'SELECT * FROM leads ORDER BY created_at DESC'
      );

      return res.status(200).json({
        total: result.rowCount,
        leads: result.rows
      });

    } catch (err) {

      return res.status(500).json({
        error: 'Failed to fetch leads'
      });
    }
  }

  return res.status(405).json({
    error: 'Method not allowed'
  });
};