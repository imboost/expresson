const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const csvParser = require('csv-parser');
const { networkInterfaces } = require('os');

const nets = networkInterfaces();
const results = Object.create(null);

var jsonParser = bodyParser.json();

function jsonToCsv(jsonData) {
    const keys = Object.keys(jsonData[0]);
    const csvRows = [];

    // Add headers
    csvRows.push(keys.join(';'));

    // Add data rows
    jsonData.forEach(item => {
        const row = keys.map(key => item[key]).join(';');
        csvRows.push(row);
    });

    return csvRows.join('\n');
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-based
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}_${month}_${day}`;
}

app.use(express.static(path.join(__dirname, 'public')))
    .set('views', path.join(__dirname, 'views'))
    .set('view engine', 'ejs');

app.get('/', (req, res) => {
    // Get IP Address
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
            // 'IPv4' is in Node <= 17, from 18 it's a number 4 or 6
            const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4
            if (net.family === familyV4Value && !net.internal) {
                if (!results[name]) {
                    results[name] = [];
                }
                results[name].push(net.address);
            }
        }
    }

    // Render
    res.render('index', {
        networkData: results
    });
});

app.post('/csv', jsonParser, (req, res) => {
    const data = req.body.data;
    const device = req.body.device;

    // Check if the received data is an array
    // if (!Array.isArray(data)) {
    //     return res.status(400).json({
    //         message: 'Invalid data format, expected an array of objects'
    //     });
    // }

    const currentDate = new Date();
    const formattedDate = formatDate(currentDate);

    if (fs.existsSync(path.join('D:', 'exported_csv', formattedDate + '_' + device + '.csv'))) {
        let csvRow = []; ``

        fs.createReadStream(path.join('D:', 'exported_csv', formattedDate + '_' + device + '.csv')).pipe(csvParser({ separator: ';' })).on('error', err => { // Read Current File
            console.log(err);
        }).on('data', data => { // Current CSV to JSON
            csvRow.push(data);
        }).on('end', end => { // Current Data + New Data
            for (var i = 0; i < data.length; i++) {
                csvRow.push(data[i]);
            }
            var appendData = jsonToCsv(csvRow);

            // Write CSV
            fs.writeFile(path.join('D:', 'exported_csv', formattedDate + '_' + device + '.csv'), appendData, (err) => {
                if (err) {
                    return res.status(500).json({
                        message: 'Failed to write CSV file'
                    });
                }

                res.status(200).json({
                    message: 'Write CSV Success'
                });
            });
        });
    } else {
        var appendData = jsonToCsv(req.body.data);

        // Write CSV
        fs.writeFile(path.join('D:', 'exported_csv', formattedDate + '_' + device + '.csv'), appendData, (err) => {
            if (err) {
                return res.status(500).json({
                    message: 'Failed to write CSV file'
                });
            }

            res.status(200).json({
                message: 'Write CSV Success'
            });
        });
    }
});

app.listen(process.env.port || 3000);