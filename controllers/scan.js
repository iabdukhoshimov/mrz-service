// var QrCode = require('qrcode-reader');
// const express = require("express");
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
// const cors = require('cors');
// const multer = require('multer');
const fs = require("fs");
const Image = require('image-js').Image;
const { getMrz, readMrz } = require('../src');
var mrzParser = require('../utils/mrz-parser.js');

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

module.exports = {
    scan: async (req, res) => {
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
      }
}