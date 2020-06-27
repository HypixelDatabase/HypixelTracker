const request = require('request');
const async = require('async');
const merge = require('deepmerge')
const fs = require('fs');
const yauzl = require("yauzl");
const beautify_js = require('js-beautify').js;
const beautify_css = require('js-beautify').css;
const urls = require('./urls');
const player = require('./API/player.json') || {};
const skyblock_profile = require('./API/skyblock_profile.json') || {};
const apiKey = process.env.HYPIXEL_API_KEY;

function normalizeObject(o) {
  Object.keys(o).forEach(key => {
    let entry = o[key];
    switch (typeof entry) {
      case 'number':
        entry = 0;
        break;
      case 'string':
        entry = '';
        break;
      case 'boolean':
        entry = true;
        break;
      default:
        if (Array.isArray(entry)) {
          entry = [];
        } else if (entry === null) {
          entry = '';
        } else {
          entry = normalizeObject(entry);
        }
    }
    o[key] = entry;
  })
  return o;
}

async.each(urls, function (s, cb) {
    const url = s.url;
    //grab raw data from each url and save
    console.log(url);
    if (s.values) {
      let obj = (url.includes('/skyblock'))
        ? skyblock_profile
        : player;
      async.each(s.values, (value, cb) => {
        const urlString = url.replace('VALUE', value).replace('KEY', apiKey);
        request(urlString, (err, resp, body) => {
          obj = merge(obj, JSON.parse(body))
          cb(err);
        });
      }, (err) => {
        if (url.includes('/skyblock')) {
          let uuid = {};
          Object.keys(obj.profile.members).forEach(profile => {
            uuid = merge(uuid, obj.profile.members[profile]);
            delete obj.profile.members[profile];
          });
          obj.profile.members.uuid = uuid;
        }
        handleResponse(err, {
          statusCode: 200
        }, JSON.stringify(normalizeObject(obj)));
      });
    } else {
      request(url, handleResponse);
    }

    function handleResponse(err, resp, body) {
      if (err || resp.statusCode !== 200) {
        return cb(err);
      }
      if (body.startsWith('{')) {
        body = JSON.parse(body);
        if (!body.success) return;
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
  });

const sources = [
  {
    url: 'http://rpsrv.hypixel.net/packs/8/SuperSmashSanic.zip',
    dest: './ResourcePacks/SuperSmashSanic'
  },
  {
    url: 'http://rpsrv.hypixel.net/packs/8/HypixelBlank.zip',
    dest: './ResourcePacks/HypixelBlank'
  },
  {
    url: 'http://rpsrv.hypixel.net/packs/8/WarlordsAug16.zip',
    dest: './ResourcePacks/WarlordsAug16'
  },
  {
    url: 'http://rpsrv.hypixel.net/packs/8/MineKarts18.zip',
    dest: './ResourcePacks/MineKarts18'
  },
];
async.each(sources, (s, cb) => {
  request(s.url, { encoding: null }, (err, res, body) => {
    yauzl.fromBuffer(body, { lazyEntries: true }, (err, zipfile) => {
      if (err) throw err;
      zipfile.readEntry();
      zipfile.on('entry', (entry) => {
        const dest = `${s.dest}/${entry.fileName}`;
        if (/\/$/.test(entry.fileName)) {
          fs.mkdir(dest, { recursive: true }, (err) => {
            if (err) throw err;
            zipfile.readEntry();
          });
        } else {
          // file entry
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) throw err;
            const writeStream = fs.createWriteStream(dest);
            readStream.on('end', () => zipfile.readEntry());
            readStream.pipe(writeStream);
          });
        }
      });
    });
  })
});
