/*jshint node:true*/
var cors = require('cors');

module.exports = function(app) {
  app.use('/analytics', cors({origin: true, credentials: true}), function(req, res) {
    res.end();
  });
};
