const express = require('express');
const app = express();
const port = 3000;
const pool = require('./db.cjs');

app.use(express.urlencoded({extended: true}))
app.use(express.json()); // parse JSON bodies   ​


app.get('/' , (req, res) => {
  res.send('Hello World2!' );
});

// function definition examples
function myFunction() {
    console.log("Hello from my function");
}
const myFunction2 = (req, res) => {
    console.log("Hello from my function 2");
}


app.get('/destinations', async (req, res) => {
    
    try {
        const result = await pool.query("SELECT * FROM traveldestinations" );
        console.log(result.rows);
        res.status(200).json(result.rows);
    } catch(error) {
        res.status(500).send({message: "Error connecting to database"});
    }
})

app.post('/destinations', async (req, res) => {
    console.log(req.body);
    const { country, city } = req.body;
    const result = await pool.query(
    `
    INSERT into traveldestinations (country, city) 
    VALUES ($1, $2)
    RETURNING country, city`
    ,
    [country, city]
    );
    result.rows[0]

    res.status(201).send({status: 'ok'}); // answers the client
});

app.delete('/destinations/:id', async (req, res) => {
    console.log(req.params);
    const { id } = req.params;
    const result = await pool.query(
        `DELETE FROM traveldestinations
        WHERE id = $1
        RETURNING id, country, city`
        ,
        [id]
    );
    res.status(200).send({
        status: 'ok',
        deletedDestination: result.rows[0]
    });
});


app.listen(port, () => {
  console.log(`Example app listening on port ${port}` )
});