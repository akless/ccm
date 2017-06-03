/**
 * @overview runtime environment for <i>ccm</i> components
 * @author André Kless <andre.kless@web.de> 2014-2016
 * @copyright Copyright (c) 2014-2016 André Kless
 * @license
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software
 * and associated documentation files (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, publish, distribute, sublicense, and/or sell
 * (<b>NOT MODIFY OR MERGE</b>) copies of the Software, and to permit persons to whom the Software is furnished
 * to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT
 * LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 * All rights that the author André Kless do not expressly grant in these Terms are reserved by the author André Kless.
 * @version 4.1.0
 * @changes
 * version 4.1.0 (19.01.2016):
 * - element property of ccm instances could be set to 'index' or 'parent' in instance configuration
 * - delete init functions automatically after one-time call
 * - add ccm helper function 'focusInput'
 * version 4.0.1 (12.01.2016):
 * - don't render ccm loading icon when call ccm.render (ccm instance already does that)
 * version 4.0.0 (31.12.2015):
 * - change convention for selecting inner elements of ccm instance website area in javascript and css
 * - add prefix "ccm-" to default website area html class of a ccm instance (incompatible change)
 * - each content website area of a ccm instance have the additional html class "ccm" for possibility to not selecting inner html tags from other instances
 * - init function of ccm instances must now have a callback to support asynchron operations (incompatible change)
 * - init function of ccm components and ccm datastores can have a callback to support asynchron operations
 * - improve many documentation comments
 * - refactoring
 * (for older version changes see ccm-3.2.1.js)
 */

( function () { var remote = true; var domain = remote ? 'https://kaul.inf.h-brs.de/ccm/' : ''; var p = remote ? 'p' : '';

// jQuery not exists? => load jQuery
if ( !window.jQuery ) {

  // body exists? => load asynchron
  if ( document.body ) {

    window.jQuery = document.createElement( 'script' );
    window.jQuery.setAttribute( 'src', remote ? 'https://code.jquery.com/jquery-2.1.4.min.js' : 'lib/jquery.min.js' );
    document.head.appendChild( window.jQuery );

  }
  // load synchron
  else document.write( '<script src="' + ( remote ? 'https://code.jquery.com/jquery-2.1.4.min.js' : 'lib/jquery.min.js' ) + '"></script>' );

}

/**
 * runtime environment for <i>ccm</i> components
 * @global
 * @namespace
 */
ccm = function () {

  /*---------------------------------------------- private ccm members -----------------------------------------------*/

  /**
   * @summary loaded <i>ccm</i> components
   * @memberOf ccm
   * @private
   * @type {Object.<ccm.index, ccm.component>}
   */
  var components = {};

  /**
   * @summary <i>ccm</i> database in IndexedDB
   * @memberOf ccm
   * @private
   * @type {ccm.db}
   */
  var db;

  /**
   * @summary already loaded resources
   * @memberOf ccm
   * @private
   * @type {object}
   */
  var resources = {};

  /**
   * @summary created <i>ccm</i> datastores
   * @memberOf ccm
   * @private
   * @type {Object.<ccm.source, ccm.store>}
   */
  var stores = {};

  /**
   * @summary waitlist with actions that wait for currently loading resources
   * @memberOf ccm
   * @private
   * @type {Object.<string, ccm.action[]>}
   */
  var waiter = {};

  /*---------------------------------------------- private ccm classes -----------------------------------------------*/

  /**
   * @summary constructor for creating <i>ccm</i> datastores
   * @memberOf ccm
   * @private
   * @class
   */
  var Datastore = function () {

    /*-------------------------------------------- ccm datastore members ---------------------------------------------*/

    /**
     * @summary websocket communication callbacks
     * @private
     * @this ccm.store
     * @type {function[]}
     */
    var callbacks = [];

    /**
     * @summary own context
     * @private
     * @this ccm.store
     * @type {ccm.store}
     */
    var self = this;

    /*----------------------------------------- public ccm datastore methods -----------------------------------------*/

    /**
     * @summary initialize datastore
     * @description when datastore is created
     */
    this.init = function () {

      // is realtime datastore? => set server notification callback
      if ( self.socket ) self.socket.onmessage = function ( message ) {

        // parse server message to JSON
        message = JSON.parse( message.data );

        // own request? => perform callback
        if ( message.callback ) callbacks[ message.callback - 1 ]( message.data );

        // notification about changed data from other client?
        else {

          // change data locally
          var dataset = jQuery.isPlainObject( message ) ? setLocal( message ) : delLocal( message );

          // perform change callback
          if ( self.onChange ) self.onChange( dataset, message );

        }

      };

    };

    /**
     * @summary get dataset(s)
     * @this ccm.store
     * @param {ccm.key|object} [key] - dataset key or query (default: get all stored datasets)
     * @param {function} [callback] - callback (first parameter are results)
     * @param {string|ccm.user} [user] - username or user instance for user authentication
     * @param {string} [password] - password for user authentication
     * @returns {ccm.dataset} result dataset(s) (only if synchron)
     */
    this.get = function ( key, callback, user, password ) {

      // allow to skip key parameter
      if ( typeof ( key ) === 'function' ) { password = user; user = callback; callback = key; key = {}; }

      // dataset key is undefined? => use empty object (to select all datasets)
      if ( key === undefined ) key = {};

      // check data source
      if ( self.url   ) return serverDB();    // serverside database
      if ( self.store ) return clientDB();    // clientside database
      if ( self.local ) return localCache();  // local cache

      /**
       * get dataset from local cache
       * @returns {ccm.dataset}
       */
      function localCache() {

        return getLocal( key, callback );

      }

      /**
       * get dataset from clientside database
       */
      function clientDB() {

        /**
         * local cached dataset
         * @type {ccm.dataset}
         */
        var dataset = checkLocal();

        // is dataset local cached? => return local cached dataset
        if ( dataset ) return dataset;

        /**
         * object store from IndexedDB
         * @type {object}
         */
        var store = getStore();

        /**
         * request for getting dataset
         * @type {object}
         */
        var request = store.get( key );

        // set success callback
        request.onsuccess = function ( evt ) {

          /**
           * result dataset
           * @type {ccm.dataset}
           */
          var dataset = evt.target.result;

          // dataset not exist? => abort
          if ( !dataset ) return callback( null );

          // save result dataset in local cache
          if ( dataset.key !== undefined ) self.local[ key ] = dataset;

          // perform callback with result dataset
          if ( callback ) callback( dataset );

        };

      }

      /**
       * get dataset from serverside database
       */
      function serverDB() {

        // get dataset by key?
        if ( !jQuery.isPlainObject( key ) ) {

          /**
           * local cached dataset
           * @type {ccm.dataset}
           */
          var dataset = checkLocal();

          // is dataset local cached? => return local cached dataset
          if ( dataset ) return dataset;

        }

        /**
         * GET parameter
         * @type {object}
         */
        var data = prepareData( { key: key }, user, password );

        // load dataset from server interface
        if ( self.socket ) useWebsocket( data, onResponse ); else useHttp( data, onResponse );

        /**
         * callback for server response
         * @param {ccm.dataset} results - result dataset(s)
         */
        function onResponse( results ) {

          // check server response
          if ( !checkResponse( results, user ) ) return;

          // no results? => abort
          if ( !results ) return callback( null );

          // save result dataset(s) in local cache
          if ( ccm.helper.isDataset( results ) )
            self.local[ results.key ] = results;
          else
            for ( var i = 0; i < results.length; i++ )
              if ( results[ i ].key !== undefined )
                self.local[ results[ i ].key ] = results[ i ];

          // perform callback with result dataset(s)
          callback( results );

        }

      }

      /**
       * check if dataset is local cached
       * @returns {ccm.dataset}
       */
      function checkLocal() {

        /**
         * local cached dataset
         * @type {ccm.dataset}
         */
        var dataset = getLocal( key );

        // is dataset local cached? => perform callback with local cached dataset
        if ( dataset && callback ) callback( dataset );

        // return local cached dataset
        return dataset;

      }

    };

    /**
     * @summary create or update dataset
     * @this ccm.store
     * @param {ccm.dataset} priodata - priority data
     * @param {function} [callback] - callback (first parameter is created or updated dataset)
     * @param {string|ccm.user} [user] - username or user instance for user authentication
     * @param {string} [password] - password for user authentication
     * @returns {ccm.dataset} created or updated dataset (only if synchron)
     * @example
     * // update ccm dataset with key 'A' or create it if it not exists
     * store.set( { key: 'A', value: 'B' } );
     * // update deeper properties with dot notation
     * store.set( { 'feedback.user.comment' : 'My comment'} } );
     */
    this.set = function ( priodata, callback, user, password ) {

      // priority data has no key? => generate key
      if ( !priodata.key ) priodata.key = ccm.helper.generateKey();

      // check data source
      if ( self.url   ) return serverDB();    // serverside database
      if ( self.store ) return clientDB();    // clientside database
      if ( self.local ) return localCache();  // local cache

      /**
       * set dataset in local cache
       * @returns {ccm.dataset} created or updated dataset
       */
      function localCache() {

        return setLocal( priodata, callback );

      }

      /**
       * set dataset in clientside database
       * @returns {ccm.dataset} created or updated dataset
       */
      function clientDB() {

        /**
         * object store from IndexedDB
         * @type {object}
         */
        var store = getStore();

        /**
         * request for setting dataset
         * @type {object}
         */
        var request = store.put( priodata );

        // set success callback
        request.onsuccess = localCache;

      }

      /**
       * set dataset in serverside database
       * @returns {ccm.dataset} created or updated dataset
       */
      function serverDB() {

        /**
         * GET parameter
         * @type {object}
         */
        var data = prepareData( { dataset: priodata }, user, password );

        // send priority data to server interface
        if ( self.socket ) useWebsocket( data, onResponse ); else useHttp( data, onResponse );

        /**
         * callback for server response
         * @param {ccm.dataset} dataset - created or updated dataset
         */
        function onResponse( dataset ) {

          // check server response
          if ( !checkResponse( dataset, user ) ) return;

          // set dataset in local cache
          priodata = dataset; localCache();

        }

      }

    };

    /**
     * @summary delete dataset
     * @this ccm.store
     * @param {ccm.key} [key] - dataset key (default: delete complete local cache)
     * @param {function} [callback] - callback  (first parameter is deleted dataset)
     * @param {string|ccm.user} [user] - username or user instance for user authentication
     * @param {string} [password] - password for user authentication
     * @returns {ccm.dataset} deleted dataset (only if synchron)
     */
    this.del = function ( key, callback, user, password ) {

      // check data source
      if ( self.url   ) return serverDB();    // serverside database
      if ( self.store ) return clientDB();    // clientside database
      if ( self.local ) return localCache();  // local cache

      /**
       * delete dataset in local cache
       * @returns {ccm.dataset} deleted dataset
       */
      function localCache() {

        return delLocal( key, callback );

      }

      /**
       * delete dataset in clientside database
       */
      function clientDB() {

        /**
         * object store from IndexedDB
         * @type {object}
         */
        var store = getStore();

        /**
         * request for deleting dataset
         * @type {object}
         */
        var request = store.delete( key );

        // set success callback
        request.onsuccess = localCache;

      }

      /**
       * delete dataset in serverside database
       */
      function serverDB() {

        /**
         * GET parameter
         * @type {object}
         */
        var data = prepareData( { del: key }, user, password );

        // send dataset key to server interface
        if ( self.socket ) useWebsocket( data, onResponse ); else useHttp( data, onResponse );

        /**
         * callback for server response
         * @param {ccm.dataset} dataset - deleted dataset
         */
        function onResponse( dataset ) {

          // check server response
          if ( !checkResponse( dataset, user ) ) return;

          // perform callback with deleted dataset
          if ( callback ) callback( dataset );

          // delete dataset in local cache
          callback = undefined; localCache();

        }

      }

    };

    /**
     * @summary get number of stored datasets
     * @this ccm.store
     * @param {function} [callback] - callback (first parameter is number of stored datasets)
     * @param {string|ccm.user} [user] - username or user instance for user authentication
     * @param {string} [password] - password for user authentication
     * @returns {number} number of stored datasets (only if synchron)
     */
    this.count = function ( callback, user, password ) {

      // check data source
      if ( self.url   ) return serverDB();    // serverside database
      if ( self.store ) return clientDB();    // clientside database
      if ( self.local ) return localCache();  // local cache

      /**
       * count number of stored datasets in local cache
       * @returns {number} number of stored datasets
       */
      function localCache() {

        /**
         * number of stored datasets
         * @type {number}
         */
        var count = Object.keys( self.local ).length;

        // perform callback with number of stored datasets
        if ( callback ) callback( count );

        // return number of stored datasets
        return count;

      }

      /**
       * count number of stored datasets in clientside database
       * @returns {number} number of stored datasets
       */
      function clientDB() {

        // no callback? => abort
        if ( !callback ) return -1;

        /**
         * object store from IndexedDB
         * @type {object}
         */
        var store = getStore();

        /**
         * request for counting datasets
         * @type {object}
         */
        var request = store.count();

        // set success callback
        request.onsuccess = function () {

          // perform callback with number of stored datasets
          callback( request.result );

        };

        // return dummy value
        return -1;

      }

      /**
       * count number of stored datasets in serverside database
       * @returns {number} number of stored datasets
       */
      function serverDB() {

        // no callback? => abort
        if ( !callback ) return -1;

        /**
         * GET parameter
         * @type {object}
         */
        var data = prepareData( { count: true }, user, password );

        // send count request to server interface
        if ( self.socket ) useWebsocket( data, onResponse ); else useHttp( data, onResponse );

        // return dummy value
        return -1;

        /**
         * callback for server response
         * @param {number} count - number of stored datasets
         */
        function onResponse( count ) {

          // check server response
          if ( !checkResponse( count, user ) ) return;

          // perform callback with number of stored datasets
          if ( callback ) callback( count );

        }

      }

    };

    /**
     * @summary clear local cache
     * @this ccm.store
     */
    this.clear = function () {

      self.local = {};

    };

    /*---------------------------------------- private ccm datastore methods -----------------------------------------*/

    /**
     * get dataset(s) from local cache
     * @param {ccm.key|object} [key={}] - dataset key or query (default: all stored datasets)
     * @param {function} [callback] - callback (first parameter is result dataset)
     * @returns {ccm.dataset} result dataset (only if synchron)
     */
    function getLocal( key, callback ) {

      // dataset key is a query? => find dataset(s) by query
      if ( key === undefined || jQuery.isPlainObject( key ) ) return find();

      /**
       * result dataset
       * @type {ccm.dataset}
       */
      var dataset = self.local[ key ] ? ccm.helper.clone( self.local[ key ] ) : null;

      // solve data dependencies
      solveDependencies( dataset, callback );

      // return result dataset (only synchron)
      return dataset;

      /**
       * @summary find dataset(s) by query
       * @returns {ccm.dataset[]} dataset(s)
       */
      function find() {

        /**
         * result dataset(s)
         * @type {ccm.dataset[]}
         */
        var results = [];

        /**
         * number of founded processing datasets
         * @type {number}
         */
        var counter = 1;

        // iterate over all stored datasets
        for ( var i in self.local ) {

          // query is subset of dataset?
          if ( ccm.helper.isSubset( key, self.local[ i ] ) ) {

            /**
             * founded dataset
             * @type {ccm.dataset}
             */
            var dataset = ccm.helper.clone( self.local[ i ] );

            // add founded dataset to result datasets
            results.push( dataset );

            // increment number of founded processing datasets
            counter++;

            // solve founded dataset data dependencies
            solveDependencies( dataset, check );

          }

        }

        // checks if processing of all founded datasets is finished (happens when no data dependencies exists)
        check();

        // return result dataset(s)
        return results;

        /**
         * checks if processing of all founded datasets is finished
         */
        function check() {

          // decrement number of founded processing datasets
          counter--;

          // finished processing of all founded datasets? => perform callback
          if ( counter === 0 && callback) callback( results );

        }

      }

      /**
       * solve ccm data dependencies for ccm dataset
       * @param {ccm.dataset} dataset - ccm dataset
       * @param {function} [callback] - callback
       */
      function solveDependencies( dataset, callback ) {

        /**
         * number of loading datasets
         * @type {number}
         */
        var counter = 1;

        /**
         * waitlist for ccm data dependencies which must be solved but wait for loading ccm datastore
         * @type {Array}
         */
        var waiter = [];

        // iterate over dataset properties
        for ( var key in dataset ) {

          /**
           * property value
           * @type {*}
           */
          var value = dataset[ key ];

          // value is a data dependency? => solve data dependency
          if ( ccm.helper.isDependency( value ) ) solveDependency( dataset, key ) ;

          // value is an array? => search array elements for data dependencies
          else if ( jQuery.isArray( value ) )
            for ( var i = 0; i < value.length; i++ )
              if ( ccm.helper.isDependency( value[ i ] ) )
                solveDependency( value, i );

        }

        // check if all data dependencies are solved (happens when no data dependencies exists)
        check();

        /**
         * solve data dependency
         * @param {ccm.dataset} dataset - dataset or array
         * @param {ccm.key} key - key or array index
         */
        function solveDependency( dataset, key ) {

          // needed ccm datastore is loading => add data dependency to waitlist
          if ( stores[ getSource( dataset[ key ][ 1 ] ) ] === null )
            return waiter.push( [ solveDependency, dataset, key ] );

          // increase number of loading datasets
          counter++;

          // solve data dependency
          ccm.helper.solveDependency( dataset, key, check );

        }

        /**
         * check if all data dependencies are solved
         */
        function check() {

          // decrease number of loading datasets
          counter--;

          // are not all data dependencies solved? => abort
          if ( counter !== 0 ) return;

          // waitlist not empty? => abort and solve a data dependency in waitlist
          if ( waiter.length > 0 ) return ccm.helper.action( waiter.pop() );

          // perform callback with result dataset
          if ( callback ) callback( dataset );

        }

      }

    }

    /**
     * set dataset in local cache
     * @param {ccm.dataset} priodata - priority data
     * @param {function} [callback] - callback (first parameter is created or updated dataset)
     * @returns {ccm.dataset} created or updated dataset
     */
    function setLocal( priodata, callback ) {

      // is dataset local cached? => update local dataset
      if ( self.local[ priodata.key ] )
        ccm.helper.integrate( priodata, self.local[ priodata.key ] );

      // dataset not local cached => cache dataset locally
      else self.local[ priodata.key ] = priodata;

      // return local cached dataset
      return getLocal( priodata.key, callback );

    }

    /**
     * delete dataset in local cache
     * @param {ccm.key} [key] - dataset key (default: delete complete local cache)
     * @param {function} [callback] - callback  (first parameter is deleted dataset)
     * @returns {ccm.dataset} deleted dataset
     */
    function delLocal( key, callback ) {

      /**
       * local cached dataset
       * @type {ccm.dataset}
       */
      var dataset;

      // no dataset key?
      if ( key === undefined ) {

        // get and clear local cache
        dataset = self.local;
        self.local = {};

      }

      // has dataset key
      else {

        // get and delete dataset
        dataset = self.local[ key ];
        delete self.local[ key ];

      }

      // perform callback with deleted dataset
      if ( callback ) callback( dataset );

      // return deleted dataset
      return dataset;

    }

    /**
     * get object store from IndexedDB
     * @returns {object}
     */
    function getStore() {

      /**
       * IndexedDB transaction
       * @type {object}
       */
      var trans = db.transaction( [ self.store ], 'readwrite' );

      // return object store from IndexedDB
      return trans.objectStore( self.store );

    }

    /**
     * prepare GET parameter data
     * @param data - individual GET parameters
     * @param {string|ccm.user} [user] - username or user instance for user authentication
     * @param {string} [password] - password for user authentication
     * @returns {object} GET parameter data
     */
    function prepareData( data, user, password ) {

      // get username
      user = user || self.user;

      // return GET parameter data
      return ccm.helper.integrate( data, {

        db:       self.db,
        store:    self.store,
        username: ccm.helper.isInstance( user ) ? user.key : user,
        password: password || self.password

      } );

    }

    /**
     * send data to server interface via websocket connection
     * @param {object} data - GET parameter data
     * @param {function} callback - callback for server response
     */
    function useWebsocket( data, callback ) {

      callbacks.push( callback );
      data.callback = callbacks.length;
      self.socket.send( JSON.stringify( data ) );

    }

    /**
     * send data to server interface via http request
     * @param {object} data - GET parameter data
     * @param {function} callback - callback for server response
     */
    function useHttp( data, callback ) {

      ccm.load( [ self.url, data ], callback );

    }

    /**
     * checks server response
     * @param {*} [response] - server response
     * @param {string|ccm.user} [user] - username or user instance for user authentication
     * @returns {boolean}
     */
    function checkResponse( response, user ) {

      // server response is error message?
      if ( typeof ( response ) === 'string' && response.indexOf( '[ccm]' ) === 0 ) {

        // has user instance? => logout
        if ( ccm.helper.isInstance( user ) ) user.logout();

        // abort processing
        return false;

      }

      // continue processing
      return true;

    }

  };

  return {

    /*---------------------------------------------- public ccm members ----------------------------------------------*/

    /**
     * callbacks when loading cross domain json files
     * @type {Object.<string, function>}
     * @ignore
     */
    callback: {},

    /**
     * @summary <i>ccm</i> loading icon
     * @memberOf ccm
     * @type {ccm.url}
     */
    loading_icon: domain + 'img/ccm-load-icon.gif',

    /**
     * @summary <i>ccm</i> version number
     * @memberOf ccm
     * @type {ccm.version}
     * @readonly
     */
    version: [ 4, 1, 0 ],

    /*---------------------------------------------- public ccm methods ----------------------------------------------*/

    /**
     * @summary load resource(s) (js, css, json and/or data from server interface)
     * @memberOf ccm
     * @param {...string|Array} resources - resource(s) URLs
     * @param {function} [callback] - callback when all resources are loaded (first parameter are the results)
     * @returns {*} results (only if all resources already loaded)
     * @example
     * // load ccm component for simple counter with callback (local path)
     * ccm.load( 'components/counter.js', function ( component ) { console.log( component ); } );
     * @example
     * // load ccm component for rendering text character by character (cross domain)
     * ccm.load( 'http://www.fh-lsoopjava.de/ccm/components/runningtext.js' );
     * @example
     * // load javascript file (local path)
     * ccm.load( 'scripts/helper.js' );
     * @example
     * // load newest version of jQuery UI (cross domain)
     * ccm.load( 'https://code.jquery.com/ui/1.11.4/jquery-ui.min.js' );
     * @example
     * // load css file (local path)
     * ccm.load( 'css/quizz.css' );
     * @example
     * // load image file (cross domain)
     * ccm.load( 'http://www.fh-lsoopjava.de/ccm/img/dialogbox.png' );
     * @example
     * // load json file with callback (local path)
     * ccm.load( 'json/quizz.json', function ( data ) { console.log( data ); } );
     * @example
     * // load json file with callback (cross domain), json file must look like this: ccm.callback[ 'question.json' ]( {...} );
     * ccm.load( 'http://www.fh-lsoopjava.de/ccm/jsonp/question.json', function ( data ) { console.log( data ); } );
     * @example
     * // data exchange between client and server php interface with callback (cross domain), php file must use jsonp
     * ccm.load( [ 'http://www.fh-lsoopjava.de/ccm/php/greetings.php', { name: 'world' } ], function ( response ) { console.log( response ); } );
     */
    load: function () {

      /**
       * number of loading resources
       * @type {number}
       */
      var counter = 1;

      /**
       * results
       * @type {*}
       */
      var results = [];

      /**
       * convert arguments to real array
       * @type {Array}
       */
      var args = Array.prototype.slice.call( arguments );

      /**
       * current ccm.load call
       * @type {ccm.action}
       */
      var call = args.slice( 0 ); call.unshift( ccm.load );

      /**
       * is this ccm.load call already waiting for currently loading resource(s)?
       * @type {boolean}
       */
      var waiting = false;

      /**
       * callback when all resources are loaded
       * @type {function}
       */
      var callback;

      // last argument is callback? => seperate arguments and callback
      if ( typeof ( args[ args.length - 1 ] ) === 'function' || args[ args.length - 1 ] === undefined )
        callback = args.pop();

      // iterate over all resource URLs => load resource
      for ( var i = 0; i < args.length; i++ )
        loadResource( args[ i ], i );

      // check if all resources are loaded (important if all resources already loaded)
      return check();

      /**
       * load resource
       * @param {string|Array} url - resource URL
       * @param {number} i
       */
      function loadResource( url, i ) {

        /**
         * GET parameter for potentially data exchange with server
         * @type {object}
         */
        var data;

        // is URL an array? => get URL of server interface and GET parameter
        if ( jQuery.isArray( url ) ) { data = url[ 1 ]; url = url[ 0 ]; }

        /**
         * already loaded value for this resource
         * @type {string}
         */
        var resource = resources[ url ];

        // mark resource as 'loading'
        resources[ url ] = null;

        // increase number of loading resources
        counter++;

        // GET parameter exists? => perform data exchange
        if ( data ) return exchangeData();

        /**
         * resource suffix
         * @type {string}
         */
        var suffix = url.split( '.' ).pop();

        // check resource suffix => load resource
        switch ( suffix ) {
          case 'html':
            return loadHTML();
          case 'css':
            return loadCSS();
          case 'jpg':
          case 'gif':
          case 'png':
          case 'svg':
            return loadImage();
          case 'js':
            return loadJS();
          case 'json':
            return loadJSON();
          default:
            exchangeData();
        }

        /**
         * (pre)load html file
         */
        function loadHTML() {

          // prevent loading resource twice
          if ( caching() ) return;

          // not cross domain request? => load html file without jsonp
          if ( url.indexOf( 'http' ) !== 0 )
            return jQuery.ajax( {

              url: url,
              cache: false,
              success: successData

            } );

          /**
           * name of html file
           * @type {string}
           */
          var filename = url.split( '/' ).pop();

          // deposit success callback
          ccm.callback[ filename ] = successData;

          // load (and execute) content of html file
          jQuery( 'head' ).append( '<script src="' + url + '"></script>' );

        }

        /**
         * load css file (immediate callback)
         */
        function loadCSS() {

          // CSS file not loaded yet? => load CSS file
          if ( !resource ) jQuery( 'head' ).append( '<link rel="stylesheet" type="text/css" href="' + url + '">' );

          // immediate perform success callback
          success();

        }

        /**
         * (pre)load image file (immediate callback)
         */
        function loadImage() {

          // image file not loaded yet? => load image file
          if ( !resource ) jQuery( '<img src="' + url + '">' );

          // immediate perform success callback
          success();

        }

        /**
         * load (and execute) javascript file
         */
        function loadJS() {

          // prevent loading resource twice
          if ( caching() ) return;

          // load javascript file
          jQuery.getScript( url, successJS ).fail( onFail );

        }

        /**
         * load json file
         */
        function loadJSON() {

          // prevent loading resource twice
          if ( caching() ) return;

          // not cross domain request? => load without jsonp
          if ( url.indexOf( 'http' ) !== 0 )
            return jQuery.getJSON( url, successData ).fail( onFail );

          /**
           * name of json file
           * @type {string}
           */
          var filename = url.split( '/' ).pop();

          // deposit success callback
          ccm.callback[ filename ] = successData;

          // load (and execute) content of json file
          jQuery( 'head' ).append( '<script src="' + url + '"></script>' );

        }

        /**
         * exchange data with server
         */
        function exchangeData() {

          // is this ccm.load call already waiting for currently loading resource(s)? => skip data exchange
          if ( waiting ) return;

          // is cross domain request? => use JSONP
          if ( url.indexOf( 'http' ) === 0 ) {

            jQuery.ajax( {

              url: url,
              data: data,
              dataType: 'jsonp',
              username: data && data.username ? data.username : undefined,
              password: data && data.password ? data.password : undefined,
              success: successData

            } );

          }

          // inner domain request => normal HTTP GET request
          else {

            jQuery.ajax( {

              url: url,
              data: data,
              username: data && data.username ? data.username : undefined,
              password: data && data.password ? data.password : undefined,
              success: successData

            } ).fail( onFail );

          }

        }

        /**
         * prevent loading resource twice
         * @returns {boolean} abort current ccm.load call
         */
        function caching() {

          // is resource currently loading?
          if ( resource === null ) {

            // is this ccm.load call already waiting? => abort
            if ( waiting ) return true; else waiting = true;

            // no waitlist for currently loading resource exists? => create waitlist
            if ( !waiter[ url ] ) waiter[ url ] = [];

            // add ccm.load call to waitlist
            waiter[ url ].push( call );

            // abort current ccm.load call (counter will not decrement)
            return true;

          }

          // resource already loaded?
          if ( resource ) {

            // result is already loaded resource value
            results[ i ] = resources[ url ] = resource;

            // skip loading process
            success(); return true;

          }

          // continue current ccm.load call
          return false;

        }

        /**
         * callback when a javascript file is successful loaded
         */
        function successJS() {

          /**
           * index of potentially loaded component
           * @type {string}
           */
          var index = getIndex( url );

          /**
           * potentially loaded component
           * @type {ccm.component}
           */
          var component = components[ index ];

          // javascript file is not a component? => skip component specific steps
          if ( !component ) return success();

          // add component to results and already loaded resources
          results[ i ] = resources[ url ] = component;

          // is component on waitlist? => perform waiting actions
          while ( waiter[ component.index ] && waiter[ component.index ].length > 0 )
            ccm.helper.action( waiter[ component.index ].pop() );

          // perform success callback
          success();

        }

        /**
         * callback when a data exchange is successful
         * @param {*} data - received data
         */
        function successData( data ) {

          // add received data to results and already loaded resources
          results[ i ] = resources[ url ] = data;

          // perform success callback
          success();

        }

        /**
         * callback when a resource is successful loaded
         */
        function success() {

          // mark resource as already loaded
          if ( !resources[ url ] ) resources[ url ] = url;

          // is resource on waitlist? => perform waiting actions
          while ( waiter[ url ] && waiter[ url ].length > 0 )
            ccm.helper.action( waiter[ url ].pop() );

          // check if all resources are loaded
          check();

        }

        /**
         * @summary callback when a server request fails
         * @param {ccm.JqXHR} jqxhr
         * @param {string} textStatus
         * @param {string} error
         */
        function onFail( jqxhr, textStatus, error ) {

          // print error object in console
          console.log( jqxhr, this.url );

          // render error report in website
          jQuery( 'body' ).html( jqxhr.responseText + '<p>Request Failed: ' + textStatus + ', ' + error + '</p>' );

        }

      }

      /**
       * check if all resources are loaded
       * @returns {*} results (only if all resources already loaded)
       */
      function check() {

        // decrease number of loading resources
        counter--;

        // are all resources loaded?
        if ( counter === 0 ) {

          // only one result? => use no array
          if ( results.length <= 1 ) results = results[ 0 ];

          // perform callback with results
          if ( callback ) callback( results );

          // return results
          return results;

        }

      }

    },

    /**
     * @summary register component
     * @memberOf ccm
     * @param {ccm.component|string} component - object or URL of <i>ccm</i> component
     * @param {function} [callback] - callback when <i>ccm</i> component is registered (first parameter is registered component)
     * @returns {ccm.component} object of <i>ccm</i> component (only if synchron)
     * @example ccm.register( { index: 'counter-2.1.0', Instance: function () { ... } } );
     * @example ccm.register( { name: 'counter', version: [1,8,2], Instance: function () { ... } } );
     * @example ccm.register( { name: 'counter', Instance: function () { ... } } );
     * @example ccm.register( 'counter.js );
     * @example ccm.register( 'components/counter-1.3.4.js );
     * @example ccm.register( 'http://ccm.inf.h-brs.de/components/counter-1.0.0.js );
     */
    register: function ( component, callback ) {

      // is URL of component? => abort and load component
      if ( typeof ( component ) === 'string' ) return ccm.load( component, callback );

      // set component index
      setIndex();

      // component already registered? => return already registered component
      if ( components[ component.index ] ) return components[ component.index ];

      // setup component
      setup();

      // register component
      components[ component.index ] = component;

      // initialize component
      if ( component.init ) component.init( proceed ); else proceed();

      function proceed() {

        // perform callback
        if ( callback ) callback( component );

      }

      /**
       * set ccm component index
       */
      function setIndex() {

        // has component index?
        if ( component.index ) {

          /**
           * name and version number of ccm component
           * @type {Array}
           */
          var array = component.index.split( '-' );

          // add name of ccm component
          component.name = array[ 0 ];

          // add version number of ccm component
          if ( array.length > 1 ) component.version = array[ 1 ].split( '.' );

          // parse version number to integer
          for ( var i = 0; i < 3; i++ )
            component.version[ i ] = parseInt( component.version[ i ] );

        }

        // component index is component name
        component.index = component.name;

        // has version? => append version number to component index
        if ( component.version )
          component.index += '-' + component.version.join( '.' );

      }

      /**
       * setup ccm component
       */
      function setup() {

        // add ccm instance counter
        component.instances = 0;

        // add function for creating and rendering ccm instances
        component.instance = function ( config, callback ) { return ccm.instance( component.index, config, callback ); };
        component.render   = function ( config, callback ) { return ccm.render  ( component.index, config, callback ); };

        // set default of default ccm instance configuration
        if ( !component.config )         component.config         = {};
        if ( !component.config.element ) component.config.element = jQuery( 'body' ); // TODO: only if html body is empty (else drag'n'drop box)

      }

    },

    /**
     * @summary create instance out of component (all needed resources will be loaded if necessary)
     * @memberOf ccm
     * @param {string} component - index or URL of component
     * @param {ccm.config|function} [config={}] - instance configuration, see documentation of associated component
     * @param {function} [callback] - callback when instance is created (first parameter is created instance)
     * @returns {ccm.instance} created instance (only if synchron)
     * @example
     * // create instance for simple counter with range=6 and callback
     * ccm.instance( 'components/counter.js', { range: 6 }, function ( instance ) { console.log( instance ); } );
     * @example
     * // same example but cross domain
     * ccm.instance( 'http://www.fh-lsoopjava.de/ccm/components/counter.js', function ( instance ) { console.log( instance ); } );
     */
    instance: function ( component, config, callback ) {

      // ccm instance configuration is a function? => configuration is callback
      if ( typeof ( config ) === 'function' ) { callback = config; config = undefined; }

      /**
       * @summary number of loading resources
       * @type {number}
       */
      var counter = 0;

      /**
       * result ccm instance
       * @type {ccm.instance}
       */
      var result;

      // start recursion to solve dependencies
      return recursive( component, config );

      /**
       * recursion to create instance and solve dependencies
       * @param {string} comp - index or URL of component
       * @param {ccm.config} [cfg={}] - instance configuration (current recursive level)
       * @param {ccm.config} [prev_cfg] - parent instance configuration (previous recursive level)
       * @param {string} [prev_key] - relevant key in parent instance configuration (previous recursive level)
       * @param {string} [parent] - parent instance (previous recursive level)
       * @returns {ccm.instance} created instance (only if synchron)
       */
      function recursive( comp, cfg, prev_cfg, prev_key, parent ) {

        /**
         * component index
         * @type {ccm.index}
         */
        var index = getIndex( comp );

        // increase number of loading resources
        counter++;

        // load ccm component if necessary (asynchron)
        return !components[ index ] ? ccm.load( comp, proceed ) : proceed();

        /**
         * proceed with creating ccm instance and solving dependencies
         * @returns {ccm.instance} created ccm instance (only if synchron)
         */
        function proceed() {

          // load instance configuration if necessary (asynchron)
          return ccm.helper.isDependency( cfg ) ? ccm.dataset( cfg[ 1 ], cfg[ 2 ], proceed ) : proceed( cfg );

          function proceed( cfg ) {

            /**
             * created instance
             * @type {ccm.instance}
             */
            var instance = new components[ index ].Instance();

            // integrate created instance
            components[ index ].instances++;                    // increment instance counter
            if ( prev_cfg ) prev_cfg[ prev_key ] = instance;    // set instance in instance configuration (previous recursive level)
            if ( parent ) instance.parent = parent;             // set parent instance
            if ( !result ) result = instance;                   // set result instance

            // config created instance
            instance.id = components[ index ].instances;                  // set ccm instance id
            instance.index = index + '-' + instance.id;                   // set ccm instance index
            instance.component = components[ index ];                     // set ccm component reference
            ccm.helper.integrate( components[ index ].config, instance ); // set default ccm instance configuration
            if ( cfg ) ccm.helper.integrate( cfg, instance );             // integrate ccm instance configuration

            switch ( instance.element ) {
              case 'index': instance.element = parent.element.find( '.' + instance.component.name + ':not(#ccm-' + parent.index + ' .ccm *)' ); break;
              case 'parent': instance.element = parent.element;
            }

            // solve dependencies of created ccm instance
            solveDependencies( instance );

            // check if all dependencies are solved
            return check();

            /**
             * solve dependencies of created ccm instance (recursive)
             * @param {ccm.instance|Array} instance_or_array - ccm instance or inner array
             */
            function solveDependencies( instance_or_array ) {

              // iterate over all ccm instance properties
              for ( var key in instance_or_array ) {

                /**
                 * property value
                 * @type {*}
                 */
                var value = instance_or_array[ key ];

                // is dependency? => solve dependency
                if ( ccm.helper.isDependency( value ) ) solveDependency( instance_or_array, key );

                // value is an array or object?
                else if ( typeof( value ) === 'object' && value !== null ) {

                  // jQuery element or ccm instance? => skip
                  if ( value instanceof jQuery || value.component || value.Instance ) continue;

                  // search it for dependencies (recursive call)
                  solveDependencies( value );

                }

              }

              /**
               * solve ccm instance dependency
               * @param {ccm.instance|Array} instance_or_array - ccm instance or inner array
               * @param {string|number} key - ccm instance property key or array index
               */
              function solveDependency( instance_or_array, key ) {

                /**
                 * ccm instance dependency that must be solved
                 * @type {ccm.action}
                 */
                var action = instance_or_array[ key ];

                // check type of dependency => solve dependency
                switch ( action[ 0 ] ) {

                  case ccm.load:
                  case "ccm.load":
                    counter++;
                    ccm.load( action[ 1 ], setResult );
                    break;

                  case ccm.register:
                  case "ccm.register":
                    counter++;
                    ccm.register( action[ 1 ], setResult );
                    break;

                  case ccm.instance:
                  case "ccm.instance":
                    recursive( action[ 1 ], action[ 2 ], instance_or_array, key, instance ); // recursive call
                    break;

                  case ccm.proxy:
                  case "ccm.proxy":
                    proxy( action[ 1 ], action[ 2 ], instance_or_array, key, instance );
                    break;

                  case ccm.store:
                  case "ccm.store":
                    counter++;
                    ccm.store( action[ 1 ], setResult );
                    break;

                  case ccm.dataset:
                  case "ccm.dataset":
                    counter++;
                    ccm.dataset( action[ 1 ], action[ 2 ], setResult );
                    break;

                }

                /**
                 * set result of solved ccm instance dependency
                 * @param {*} result
                 */
                function setResult( result ) {

                  // set result of solved ccm instance dependency
                  instance_or_array[ key ] = result;

                  // check if all ccm instance dependencies are solved
                  check();

                }

                /**
                 * create proxy for lazy loading ccm instance
                 * @param {string} component - URL of ccm component
                 * @param {ccm.config} [config={}] - ccm instance configuration, see documentation of associated ccm component
                 * @param {ccm.instance|Array} instance_or_array - parent ccm instance or inner array
                 * @param {string|number} key - parent ccm instance property key or array index
                 * @param {ccm.instance} parent - parent ccm instance
                 */
                function proxy( component, config, instance_or_array, key, parent ) {

                  // load instance configuration if necessary (asynchron)
                  ccm.helper.isDependency( config ) ? ccm.dataset( config[ 1 ], config[ 2 ], proceed ) : proceed( config );

                  function proceed( config ) {

                    instance_or_array[ key ] = {
                      component: component,
                      parent: parent,
                      render: function ( callback ) {
                        delete this.component;
                        delete this.initialized;
                        delete this.render;
                        if ( !config ) config = {};
                        ccm.helper.integrate( this, config );
                        ccm.render( component, config, function ( instance ) {
                          instance_or_array[ key ] = instance;
                          if ( callback ) callback();
                        } );
                      }
                    };

                  }

                }

              }

            }

            /**
             * check if all ccm instance dependencies are solved
             * @returns {ccm.instance} created instance (nur wenn synchron)
             */
            function check() {

              // decrease number of loading resources
              counter--;

              // are all ccm instance dependencies solved?
              if ( counter === 0 ) {

                // initialize created instances (start recursive with result instance)
                initialize( result, function () {

                  // perform callback with result instance
                  if ( callback ) callback( result );

                } );

              }

              // return result instance (only synchron)
              return counter === 0 ? result : null;

            }

            /**
             * initialize ccm instance and after it all dependent ccm instances (recursive)
             * @param {ccm.instance|Array} instance - ccm instance
             * @param {function} callback
             */
            function initialize( instance, callback ) {

              /**
               * number of initialising instances
               * @type {number}
               */
              var counter = 1;

              // start recursion
              init( instance );

              function init( instance ) {

                // is instance with no called init function?
                if ( instance.init && !instance.initialized ) {

                  // increment number of initialising instances
                  if ( ccm.helper.isInstance( instance ) ) counter++;

                  // initialize ccm instance
                  instance.init( function () {

                    // mark instance as initialized
                    if ( ccm.helper.isInstance( instance ) ) { instance.initialized = true; delete instance.init; }

                    // initialize dependent ccm instances
                    proceed();

                    // check if all instances are initialized
                    if ( ccm.helper.isInstance( instance ) ) check();

                  } );

                }
                else proceed();

                // check if all instances are initialized
                check();

                function proceed() {

                  // initialize all dependent ccm instances
                  for ( var key in instance ) {

                    /**
                     * ccm instance property value
                     * @type {*}
                     */
                    var value = instance[ key ];

                    // value is a ccm instance (but not parent)? => initialize ccm instance (recursive call)
                    if ( ccm.helper.isInstance( value ) && key !== 'parent' ) init( value );

                    // value is an array or object?
                    else if ( typeof( value ) === 'object' && value !== null ) {

                      // value is an jQuery element or ccm instance or ccm component? => skip
                      if ( value instanceof jQuery || value.component || value.Instance ) continue;

                      // search array/object for ccm instances (recursive call)
                      init( value );

                    }

                  }

                }

                /**
                 * check if all data dependencies are solved
                 */
                function check() {

                  // decrease number of initialising instances
                  counter--;

                  // are not all instances initialised? => abort
                  if ( counter !== 0 ) return;

                  // perform callback
                  if ( callback ) callback();

                }

              }

            }

          }

        }

      }

    },

    /**
     * @summary render <i>ccm</i> instance in website area (all needed resources will be loaded if necessary)
     * @memberOf ccm
     * @param {string} component - index or URL of <i>ccm</i> component
     * @param {ccm.config|function} [config={}] - <i>ccm</i> instance configuration, see documentation of associated <i>ccm</i> component
     * @param {function} [callback] - callback when <i>ccm</i> instance is rendered (first parameter is <i>ccm</i> instance)
     * @returns {ccm.instance} <i>ccm</i> instance (only if synchron)
     * @example
     * // render ccm instance for simple counter into div container with id="mydiv"
     * ccm.render( 'components/counter.js', { element: jQuery( '#mydiv' ) } );
     * @example
     * // same example but cross domain with counter range=6
     * ccm.render( 'http://www.fh-lsoopjava.de/ccm/components/counter.js', { range: 6 } );
     */
    render: function ( component, config, callback ) {

      // create ccm instance out of ccm component
      ccm.instance( component, config, function ( instance ) {

        // render ccm instance in her website area
        instance.render( function () {

          // perform callback with ccm instance
          if ( callback ) callback( instance );

        } );

      } );

    },

    /**
     * @summary create <i>ccm</i> datastore or get existing <i>ccm</i> datastore if it have the same source
     * @memberOf ccm
     * @param {ccm.settings|function} [settings] - <i>ccm</i> datastore settings (or callback if skiped)
     * @param {function} [callback] - callback when <i>ccm</i> datastore is created (first parameter is created <i>ccm</i> datastore)
     * @returns {ccm.store} created <i>ccm</i> datastore (only if synchron)
     * @example
     * // create empty ccm datastore using local cache (synchron)
     * ccm.store();
     * @example
     * // create ccm datastore using local cache with initial datasets by json file (asynchron)
     * ccm.store( { local: 'json/quizz.json' } );
     * @example
     * // same example but cross domain, json file must look like this: ccm.callback[ 'question.json' ]( {...} );
     * ccm.store( { local: 'http://www.fh-lsoopjava.de/ccm/jsonp/question.json' } );
     * @example
     * // create ccm datastore using clientside database IndexedDB (asynchron)
     * ccm.store( { store: 'test' } );
     * @example
     * // create ccm datastore using serverside database (asynchron), php file must be an ccm compatible interface
     * ccm.store( { url: 'http://www.fh-lsoopjava.de/ccm/php/interface.php' } );
     */
    store: function ( settings, callback ) {

      // settings are a function? => settings are callback
      if ( typeof ( settings ) === 'function' ) { callback = settings; settings = undefined; }

      // no ccm datastore settings? => use empty object
      if ( !settings ) settings = {};

      // ccm datastore settings are an URL? => use object with local cache entry that contains the URL
      if ( typeof ( settings ) === 'string' ) settings = { local: settings };

      // make deep copy of settings
      settings = ccm.helper.clone( settings );

      /**
       * ccm datastore source
       * @type {string}
       */
      var source = getSource( settings );

      // existing ccm datastore have the same source?
      if ( stores[ source ] ) {

        // perform callback with existing ccm datastore
        if ( callback ) callback( stores[ source ] );

        // return existing ccm datastore
        return stores[ source ];

      }

      // no local cache? => use empty object
      if ( !settings.local ) settings.local = {};

      // local cache is an URL? => load initial datasets for local cache (could be asynchron)
      return typeof ( settings.local ) === 'string' ? ccm.load( settings.local, proceed ) : proceed( settings.local );

      /**
       * proceed with creating ccm datastore
       * @param {ccm.datasets} datasets - initial datasets for local cache
       * @returns {ccm.store} created ccm datastore
       */
      function proceed( datasets ) {

        // set initial datasets for local cache
        settings.local = datasets;

        // prepare ccm database if necessary (asynchron)
        return settings.store && !settings.url ? prepareDB( proceed ) : proceed();

        /**
         * prepare ccm database
         * @param {function} callback
         */
        function prepareDB( callback ) {

          // open ccm database if necessary (asynchron)
          !db ? openDB( proceed ) : proceed();

          /**
           * open ccm database
           * @param {function} callback
           */
          function openDB( callback ) {

            /**
             * request for opening ccm database (asynchron)
             * @type {object}
             */
            var request = indexedDB.open( 'ccm' );

            // set success callback
            request.onsuccess = function () {

              // set database object
              db = this.result;

              // perform callback
              callback();

            };

          }

          /**
           * proceed with preparing ccm database
           */
          function proceed() {

            // needed object store in IndexedDB not exists? => update ccm database (asynchron)
            !db.objectStoreNames.contains( settings.store ) ? updateDB( callback ) : callback();

            /**
             * update ccm database
             * @param {function} callback
             */
            function updateDB( callback ) {

              /**
               * current ccm database version number
               * @type {number}
               */
              var version = parseInt( localStorage.getItem( 'ccm' ) );

              // no version number? => start with 1
              if ( !version ) version = 1;

              // close ccm database
              db.close();

              /**
               * request for reopening ccm database
               * @type {object}
               */
              var request = indexedDB.open( 'ccm', version + 1 );

              // set onupgradeneeded callback
              request.onupgradeneeded = function () {

                // set database object
                db = this.result;

                // save new ccm database version number in local storage
                localStorage.setItem( 'ccm', db.version );

                // create new object store
                db.createObjectStore( settings.store, { keyPath: 'key' } );

              };

              // set success callback => perform callback
              request.onsuccess = callback;

            }

          }

        }

        /**
         * proceed with creating ccm datastore
         * @returns {ccm.store} created ccm datastore
         */
        function proceed() {

          /**
           * created ccm datastore
           * @type {ccm.store}
           */
          var store = new Datastore();

          // integrate settings in ccm datastore
          ccm.helper.integrate( settings, store );

          // is ccm realtime datastore? => connect to server
          if ( store.url && store.url.indexOf( 'ws' ) === 0 ) {

            store.socket = new WebSocket( store.url, 'ccm' );
            store.socket.onopen = function () { this.send( [ store.db, store.store ] ); proceed(); };

          }
          else return proceed();

          function proceed() {

            // initialize ccm datastore
            store.init();

            // add ccm datastore to created ccm datastores
            stores[ source ] = store;

            // perform callback with created ccm datastore
            if ( callback ) callback( store );

            // return created ccm datastore (only synchron)
            return store;

          }

        }

      }

    },

    /**
     * @summary create <i>ccm</i> datastore and get dataset
     * @memberOf ccm
     * @param {ccm.settings|function} settings - <i>ccm</i> datastore settings
     * @param {ccm.key} [key] - <i>ccm</i> dataset key (default: get complete local cache)
     * @param {function} [callback] - callback when <i>ccm</i> datastore is created (first parameter is created <i>ccm</i> datastore)
     * @param {string|ccm.user} [user] - username or user instance for user authentication
     * @param {string} [password] - password for user authentication
     * @returns {ccm.store} created <i>ccm</i> datastore (only if synchron)
     */
    dataset: function ( settings, key, callback, user, password ) {

      ccm.store( settings, function ( store ) {

        store.get( key, callback, user, password );

      } );

    },

    /*-------------------------------------------- public ccm namespaces ---------------------------------------------*/

    /**
     * @summary context functions for traversing in a <i>ccm</i> context tree
     * @memberOf ccm
     * @namespace
     */
    context: {

      /**
       * @summary find parent instance by property
       * @param {ccm.instance} instance - <i>ccm</i> instance (starting point)
       * @param {string} property - instance property
       * @returns {ccm.instance}
       */
      find: function ( instance, property ) {

        var result;
        do
          if ( instance[ property ] )
            result = instance[ property ];
        while ( instance = instance.parent );
        return result;

      },

      /**
       * @summary get <i>ccm</i> context root
       * @param {ccm.instance} instance - <i>ccm</i> instance (starting point)
       * @returns {ccm.instance}
       */
      root: function ( instance ) {

        while ( instance.parent )
          instance = instance.parent;

        return instance;

      },

      /**
       * @summary get <i>ccm</i> user instance
       * @param {ccm.instance} instance - <i>ccm</i> instance (starting point)
       * @returns {ccm.user}
       */
      user: function ( instance ) {

        return ccm.context.find( instance, 'user' );

      }

    },

    /**
     * @summary helper functions for <i>ccm</i> component developers
     * @memberOf ccm
     * @namespace
     */
    helper: {

      /**
       * @summary perform action (# for own context)
       * @param {ccm.action} action
       * @param {object} [context]
       * @returns {*} return value of performed action
       */
      action: function ( action, context ) {

        // is function without parameters? => perform function
        if ( typeof action === 'function' ) return action();

        // Funktionsname und Parameter als String angegeben?
        if ( typeof action !== 'object' ) {

          // In Array verpacken
          action = action.split( ' ' );
        }

        // Aktion ausführen
        if ( typeof action[ 0 ] === 'function' )
          return action[ 0 ].apply( window, action.slice( 1 ) );
        else
        if ( action[ 0 ].indexOf( 'this.' ) === 0 )
          return this.executeByName( action[ 0 ].substr( 5 ), action.slice( 1 ), context );
        else
          return this.executeByName( action[ 0 ], action.slice( 1 ) );
      },

      /**
       * @summary create a deep or flat copy of an object
       * @param {object} obj - object
       * @param {boolean} [flat=false] - true: flat copy, false: deep copy (default)
       * @returns {object} object copy
       */
      clone: function ( obj, flat ) {

        return typeof( obj ) === 'object' ? jQuery.extend( !flat, {}, obj ) : undefined;

      },

      /**
       * @summary reselect website area of <i>ccm</i> instance and add html div tag inside for embedded content with <i>ccm</i> loading icon inside
       * @param {ccm.instance} instance - <i>ccm</i> instance
       * @returns {ccm.element} added html div tag
       */
      element: function ( instance ) {

        // reselect ccm instance website area
        ccm.helper.reselect( instance );

        /**
         * ccm component name
         * @type {ccm.name}
         */
        var name = instance.component.name;

        // css classes given as array? => join to string
        if ( jQuery.isArray( instance.classes ) ) instance.classes = instance.classes.join( ' ' );

        // add html div tag in ccm instance website area
        instance.element.html( '<div id="ccm-' + instance.index + '" class="ccm ' + ( instance.classes ? instance.classes : 'ccm-' + name ) + '"></div>' );

        /**
         * added html div
         * @type {ccm.element}
         */
        var element = instance.element.find( '#ccm-' + instance.index );

        // render css loading icon
        ccm.helper.loading( element );

        // return added html div tag
        return element;

      },

      /**
       * @summary perform function by function name
       * @param {string} functionName - function name
       * @param {Array} args - function arguments
       * @param {object} [context] - context for this
       * @returns {*} return value of performed function
       */
      executeByName: function ( functionName, args, context ) {

        if (!context) context = window;
        var namespaces = functionName.split( '.' );
        functionName = namespaces.pop();
        for ( var i = 0; i < namespaces.length; i++ )
          context = context[ namespaces[ i ]];
        return context[ functionName ].apply( context, args );
      },

      /**
       * @summary removes identical property values in priority data
       * @param {object} priodata - priority dataset
       * @param {object} dataset - dataset
       * @returns {object} priority data with removed identical property values
       */
      filter: function ( priodata, dataset ) {

        // Kopie von Prioritätsdaten verwenden
        priodata = ccm.helper.clone( priodata );

        // Identische Einträge entfernen
        for ( var i in priodata )
          if ( priodata[ i ] === dataset[ i ] )
            delete priodata[ i ];
      },

      /**
       * @summary focus input field and set cursor to last character
       * @param {ccm.element} input - input field
       * @param {number} [position] - cursor position in input field
       */
      focusInput: function( input, position ) {

        // source: http://stackoverflow.com/a/12654402 and http://stackoverflow.com/a/18903492
        input = input.get( 0 );
        if ( position === undefined ) position = input.value.length;
        input.selectionStart = input.selectionEnd = position;
        input.focus();

      },

      /**
       * @summary replaces placeholder in a string with given values
       * @param {string|object} string - string with containing placeholders
       * @param {...string} [values] - given values
       * @returns {string} string with replaced placeholders
       */
      format: function ( string, values ) {

        var functions = [[],[]];

        string = JSON.stringify( string, function( key, val ) {
          if ( typeof val === 'function' ) { functions[ 0 ].push( val ); return '%f0'; }
          return val;
        } );

        for ( var i = 1; i < arguments.length; i++ ) {
          if ( typeof arguments[ i ] === 'function' ) { functions[ 1 ].push( arguments[ i ] ); arguments[ i ] = '%f1'; }
          if ( typeof arguments[ i ] === 'object' )
            for ( var key in arguments[ i ] )
              string = string.replace( new RegExp( '%'+key, 'g' ), arguments[ i ][ key ] );
          else
            string = string.replace( /%s/, arguments[ i ] );
        }

        return JSON.parse( string, function ( key, val ) {
          if ( val === '%f0' ) return functions[ 0 ].shift();
          if ( val === '%f1' ) return functions[ 1 ].shift();
          return val;
        } );

      },

      /**
       * @summary get html form data
       * @param {ccm.element} form - html form tag
       * @returns {Object.<string, string>} result data
       */
      formData: function ( form ) {

        // Checkboxen selektieren
        form.find( 'input[type=checkbox]' ).each( function () {

          /**
           * Selektierte Checkbox
           * @type {ccm.element}
           */
          var checkbox = jQuery( this );

          // Checkbox nicht gesetzt?
          if ( !checkbox.is( ':checked' ) ) {

            // Alten Ergebniswert merken
            checkbox.attr( 'data-input', checkbox.attr( 'value' ) );

            // Leerer String als Ergebniswert setzen
            checkbox.attr( 'value', '' );
          }

          // Checkbox in jedem Fall Ergebniswert liefern lassen
          checkbox.prop( 'checked', true );
        });

        /**
         * Ergebnisdaten
         * @type {Array}
         */
        var data = form.serializeArray();

        // Nicht gesetzte Checkboxen selektieren
        form.find( 'input[type=checkbox][value=""]' ).each( function() {

          /**
           * Selektierte Checkbox
           * @type {ccm.element}
           */
          var checkbox = jQuery( this );

          // Checkbox zurücksetzen
          checkbox.prop( 'checked', false );
          checkbox.attr( 'value', checkbox.attr( 'data-input' ) );
          checkbox.removeAttr( 'data-input' );
        });

        /**
         * Umgewandelte Ergebnisdaten
         * @type {Object.<string, string>}
         */
        var result = {};

        // Ergebnisdaten umwandeln
        for ( var i = 0; i < data.length; i++ )
          result[ data[ i ][ 'name' ] ] = data[ i ][ 'value' ];

        // Ergebnisdaten zurückgeben
        return result;
      },

      /*
       * @summary Schaltet Inhalt eines Containers auf Vollbildmodus
       * TODO: Vollbildmodus
       *
       fullscreen: function ( container ) {

       //var html = jQuery( 'body' ).clone();
       //jQuery( 'body' ).html( html );
       //        jQuery( 'body' ).html( container );
       //        container.click( function () { jQuery( 'body' ).html( html ); } );
       },
       */

      /**
       * @summary generates a unique key
       * @returns {ccm.key} unique key
       */
      generateKey: function () {

        return Date.now() + 'X' + Math.random().toString().substr( 2 );

      },

      /**
       * @summary generate HTML with JSON (recursive)
       * @param {ccm.html|ccm.html[]} html - <i>ccm</i> html data
       * @param {...string} [values] - values to replace placeholder
       * @returns {ccm.element|ccm.element[]} generated HTML
       */
      html: function( html, values ) {

        // replace placeholder
        if ( arguments.length > 1 ) html = ccm.helper.format.apply( this, arguments );

        // get more than one HTML tag?
        if ( jQuery.isArray( html ) ) {

          // generate each HTML tag
          var result = [];
          for ( var i = 0; i < html.length; i++ )
            result.push( ccm.helper.html( html[ i ] ) );  // recursive call
          return result;

        }

        // get string instead of ccm html data? => remove script tags
        if ( typeof ( html ) === 'string' ) html = ccm.helper.val( html );

        // get no ccm html data? => return parameter value
        if ( typeof ( html ) !== 'object' ) return html;

        /**
         * HTML tag
         * @type {ccm.element}
         */
        var element = jQuery( '<' + ccm.helper.val( html.tag || 'div', 'tag' ) + '>' );

        // remove 'tag' property
        delete html.tag;

        // iterate over ccm html data properties
        for ( var key in html ) {

          /**
           * value of ccm html data property
           * @type {string|ccm.html|Array}
           */
          var value = html[ key ];

          // interpret ccm html data property
          switch ( key ) {

            // HTML tag attribute flags
            case 'checked':
            case 'disabled':
            case 'readonly':
            case 'required':
            case 'selected':
              if ( value && value !== 'undefined' && value !== 'false' ) element.prop( key, true );
              break;

            // HTML tag content
            case 'inner':
              element.html( this.html( value ) );  // recursive call
              break;

            // HTML tag events
            case 'onchange':     element.change     ( value ); break;
            case 'onclick':      element.click      ( value ); break;
            case 'oninput':      element.on( 'input', value ); break;
            case 'onmouseenter': element.mouseenter ( value ); break;
            case 'onsubmit':     element.submit     ( value ); break;

            // HTML value attributes
            default:
              element.attr( key, ccm.helper.val( value ) );
          }

        }

        // return generated HTML
        return element;

      },

      /**
       * @summary HTML-encode a string
       * @see http://stackoverflow.com/questions/1219860/html-encoding-in-javascript-jquery
       * @param {string} value - string
       * @param {boolean} [trim=true] - .trim()
       * @param {boolean} [quot=true] - .replace( /"/g, '&quot;' )
       * @returns {string} HTML-encoded string
       */
      htmlEncode: function ( value, trim, quot ) {

        if ( typeof ( value ) !== 'string' ) value = value.toString();
        value = trim || trim === undefined ? value.trim() : value;
        value = jQuery( '<div>' ).text( value ).html();
        value = quot || quot === undefined ? value.replace( /"/g, '&quot;' ) : value;
        return value;

      },

      /**
       * @summary HTML-decode a sting
       * @see http://stackoverflow.com/questions/1219860/html-encoding-in-javascript-jquery
       * @param {string} value - string
       * @returns {string} HTML-decoded string
       */
      htmlDecode: function ( value ) {

        return jQuery( '<div>' ).html( value ).text();

      },

      /**
       * @summary get dataset for rendering (not generalized yet)
       * @description get dataset using self.store and self.key and return it or returns new dataset if not exists
       * @param {ccm.instance} self - <i>ccm</i> instance that need the dataset for rendering
       * @param {function} callback - callback (first parameter is result dataset)
       */
      dataset: function ( self, callback ) {

        // get dataset
        self.store.get( self.key, function ( dataset ) {

          // dataset not exists? => create new dataset (could be asynchron)
          if ( dataset === null ) self.store.set( { key: self.key }, proceed ); else proceed( dataset );

          function proceed( dataset ) {

            // store dataset key in ccm instance
            self.key = dataset.key;

            // perform callback
            if ( callback ) callback( dataset );

          }

        } );

      },

      /**
       * @summary integrate priority data into a dataset
       * @param {object} [priodata] - priority data
       * @param {object} [dataset] - dataset
       * @returns {object} dataset with integrated priority data
       */
      integrate: function ( priodata, dataset ) {

        // Keine Prioritätsdaten?
        if ( !priodata ) {

          // Datensatz zurückgeben
          return dataset;
        }

        // Kein Datensatz?
        if ( !dataset ) {

          // Prioritätsdaten zurückgeben
          return priodata;
        }

        // Prioritätsdaten durchgehen
        for ( var i in priodata ) {

          // Wert in Datensatz ändern
          if ( priodata[ i ] !== undefined )
            dataset[ i ] = priodata[ i ];
          else
            delete dataset[ i ];
        }

        // Datensatz zurückgeben
        return dataset;
      },

      /**
       * @summary check value for <i>ccm</i> component
       * @param {*} value - value to check
       * @returns {boolean}
       */
      isComponent: function ( value ) {

        return typeof ( value ) === 'object' && value !== null && value.Instance;

      },

      /**
       * check value for <i>ccm</i> dataset
       * @param {*} value - value to check
       * @returns {boolean}
       */
      isDataset: function ( value ) {

        return typeof ( value ) === 'object' && !jQuery.isArray( value ) && value !== null;

      },

      /**
       * check value if it is a <i>ccm</i> dependency
       * @param {*} value
       * @returns {boolean}
       * @example [ ccm.load, ... ]
       * @example [ ccm.register, ... ]
       * @example [ ccm.instance, ... ]
       * @example [ ccm.proxy, ... ]
       * @example [ ccm.render, ... ]
       * @example [ ccm.store, ... ]
       * @example [ ccm.dataset, ... ]
       */
      isDependency: function ( value ) {

        if ( jQuery.isArray( value ) )
          if ( value.length > 0 )
            switch ( value[ 0 ] ) {
              case ccm.load:
              case "ccm.load":
              case ccm.register:
              case "ccm.register":
              case ccm.instance:
              case "ccm.instance":
              case ccm.proxy:
              case "ccm.proxy":
              case ccm.render:
              case "ccm.render":
              case ccm.store:
              case "ccm.store":
              case ccm.dataset:
              case "ccm.dataset":
                return true;
            }

        return false;

      },

      /**
       * @summary check value for <i>ccm</i> instance
       * @param {*} value - value to check
       * @returns {boolean}
       */
      isInstance: function ( value ) {

        return typeof ( value ) === 'object' && value !== null && value.component && true;

      },

      /*
       * @summary check value for <i>ccm</i> datastore
       * @param {*} value - value to check
       * @returns {boolean}
       *
       isStore: function ( value ) {

       return typeof ( value ) === 'object' && value !== null && value.local;

       },
       */

      /**
       * @summary checks if an object is a subset of another object
       * @param {object} obj - object
       * @param {object} other - another object
       * @returns {boolean}
       */
      isSubset: function ( obj, other ) {

        for ( var i in obj )
          if ( typeof ( obj[ i ] ) === 'object' && typeof ( other[ i ] ) === 'object' ) {
            if ( JSON.stringify( obj[ i ] ) !== JSON.stringify( other[ i ] ) )
              return false;
          }
          else if ( obj[ i ] !== other[ i ] )
            return false;

        return true;

      },

      /**
       * render <i>ccm</i> loading icon in website area
       * @param {ccm.element} element - website area
       */
      loading: function ( element ) {

        // render ccm loading icon
        ( element ? element : jQuery( 'body' ) ).html( '<img src="' + ccm.loading_icon + '">' );

        //renderNoImageIcon();

        /**
         * render an ccm loading icon (without image)
         */
        function renderNoImageIcon() {

          // not optimal: should not be execute any time
          document.write( '<style>@keyframes ccm-loading { 0%{ opacity: 1; } 100% { opacity : 0; } }</style>' );

          var loading = jQuery(

              '<div class="ccm-loading">' +
              '<div class="bar-1"></div>' +
              '<div class="bar-2"></div>' +
              '<div class="bar-3"></div>' +
              '<div class="bar-4"></div>' +
              '<div class="bar-5"></div>' +
              '<div class="bar-6"></div>' +
              '<div class="bar-7"></div>' +
              '<div class="bar-8"></div>' +
              '<div class="bar-9"></div>' +
              '<div class="bar-10"></div>' +
              '<div class="bar-11"></div>' +
              '<div class="bar-12"></div>' +
              '<div class="bar-13"></div>' +
              '<div class="bar-14"></div>' +
              '<div class="bar-15"></div>' +
              '<div class="bar-16"></div>' +
              '</div>'

          );

          /**
           * counter for loading icon bars
           * @type {number}
           */
          var i = 0;

          // set style of css loading icon
          loading.css( {

            position: 'relative',
            width: '35px',
            height: '35px',
            left: '15px',
            top: '12px'

          } ).find( 'div' ).css( {

            position: 'absolute',
            width: '2px',
            height: '8px',
            'background-color': '#25363F',
            opacity: '0.05',
            animation: 'ccm-loading 0.8s linear infinite'

          } ).each( function () {

            jQuery( this ).css( {

              transform: 'rotate(' + (i*22.5) + 'deg) translate( 0, -12px )',
              'animation-delay': (0.05 + i*0.05) + 's'

            } );

            // increase counter for css load icon bars
            i++;

          } );

          // render loading icon
          element.html( loading );
        }

      },

      /**
       * @summary remove script tags in a string
       * @param {string} value - string
       * @returns {string} string without script tags
       */
      noScript: function ( value ) {

        var div = jQuery( '<div>' ).html( value );
        div.find( 'script' ).remove();
        return div.html();

      },

      /**
       * @summary get regular expression
       * @param {string} index - regular expression index
       * @returns {object} regular expression object
       */
      regex: function ( index ) {

        switch ( index ) {
          case 'key': return /^[a-z_0-9][a-zA-Z_0-9]*$/;
          case 'tag': return /^[a-z][a-zA-Z]*$/;
          case 'url': return /^(((http|ftp|https):\/\/)?[\w-]+(\.[\w-]*)+)?([\w.,@?^=%&amp;:\/~+#-]*[\w@?^=%&amp;\/~+#-])?$/;
        }

      },

      /**
       * reselect <i>ccm</i> instance website area
       * @param {ccm.element} instance - <i>ccm</i> instance
       */
      reselect: function ( instance ) {

        // Webseitenelement gesetzt? => Reselektieren
        if ( instance.element ) instance.element = jQuery( instance.element.selector );
      },

      /**
       * solve <i>ccm</i> dependency
       * @param {object} obj - object that contains the <i>ccm</i> dependency
       * @param {number|string} key - object key that contains the <i>ccm</i> dependency
       * @param {function} callback - callback (first parameter ist result of solved dependency)
       * @returns {*} result (only of synchron)
       */
      solveDependency: function ( obj, key, callback ) {

        obj[ key ].push( function ( result ) { obj[ key ] = result; callback( result ); } );
        return ccm.helper.action( obj[ key ] );

      },

      /**
       * @summary check if html tag exists
       * @param {ccm.element} element - html tag
       * @returns {boolean}
       */
      tagExists: function ( element ) {

        // Existenz prüfen
        return element.closest( 'html' ).length > 0;
      },

      /**
       * @summary validate a given string
       * @description
       * This function returns the given string only if it matches the given regular expression.
       * The result is <code>null</code> if the given string not matches the given regular expression.
       * The result is the return value of [<code>ccm.helper.htmlEncode(string)</code>]{@link ccm.helper.htmlEncode} if the given regular expression equals <code>true</code> (<code>string === true</code>).
       * The result is the return value of [<code>ccm.helper.noScript(string)</code>]{@link ccm.helper.noScript} if the optional given regular expression is a falsy value (<code>false</code>, <code>null</code>, <code>undefined</code>, <code>0</code>, <code>NaN</code>, <code>''</code> or <code>""</code>).
       * The given regular expression passes [<code>ccm.helper.regex(regex)</code>]{@link ccm.helper.regex} if the given regular expression is a string.
       * @param {string} string - given string
       * @param {ccm.regex|string|boolean} [regex] - given regular expression
       * @example
       * ccm.helper.val( 'Hello, world!', /^[A-Z][a-z ,!]*$/ );  // => 'Hello, world!'
       * @example
       * ccm.helper.val( 'Hello, world!', /^[A-Z][a-z]*$/ );     // => null
       * @example
       * ccm.helper.val( 'Hello, world!<script>alert("XSS");</script>', true );
       * // => 'Hello, world!<script>alert("XSS");</script>' (no alert call)
       * @example
       * ccm.helper.val( 'Hello, world!<script>alert("XSS");</script>' );
       * // => 'Hello, world!' (no alert call)
       * @returns {string} returns given string or null
       */
      val: function ( string, regex ) {

        if ( !regex ) return ccm.helper.noScript( string );
        if ( regex === true ) return ccm.helper.htmlEncode( string );
        return ( typeof ( regex ) === 'string' ? ccm.helper.regex( regex ) : regex ).test( string ) ? string : null;

      },

      /**
       * @summary perform a function after a waiting time
       * @param {number} time - waiting time in milliseconds
       * @param {function} callback - performed function after waiting time
       * @example ccm.helper.wait( 1000, function () { console.log( 'I was called after 1 second' ) } );
       */
      wait: function ( time, callback ) {

        window.setTimeout( callback, time );

      }

    }

  };

  /*---------------------------------------------- private ccm methods -----------------------------------------------*/

  /**
   * @summary get <i>ccm</i> component index by URL
   * @private
   * @param {string} url - <i>ccm</i> component URL
   * @returns {string} <i>ccm</i> component index
   */
  function getIndex( url ) {

    // url is already ccm component index? => return ccm component index
    if ( url.indexOf( '.js' ) === -1 ) return url;

    /**
     * filename of ccm component
     * @type {string}
     */
    var filename = url.split( '/' ).pop();

    // remove file extension and return resulting ccm component index
    return filename.substr( 0, filename.lastIndexOf( '.' ) );

  }

  /**
   * @summary get <i>ccm</i> datastore source
   * @private
   * @param {ccm.settings} settings - <i>ccm</i> datastore settings
   * @returns {string}
   */
  function getSource( settings ) {

    /**
     * ccm datastore source
     * @type {string|number}
     */
    var source = JSON.stringify( settings );

    // source is empty object? => use number as source
    if ( source === '{}' ) source = Object.keys( stores ).length;

    // return ccm datastore source
    return source;

  }

  /*---------------------------------------------- ccm type definitions ----------------------------------------------*/

  /**
   * @summary <i>ccm</i> action
   * @typedef {function|string|Array} ccm.action
   * @example function() { ... }
   * @example functionName
   * @example 'functionName'
   * @example 'my.namespace.functionName'
   * @example ['my.namespace.functionName','param1','param2']
   */

  /**
   * @summary <i>ccm</i> component
   * @typedef {namespace} ccm.component
   * @property {ccm.index} index - <i>ccm</i> component index
   * @property {ccm.name} name - <i>ccm</i> component name
   * @property {ccm.version} version - <i>ccm</i> component version number
   * @property {ccm.config} config - default configuration of own <i>ccm</i> instances
   * @property {function} Instance - constructor for creating <i>ccm</i> instances out of this component
   * @property {function} init - callback when this component is registered
   * @property {function} instance - create <i>ccm</i> instance out of this component
   * @property {function} render - create and render <i>ccm</i> instance
   * @property {number} instances - number of own created <i>ccm</i> instances
   */

  /**
   * @summary <i>ccm</i> instance configuration
   * @typedef {object} ccm.config
   * @property {ccm.element} element - <i>ccm</i> instance website area (default is website body)
   */

  /**
   * @summary <i>ccm</i> dataset
   * @typedef {object} ccm.dataset
   * @property {ccm.key} key - dataset key
   */

  /**
   * @summary collection of <i>ccm</i> datasets
   * @typedef {Object.<ccm.key, ccm.dataset>} ccm.datasets
   */

  /**
   * @summary IndexedDB database
   * @typedef {object} ccm.db
   */

  /**
   * @summary "jQuery Element" object
   * @typedef {object} ccm.element
   * @example var element = jQuery( 'body' );
   */

  /**
   * @summary <i>ccm</i> html data - TODO: explain properties of <i>ccm</i> html data
   * @typedef {object} ccm.html
   */

  /**
   * @summary <i>ccm</i> component index (unique in <i>ccm</i> runtime environment)
   * @description A <i>ccm</i> component index is made up of a [component name]{@link ccm.component} and its [version number]{@link ccm.component}.
   * @typedef {string} ccm.index
   * @example "chat-1.0.0"
   */

  /**
   * @summary <i>ccm</i> instance
   * @typedef {object} ccm.instance
   * @property {number} id - <i>ccm</i> instance id (unique in own component)
   * @property {string} index - <i>ccm</i> instance index (unique in <i>ccm</i> runtime environment)<br>A <i>ccm</i> instance index is made up of own [component name]{@link ccm.component} and own [id]{@link ccm.instance} (example: <code>"chat-1"</code>).
   * @property {ccm.component} component - reference to associated component
   * @property {ccm.instance} self - own context (private)
   * @property {ccm.element} element - own website area
   * @property {string} classes - html classes of website area for own content (default is: <code>"ccm-"+[component_name]{@link ccm.component}</code>)<br>Each content website area of a <i>ccm</i> instance have the additional html class <code>"ccm"</code>.
   * @property {ccm.style} style - css style of website area for own content
   * @property {function} init - callback when this instance is created and not rendered yet
   * @property {function} render - render content in own website area
   */

  /**
   * @summary "jQuery XMLHttpRequest" object
   * @typedef {object} ccm.JqXHR
   */

  /**
   * @summary key of a <i>ccm</i> dataset (unique in the <i>ccm</i> datastore which contains the dataset)
   * @typedef {string|number} ccm.key
   */

  /**
   * @summary name of a <i>ccm</i> component (unique in a ccm component market place)
   * @typedef {string} ccm.name
   * @example "chat"
   */

  /**
   * @summary regular expression
   * @typedef {object} ccm.regex
   * @example var regex = /^[A-Z][a-z]*$/g;
   * @example var regex = new RegExp( '^[A-Z][a-z]*$', 'g' );
   */

  /**
   * @summary <i>ccm</i> datastore settings
   * @typedef {object} ccm.settings
   * @property {ccm.datasets|string} local - collection of <i>ccm</i> datasets or URL to server interface that deliver initial datasets for local cache
   * @property {string} store - object store name in clientside database IndexedDB that has to be used
   * @property {string} url - server interface URL to serverside database that has to be used
   * @property {string|ccm.user} user - username or user instance for user authentication
   * @property {string} password - password for user authentication
   */

  /**
   * @summary <i>ccm</i> datastore source - TODO: explain forms of <i>ccm</i> datastore sources
   * @typedef {string|object} ccm.source
   */

  /**
   * @summary <i>ccm</i> datastore
   * @typedef {object} ccm.store
   * @property {ccm.datasets} local - local cache
   * @property {string} store - datastore name in database
   * @property {string} url - server interface URL to serverside database
   * @property {string} db - database ('redis' or 'mongodb', default is 'redis')
   * @property {object} socket - websocket connection
   * @property {string|ccm.user} user - username or user instance for user authentication
   * @property {string} password - password for user authentication
   * @property {function} get - get dataset
   * @property {function} set - create or update dataset
   * @property {function} del - delete dataset
   * @property {function} count - get number of stored datasets
   */

  /**
   * @summary <i>ccm</i> instance css dependency - TODO: more than an url for <i>ccm</i> instance css dependency
   * @typedef {Array} ccm.style
   * @example [ ccm.load, 'css/style.css' ]
   */

  /**
   * @summary resource url
   * @typedef {string} ccm.url
   */

  /**
   * @summary <i>ccm</i> user instance
   * @typedef {ccm.instance} ccm.user
   * @property {ccm.key} key - user dataset key (username)
   * @property {function} login - login user
   * @property {function} logout - logout user
   * @property {function} isLoggedIn - checks if user is logged in
   * @property {function} addObserver - add an observer for login and logout event
   */

  /**
   * @summary Semantic Versioning 2.0.0 ({@link http://semver.org})
   * @typedef {number[]} ccm.version
   * @example [1,0,0]
   */

}();

} )();