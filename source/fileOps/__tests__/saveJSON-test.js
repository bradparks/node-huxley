var expect = require('expect');

var rimraf;
// loadJSON isn't worth testing by itself
var loadJSON;
var path;
var saveJSON;

describe('saveJSON', function() {
  beforeEach(function() {
    rimraf = require('rimraf');
    loadJSON = require('../loadJSON');
    path = require('path');
    saveJSON = require('../saveJSON');
  });

  it('creates new dirs and save the file', function(done) {
    var json = {asd: [1, 2], b: 'a'};
    var p = path.join(__dirname, 'fixture/a/b/c');
    saveJSON(p, json)
      .then(function() {
        return loadJSON(p);
      })
      .then(function(res) {
        expect(res).toEqual(json);
        done();
      })
      .catch(done)
      .finally(function() {
        rimraf.sync(path.join(__dirname, 'fixture/a'));
      });
  });

  // it('dedupes paths', function(done) {
  //   var glob = __dirname + '/fixture/**';
  //   var expected = [
  //     'fixture/Huxleyfile.json',
  //     'fixture/nested/Huxleyfile.json',
  //   ];
  //   compare(saveJSON, [glob, glob], expected, done);
  // });
});
