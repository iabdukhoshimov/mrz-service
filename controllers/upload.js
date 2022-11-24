// var QrCode = require('qrcode-reader');
// const express = require("express");
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
// const cors = require('cors');
// const multer = require('multer');
const fs = require("fs");
var mrzParser = require('../utils/mrz-parser.js');
const Image = require('image-js').Image;
const { getMrz, readMrz } = require('../src');
const path = require('path');

module.exports = {

    uploadImage: async (req, res) => {
        let resp = {
          result: null,
          error: null,
          status: "",
          version: "5.1.1"
        }
      
        try {
          console.log(req.file)
          console.log(`../data/out/_${req.file.filename}`)
          let infoSharp = await sharp("../" + req.file.path)
          .resize({
            width: 2000,
          })
          .toFile(`../data/out/_${req.file.filename}`);

      
          console.log("InfoSharp >>", infoSharp)
          let obj = {}
          const img = await Image.load(`../data/out/_${req.file.filename}`);
          let mrzImage = await getMrz(img);
          let outImg = `../data/out/${req.file.filename}`
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
    },

    uploadQR: async (req, res) => {
        let resp = {
          result: null,
          error: null,
          status: "",
          version: "5.1.1"
        }
      
        var Jimp = require("jimp");
      
        async function scanQrCode() {
          return new Promise(function(resolve, reject) {
            // var buffer = fs.readFileSync(__dirname + `../data/uploads/${req.file.filename}`);
            var buffer = fs.readFileSync(path.join(process.cwd(), 'data', 'uploads', req.file.filename), 'utf-8');
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
    }

}