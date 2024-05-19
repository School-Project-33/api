#!/usr/bin/env node

/**
 * Module dependencies.
 */

var app = require('../app');
var debug = require('debug')('todos:server');
var http = require('http');
var config = require('../configs/config.json');

/**
 * Get port from environment and store in Express.
 */

var port = normalizePort(config.server.port || '3000');
app.set('port', port);

/**
 * Create HTTP server.
 */

var server = http.createServer(app);

/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

/**
 * Normalize a port into a number, string, or false.
 */ 

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */


// listen for commands in the console for commands like "exit" or "quit"
process.stdin.resume();
process.stdin.setEncoding('utf8');
process.stdin.on('data', async function (text) {
  const chalk = await import('chalk').then(mod => mod.default);
  text = text.trim();
  if (text === 'quit' || text === 'exit') {
    console.log('Exiting...');
    process.exit();
  } else if (text === 'help') {
    console.log('Commands: \nexit - exit the application\nhelp - show this help\nopen - open the phpmyadmin page and the current website\n');
  } else if(text == 'o'|| text == 'open'){
    var opn = require('opn');
    opn('http://localhost:'+port);
    setTimeout(function(){
      opn('https://database.discordbothosting.com')
      console.log('Database login info: \nUsername: '+`${chalk.cyan(config.db.username)}`+"\nPassword: "+ `${chalk.redBright(config.db.password)}`)
    }, 1000);
  }
  else {
    console.log('Unknown command. Type "help" for a list of commands.\n');
  }
});

console.clear();

function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug('Listening on ' + bind);
  console.log('listening on ' + bind + '\n');
}
