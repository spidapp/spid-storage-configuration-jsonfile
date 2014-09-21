'use strict';

var ConfigurationStorageInterface  = require('spid-storage-configuration-interface');
var _                              = require('lodash');

// @todo use something else that jsonfile & file-ensure, both lib really SUCKS.
var jf                             = require('jsonfile');

function JSONFileConfigurationStorage(jsonfile) {
  /**
   * Default json file
   * @type {String}
   */
  this._jsonfilename = jsonfile || null;

  /**
   * Array of listeners
   * @type {Array} array of object {keys:Array[String], f(key: String, newValue: String):Function}
   */
  this._listeners  = [];
}

/**
 * Init the JSONFileConfigurationStorage
 * @param  {Function} f(err)
 */
JSONFileConfigurationStorage.prototype.init = function (configuration, f) {
  configuration({
    /**
     * @type {String} file name
     * @default `this._jsonfilename` value
     */
    filename: this._jsonfilename,
  }, _.partialRight(this.applyConfiguration.bind(this), f));
};

JSONFileConfigurationStorage.prototype.applyConfiguration = function (stale, fresh, f) {
  if(stale){
    // we don't have to do anything
  }

  if(fresh){
    this._jsonfilename = fresh.filename;
  }

  f();
};

/**
 * [dispose description]
 * @param  {Function} f(err)
 */
JSONFileConfigurationStorage.prototype.dispose = function (f) {
  this.unwatch(null, f);
};

/**
 * [read description]
 * @param  {[type]} key  [description]
 * @param  {[type]} value [description]
 * @param  {Function} f(err, value)
 */
JSONFileConfigurationStorage.prototype.read = function (key, f) {
  jf.readFile(this._jsonfilename, function(err, obj) {
    if(err instanceof SyntaxError && err.message === 'Unexpected end of input'){
      err = null;
      obj = {};
    }

    if(err){return f(err);}// @todo use SpidException

    /**
     * @FIXME
     * This method is clearly not efficient, we could simply save the object
     * inside an in-memory cache BUT it could trigger inconsistencies
     */
    f(null, obj[key] || null);
  }.bind(this));
};

/**
 * [write description]
 * @param  {[type]} key  [description]
 * @param  {[type]} value [description]
 * @param  {Function} f(err)
 */
JSONFileConfigurationStorage.prototype.write = function (key, value, f) {
  jf.readFile(this._jsonfilename, function(err, obj) {
    if(err instanceof SyntaxError && err.message === 'Unexpected end of input'){
      err = null;
      obj = {};
    }

    if(err){return f(err);}// @todo use SpidException

    // @todo this method is not atomic #filesystem

    if(value === undefined){
      delete obj[key];
    } else {
      obj[key] = value;
    }

    jf.writeFile(this._jsonfilename, obj, function(err) {
      if(err){return f(err);}// @todo use SpidException

      this.notifyChange(key, value);
      f(null);
    }.bind(this));
  }.bind(this));
};

/**
 * [write description]
 * @param  {[type]} key  [description]
 * @param  {Function} f(err)
 */
JSONFileConfigurationStorage.prototype.remove = function (key, f) {
  this.write(key, undefined, f);
};


/**
 * Watch keys for change
 * @param {Array[String]} keys array of keys to watch
 * @param {Function} f(key: String, newValue: String)
 */
JSONFileConfigurationStorage.prototype.watch = function (keys, f) {
  this._listeners.push({keys: keys, f: f});
};

/**
 * Unwatch keys
 * @param  {Array|Undefined} keys
 *                           if `keys` is not specified, all watchers will be removed
 * @param  {Function} f(err)
 * @return {[type]}     [description]
 */
JSONFileConfigurationStorage.prototype.unwatch = function (keys, f) {
  f = _.isFunction(f) ? f : _.noop;

  if(!keys){
    this._listeners = [];
    return f();
  }

  var sizeBefore = this._listeners.length;
  this._listeners = _.remove(this._listeners, function(listener){
    return listener.f === f && _.difference(keys, listener.f).length === 0;
  });
  f(sizeBefore - this._listeners.length !== 1 ? new Error('Listener not found') : null);
};

JSONFileConfigurationStorage.prototype.notifyChange = function(key, value){
  this._listeners.forEach(function(listener){
    if(listener.keys.indexOf(key) === -1){
      return; // skip
    }

    listener.f(key, value);
  });
};


module.exports = ConfigurationStorageInterface.ensureImplements(JSONFileConfigurationStorage);
