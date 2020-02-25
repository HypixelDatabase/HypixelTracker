const request = require('request');
const async = require('async');
const fs = require('fs');
const beautify_js = require('js-beautify').js;
const beautify_css = require('js-beautify').css;
const urls = require('./urls');

async.each(urls, function (s, cb) {
    const url = s.url;
    //grab raw data from each url and save
    console.log(url);
    if (typeof url === 'object') {
      async.map(url, (urlString, cb) => {
        request(urlString, (err, resp, body) => {
          cb(err, JSON.parse(body));
        });
      }, (err, resultArr) => {
        handleResponse(err, {
          statusCode: 200
        }, JSON.stringify(resultArr));
      });
    }
    else {
      request(url, handleResponse);
    }

    function handleResponse(err, resp, body) {
      if (err || resp.statusCode !== 200) {
        return cb(err);
      }
      if (body.startsWith('{')) {
        body = JSON.parse(body);
        return fs.writeFileSync(s.dest, JSON.stringify(body, null, 2));
      }
      if (s.url.endsWith('.js')) {
        body = beautify_js(body, { indent_size: 2, space_in_empty_paren: true })
      }
      if (s.url.includes('css')) {
        body = beautify_css(body, { indent_size: 2, space_in_empty_paren: true })
      }
      if (s.transform) {
        body = s.transform(body);
      }
      fs.writeFileSync(s.dest, body);
      cb(err);
    }
  },
  function (err) {
    if (err) {
      throw err;
    }
    process.exit(0);
  });
