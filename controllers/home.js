const constants = require('../utils/constants')

module.exports = {
    home: async (req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(constants.form);
        return
    }
}