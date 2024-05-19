// require the needed modules
var express = require('express');

var swaggerUi = require('swagger-ui-express');
var docs = require('../docs/swagger.json');
const { SwaggerTheme } = require('swagger-themes');

const theme = new SwaggerTheme();

var router = express.Router();

const options = {
	explorer: false,
	customSiteTitle: 'E-Schrijvers API Documentation v1',
	customCss: theme.getBuffer('dark-monokai'),
	customfavIcon: "/favicon.ico",
};

// user docs
router.use('/', swaggerUi.serve, swaggerUi.setup(docs, options));

module.exports = router;