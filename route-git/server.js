"use strict";
const config  = require("$custom/config");
const http    = require('http');
const httpProxy = require('http-proxy');
const Q 			= require('q');
const fs      = require('fs');
const path    = require('path');
const moment 	= require('moment');
const repos 	= require('pushover')(config.source, { autoCreate: false });

const control = require("$custom/touno-git").control;
const auth 		= require("$custom/touno-git").auth;
const db 		  = require("$custom/mysql").connect();

module.exports = { 
  listen: function(){
    var proxy = new httpProxy.createProxyServer({
      target: { host: 'local-web', port: 3000, ws: true }
    });

    var git = http.createServer(function (req, res) {
      if(!/Mozilla\/[0-9\.]+/ig.exec(req.headers['user-agent'])) {
        auth.access(req.headers).then(function(next){
          if(next) {
            repos.handle(req, res);
          } else {
            res.statusCode = 401;
            res.setHeader('WWW-Authenticate', 'Basic realm="Secure Area"');
            res.end();
          }
        });
      } else if(/(\d{2,3})\/([0-9a-f]{32})/g.test(req.url)) {
        let file = /(\d{2,3})\/([0-9a-f]{32})/g.exec(req. url);
        let none = `${__dirname}/../asset/gravatar/${file[1]}/00000000000000000000000000000000.jpg`;
        let avatar = `${__dirname}/../asset/gravatar/${file[1]}/${file[2]}.jpg`;

        fs.readFile(avatar, function(error, content) {
          if (error) {
            fs.readFile(none, function(error, content) {
              res.writeHead(200, { 'Content-Type': 'image/jpg' });
              res.end(content, 'utf-8');
            });
          } else {
            res.writeHead(200, { 'Content-Type': 'image/jpg' });
            res.end(content, 'utf-8');
          }
        });
      } else {
        proxy.web(req, res);
        proxy.on('error', function (err, req, res) {
          res.writeHead(500, {
            'Content-Type': 'text/plain'
          });

          res.end('Something went wrong. And we are reporting a custom error message.');
        });
      }
    });

    git.on('upgrade', function (req, socket, head) {
      proxy.ws(req, socket, head);
    });

    // EVENT
    repos.on('push', require('./events/push'));
    repos.on('fetch', require('./events/fetch'));
    repos.on('tag', require('./events/tag'));
    repos.on('info', require('././events/info'));
    repos.on('head', require('./events/head'));
    repos.on('response', require('./events/response'));

    db.select('repositories', {}).then(function(rows){
      var items = [];
      rows.forEach(function(row){ items.push(control.create(row)); });
      return Q.all(items);
    }).then(function(){
      // SERVER SOURCECONTROL //
      git.listen(config.git, function() {
        console.log('SourceControl listening on port ' + config.git + ' at ' + moment().format("HH:mm:ss"));
        // console.log('sample:', 'http://'+config.domain+':'+config.git+'/collection/product-test.git');
      });
    }).catch(function(ex){
      db.end();
      console.log('error:', ex);
    });

  },
  backup: function(dir, bundle_name){

  },
  restore: function() {
    
  }
}