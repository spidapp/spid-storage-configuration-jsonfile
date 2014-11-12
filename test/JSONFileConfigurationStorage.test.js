'use strict';

var fs                           = require('fs');
var JSONFileConfigurationStorage = require('../');
var Configuration                = require('./stub/Configuration');
var p                            = require('path');
var t                            = require('chai').assert;
var _                            = require('lodash');
var ensure                         = require('file-ensure');

var KEY                          = 'storage';
var VALUE                        = 'spid-storage-configuration-jsonfile';
var PREFIX                       = 'configuration-jsonfile';
var PROPERTIES                   = {'storage': 'spid-storage-configuration-jsonfile'};
var JSON_FILE                    = p.resolve(__dirname, './fixtures/spid.conf.json');
var JSON_FILE2                    = p.resolve(__dirname, './fixtures/spid2.conf.json');


describe('BootfileConfigurationStorage', function () {
  var storage, configuration;

  beforeEach(function (done) {
    try{
      fs.unlinkSync(JSON_FILE);
      fs.unlinkSync(JSON_FILE2);
    }catch(err){}
    ensure(JSON_FILE);
    ensure(JSON_FILE2);
    storage                      = new JSONFileConfigurationStorage(JSON_FILE);
    configuration                = Configuration.get();
    done();
  });

  it('default configuration should be available', function (f) {
    storage.init(configuration, function(err){
      if(err){throw err;}
    });

    f();
  });

  it('should connect to storage', function (f) {
    storage.init(configuration, function(err){
      t.equal(err, void 0);
      storage.dispose(f);
    });
    configuration.test.f(null, _.extend({}, configuration.test.params));
  });

  describe('once initialized', function () {
    beforeEach(function (f) {
      // init config
      storage.init(configuration, function (err){
        if(err){throw err;}
        f();
      });
      configuration.test.f(null, _.extend({}, configuration.test.params));
    });

    describe('.write', function () {
      it('should be able to write to storage', function (f) {
        storage.write(PREFIX, PROPERTIES, function(err){
          t.strictEqual(err, null);
          f();
        });
      });
    });

    describe('.read', function () {
      it('should be able to read non-existent key', function (f) {
        storage.remove(PREFIX, [KEY], function(err){
          t.strictEqual(err, null);
          storage.read(PREFIX, [KEY], function(err, value){
            t.strictEqual(err, null);
            t.strictEqual(value[KEY], undefined);
            f();
          });
        });
      });

      it('should be able to read key', function (f) {
        storage.write(PREFIX, PROPERTIES, function(err){
          t.strictEqual(err, null);
          storage.read(PREFIX, [KEY], function(err, value){
            t.strictEqual(err, null);
            t.strictEqual(value[KEY], VALUE);
            f();
          });
        });
      });
    });

    describe('.remove', function () {
      it('should be able to remove a non-existent key', function (f) {
        storage.remove(PREFIX, [KEY], function(err){
          t.strictEqual(err, null);
          f();
        });
      });

      it('should be able to remove a key', function (f) {

        // write first the value
        storage.write(PREFIX, PROPERTIES, function(err, value){

          // then express the will to watch the key
          storage.watch(PREFIX, [KEY], function(updatedProperties){
            // @todo: should be Storage.DELETED, but this would require modules to require the storage to have this value?
            t.strictEqual(updatedProperties[KEY], undefined);
            f();
          });

          // then remove it and wait for the watch
          storage.remove(PREFIX, [KEY], function(err){
            t.strictEqual(err, null);
          });
        });
      });
    });

    describe('.watch', function () {
      it('should be able to watch for a key change', function (f) {
        storage.watch(PREFIX, ['a', 'b', 'c'], function(updatedProperties){
          t.strictEqual(updatedProperties['b'], 'hello world');
          f();
        });

        storage.write(PREFIX, {'b': 'hello world'}, function(err){
          //
        });
      });
    });

    describe('on configuration change', function () {
      it('should change the file backend', function (f) {
        storage.write(PREFIX, {'b': 'hello world'}, function(err){
          configuration.test.f({filename: JSON_FILE}, {filename: JSON_FILE2}, function(){
            storage.read(PREFIX, ['b'], function(err, properties){
              t.strictEqual(err, null);
              t.strictEqual(properties['b'], undefined);
              f();
            });
          });
        });
      });
    });

    afterEach(function (f) {
      storage.dispose(f);
    });
  });
});
