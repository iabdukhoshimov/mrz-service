'use strict';

var QrCode = require('qrcode-reader');
const express = require("express");
// const Tesseract = require('tesseract.js');
// const sharp = require('sharp');
const cors = require('cors');
// const multer = require('multer');
const fs = require("fs");
// const Image = require('image-js').Image;
// const { getMrz, readMrz } = require('./src');
// const mrzParser = require('./utils/mrz-parser.js');
const upload = require('./utils/multer')

// Controllers
const homeCont = require('./controllers/home')
const uploadCont = require('./controllers/upload')
const scanCont = require('./controllers/scan')

let app = express();

// Middlewares
app.use(cors())
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({
  extended: true
}));

// Routes
app.get('/', homeCont.home);
app.post('/upload', upload.single('image'), uploadCont.uploadImage);
app.post('/upload-qr', upload.single('image'), uploadCont.uploadQR);
app.post('/v1/scan', scanCont.scan);

const { time } = require('console');

app.listen(process.env.PORT || 8080, () => console.log('Listening on port ' +  (process.env.PORT || 8080)));