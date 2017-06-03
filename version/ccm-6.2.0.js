/**
 * @overview Framework of the Client-side Component Model (<i>ccm</i>)
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
 * @version 6.2.0
 * @changes
 * version 6.2.0 (23.06.2016):
 * - add helper function for privatization
 * - add support of attribute "async" in ccm html data
 * - <i>ccm</i> framework instead of <i>ccm</i> runtime environment
 * - rename ccm.type to ccm.types
 * - bugfix in ccm.helper.html
 * - updated doc comments for api
 * version 6.1.0 (18.05.2016):
 * - accept jQuery element instead of instance config as parameter in ccm.instance and ccm.render
 * - load jQuery remote from CDN instead of local file
 * - beginning of new convention for component filenames (old way also supported, but deprecated)
 * version 6.0.0 (09.05.2016):
 * - placeholder with %% instead of % (incompatible change)
 * (for older version changes see ccm-5.8.3.js)
 */

// jQuery not exists? => load jQuery
if ( !window.jQuery ) {

  // body exists? => load asynchron
  if ( document.body ) {

    window.jQuery = document.createElement( 'script' );
    window.jQuery.setAttribute( 'src', 'https://code.jquery.com/jquery-2.2.3.min.js' );
    document.head.appendChild( window.jQuery );

  }
  // load synchron
  else document.write( '<script src="https://code.jquery.com/jquery-2.2.3.min.js"></script>' );

}

// set keyframe for ccm loading icon animation
if ( document.body ) {

  window.ccm = document.createElement( 'style' );
  window.ccm.appendChild( document.createTextNode( '@keyframes ccm_loading { to { transform: rotate(360deg); } }' ) );
  document.head.appendChild( window.ccm );

}
else document.write( '<style>@keyframes ccm_loading { to { transform: rotate(360deg); } }</style>' );

/**
 * global <i>ccm</i> namespace
 * @global
 * @namespace
 */
ccm = function () {

  /*---------------------------------------------- private ccm members -----------------------------------------------*/

  /**
   * @summary loaded <i>ccm</i> components
   * @memberOf ccm
   * @private
   * @type {Object.<ccm.types.index, ccm.types.component>}
   */
  var components = {};

  /**
   * @summary <i>ccm</i> database in IndexedDB
   * @memberOf ccm
   * @private
   * @type {object}
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
   * @type {Object.<ccm.types.source, ccm.Datastore>}
   */
  var stores = {};

  /**
   * @summary waitlist with actions that wait for currently loading resources
   * @memberOf ccm
   * @private
   * @type {Object.<string, ccm.types.action[]>}
   */
  var waiter = {};

  /*---------------------------------------------- private ccm classes -----------------------------------------------*/

  /**
   * @summary constructor for creating <i>ccm</i> datastores (private class)
   * @description See [this wiki page]{@link https://github.com/akless/ccm-developer/wiki/Data-Management} for general informations about <i>ccm</i> data management.
   * @memberOf ccm
   * @class
   * @example
   * // Example for a <i>ccm</i> datastore instance:
   * {
   *   local:    {...},
   *   store:    'chat',
   *   url:      'http://path/to/server/interface.php',
   *   onChange: function () { console.log( arguments ); },
   *   get:      function ( key_or_query, callback ) {...},
   *   set:      function ( priodata, callback ) {...},
   *   del:      function ( key, callback ) {...}
   * }
   */
  var Datastore = function () {

    /*-------------------------------------------- ccm datastore members ---------------------------------------------*/

    /**
     * @summary local cache
     * @description
     * On the first data level of a <i>ccm</i> datastore the data will be managed in an local JavaScript object.
     * This property contains this local JavaScript object.
     * On higher data levels this object acts as a local cache.
     * See [this wiki page]{@link https://github.com/akless/ccm-developer/wiki/Data-Management#data-caching} for more informations about this kind of data caching.
     * @type {ccm.types.datasets}
     */
    this.local = {};

    /**
     * @summary datastore name in database
     * @description
     * Dependent on the specific database the datastore has different designations.
     * For example in IndexedDB this is the name of the Object Store, in MongoDB the name of the Document Store and in MySQL the name of the Table.
     * This property is not relevant for the first data level. It is only relevant for higher data levels.
     * @type {string}
     * @example 'users'
     * @example 'questions'
     * @example 'answers'
     * @example 'comments'
     */
    this.store = null;

    /**
     * @summary URL of the server interface to serverside database
     * @description
     * This property is only relevant for the third data level.
     * See [this wiki page]{@link https://github.com/akless/ccm-developer/wiki/Data-Management#server-interface} for more informations about an <i>ccm</i> compatible server interface.
     * @type {ccm.types.url}
     */
    this.url = null;

    /*
     * @property {string} db - database (in case of a server that offers more than one database)
     */

    /**
     * @summary callback when server informs about changed stored datasets
     * @description
     * This property is only relevant for the third data level with real-time communication.
     * See [this wiki page]{@link https://github.com/akless/ccm-developer/wiki/Data-Management#real-time-communication} for more informations.
     * @type {function}
     * @example
     * ccm.store( {
     *   store: 'my_store',
     *   url: 'http://path/to/server/interface.php',
     *   onChange: function () {
     *     console.log( arguments );  // Shows the server informations about the changed
     *   }                            // stored dataset in the developer console.
     * } );
     */
    this.onChange = null;

    /**
     * @summary websocket communication callbacks
     * @private
     * @type {function[]}
     */
    var callbacks = [];

    /**
     * @summary own context
     * @private
     */
    var self = this;

    /*----------------------------------------- public ccm datastore methods -----------------------------------------*/

    /**
     * @summary initialize datastore
     * @description when datastore is created
     * @ignore
     */
    this.init = function () {

      // TODO: make self.socket private

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
     * @summary get one or more stored datasets
     * @description
     * There are two ways to use this method depending on the first parameter.
     * The first way is to get a single dataset with a given key.
     * The second way is to get all datasets that matches a given query.
     * With no first parameter the method provides an array with all stored datasets.
     * In this case the callback could be the first parameter directly.
     * Getting all stored datasets counts as a query and don't work if the chosen data level not supports queries.
     * See [table of supported operations]{@link https://github.com/akless/ccm-developer/wiki/Data-Management#supported-operations} to check this.
     * @param {ccm.types.key|object} [key_or_query] - unique key of the dataset or alternative a query
     * @param {ccm.types.getResult} [callback] - when data operation is finished
     * @returns {ccm.types.dataset|ccm.types.dataset[]} requested dataset(s) (only if no inner operation is asynchron)
     * @example
     * // get array of all stored datasets
     * store.get( function ( result ) {
     *   console.log( result );                  // [ { key: ..., ... }, ... ]
     * } );
     * @example
     * // get single dataset with unique key 'test'
     * store.get( 'test', function ( result ) {
     *   console.log( result );                  // { key: 'test', ... }
     * } );
     * @example
     * // get single dataset with unique key 4711
     * store.get( 4711, function ( result ) {
     *   console.log( result );                  // { key: 4711, ... }
     * } );
     * @example
     * // get array of all stored datasets that match the given query
     * store.get( {
     *   author: 'akless',        // This query selects all datasets that have a property 'author'
     *   year: 2015               // with value 'akless' and a property 'year' with value '2015'.
     * }, function ( result ) {
     *   console.log( result );   // [ { key: ..., author: 'akless', year: 2015, ... }, ... ]
     * } );
     * @example
     * // get result as return value (only if no inner operation is asynchron)
     * var result = store.get();
     * console.log( result );
     */
    this.get = function ( key_or_query, callback, user, password ) {

      // allow to skip key parameter
      if ( typeof key_or_query === 'function' ) { password = user; user = callback; callback = key_or_query; key_or_query = {}; }

      // dataset key is undefined? => use empty object (to select all datasets)
      if ( key_or_query === undefined ) key_or_query = {};

      // check data source
      if ( self.url   ) return serverDB();    // serverside database
      if ( self.store ) return clientDB();    // clientside database
      if ( self.local ) return localCache();  // local cache

      /**
       * get dataset from local cache
       * @returns {ccm.types.dataset}
       */
      function localCache() {

        return getLocal( key_or_query, callback );

      }

      /**
       * get dataset from clientside database
       */
      function clientDB() {

        /**
         * local cached dataset
         * @type {ccm.types.dataset}
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
        var request = store.get( key_or_query );

        // set success callback
        request.onsuccess = function ( evt ) {

          /**
           * result dataset
           * @type {ccm.types.dataset}
           */
          var dataset = evt.target.result;

          // dataset not exist? => abort
          if ( !dataset ) return callback( null );

          // save result dataset in local cache
          if ( dataset.key !== undefined ) self.local[ key_or_query ] = dataset;

          // perform callback with result dataset
          if ( callback ) callback( dataset );

        };

      }

      /**
       * get dataset from serverside database
       */
      function serverDB() {

        // get dataset by key?
        if ( !jQuery.isPlainObject( key_or_query ) ) {

          /**
           * local cached dataset
           * @type {ccm.types.dataset}
           */
          var dataset = checkLocal();

          // is dataset local cached? => return local cached dataset
          if ( dataset ) return dataset;

        }

        /**
         * GET parameter
         * @type {object}
         */
        var data = prepareData( { key: key_or_query }, user, password );

        // load dataset from server interface
        if ( self.socket ) useWebsocket( data, onResponse ); else useHttp( data, onResponse );

        /**
         * callback for server response
         * @param {ccm.types.dataset} results - result dataset(s)
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
       * @returns {ccm.types.dataset}
       */
      function checkLocal() {

        /**
         * local cached dataset
         * @type {ccm.types.dataset}
         */
        var dataset = getLocal( key_or_query );

        // is dataset local cached? => perform callback with local cached dataset
        if ( dataset && callback ) callback( dataset );

        // return local cached dataset
        return dataset;

      }

    };

    /**
     * @summary create or update a dataset
     * @description
     * If the given priority data has no key property, than the priority data will be set as a new dataset with a generated key.
     * If the given priority data contains a value for the key property and a dataset with that given key already exists in the datastore, than that dataset will be updated with the given priority data.
     * If no dataset with that given key exists, than the priority data will be set as a new dataset with the given key.
     * For more informations about [priority data]{@link ccm.helper.integrate} or [automatic generation of unique keys]{@link ccm.helper.generateKey} see the given links.
     * The example for a deeper property update don't work if the chosen data level not supports deep partial updates.
     * See [table of supported operations]{@link https://github.com/akless/ccm-developer/wiki/Data-Management#supported-operations} to check this.
     * @param {ccm.types.dataset} priodata - priority data
     * @param {ccm.types.setResult} [callback] - when data operation is finished
     * @returns {ccm.types.dataset} created or updated dataset (only if no inner operation is asynchron)
     * @example
     * // store a new dataset with a automatic generated unique key
     * store.set( {
     *   question: 'my question',           // The priority data don't
     *   answers: [ 'answer1', 'answer2' ]  // contains a property 'key'.
     * }, function ( result ) {
     *   console.log( result );   // { key: 1465718723761X7117581531745409, question: ..., answers: ... }
     * } );
     * @example
     * // create a new dataset with unique key 'test'
     * store.set( {
     *   key: 'test',             // Creates a new dataset if a dataset with unique key 'test' already exists
     *   value: 'foo'             // in the datastore. Otherwise the existing dataset will be updated.
     * }, function ( result ) {
     *   console.log( result );   // { key: 'test', value: 'foo' }
     * } );
     * @example
     * // updates a deeper property of a stored dataset
     * store.set( {
     *   key: 'test',
     *   'feedback.user.comment': 'My comment'
     * }, function ( result ) {
     *   console.log( result );   // { key: 'test', feedback: { user: { comment: 'My comment', ... }, ... }, ... }
     * } );
     * @example
     * // get result as return value (only if no inner operation is asynchron)
     * var result = store.set( { key: 'test', value: 'foo' } );
     * console.log( result );
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
       * @returns {ccm.types.dataset} created or updated dataset
       */
      function localCache() {

        return setLocal( priodata, callback );

      }

      /**
       * set dataset in clientside database
       * @returns {ccm.types.dataset} created or updated dataset
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
       * @returns {ccm.types.dataset} created or updated dataset
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
         * @param {ccm.types.dataset} dataset - created or updated dataset
         */
        function onResponse( dataset ) {

          // check server response
          if ( !checkResponse( dataset, user ) ) return;

          // set dataset in local cache
          priodata = dataset; localCache();

        }

      }

    };

    /*
    TODO: del() --> delete datastore
    TODO: param {string} [user] - username for user authentication
    TODO: param {string} [password] - password for user authentication
    */

    /**
     * @summary delete a stored dataset
     * @param {ccm.types.key} key - unique key of the dataset
     * @param {ccm.types.delResult} [callback] - when data operation is finished
     * @returns {ccm.types.dataset} deleted dataset (only if no inner operation is asynchron)
     * @example
     * // delete dataset with unique key 'test'
     * store.del( 'test', function ( result ) {
     *   console.log( result );                  // { key: 'test', ... }
     * } );
     * @example
     * // delete dataset with unique key 4711
     * store.del( 4711, function ( result ) {
     *   console.log( result );                  // { key: 4711, ... }
     * } );
     * @example
     * // get result as return value (only if no inner operation is asynchron)
     * var result = store.del( 'test' );
     * console.log( result );
     */
    this.del = function ( key, callback, user, password ) {

      // check data source
      if ( self.url   ) return serverDB();    // serverside database
      if ( self.store ) return clientDB();    // clientside database
      if ( self.local ) return localCache();  // local cache

      /**
       * delete dataset in local cache
       * @returns {ccm.types.dataset} deleted dataset
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
         * @param {ccm.types.dataset} dataset - deleted dataset
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
     * @param {function} [callback] - callback (first parameter is number of stored datasets)
     * @param {string|ccm.types.user} [user] - username or user instance for user authentication
     * @param {string} [password] - password for user authentication
     * @returns {number} number of stored datasets (only if synchron)
     * @ignore
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
     * @ignore
     */
    this.clear = function () {

      self.local = {};

    };

    /*---------------------------------------- private ccm datastore methods -----------------------------------------*/

    /**
     * @summary get dataset(s) from local cache
     * @private
     * @param {ccm.types.key|object} [key={}] - dataset key or query (default: all stored datasets)
     * @param {function} [callback] - callback (first parameter is result dataset)
     * @returns {ccm.types.dataset} result dataset (only if synchron)
     */
    function getLocal( key, callback ) {

      // dataset key is a query? => find dataset(s) by query
      if ( key === undefined || jQuery.isPlainObject( key ) ) return find();

      /**
       * result dataset
       * @type {ccm.types.dataset}
       */
      var dataset = self.local[ key ] ? ccm.helper.clone( self.local[ key ] ) : null;

      // solve data dependencies
      solveDependencies( dataset, callback );

      // return result dataset (only synchron)
      return dataset;

      /**
       * @summary find dataset(s) by query
       * @returns {ccm.types.dataset[]} dataset(s)
       */
      function find() {

        /**
         * result dataset(s)
         * @type {ccm.types.dataset[]}
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
             * @type {ccm.types.dataset}
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
       * @param {ccm.types.dataset} dataset - ccm dataset
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
         * @param {ccm.types.dataset} dataset - dataset or array
         * @param {ccm.types.key} key - key or array index
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
     * @summary set dataset in local cache
     * @private
     * @param {ccm.types.dataset} priodata - priority data
     * @param {function} [callback] - callback (first parameter is created or updated dataset)
     * @returns {ccm.types.dataset} created or updated dataset
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
     * @summary delete dataset in local cache
     * @private
     * @param {ccm.types.key} [key] - dataset key (default: delete complete local cache)
     * @param {function} [callback] - callback  (first parameter is deleted dataset)
     * @returns {ccm.types.dataset} deleted dataset
     */
    function delLocal( key, callback ) {

      /**
       * local cached dataset
       * @type {ccm.types.dataset}
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
     * @summary get object store from IndexedDB
     * @private
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
     * @summary prepare GET parameter data
     * @private
     * @param data - individual GET parameters
     * @param {string|ccm.types.user} [user] - username or user instance for user authentication
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
        username: typeof user === 'object' ? user.key : user,
        password: password || self.password

      } );

    }

    /**
     * @summary send data to server interface via websocket connection
     * @private
     * @param {object} data - GET parameter data
     * @param {function} callback - callback for server response
     */
    function useWebsocket( data, callback ) {

      callbacks.push( callback );
      data.callback = callbacks.length;
      self.socket.send( JSON.stringify( data ) );

    }

    /**
     * @summary send data to server interface via http request
     * @private
     * @param {object} data - GET parameter data
     * @param {function} callback - callback for server response
     */
    function useHttp( data, callback ) {

      ccm.load( [ self.url, data ], callback );

    }

    /**
     * @summary checks server response
     * @private
     * @param {*} [response] - server response
     * @param {string|ccm.types.user} [user] - username or user instance for user authentication
     * @returns {boolean}
     */
    function checkResponse( response, user ) {

      // server response is error message?
      if ( typeof response === 'string' && response.indexOf( '[ccm]' ) === 0 ) {

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
     * @summary callbacks when loading cross domain json files
     * @memberOf ccm
     * @type {Object.<string, function>}
     * @ignore
     */
    callback: {},

    /**
     * @summary <i>ccm</i> loading icon
     * @memberOf ccm
     * @type {ccm.types.url}
     * @ignore
     */
    loading_icon: './img/ccm-load-icon.gif',

    /**
     * @summary <i>ccm</i> version number
     * @memberOf ccm
     * @type {ccm.types.version}
     * @readonly
     */
    version: [ 6, 2, 0 ],

    /*---------------------------------------------- public ccm methods ----------------------------------------------*/

    /**
     * @summary load resource(s) (js, css, json and/or data from server interface)
     * @memberOf ccm
     * @param {...string|Array} resources - resource(s) URLs
     * @param {function} [callback] - callback when all resources are loaded (first parameter are the results)
     * @returns {*} results (only if all resources already loaded)
     * @example
     * // load ccm component with callback (local path)
     * ccm.load( 'ccm.chat.js', function ( component ) {...} );
     * @example
     * // load ccm component without callback (cross domain)
     * ccm.load( 'http://akless.github.io/ccm-developer/resources/ccm.chat.min.js' );
     * @example
     * // load javascript file (local path)
     * ccm.load( 'scripts/helper.js' );
     * @example
     * // load jQuery UI (cross domain)
     * ccm.load( 'https://code.jquery.com/ui/1.11.4/jquery-ui.min.js' );
     * @example
     * // load css file (local path)
     * ccm.load( 'css/style.css' );
     * @example
     * // load image file (cross domain)
     * ccm.load( 'http://www.fh-lsoopjava.de/ccm/img/dialogbox.png' );
     * @example
     * // load json file with callback (local path)
     * ccm.load( 'json/data.json', function ( data ) { console.log( data ); } );
     * @example
     * // load json file with callback (cross domain), json file must look like this: ccm.callback[ 'ccm.chat.templates.min.json' ]( {...} );
     * ccm.load( 'http://akless.github.io/ccm-developer/resources/ccm.chat.templates.min.json', function ( data ) {...} );
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
       * @type {ccm.types.action}
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
      if ( typeof args[ args.length - 1 ] === 'function' || args[ args.length - 1 ] === undefined )
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

        // URL is an array?
        if ( jQuery.isArray( url ) ) {

          // second element is an object? => get URL of server interface and GET parameter
          if ( url.length > 1 && ccm.helper.isObject( url[ 1 ] ) ) { data = url[ 1 ]; url = url[ 0 ]; }

          // load resources serial
          else { counter++; results[ i ] = []; return serial( null ); }

        }

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
         * load resources serial (recursive)
         */
        function serial( result ) {

          // not first call? => save result
          if ( result !== null ) results[ i ].push( result );

          // more resources to load serial?
          if ( url.length > 0 ) {

            /**
             * next resource that must load serial
             * @type {*}
             */
            var next = url.shift();

            // more than one resources? (and not GET parameter)
            if ( Array.isArray( next ) && !( next.length > 1 && ccm.helper.isObject( next[ 1 ] ) ) ) {

              // push callback to array of arguments
              next.push( serial );

              // load resources parallel (recursive call)
              ccm.load.apply( null, next );

            }

            // one resource => load serial (recursive call)
            else ccm.load( next, serial );

          }

          // serial loading finished => check if all resources are loaded
          else check();

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
              dataType: 'html',
              crossDomain: true,
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
           * @type {ccm.types.component}
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
         * @param {ccm.types.JqXHR} jqxhr
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
     * @summary register <i>ccm</i> component in the <i>ccm</i> framework
     * @memberOf ccm
     * @param {ccm.types.component|ccm.types.url|ccm.types.index} component - object, URL or index of a <i>ccm</i> component
     * @param {ccm.types.config} [config] - default <i>ccm</i> instance configuration (check documentation of associated <i>ccm</i> component to see which properties could be set)
     * @param {function} [callback] - callback when <i>ccm</i> component is registered (first parameter is the object of the registered <i>ccm</i> component)
     * @returns {ccm.types.component} object of the registered <i>ccm</i> component (only if synchron)
     * @example ccm.component( { index: 'chat-2.1.3', Instance: function () { ... } } );
     * @example ccm.component( { name: 'chat', version: [2,1,3], Instance: function () {...} } );
     * @example ccm.component( { name: 'blank', Instance: function () {...} } );
     * @example ccm.component( 'ccm.blank.js );
     * @example ccm.component( 'http://akless.github.io/ccm-developer/resources/ccm.chat.min.js' );
     */
    component: function ( component, config, callback ) {

      // default ccm instance configuration is a function? => configuration is callback
      if ( typeof config === 'function' ) { callback = config; config = undefined; }

      // is URL of component? => abort and load component
      if ( typeof component === 'string' ) return ccm.load( component, function ( component ) {

        // integrate default ccm instance configuration
        ccm.helper.integrate( config, component.config );

        // perform callback
        if ( callback ) callback( component );

      } );

      // set component index
      setIndex();

      // component already registered? => return already registered component
      if ( components[ component.index ] ) return components[ component.index ];

      // setup component
      setup();

      // register component
      components[ component.index ] = component;

      // initialize component
      if ( component.init ) { component.init( proceed ); delete component.init; } else proceed();

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
        ccm.helper.integrate( config, component.config );
        if ( !component.config )         component.config         = {};
        if ( !component.config.element ) component.config.element = jQuery( 'body' ); // TODO: only if html body is empty (else drag'n'drop box)

      }

    },

    /**
     * @summary creates an <i>ccm</i> instance out of a <i>ccm</i> component
     * @memberOf ccm
     * @param {ccm.types.index|ccm.types.url} component - index or URL of a <i>ccm</i> component
     * @param {ccm.types.config} [config] - <i>ccm</i> instance configuration (check documentation of associated <i>ccm</i> component to see which properties could be set)
     * @param {function} [callback] - callback when <i>ccm</i> instance is created (first parameter is the created <i>ccm</i> instance)
     * @returns {ccm.types.instance} created <i>ccm</i> instance (only if synchron)
     * @example ccm.instance( 'ccm.chat.js', { key: 'demo' }, function ( instance ) {...} );
     */
    instance: function ( component, config, callback ) {

      // ccm instance configuration is a function? => configuration is callback
      if ( typeof config === 'function' ) { callback = config; config = undefined; }

      // ccm instance configuration is a jQuery element? => configuration has only element property
      if ( ccm.helper.isElement( config ) ) config = { element: config };

      /**
       * @summary number of loading resources
       * @type {number}
       */
      var counter = 0;

      /**
       * result ccm instance
       * @type {ccm.types.instance}
       */
      var result;

      // start recursion to solve dependencies
      return recursive( component, config );

      /**
       * recursion to create instance and solve dependencies
       * @param {string} comp - index or URL of component
       * @param {ccm.types.config} [cfg={}] - instance configuration (current recursive level)
       * @param {ccm.types.config} [prev_cfg] - parent instance configuration (previous recursive level)
       * @param {string} [prev_key] - relevant key in parent instance configuration (previous recursive level)
       * @param {string} [parent] - parent instance (previous recursive level)
       * @returns {ccm.types.instance} created instance (only if synchron)
       */
      function recursive( comp, cfg, prev_cfg, prev_key, parent ) {

        /**
         * component index
         * @type {ccm.types.index}
         */
        var index = getIndex( comp );

        // increase number of loading resources
        counter++;

        // load ccm component if necessary (asynchron)
        return !components[ index ] ? ccm.load( comp, proceed ) : proceed();

        /**
         * proceed with creating ccm instance and solving dependencies
         * @returns {ccm.types.instance} created ccm instance (only if synchron)
         */
        function proceed() {

          // load instance configuration if necessary (asynchron)
          return ccm.helper.isDependency( cfg ) ? ccm.dataset( cfg[ 1 ], cfg[ 2 ], proceed ) : proceed( cfg );

          function proceed( cfg ) {

            /**
             * created instance
             * @type {ccm.types.instance}
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
              case 'name': instance.element = ccm.helper.find( parent, '.' + instance.component.name ); break;
              case 'parent': instance.element = parent.element;
            }

            // solve dependencies of created ccm instance
            solveDependencies( instance );

            // check if all dependencies are solved
            return check();

            /**
             * solve dependencies of created ccm instance (recursive)
             * @param {ccm.types.instance|Array} instance_or_array - ccm instance or inner array
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
                else if ( typeof value === 'object' && value !== null ) {

                  // jQuery element or ccm instance? => skip
                  if ( ccm.helper.isElement( value ) || ccm.helper.isInstance( value ) || ccm.helper.isComponent( value ) ) continue;

                  // search it for dependencies (recursive call)
                  solveDependencies( value );

                }

              }

              /**
               * solve ccm instance dependency
               * @param {ccm.types.instance|Array} instance_or_array - ccm instance or inner array
               * @param {string|number} key - ccm instance property key or array index
               */
              function solveDependency( instance_or_array, key ) {

                /**
                 * ccm instance dependency that must be solved
                 * @type {ccm.types.action}
                 */
                var action = instance_or_array[ key ];

                // check type of dependency => solve dependency
                switch ( action[ 0 ] ) {

                  case ccm.load:
                  case "ccm.load":
                    counter++;
                    ccm.load( action[ 1 ], setResult );
                    break;

                  case ccm.component:
                  case "ccm.component":
                    counter++;
                    ccm.component( action[ 1 ], action[ 2 ], setResult );
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
                 * @param {ccm.types.config} [config={}] - ccm instance configuration, see documentation of associated ccm component
                 * @param {ccm.types.instance|Array} instance_or_array - parent ccm instance or inner array
                 * @param {string|number} key - parent ccm instance property key or array index
                 * @param {ccm.types.instance} parent - parent ccm instance
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
             * @returns {ccm.types.instance} created instance (nur wenn synchron)
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
             * initialize ccm instance and all its dependent ccm instances and ccm components (recursive)
             * @param {ccm.types.instance|Array} instance - ccm instance
             * @param {function} callback
             */
            function initialize( instance, callback ) {

              /**
               * founded ccm instances
               * @type {Array<ccm.types.instance>}
               */
              var results = [];

              // find all ccm instances
              find( instance );

              // see order of results
              //console.log( 'ccm#initialize', instance.index, results.map( function ( result ) { return result.index } ) );

              // initialize all founded ccm instances
              var i = 0; init();

              /**
               * find all ccm instances (deep-first-order, pre-order, recursive)
               * @param {object} obj - object
               */
              function find( obj ) {

                // object is an ccm instance? => add it to results
                if ( ccm.helper.isInstance( obj ) ) results.push( obj );

                // find all dependent ccm instances
                for ( var key in obj ) {

                  /**
                   * object property value
                   * @type {*}
                   */
                  var value = obj[ key ];

                  // value is a ccm instance (but not parent)? => go deeper (recursive call)
                  if ( ccm.helper.isInstance( value ) && key !== 'parent' && !ccm.helper.isProxy( value) ) find( value );

                  // value is an array or object?
                  else if ( typeof value === 'object' && value !== null ) {

                    // value is an jQuery element or ccm instance or ccm component? => skip
                    if ( ccm.helper.isElement( value ) || ccm.helper.isInstance( value ) || ccm.helper.isComponent( value ) ) continue;

                    // go deeper (recursive call)
                    find( value );

                  }

                }

              }

              /**
               * initialize all founded ccm instances (recursive, asynchron)
               */
              function init() {

                // all results initialized? => perform ready functions
                if ( i === results.length ) return ready();

                /**
                 * first founded and not init-checked result
                 * @type {ccm.types.instance}
                 */
                var obj = results[ i ]; i++;

                // result is not initialized? => perform and delete init function and check next result afterwards (recursive call)
                if ( obj.init ) { obj.init( init ); delete obj.init; } else init();

              }

              /**
               * performs ready function of each founded ccm instance (recursive, asynchron)
               */
              function ready() {

                // all ready functions are called? => perform callback
                if ( results.length === 0 ) return callback();

                /**
                 * last founded and not ready-checked result
                 * @type {ccm.types.instance}
                 */
                var obj = results.pop();

                // result has a ready function? => perform and delete ready function and check next result afterwards (recursive call)
                if ( obj.ready ) { obj.ready( ready ); delete obj.ready; } else ready();

              }

            }

          }

        }

      }

    },

    /**
     * @summary render <i>ccm</i> instance in website area
     * @memberOf ccm
     * @param {ccm.types.index|ccm.types.url} component - index or URL of a <i>ccm</i> component
     * @param {ccm.types.config} [config] - <i>ccm</i> instance configuration (check documentation of associated <i>ccm</i> component to see which properties could be set)
     * @param {function} [callback] - callback when <i>ccm</i> instance is rendered (first parameter is the rendered <i>ccm</i> instance)
     * @returns {ccm.types.instance} rendered <i>ccm</i> instance (only if synchron)
     * @example ccm.render( 'ccm.blank.js', { element: jQuery( '#container' ) } );
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
     * @summary provides a <i>ccm</i> datastore
     * @description
     * A <i>ccm</i> datastore could be used for easy data management on different switchable data levels.
     * With no first parameter the method provides a empty <i>ccm</i> datastore of data level 1.
     * In this case the callback could be the first parameter directly.
     * See [this wiki page]{@link https://github.com/akless/ccm-developer/wiki/Data-Management} for general informations about <i>ccm</i> data management.
     * @memberOf ccm
     * @param {ccm.types.settings} [settings] - <i>ccm</i> datastore settings (see [here]{@link ccm.types.settings} for more details)
     * @param {ccm.types.storeResult} [callback] - when datastore is ready for use
     * @returns {ccm.Datastore} <i>ccm</i> datastore (only if no inner operation is asynchron)
     * @example
     * // get result as first parameter of the callback
     * var settings = {...};
     * ccm.store( settings, function ( result ) { console.log( result ); } );
     * @example
     * // get result as return value (only if no inner operation is asynchron)
     * var settings = {...};
     * var result = ccm.store( settings );
     * console.log( result );
     * @example
     * // provides a empty <i>ccm</i> datastore of data level 1
     * ccm.store( function ( result ) { console.log( result ); } );
     * // without given settings the callback could be the first parameter directly
     */
    store: function ( settings, callback ) {

      // settings are a function? => settings are callback
      if ( typeof settings === 'function' ) { callback = settings; settings = undefined; }

      // no ccm datastore settings? => use empty object
      if ( !settings ) settings = {};

      // ccm datastore settings are an URL or ccm datasets? => use object with local cache entry that contains the URL
      if ( typeof settings === 'string' || ( ccm.helper.isObject( settings ) && !settings.local && !settings.store ) ) settings = { local: settings };

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
      return typeof settings.local === 'string' ? ccm.load( settings.local, proceed ) : proceed( settings.local );

      /**
       * proceed with creating ccm datastore
       * @param {ccm.types.datasets} datasets - initial datasets for local cache
       * @returns {ccm.Datastore} created ccm datastore
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
         * @returns {ccm.Datastore} created ccm datastore
         */
        function proceed() {

          /**
           * created ccm datastore
           * @type {ccm.Datastore}
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
     * @summary get directly a <i>ccm</i> dataset out of a <i>ccm</i> datastore
     * @memberOf ccm
     * @param {ccm.types.settings} [settings] - <i>ccm</i> datastore settings
     * @param {ccm.types.key} [key] - <i>ccm</i> dataset key (default: get complete local cache)
     * @param {function} [callback] - callback (first parameter is the requested <i>ccm</i> datastore)
     * @returns {ccm.types.dataset} requested <i>ccm</i> dataset (only if synchron)
     * @ignore
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
     * @ignore
     */
    context: {

      /**
       * @summary find parent instance by property
       * @param {ccm.types.instance} instance - <i>ccm</i> instance (starting point)
       * @param {string} property - instance property
       * @returns {ccm.types.instance} highest result in current ccm context
       */
      find: function ( instance, property ) {

        var start = instance;
        while ( instance = instance.parent )
          if ( instance[ property ] && instance[ property ] !== start )
            return instance[ property ];

      },

      /**
       * @summary get <i>ccm</i> context root
       * @param {ccm.types.instance} instance - <i>ccm</i> instance (starting point)
       * @returns {ccm.types.instance}
       */
      root: function ( instance ) {

        while ( instance.parent )
          instance = instance.parent;

        return instance;

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
       * @param {ccm.types.action} action
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

        return typeof obj === 'object' ? jQuery.extend( !flat, {}, obj ) : undefined;

      },

      /**
       * @summary get dataset for rendering (not generalized yet)
       * @description get dataset using self.store and self.key and return it or returns new dataset if not exists
       * @param {ccm.types.instance} self - <i>ccm</i> instance that need the dataset for rendering
       * @param {function} callback - callback (first parameter is result dataset)
       * @ignore
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
       * @summary reselect website area of <i>ccm</i> instance and add html div tag inside for embedded content with <i>ccm</i> loading icon inside
       * @param {ccm.types.instance} instance - <i>ccm</i> instance
       * @returns {ccm.types.element} added html div tag
       */
      element: function ( instance ) {

        // reselect ccm instance website area
        ccm.helper.reselect( instance );

        /**
         * ccm component name
         * @type {ccm.types.name}
         */
        var name = instance.component.name;

        // css classes given as array? => join to string
        if ( jQuery.isArray( instance.classes ) ) instance.classes = instance.classes.join( ' ' );

        // add html div tag in ccm instance website area
        instance.element.html( '<div id="ccm-' + instance.index + '" class="ccm ' + ( instance.classes ? instance.classes : 'ccm-' + name ) + '"></div>' );

        /**
         * added html div
         * @type {ccm.types.element}
         */
        var element = instance.element.find( 'div[id="ccm-' + instance.index + '"]' );

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
       * @ignore
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
       * @summary find elements inside a website area of a <i>ccm</i> instance
       * @param {ccm.types.instance} instance - <i>ccm</i> instance
       * @param {ccm.types.element} [element] - website area of <i>ccm</i> instance (default: own website area)
       * @param {string} selector - jQuery selector
       */
      find: function ( instance, element, selector ) {

        if ( typeof element === 'string' ) { selector = element; element = undefined; }

        if ( !element ) element = instance.element;

        return element.find( selector + ':not(.ccm, #ccm-' + instance.index + ' .ccm *)' );

      },

      /**
       * @summary focus input field and set cursor to specific position
       * @param {ccm.types.element} input - input field
       * @param {number} [position] - cursor position in input field (default: behind last character)
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
          if ( typeof val === 'function' ) { functions[ 0 ].push( val ); return '%f0%'; }
          return val;
        } );

        for ( var i = 1; i < arguments.length; i++ ) {
          if ( typeof arguments[ i ] === 'function' ) { functions[ 1 ].push( arguments[ i ] ); arguments[ i ] = '%f1%'; }
          if ( typeof arguments[ i ] === 'object' )
            for ( var key in arguments[ i ] ) {
              if ( typeof arguments[ i ][ key ] === 'function' ) { functions[ 1 ].push( arguments[ i ][ key ] ); arguments[ i ][ key ] = '%f1%'; }
              if ( typeof arguments[ i ][ key ] === 'string' ) arguments[ i ][ key ] = escape( arguments[ i ][ key ] );
              string = string.replace( new RegExp( '%'+key+'%', 'g' ), arguments[ i ][ key ] );
            }
          else {
            if ( typeof arguments[ i ] === 'string' ) arguments[ i ] = escape( arguments[ i ] );
            string = string.replace( /%%/, arguments[ i ] );
          }
        }

        return JSON.parse( string, function ( key, val ) {
          if ( val === '%f0%' ) return functions[ 0 ].shift();
          if ( val === '%f1%' ) return functions[ 1 ].shift();
          return val;
        } );

        function escape( string ) {
          return string.replace( /"/g, "'" ).replace( /\\/g, '\\\\' ).replace( /\n/g, '\\n' ).replace( /\r/g, '\\r' ).replace( /\t/g, '\\t' ).replace( /\f/g, '\\f' );
        }

      },

      /**
       * @summary get html form data
       * @param {ccm.types.element} form - html form tag
       * @returns {Object.<string, string>} result data
       */
      formData: function ( form ) {

        // Checkboxen selektieren
        form.find( 'input[type=checkbox]' ).each( function () {

          /**
           * Selektierte Checkbox
           * @type {ccm.types.element}
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
           * @type {ccm.types.element}
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
       * @description
       * An automatic generated unique key is made up of three parts.
       * The first part is the current time in milliseconds.
       * The second part is an 'X' as separator between first and last part.
       * The last part is a random number.
       * @returns {ccm.types.key} unique key
       * @example console.log( ccm.helper.generateKey() );  // 1465718738384X6869462723575014
       */
      generateKey: function () {

        return Date.now() + 'X' + Math.random().toString().substr( 2 );

      },

      /**
       * @summary get cursor position in an input field
       * @param {ccm.types.element} input - input field
       * @returns {number}
       */
      getCursor: function ( input ) {

        return input.get( 0 ).selectionStart;

      },

      /*
       * @summary ...
       * @returns {object}
       *
       getDateTime: function getDateTime( date, lang ) {

       if ( !date ) date = new Date();

       var result = {

       date: date,
       d:    date.getDate(),
       m:    date.getMonth() + 1,
       yyyy: date.getFullYear(),
       h:    date.getHours(),
       min:  date.getMinutes()

       };

       result.dd     = ( result.d   < 10 ? '0' : '' ) + result.d;
       result.mm     = ( result.m   < 10 ? '0' : '' ) + result.m;
       result.yy     = ( result.yyyy % 100 ) + '';
       result.hh     = ( result.h   < 10 ? '0' : '' ) + result.h;
       result.minmin = ( result.min < 10 ? '0' : '' ) + result.min;

       return result;

       },
       */

      /**
       * @summary get id of the website area for content of an <i>ccm</i> instance
       * @param {ccm.types.instance} instance - <i>ccm</i> instance
       * @returns {string}
       */
      getElementID: function ( instance ) {

        return 'ccm-' + instance.index;

      },

      /**
       * @summary generate HTML with JSON (recursive)
       * @param {ccm.types.html|ccm.types.html[]} html - <i>ccm</i> html data
       * @param {...string} [values] - values to replace placeholder
       * @returns {ccm.types.element|ccm.types.element[]} generated HTML
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
        if ( typeof html === 'string' ) html = ccm.helper.val( html );

        // get no ccm html data? => return parameter value
        if ( typeof html !== 'object' ) return html;

        /**
         * HTML tag
         * @type {ccm.types.element}
         */
        var element = jQuery( '<' + ccm.helper.val( html.tag || 'div', true ) + '>' );

        // remove 'tag' property
        delete html.tag;

        // iterate over ccm html data properties
        for ( var key in html ) {

          /**
           * value of ccm html data property
           * @type {string|ccm.types.html|Array}
           */
          var value = html[ key ];

          // interpret ccm html data property
          switch ( key ) {

            // HTML tag attribute flags
            case 'async':
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
            case 'onblur':       element.blur       ( value ); break;
            case 'onchange':     element.change     ( value ); break;
            case 'onclick':      element.click      ( value ); break;
            case 'ondblclick':   element.dblclick   ( value ); break;
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

        if ( typeof value !== 'string' ) value = value.toString();
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
       * @summary integrate priority data into a dataset
       * @description
       * Each value of each property in the given priority data will be set in the given dataset for the property of the same name.
       * A priority data property with the explicit value <i>undefined</i> provokes to delete the same property in the given dataset.
       * With no given priority data, the result is the given dataset.
       * With no given dataset, the result is the given priority data.
       * @param {object} [priodata] - priority data
       * @param {object} [dataset] - dataset
       * @returns {object} dataset with integrated priority data
       * @example
       * var dataset  = { firstname: 'John', lastname: 'Doe', fullname: 'John Doe' };
       * var priodata = { lastname: 'Done', fullname: undefined };
       * var result = ccm.helper.integrate( priodata, dataset );
       * console.log( result );  // { firstname: 'John', lastname: 'Done' };
       * @example
       * var result = ccm.helper.integrate( { value: 'foo' } );
       * console.log( result );  // { value: 'foo' }
       * @example
       * var result = ccm.helper.integrate( undefined, { value: 'foo' } );
       * console.log( result );  // { value: 'foo' }
       */
      integrate: function ( priodata, dataset ) {

        // no given priority data? => return given dataset
        if ( !priodata ) return dataset;

        // no given dataset? => return given priority data
        if ( !dataset ) return priodata;

        // iterate over priority data properties
        for ( var i in priodata ) {

          // property value is not undefined? => set value for the same property in the given dataset
          if ( priodata[ i ] !== undefined ) dataset[ i ] = priodata[ i ];

          // otherwise => delete same property in the given dataset
          else delete dataset[ i ];

        }

        // return dataset with integrated priority data
        return dataset;

      },

      /**
       * @summary check value for <i>ccm</i> component
       * @param {*} value - value to check
       * @returns {boolean}
       */
      isComponent: function ( value ) {

        return typeof value === 'object' && value !== null && value.Instance && true;

      },

      /**
       * check value for <i>ccm</i> dataset
       * @param {*} value - value to check
       * @returns {boolean}
       */
      isDataset: function ( value ) {

        return typeof value === 'object' && !jQuery.isArray( value ) && value !== null;

      },

      /**
       * check value if it is a <i>ccm</i> dependency
       * @param {*} value
       * @returns {boolean}
       * @example [ ccm.load, ... ]
       * @example [ ccm.component, ... ]
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
              case ccm.component:
              case "ccm.component":
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
       * @summary check value if it is an jQuery element
       * @param value
       * @returns {boolean}
       */
      isElement: function ( value ) {

        return value instanceof jQuery;

      },

      /**
       * @summary check if website area for own content of a ccm instance exists in DOM
       * @param {ccm.types.instance} instance - <i>ccm</i> instance
       * @returns {boolean}
       */
      isInDOM: function ( instance ) {

        return ccm.helper.tagExists( jQuery( '#ccm-' + instance.index ) );

      },

      /**
       * @summary check value for <i>ccm</i> instance
       * @param {*} value - value to check
       * @returns {boolean}
       */
      isInstance: function ( value ) {

        return typeof value === 'object' && value !== null && value.component && true;

      },

      /*
       * @summary check value for <i>ccm</i> datastore
       * @param {*} value - value to check
       * @returns {boolean}
       *
       isStore: function ( value ) {

       return typeof value === 'object' && value !== null && value.local;

       },
       */

      /**
       * check value if it is an object (including not null and not array)
       * @param {*} value - value to check
       * @returns {boolean}
       */
      isObject: function ( value ) {

        return typeof value === 'object' && value !== null && !Array.isArray( value );

      },

      /**
       * check value if it is a ccm proxy instance
       * @param {*} value - value to check
       * @returns {boolean}
       */
      isProxy: function ( value ) {

        return ccm.helper.isInstance( value ) && typeof value.component === 'string';

      },

      /**
       * @summary checks if an object is a subset of another object
       * @param {object} obj - object
       * @param {object} other - another object
       * @returns {boolean}
       */
      isSubset: function ( obj, other ) {

        for ( var i in obj )
          if ( typeof obj[ i ] === 'object' && typeof other[ i ] === 'object' ) {
            if ( JSON.stringify( obj[ i ] ) !== JSON.stringify( other[ i ] ) )
              return false;
          }
          else if ( obj[ i ] !== other[ i ] )
            return false;

        return true;

      },

      /**
       * render <i>ccm</i> loading icon in a website area
       * @param {ccm.types.element} element - website area
       */
      loading: function ( element ) {

        ( element ? element : jQuery( 'body' ) ).html( jQuery( '<div>' ).css( {

          display: 'inline-block',
          width: '0.5em',
          height: '0.5em',
          border: '0.15em solid #009ee0',
          'border-right-color': 'transparent',
          'border-radius': '50%',
          animation: 'ccm_loading 1s linear infinite'

        } ) );

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
       * @summary privatization of public <i>ccm</i> instance members
       * @description Delete all given properties in the given <i>ccm</i> instance and returns an object with the deleted properties and there values.
       * @param {ccm.types.instance} instance - <i>ccm</i> instance
       * @param {...string} [properties] - properties that have to privatized
       * @returns {object} object that contains the privatized properties and there values
       */
      privatize: function ( instance, properties ) {

        var obj = {};
        for ( var i = 1; i < arguments.length; i++ ) {
          var key = arguments[ i ];
          obj[ key ] = instance[ key ];
          delete instance[ key ];
        }
        return obj;

      },

      /**
       * @summary get regular expression
       * @param {string} index - regular expression index
       * @returns {object} regular expression object
       */
      regex: function ( index ) {

        switch ( index ) {
          case 'key':  return /^[a-z_0-9][a-zA-Z_0-9]*$/;
          case 'name': return /^[a-z][a-z_0-9]*$/;
          case 'tag':  return /^[a-z][a-zA-Z]*$/;
          case 'url':  return /^(((http|ftp|https):\/\/)?[\w-]+(\.[\w-]*)+)?([\w.,@?^=%&amp;:\/~+#-]*[\w@?^=%&amp;\/~+#-])?$/;
        }

      },

      /**
       * reselect <i>ccm</i> instance website area
       * @param {ccm.types.element} instance - <i>ccm</i> instance
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
       * @param {ccm.types.element} element - html tag
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
       * @param {ccm.types.regex|string|boolean} [regex] - given regular expression
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
        return ( typeof regex === 'string' ? ccm.helper.regex( regex ) : regex ).test( string ) ? string : null;

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

    // filter component name from filename
    var split = filename.split( '.' );
    if ( split[ 0 ] === 'ccm' && split[ split.length - 1 ] === 'js' && ( split.length === 3 || split[ 2 ] === 'min' ) )
      return split[ 1 ];
    else {
      // remove file extension and return resulting ccm component index # DEPRECATED
      return filename.substr( 0, filename.lastIndexOf( '.' ) );
    }

  }

  /**
   * @summary get <i>ccm</i> datastore source
   * @private
   * @param {ccm.types.settings} settings - <i>ccm</i> datastore settings
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
   * @summary <i>ccm</i> type definitions
   * @namespace ccm.types
   */

  /**
   * @summary <i>ccm</i> action data
   * @typedef {function|string|Array} ccm.types.action
   * @example function() { ... }
   * @example functionName
   * @example 'functionName'
   * @example 'my.namespace.functionName'
   * @example ['my.namespace.functionName','param1','param2']
   */

  /**
   * @summary <i>ccm</i> component object
   * @typedef {namespace} ccm.types.component
   * @description Below you see typically (but not all mandatory) properties. Most of these properties are set by the <i>ccm</i> framework.
   * @property {ccm.types.index} index - <i>ccm</i> component index
   * @property {ccm.types.name} name - <i>ccm</i> component name
   * @property {ccm.types.version} version - <i>ccm</i> component version number
   * @property {ccm.types.config} config - default configuration for own <i>ccm</i> instances
   * @property {function} Instance - constructor for creating <i>ccm</i> instances out of this component
   * @property {function} init - callback when this component is registered
   * @property {function} instance - creates an <i>ccm</i> instance out of this component
   * @property {function} render - creates and renders an <i>ccm</i> instance
   * @property {number} instances - number of own created <i>ccm</i> instances
   * @example {
   *   index:     'chat-2.1.3',
   *   name:      'chat',
   *   version:   [ 2, 1, 3 ],
   *   config:    {...},
   *   Instance:  function () {...},
   *   init:      function ( callback ) { ...; callback(); },
   *   instance:  function ( config, callback ) {...},
   *   render:    function ( config, callback ) {...},
   *   instances: 0
   * }
   */

  /**
   * @summary <i>ccm</i> instance configuration
   * @description Below you see typically (but not mandatory) properties.
   * @typedef {object} ccm.types.config
   * @property {ccm.types.element} element - <i>ccm</i> instance website area
   * @property {ccm.types.dependency} html - <i>ccm</i> datastore for html templates
   * @property {ccm.types.dependency} style - CSS styles for own website area
   * @property {string} classes - html classes for own website area
   * @property {ccm.types.dependency} store - <i>ccm</i> datastore that contains the dataset for rendering
   * @property {ccm.types.key} key - key of dataset for rendering
   * @property {ccm.types.dependency} lang - <i>ccm</i> instance for multilingualism
   * @property {ccm.types.dependency} user - <i>ccm</i> instance for user authentication
   * @example {
   *   element: jQuery( '#container' ),
   *   html:    [ ccm.store, { local: 'templates.json' } ],
   *   style:   [ ccm.load, 'style.css' ],
   *   classes: 'ccm-chat_snow'
   *   store:   [ ccm.store, { url: 'ws://ccm2.inf.h-brs.de/index.js', store: 'chat' } ],
   *   key:     'test',
   *   lang:    [ ccm.instance, 'https://kaul.inf.h-brs.de/ccm/components/lang.js', {
   *     store: [ ccm.store, 'translations.json' ]
   *   } ],
   *   user:    [ ccm.instance, 'https://kaul.inf.h-brs.de/ccm/components/user.js' ]
   * }
   */

  /**
   * @summary <i>ccm</i> dataset
   * @description
   * Every <i>ccm</i> dataset has a property 'key' which contains the unique key of the dataset.
   * There are no conventions for other properties. They can be as they want.
   * @typedef {object} ccm.types.dataset
   * @example {
   *   "key": "demo",
   *   "text": "Hello, World!",
   *   "value": "4711"
   * }
   * @example {
   *   "key": "my_first_video_rating",
   *   "likes": {                       // users which clicks like button
   *     "akless": true,
   *     "hunny84": true
   *   },
   *   "dislikes": {                    // user which clicks dislike button
   *     "negativguy": true
   *   }
   * }
   * @example {
   *   "key": "fruit_game_settings",
   *   "max_player": 2,
   *   "fruits": [
   *     {
   *       "name": "Apple",
   *       "points": 50
   *     },
   *     {
   *       "name": "Pear",
   *       "points": 30
   *     }
   *   ]
   * }
   */

  /**
   * @summary collection of <i>ccm</i> datasets
   * @typedef {Object.<ccm.types.key, ccm.types.dataset>} ccm.types.datasets
   * @example {
   *   "demo": {
   *     "key": "demo",
   *     "text": "Hello, World!",
   *     "value": "4711"
   *   },
   *   "test": {
   *     "key": "test",
   *     "text": "My test dataset.",
   *     "value": "abc"
   *   }
   * }
   */

  /**
   * @summary callback when an delete operation is finished
   * @callback ccm.types.delResult
   * @param {ccm.types.dataset} result - deleted dataset
   * @example function () { console.log( result ); }
   */

  /**
   * @summary <i>ccm</i> dependency
   * @typedef {ccm.types.action} ccm.types.dependency
   * @example [ ccm.component, 'ccm.chat.js' ]
   * @example [ ccm.instance, 'ccm.chat.js' ]
   * @example [ ccm.render, 'ccm.chat.js' ]
   * @example [ ccm.load, 'style.css' ]
   * @example [ ccm.store, { local: 'datastore.json' } ]
   * @example [ ccm.dataset, { local: 'datastore.json' }, 'test' ]
   */

  /**
   * @summary "jQuery Element" object
   * @description For more informations about jQuery see ({@link https://jquery.com}).
   * @typedef {object} ccm.types.element
   * @example var element = jQuery( 'body' );
   * @example var element = jQuery( '#menu' );
   * @example var element = jQuery( '.entry' );
   */

  /**
   * @summary callback when a read operation is finished
   * @callback ccm.types.getResult
   * @param {ccm.types.dataset|ccm.types.dataset[]} result - requested dataset(s)
   * @example function ( result ) { console.log( result ) }
   */

  /**
   * @summary <i>ccm</i> html data - TODO: explain properties of <i>ccm</i> html data
   * @typedef {object} ccm.types.html
   * @ignore
   */

  /**
   * @summary <i>ccm</i> component index (unique in <i>ccm</i> framework)
   * @description An <i>ccm</i> component index is made up of a [component name]{@link ccm.types.name} and its [version number]{@link ccm.types.version}.
   * @typedef {string} ccm.types.index
   * @example "blank-1.0.0"
   * @example "chat-2.1.3"
   * @example "blank" // no version number means latest version
   * @example "chat"
   */

  /**
   * @summary <i>ccm</i> instance
   * @typedef {object} ccm.types.instance
   * @property {number} id - <i>ccm</i> instance id (unique in own component)
   * @property {string} index - <i>ccm</i> instance index (unique in <i>ccm</i> framework)<br>A <i>ccm</i> instance index is made up of own [component name]{@link ccm.types.name} and own [id]{@link ccm.types.instance} (example: <code>"chat-1"</code>).
   * @property {ccm.types.component} component - reference to associated <i>ccm</i> component
   * @property {function} init - callback when this <i>ccm</i> instance is created and before dependencies of dependent resources are solved
   * @property {function} ready - callback when all dependencies of dependent resources are solved
   * @property {function} render - render content in own website area
   */

  /**
   * @summary "jQuery XMLHttpRequest" object
   * @typedef {object} ccm.types.JqXHR
   */

  /**
   * @summary key of a <i>ccm</i> dataset (unique in the <i>ccm</i> datastore which contains the dataset)
   * @description Must be conform with the regular expression /^[a-z_0-9][a-zA-Z_0-9]*$/.
   * @typedef {string|number} ccm.types.key
   * @example "test"
   * @example "_foo"
   * @example 4711
   * @example "1_ABC___4711"
   * @example "123"
   * @example "_"
   */

  /**
   * @summary name of a <i>ccm</i> component (unique in a <i>ccm</i> component market place)
   * @description Must be conform with the regular expression /^[a-z][a-z_0-9]*$/.
   * @typedef {string} ccm.types.name
   * @example "blank"
   * @example "chat"
   * @example "my_blank"
   * @example "chat2"
   * @example "bank_001"
   */

  /**
   * @summary regular expression
   * @typedef {object} ccm.types.regex
   * @example var regex = /^[A-Z][a-z]*$/g;
   * @example var regex = new RegExp( '^[A-Z][a-z]*$', 'g' );
   */

  /**
   * @summary callback when an create or update operation is finished
   * @callback ccm.types.setResult
   * @param {ccm.types.dataset} result - created or updated dataset
   * @example function ( result ) { console.log( result ) }
   */

  /**
   * @summary <i>ccm</i> datastore settings
   * @description
   * Settings for a <i>ccm</i> datastore.
   * For more informations about providing a <i>ccm</i> datastore see the [documentation of the method 'ccm.store']{@link ccm.store}.
   * The data level in which the stored datasets will managed is dependent on the existing properties in the datastore settings.
   * No property 'store' results in a <i>ccm</i> datastore of data level 1.
   * An existing property 'store' results in a <i>ccm</i> datastore of data level 2.
   * An existing property 'store' and 'url' results in a <i>ccm</i> datastore of data level 3.
   * @typedef {object} ccm.types.settings
   * @property {ccm.types.datasets|ccm.types.url} local - collection of initial <i>ccm</i> datasets or URL to a json file that deliver initial datasets for local cache (see [here]{@link ccm.Datastore#local} for more details)
   * @property {string} store - datastore name in database (see [here]{@link ccm.Datastore#store} for more details)
   * @property {string} url - URL to an <i>ccm</i> compatible server interface (see [here]{@link ccm.Datastore#url} for more details)
   * @property {function} onChange - callback when server informs about changed stored datasets (see [here]{@link ccm.Datastore#onChange} for more details)
   * @example
   * // provides a ccm datastore of data level 1 with initial datasets from a JSON file
   * {
   *   local: 'templates.json'
   * }
   * @example
   * // same example but cross domain
   * {
   *   local: 'http://akless.github.io/ccm-developer/resources/chat/templates.json'
   * }
   * // cross domain only works if json file looks like this: ccm.callback[ 'templates.json' ]( {...} );
   * @example
   * // provides a ccm datastore of data level 1 with directly given initial datasets
   * {
   *   local: {
   *     "demo": {
   *       "key": "demo",
   *       "text": "Hello, World!",
   *       "value": "4711"
   *     },
   *     "test": {
   *       "key": "test",
   *       "text": "My test dataset.",
   *       "value": "abc"
   *     }
   *   }
   * }
   * @example
   * // provides a ccm datastore of data level 2
   * {
   *   store: 'chat'
   * }
   * @example
   * // provides a ccm datastore of data level 3 using HTTP
   * {
   *   store: 'chat',                              // The file interface.php must be
   *   url: 'http://path/to/server/interface.php'  // an ccm compatible server interface
   * }
   * @example
   * // provides a ccm realtime datastore of data level 3 using WebSocket
   * {
   *   store: 'chat',                              // The file interface.php must be
   *   url: 'ws://path/to/server/interface.php',   // an ccm compatible server interface
   *   onChange: function () {
   *     console.log( arguments );  // Shows the server informations about changed
   *   }                            // stored datasets in the developer console.
   * }
   */

  /**
   * @summary <i>ccm</i> datastore source - TODO: explain forms of <i>ccm</i> datasstore sources
   * @typedef {string|object} ccm.types.source
   */

  /**
   * @summary callback when a provided datastore is ready for use
   * @callback ccm.types.storeResult
   * @param {ccm.Datastore} store - <i>ccm<i/> datastore
   * @example function ( store ) { console.log( store ) }
   */

  /**
   * @summary Uniform Resource Locator (URL)
   * @typedef {string} ccm.types.url
   * @example https://github.com/akless/ccm-developer
   * @example ws://ccm2.inf.h-brs.de/index.js:80
   * @example http://akless.github.io/ccm-developer/resources/ccm.chat.min.js
   */

  /**
   * @summary version number conform with Semantic Versioning 2.0.0 ({@link http://semver.org})
   * @typedef {number[]} ccm.types.version
   * @example [1,0,0]
   * @example [2,1,3]
   */

}();