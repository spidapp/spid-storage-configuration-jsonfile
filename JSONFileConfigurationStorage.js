'use strict';

var ConfigurationStorageInterface = require('spid-storage-configuration-interface');
var _ = require('lodash');
var async = require('async');

// @todo use something else that jsonfile & file-ensure, both lib really SUCKS.
var jf = require('jsonfile');

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
  this._listeners = [];
}

JSONFileConfigurationStorage.prototype.init = function (configuration, f) {
  configuration({
    /**
     * @type {String} file name
     * @default `this._jsonfilename` value
     */
    filename: this._jsonfilename
  }, _.partialRight(this.applyConfiguration.bind(this), f));
};

JSONFileConfigurationStorage.prototype.applyConfiguration = function (stale, fresh, f) {
  if (stale) {
    // we don't have to do anything
  }

  if (fresh) {
    this._jsonfilename = fresh.filename;
  }

  f();
};

JSONFileConfigurationStorage.prototype.dispose = function (f) {
  this.unwatch(null, null, f);
};

JSONFileConfigurationStorage.prototype.read = function (prefix, keys, f) {
  jf.readFile(this._jsonfilename, function (err, obj) {
    if (err instanceof SyntaxError && err.message === 'Unexpected end of input') {
      err = null;
      obj = {};
    }

    if (err) {
      return f(err);
    } // @todo use SpidException

    /**
     * @FIXME
     * This method is clearly not efficient, we could simply save the object
     * inside an in-memory cache BUT it could trigger inconsistencies
     */
    var result = {};
    _.map(keys, function (key) {
      result[key] = obj[addPrefix(prefix, key)];
    });

    f(null, result);
  }.bind(this));
};

JSONFileConfigurationStorage.prototype.write = function (prefix, properties, f) {
  jf.readFile(this._jsonfilename, function (err, obj) {
    if (err instanceof SyntaxError && err.message === 'Unexpected end of input') {
      err = null;
      obj = {};
    }

    if (err) {
      return f(err);
    } // @todo use SpidException

    // @todo this method is not atomic #filesystem
    _.forEach(prefixProperties(properties, prefix), function (valueToWrite, key) {
      if (valueToWrite === undefined) {
        delete obj[key];
      } else {
        obj[key] = valueToWrite;
      }
    });

    jf.writeFile(this._jsonfilename, obj, function (err) {
      if (err) {
        return f(err);
      } // @todo use SpidException

      this.notifyChange(prefix, properties);
      f(null);
    }.bind(this));
  }.bind(this));
};

/**
 * [write description]
 * @param  {String|Array[String]} keys  [description]
 * @param  {Function} f(err)
 */
JSONFileConfigurationStorage.prototype.remove = function (prefix, keys, f) {

  if (_.isString(keys)) {
    var undefinedProperty = {};
    undefinedProperty[keys] = undefined;
    return this.write(prefix, undefinedProperty, f);
  }

  this.write(prefix, _.reduce(keys, function (undefinedProperties, key) {
    undefinedProperties[key] = undefined;
    return undefinedProperties;
  }, {}), f);
};


/**
 * Watch keys for change
 * @param {Array[String]} keys array of keys to watch
 * @param {Function} f(updatedProperties)
 */
JSONFileConfigurationStorage.prototype.watch = function (prefix, keys, f) {
  this._listeners.push({
    // e.g. {prefixedKey : rawKeyName, prefixedKey2 : rawKeyName2, ...}
    keys: withPrefixAsObject(keys, prefix),
    f: f
  });
};

/**
 * Unwatch keys
 * @param  {String} prefix
 * @param  {Array|Undefined} keys
 *                           if `keys` is not specified, all watchers will be removed
 * @param  {Function} f(err)
 */
JSONFileConfigurationStorage.prototype.unwatch = function (prefix, keys, f) {
  f = _.isFunction(f) ? f : _.noop;

  if (!keys) {
    if (!prefix) {
      // dispose configuration
      this._listeners = [];
      return f();
    }

    // @todo: remove all the keys with the given prefix
    return f();
  }

  var prefixedKeys = withPrefix(keys, prefix);
  var sizeBefore = this._listeners.length;
  this._listeners = _.remove(this._listeners, function (listener) {
    return listener.f === f && _.difference(prefixedKeys, _.keys(listener.keys)).length === 0;
  });
  f(sizeBefore - this._listeners.length !== 1 ? new Error('Listener not found') : null);
};

JSONFileConfigurationStorage.prototype.notifyChange = function (prefix, properties) {
  var prefixedKeys = withPrefix(_.keys(properties), prefix);
  this._listeners.forEach(function (listener) {
    // diff({c, e}, {a, b, c}) -> {e} -> keep ("c" has been updated)
    // diff({e, d}, {a, b, c}) -> {e, d} -> skip
    if (_.difference(prefixedKeys, _.keys(listener.keys)).length === prefixedKeys.length) {
      return; // skip
    }

    // Take the following example :
    // diff({c, e}, {a, b, c}) -> {e} -> keep ("c" has been updated)
    // we don't want to call the listener with the "e" key/value, we just want to forward
    // "c" key/value.

    var propertiesForCurrentListener = _.intersection(prefixedKeys, _.keys(listener.keys)).reduce(function (fresh, prefixedKey) {
      fresh[listener.keys[prefixedKey]] = properties[listener.keys[prefixedKey]];
      return fresh;
    }, {});

    listener.f(propertiesForCurrentListener);
  });
};


module.exports = ConfigurationStorageInterface.ensureImplements(JSONFileConfigurationStorage);

// Helpers

/**
 * @param  {String|Array[String]} keys
 * @param  {String} prefix
 * @return {String|Array[String]}
 */
function withPrefix(keys, prefix) {
  if (_.isString(keys)) {
    return addPrefix(prefix, keys);
  }

  return keys.map(_.partial(addPrefix, prefix));
}

function addPrefix(prefix, key) {
  return prefix + '.' + key;
}

/**
 * Return object properties with prefixed keys
 * @param {Object} properties e.g. {key1: value1, key2: value2}
 * @param prefix
 * @return {Object} e.g. {prefixedKey1: value1, prefixedKey2: value2}
 */
function prefixProperties(properties, prefix) {
  var prefixedProperties = {};
  _.map(properties, function (value, key, properties) {
    prefixedProperties[addPrefix(prefix, key)] = value;
  });

  return prefixedProperties;
}

/**
 * @param  {Array[String]} keys
 * @param  {String} prefix
 * @return {Object}        e.g. {prefixedKey : rawKeyName, prefixedKey2 : rawKeyName2}
 */
function withPrefixAsObject(keys, prefix) {
  return keys.reduce(function (obj, key) {
    obj[addPrefix(prefix, key)] = key;
    return obj;
  }, {});
}
