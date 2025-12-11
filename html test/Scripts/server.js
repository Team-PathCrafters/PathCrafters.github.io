const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Create MySQL connection
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "seniorproj"
});

db.connect((err) => {
    if (err) throw err;
    console.log("Connected to MySQL");
});


// get all job names
app.get("/jobs", (req, res) => {
  const search = req.query.search || "";
  const sql = `
    SELECT Job_name
    FROM Jobs
  `;
  db.query(sql, [search], (err, rows) => {
    if (err) return res.status(500).send(err);
    res.json(rows);
  });
});

// CareerSearch query
app.get("/job/:name", (req, res) => {
    const jobName = req.params.name;

    const sql = `
        SELECT 
            j.JobID,
            j.Job_name,
            j.Final_degree,
            j.years_needed,
            j.avgCost,
            j.Salary,
            m.MajorID,
            m.Major_name,
            m.CreditHrs,
            m.focus
        FROM Jobs j
        LEFT JOIN Major_Jobs mj ON j.JobID = mj.JobID
        LEFT JOIN Major m ON mj.MajorID = m.MajorID
        WHERE j.Job_name = ? COLLATE utf8mb4_general_ci
    `;

    db.query(sql, [jobName], (err, rows) => {
        if (err) return res.status(500).send(err);

        if (rows.length === 0) return res.json({ error: "No job found" });

        const job = {
            JobID: rows[0].JobID,
            Job_name: rows[0].Job_name,
            Final_degree: rows[0].Final_degree,
            years_needed: rows[0].years_needed,
            avgCost: rows[0].avgCost,
            majors: rows.map(r => ({
                MajorID: r.MajorID,
                Major_name: r.Major_name,
                CreditHrs: r.CreditHrs
            }))
        };

        res.json(job);
    });
});

// START SERVER
app.listen(3000, () => console.log("API running on port 3000"));
