const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3003;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({
        message: 'Simple test server is working',
        port: PORT,
        timestamp: new Date().toISOString()
    });
});

app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: 'API endpoint working',
        data: { test: true }
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Test server running on http://localhost:${PORT}`);
});