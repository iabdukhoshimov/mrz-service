'use strict';

var QrCode = require('qrcode-reader');
const express = require("express");
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const cors = require('cors');
const multer = require('multer');
const fs = require("fs");
var mrzParser = require('./utils/mrz-parser.js');
let app = express();
app.use(cors())


let form = "<!DOCTYPE HTML><html><body>" +
  "<form method='post' action='/upload' enctype='multipart/form-data'>" +
  "<input type='file' name='image'/>" +
  "<input type='submit' /></form>" +
  "<h1>Scan id card</h1>" +
  "<form method='post' action='/upload-qr' enctype='multipart/form-data'>" +
  "<input type='file' name='image'/>" +
  "<input type='submit' /></form>" +
  "</body></html>";

app.get('/', function (req, res) {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(form);
});


let storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './data/uploads')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname)
  }
})

let upload = multer({ storage: storage })

const Image = require('image-js').Image;
const { getMrz, readMrz } = require('./src');

app.post('/upload', upload.single('image'), async function (req, res) {
  let resp = {
    result: null,
    error: null,
    status: "",
    version: "5.1.1"
  }

  try {
    let infoSharp = await sharp(req.file.path)
    .resize({
      width: 2000,
    })
    .toFile(`./data/out/_${req.file.filename}`);

    console.log(infoSharp)
    let obj = {}
    const img = await Image.load(`./data/out/_${req.file.filename}`);
    let mrzImage = await getMrz(img);
    let outImg = `./data/out/${req.file.filename}`
    await mrzImage.save(outImg);

    const TesseractWorker = Tesseract.createWorker({
      langPath: './tessdata',
      gzip: false,
      logger: m => console.log(m)
    });
    await TesseractWorker.load();
    await TesseractWorker.loadLanguage('mrz5');
    await TesseractWorker.initialize('mrz5');
    await TesseractWorker.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<',
    });
   
    let { data: { text } } = await TesseractWorker.recognize(outImg);
    console.log(text)
    obj.text = text
    await TesseractWorker.terminate();

    obj.mrz = text.replace(/\s/g, '');

    obj.result = await mrzParser.parse(obj.mrz)
    console.log(obj)
    resp.result = {...obj
    }
    resp.status = "ok"

    console.log("it is here: ",resp.result.result.expiry)
    let parsed = new Date(resp.result.result.expiry.year, resp.result.result.expiry.month, resp.result.result.expiry.day)
    resp.result.result.givenDate = new Date(parsed.setDate(new Date(parsed.getDate()) - 3679));
    res.status(200)
    return res.send(resp)
  } catch (err) {
    console.error(err);
    resp.error = err.message
    resp.status = "error"
    res.status(400)
    return res.send(resp)
  }
});

app.post('/upload-qr', upload.single('image'), async function(req, res) {
  let resp = {
    result: null,
    error: null,
    status: "",
    version: "5.1.1"
  }

  var Jimp = require("jimp");

  async function scanQrCode() {
    return new Promise(function(resolve, reject) {
      var buffer = fs.readFileSync(__dirname + `/data/uploads/${req.file.filename}`);
      Jimp.read(buffer, function(err, image) {
        if (err) {
          console.error(err);
        }
        var qr = new QrCode();
        qr.callback = function(err, value) {
          if (err) {
            console.error(err);
          }
          try {
            let obj = {}
            obj.text = value.result
            obj.mrz = value.result.replace(/\s/g, '')
            let result = mrzParser.idParse(value.result.replace(/\s/g, ''))
            obj.result = result
            resp.result = {...obj}
            console.log("lalala: ",resp.result.result.expiry)
            let parsed = new Date(resp.result.result.expiry.year, resp.result.result.expiry.month, resp.result.result.expiry.day)
            resp.result.result.givenDate = new Date(parsed.setDate(new Date(parsed.getDate()) - 3679));
            resolve(resp)
          } catch {
            console.error(err);
            resp.status = "error"
            res.status(400)
            return res.send(resp)
          }
        };
        qr.decode(image.bitmap);
      })
    })
  }
  async function waitScan() {
    var a = await scanQrCode();
    a.status = "ok";
    console.log(a)
    return a;
  }

  return res.send(await waitScan());
});

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({
  extended: true
}));


const { time } = require('console');
function saveBlob(blob) {
  return new Promise(function (resolve, reject) {
    let fileName = Date.now() + "filename.jpeg";
    let filePath = "./data/uploads/" + fileName;
    fs.writeFile(filePath, blob, "base64", function (err, data) {
      if (err) reject(err);
      else resolve({
        fileName: fileName,
        filePath: filePath
      });
    });
  });
}

app.post('/v1/scan', async function (req, res) {
  let resp = {
    result: null,
    error: null,
    status: ""
  }

  try {
    if (!req.body.blob) {
      res.status(400)
      return res.send("blob field is empty or null")
    }

    let blob = req.body.blob.split(",")[1]; // split with `,`
    let fileInfo = await saveBlob(blob);

    console.log(fileInfo);

    let infoSharp = await sharp(fileInfo.filePath)
    .resize({
      width: 2000,
    })
    .toFile(`./data/out/_${fileInfo.fileName}`);

    console.log(infoSharp)

    let obj = {}
    const img = await Image.load(`./data/out/_${fileInfo.fileName}`);
    let mrzImage = await getMrz(img);
    let outImg = `./data/out/${fileInfo.fileName}`
    await mrzImage.save(outImg);

    const TesseractWorker = Tesseract.createWorker({
      langPath: './tessdata',
      gzip: false,
      logger: m => console.log(m)
    });
    await TesseractWorker.load();
    await TesseractWorker.loadLanguage('mrz5');
    await TesseractWorker.initialize('mrz5');
    await TesseractWorker.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<',
    });
    let { data: { text } } = await TesseractWorker.recognize(outImg);
    console.log(text)
    obj.text = text
    await TesseractWorker.terminate();

    obj.mrz = text.replace(/\s/g, '');

    try {
      obj.result = await mrzParser.parse(obj.text)
      console.log(obj)
      resp.result = {
        "surname": obj.result.names.lastName,
        "givenNames": obj.result.names.names[0],
        "documentNumber": obj.result.documentNumber,
        "personalNumber": obj.result.personalNumber,
        "formattedDateOfBirth": `${obj.result.dob.day}.${obj.result.dob.month}.${obj.result.dob.year}`,
        "formattedDateOfExpiry": `${obj.result.expiry.day}.${obj.result.expiry.month}.${obj.result.expiry.year}`,
        "sex": obj.result.sex.abbr,
      }
      resp.status = "ok"
    } catch (err) {
      console.error(err)
      resp.result = mrzParser.customParser(obj.text)
      resp.status = "warning"
    }
    
    console.log(resp)
    res.status(200)
    return res.send(resp)
  } catch (err) {
    console.error(err);
    resp.error = err.message
    resp.status = "error"
    res.status(400)
    return res.send(resp)
  }
});

const listener = app.listen(process.env.PORT || 8080, function () {
  console.log('Listening on port ' + listener.address().port);
});